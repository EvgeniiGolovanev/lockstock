import { test, expect, materialInput } from "./fixtures";
import type { Route } from "@playwright/test";

for (const width of [1440, 390]) {
  test(`list feedback retries only reads across network failures and workspace switching at ${width}px`, async ({ inventory, page }, testInfo) => {
    test.setTimeout(360_000);
    const { materials: [material], locations: [location], suppliers: [supplier] } = await inventory.catalog();
    await inventory.post("/materials", materialInput("Retry material"));
    await inventory.post("/suppliers", { name: "Retry vendor" });
    for (let i = 0; i < 20; i++) await inventory.post("/suppliers", { name: `Pagination ${i}` });
    await inventory.post("/purchase-orders", { supplier_id: supplier.id, po_number: "Retry-PO", lines: [{ material_id: material.id, quantity_ordered: 1 }] });
    await inventory.post("/stock/movements", { material_id: material.id, location_id: location.id, reason: "adjustment", quantity_delta: 10, note: "List acceptance" });
    const other = await inventory.actor(); await other.catalog();
    expect((await inventory.db.from("org_users").insert({ org_id: other.orgId, user_id: inventory.userId, role: "viewer" })).error).toBeNull();
    const before = [await inventory.snapshot(), await other.snapshot()];
    const errors: string[] = [], writes: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    page.on("request", request => {
      if (request.method() !== "GET" && /^\/api\/(materials|locations|suppliers|stock|purchase-orders|organizations)(\/|$)/.test(new URL(request.url()).pathname)) writes.push(request.method());
    });
    const readAlert = page.getByRole("alert").filter({ hasText: "Could not load data" });
    let target = "", mode: "pass" | "503" | "abort" | "hold" = "pass", holdOther = false;
    const held: Array<{ route: Route; release: () => void; done: Promise<void> }> = [];
    await page.route("**/api/**", async route => {
      const request = route.request(), url = new URL(request.url());
      if (request.method() !== "GET") { await route.continue(); return; }
      const otherWorkspace = holdOther && request.headers()["x-org-id"] === other.orgId;
      if (otherWorkspace && url.pathname === "/api/suppliers" && url.searchParams.get("status") === "active") {
        await expect.poll(() => held.length).toBeGreaterThan(0);
        await route.fulfill({ status: 503, contentType: "application/json", body: '{"error":"Read unavailable"}' }); return;
      }
      const listRead = url.pathname === target && url.searchParams.get("limit") !== "100";
      if ((otherWorkspace && url.pathname === "/api/materials") || (listRead && mode === "hold")) {
        let release!: () => void, complete!: () => void;
        const waiting = new Promise<void>(resolve => { release = resolve; });
        const done = new Promise<void>(resolve => { complete = resolve; });
        held.push({ route, release, done });
        const response = await route.fetch(); expect(response.status()).toBe(200);
        await waiting;
        // A late failure from the previous workspace must not replace current UI state.
        if (otherWorkspace) await route.fulfill({ status: 503, contentType: "application/json", body: '{"error":"Late workspace error"}' });
        else await route.fulfill({ response });
        complete(); return;
      }
      if (listRead && mode === "503") await route.fulfill({ status: 503, contentType: "application/json", body: '{"error":"Read unavailable"}' });
      else if (listRead && mode === "abort") await route.abort("connectionfailed");
      else await route.continue();
    });
    const release = async () => {
      const pending = held.splice(0);
      const received = pending.map(({ route }) => page.waitForResponse(response => response.request() === route.request()));
      pending.forEach(read => read.release());
      await Promise.all(pending.map(read => read.done));
      await Promise.all(received.map(async read => (await read).finished()));
      await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    };
    await page.setViewportSize({ width, height: 900 }); await inventory.login(page);
    for (const flow of [
      { path: "/materials", api: "/api/materials", value: "Test MAT-PC", empty: "No materials match these filters.", input: "Search by name or SKU...", result: "Test Retry material" },
      { path: "/vendors", api: "/api/suppliers", value: "Vendor A", empty: "No suppliers created yet.", input: "Filter by vendor name, ID, phone, or address", result: "Retry vendor" },
      { path: "/purchase-orders", api: "/api/purchase-orders", value: "Retry-PO", empty: "No purchase orders match these filters.", input: "Search by PO number...", result: "Retry-PO" },
      { path: "/locations", api: "/api/locations", value: "Warehouse A", empty: "No locations created yet." },
      { path: "/stock-movements", api: "/api/stock/movements", value: "List acceptance", empty: "No material movements yet." },
      { path: "/inventory", api: "/api/materials", value: "Test MAT-PC", empty: "No inventory items match these filters." }
    ]) {
      target = flow.api; mode = "503";
      await page.goto(flow.path); await page.waitForLoadState("networkidle");
      await expect(readAlert).toContainText("Could not load data");
      await expect(page.getByText(flow.empty, { exact: true })).toHaveCount(0);
      await page.screenshot({ path: testInfo.outputPath(`${flow.path.slice(1)}-error-${width}.png`), fullPage: true });
      mode = "abort";
      await page.getByRole("button", { name: "Retry", exact: true }).click();
      await expect(readAlert).toContainText("Could not load data");
      mode = "hold";
      await page.getByRole("button", { name: "Retry", exact: true }).click();
      await expect.poll(() => held.length).toBeGreaterThan(0);
      await expect(page.getByRole("status")).toContainText("Loading data");
      await expect(page.getByRole("button", { name: "Retry", exact: true })).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Export CSV", exact: true })).toBeDisabled();
      mode = "pass"; await release();
      await expect(readAlert).toHaveCount(0);
      await expect(page.getByText(flow.value, { exact: true }).first()).toBeVisible();
      if (flow.input) {
        mode = "503"; await page.getByPlaceholder(flow.input).fill("Retry");
        await expect(readAlert).toContainText("Displayed data has not been refreshed");
        await expect(page.getByRole("button", { name: "Export CSV", exact: true })).toBeDisabled();
        mode = "hold"; await page.getByRole("button", { name: "Retry", exact: true }).click();
        await expect.poll(() => held.length).toBeGreaterThan(0);
        expect(new URL(held[0].route.request().url()).searchParams.get("q")).toBe("Retry");
        mode = "pass"; await release();
        await expect(page.getByText(flow.result!, { exact: true })).toBeVisible();
        // Only a successful empty read may show the empty state.
        await page.getByPlaceholder(flow.input).fill("NoSuchRecordEver");
        await expect(page.getByRole("status")).toHaveCount(0);
        await expect(readAlert).toHaveCount(0);
        await expect(page.getByText(flow.path === "/vendors" ? "No suppliers match these filters." : flow.empty, { exact: true })).toBeVisible();
      }
      if (flow.path === "/vendors") {
        await page.getByPlaceholder(flow.input!).fill(""); await page.waitForLoadState("networkidle");
        await page.getByRole("combobox").selectOption("active"); await page.waitForLoadState("networkidle");
        mode = "503"; await page.getByRole("button", { name: "Next", exact: true }).click();
        await expect(readAlert).toContainText("Displayed data has not been refreshed");
        mode = "hold"; await page.getByRole("button", { name: "Retry", exact: true }).click();
        await expect.poll(() => held.length).toBeGreaterThan(0);
        const params = new URL(held[0].route.request().url()).searchParams;
        expect(params.get("page")).toBe("2"); expect(params.get("status")).toBe("active");
        mode = "pass"; await release();
        await expect(page.getByRole("cell", { name: "Pagination 19", exact: true })).toBeVisible();
        await expect(page.getByRole("combobox")).toHaveValue("active");
        await expect(page.getByRole("button", { name: "Previous", exact: true })).toBeEnabled();
      }
      console.log(`${width}px ${flow.path}: loading, failures and GET-only recovery passed`);
    }
    target = ""; mode = "pass";
    await page.goto("/members"); await page.waitForLoadState("networkidle");
    holdOther = true;
    await page.getByRole("button", { name: "Open Group", exact: true }).click();
    await expect.poll(() => held.length).toBeGreaterThan(0);
    await expect(page.getByRole("button", { name: "Open Group", exact: true })).toBeEnabled();
    const returned = page.waitForResponse(response => new URL(response.url()).pathname === "/api/materials" && response.request().headers()["x-org-id"] === inventory.orgId);
    await page.getByRole("button", { name: "Open Group", exact: true }).click(); await (await returned).finished();
    await page.evaluate(() => history.pushState(null, "", "/materials"));
    await expect(page.getByText("Test MAT-PC", { exact: true })).toBeVisible();
    await expect(page.getByRole("status")).toHaveCount(0);
    holdOther = false; await release();
    await expect(readAlert).toHaveCount(0);
    await expect(page.getByText("Test MAT-PC", { exact: true })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath(`workspace-recovered-${width}.png`), fullPage: true });
    expect(errors).toEqual([]); expect(writes).toEqual([]);
    expect([await inventory.snapshot(), await other.snapshot()]).toEqual(before);
  });
}

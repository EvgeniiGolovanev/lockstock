import { test, expect, materialInput } from "./fixtures";
import type { Request } from "@playwright/test";

for (const width of [1440, 390]) {
  test(`lists keep current results across delayed reads and workspace switching at ${width}px`, async ({ inventory, page }, testInfo) => {
    test.setTimeout(360_000);
    const { materials: [material], suppliers: [supplier] } = await inventory.catalog();
    const other = await inventory.actor();
    const { materials: [otherMaterial], suppliers: [otherSupplier] } = await other.catalog();
    const joined = await inventory.db.from("org_users").insert({ org_id: other.orgId, user_id: inventory.userId, role: "viewer" });
    expect(joined.error).toBeNull();
    for (const name of ["Slowold", "Latestnew"]) {
      await inventory.post("/materials", { ...materialInput(name), name: `${name} material` });
      await inventory.post("/purchase-orders", { supplier_id: supplier.id, po_number: `${name}-PO`, lines: [{ material_id: material.id, quantity_ordered: 1 }] });
    }
    // Separate real API writes stay within each request's database time budget.
    for (let i = 0; i < 20; i++) await inventory.post("/suppliers", { name: `Filler ${i}` });
    for (const name of ["Slowold vendor", "Latestnew, vendor"]) await inventory.post("/suppliers", { name, phone: "+33612345678" });
    await other.post("/suppliers", { name: "Other workspace vendor" });
    await other.post("/purchase-orders", { supplier_id: otherSupplier.id, po_number: "Other-workspace-PO", lines: [{ material_id: otherMaterial.id, quantity_ordered: 1 }] });
    const before = [await inventory.snapshot(), await other.snapshot()];
    const errors: string[] = [], writes: string[] = [];
    const activeReads = new Set<Request>();
    page.on("pageerror", error => errors.push(error.message));
    page.on("request", request => {
      if (request.method() === "GET" && new URL(request.url()).pathname.startsWith("/api/") && request.headers()["x-org-id"] !== other.orgId) activeReads.add(request);
      if (request.method() !== "GET" && /^\/api\/(materials|locations|suppliers|stock|purchase-orders|organizations)(\/|$)/.test(new URL(request.url()).pathname)) writes.push(`${request.method()} ${new URL(request.url()).pathname}`);
    });
    page.on("requestfinished", request => activeReads.delete(request));
    page.on("requestfailed", request => activeReads.delete(request));
    type Held = { url: string; request: Request; release: () => void; done: Promise<void> };
    const held: Held[] = [];
    let intercept: (request: Request) => "hold" | "fail" | undefined = () => undefined;
    await page.route("**/api/**", async route => {
      if (route.request().method() !== "GET") { await route.continue(); return; }
      const action = intercept(route.request());
      if (action === "fail") {
        // Let the independent list responses enter the network before failing one sibling.
        await expect.poll(() => new Set(held.map(response => new URL(response.url).pathname)).size).toBe(5);
        await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "Read unavailable" }) });
      } else if (action === "hold") {
        const response = await route.fetch();
        expect(response.status()).toBe(200);
        let release!: () => void, finished!: () => void;
        const wait = new Promise<void>(done => { release = done; });
        const done = new Promise<void>(resolve => { finished = resolve; });
        held.push({ url: route.request().url(), request: route.request(), release, done });
        await wait;
        await route.fulfill({ response });
        finished();
      } else await route.continue();
    });
    const release = async () => {
      intercept = () => undefined;
      const responses = held.splice(0);
      const received = responses.map(({ request }) => page.waitForResponse(response => response.request() === request));
      for (const response of responses) response.release();
      await Promise.all(responses.map(response => response.done));
      await Promise.all(received.map(async response => (await response).finished()));
      // Observe after React has painted the delivered responses, avoiding an early negative assertion.
      await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    };
    await page.setViewportSize({ width, height: 900 });
    await inventory.login(page);
    for (const flow of [
      { path: "/materials", api: "/api/materials", input: "Search by name or SKU...", value: "Latestnew material" },
      { path: "/vendors", api: "/api/suppliers", input: "Filter by vendor name, ID, phone, or address", value: "Latestnew, vendor" },
      { path: "/purchase-orders", api: "/api/purchase-orders", input: "Search by PO number...", value: "Latestnew-PO" }
    ]) {
      await page.goto(flow.path); await page.waitForLoadState("networkidle");
      intercept = request => {
        const url = new URL(request.url());
        return url.pathname === flow.api && url.searchParams.get("q") === "Slowold" ? "hold" : undefined;
      };
      await page.getByPlaceholder(flow.input).fill("Slowold");
      await expect.poll(() => held.length).toBe(1);
      await page.getByPlaceholder(flow.input).fill("Latestnew");
      await expect(page.getByText(flow.value, { exact: true })).toBeVisible();
      await release();
      await expect(page.getByText(flow.value, { exact: true })).toBeVisible();
      await expect(page.getByRole("cell", { name: /Slowold/ })).toHaveCount(0);
      await page.screenshot({ path: testInfo.outputPath(`${flow.path.slice(1)}-latest-${width}.png`), fullPage: true });
      if (flow.path === "/vendors") {
        const vendor = (await inventory.rows("suppliers")).find(row => row.name === "Latestnew, vendor")!;
        for (const query of [vendor.name, String(vendor.vendor_number).padStart(8, "0"), "33612345678"]) {
          const requested = page.waitForResponse(response => new URL(response.url()).pathname === flow.api && new URL(response.url()).searchParams.get("q") === query);
          await page.getByPlaceholder(flow.input).fill(query);
          const response = await requested;
          expect(response.status()).toBe(200);
          expect((await response.json()).data.map((row: { id: string }) => row.id)).toContain(vendor.id);
          await expect(page.getByText(vendor.name, { exact: true })).toBeVisible();
        }
      }
    }
    await page.getByPlaceholder("Search by PO number...").fill("");
    await page.waitForLoadState("networkidle");
    intercept = request => {
      const url = new URL(request.url());
      return url.pathname === "/api/purchase-orders" && url.searchParams.get("status") === "draft" ? "hold" : undefined;
    };
    await page.getByRole("combobox", { name: "Status", exact: true }).selectOption("draft");
    await expect.poll(() => held.length).toBe(1);
    await page.getByRole("combobox", { name: "Status", exact: true }).selectOption("sent");
    await expect(page.getByText("Latestnew-PO", { exact: true })).toHaveCount(0);
    await release();
    await expect(page.getByText(/^(Slowold|Latestnew)-PO$/)).toHaveCount(0);
    await expect(page.getByRole("combobox", { name: "Status", exact: true })).toHaveValue("sent");

    await page.goto("/vendors"); await page.waitForLoadState("networkidle");
    intercept = request => {
      const url = new URL(request.url());
      return url.pathname === "/api/suppliers" && url.searchParams.get("page") === "2" && !url.searchParams.has("status") ? "hold" : undefined;
    };
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await expect.poll(() => held.length).toBe(1);
    const firstPage = page.waitForResponse(response => {
      const url = new URL(response.url());
      return url.pathname === "/api/suppliers" && url.searchParams.get("page") === "1" && !url.searchParams.has("status");
    });
    await page.getByRole("button", { name: "Previous", exact: true }).click();
    await (await firstPage).finished();
    await expect(page.getByRole("button", { name: "Previous", exact: true })).toBeDisabled();
    await release();
    await expect(page.getByRole("cell", { name: "Latestnew, vendor", exact: true })).toHaveCount(0);
    await expect(page.getByRole("cell", { name: "Filler 0", exact: true })).toBeVisible();

    await page.goto("/members"); await page.waitForLoadState("networkidle");
    intercept = request => {
      const url = new URL(request.url());
      if (request.headers()["x-org-id"] !== other.orgId) return undefined;
      if (url.pathname === "/api/suppliers" && url.searchParams.get("status") === "active") return "fail";
      return ["/api/materials", "/api/locations", "/api/stock/movements", "/api/suppliers", "/api/purchase-orders"].includes(url.pathname) ? "hold" : undefined;
    };
    await page.getByRole("button", { name: "Open Group", exact: true }).click();
    await expect.poll(() => new Set(held.map(response => new URL(response.url).pathname)).size).toBe(5);
    await expect(page.getByRole("button", { name: "Open Group", exact: true })).toBeEnabled();
    const returnedOrders = page.waitForResponse(response => new URL(response.url()).pathname === "/api/purchase-orders" && response.request().headers()["x-org-id"] === inventory.orgId);
    const returnedSuppliers = page.waitForResponse(response => new URL(response.url()).pathname === "/api/suppliers" && !new URL(response.url()).searchParams.has("status") && response.request().headers()["x-org-id"] === inventory.orgId);
    const returnedLookup = page.waitForResponse(response => new URL(response.url()).pathname === "/api/suppliers" && new URL(response.url()).searchParams.get("status") === "active" && response.request().headers()["x-org-id"] === inventory.orgId);
    await page.getByRole("button", { name: "Open Group", exact: true }).click();
    await Promise.all([(await returnedOrders).finished(), (await returnedSuppliers).finished(), (await returnedLookup).finished()]);
    await expect.poll(() => activeReads.size).toBe(0);
    await expect(page.getByText("Active workspace:")).toContainText(`Inventory`);
    await expect(page.getByRole("button", { name: "Open Group", exact: true })).toBeEnabled();
    await release();
    // Native history is supported by Next/usePathname. Keep the same Workbench
    // instance to ensure a route remount cannot hide a contaminated in-memory list.
    await page.evaluate(() => history.pushState(null, "", "/vendors"));
    await expect(page.getByRole("cell", { name: "Filler 0", exact: true })).toBeVisible();
    await expect(page.getByRole("cell", { name: "Other workspace vendor", exact: true })).toHaveCount(0);
    await page.evaluate(() => history.pushState(null, "", "/purchase-orders"));
    await expect(page.getByText("Latestnew-PO", { exact: true })).toBeVisible();
    await expect(page.getByText("Other-workspace-PO", { exact: true })).toHaveCount(0);
    await page.screenshot({ path: testInfo.outputPath(`workspace-current-${width}.png`), fullPage: true });
    expect(writes).toEqual([]);
    expect(errors).toEqual([]);
    expect([await inventory.snapshot(), await other.snapshot()]).toEqual(before);
  });
}

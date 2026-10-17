import { readFile } from "node:fs/promises";
import type { Download, Route } from "@playwright/test";
import { test, expect, materialInput } from "./fixtures";

for (const width of [1440, 390]) {
  test(`account audit retries reads and cancels stale CSV downloads at ${width}px`, async ({ inventory, page }, testInfo) => {
    test.setTimeout(360_000);
    const other = await inventory.actor();
    // Paid features are local fixtures, without Stripe calls or live activation.
    for (const org of [inventory.orgId, other.orgId]) expect((await inventory.db.from("organization_billing").update({ status: "active", plan: "business", current_period_end: new Date(Date.now() + 86400000 * 30).toISOString() }).eq("org_id", org)).error).toBeNull();
    expect((await inventory.db.from("org_users").insert({ org_id: other.orgId, user_id: inventory.userId, role: "manager" })).error).toBeNull();
    await inventory.post("/materials", materialInput("AUDIT-A-ONLY"));
    await other.post("/materials", materialInput("AUDIT-B-ONLY"));
    const baseline = [await inventory.snapshot(), await other.snapshot()];
    const pageErrors: string[] = [], writes: string[] = [], downloads: Download[] = [];
    page.on("pageerror", error => pageErrors.push(error.message));
    page.on("download", download => downloads.push(download));
    page.on("request", request => {
      if (request.method() !== "GET" && /^\/api\/(audit-log|organizations|materials|locations|suppliers|stock|purchase-orders)(\/|$)/.test(new URL(request.url()).pathname)) writes.push(request.method());
    });
    type Mode = "pass" | "503" | "abort" | "hold";
    let journalMode: Mode = "pass", csvMode: Mode = "pass";
    const held: Array<{ route: Route; release: () => void; done: Promise<void>; fail: boolean; kind: string }> = [];
    await page.route("**/api/audit-log**", async route => {
      if (route.request().method() !== "GET") { await route.continue(); return; }
      const kind = new URL(route.request().url()).searchParams.get("format") === "csv" ? "csv" : "journal";
      const mode = kind === "csv" ? csvMode : journalMode;
      if (mode === "503") await route.fulfill({ status: 503, contentType: "application/json", body: '{"error":"Read unavailable"}' });
      else if (mode === "abort") await route.abort("connectionfailed");
      else if (mode === "hold") {
        let release!: () => void, done!: () => void;
        const waiting = new Promise<void>(resolve => { release = resolve; });
        const finished = new Promise<void>(resolve => { done = resolve; });
        const item = { route, release, done: finished, fail: false, kind }; held.push(item);
        const response = await route.fetch(); expect(response.status()).toBe(200); await waiting;
        if (item.fail) await route.fulfill({ status: 503, contentType: "application/json", body: '{"error":"Late old-workspace failure"}' });
        else await route.fulfill({ response });
        done();
      } else await route.continue();
    });
    const release = async (fail = false) => {
      const pending = held.splice(0);
      const received = pending.map(item => page.waitForResponse(response => response.request() === item.route.request()));
      pending.forEach(item => { item.fail = fail; item.release(); });
      await Promise.all(pending.map(item => item.done));
      await Promise.all(received.map(async response => (await response).finished()));
      await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    };
    const activityError = page.getByRole("alert").filter({ hasText: "Unable to load activity" });
    const exportError = page.getByRole("alert").filter({ hasText: "Unable to download CSV" });
    const aRow = page.getByText(/AUDIT-A-ONLY/).first(), bRow = page.getByText(/AUDIT-B-ONLY/).first();
    await page.setViewportSize({ width, height: 900 }); await inventory.login(page);
    journalMode = "503"; await page.goto("/account");
    await expect(activityError).toBeVisible();
    await expect(page.getByText("No recorded changes yet.")).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Subscription", exact: true })).toBeVisible();
    journalMode = "abort"; await page.getByRole("button", { name: "Retry activity", exact: true }).click();
    await expect(activityError).toBeVisible();
    journalMode = "hold"; await page.getByRole("button", { name: "Retry activity", exact: true }).click();
    await expect.poll(() => held.length).toBeGreaterThan(0);
    await expect(page.getByRole("status").filter({ hasText: "Loading audit log" })).toBeVisible();
    journalMode = "pass"; await release(); await expect(aRow).toBeVisible(); await expect(activityError).toHaveCount(0);
    const today = new Date().toISOString().slice(0, 10);
    await page.getByLabel("From", { exact: true }).fill(today); await page.getByLabel("To", { exact: true }).fill(today);
    const verifyCsv = async (download: Download, present: string, absent: string, name: string) => {
      expect(download.suggestedFilename()).toBe(`audit-log-${today}-${today}.csv`);
      const file = testInfo.outputPath(name); await download.saveAs(file);
      const text = await readFile(file, "utf8");
      expect(text).toContain("created_at,actor_user_id,action,entity_type");
      expect(text).toContain(present); expect(text).not.toContain(absent);
    };
    csvMode = "503"; await page.getByRole("button", { name: "Download CSV", exact: true }).click();
    await expect(exportError).toBeVisible(); expect(downloads).toHaveLength(0);
    csvMode = "abort"; await page.getByRole("button", { name: "Retry CSV", exact: true }).click(); await expect(exportError).toBeVisible();
    csvMode = "hold"; await page.getByRole("button", { name: "Retry CSV", exact: true }).click();
    await expect.poll(() => held.length).toBeGreaterThan(0);
    expect(new URL(held[0].route.request().url()).searchParams.get("from")).toBe(today);
    await expect(page.getByRole("button", { name: "Download CSV", exact: true })).toBeDisabled();
    await expect(page.getByRole("status").filter({ hasText: "Preparing audit export" })).toBeVisible();
    const firstDownload = page.waitForEvent("download"); csvMode = "pass"; await release();
    await verifyCsv(await firstDownload, "AUDIT-A-ONLY", "AUDIT-B-ONLY", `account-audit-A-${width}.csv`);
    if (width === 390) {
      const event = page.locator("article").filter({ has: page.getByText("Material created: AUDIT-A-ONLY", { exact: true }) });
      const readable = await event.evaluate(row => ({
        row: row.getBoundingClientRect().width,
        text: row.querySelector("p")!.getBoundingClientRect().width,
        overflow: document.documentElement.scrollWidth > innerWidth
      }));
      expect(readable.text).toBeGreaterThanOrEqual(readable.row * 0.9);
      expect(readable.overflow).toBe(false);
    }
    await page.screenshot({ path: testInfo.outputPath(`account-audit-loaded-${width}.png`), fullPage: true });

    const switcher = await page.context().newPage(); await switcher.goto("/members"); await switcher.waitForLoadState("networkidle");
    journalMode = "hold"; await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await expect.poll(() => held.length).toBeGreaterThan(0);
    journalMode = "pass"; await switcher.getByRole("button", { name: "Open Group", exact: true }).click();
    await expect(bRow).toBeVisible(); await expect(page.getByText(/AUDIT-A-ONLY/)).toHaveCount(0);
    await release(true); await expect(activityError).toHaveCount(0); await expect(bRow).toBeVisible();
    await expect(page.getByRole("button", { name: "Download CSV", exact: true })).toBeEnabled();
    csvMode = "hold"; await page.getByRole("button", { name: "Download CSV", exact: true }).click();
    await expect.poll(() => held.length).toBeGreaterThan(0);
    await expect(switcher.getByRole("button", { name: "Open Group", exact: true })).toBeEnabled();
    await switcher.getByRole("button", { name: "Open Group", exact: true }).click();
    await expect(aRow).toBeVisible(); await expect(page.getByText(/AUDIT-B-ONLY/)).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Download CSV", exact: true })).toBeEnabled();
    csvMode = "pass"; const currentDownload = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download CSV", exact: true }).click();
    await verifyCsv(await currentDownload, "AUDIT-A-ONLY", "AUDIT-B-ONLY", `account-audit-current-${width}.csv`);
    expect(downloads).toHaveLength(2); await release(); expect(downloads).toHaveLength(2);
    expect([await inventory.snapshot(), await other.snapshot()]).toEqual(baseline);

    await expect(switcher.getByRole("button", { name: "Open Group", exact: true })).toBeEnabled();
    await switcher.getByRole("button", { name: "Open Group", exact: true }).click(); await expect(bRow).toBeVisible();
    await expect(page.getByRole("button", { name: "Download CSV", exact: true })).toBeEnabled();
    await page.bringToFront();
    const settledContext = page.waitForResponse(response => new URL(response.url()).pathname === "/api/organizations");
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await (await settledContext).finished(); await page.waitForLoadState("networkidle");
    await expect(page.getByText("Some workspace details could not be loaded.")).toHaveCount(0);
    expect((await inventory.db.from("org_users").update({ role: "viewer" }).eq("org_id", other.orgId).eq("user_id", inventory.userId)).error).toBeNull();
    const deniedSnapshot = await other.snapshot();
    const denied = page.waitForResponse(response => new URL(response.url()).searchParams.get("format") === "csv");
    await page.getByRole("button", { name: "Download CSV", exact: true }).click(); expect((await denied).status()).toBe(403);
    await expect(exportError).toBeVisible(); expect(downloads).toHaveLength(2);
    await expect(page.getByLabel("From", { exact: true })).toHaveValue(today); await expect(page.getByLabel("To", { exact: true })).toHaveValue(today);
    expect(await other.snapshot()).toEqual(deniedSnapshot);
    await page.screenshot({ path: testInfo.outputPath(`account-audit-denied-${width}.png`), fullPage: true });
    // A viewer with no personal events has a genuinely empty successful journal.
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await expect(page.getByText("No recorded changes yet.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Download CSV", exact: true })).toHaveCount(0);
    expect((await inventory.db.from("org_users").update({ role: "manager" }).eq("org_id", other.orgId).eq("user_id", inventory.userId)).error).toBeNull();
    await page.evaluate(() => window.dispatchEvent(new Event("focus"))); await expect(bRow).toBeVisible();
    const restored = page.waitForEvent("download"); await page.getByRole("button", { name: "Download CSV", exact: true }).click();
    await verifyCsv(await restored, "AUDIT-B-ONLY", "AUDIT-A-ONLY", `account-audit-B-${width}.csv`);
    await switcher.close(); expect(pageErrors).toEqual([]); expect(writes).toEqual([]);
  });
}

import { test, expect } from "./fixtures";

const catalogs = [
  { table: "materials", path: "/materials", add: "Create Material", dialog: "Create material", submit: "Create Material", save: "Save changes" },
  { table: "locations", path: "/locations", add: "Add Location", dialog: "Add location", submit: "Create Location", save: "Save Location" },
  { table: "suppliers", path: "/vendors", add: "Add Vendor", dialog: "Add vendor", submit: "Create Supplier", save: "Update Vendor" },
] as const;

for (const width of [1440, 390]) {
  test(`catalog feedback preserves real writes and retries only reads at ${width}px`, async ({ inventory, page }, testInfo) => {
    test.setTimeout(300_000);
    await page.setViewportSize({ width, height: 900 });
    await inventory.login(page);
    const pageErrors: string[] = [];
    page.on("pageerror", error => pageErrors.push(error.message));
    for (const catalog of catalogs) {
      let failReads = false;
      const writes = { create: 0, update: 0 };
      const apiPath = `/api/${catalog.table}`;
      const track = (request: import("@playwright/test").Request) => {
        if (new URL(request.url()).pathname === apiPath && request.method() === "POST") writes.create++;
        if (new URL(request.url()).pathname.startsWith(`${apiPath}/`) && request.method() === "PATCH") writes.update++;
      };
      page.on("request", track);
      // Mutations always reach the real API. Interrupt only subsequent reads.
      await page.route("**/api/**", async route => {
        if (failReads && route.request().method() === "GET" && new URL(route.request().url()).pathname === apiPath) {
          await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "Read unavailable" }) });
        } else await route.continue();
      });
      const role = async (role: "owner" | "viewer") => {
        const result = await inventory.db.from("org_users").update({ role }).eq("org_id", inventory.orgId).eq("user_id", inventory.userId);
        expect(result.error).toBeNull();
      };
      const response = (method: "POST" | "PATCH") => page.waitForResponse(r => new URL(r.url()).pathname.startsWith(apiPath) && r.request().method() === method);
      await page.goto(catalog.path);
      await page.waitForLoadState("networkidle");
      await page.getByRole("button", { name: catalog.add, exact: true }).click();
      let dialog = page.getByRole("dialog", { name: catalog.dialog, exact: true });
      const name = `${catalog.table} ${width}`;
      await dialog.getByRole("textbox", { name: "Name", exact: true }).fill(name);
      if (catalog.table === "materials") await dialog.getByRole("textbox", { name: "SKU", exact: true }).fill(`FEEDBACK-${width}`);
      if (catalog.table === "locations") await dialog.getByRole("textbox", { name: "Code", exact: true }).fill(`FB-${width}`);
      await role("viewer");
      let before = await inventory.snapshot();
      let pending = response("POST");
      await dialog.getByRole("button", { name: catalog.submit, exact: true }).click();
      expect((await pending).status()).toBe(403);
      await expect(dialog.getByRole("alert")).toHaveText("You do not have permission to perform this action.");
      await expect(dialog.getByRole("textbox", { name: "Name", exact: true })).toHaveValue(name);
      expect(await inventory.snapshot()).toEqual(before);
      await dialog.getByRole("alert").scrollIntoViewIfNeeded();
      await expect(dialog.getByRole("alert")).toBeInViewport();
      await page.screenshot({ path: testInfo.outputPath(`${catalog.table}-error-${width}.png`), fullPage: true });
      await role("owner");
      failReads = true;
      pending = response("POST");
      await dialog.getByRole("button", { name: catalog.submit, exact: true }).click();
      expect((await pending).status()).toBe(201);
      await expect(dialog.getByRole("alert")).toContainText("The operation completed");
      await expect(dialog.getByRole("button", { name: catalog.submit, exact: true })).toBeDisabled();
      const stored = await inventory.rows(catalog.table);
      expect(stored).toHaveLength(1);
      expect(stored[0].name).toBe(name);
      before = await inventory.snapshot();
      await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
      await expect(dialog).toBeHidden();
      await page.getByRole("button", { name: catalog.add, exact: true }).click();
      await expect(dialog.getByRole("alert")).toContainText("The operation completed");
      await expect(dialog.getByRole("button", { name: catalog.submit, exact: true })).toBeDisabled();
      failReads = false;
      await dialog.getByRole("button", { name: "Refresh data", exact: true }).click();
      await expect(dialog).toBeHidden();
      expect(writes.create).toBe(2);
      expect(await inventory.snapshot()).toEqual(before);

      const row = page.getByRole("row").filter({ hasText: name });
      await row.getByRole("button", { name: "Edit", exact: true }).click();
      dialog = page.getByRole("dialog");
      const renamed = `${name} renamed`;
      await dialog.getByRole("textbox", { name: "Name", exact: true }).fill(renamed);
      await role("viewer");
      before = await inventory.snapshot();
      pending = response("PATCH");
      await dialog.getByRole("button", { name: catalog.save, exact: true }).click();
      expect((await pending).status()).toBe(403);
      await expect(dialog.getByRole("alert")).toHaveText("You do not have permission to perform this action.");
      await expect(dialog.getByRole("textbox", { name: "Name", exact: true })).toHaveValue(renamed);
      expect(await inventory.snapshot()).toEqual(before);
      await role("owner");
      pending = response("PATCH");
      await dialog.getByRole("button", { name: catalog.save, exact: true }).click();
      expect((await pending).status()).toBe(200);
      await expect(dialog).toBeHidden();
      expect((await inventory.rows(catalog.table))[0].name).toBe(renamed);

      await row.getByRole("button", { name: "Block", exact: true }).click();
      dialog = page.getByRole("dialog");
      await role("viewer");
      before = await inventory.snapshot();
      pending = response("PATCH");
      await dialog.getByRole("button", { name: "Confirm", exact: true }).click();
      expect((await pending).status()).toBe(403);
      await expect(dialog.getByRole("alert")).toHaveText("You do not have permission to perform this action.");
      expect(await inventory.snapshot()).toEqual(before);
      await role("owner");
      pending = response("PATCH");
      await dialog.getByRole("button", { name: "Confirm", exact: true }).click();
      expect((await pending).status()).toBe(200);
      await expect(dialog).toBeHidden();
      expect((await inventory.rows(catalog.table))[0].is_active).toBe(false);
      await row.getByRole("button", { name: "Unblock", exact: true }).click();
      failReads = true;
      pending = response("PATCH");
      await dialog.getByRole("button", { name: "Confirm", exact: true }).click();
      expect((await pending).status()).toBe(200);
      await expect(dialog.getByRole("alert")).toContainText("The operation completed");
      expect((await inventory.rows(catalog.table))[0].is_active).toBe(true);
      const count = writes.update;
      before = await inventory.snapshot();
      failReads = false;
      await dialog.getByRole("button", { name: "Refresh data", exact: true }).click();
      await expect(dialog).toBeHidden();
      expect(writes.update).toBe(count);
      expect(await inventory.snapshot()).toEqual(before);
      page.off("request", track);
      await page.unroute("**/api/**");
    }
    expect(pageErrors).toEqual([]);
  });
}

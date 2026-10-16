import { test, expect } from "./fixtures";

for (const width of [1440, 390]) {
  test(`stock recovery never repeats committed movements at ${width}px`, async ({ inventory, page }, testInfo) => {
    test.setTimeout(240_000);
    const { materials: [material], locations: [a, b] } = await inventory.catalog();
    await inventory.post("/stock/movements", { material_id: material.id, location_id: a.id, reason: "adjustment", quantity_delta: 100 });
    let failReads = false, writes = 0;
    page.on("request", request => {
      if (request.method() === "POST" && new URL(request.url()).pathname === "/api/stock/movements") writes++;
    });
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    // Every write reaches the real API; only list reads are interrupted.
    await page.route("**/api/stock/movements?**", async route => {
      if (failReads && route.request().method() === "GET") await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "Read unavailable" }) });
      else await route.continue();
    });
    await page.setViewportSize({ width, height: 900 });
    await inventory.login(page); await page.goto("/stock-movements"); await page.waitForLoadState("networkidle");
    let quantityA = 100, quantityB = 0;
    const response = () => page.waitForResponse(r => r.request().method() === "POST" && new URL(r.url()).pathname === "/api/stock/movements");
    for (const reason of ["adjustment", "consumption", "transfer"] as const) {
      await page.getByRole("button", { name: "Move Material", exact: true }).click();
      const dialog = page.getByRole("dialog", { name: "Move Material", exact: true });
      await dialog.getByRole("combobox", { name: "Material", exact: true }).selectOption(material.id);
      await dialog.getByRole("combobox", { name: "Reason", exact: true }).selectOption(reason);
      if (reason === "transfer") {
        await dialog.getByRole("combobox", { name: "Transfer out", exact: true }).selectOption(a.id);
        await dialog.getByRole("combobox", { name: "Transfer to", exact: true }).selectOption(b.id);
      } else await dialog.getByRole("combobox", { name: "Location", exact: true }).selectOption(a.id);
      const quantity = reason === "adjustment" ? 5 : reason === "consumption" ? 4 : 7;
      const label = reason === "adjustment" ? "Quantity Delta" : "Quantity";
      const submit = reason === "consumption" ? "Record Consumption" : "Add to Stock";
      const note = `Safe ${reason} ${width}`;
      await dialog.getByRole("textbox", { name: "Comments", exact: true }).fill(note);
      if (reason === "consumption") {
        await dialog.getByLabel(label, { exact: true }).fill("999");
        const before = await inventory.snapshot(), rejected = response();
        await dialog.getByRole("button", { name: submit, exact: true }).click();
        expect((await rejected).status()).toBe(400);
        await expect(dialog.getByRole("alert")).toHaveText("Not enough quantity at the specified location.");
        await expect(dialog.getByRole("textbox", { name: "Comments", exact: true })).toHaveValue(note);
        expect(await inventory.snapshot()).toEqual(before);
      }
      await dialog.getByLabel(label, { exact: true }).fill(String(quantity));
      failReads = true;
      const accepted = response();
      await dialog.getByRole("button", { name: submit, exact: true }).click();
      expect((await accepted).status()).toBe(201);
      await expect(dialog.getByRole("alert")).toContainText("The operation completed");
      await expect(dialog.getByRole("button", { name: submit, exact: true })).toBeDisabled();
      quantityA += reason === "adjustment" ? quantity : -quantity;
      if (reason === "transfer") quantityB += quantity;
      await inventory.balances(quantityB ? [[material.id, a.id, quantityA], [material.id, b.id, quantityB]] : [[material.id, a.id, quantityA]]);
      const stored = await inventory.snapshot(), count = writes;
      await dialog.getByRole("alert").scrollIntoViewIfNeeded();
      await expect(dialog.getByRole("alert")).toBeInViewport();
      await page.screenshot({ path: testInfo.outputPath(`stock-${reason}-recovery-${width}.png`), fullPage: true });
      await dialog.getByRole("button", { name: "Refresh data", exact: true }).click();
      await expect(dialog.getByRole("alert")).toContainText("The operation completed");
      await expect(dialog.getByRole("button", { name: submit, exact: true })).toBeDisabled();
      await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
      await expect(dialog).toBeHidden();
      await expect(page.getByRole("alert").filter({ hasText: "The operation completed" })).toBeVisible();
      await page.getByRole("button", { name: "Move Material", exact: true }).click();
      await expect(dialog.getByRole("alert")).toContainText("The operation completed");
      await expect(dialog.getByRole("button", { name: "Add to Stock", exact: true })).toBeDisabled();
      failReads = false;
      await dialog.getByRole("button", { name: "Refresh data", exact: true }).click();
      await expect(dialog).toBeHidden();
      expect(writes).toBe(count);
      expect(await inventory.snapshot()).toEqual(stored);
      await expect(page.getByRole("cell", { name: note, exact: true })).toHaveCount(reason === "transfer" ? 2 : 1);
    }
    expect(writes).toBe(4); // Three successful writes and one genuine rejection.
    expect(await inventory.rows("stock_movements")).toHaveLength(5);
    expect(errors).toEqual([]);
  });
}

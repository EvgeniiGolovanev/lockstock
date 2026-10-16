import { test, expect } from "./fixtures";

for (const width of [1440, 390]) {
  test(`purchase order feedback preserves real writes and supports read-only retry at ${width}px`, async ({ inventory, page }, testInfo) => {
    test.setTimeout(240_000);
    const { materials: [material], locations: [location], suppliers: [supplier] } = await inventory.catalog();
    let failReads = false;
    const writes = { create: 0, receive: 0, status: 0 };
    page.on("request", request => {
      const path = new URL(request.url()).pathname;
      if (request.method() === "POST" && path === "/api/purchase-orders") writes.create++;
      if (request.method() === "POST" && path.endsWith("/receive")) writes.receive++;
      if (request.method() === "PATCH" && path.endsWith("/status")) writes.status++;
    });
    // Only the follow-up read is interrupted. Every mutation uses the real API.
    await page.route("**/api/purchase-orders?**", async route => {
      if (failReads) await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "Read unavailable" }) });
      else await route.continue();
    });
    await page.setViewportSize({ width, height: 900 });
    await inventory.login(page);
    await page.goto("/purchase-orders");
    await page.waitForLoadState("networkidle");
    const completionAlert = page.getByRole("alert").filter({ hasText: "The operation completed" });
    await page.getByRole("button", { name: "Create PO", exact: true }).click();
    const create = page.getByRole("dialog", { name: "Create purchase order", exact: true });
    await create.getByRole("combobox", { name: "Supplier", exact: true }).selectOption(supplier.id);
    await create.getByRole("combobox", { name: "Material", exact: true }).selectOption(material.id);
    await create.getByLabel("Quantity", { exact: true }).fill("10");
    await create.getByRole("textbox", { name: "Notes (optional)", exact: true }).fill("Preserve purchase order notes");
    await create.getByRole("button", { name: "Add Item", exact: true }).click();
    const blockedSupplier = await inventory.request.patch(`/api/suppliers/${supplier.id}`, { headers: inventory.headers(), data: { is_active: false } });
    expect(blockedSupplier.status()).toBe(200);
    let before = await inventory.snapshot();
    let response = page.waitForResponse(r => new URL(r.url()).pathname === "/api/purchase-orders" && r.request().method() === "POST");
    await create.getByRole("button", { name: "Create Purchase Order", exact: true }).click();
    expect((await response).status()).toBe(400);
    await expect(create.getByRole("alert")).toHaveText("Purchase orders can only use active suppliers.");
    await create.getByRole("alert").scrollIntoViewIfNeeded();
    await expect(create.getByRole("alert")).toBeInViewport();
    await expect(create.getByRole("textbox", { name: "Notes (optional)", exact: true })).toHaveValue("Preserve purchase order notes");
    expect(await inventory.snapshot()).toEqual(before);
    await page.screenshot({ path: testInfo.outputPath(`po-create-error-${width}.png`), fullPage: true });

    const unblockedSupplier = await inventory.request.patch(`/api/suppliers/${supplier.id}`, { headers: inventory.headers(), data: { is_active: true } });
    expect(unblockedSupplier.status()).toBe(200);
    failReads = true;
    response = page.waitForResponse(r => new URL(r.url()).pathname === "/api/purchase-orders" && r.request().method() === "POST");
    await create.getByRole("button", { name: "Create Purchase Order", exact: true }).click();
    const accepted = await response;
    expect(accepted.status()).toBe(201);
    const po = await inventory.po((await accepted.json()).data.id);
    await expect(create.getByRole("alert")).toContainText("The operation completed");
    await expect(create.getByRole("button", { name: "Create Purchase Order", exact: true })).toBeDisabled();
    expect(await inventory.rows("purchase_orders")).toHaveLength(1);
    failReads = false;
    await create.getByRole("button", { name: "Refresh data", exact: true }).click();
    await expect(create).toBeHidden();
    expect(writes.create).toBe(2);

    const row = page.getByRole("row").filter({ hasText: po.po_number });
    failReads = true;
    response = page.waitForResponse(r => r.url().endsWith(`/purchase-orders/${po.id}/status`) && r.request().method() === "PATCH");
    await row.getByRole("button", { name: "Mark Sent", exact: true }).click();
    expect((await response).status()).toBe(200);
    await expect(completionAlert).toBeVisible();
    expect((await inventory.po(po.id)).status).toBe("sent");
    failReads = false;
    await page.getByRole("button", { name: "Refresh data", exact: true }).click();
    await expect(row.getByText("SENT", { exact: true })).toBeVisible();
    expect(writes.status).toBe(1);

    await page.getByRole("button", { name: "Receive order", exact: true }).click();
    const receive = page.getByRole("dialog", { name: "Receive purchase order", exact: true });
    await receive.getByRole("combobox", { name: "Purchase Order", exact: true }).selectOption(po.id);
    await receive.getByRole("combobox", { name: "Line", exact: true }).selectOption(po.lines[0].id);
    await receive.getByRole("combobox", { name: "Location", exact: true }).selectOption(location.id);
    await receive.getByLabel("Quantity Received", { exact: true }).fill("11");
    before = await inventory.snapshot();
    response = page.waitForResponse(r => r.url().endsWith(`/purchase-orders/${po.id}/receive`) && r.request().method() === "POST");
    await receive.getByRole("button", { name: "Receive", exact: true }).click();
    expect((await response).status()).toBe(409);
    await expect(receive.getByRole("alert")).toHaveText("Receiving quantity exceeds the outstanding quantity on this purchase order line.");
    await receive.getByRole("alert").scrollIntoViewIfNeeded();
    await expect(receive.getByRole("alert")).toBeInViewport();
    await expect(receive.getByLabel("Quantity Received", { exact: true })).toHaveValue("11");
    expect(await inventory.snapshot()).toEqual(before);
    await page.screenshot({ path: testInfo.outputPath(`po-receive-error-${width}.png`), fullPage: true });

    const blockedLocation = await inventory.request.patch(`/api/locations/${location.id}`, { headers: inventory.headers(), data: { is_active: false } });
    expect(blockedLocation.status()).toBe(200);
    await receive.getByLabel("Quantity Received", { exact: true }).fill("4");
    before = await inventory.snapshot();
    response = page.waitForResponse(r => r.url().endsWith(`/purchase-orders/${po.id}/receive`) && r.request().method() === "POST");
    await receive.getByRole("button", { name: "Receive", exact: true }).click();
    expect((await response).status()).toBe(422);
    await expect(receive.getByRole("alert")).toHaveText("Location is unavailable or blocked for usage.");
    expect(await inventory.snapshot()).toEqual(before);
    const unblockedLocation = await inventory.request.patch(`/api/locations/${location.id}`, { headers: inventory.headers(), data: { is_active: true } });
    expect(unblockedLocation.status()).toBe(200);
    failReads = true;
    response = page.waitForResponse(r => r.url().endsWith(`/purchase-orders/${po.id}/receive`) && r.request().method() === "POST");
    await receive.getByRole("button", { name: "Receive", exact: true }).click();
    expect((await response).status()).toBe(200);
    await expect(receive.getByRole("alert")).toContainText("The operation completed");
    await expect(receive.getByRole("button", { name: "Receive", exact: true })).toBeDisabled();
    await inventory.balances([[material.id, location.id, 4]]);
    await receive.getByRole("button", { name: "Close", exact: true }).click();
    await expect(receive).toBeHidden();
    await expect(completionAlert).toBeVisible();
    await expect(page.getByRole("button", { name: "Receive order", exact: true })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Create PO", exact: true })).toBeDisabled();
    failReads = false;
    await page.getByRole("button", { name: "Refresh data", exact: true }).click();
    await expect(completionAlert).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Receive order", exact: true })).toBeEnabled();
    expect(writes.receive).toBe(3);
    expect((await inventory.po(po.id)).lines[0].quantity_received).toBe(4);

    await row.getByRole("button", { name: "Cancel", exact: true }).click();
    const cancel = page.getByRole("dialog", { name: "Confirm purchase order cancellation", exact: true });
    // Another client already cancelled it. The open dialog must report the rejection.
    await inventory.status(po, "cancelled");
    before = await inventory.snapshot();
    response = page.waitForResponse(r => r.url().endsWith(`/purchase-orders/${po.id}/status`) && r.request().method() === "PATCH");
    await cancel.getByRole("button", { name: "Cancel PO", exact: true }).click();
    expect((await response).status()).toBe(400);
    await expect(cancel.getByRole("alert")).toContainText("Invalid status transition");
    await expect(cancel).toBeVisible();
    expect(await inventory.snapshot()).toEqual(before);
  });
}

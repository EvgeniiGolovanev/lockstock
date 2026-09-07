import type { Page, Response } from "@playwright/test";
import { test, expect, type InventoryFixture, type Material, type Location, type Supplier, type PurchaseOrder } from "./fixtures";

async function submit(page: Page, path: string, action: () => Promise<void>, method = "POST", status = 201): Promise<Response> {
  const [response] = await Promise.all([
    page.waitForResponse((response) => new URL(response.url()).pathname === `/api${path}` && response.request().method() === method),
    action()
  ]);
  expect(response.status(), await response.text()).toBe(status);
  return response;
}

async function move(page: Page, material: Material, location: Location, reason: "adjustment" | "consumption" | "transfer", quantity: number, destination?: Location) {
  await page.getByRole("button", { name: "Move Material", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Move Material" });
  await dialog.getByRole("combobox", { name: "Material", exact: true }).selectOption(material.id);
  await dialog.getByRole("combobox", { name: "Reason", exact: true }).selectOption(reason);
  if (destination) {
    await dialog.getByRole("combobox", { name: "Transfer out", exact: true }).selectOption(location.id);
    await dialog.getByRole("combobox", { name: "Transfer to", exact: true }).selectOption(destination.id);
  } else {
    await dialog.getByRole("combobox", { name: "Location", exact: true }).selectOption(location.id);
  }
  await dialog.getByLabel(reason === "adjustment" ? "Quantity Delta" : "Quantity", { exact: true }).fill(String(reason === "consumption" ? -quantity : quantity));
  await submit(page, "/stock/movements", () => dialog.getByRole("button", { name: reason === "consumption" ? "Record Consumption" : "Add to Stock", exact: true }).click());
  await dialog.getByRole("button", { name: "Close", exact: true }).click();
  await expect(dialog).toBeHidden();
}

async function createPo(page: Page, inventory: InventoryFixture, supplier: Supplier, material: Material, quantity: number) {
  await page.getByRole("button", { name: "Create PO", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Create purchase order", exact: true });
  await dialog.getByRole("combobox", { name: "Supplier", exact: true }).selectOption(supplier.id);
  await dialog.getByRole("combobox", { name: "Material", exact: true }).selectOption(material.id);
  await dialog.getByLabel("Quantity", { exact: true }).fill(String(quantity));
  await dialog.getByLabel("Unit Price", { exact: false }).fill("2.50");
  await dialog.getByRole("button", { name: "Add Item", exact: true }).click();
  const response = await submit(page, "/purchase-orders", () => dialog.getByRole("button", { name: "Create Purchase Order", exact: true }).click());
  await expect(dialog).toBeHidden();
  const po = await inventory.po((await response.json()).data.id);
  expect(po.status).toBe("draft");
  expect(po.supplier_id).toBe(supplier.id);
  expect(po.lines).toHaveLength(1);
  expect(po.lines[0]).toMatchObject({ material_id: material.id, quantity_ordered: quantity, quantity_received: 0 });
  return po;
}

async function receive(page: Page, po: PurchaseOrder, location: Location, quantity: number) {
  await page.getByRole("button", { name: "Receive order", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Receive purchase order", exact: true });
  await dialog.getByRole("combobox", { name: "Purchase Order", exact: true }).selectOption(po.id);
  await dialog.getByRole("combobox", { name: "Line", exact: true }).selectOption(po.lines[0].id);
  await dialog.getByRole("combobox", { name: "Location", exact: true }).selectOption(location.id);
  await dialog.getByLabel("Quantity Received", { exact: true }).fill(String(quantity));
  await submit(page, `/purchase-orders/${po.id}/receive`, () => dialog.getByRole("button", { name: "Receive", exact: true }).click(), "POST", 200);
  await expect(dialog).toBeHidden();
}

test("two materials, locations and vendors: adjustment → consumption → transfer → partial/full receipt → final stock", async ({ page, inventory }) => {
  test.setTimeout(240_000);
  const materials: Material[] = [];
  const locations: Location[] = [];
  const suppliers: Supplier[] = [];
  await inventory.login(page);

  await test.step("create two materials with distinct UoMs through the UI", async () => {
    await page.goto("/materials");
    for (const [sku, uom] of [["ACCEPT-PC", "PC"], ["ACCEPT-KG", "KG"]]) {
      await page.getByRole("button", { name: "Create Material", exact: true }).click();
      const dialog = page.getByRole("dialog", { name: "Create material", exact: true });
      await dialog.getByLabel("SKU", { exact: true }).fill(sku);
      await dialog.getByLabel("Name", { exact: true }).fill(`Acceptance ${uom}`);
      await dialog.getByRole("combobox", { name: "Unit", exact: true }).selectOption(uom);
      const response = await submit(page, "/materials", () => dialog.getByRole("button", { name: "Create Material", exact: true }).click());
      const material = (await response.json()).data as Material;
      expect(material).toMatchObject({ sku, uom });
      materials.push(material);
      await expect(dialog).toBeHidden();
      await expect(page.getByRole("row").filter({ hasText: sku }).getByRole("cell", {
        name: uom === "PC" ? "Piece / Each" : "Kilogram", exact: true
      })).toBeVisible();
    }
  });

  await test.step("create two locations and two vendors through the UI", async () => {
    await page.goto("/locations");
    for (const code of ["A", "B"]) {
      await page.getByRole("button", { name: "Add Location", exact: true }).click();
      const dialog = page.getByRole("dialog", { name: "Add location", exact: true });
      await dialog.getByLabel("Name", { exact: true }).fill(`Warehouse ${code}`);
      await dialog.getByLabel("Code", { exact: true }).fill(code);
      const response = await submit(page, "/locations", () => dialog.getByRole("button", { name: "Create Location", exact: true }).click());
      locations.push((await response.json()).data);
      await expect(dialog).toBeHidden();
    }
    await page.goto("/vendors");
    for (const name of ["Vendor A", "Vendor B"]) {
      await page.getByRole("button", { name: "Add Vendor", exact: true }).click();
      const dialog = page.getByRole("dialog", { name: "Add vendor", exact: true });
      await dialog.getByLabel("Name", { exact: true }).fill(name);
      const response = await submit(page, "/suppliers", () => dialog.getByRole("button", { name: "Create Supplier", exact: true }).click());
      suppliers.push((await response.json()).data);
      await expect(dialog).toBeHidden();
    }
    expect(new Set(materials.map((item) => item.id)).size).toBe(2);
    expect(new Set(locations.map((item) => item.id)).size).toBe(2);
    expect(new Set(suppliers.map((item) => item.id)).size).toBe(2);
    await inventory.balances([]);
  });

  const [m1, m2] = materials;
  const [a, b] = locations;
  await page.goto("/stock-movements");
  await test.step("adjustment and 10% consumption, checking every balance", async () => {
    await move(page, m1, a, "adjustment", 100);
    await inventory.balances([[m1.id, a.id, 100]]);
    await move(page, m2, a, "adjustment", 1000);
    await inventory.balances([[m1.id, a.id, 100], [m2.id, a.id, 1000]]);
    await move(page, m1, a, "consumption", 10);
    await inventory.balances([[m1.id, a.id, 90], [m2.id, a.id, 1000]]);
    await move(page, m2, a, "consumption", 100);
    await inventory.balances([[m1.id, a.id, 90], [m2.id, a.id, 900]]);
  });

  await test.step("transfer 10% of remaining source stock; total stock is conserved", async () => {
    await move(page, m1, a, "transfer", 9, b);
    await inventory.balances([[m1.id, a.id, 81], [m1.id, b.id, 9], [m2.id, a.id, 900]]);
    await move(page, m2, a, "transfer", 90, b);
    await inventory.balances([[m1.id, a.id, 81], [m1.id, b.id, 9], [m2.id, a.id, 810], [m2.id, b.id, 90]]);
  });

  await page.goto("/purchase-orders");
  const po1 = await createPo(page, inventory, suppliers[0], m1, 200);
  const po2 = await createPo(page, inventory, suppliers[1], m2, 2000);
  await inventory.balances([[m1.id, a.id, 81], [m1.id, b.id, 9], [m2.id, a.id, 810], [m2.id, b.id, 90]]);
  for (const po of [po1, po2]) {
    const row = page.getByRole("row").filter({ hasText: po.po_number });
    await submit(page, `/purchase-orders/${po.id}/status`, () => row.getByRole("button", { name: "Mark Sent", exact: true }).click(), "PATCH", 200);
    await expect(row.getByText("SENT", { exact: true })).toBeVisible();
    expect((await inventory.po(po.id)).status).toBe("sent");
  }

  await test.step("receive 20% of PO1 and 100% of PO2 into A", async () => {
    await receive(page, po1, a, 40);
    expect(await inventory.po(po1.id)).toMatchObject({ status: "partial", lines: [expect.objectContaining({ quantity_received: 40, quantity_ordered: 200 })] });
    await inventory.balances([[m1.id, a.id, 121], [m1.id, b.id, 9], [m2.id, a.id, 810], [m2.id, b.id, 90]]);
    await receive(page, po2, a, 2000);
    expect(await inventory.po(po2.id)).toMatchObject({ status: "received", lines: [expect.objectContaining({ quantity_received: 2000, quantity_ordered: 2000 })] });
    await inventory.balances([[m1.id, a.id, 121], [m1.id, b.id, 9], [m2.id, a.id, 2810], [m2.id, b.id, 90]]);
    await page.reload();
    await expect(page.getByRole("row").filter({ hasText: po1.po_number }).getByText("PARTIAL", { exact: true })).toBeVisible();
    await expect(page.getByRole("row").filter({ hasText: po2.po_number }).getByText("RECEIVED", { exact: true })).toBeVisible();
  });

  await test.step("final stock survives navigation/reload and agrees with the ledger", async () => {
    await page.goto("/inventory");
    await page.reload();
    for (const [sku, uom, location, quantity] of [
      [m1.sku, "PC", a.name, "121"], [m1.sku, "PC", b.name, "9"],
      [m2.sku, "KG", a.name, "2 810"], [m2.sku, "KG", b.name, "90"]
    ]) {
      const row = page.getByRole("row").filter({ hasText: sku }).filter({ hasText: location });
      await expect(row.getByRole("cell", { name: uom, exact: true })).toBeVisible();
      await expect(row.getByRole("cell", { name: quantity, exact: true })).toBeVisible();
    }
    const response = await inventory.request.get("/api/materials", { headers: inventory.headers() });
    expect(response.status()).toBe(200);
    expect((await response.json()).data).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: m1.id, total_quantity: 130 }),
      expect.objectContaining({ id: m2.id, total_quantity: 2900 })
    ]));
    const movements = await inventory.rows("stock_movements");
    expect(movements).toHaveLength(10);
    expect(movements.filter((row) => row.reason === "adjustment")).toHaveLength(2);
    expect(movements.filter((row) => row.reason === "consumption")).toHaveLength(2);
    expect(movements.filter((row) => row.reason === "transfer_out")).toHaveLength(2);
    expect(movements.filter((row) => row.reason === "transfer_in")).toHaveLength(2);
    expect(movements.every((row) => row.created_by === inventory.userId)).toBe(true);
    expect(movements.filter((row) => row.reason === "purchase_receive")).toEqual(expect.arrayContaining([
      expect.objectContaining({ material_id: m1.id, location_id: a.id, quantity_delta: 40, reference_type: "purchase_order", reference_id: po1.id }),
      expect.objectContaining({ material_id: m2.id, location_id: a.id, quantity_delta: 2000, reference_type: "purchase_order", reference_id: po2.id })
    ]));
  });

  await test.step("complete the outstanding 80% without receiving it twice", async () => {
    await page.goto("/purchase-orders");
    await receive(page, po1, a, 160);
    expect(await inventory.po(po1.id)).toMatchObject({ status: "received", lines: [expect.objectContaining({ quantity_received: 200 })] });
    await inventory.balances([[m1.id, a.id, 281], [m1.id, b.id, 9], [m2.id, a.id, 2810], [m2.id, b.id, 90]]);
  });
});

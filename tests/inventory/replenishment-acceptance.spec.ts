import { test, expect, type InventoryFixture, type Material, type Supplier } from "./fixtures";

async function setup(inventory: InventoryFixture) {
  const catalog = await inventory.catalog();
  const material = catalog.materials[0]; const supplier = catalog.suppliers[0];
  await inventory.post("/stock/movements", { material_id: material.id, location_id: catalog.locations[0].id, quantity_delta: 8, reason: "adjustment" });
  const settings = await inventory.request.patch("/api/replenishment/settings", { headers: inventory.headers(), data: { material_id: material.id, min_stock: "10", target_stock: "50", supplier_id: supplier.id } });
  expect(settings.status(), await settings.text()).toBe(200);
  return { ...catalog, material, supplier };
}
async function recommendations(inventory: InventoryFixture) {
  const required = new Date(); required.setUTCDate(required.getUTCDate()+14);
  const response = await inventory.request.get(`/api/replenishment?required_by=${required.toISOString().slice(0,10)}&timezone=UTC`, { headers: inventory.headers() });
  expect(response.status(), await response.text()).toBe(200);
  return { required: required.toISOString().slice(0,10), ...(await response.json()).data };
}
function input(material: Material, supplier: Supplier, row: { snapshot_token: string }, required: string, requestId = crypto.randomUUID()) {
  return { request_id: requestId, required_by: required, timezone: "UTC", rows: [{ material_id: material.id, supplier_id: supplier.id, snapshot_token: row.snapshot_token, quantity: "42", currency: "EUR", acknowledge_incoming: false }] };
}
for (const width of [1440,390]) test(`replenishment ${width}px: shortage → reviewed draft → repeat prevention`, async ({ page, inventory }, testInfo) => {
  test.setTimeout(180_000);
  const { material } = await setup(inventory);
  await page.setViewportSize({ width, height: 960 });
  await inventory.login(page); await page.goto("/replenishment");
  await expect(page.getByRole("heading", { name: "Replenishment", exact: true, level: 2 })).toBeVisible();
  await page.getByLabel(`Select ${material.sku}`, { exact: true }).check();
  await page.getByRole("button", { name: "Review draft orders", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Create draft orders", exact: true }).click();
  await expect(page.getByText("Draft orders created", { exact: true })).toBeVisible();
  const pos = await inventory.rows("purchase_orders"); expect(pos).toHaveLength(1); expect(pos[0].status).toBe("draft");
  const po = await inventory.po(pos[0].id); expect(Number(po.lines[0].quantity_ordered)).toBe(42);
  const row = (await recommendations(inventory)).rows.find((r: { material_id: string }) => r.material_id===material.id);
  expect(row.draft_planned).toBe("42.000"); expect(row.confirmed_incoming).toBe("0.000"); expect(row.suggested_order).toBe("0.000");
  await expect(page.getByLabel(`Select ${material.sku}`, { exact: true })).toBeDisabled();
  await page.screenshot({ path: testInfo.outputPath("replenishment.png"), fullPage: true });
  await page.getByRole("link", { name: po.po_number, exact: true }).first().click();
  await expect(page.getByRole("dialog")).toContainText(po.po_number);
});
test("lost creation response is recovered without creating another PO", async ({ page, inventory }) => {
  test.setTimeout(180_000);
  const { material } = await setup(inventory); await inventory.login(page); await page.goto("/replenishment");
  await page.getByLabel(`Select ${material.sku}`, { exact: true }).check();
  await page.getByRole("button", { name: "Review draft orders", exact: true }).click();
  await page.route("**/api/replenishment/drafts", async route => { const response = await route.fetch(); expect(response.status()).toBe(201); await route.abort("failed"); });
  await page.getByRole("button", { name: "Create draft orders", exact: true }).click();
  await expect(page.getByRole("button", { name: "Check result", exact: true })).toBeEnabled();
  await page.reload();
  await page.getByRole("button", { name: "Check result", exact: true }).click();
  await expect(page.getByText("Draft orders created", { exact: true })).toBeVisible();
  expect(await inventory.rows("purchase_orders")).toHaveLength(1);
});
test("concurrent independent request IDs cannot buy the same proposal twice", async ({ inventory }) => {
  const { material, supplier } = await setup(inventory); const plan = await recommendations(inventory);
  const row = plan.rows.find((r: { material_id: string }) => r.material_id===material.id);
  const responses = await Promise.all([1,2].map(() => inventory.request.post("/api/replenishment/drafts", { headers: inventory.headers(), data: input(material,supplier,row,plan.required) })));
  expect(responses.map(r => r.status()).sort()).toEqual([201,409]);
  expect(await inventory.rows("purchase_orders")).toHaveLength(1);
});

test("invalid replenishment API input returns field errors without changing persisted data", async ({ inventory }) => {
  const { material, supplier } = await setup(inventory);
  const before = await inventory.snapshot();
  const plan = await recommendations(inventory);
  const row = plan.rows.find((r: { material_id: string }) => r.material_id === material.id);
  const valid = input(material, supplier, row, plan.required);
  const invalidDrafts = [
    { ...valid, rows: [{ ...valid.rows[0], quantity: "1.0001" }] },
    { ...valid, rows: [] },
    { ...valid, rows: Array.from({ length: 1000 }, () => ({})) }
  ];
  for (const payload of invalidDrafts) {
    const response = await inventory.request.post("/api/replenishment/drafts", { headers: inventory.headers(), data: payload });
    expect(response.status(), await response.text()).toBe(400);
    const body = await response.json();
    expect(body.code).toBe("validation_failed");
    expect(body.details.fieldErrors.rows.length).toBeGreaterThan(0);
    expect(body.requestId).toBe(response.headers()["x-request-id"]);
  }
  const settings = await inventory.request.patch("/api/replenishment/settings", { headers: inventory.headers(), data: { material_id: material.id, min_stock: "10", target_stock: "9", supplier_id: supplier.id } });
  expect(settings.status(), await settings.text()).toBe(400);
  expect((await settings.json()).details.fieldErrors.target_stock.length).toBeGreaterThan(0);
  expect(await inventory.snapshot()).toEqual(before);
  const requests = await inventory.db.from("replenishment_requests").select("*").eq("org_id", inventory.orgId);
  expect(requests.error).toBeNull();
  expect(requests.data).toEqual([]);
});

test("name-only API patches preserve inactive state and supplier lead time", async ({ inventory }) => {
  const catalog = await inventory.catalog();
  const supplier = catalog.suppliers[0];
  const location = catalog.locations[0];
  async function patch(path: string, data: Record<string, unknown>) {
    const response = await inventory.request.patch(path, { headers: inventory.headers(), data });
    expect(response.status(), await response.text()).toBe(200);
    return (await response.json()).data;
  }
  await patch(`/api/suppliers/${supplier.id}`, { is_active: false, lead_time_days: 7 });
  const vendor = await patch(`/api/suppliers/${supplier.id}`, { name: "Renamed inactive supplier" });
  expect(vendor).toMatchObject({ is_active: false, lead_time_days: 7 });
  await patch(`/api/locations/${location.id}`, { is_active: false });
  const warehouse = await patch(`/api/locations/${location.id}`, { name: "Renamed inactive location" });
  expect(warehouse.is_active).toBe(false);
  for (const path of [`/api/suppliers/${supplier.id}`, `/api/locations/${location.id}`]) {
    const response = await inventory.request.patch(path, { headers: inventory.headers(), data: {} });
    expect(response.status(), await response.text()).toBe(400);
  }
});

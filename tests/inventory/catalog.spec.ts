import { test, expect } from "./fixtures";

test("real CSV import handles quoted fields and duplicates and rejects the whole invalid batch", async ({ inventory }) => {
  const response = await inventory.request.post("/api/import/materials-csv", {
    headers: { ...inventory.headers(), "content-type": "text/csv" },
    data: '\ufeffsku;name;uom;min_stock\r\nCSV-1;"Stone; 20kg";KG;5\r\nCSV-1;"Stone; 25kg";KG;6\r\nCSV-2;Nails;PC;0\r\n'
  });
  expect(response.status(), await response.text()).toBe(201);
  expect((await response.json()).data).toMatchObject({ inserted: 2, updated: 0, duplicates: 1 });
  expect(await inventory.rows("materials")).toEqual(expect.arrayContaining([
    expect.objectContaining({ sku: "CSV-1", name: "Stone; 25kg", min_stock: 6, uom: "KG" }),
    expect.objectContaining({ sku: "CSV-2", uom: "PC" })
  ]));
  const before = await inventory.snapshot();
  const invalid = await inventory.request.post("/api/import/materials-csv", {
    headers: { ...inventory.headers(), "content-type": "text/csv" },
    data: "sku,name,uom,min_stock\nCSV-3,Valid,PC,1\nCSV-4,Invalid,PC,-1\n"
  });
  expect(invalid.status(), await invalid.text()).toBe(400);
  expect(await inventory.snapshot()).toEqual(before);
  const update = await inventory.request.post("/api/import/materials-csv", {
    headers: { ...inventory.headers(), "content-type": "text/csv" }, data: "sku,name,uom,min_stock\nCSV-2,New name,PC,9\n"
  });
  expect(update.status(), await update.text()).toBe(201);
  expect((await update.json()).data).toMatchObject({ inserted: 0, updated: 1 });
  expect((await inventory.rows("materials")).find(row => row.sku === "CSV-2")).toMatchObject({ name: "New name", min_stock: 9 });
});

test("catalog edits persist and blocked destinations reject atomic stock commands", async ({ inventory }) => {
  const { materials: [material], locations: [a, b], suppliers: [supplier] } = await inventory.catalog();
  for (const [path, data] of [
    [`/materials/${material.id}`, { name: "Renamed material" }],
    [`/locations/${a.id}`, { name: "Renamed warehouse", code: "A" }],
    [`/suppliers/${supplier.id}`, { name: "Renamed vendor" }]
  ] as const) {
    const result = await inventory.request.patch(`/api${path}`, { headers: inventory.headers(), data });
    expect(result.status(), await result.text()).toBe(200);
  }
  expect((await inventory.rows("materials")).find(row => row.id === material.id)?.name).toBe("Renamed material");
  expect((await inventory.rows("locations")).find(row => row.id === a.id)?.name).toBe("Renamed warehouse");
  expect((await inventory.rows("suppliers")).find(row => row.id === supplier.id)?.name).toBe("Renamed vendor");
  await inventory.post("/stock/movements", { material_id: material.id, location_id: a.id, reason: "adjustment", quantity_delta: 10 });
  const blocked = await inventory.request.patch(`/api/locations/${b.id}`, { headers: inventory.headers(), data: { is_active: false } });
  expect(blocked.status(), await blocked.text()).toBe(200);
  const before = await inventory.snapshot();
  const transfer = await inventory.request.post("/api/stock/movements", { headers: inventory.headers(), data: { material_id: material.id, from_location_id: a.id, to_location_id: b.id, reason: "transfer", quantity: 5 } });
  expect(transfer.status(), await transfer.text()).toBe(422);
  expect((await transfer.json()).error).toBe("Location is unavailable or blocked for usage.");
  expect(await inventory.snapshot()).toEqual(before);
});

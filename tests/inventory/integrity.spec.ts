import { test, expect, materialInput, type InventoryFixture } from "./fixtures";

for (const width of [1440, 390]) {
  test(`stock form displays real errors and allows retry at ${width}px`, async ({ inventory, page }) => {
    const { materials: [material], locations: [a, b] } = await inventory.catalog();
    await inventory.post("/stock/movements", { material_id: material.id, location_id: a.id, reason: "adjustment", quantity_delta: 100 });
    await page.setViewportSize({ width, height: 900 });
    await inventory.login(page);
    await page.goto("/stock-movements");
    await page.getByRole("button", { name: "Move Material", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Move Material" });
    await dialog.getByRole("combobox", { name: "Material", exact: true }).selectOption(material.id);
    await dialog.getByRole("combobox", { name: "Location", exact: true }).selectOption(a.id);
    await dialog.getByLabel("Quantity Delta", { exact: true }).fill("-101");
    await dialog.getByRole("textbox", { name: "Comments", exact: true }).fill("Keep this note for retry");
    const before = await inventory.snapshot();
    let response = page.waitForResponse(r => r.url().endsWith("/api/stock/movements") && r.request().method() === "POST");
    await dialog.getByRole("button", { name: "Add to Stock", exact: true }).click();
    expect((await response).status()).toBe(409);
    await expect(dialog.getByRole("alert")).toHaveText("Not enough quantity at the specified location.");
    await expect(dialog.getByRole("alert")).toBeVisible();
    await expect(dialog.getByLabel("Quantity Delta", { exact: true })).toHaveValue("-101");
    await expect(dialog.getByRole("textbox", { name: "Comments", exact: true })).toHaveValue("Keep this note for retry");
    expect(await inventory.snapshot()).toEqual(before);

    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
    await page.getByRole("button", { name: "Move Material", exact: true }).click();
    await expect(dialog.getByRole("alert")).toHaveCount(0);
    await dialog.getByRole("combobox", { name: "Reason", exact: true }).selectOption("transfer");
    await dialog.getByRole("combobox", { name: "Transfer out", exact: true }).selectOption(a.id);
    await dialog.getByRole("combobox", { name: "Transfer to", exact: true }).selectOption(b.id);
    await dialog.getByLabel("Quantity", { exact: true }).fill("1");
    // Block a location after this browser loaded the available choices.
    const blocked = await inventory.request.patch(`/api/locations/${b.id}`, { headers: inventory.headers(), data: { is_active: false } });
    expect(blocked.status()).toBe(200);
    const blockedBefore = await inventory.snapshot();
    response = page.waitForResponse(r => r.url().endsWith("/api/stock/movements") && r.request().method() === "POST");
    await dialog.getByRole("button", { name: "Add to Stock", exact: true }).click();
    expect((await response).status()).toBe(422);
    await expect(dialog.getByRole("alert")).toHaveText("Location is unavailable or blocked for usage.");
    await expect(dialog.getByRole("alert")).toBeVisible();
    expect(await inventory.snapshot()).toEqual(blockedBefore);
    const unblocked = await inventory.request.patch(`/api/locations/${b.id}`, { headers: inventory.headers(), data: { is_active: true } });
    expect(unblocked.status()).toBe(200);
    response = page.waitForResponse(r => r.url().endsWith("/api/stock/movements") && r.request().method() === "POST");
    await dialog.getByRole("button", { name: "Add to Stock", exact: true }).click();
    expect((await response).status()).toBe(201);
    await expect(dialog.getByRole("alert")).toHaveCount(0);
    await inventory.balances([[material.id, a.id, 99], [material.id, b.id, 1]]);
  });
}

async function rejectedWithoutWrites(inventory: InventoryFixture, path: string, data: unknown, statuses: number[], headers: Record<string, string> = inventory.headers()) {
  const before = await inventory.snapshot();
  const response = await inventory.request.post(`/api${path}`, { headers, data });
  expect(statuses, await response.text()).toContain(response.status());
  const body = await response.json();
  expect(body.error).toBeTruthy();
  expect(body.error).not.toBe("Unexpected server error.");
  if ([409, 422].includes(response.status())) {
    expect(response.headers()["x-request-id"]).toBe(body.requestId);
    expect(body.code).toBe(response.status() === 409 ? "conflict" : "validation_failed");
  }
  expect(await inventory.snapshot()).toEqual(before);
}

test("invalid movements and insufficient stock leave balances and ledger unchanged", async ({ inventory }) => {
  const { materials: [m], locations: [a, b] } = await inventory.catalog();
  await inventory.post("/stock/movements", { material_id: m.id, location_id: a.id, reason: "adjustment", quantity_delta: 100 });
  for (const data of [
    { material_id: m.id, location_id: a.id, reason: "adjustment", quantity_delta: 0 },
    { material_id: m.id, location_id: a.id, reason: "consumption", quantity_delta: 1 },
    { material_id: m.id, location_id: a.id, reason: "consumption", quantity_delta: -101 },
    { material_id: m.id, location_id: b.id, reason: "consumption", quantity_delta: -1 },
    { material_id: m.id, from_location_id: a.id, to_location_id: a.id, reason: "transfer", quantity: 1 },
    { material_id: m.id, from_location_id: a.id, to_location_id: b.id, reason: "transfer", quantity: 0 },
    { material_id: m.id, from_location_id: a.id, to_location_id: b.id, reason: "transfer", quantity: -1 }
  ]) await rejectedWithoutWrites(inventory, "/stock/movements", data, [400]);
  // Known database business-rule failures have a safe 4xx contract.
  await rejectedWithoutWrites(inventory, "/stock/movements", {
    material_id: m.id, from_location_id: a.id, to_location_id: b.id, reason: "transfer", quantity: 101
  }, [409]);
  await rejectedWithoutWrites(inventory, "/stock/movements", {
    material_id: m.id, location_id: a.id, reason: "adjustment", quantity_delta: -101
  }, [409]);
  await inventory.balances([[m.id, a.id, 100]]);
});

test("decimal quantities and exact depletion preserve UoM and stock precision", async ({ inventory }) => {
  const { materials: [, m], locations: [a, b] } = await inventory.catalog();
  await inventory.post("/stock/movements", { material_id: m.id, location_id: a.id, reason: "adjustment", quantity_delta: 100.125 });
  await inventory.post("/stock/movements", { material_id: m.id, location_id: a.id, reason: "consumption", quantity_delta: -0.125 });
  await inventory.post("/stock/movements", { material_id: m.id, from_location_id: a.id, to_location_id: b.id, reason: "transfer", quantity: 100 });
  await inventory.balances([[m.id, a.id, 0], [m.id, b.id, 100]]);
  const material = (await inventory.rows("materials")).find((row) => row.id === m.id);
  expect(material?.uom).toBe("KG");
});

test("multi-line receipts roll back an earlier valid line when a later line over-receives", async ({ inventory }) => {
  const { materials: [m1, m2], locations: [a, b], suppliers: [supplier] } = await inventory.catalog();
  const po = await inventory.createPo(supplier, [{ material_id: m1.id, quantity_ordered: 200 }, { material_id: m2.id, quantity_ordered: 2000 }]);
  const l1 = po.lines.find((line) => line.material_id === m1.id)!;
  const l2 = po.lines.find((line) => line.material_id === m2.id)!;
  const receipts = [{ po_line_id: l1.id, location_id: a.id, quantity_received: 40 }, { po_line_id: l2.id, location_id: b.id, quantity_received: 2000 }];
  await rejectedWithoutWrites(inventory, `/purchase-orders/${po.id}/receive`, { receipts }, [400]);
  await inventory.status(po, "sent");
  for (const quantity of [0, -1]) {
    await rejectedWithoutWrites(inventory, `/purchase-orders/${po.id}/receive`, { receipts: [{ ...receipts[0], quantity_received: quantity }] }, [400]);
  }
  await rejectedWithoutWrites(inventory, `/purchase-orders/${po.id}/receive`, {
    receipts: [receipts[0], { ...receipts[1], quantity_received: 2001 }]
  }, [409]);
  await inventory.post(`/purchase-orders/${po.id}/receive`, { receipts }, 200);
  await inventory.balances([[m1.id, a.id, 40], [m2.id, b.id, 2000]]);
  expect((await inventory.po(po.id)).status).toBe("partial");
  const partial = await inventory.po(po.id);
  expect(partial.lines.find((line) => line.id === l1.id)?.quantity_received).toBe(40);
  expect(partial.lines.find((line) => line.id === l2.id)?.quantity_received).toBe(2000);
  await inventory.post(`/purchase-orders/${po.id}/receive`, { receipts: [{ ...receipts[0], quantity_received: 160 }] }, 200);
  expect((await inventory.po(po.id)).status).toBe("received");
  await inventory.balances([[m1.id, a.id, 200], [m2.id, b.id, 2000]]);
  await rejectedWithoutWrites(inventory, `/purchase-orders/${po.id}/receive`, { receipts }, [409]);
});

test("cancelled POs and a line belonging to another PO cannot be received", async ({ inventory }) => {
  const { materials: [m], locations: [a], suppliers: [supplier] } = await inventory.catalog();
  const po = await inventory.createPo(supplier, [{ material_id: m.id, quantity_ordered: 200 }]);
  const otherPo = await inventory.createPo(supplier, [{ material_id: m.id, quantity_ordered: 200 }]);
  await inventory.status(po, "sent");
  await rejectedWithoutWrites(inventory, `/purchase-orders/${po.id}/receive`, {
    receipts: [{ po_line_id: otherPo.lines[0].id, location_id: a.id, quantity_received: 40 }]
  }, [422]);
  await inventory.status(po, "cancelled");
  await rejectedWithoutWrites(inventory, `/purchase-orders/${po.id}/receive`, {
    receipts: [{ po_line_id: po.lines[0].id, location_id: a.id, quantity_received: 40 }]
  }, [400]);
});

test("simultaneous consumption/transfer cannot overspend the same balance", async ({ inventory }) => {
  const { materials: [m], locations: [a, b] } = await inventory.catalog();
  await inventory.post("/stock/movements", { material_id: m.id, location_id: a.id, reason: "adjustment", quantity_delta: 100 });
  const results = await Promise.all([
    inventory.request.post("/api/stock/movements", { headers: inventory.headers(), data: { material_id: m.id, location_id: a.id, reason: "consumption", quantity_delta: -60 } }),
    inventory.request.post("/api/stock/movements", { headers: inventory.headers(), data: { material_id: m.id, from_location_id: a.id, to_location_id: b.id, reason: "transfer", quantity: 60 } })
  ]);
  expect(results.filter((response) => response.status() === 201)).toHaveLength(1);
  expect(results.filter((response) => [400, 409].includes(response.status()))).toHaveLength(1);
  const transferWon = results[1].status() === 201;
  await inventory.balances(transferWon ? [[m.id, a.id, 40], [m.id, b.id, 60]] : [[m.id, a.id, 40]]);
  expect(await inventory.rows("stock_movements")).toHaveLength(transferWon ? 3 : 2);
});

test("simultaneous full receipts add stock only once", async ({ inventory }) => {
  const { materials: [m], locations: [a], suppliers: [supplier] } = await inventory.catalog();
  const po = await inventory.createPo(supplier, [{ material_id: m.id, quantity_ordered: 200 }]);
  await inventory.status(po, "sent");
  const data = { receipts: [{ po_line_id: po.lines[0].id, location_id: a.id, quantity_received: 200 }] };
  const results = await Promise.all([1, 2].map(() => inventory.request.post(`/api/purchase-orders/${po.id}/receive`, { headers: inventory.headers(), data })));
  expect(results.map((response) => response.status()).sort()).toEqual([200, 409]);
  await inventory.balances([[m.id, a.id, 200]]);
  expect(await inventory.rows("stock_movements")).toHaveLength(1);
  expect(await inventory.po(po.id)).toMatchObject({ status: "received", lines: [expect.objectContaining({ quantity_received: 200 })] });
});

test("viewer, unauthenticated and foreign-workspace requests cannot change inventory", async ({ inventory }) => {
  const { materials: [m], locations: [a, b], suppliers: [supplier] } = await inventory.catalog();
  const po = await inventory.createPo(supplier, [{ material_id: m.id, quantity_ordered: 200 }]);
  await inventory.status(po, "sent");
  const movement = { material_id: m.id, location_id: a.id, reason: "adjustment", quantity_delta: 100 };
  await rejectedWithoutWrites(inventory, "/stock/movements", movement, [401], { "x-org-id": inventory.orgId });
  const { error } = await inventory.db.from("org_users").update({ role: "viewer" }).eq("org_id", inventory.orgId).eq("user_id", inventory.userId);
  expect(error).toBeNull();
  for (const [path, data] of [
    ["/materials", materialInput("FORBIDDEN")],
    ["/locations", { name: "Forbidden" }],
    ["/suppliers", { name: "Forbidden" }],
    ["/stock/movements", movement],
    ["/stock/movements", { material_id: m.id, from_location_id: a.id, to_location_id: b.id, reason: "transfer", quantity: 1 }],
    ["/purchase-orders", { supplier_id: supplier.id, lines: [{ material_id: m.id, quantity_ordered: 200 }] }],
    [`/purchase-orders/${po.id}/receive`, { receipts: [{ po_line_id: po.lines[0].id, location_id: a.id, quantity_received: 40 }] }]
  ] as const) await rejectedWithoutWrites(inventory, path, data, [403]);
  const response = await inventory.request.get("/api/materials", { headers: inventory.headers() });
  expect(response.status()).toBe(200);
  expect((await response.json()).data).toHaveLength(2);
  // A real second tenant: the authenticated user has no membership in it.
  const { data: foreign, error: foreignError } = await inventory.db.from("organizations").insert({ name: "Foreign inventory" }).select("id").single();
  expect(foreignError).toBeNull();
  await rejectedWithoutWrites(inventory, "/stock/movements", movement, [403], inventory.headers(foreign!.id));
  const foreignRead = await inventory.request.get("/api/materials", { headers: inventory.headers(foreign!.id) });
  expect(foreignRead.status()).toBe(403);
});

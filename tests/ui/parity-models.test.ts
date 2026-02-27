import { describe, expect, it } from "vitest";
import {
  filterInventoryRows,
  groupLocationsByWarehouse,
  inventoryMetrics,
  materialLocationSummary,
  normalizeStatus,
  purchaseOrderLinePreview,
  purchaseOrderOverview,
  purchaseOrderProgress,
  splitLocationName,
  supplierOrderStats,
  toParsedLocationRows,
  vendorMetrics,
  type MaterialRow,
  type PurchaseOrderRow,
  type SupplierRow
} from "@/lib/ui/parity-models";

const materials: MaterialRow[] = [
  {
    id: "m1",
    sku: "TECH-001",
    name: "Wireless Mouse",
    uom: "Electronics",
    min_stock: 20,
    total_quantity: 45,
    primary_location: "Warehouse A",
    stock_status: "in-stock"
  },
  {
    id: "m2",
    sku: "FURN-023",
    name: "Office Chair",
    uom: "Furniture",
    min_stock: 10,
    total_quantity: 8,
    primary_location: "Warehouse B"
  },
  {
    id: "m3",
    sku: "TECH-045",
    name: "USB-C Cable",
    uom: "Electronics",
    min_stock: 50,
    total_quantity: 0,
    primary_location: "Warehouse C"
  }
];

const purchaseOrders: PurchaseOrderRow[] = [
  {
    id: "po1",
    supplier: { id: "s1", name: "Alpha Supplies" },
    status: "received",
    lines: [
      {
        material_id: "m1",
        quantity_ordered: 10,
        quantity_received: 5,
        unit_price: 4
      },
      {
        material_id: "m2",
        quantity_ordered: 3,
        quantity_received: 3,
        unit_price: 100
      }
    ]
  }
];

const suppliers: SupplierRow[] = [
  { id: "s1", name: "Alpha Supplies", lead_time_days: 7 },
  { id: "s2", name: "Beta Trade", lead_time_days: 3 }
];

describe("parity models", () => {
  it("normalizes stock status from quantity and threshold when status is missing", () => {
    expect(normalizeStatus(undefined, 0, 1)).toBe("out-of-stock");
    expect(normalizeStatus(undefined, 1, 2)).toBe("low-stock");
    expect(normalizeStatus(undefined, 3, 2)).toBe("in-stock");
  });

  it("calculates inventory metrics", () => {
    const metrics = inventoryMetrics(materials, purchaseOrders);
    expect(metrics.totalItems).toBe(53);
    expect(metrics.lowStock).toBe(1);
    expect(metrics.outOfStock).toBe(1);
    expect(metrics.totalValue).toBe(320);
  });

  it("filters inventory rows by query and category", () => {
    expect(filterInventoryRows(materials, "", "all")).toHaveLength(3);
    expect(filterInventoryRows(materials, "wire", "all").map((row) => row.id)).toEqual(["m1"]);
    expect(filterInventoryRows(materials, "", "Electronics").map((row) => row.id)).toEqual(["m1", "m3"]);
    expect(filterInventoryRows(materials, "chair", "Electronics")).toHaveLength(0);
  });

  it("computes purchase order progress", () => {
    const progress = purchaseOrderProgress(purchaseOrders[0]);
    expect(progress.totalOrdered).toBe(13);
    expect(progress.totalReceived).toBe(8);
    expect(progress.percentage).toBe(62);
  });

  it("computes purchase order overview metrics", () => {
    const overview = purchaseOrderOverview([
      ...purchaseOrders,
      {
        id: "po2",
        supplier: { id: "s2", name: "Beta Trade" },
        status: "partial",
        lines: [
          {
            material_id: "m3",
            quantity_ordered: 20,
            quantity_received: 10,
            unit_price: 2
          }
        ]
      },
      {
        id: "po3",
        supplier: { id: "s2", name: "Beta Trade" },
        status: "cancelled",
        lines: []
      }
    ]);

    expect(overview.totalOrders).toBe(3);
    expect(overview.openOrders).toBe(1);
    expect(overview.receivedOrders).toBe(1);
    expect(overview.totalValue).toBe(380);
    expect(overview.statusCounts).toEqual({
      draft: 0,
      sent: 0,
      partial: 1,
      received: 1,
      cancelled: 1
    });
  });

  it("builds purchase order line preview", () => {
    const skuByMaterial = new Map<string, string>([
      ["m1", "TECH-001"],
      ["m2", "FURN-023"],
      ["m3", "TECH-045"]
    ]);

    expect(purchaseOrderLinePreview(purchaseOrders[0], skuByMaterial, 1)).toBe("TECH-001 +1 more");
    expect(
      purchaseOrderLinePreview(
        {
          id: "po-empty",
          status: "draft",
          lines: []
        },
        skuByMaterial
      )
    ).toBe("No lines");
  });

  it("builds sorted material location summary", () => {
    const summary = materialLocationSummary(
      [
        ...materials,
        { ...materials[0], id: "m4", primary_location: "Warehouse A" },
        { ...materials[0], id: "m5", primary_location: null }
      ],
      3
    );

    expect(summary).toEqual([
      { location: "Warehouse A", count: 2 },
      { location: "Unassigned", count: 1 },
      { location: "Warehouse B", count: 1 }
    ]);
  });

  it("splits location name into warehouse and zone", () => {
    expect(splitLocationName("Warehouse A - Zone 1")).toEqual({
      warehouse: "Warehouse A",
      zone: "Zone 1"
    });
    expect(splitLocationName("Main Warehouse")).toEqual({
      warehouse: "Main Warehouse",
      zone: "General"
    });
    expect(splitLocationName("")).toEqual({
      warehouse: "Unassigned",
      zone: "General"
    });
  });

  it("builds parsed location rows and groups by warehouse", () => {
    const rows = toParsedLocationRows([
      { id: "l1", name: "Warehouse A - Zone 2", code: "A2" },
      { id: "l2", name: "Warehouse A - Zone 1", code: "A1" },
      { id: "l3", name: "Warehouse B - Main", code: "B1" }
    ]);
    expect(rows[0]).toMatchObject({ warehouse: "Warehouse A", zone: "Zone 2" });

    const groups = groupLocationsByWarehouse([
      { id: "l1", name: "Warehouse A - Zone 2", code: "A2" },
      { id: "l2", name: "Warehouse A - Zone 1", code: "A1" },
      { id: "l3", name: "Warehouse B - Main", code: "B1" }
    ]);

    expect(groups[0].warehouse).toBe("Warehouse A");
    expect(groups[0].locations.map((location) => location.zone)).toEqual(["Zone 1", "Zone 2"]);
    expect(groups[1].warehouse).toBe("Warehouse B");
  });

  it("computes vendor metrics", () => {
    const metrics = vendorMetrics(suppliers, [
      ...purchaseOrders,
      { id: "po2", supplier: { id: "s2", name: "Beta Trade" }, status: "draft", lines: [] },
      { id: "po3", supplier: { id: "s2", name: "Beta Trade" }, status: "cancelled", lines: [] }
    ]);

    expect(metrics).toEqual({
      totalSuppliers: 2,
      averageLeadTimeDays: 5,
      openOrders: 1,
      receivedOrders: 1
    });
  });

  it("builds supplier order stats with fallback rows", () => {
    const rows = supplierOrderStats(suppliers, [
      { id: "po1", supplier: { id: "s1", name: "Alpha Supplies" }, status: "received", lines: [] },
      { id: "po2", supplier: { id: "s1", name: "Alpha Supplies" }, status: "draft", lines: [] },
      { id: "po3", supplier: { id: "s9", name: "Unknown Vendor" }, status: "partial", lines: [] }
    ]);

    expect(rows[0]).toMatchObject({
      supplierId: "s1",
      name: "Alpha Supplies",
      totalOrders: 2,
      openOrders: 1,
      receivedOrders: 1
    });
    expect(rows.find((row) => row.name === "Beta Trade")).toMatchObject({
      totalOrders: 0,
      openOrders: 0,
      receivedOrders: 0
    });
    expect(rows.find((row) => row.name === "Unknown Vendor")).toMatchObject({
      totalOrders: 1,
      openOrders: 1,
      receivedOrders: 0
    });
  });
});

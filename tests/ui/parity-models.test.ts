import { describe, expect, it } from "vitest";
import {
  filterInventoryRows,
  inventoryMetrics,
  normalizeStatus,
  purchaseOrderProgress,
  type MaterialRow,
  type PurchaseOrderRow
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
});

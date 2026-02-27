export type MaterialRow = {
  id: string;
  sku: string;
  name: string;
  uom: string;
  min_stock: number;
  total_quantity?: number;
  primary_location?: string | null;
  stock_status?: "in-stock" | "low-stock" | "out-of-stock";
};

export type PurchaseOrderLineRow = {
  material_id: string;
  quantity_ordered: number;
  quantity_received: number;
  unit_price: number | null;
};

export type PurchaseOrderRow = {
  id: string;
  status: "draft" | "sent" | "partial" | "received" | "cancelled";
  lines: PurchaseOrderLineRow[];
};

export type MaterialLocationSummary = {
  location: string;
  count: number;
};

export function normalizeStatus(
  status: MaterialRow["stock_status"],
  quantity: number,
  minStock: number
): "in-stock" | "low-stock" | "out-of-stock" {
  if (status) {
    return status;
  }
  if (quantity <= 0) {
    return "out-of-stock";
  }
  if (quantity <= minStock) {
    return "low-stock";
  }
  return "in-stock";
}

export function inventoryMetrics(materials: MaterialRow[], purchaseOrders: PurchaseOrderRow[]) {
  const totals = materials.reduce(
    (acc, material) => {
      const quantity = Number(material.total_quantity ?? 0);
      const status = normalizeStatus(material.stock_status, quantity, Number(material.min_stock));
      acc.totalItems += quantity;
      if (status === "low-stock") {
        acc.lowStock += 1;
      }
      if (status === "out-of-stock") {
        acc.outOfStock += 1;
      }
      return acc;
    },
    {
      totalItems: 0,
      lowStock: 0,
      outOfStock: 0
    }
  );

  const totalValue = purchaseOrders.reduce((sum, po) => {
    return (
      sum +
      po.lines.reduce((lineSum, line) => {
        return lineSum + Number(line.quantity_received || 0) * Number(line.unit_price || 0);
      }, 0)
    );
  }, 0);

  return {
    totalItems: totals.totalItems,
    lowStock: totals.lowStock,
    outOfStock: totals.outOfStock,
    totalValue
  };
}

export function filterInventoryRows(materials: MaterialRow[], query: string, category: string) {
  const normalizedQuery = query.trim().toLowerCase();
  return materials.filter((material) => {
    if (category !== "all" && material.uom !== category) {
      return false;
    }
    if (!normalizedQuery) {
      return true;
    }
    return (
      material.name.toLowerCase().includes(normalizedQuery) ||
      material.sku.toLowerCase().includes(normalizedQuery)
    );
  });
}

export function purchaseOrderProgress(po: PurchaseOrderRow) {
  const totalOrdered = po.lines.reduce((sum, line) => sum + Number(line.quantity_ordered || 0), 0);
  const totalReceived = po.lines.reduce((sum, line) => sum + Number(line.quantity_received || 0), 0);
  const percentage = totalOrdered > 0 ? Math.min(100, Math.round((totalReceived / totalOrdered) * 100)) : 0;
  return {
    totalOrdered,
    totalReceived,
    percentage
  };
}

export function materialLocationSummary(materials: MaterialRow[], max = 5): MaterialLocationSummary[] {
  const counts = new Map<string, number>();

  for (const material of materials) {
    const raw = material.primary_location?.trim();
    const key = raw && raw.length > 0 ? raw : "Unassigned";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([location, count]) => ({ location, count }))
    .sort((a, b) => b.count - a.count || a.location.localeCompare(b.location))
    .slice(0, Math.max(1, max));
}

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
  supplier?: { id?: string | null; name?: string | null } | null;
  status: "draft" | "sent" | "partial" | "received" | "cancelled";
  lines: PurchaseOrderLineRow[];
};

export type MaterialLocationSummary = {
  location: string;
  count: number;
};

export type LocationRow = {
  id: string;
  name: string;
  code?: string | null;
};

export type ParsedLocationRow = {
  id: string;
  name: string;
  code?: string | null;
  warehouse: string;
  zone: string;
};

export type LocationWarehouseGroup = {
  warehouse: string;
  locations: ParsedLocationRow[];
};

export type SupplierRow = {
  id: string;
  name: string;
  lead_time_days: number;
};

export type VendorMetrics = {
  totalSuppliers: number;
  averageLeadTimeDays: number;
  openOrders: number;
  receivedOrders: number;
};

export type SupplierOrderStatRow = {
  supplierId: string;
  name: string;
  leadTimeDays: number;
  totalOrders: number;
  openOrders: number;
  receivedOrders: number;
};

export type PurchaseOrderStatusCounts = {
  draft: number;
  sent: number;
  partial: number;
  received: number;
  cancelled: number;
};

export type PurchaseOrderOverview = {
  totalOrders: number;
  openOrders: number;
  receivedOrders: number;
  totalValue: number;
  statusCounts: PurchaseOrderStatusCounts;
};

export type PurchaseOrderLineViewRow = {
  materialLabel: string;
  quantityOrdered: number;
  quantityReceived: number;
  unitPrice: number;
  lineTotal: number;
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

export function purchaseOrderOverview(purchaseOrders: PurchaseOrderRow[]): PurchaseOrderOverview {
  const statusCounts = purchaseOrders.reduce<PurchaseOrderStatusCounts>(
    (acc, po) => {
      acc[po.status] += 1;
      return acc;
    },
    {
      draft: 0,
      sent: 0,
      partial: 0,
      received: 0,
      cancelled: 0
    }
  );

  const totalValue = purchaseOrders.reduce((sum, po) => {
    return (
      sum +
      po.lines.reduce((lineSum, line) => {
        return lineSum + Number(line.quantity_ordered || 0) * Number(line.unit_price || 0);
      }, 0)
    );
  }, 0);

  return {
    totalOrders: purchaseOrders.length,
    openOrders: statusCounts.draft + statusCounts.sent + statusCounts.partial,
    receivedOrders: statusCounts.received,
    totalValue,
    statusCounts
  };
}

export function purchaseOrderLinePreview(
  po: PurchaseOrderRow,
  skuByMaterialId: Map<string, string>,
  max = 2
) {
  const limit = Math.max(1, max);
  if (po.lines.length === 0) {
    return "No lines";
  }
  const preview = po.lines
    .slice(0, limit)
    .map((line) => skuByMaterialId.get(line.material_id) ?? "material")
    .join(", ");
  if (po.lines.length <= limit) {
    return preview;
  }
  return `${preview} +${po.lines.length - limit} more`;
}

export function purchaseOrderLineRows(
  po: PurchaseOrderRow,
  skuByMaterialId: Map<string, string>
): PurchaseOrderLineViewRow[] {
  return po.lines.map((line) => {
    const unitPrice = Number(line.unit_price || 0);
    const quantityOrdered = Number(line.quantity_ordered || 0);
    return {
      materialLabel: skuByMaterialId.get(line.material_id) ?? "material",
      quantityOrdered,
      quantityReceived: Number(line.quantity_received || 0),
      unitPrice,
      lineTotal: quantityOrdered * unitPrice
    };
  });
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

export function splitLocationName(name: string) {
  const trimmed = name.trim();
  if (!trimmed) {
    return {
      warehouse: "Unassigned",
      zone: "General"
    };
  }

  const dashIndex = trimmed.indexOf("-");
  if (dashIndex > 0) {
    const warehouse = trimmed.slice(0, dashIndex).trim();
    const zone = trimmed.slice(dashIndex + 1).trim();
    return {
      warehouse: warehouse || "Unassigned",
      zone: zone || "General"
    };
  }

  return {
    warehouse: trimmed,
    zone: "General"
  };
}

export function toParsedLocationRows(locations: LocationRow[]): ParsedLocationRow[] {
  return locations.map((location) => {
    const split = splitLocationName(location.name);
    return {
      ...location,
      warehouse: split.warehouse,
      zone: split.zone
    };
  });
}

export function groupLocationsByWarehouse(locations: LocationRow[]): LocationWarehouseGroup[] {
  const parsed = toParsedLocationRows(locations);
  const groups = new Map<string, ParsedLocationRow[]>();

  for (const location of parsed) {
    const list = groups.get(location.warehouse) ?? [];
    list.push(location);
    groups.set(location.warehouse, list);
  }

  return Array.from(groups.entries())
    .map(([warehouse, list]) => ({
      warehouse,
      locations: list.sort((a, b) => a.zone.localeCompare(b.zone))
    }))
    .sort((a, b) => b.locations.length - a.locations.length || a.warehouse.localeCompare(b.warehouse));
}

export function vendorMetrics(suppliers: SupplierRow[], purchaseOrders: PurchaseOrderRow[]): VendorMetrics {
  const totalSuppliers = suppliers.length;
  const averageLeadTimeDays =
    totalSuppliers === 0
      ? 0
      : Math.round(
          suppliers.reduce((sum, supplier) => sum + Number(supplier.lead_time_days || 0), 0) / totalSuppliers
        );
  const openOrders = purchaseOrders.filter((po) => po.status !== "received" && po.status !== "cancelled").length;
  const receivedOrders = purchaseOrders.filter((po) => po.status === "received").length;

  return {
    totalSuppliers,
    averageLeadTimeDays,
    openOrders,
    receivedOrders
  };
}

export function supplierOrderStats(suppliers: SupplierRow[], purchaseOrders: PurchaseOrderRow[]): SupplierOrderStatRow[] {
  const statsByKey = new Map<
    string,
    {
      supplierId: string;
      name: string;
      totalOrders: number;
      openOrders: number;
      receivedOrders: number;
    }
  >();

  for (const po of purchaseOrders) {
    const supplierId = po.supplier?.id?.trim();
    const supplierName = po.supplier?.name?.trim() || "Unknown";
    const key = supplierId && supplierId.length > 0 ? `id:${supplierId}` : `name:${supplierName.toLowerCase()}`;
    const current = statsByKey.get(key) ?? {
      supplierId: supplierId || key,
      name: supplierName,
      totalOrders: 0,
      openOrders: 0,
      receivedOrders: 0
    };

    current.totalOrders += 1;
    if (po.status === "received") {
      current.receivedOrders += 1;
    }
    if (po.status !== "received" && po.status !== "cancelled") {
      current.openOrders += 1;
    }

    statsByKey.set(key, current);
  }

  const supplierRows = suppliers.map((supplier) => {
    const byId = statsByKey.get(`id:${supplier.id}`);
    const byName = statsByKey.get(`name:${supplier.name.toLowerCase()}`);
    const stats = byId ?? byName;
    return {
      supplierId: supplier.id,
      name: supplier.name,
      leadTimeDays: Number(supplier.lead_time_days || 0),
      totalOrders: stats?.totalOrders ?? 0,
      openOrders: stats?.openOrders ?? 0,
      receivedOrders: stats?.receivedOrders ?? 0
    };
  });

  const knownSupplierIds = new Set(suppliers.map((supplier) => supplier.id));
  const knownSupplierNames = new Set(suppliers.map((supplier) => supplier.name.toLowerCase()));

  const additionalRows = Array.from(statsByKey.values())
    .filter((row) => {
      if (knownSupplierIds.has(row.supplierId)) {
        return false;
      }
      return !knownSupplierNames.has(row.name.toLowerCase());
    })
    .map((row) => ({
      supplierId: row.supplierId,
      name: row.name,
      leadTimeDays: 0,
      totalOrders: row.totalOrders,
      openOrders: row.openOrders,
      receivedOrders: row.receivedOrders
    }));

  return [...supplierRows, ...additionalRows].sort(
    (a, b) => b.totalOrders - a.totalOrders || a.name.localeCompare(b.name)
  );
}

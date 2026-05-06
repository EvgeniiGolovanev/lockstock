export type AuditLogMetadata = {
  actor_email?: string | null;
  changed_fields?: string[];
  old_values?: Record<string, unknown>;
  new_values?: Record<string, unknown>;
  material?: { sku?: string | null; name?: string | null; uom?: string | null } | null;
  location?: { code?: string | null; name?: string | null } | null;
  supplier?: { name?: string | null } | null;
  purchase_order?: { po_number?: string | null; status?: string | null } | null;
  team?: { name?: string | null } | null;
  quantity_delta?: string | number | null;
  reason?: string | null;
  email?: string | null;
};

function humanizeFieldName(value: string) {
  return value.replaceAll("_", " ");
}

function compactLabel(parts: Array<string | null | undefined>) {
  return parts.filter(Boolean).join(" - ");
}

function formatValue(value: unknown) {
  if (value === null || typeof value === "undefined") {
    return "blank";
  }
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }
  return String(value);
}

export function summarizeAuditMetadata(metadata: unknown): string[] {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return [];
  }

  const item = metadata as AuditLogMetadata;
  const details: string[] = [];

  if (item.changed_fields?.length) {
    details.push(`Changed: ${item.changed_fields.map(humanizeFieldName).join(", ")}`);
  }

  const oldValues = item.old_values ?? {};
  const newValues = item.new_values ?? {};
  for (const field of item.changed_fields ?? []) {
    if (field in oldValues || field in newValues) {
      details.push(`${humanizeFieldName(field)}: ${formatValue(oldValues[field])} -> ${formatValue(newValues[field])}`);
    }
    if (details.length >= 3) {
      break;
    }
  }

  const materialLabel = compactLabel([item.material?.sku, item.material?.name]);
  if (materialLabel) {
    details.push(`Material: ${materialLabel}`);
  }

  const locationLabel = compactLabel([item.location?.code, item.location?.name]);
  if (locationLabel) {
    details.push(`Location: ${locationLabel}`);
  }

  if (item.supplier?.name) {
    details.push(`Supplier: ${item.supplier.name}`);
  }

  if (item.purchase_order?.po_number) {
    details.push(`Purchase order: ${item.purchase_order.po_number}`);
  }

  if (item.quantity_delta || item.reason) {
    details.push(`Movement: ${compactLabel([item.quantity_delta ? String(item.quantity_delta) : null, item.reason])}`);
  }

  if (item.email) {
    details.push(`Email: ${item.email}`);
  }

  if (item.actor_email) {
    details.push(`By: ${item.actor_email}`);
  }

  return details.slice(0, 5);
}

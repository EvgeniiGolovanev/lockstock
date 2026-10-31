export type ReplenishmentRow = {
  material_id: string; sku: string; name: string; uom: string;
  min_stock: string; target_stock: string; on_hand: string;
  confirmed_incoming: string; draft_planned: string; suggested_order: string;
  supplier_id: string | null; currency: string | null; unit_price: string | null;
  uncertain: boolean; draft_warning?: boolean; state: "ready" | "review" | "setup" | "draft" | "covered";
  snapshot_token: string;
  orders: { id: string; number: string; status: string; expected_at: string | null; remaining: string }[];
};
export type ReplenishmentList = { rows: ReplenishmentRow[]; total: number; counts: Record<string, number>; can_write?: boolean };
export type DraftResult = { request_id: string; orders: { id: string; po_number: string; supplier_id: string; currency: string; status: "draft" }[] };

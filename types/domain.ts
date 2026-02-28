export type OrgRole = "owner" | "manager" | "member" | "viewer";

export type MovementReason = "adjustment" | "transfer_in" | "transfer_out" | "purchase_receive" | "correction";

export type PurchaseOrderStatus = "draft" | "sent" | "partial" | "received" | "cancelled";
export type PurchaseOrderCurrency = "EUR" | "USD";

export type Material = {
  id: string;
  org_id: string;
  sku: string;
  name: string;
  description: string | null;
  uom: string;
  min_stock: number;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type Supplier = {
  id: string;
  org_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  lead_time_days: number;
  payment_terms: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

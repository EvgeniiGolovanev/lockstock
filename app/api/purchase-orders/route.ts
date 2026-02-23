import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/api/errors";
import { requireMinRole, requireRequestContext } from "@/lib/api/route-context";
import { createPurchaseOrderSchema } from "@/lib/validators/purchase-order";

function makePoNumber() {
  const stamp = new Date().toISOString().replaceAll("-", "").replaceAll(":", "").replace("T", "-").slice(0, 15);
  return `PO-${stamp}`;
}

export async function GET(request: NextRequest) {
  try {
    const { orgId, supabase } = await requireRequestContext(request);

    const { data, error } = await supabase
      .from("purchase_orders")
      .select("*, supplier:suppliers(id,name), lines:po_lines(*)")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    return NextResponse.json({ data });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { orgId, userId, role, supabase } = await requireRequestContext(request);
    requireMinRole(role, "manager");
    const payload = createPurchaseOrderSchema.parse(await request.json());
    const poNumber = payload.po_number ?? makePoNumber();

    const { data: po, error: poError } = await supabase
      .from("purchase_orders")
      .insert({
        org_id: orgId,
        supplier_id: payload.supplier_id,
        po_number: poNumber,
        expected_at: payload.expected_at ?? null,
        notes: payload.notes ?? null,
        created_by: userId,
        status: "draft"
      })
      .select("*")
      .single();

    if (poError) {
      throw poError;
    }

    const lineRows = payload.lines.map((line) => ({
      org_id: orgId,
      purchase_order_id: po.id,
      material_id: line.material_id,
      quantity_ordered: line.quantity_ordered,
      unit_price: line.unit_price ?? null
    }));

    const { data: lines, error: linesError } = await supabase.from("po_lines").insert(lineRows).select("*");
    if (linesError) {
      throw linesError;
    }

    return NextResponse.json({ data: { ...po, lines } }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

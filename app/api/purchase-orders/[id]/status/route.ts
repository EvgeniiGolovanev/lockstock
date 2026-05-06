import { NextRequest, NextResponse } from "next/server";
import { ApiError, handleApiError } from "@/lib/api/errors";
import { requireMinRole, requireRequestContext } from "@/lib/api/route-context";
import { transitionPurchaseOrderStatusSchema } from "@/lib/validators/purchase-order";

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { orgId, role, supabase } = await requireRequestContext(request);
    requireMinRole(role, "manager");
    const { id: purchaseOrderId } = await context.params;
    const payload = transitionPurchaseOrderStatusSchema.parse(await request.json());

    const { data: po, error: poError } = await supabase
      .from("purchase_orders")
      .select("id,po_number,status")
      .eq("id", purchaseOrderId)
      .eq("org_id", orgId)
      .maybeSingle();

    if (poError) {
      throw poError;
    }

    if (!po) {
      throw new ApiError(404, "Purchase order not found.");
    }

    const canMarkSent = po.status === "draft" && payload.status === "sent";
    const canCancel =
      payload.status === "cancelled" &&
      (po.status === "draft" || po.status === "sent" || po.status === "partial");

    if (!canMarkSent && !canCancel) {
      throw new ApiError(400, `Invalid status transition: ${po.status} -> ${payload.status}.`);
    }

    const now = new Date().toISOString();
    const updatePayload =
      payload.status === "sent"
        ? {
            status: payload.status,
            sent_at: now,
            updated_at: now
          }
        : {
            status: payload.status,
            updated_at: now
          };

    const { data: updated, error: updateError } = await supabase
      .from("purchase_orders")
      .update(updatePayload)
      .eq("id", purchaseOrderId)
      .eq("org_id", orgId)
      .select("id,po_number,status,sent_at")
      .single();

    if (updateError) {
      throw updateError;
    }

    return NextResponse.json({ data: updated });
  } catch (error) {
    return handleApiError(error);
  }
}

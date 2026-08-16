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

    const { data: updated, error: updateError } = await supabase.rpc("transition_purchase_order_status", {
      p_org_id: orgId,
      p_po_id: purchaseOrderId,
      p_status: payload.status
    });

    if (updateError) {
      throw updateError;
    }

    const updatedRow = updated as
      | { id: string; po_number: string; status: string; sent_at: string | null }
      | null;
    if (!updatedRow) {
      throw new ApiError(500, "Failed to update purchase order status.");
    }

    return NextResponse.json({
      data: {
        id: updatedRow.id,
        po_number: updatedRow.po_number,
        status: updatedRow.status,
        sent_at: updatedRow.sent_at
      }
    });
  } catch (error) {
    return handleApiError(error);
  }
}

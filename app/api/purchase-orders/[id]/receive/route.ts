import { NextRequest, NextResponse } from "next/server";
import { ApiError, handleApiError } from "@/lib/api/errors";
import { requireMinRole, requireRequestContext } from "@/lib/api/route-context";
import { receivePurchaseOrderSchema } from "@/lib/validators/purchase-order";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { orgId, userId, role, supabase } = await requireRequestContext(request);
    requireMinRole(role, "member");
    const { id: purchaseOrderId } = await context.params;
    const payload = receivePurchaseOrderSchema.parse(await request.json());

    const { data: po, error: poError } = await supabase
      .from("purchase_orders")
      .select("id,status")
      .eq("id", purchaseOrderId)
      .eq("org_id", orgId)
      .maybeSingle();

    if (poError) {
      throw poError;
    }

    if (!po) {
      throw new ApiError(404, "Purchase order not found.");
    }

    if (po.status === "cancelled") {
      throw new ApiError(400, "Cannot receive a cancelled purchase order.");
    }
    if (po.status === "draft") {
      throw new ApiError(400, "Purchase order must be sent before receiving.");
    }

    const { data, error } = await supabase.rpc("receive_purchase_order", {
      p_org_id: orgId,
      p_po_id: purchaseOrderId,
      p_received_by: userId,
      p_receipts: payload.receipts
    });

    if (error) {
      throw error;
    }

    return NextResponse.json({ data });
  } catch (error) {
    return handleApiError(error);
  }
}

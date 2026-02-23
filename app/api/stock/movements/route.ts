import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/api/errors";
import { requireMinRole, requireRequestContext } from "@/lib/api/route-context";
import { createStockMovementSchema } from "@/lib/validators/stock";

export async function POST(request: NextRequest) {
  try {
    const { orgId, userId, role, supabase } = await requireRequestContext(request);
    requireMinRole(role, "member");
    const payload = createStockMovementSchema.parse(await request.json());

    const { data, error } = await supabase.rpc("create_stock_movement", {
      p_org_id: orgId,
      p_material_id: payload.material_id,
      p_location_id: payload.location_id,
      p_quantity_delta: payload.quantity_delta,
      p_reason: payload.reason,
      p_note: payload.note ?? null,
      p_reference_type: payload.reference_type ?? null,
      p_reference_id: payload.reference_id ?? null,
      p_created_by: userId
    });

    if (error) {
      throw error;
    }

    return NextResponse.json({ data: { movement_id: data } }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

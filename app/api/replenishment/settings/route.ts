import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/api/errors";
import { requireMinRole, requireRequestContext } from "@/lib/api/route-context";
import { settingsSchema } from "@/lib/validators/replenishment";
import { replenishmentRpc } from "@/lib/replenishment/service";
export async function PATCH(request: NextRequest) {
  try {
    const context = await requireRequestContext(request); requireMinRole(context.role, "manager");
    const input = settingsSchema.parse(await request.json());
    await replenishmentRpc(context, "set_replenishment_settings", { p_org_id: context.orgId, p_material_id: input.material_id, p_min_stock: input.min_stock, p_target_stock: input.target_stock, p_supplier_id: input.supplier_id, p_currency: input.currency });
    return NextResponse.json({ data: { saved: true } });
  } catch (error) { return handleApiError(error); }
}

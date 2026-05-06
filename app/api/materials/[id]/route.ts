import { NextRequest, NextResponse } from "next/server";
import { ApiError, handleApiError } from "@/lib/api/errors";
import { requireMinRole, requireRequestContext } from "@/lib/api/route-context";
import { updateMaterialUsageSchema } from "@/lib/validators/material";

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { orgId, role, supabase } = await requireRequestContext(request);
    requireMinRole(role, "manager");
    const { id } = await context.params;
    const payload = updateMaterialUsageSchema.parse(await request.json());

    const { data, error } = await supabase
      .from("materials")
      .update({
        is_active: payload.is_active,
        updated_at: new Date().toISOString()
      })
      .eq("id", id)
      .eq("org_id", orgId)
      .select("*")
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      throw new ApiError(404, "Material not found.");
    }

    return NextResponse.json({ data });
  } catch (error) {
    return handleApiError(error);
  }
}

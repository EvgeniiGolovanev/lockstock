import { NextRequest, NextResponse } from "next/server";
import { ApiError, handleApiError } from "@/lib/api/errors";
import { requireMinRole, requireRequestContext } from "@/lib/api/route-context";
import { updateLocationSchema } from "@/lib/validators/location";

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { orgId, role, supabase } = await requireRequestContext(request);
    requireMinRole(role, "manager");
    const { id } = await context.params;
    const payload = updateLocationSchema.parse(await request.json());

    const updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString()
    };

    if ("name" in payload) {
      updatePayload.name = payload.name;
    }
    if ("code" in payload) {
      updatePayload.code = payload.code ? payload.code : null;
    }
    if ("address" in payload) {
      updatePayload.address = payload.address ? payload.address : null;
    }
    if ("is_active" in payload) {
      updatePayload.is_active = payload.is_active;
    }

    const { data, error } = await supabase
      .from("locations")
      .update(updatePayload)
      .eq("id", id)
      .eq("org_id", orgId)
      .select("*")
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      throw new ApiError(404, "Location not found.");
    }

    return NextResponse.json({ data });
  } catch (error) {
    return handleApiError(error);
  }
}

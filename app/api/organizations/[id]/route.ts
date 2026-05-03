import { NextRequest, NextResponse } from "next/server";
import { ApiError, handleApiError } from "@/lib/api/errors";
import { requireExactRole, requireRequestContext } from "@/lib/api/route-context";
import { updateOrganizationSchema } from "@/lib/validators/organization";

function requireMatchingOrgId(pathOrgId: string, contextOrgId: string) {
  if (pathOrgId !== contextOrgId) {
    throw new ApiError(400, "Path organization id must match x-org-id header.");
  }
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: orgIdFromPath } = await context.params;
    const { orgId, role, supabase } = await requireRequestContext(request);
    requireMatchingOrgId(orgIdFromPath, orgId);
    requireExactRole(role, "owner");

    const payload = updateOrganizationSchema.parse(await request.json());

    const { data, error } = await supabase
      .from("organizations")
      .update({ name: payload.name })
      .eq("id", orgId)
      .select("id,name,created_at")
      .maybeSingle();

    if (error) {
      throw new ApiError(500, "Failed to update group.", error.message);
    }

    if (!data) {
      throw new ApiError(404, "Group not found.");
    }

    return NextResponse.json({ data });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: orgIdFromPath } = await context.params;
    const { orgId, role, supabase } = await requireRequestContext(request);
    requireMatchingOrgId(orgIdFromPath, orgId);
    requireExactRole(role, "owner");

    const { error } = await supabase.from("organizations").delete().eq("id", orgId);

    if (error) {
      throw new ApiError(500, "Failed to delete group.", error.message);
    }

    return NextResponse.json({ data: { id: orgId, deleted: true } });
  } catch (error) {
    return handleApiError(error);
  }
}

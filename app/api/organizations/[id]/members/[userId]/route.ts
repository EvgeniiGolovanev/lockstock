import { NextRequest, NextResponse } from "next/server";
import { ApiError, handleApiError } from "@/lib/api/errors";
import { requireExactRole, requireRequestContext } from "@/lib/api/route-context";
import { updateOrganizationMemberRoleSchema } from "@/lib/validators/member";

function requireMatchingOrgId(pathOrgId: string, contextOrgId: string) {
  if (pathOrgId !== contextOrgId) {
    throw new ApiError(400, "Path organization id must match x-org-id header.");
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string; userId: string }> }
) {
  try {
    const { id: orgIdFromPath, userId: targetUserId } = await context.params;
    const { orgId, userId, role, supabase } = await requireRequestContext(request);
    requireMatchingOrgId(orgIdFromPath, orgId);
    requireExactRole(role, "owner");
    const payload = updateOrganizationMemberRoleSchema.parse(await request.json());

    if (targetUserId === userId && payload.role !== "owner") {
      throw new ApiError(400, "Owners cannot demote themselves.");
    }

    const { data, error } = await supabase
      .from("org_users")
      .update({ role: payload.role })
      .eq("org_id", orgId)
      .eq("user_id", targetUserId)
      .select("user_id,role,created_at")
      .maybeSingle();

    if (error) {
      throw new ApiError(500, "Failed to update member role.", error.message);
    }

    if (!data) {
      throw new ApiError(404, "Organization member not found.");
    }

    return NextResponse.json({ data });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string; userId: string }> }
) {
  try {
    const { id: orgIdFromPath, userId: targetUserId } = await context.params;
    const { orgId, userId, role, supabase } = await requireRequestContext(request);
    requireMatchingOrgId(orgIdFromPath, orgId);
    requireExactRole(role, "owner");

    if (targetUserId === userId) {
      throw new ApiError(400, "Owners cannot remove themselves from organization.");
    }

    const { data, error } = await supabase.rpc("remove_org_member_with_team_memberships", {
      p_org_id: orgId,
      p_target_user_id: targetUserId
    });

    if (error) {
      throw error;
    }

    return NextResponse.json({ data });
  } catch (error) {
    return handleApiError(error);
  }
}

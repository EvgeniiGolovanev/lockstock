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

    const { data: existingMembership, error: existingMembershipError } = await supabase
      .from("org_users")
      .select("user_id,role")
      .eq("org_id", orgId)
      .eq("user_id", targetUserId)
      .maybeSingle();

    if (existingMembershipError) {
      throw new ApiError(500, "Failed to load existing membership.", existingMembershipError.message);
    }

    if (!existingMembership) {
      throw new ApiError(404, "Organization member not found.");
    }

    if (existingMembership.role === "owner") {
      throw new ApiError(400, "Cannot remove an owner from organization.");
    }

    const { data: teams, error: teamsError } = await supabase.from("teams").select("id").eq("org_id", orgId);
    if (teamsError) {
      throw new ApiError(500, "Failed to load organization teams.", teamsError.message);
    }

    const teamIds = (teams ?? []).map((team) => team.id as string);
    if (teamIds.length > 0) {
      const { error: removeTeamMembershipsError } = await supabase
        .from("team_members")
        .delete()
        .eq("user_id", targetUserId)
        .in("team_id", teamIds);

      if (removeTeamMembershipsError) {
        throw new ApiError(500, "Failed to remove team memberships.", removeTeamMembershipsError.message);
      }
    }

    const { error: removeMembershipError } = await supabase
      .from("org_users")
      .delete()
      .eq("org_id", orgId)
      .eq("user_id", targetUserId);

    if (removeMembershipError) {
      throw new ApiError(500, "Failed to remove organization membership.", removeMembershipError.message);
    }

    return NextResponse.json({ data: { user_id: targetUserId, removed: true } });
  } catch (error) {
    return handleApiError(error);
  }
}

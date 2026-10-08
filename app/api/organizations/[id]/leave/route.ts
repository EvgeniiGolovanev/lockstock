import { NextRequest, NextResponse } from "next/server";
import { ApiError, handleApiError } from "@/lib/api/errors";
import { requireRequestContext } from "@/lib/api/route-context";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const { orgId, userId, role, supabase } = await requireRequestContext(request);
    if (id !== orgId) throw new ApiError(400, "Path organization id must match x-org-id header.");
    if (role === "owner") throw new ApiError(403, "Owners cannot leave their organization.");
    const { data, error } = await supabase.rpc("remove_org_member_with_team_memberships", {
      p_org_id: orgId,
      p_target_user_id: userId
    });
    if (error) throw error;
    return NextResponse.json({ data });
  } catch (error) {
    return handleApiError(error);
  }
}

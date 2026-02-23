import { NextRequest, NextResponse } from "next/server";
import { handleApiError, ApiError } from "@/lib/api/errors";
import { requireMinRole, requireRequestContext, requireUserInOrg } from "@/lib/api/route-context";
import { addTeamMemberSchema } from "@/lib/validators/team";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { orgId, userId, role, supabase } = await requireRequestContext(request);
    requireMinRole(role, "manager");
    const { id: teamId } = await context.params;
    const payload = addTeamMemberSchema.parse(await request.json());
    await requireUserInOrg(supabase, orgId, payload.user_id);

    const { data: team, error: teamError } = await supabase
      .from("teams")
      .select("id")
      .eq("id", teamId)
      .eq("org_id", orgId)
      .maybeSingle();

    if (teamError) {
      throw teamError;
    }

    if (!team) {
      throw new ApiError(404, "Team not found.");
    }

    const { data, error } = await supabase
      .from("team_members")
      .insert({
        team_id: teamId,
        user_id: payload.user_id,
        created_by: userId
      })
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

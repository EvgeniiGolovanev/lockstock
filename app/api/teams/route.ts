import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/api/errors";
import { requireMinRole, requireRequestContext } from "@/lib/api/route-context";
import { createTeamSchema } from "@/lib/validators/team";

export async function GET(request: NextRequest) {
  try {
    const { orgId, supabase } = await requireRequestContext(request);

    const { data, error } = await supabase
      .from("teams")
      .select("*, members:team_members(user_id)")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    return NextResponse.json({ data });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { orgId, userId, role, supabase } = await requireRequestContext(request);
    requireMinRole(role, "manager");
    const payload = createTeamSchema.parse(await request.json());

    const { data: team, error: teamError } = await supabase
      .from("teams")
      .insert({
        org_id: orgId,
        created_by: userId,
        ...payload
      })
      .select("*")
      .single();

    if (teamError) {
      throw teamError;
    }

    const { error: memberError } = await supabase.from("team_members").insert({
      team_id: team.id,
      user_id: userId,
      created_by: userId
    });

    if (memberError) {
      throw memberError;
    }

    return NextResponse.json({ data: team }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

import { ApiError } from "@/lib/api/errors";
import { getSupabaseUserClient } from "@/lib/supabase-user";

type SupabaseUserClient = ReturnType<typeof getSupabaseUserClient>;

export async function requireDefaultTeamId(supabase: SupabaseUserClient, orgId: string): Promise<string> {
  const { data, error } = await supabase
    .from("teams")
    .select("id")
    .eq("org_id", orgId)
    .eq("is_default", true)
    .maybeSingle();

  if (error) {
    throw new ApiError(500, "Failed to load default team.", error.message);
  }

  if (!data) {
    throw new ApiError(500, "Default team is not configured for this organization.");
  }

  return data.id as string;
}

export async function upsertDefaultTeamMembership(
  supabase: SupabaseUserClient,
  orgId: string,
  userId: string,
  actorUserId: string
) {
  const defaultTeamId = await requireDefaultTeamId(supabase, orgId);
  const { error } = await supabase.from("team_members").upsert(
    {
      team_id: defaultTeamId,
      user_id: userId,
      created_by: actorUserId
    },
    { onConflict: "team_id,user_id", ignoreDuplicates: false }
  );

  if (error) {
    throw new ApiError(500, "Failed to sync default team membership.", error.message);
  }
}

import { NextRequest, NextResponse } from "next/server";
import { ApiError, handleApiError } from "@/lib/api/errors";
import { extractBearerToken, requireAuthenticatedUserId } from "@/lib/api/auth";
import { getSupabaseUserClient } from "@/lib/supabase-user";

type PendingInvitationRow = {
  id: string;
  org_id: string;
  org_name: string;
  role: "owner" | "manager" | "member" | "viewer";
  expires_at: string;
  created_at: string;
};

export async function GET(request: NextRequest) {
  try {
    const token = extractBearerToken(request);
    if (!token) {
      return NextResponse.json({ error: "Missing Authorization Bearer token." }, { status: 401 });
    }

    const userId = await requireAuthenticatedUserId(request);
    const supabase = getSupabaseUserClient(token);
    const nowIso = new Date().toISOString();

    const { data: currentMemberships, error: membershipsError } = await supabase
      .from("org_users")
      .select("org_id")
      .eq("user_id", userId);

    if (membershipsError) {
      throw new ApiError(500, "Failed to load current memberships.", membershipsError.message);
    }

    const memberOrgIds = new Set((currentMemberships ?? []).map((membership) => membership.org_id as string));

    const { data, error } = await supabase
      .from("org_invitations")
      .select("id,org_id,org_name,role,expires_at,created_at")
      .eq("status", "pending")
      .gt("expires_at", nowIso)
      .order("created_at", { ascending: false });

    if (error) {
      throw new ApiError(500, "Failed to load pending invitations.", error.message);
    }

    const mapped = ((data ?? []) as PendingInvitationRow[])
      .filter((invitation) => !memberOrgIds.has(invitation.org_id))
      .map((invitation) => ({
        id: invitation.id,
        org_id: invitation.org_id,
        role: invitation.role,
        expires_at: invitation.expires_at,
        created_at: invitation.created_at,
        organization_name: invitation.org_name
      }));

    return NextResponse.json({ data: mapped });
  } catch (error) {
    return handleApiError(error);
  }
}

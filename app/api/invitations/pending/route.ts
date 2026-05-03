import { NextRequest, NextResponse } from "next/server";
import { ApiError, handleApiError } from "@/lib/api/errors";
import { extractBearerToken, requireAuthenticatedUserId } from "@/lib/api/auth";
import { getSupabaseUserClient } from "@/lib/supabase-user";

type PendingInvitationRow = {
  id: string;
  org_id: string;
  org_name: string;
  email: string;
  role: "owner" | "manager" | "member" | "viewer";
  status: string;
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
      .select("org_id,role")
      .eq("user_id", userId);

    if (membershipsError) {
      throw new ApiError(500, "Failed to load current memberships.", membershipsError.message);
    }

    const memberOrgIds = new Set((currentMemberships ?? []).map((membership) => membership.org_id as string));
    const ownerOrgIds = new Set(
      (currentMemberships ?? [])
        .filter((membership) => membership.role === "owner")
        .map((membership) => membership.org_id as string)
    );

    const { data, error } = await supabase
      .from("org_invitations")
      .select("id,org_id,org_name,email,role,status,expires_at,created_at")
      .eq("status", "pending")
      .gt("expires_at", nowIso)
      .order("created_at", { ascending: false });

    if (error) {
      throw new ApiError(500, "Failed to load pending invitations.", error.message);
    }

    const mapped = ((data ?? []) as PendingInvitationRow[])
      .map((invitation) => {
        const isExistingMemberOrg = memberOrgIds.has(invitation.org_id);
        const direction = isExistingMemberOrg && ownerOrgIds.has(invitation.org_id) ? "sent" : "received";

        return {
          invitation,
          direction,
          shouldShow: direction === "sent" || !isExistingMemberOrg
        };
      })
      .filter((item) => item.shouldShow)
      .map((invitation) => ({
        id: invitation.invitation.id,
        org_id: invitation.invitation.org_id,
        direction: invitation.direction,
        email: invitation.invitation.email,
        role: invitation.invitation.role,
        status: invitation.invitation.status,
        expires_at: invitation.invitation.expires_at,
        created_at: invitation.invitation.created_at,
        organization_name: invitation.invitation.org_name
      }));

    return NextResponse.json({ data: mapped });
  } catch (error) {
    return handleApiError(error);
  }
}

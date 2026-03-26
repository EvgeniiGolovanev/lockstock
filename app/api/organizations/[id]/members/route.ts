import { NextRequest, NextResponse } from "next/server";
import { ApiError, handleApiError } from "@/lib/api/errors";
import { generateInvitationToken, hashInvitationToken } from "@/lib/api/invitations";
import { sendTransactionalEmail } from "@/lib/api/mailer";
import { requireExactRole, requireRequestContext } from "@/lib/api/route-context";
import { createOrganizationMemberSchema } from "@/lib/validators/member";

const INVITATION_EXPIRY_DAYS = 7;

function requireMatchingOrgId(pathOrgId: string, contextOrgId: string) {
  if (pathOrgId !== contextOrgId) {
    throw new ApiError(400, "Path organization id must match x-org-id header.");
  }
}

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: orgIdFromPath } = await context.params;
    const { orgId, role, supabase } = await requireRequestContext(request);
    requireMatchingOrgId(orgIdFromPath, orgId);
    requireExactRole(role, "owner");

    const { data, error } = await supabase
      .from("org_users")
      .select("user_id,role,created_at")
      .eq("org_id", orgId)
      .order("created_at", { ascending: true });

    if (error) {
      throw new ApiError(500, "Failed to load organization members.", error.message);
    }

    return NextResponse.json({ data });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: orgIdFromPath } = await context.params;
    const { orgId, userId, role, supabase } = await requireRequestContext(request);
    requireMatchingOrgId(orgIdFromPath, orgId);
    requireExactRole(role, "owner");

    const payload = createOrganizationMemberSchema.parse(await request.json());

    const normalizedEmail = payload.email.trim().toLowerCase();
    const { data: authUserData, error: authUserError } = await supabase.auth.getUser();
    if (authUserError) {
      throw new ApiError(401, "Invalid or expired access token.");
    }
    const callerEmail = authUserData.user?.email?.toLowerCase().trim();
    if (callerEmail && callerEmail === normalizedEmail) {
      throw new ApiError(400, "Cannot invite your own account to this organization.");
    }

    const { data: orgData, error: orgError } = await supabase
      .from("organizations")
      .select("name")
      .eq("id", orgId)
      .maybeSingle();

    if (orgError) {
      throw new ApiError(500, "Failed to load organization.", orgError.message);
    }

    const orgName = (orgData?.name as string | undefined) ?? "LockStock organization";
    const expiresAt = new Date(Date.now() + INVITATION_EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString();

    const { error: supersedeError } = await supabase
      .from("org_invitations")
      .update({ status: "superseded" })
      .eq("org_id", orgId)
      .eq("email", normalizedEmail)
      .eq("status", "pending");

    if (supersedeError) {
      throw new ApiError(500, "Failed to replace existing invitation.", supersedeError.message);
    }

    const tokenHash = hashInvitationToken(generateInvitationToken());

    const { data: invitation, error: invitationError } = await supabase
      .from("org_invitations")
      .insert({
        org_id: orgId,
        org_name: orgName,
        email: normalizedEmail,
        role: "member",
        invited_by: userId,
        token_hash: tokenHash,
        status: "pending",
        expires_at: expiresAt
      })
      .select("id,email,status,expires_at")
      .single();

    if (invitationError) {
      throw new ApiError(500, "Failed to create invitation.", invitationError.message);
    }

    const membersPageUrl = `${request.nextUrl.origin}/members`;
    let email_delivery: "sent" | "skipped" | "failed" = "sent";
    let email_delivery_message: string | null = null;

    try {
      await sendTransactionalEmail({
        to: invitation.email as string,
        subject: `Invitation to join ${orgName}`,
        text: `You were invited to join "${orgName}" in LockStock. Sign in and review invitations here: ${membersPageUrl}`,
        html: `<p>You were invited to join <strong>${orgName}</strong> in LockStock.</p><p>Sign in and manage invitations from your Members screen:</p><p><a href="${membersPageUrl}">${membersPageUrl}</a></p>`
      });
    } catch (error) {
      const message = (error as Error).message || "Email delivery failed.";
      if (message.includes("Missing required environment variable")) {
        email_delivery = "skipped";
        email_delivery_message = "Email delivery skipped: email provider is not configured.";
      } else {
        email_delivery = "failed";
        email_delivery_message = message;
      }
      console.error("Invitation email delivery issue:", message);
    }

    return NextResponse.json(
      {
        data: {
          mode: "invited",
          id: invitation.id,
          email: invitation.email,
          status: invitation.status,
          expires_at: invitation.expires_at,
          expires_in_days: INVITATION_EXPIRY_DAYS,
          email_delivery,
          email_delivery_message
        }
      },
      { status: 201 }
    );
  } catch (error) {
    return handleApiError(error);
  }
}

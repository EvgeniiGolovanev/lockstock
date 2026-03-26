import { NextRequest, NextResponse } from "next/server";
import { ApiError, handleApiError } from "@/lib/api/errors";
import { extractBearerToken, requireAuthenticatedUserId } from "@/lib/api/auth";
import { getSupabaseUserClient } from "@/lib/supabase-user";
import { invitationIdParamSchema } from "@/lib/validators/member";

type RejectedInvitationRow = {
  id: string;
  org_id: string;
  org_name: string;
  status: "revoked";
};

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const token = extractBearerToken(request);
    if (!token) {
      return NextResponse.json({ error: "Missing Authorization Bearer token." }, { status: 401 });
    }

    const userId = await requireAuthenticatedUserId(request);
    const { id } = invitationIdParamSchema.parse(await context.params);
    const supabase = getSupabaseUserClient(token);
    void userId;
    const { data, error } = await supabase.rpc("reject_org_invitation", {
      p_invitation_id: id
    });

    if (error) {
      if (error.message.includes("Pending invitation not found")) {
        throw new ApiError(404, "Pending invitation not found.");
      }
      throw new ApiError(500, "Failed to reject invitation.", error.message);
    }

    const typedInvitation = (Array.isArray(data) ? data[0] : data) as RejectedInvitationRow | null;
    if (!typedInvitation) {
      throw new ApiError(500, "Failed to reject invitation.");
    }

    return NextResponse.json({
      data: {
        invitation_id: typedInvitation.id,
        org_id: typedInvitation.org_id,
        organization_name: typedInvitation.org_name,
        status: typedInvitation.status
      }
    });
  } catch (error) {
    return handleApiError(error);
  }
}

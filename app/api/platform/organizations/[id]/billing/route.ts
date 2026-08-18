import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ApiError, handleApiError } from "@/lib/api/errors";
import { logPlatformAccess, requirePlatformAdmin, requirePlatformMinRole } from "@/lib/api/platform-admin";

const updateTrialSchema = z.object({
  trialEndsAt: z.string().datetime({ offset: true })
});

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await requirePlatformAdmin(request);
    requirePlatformMinRole(context.role, "admin");
    const { id } = await params;
    const payload = updateTrialSchema.parse(await request.json());

    const { data, error } = await context.supabase
      .from("organization_billing")
      .update({ trial_ends_at: payload.trialEndsAt })
      .eq("org_id", id)
      .select("org_id,trial_ends_at")
      .maybeSingle();

    if (error) throw new ApiError(500, "Failed to update trial end date.", error.message);
    if (!data) throw new ApiError(404, "Organization billing record not found.");

    await logPlatformAccess(context, "platform.billing.trial_updated", {
      orgId: id,
      trialEndsAt: payload.trialEndsAt
    });

    return NextResponse.json({ data });
  } catch (error) {
    return handleApiError(error);
  }
}

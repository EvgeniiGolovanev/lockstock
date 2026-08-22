import { NextRequest, NextResponse } from "next/server";
import { ApiError, handleApiError } from "@/lib/api/errors";
import { ensureOwnedOrganization } from "@/lib/billing/ownership";
import { loadBillingRow } from "@/lib/billing/records";
import { getSupabaseServiceClient } from "@/lib/supabase-service";
import { consumePublicRateLimit, getRateLimitSubject } from "@/lib/api/public-rate-limit";
import { requireAuthenticatedUserId } from "@/lib/api/auth";

export async function POST(request: NextRequest) {
  try {
    const userId = await requireAuthenticatedUserId(request);
    const rateLimit = await consumePublicRateLimit("billing_trial", getRateLimitSubject(request, userId));
    if (!rateLimit.allowed) {
      throw new ApiError(429, "Too many trial requests. Please try again later.", {
        retryAfterSeconds: rateLimit.retryAfterSeconds
      });
    }
    const { orgId, created } = await ensureOwnedOrganization(request, "starter", true);
    const supabase = getSupabaseServiceClient();
    let trialEndsAt: string | null = null;
    if (created) {
      trialEndsAt = (await loadBillingRow(orgId, supabase)).trial_ends_at;
    }
    if (!created) {
      const { data, error } = await supabase.rpc("start_workspace_trial", { p_org_id: orgId }).single();
      if (error) {
        if (error.message === "Trial already redeemed" || error.message === "This workspace cannot start a trial") {
          throw new ApiError(409, error.message === "Trial already redeemed" ? "The free trial has already been used." : error.message);
        }
        throw new ApiError(500, "Failed to start trial.", error.message);
      }
      trialEndsAt = data.trial_ends_at;
    }
    return NextResponse.json({ data: { orgId, trialEndsAt } }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

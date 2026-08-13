import { NextRequest, NextResponse } from "next/server";
import { ApiError, handleApiError } from "@/lib/api/errors";
import { ensureOwnedOrganization } from "@/lib/billing/ownership";
import { loadBillingRow } from "@/lib/billing/records";
import { getSupabaseServiceClient } from "@/lib/supabase-service";

export async function POST(request: NextRequest) {
  try {
    const { orgId, created } = await ensureOwnedOrganization(request, "starter", true);
    const supabase = getSupabaseServiceClient();
    const billing = await loadBillingRow(orgId, supabase);
    let trialEndsAt = billing.trial_ends_at;
    if (!created) {
      if (billing.stripe_subscription_id || billing.status === "active") throw new ApiError(409, "This workspace already has a paid subscription.");
      if (billing.trial_ends_at) throw new ApiError(409, "The free trial has already been used.");
      trialEndsAt = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString();
      const { error } = await supabase.from("organization_billing").update({
        plan: "starter", status: "trialing", billing_interval: "monthly", trial_ends_at: trialEndsAt,
        past_due_since: null, scheduled_plan: null, scheduled_interval: null, scheduled_effective_at: null
      }).eq("org_id", orgId);
      if (error) throw new ApiError(500, "Failed to start trial.", error.message);
    }
    return NextResponse.json({ data: { orgId, trialEndsAt } }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

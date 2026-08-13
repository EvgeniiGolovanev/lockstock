import { ApiError } from "@/lib/api/errors";
import { getSupabaseServiceClient } from "@/lib/supabase-service";
import { resolveEntitlements, type BillingPlan, type BillingStatus } from "@/lib/billing/entitlements";

type BillingRow = {
  plan: BillingPlan;
  status: BillingStatus;
  trial_ends_at: string | null;
  current_period_end: string | null;
  past_due_since?: string | null;
};

export async function getOrganizationEntitlements(orgId: string) {
  const { data, error } = await getSupabaseServiceClient()
    .from("organization_billing")
    .select("plan,status,trial_ends_at,current_period_end,past_due_since")
    .eq("org_id", orgId)
    .maybeSingle();

  if (error) {
    throw new ApiError(500, "Failed to load organization billing.", error.message);
  }

  const row = data as BillingRow | null;
  return resolveEntitlements(
    row
      ? { plan: row.plan, status: row.status, trialEndsAt: row.trial_ends_at, currentPeriodEnd: row.current_period_end, pastDueSince: row.past_due_since }
      : null
  );
}

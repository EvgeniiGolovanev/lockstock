import { ApiError } from "@/lib/api/errors";
import { getSupabaseServiceClient } from "@/lib/supabase-service";
import { resolveEntitlements } from "@/lib/billing/entitlements";
import type { OrganizationBillingRow } from "@/lib/billing/records";

export async function getOrganizationEntitlements(orgId: string) {
  const { data, error } = await getSupabaseServiceClient()
    .from("organization_billing")
    .select("*")
    .eq("org_id", orgId)
    .maybeSingle();

  if (error) {
    throw new ApiError(500, "Failed to load organization billing.", error.message);
  }

  const row: OrganizationBillingRow | null = data;
  return resolveEntitlements(
    row
      ? { plan: row.plan, status: row.status, trialEndsAt: row.trial_ends_at, currentPeriodEnd: row.current_period_end, pastDueSince: row.past_due_since }
      : null
  );
}

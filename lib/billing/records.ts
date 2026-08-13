import { ApiError } from "@/lib/api/errors";
import type { BillingInterval } from "@/lib/billing/catalog";
import type { BillingPlan, BillingStatus } from "@/lib/billing/entitlements";
import { getSupabaseServiceClient } from "@/lib/supabase-service";

export type OrganizationBillingRow = {
  org_id: string;
  plan: BillingPlan;
  status: BillingStatus;
  billing_interval: BillingInterval | "custom";
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_subscription_item_id: string | null;
  stripe_checkout_session_id: string | null;
  stripe_subscription_schedule_id: string | null;
  trial_ends_at: string | null;
  current_period_end: string | null;
  past_due_since: string | null;
  cancel_at_period_end: boolean;
  scheduled_plan: BillingPlan | null;
  scheduled_interval: BillingInterval | "custom" | null;
  scheduled_effective_at: string | null;
  last_stripe_event_created_at: string | null;
  last_stripe_event_id: string | null;
};

export const billingColumns = [
  "org_id", "plan", "status", "billing_interval", "stripe_customer_id", "stripe_subscription_id",
  "stripe_subscription_item_id", "stripe_checkout_session_id", "stripe_subscription_schedule_id", "trial_ends_at", "current_period_end",
  "past_due_since", "cancel_at_period_end", "scheduled_plan", "scheduled_interval", "scheduled_effective_at",
  "last_stripe_event_created_at", "last_stripe_event_id"
].join(",");

export async function loadBillingRow(orgId: string, supabase = getSupabaseServiceClient()) {
  const { data, error } = await supabase.from("organization_billing").select(billingColumns).eq("org_id", orgId).maybeSingle();
  if (error) throw new ApiError(500, "Failed to load organization billing.", error.message);
  if (!data) throw new ApiError(404, "Organization billing record not found.");
  return data as unknown as OrganizationBillingRow;
}

import { NextRequest, NextResponse } from "next/server";
import { ApiError, handleApiError } from "@/lib/api/errors";
import { requireBillingOwner } from "@/lib/billing/ownership";
import { loadBillingRow } from "@/lib/billing/records";
import { getStripeClient } from "@/lib/billing/stripe";

export async function POST(request: NextRequest) {
  try {
    const context = await requireBillingOwner(request);
    const billing = await loadBillingRow(context.orgId, context.supabase);
    if (!billing.stripe_subscription_id) throw new ApiError(409, "No paid subscription exists.");
    const stripe = getStripeClient();
    if (billing.stripe_subscription_schedule_id) {
      await stripe.subscriptionSchedules.release(billing.stripe_subscription_schedule_id);
      await context.supabase.from("organization_billing").update({
        stripe_subscription_schedule_id: null,
        scheduled_plan: null,
        scheduled_interval: null,
        scheduled_effective_at: null
      }).eq("org_id", context.orgId);
    }
    const subscription = await stripe.subscriptions.update(billing.stripe_subscription_id, { cancel_at_period_end: true });
    return NextResponse.json({ data: { cancelAtPeriodEnd: subscription.cancel_at_period_end } });
  } catch (error) { return handleApiError(error); }
}

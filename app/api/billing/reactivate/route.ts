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
    const subscription = await getStripeClient().subscriptions.update(billing.stripe_subscription_id, { cancel_at_period_end: false });
    return NextResponse.json({ data: { cancelAtPeriodEnd: subscription.cancel_at_period_end } });
  } catch (error) { return handleApiError(error); }
}

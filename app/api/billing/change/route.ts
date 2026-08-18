import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ApiError, handleApiError } from "@/lib/api/errors";
import { requireBillingOwner } from "@/lib/billing/ownership";
import { loadBillingRow } from "@/lib/billing/records";
import { applyImmediateChange, hostedInvoiceUrl, retrieveSubscription, schedulePlanChange, selectionFromSubscription } from "@/lib/billing/subscription-service";
import { classifyPlanChange } from "@/lib/billing/transitions";
import { getStripeClient } from "@/lib/billing/stripe";

const schema = z.object({
  plan: z.enum(["starter", "operations", "business"]),
  interval: z.enum(["monthly", "annual"]),
  prorationDate: z.number().int().positive().optional()
});

export async function POST(request: NextRequest) {
  try {
    const context = await requireBillingOwner(request);
    const target = schema.parse(await request.json());
    const billing = await loadBillingRow(context.orgId, context.supabase);
    if (!billing.stripe_subscription_id || !billing.stripe_customer_id) throw new ApiError(409, "No paid subscription exists.");
    const subscription = await retrieveSubscription(billing);
    const current = selectionFromSubscription(subscription);
    const transition = classifyPlanChange(current.plan, current.interval, target.plan, target.interval);
    const effectiveAt = new Date(subscription.items.data[0].current_period_end * 1000).toISOString();

    if (transition.mode === "scheduled") {
      const schedule = await schedulePlanChange(subscription, target.plan, target.interval);
      await context.supabase.from("organization_billing").update({
        stripe_subscription_schedule_id: schedule.id,
        scheduled_plan: target.plan,
        scheduled_interval: target.interval,
        scheduled_effective_at: effectiveAt
      }).eq("org_id", context.orgId);
      return NextResponse.json({ data: { mode: "scheduled", effectiveAt } });
    }

    if (billing.stripe_subscription_schedule_id) {
      await getStripeClient().subscriptionSchedules.release(billing.stripe_subscription_schedule_id);
      await context.supabase.from("organization_billing").update({
        stripe_subscription_schedule_id: null,
        scheduled_plan: null,
        scheduled_interval: null,
        scheduled_effective_at: null
      }).eq("org_id", context.orgId);
    }
    const immediate = transition.immediate!;
    const updated = await applyImmediateChange(subscription, immediate.plan, immediate.interval, target.prorationDate ?? Math.floor(Date.now() / 1000));
    if (transition.scheduled) {
      await context.supabase.from("organization_billing").update({
        scheduled_plan: transition.scheduled.plan,
        scheduled_interval: transition.scheduled.interval,
        scheduled_effective_at: effectiveAt
      }).eq("org_id", context.orgId);
    }
    return NextResponse.json({ data: { mode: transition.mode, paymentUrl: hostedInvoiceUrl(updated), effectiveAt: "after_payment" } });
  } catch (error) { return handleApiError(error); }
}

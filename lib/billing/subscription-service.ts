import Stripe from "stripe";
import { ApiError } from "@/lib/api/errors";
import { type BillingInterval, type PaidPlan } from "@/lib/billing/catalog";
import { priceIdForSelection, selectionForPriceId } from "@/lib/billing/price-ids";
import { classifyPlanChange } from "@/lib/billing/transitions";
import { getStripeClient } from "@/lib/billing/stripe";
import type { OrganizationBillingRow } from "@/lib/billing/records";

function subscriptionItem(subscription: Stripe.Subscription) {
  const item = subscription.items.data[0];
  if (!item) throw new ApiError(409, "Stripe subscription has no billable item.");
  return item;
}

export function selectionFromSubscription(subscription: Stripe.Subscription) {
  const price = subscriptionItem(subscription).price;
  const selection = selectionForPriceId(price.id);
  if (!selection) throw new ApiError(500, "Stripe subscription uses an unknown Price ID.");
  return selection;
}

export async function retrieveSubscription(billing: OrganizationBillingRow) {
  if (!billing.stripe_subscription_id) throw new ApiError(409, "No paid subscription exists for this workspace.");
  return getStripeClient().subscriptions.retrieve(billing.stripe_subscription_id, { expand: ["latest_invoice"] });
}

export async function previewPlanChange(billing: OrganizationBillingRow, targetPlan: PaidPlan, targetInterval: BillingInterval) {
  const subscription = await retrieveSubscription(billing);
  const current = selectionFromSubscription(subscription);
  const transition = classifyPlanChange(current.plan, current.interval, targetPlan, targetInterval);
  if (transition.mode === "scheduled") {
    return { transition, amountDue: 0, currency: "eur", effectiveAt: new Date(subscriptionItem(subscription).current_period_end * 1000).toISOString() };
  }
  const immediate = transition.immediate!;
  const prorationDate = Math.floor(Date.now() / 1000);
  const preview = await getStripeClient().invoices.createPreview({
    customer: billing.stripe_customer_id ?? undefined,
    subscription: subscription.id,
    subscription_details: {
      items: [{ id: subscriptionItem(subscription).id, price: priceIdForSelection(immediate.plan, immediate.interval) }],
      proration_date: prorationDate
    }
  });
  return { transition, amountDue: preview.amount_due, currency: preview.currency, prorationDate, effectiveAt: new Date().toISOString() };
}

export async function applyImmediateChange(
  subscription: Stripe.Subscription,
  plan: PaidPlan,
  interval: BillingInterval,
  prorationDate: number
) {
  return getStripeClient().subscriptions.update(subscription.id, {
    items: [{ id: subscriptionItem(subscription).id, price: priceIdForSelection(plan, interval) }],
    payment_behavior: "pending_if_incomplete",
    proration_behavior: "always_invoice",
    proration_date: prorationDate,
    expand: ["latest_invoice"],
    ...(subscriptionItem(subscription).price.recurring?.interval !== (interval === "annual" ? "year" : "month")
      ? { billing_cycle_anchor: "now" as const }
      : {})
  });
}

export async function schedulePlanChange(subscription: Stripe.Subscription, plan: PaidPlan, interval: BillingInterval) {
  const stripe = getStripeClient();
  const item = subscriptionItem(subscription);
  const existingScheduleId = typeof subscription.schedule === "string" ? subscription.schedule : subscription.schedule?.id;
  const schedule = existingScheduleId
    ? await stripe.subscriptionSchedules.retrieve(existingScheduleId)
    : await stripe.subscriptionSchedules.create({ from_subscription: subscription.id });
  if (!schedule.current_phase) throw new ApiError(409, "Stripe subscription schedule has no current phase.");
  return stripe.subscriptionSchedules.update(schedule.id, {
    end_behavior: "release",
    phases: [
      {
        start_date: schedule.current_phase.start_date,
        end_date: schedule.current_phase.end_date,
        items: [{ price: item.price.id, quantity: item.quantity ?? 1 }],
        proration_behavior: "none"
      },
      {
        start_date: schedule.current_phase.end_date,
        duration: { interval: interval === "annual" ? "year" : "month", interval_count: 1 },
        items: [{ price: priceIdForSelection(plan, interval), quantity: 1 }],
        proration_behavior: "none"
      }
    ]
  });
}

export function hostedInvoiceUrl(subscription: Stripe.Subscription) {
  const invoice = typeof subscription.latest_invoice === "object" ? subscription.latest_invoice : null;
  return invoice && !invoice.deleted ? invoice.hosted_invoice_url : null;
}

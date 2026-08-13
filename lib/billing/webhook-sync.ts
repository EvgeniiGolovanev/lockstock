import Stripe from "stripe";
import { getSupabaseServiceClient } from "@/lib/supabase-service";
import { selectionForPriceId } from "@/lib/billing/price-ids";
import type { BillingStatus } from "@/lib/billing/entitlements";
import { schedulePlanChange } from "@/lib/billing/subscription-service";
import { getStripeClient } from "@/lib/billing/stripe";
import { billingColumns, type OrganizationBillingRow } from "@/lib/billing/records";

const supportedStatuses = new Set<BillingStatus>([
  "trialing", "active", "past_due", "cancelled", "unpaid", "incomplete", "incomplete_expired", "paused"
]);

function localStatus(status: Stripe.Subscription.Status): BillingStatus {
  if (status === "canceled") return "cancelled";
  return supportedStatuses.has(status as BillingStatus) ? status as BillingStatus : "unpaid";
}

export function subscriptionIdFromEventObject(object: unknown): string | null {
  if (!object || typeof object !== "object") return null;
  const value = object as Record<string, unknown>;
  if (value.object === "subscription" && typeof value.id === "string") return value.id;
  if (typeof value.subscription === "string") return value.subscription;
  if (value.subscription && typeof value.subscription === "object" && typeof (value.subscription as Record<string, unknown>).id === "string") {
    return (value.subscription as Record<string, unknown>).id as string;
  }
  const parent = value.parent as Record<string, unknown> | undefined;
  const details = parent?.subscription_details as Record<string, unknown> | undefined;
  const nested = details?.subscription;
  if (typeof nested === "string") return nested;
  if (nested && typeof nested === "object" && typeof (nested as Record<string, unknown>).id === "string") {
    return (nested as Record<string, unknown>).id as string;
  }
  return null;
}

async function billingBySubscription(subscriptionId: string) {
  const supabase = getSupabaseServiceClient();
  const { data } = await supabase.from("organization_billing").select(billingColumns)
    .eq("stripe_subscription_id", subscriptionId).maybeSingle();
  return data as unknown as OrganizationBillingRow | null;
}

export async function syncStripeSubscription(subscriptionId: string, eventCreated: number) {
  const stripe = getStripeClient();
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const item = subscription.items.data[0];
  if (!item) return;
  const selection = selectionForPriceId(item.price.id);
  if (!selection) return;
  const billing = await billingBySubscription(subscription.id);
  if (!billing) return;
  const eventTime = new Date(eventCreated * 1000);
  if (billing.last_stripe_event_created_at && new Date(billing.last_stripe_event_created_at) > eventTime) return;
  const status = localStatus(subscription.status);
  const supabase = getSupabaseServiceClient();
  const update = {
    plan: selection.plan,
    billing_interval: selection.interval,
    status,
    stripe_customer_id: typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id,
    stripe_subscription_item_id: item.id,
    current_period_end: new Date(item.current_period_end * 1000).toISOString().slice(0, 10),
    cancel_at_period_end: subscription.cancel_at_period_end,
    past_due_since: status === "active" ? null : billing.past_due_since,
    last_stripe_event_created_at: eventTime.toISOString(),
    ...(billing.scheduled_plan === selection.plan && billing.scheduled_interval === selection.interval ? {
      scheduled_plan: null,
      scheduled_interval: null,
      scheduled_effective_at: null
    } : {})
  };
  await supabase.from("organization_billing").update(update).eq("org_id", billing.org_id);

  if (billing.scheduled_plan && billing.scheduled_interval && !billing.stripe_subscription_schedule_id
    && billing.scheduled_plan === selection.plan && billing.scheduled_interval !== selection.interval) {
    const schedule = await schedulePlanChange(subscription, billing.scheduled_plan, billing.scheduled_interval as "monthly" | "annual");
    await supabase.from("organization_billing").update({ stripe_subscription_schedule_id: schedule.id }).eq("org_id", billing.org_id);
  }
}

export async function bindCheckoutSession(session: Stripe.Checkout.Session, eventCreated: number) {
  const orgId = session.metadata?.org_id || session.client_reference_id;
  const subscriptionId = typeof session.subscription === "string" ? session.subscription : session.subscription?.id;
  if (!orgId || !subscriptionId) return;
  const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id ?? null;
  await getSupabaseServiceClient().from("organization_billing").update({
    stripe_customer_id: customerId,
    stripe_subscription_id: subscriptionId,
    stripe_checkout_session_id: null
  }).eq("org_id", orgId);
  await syncStripeSubscription(subscriptionId, eventCreated);
}

export async function markInvoiceFailed(subscriptionId: string, eventCreated: number) {
  await syncStripeSubscription(subscriptionId, eventCreated);
  const billing = await billingBySubscription(subscriptionId);
  if (!billing) return;
  await getSupabaseServiceClient().from("organization_billing").update({
    status: "past_due",
    past_due_since: billing.past_due_since ?? new Date(eventCreated * 1000).toISOString()
  }).eq("org_id", billing.org_id);
}

export async function markSubscriptionDeleted(subscription: Stripe.Subscription, eventCreated: number) {
  await getSupabaseServiceClient().from("organization_billing").update({
    status: "cancelled",
    cancel_at_period_end: false,
    scheduled_plan: null,
    scheduled_interval: null,
    scheduled_effective_at: null,
    stripe_subscription_schedule_id: null,
    last_stripe_event_created_at: new Date(eventCreated * 1000).toISOString()
  }).eq("stripe_subscription_id", subscription.id);
}

export async function clearReleasedSchedule(schedule: Stripe.SubscriptionSchedule) {
  await getSupabaseServiceClient().from("organization_billing").update({
    stripe_subscription_schedule_id: null,
    scheduled_plan: null,
    scheduled_interval: null,
    scheduled_effective_at: null
  }).eq("stripe_subscription_schedule_id", schedule.id);
}

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

export function shouldApplyStripeEvent(
  billing: Pick<OrganizationBillingRow, "last_stripe_event_created_at" | "last_stripe_event_id">,
  eventCreated: number,
  eventId: string
) {
  if (!billing.last_stripe_event_created_at) return true;
  const currentCreatedAt = new Date(billing.last_stripe_event_created_at).getTime();
  if (Number.isNaN(currentCreatedAt)) return true;
  const incomingCreatedAt = eventCreated * 1000;
  if (currentCreatedAt < incomingCreatedAt) return true;
  if (currentCreatedAt > incomingCreatedAt) return false;
  return (billing.last_stripe_event_id ?? "") < eventId;
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
  const { data, error } = await supabase.from("organization_billing").select(billingColumns)
    .eq("stripe_subscription_id", subscriptionId).maybeSingle();
  if (error) throw error;
  return data as unknown as OrganizationBillingRow | null;
}

async function billingBySchedule(scheduleId: string) {
  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase.from("organization_billing").select(billingColumns)
    .eq("stripe_subscription_schedule_id", scheduleId).maybeSingle();
  if (error) throw error;
  return data as unknown as OrganizationBillingRow | null;
}

async function billingByOrg(orgId: string) {
  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase.from("organization_billing").select(billingColumns)
    .eq("org_id", orgId).maybeSingle();
  if (error) throw error;
  return data as unknown as OrganizationBillingRow | null;
}

function stripeEventTimestamp(eventCreated: number) {
  return new Date(eventCreated * 1000).toISOString();
}

function stripeEventUpdate(eventCreated: number, eventId: string) {
  return {
    last_stripe_event_created_at: stripeEventTimestamp(eventCreated),
    last_stripe_event_id: eventId
  };
}

function subscriptionCustomerId(subscription: Stripe.Subscription) {
  return typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
}

function logUnknownPrice(eventType: string, eventId: string, eventCreated: number, subscriptionId: string, priceId: string) {
  console.error("Stripe webhook encountered unknown price id", JSON.stringify({
    kind: "stripe_webhook_unknown_price",
    eventType,
    eventId,
    eventCreated,
    subscriptionId,
    priceId
  }));
}

function buildSubscriptionUpdate(
  subscription: Stripe.Subscription,
  billing: OrganizationBillingRow,
  selection: NonNullable<ReturnType<typeof selectionForPriceId>>,
  eventCreated: number,
  eventId: string,
  overrides: Partial<Record<string, unknown>> = {}
) {
  const item = subscription.items.data[0];
  if (!item) throw new Error("Stripe subscription has no billable item.");
  const status = (overrides.status as BillingStatus | undefined) ?? localStatus(subscription.status);
  return {
    plan: selection.plan,
    billing_interval: selection.interval,
    status,
    stripe_customer_id: subscriptionCustomerId(subscription),
    stripe_subscription_item_id: item.id,
    current_period_end: new Date(item.current_period_end * 1000).toISOString().slice(0, 10),
    cancel_at_period_end: subscription.cancel_at_period_end,
    past_due_since: overrides.past_due_since ?? (status === "active" ? null : billing.past_due_since),
    ...stripeEventUpdate(eventCreated, eventId),
    ...(billing.scheduled_plan === selection.plan && billing.scheduled_interval === selection.interval ? {
      scheduled_plan: null,
      scheduled_interval: null,
      scheduled_effective_at: null
    } : {}),
    ...overrides
  };
}

async function persistBillingUpdate(orgId: string, update: Record<string, unknown>) {
  const supabase = getSupabaseServiceClient();
  const { error } = await supabase.from("organization_billing").update(update).eq("org_id", orgId);
  if (error) throw error;
}

export async function syncStripeSubscription(subscriptionId: string, eventCreated: number, eventId: string) {
  const billing = await billingBySubscription(subscriptionId);
  if (!billing) return;
  if (!shouldApplyStripeEvent(billing, eventCreated, eventId)) return;

  const stripe = getStripeClient();
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const item = subscription.items.data[0];
  if (!item) return;

  const selection = selectionForPriceId(item.price.id);
  if (!selection) {
    logUnknownPrice("syncStripeSubscription", eventId, eventCreated, subscriptionId, item.price.id);
    return;
  }

  const update = buildSubscriptionUpdate(subscription, billing, selection, eventCreated, eventId);
  await persistBillingUpdate(billing.org_id, update);

  if (billing.scheduled_plan && billing.scheduled_interval && !billing.stripe_subscription_schedule_id
    && billing.scheduled_plan === selection.plan && billing.scheduled_interval !== selection.interval) {
    const schedule = await schedulePlanChange(subscription, billing.scheduled_plan, billing.scheduled_interval as "monthly" | "annual");
    await persistBillingUpdate(billing.org_id, { stripe_subscription_schedule_id: schedule.id });
  }
}

export async function bindCheckoutSession(session: Stripe.Checkout.Session, eventCreated: number, eventId: string) {
  const orgId = session.metadata?.org_id || session.client_reference_id;
  const subscriptionId = typeof session.subscription === "string" ? session.subscription : session.subscription?.id;
  if (!orgId || !subscriptionId) return;

  const billing = await billingByOrg(orgId);
  if (!billing) return;
  if (!shouldApplyStripeEvent(billing, eventCreated, eventId)) return;

  const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id ?? null;
  await persistBillingUpdate(orgId, {
    stripe_customer_id: customerId,
    stripe_subscription_id: subscriptionId,
    stripe_checkout_session_id: null
  });

  await syncStripeSubscription(subscriptionId, eventCreated, eventId);
}

export async function markInvoiceFailed(subscriptionId: string, eventCreated: number, eventId: string) {
  const billing = await billingBySubscription(subscriptionId);
  if (!billing) return;
  if (!shouldApplyStripeEvent(billing, eventCreated, eventId)) return;

  const stripe = getStripeClient();
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const item = subscription.items.data[0];
  if (!item) return;

  const selection = selectionForPriceId(item.price.id);
  if (!selection) {
    logUnknownPrice("markInvoiceFailed", eventId, eventCreated, subscriptionId, item.price.id);
    return;
  }

  const update = buildSubscriptionUpdate(subscription, billing, selection, eventCreated, eventId, {
    status: "past_due",
    past_due_since: billing.past_due_since ?? stripeEventTimestamp(eventCreated)
  });
  await persistBillingUpdate(billing.org_id, update);
}

export async function markSubscriptionDeleted(subscription: Stripe.Subscription, eventCreated: number, eventId: string) {
  const billing = await billingBySubscription(subscription.id);
  if (!billing) return;
  if (!shouldApplyStripeEvent(billing, eventCreated, eventId)) return;

  await persistBillingUpdate(billing.org_id, {
    status: "cancelled",
    cancel_at_period_end: false,
    scheduled_plan: null,
    scheduled_interval: null,
    scheduled_effective_at: null,
    stripe_subscription_schedule_id: null,
    ...stripeEventUpdate(eventCreated, eventId)
  });
}

export async function clearReleasedSchedule(schedule: Stripe.SubscriptionSchedule, eventCreated: number, eventId: string) {
  const billing = await billingBySchedule(schedule.id);
  if (!billing) return;
  if (!shouldApplyStripeEvent(billing, eventCreated, eventId)) return;

  await persistBillingUpdate(billing.org_id, {
    stripe_subscription_schedule_id: null,
    scheduled_plan: null,
    scheduled_interval: null,
    scheduled_effective_at: null,
    ...stripeEventUpdate(eventCreated, eventId)
  });
}

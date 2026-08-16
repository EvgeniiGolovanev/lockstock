import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createCorrelationId } from "@/lib/api/correlation-id";
import { getStripeClient } from "@/lib/billing/stripe";
import { bindCheckoutSession, clearReleasedSchedule, markInvoiceFailed, markSubscriptionDeleted, subscriptionIdFromEventObject, syncStripeSubscription } from "@/lib/billing/webhook-sync";
import { claimStripeWebhookEvent, completeStripeWebhookEvent, failStripeWebhookEvent } from "@/lib/billing/webhook-ledger";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const signature = request.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!signature || !secret) return NextResponse.json({ error: "Stripe webhook is not configured." }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = getStripeClient().webhooks.constructEvent(await request.text(), signature, secret);
  } catch {
    return NextResponse.json({ error: "Invalid Stripe webhook signature." }, { status: 400 });
  }

  let ledger;
  try {
    ledger = await claimStripeWebhookEvent(event);
  } catch (error) {
    console.error("Stripe webhook claim failed", error);
    return NextResponse.json({ error: "Failed to record Stripe event." }, { status: 500 });
  }
  if (!ledger.claimed && ledger.status === "processed") return NextResponse.json({ received: true, duplicate: true });
  if (!ledger.claimed && ledger.status === "processing") {
    return NextResponse.json({ error: "Stripe webhook is already being processed." }, { status: 409 });
  }

  try {
    if (event.type === "checkout.session.completed") {
      await bindCheckoutSession(event.data.object, event.created, event.id);
    } else if (event.type === "customer.subscription.deleted") {
      await markSubscriptionDeleted(event.data.object, event.created, event.id);
    } else if (event.type === "invoice.payment_failed") {
      const subscriptionId = subscriptionIdFromEventObject(event.data.object);
      if (subscriptionId) await markInvoiceFailed(subscriptionId, event.created, event.id);
    } else if (event.type === "subscription_schedule.released" || event.type === "subscription_schedule.canceled") {
      await clearReleasedSchedule(event.data.object, event.created, event.id);
      const subscriptionId = subscriptionIdFromEventObject(event.data.object);
      if (subscriptionId) await syncStripeSubscription(subscriptionId, event.created, event.id);
    } else if (
      event.type === "customer.subscription.created" ||
      event.type === "customer.subscription.updated" ||
      event.type === "customer.subscription.pending_update_applied" ||
      event.type === "customer.subscription.pending_update_expired" ||
      event.type === "invoice.paid" ||
      event.type === "subscription_schedule.updated" ||
      event.type === "subscription_schedule.completed"
    ) {
      const subscriptionId = subscriptionIdFromEventObject(event.data.object);
      if (subscriptionId) await syncStripeSubscription(subscriptionId, event.created, event.id);
    }
    await completeStripeWebhookEvent(event.id);
    return NextResponse.json({ received: true });
  } catch (error) {
    const requestId = createCorrelationId("req");
    const failure = error as Error & { code?: string };
    try {
      await failStripeWebhookEvent(event.id, failure.code ?? "processing_failed", failure.message || "Stripe webhook processing failed");
    } catch (ledgerError) {
      console.error("Stripe webhook failure ledger update failed", { requestId, ledgerError });
    }
    console.error("Stripe webhook processing failed", {
      requestId,
      eventId: event.id,
      eventType: event.type,
      attempt: ledger?.attempt_count ?? 0,
      errorCode: failure.code ?? "processing_failed",
      message: failure.message
    });
    return NextResponse.json({ error: "Stripe webhook processing failed." }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getStripeClient } from "@/lib/billing/stripe";
import { getSupabaseServiceClient } from "@/lib/supabase-service";
import { bindCheckoutSession, clearReleasedSchedule, markInvoiceFailed, markSubscriptionDeleted, subscriptionIdFromEventObject, syncStripeSubscription } from "@/lib/billing/webhook-sync";

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

  const supabase = getSupabaseServiceClient();
  const { error: eventError } = await supabase.from("stripe_webhook_events").insert({
    event_id: event.id,
    event_type: event.type,
    event_created_at: new Date(event.created * 1000).toISOString()
  });
  if (eventError?.code === "23505") return NextResponse.json({ received: true, duplicate: true });
  if (eventError) return NextResponse.json({ error: "Failed to record Stripe event." }, { status: 500 });

  try {
    if (event.type === "checkout.session.completed") {
      await bindCheckoutSession(event.data.object, event.created);
    } else if (event.type === "customer.subscription.deleted") {
      await markSubscriptionDeleted(event.data.object, event.created);
    } else if (event.type === "invoice.payment_failed") {
      const subscriptionId = subscriptionIdFromEventObject(event.data.object);
      if (subscriptionId) await markInvoiceFailed(subscriptionId, event.created);
    } else if (event.type === "subscription_schedule.released" || event.type === "subscription_schedule.canceled") {
      await clearReleasedSchedule(event.data.object);
      const subscriptionId = subscriptionIdFromEventObject(event.data.object);
      if (subscriptionId) await syncStripeSubscription(subscriptionId, event.created);
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
      if (subscriptionId) await syncStripeSubscription(subscriptionId, event.created);
    }
    return NextResponse.json({ received: true });
  } catch (error) {
    await supabase.from("stripe_webhook_events").delete().eq("event_id", event.id);
    console.error("Stripe webhook processing failed", error);
    return NextResponse.json({ error: "Stripe webhook processing failed." }, { status: 500 });
  }
}

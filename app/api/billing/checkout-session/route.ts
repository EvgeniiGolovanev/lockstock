import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ApiError, handleApiError } from "@/lib/api/errors";
import { ensureOwnedOrganization } from "@/lib/billing/ownership";
import { loadBillingRow } from "@/lib/billing/records";
import { priceIdForSelection } from "@/lib/billing/price-ids";
import { getStripeClient } from "@/lib/billing/stripe";
import { getSupabaseServiceClient } from "@/lib/supabase-service";
import { requireAuthenticatedUserId } from "@/lib/api/auth";

const schema = z.object({
  plan: z.enum(["starter", "operations", "business"]),
  interval: z.enum(["monthly", "annual"])
});

export async function POST(request: NextRequest) {
  try {
    const userId = await requireAuthenticatedUserId(request);
    const selection = schema.parse(await request.json());
    const { orgId } = await ensureOwnedOrganization(request, selection.plan, false);
    const supabase = getSupabaseServiceClient();
    const billing = await loadBillingRow(orgId, supabase);
    if (billing.stripe_subscription_id && ["active", "past_due"].includes(billing.status)) {
      throw new ApiError(409, "Use Change Plan for an existing subscription.");
    }

    const stripe = getStripeClient();
    if (billing.stripe_checkout_session_id) {
      const existingSession = await stripe.checkout.sessions.retrieve(billing.stripe_checkout_session_id);
      const sameSelection = existingSession.metadata?.plan === selection.plan && existingSession.metadata?.interval === selection.interval;
      if (existingSession.status === "open" && sameSelection && existingSession.url) {
        return NextResponse.json({ data: { url: existingSession.url, orgId } });
      }
      if (existingSession.status === "open") await stripe.checkout.sessions.expire(existingSession.id);
      const { error: releaseError } = await supabase.rpc("release_workspace_checkout_session", {
        p_org_id: orgId, p_stripe_checkout_session_id: existingSession.id
      });
      if (releaseError) throw new ApiError(500, "Failed to release the previous checkout session.", releaseError.message);
    }
    const { data: claim, error: claimError } = await supabase.rpc("claim_workspace_checkout", { p_org_id: orgId }).single();
    if (claimError) throw new ApiError(409, claimError.message);
    if (claim.state === "pending") throw new ApiError(409, "A checkout session is already being created. Please retry shortly.");
    if (claim.state === "existing" && claim.stripe_checkout_session_id) {
      const existingSession = await stripe.checkout.sessions.retrieve(claim.stripe_checkout_session_id);
      if (existingSession.status === "open" && existingSession.url) return NextResponse.json({ data: { url: existingSession.url, orgId } });
      throw new ApiError(409, "A previous checkout session is still being finalized. Please retry shortly.");
    }
    if (!claim.claim_token) throw new ApiError(500, "Failed to claim workspace checkout.");

    let customerId = claim.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create(
        { metadata: { org_id: orgId, owner_user_id: userId } },
        { idempotencyKey: `workspace-customer:${orgId}` }
      );
      customerId = customer.id;
    }

    const appUrl = (process.env.APP_URL || request.nextUrl.origin).replace(/\/$/, "");
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      client_reference_id: orgId,
      line_items: [{ price: priceIdForSelection(selection.plan, selection.interval), quantity: 1 }],
      automatic_tax: { enabled: true },
      billing_address_collection: "required",
      tax_id_collection: { enabled: true },
      success_url: `${appUrl}/payment?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/payment?checkout=cancelled`,
      metadata: { org_id: orgId, plan: selection.plan, interval: selection.interval },
      subscription_data: { metadata: { org_id: orgId, plan: selection.plan, interval: selection.interval } }
    }, { idempotencyKey: `subscription-checkout:${orgId}:${claim.claim_token}` });
    if (!session.url) throw new ApiError(502, "Stripe Checkout did not return a redirect URL.");
    const { error: sessionSaveError } = await supabase.rpc("complete_workspace_checkout_claim", {
      p_org_id: orgId, p_claim_token: claim.claim_token, p_stripe_customer_id: customerId,
      p_stripe_checkout_session_id: session.id
    });
    if (sessionSaveError) throw new ApiError(500, "Failed to save Stripe Checkout session.", sessionSaveError.message);
    return NextResponse.json({ data: { url: session.url, orgId } }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

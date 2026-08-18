import { NextRequest, NextResponse } from "next/server";
import { ApiError, handleApiError } from "@/lib/api/errors";
import { requireBillingOwner } from "@/lib/billing/ownership";
import { loadBillingRow } from "@/lib/billing/records";
import { getStripeClient } from "@/lib/billing/stripe";

export async function POST(request: NextRequest) {
  try {
    const context = await requireBillingOwner(request);
    const billing = await loadBillingRow(context.orgId, context.supabase);
    if (!billing.stripe_customer_id) throw new ApiError(409, "No Stripe customer exists for this workspace.");
    const configuration = process.env.STRIPE_PORTAL_CONFIGURATION_ID;
    if (!configuration) throw new ApiError(503, "Stripe Customer Portal is not configured.");
    const appUrl = (process.env.APP_URL || request.nextUrl.origin).replace(/\/$/, "");
    const session = await getStripeClient().billingPortal.sessions.create({
      customer: billing.stripe_customer_id,
      return_url: `${appUrl}/account`,
      configuration
    });
    return NextResponse.json({ data: { url: session.url } }, { status: 201 });
  } catch (error) { return handleApiError(error); }
}

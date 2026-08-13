import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/api/errors";
import { requireBillingOwner } from "@/lib/billing/ownership";
import { loadBillingRow } from "@/lib/billing/records";
import { resolveEntitlements } from "@/lib/billing/entitlements";
import { billingCatalog, annualSavings } from "@/lib/billing/catalog";

export async function GET(request: NextRequest) {
  try {
    const context = await requireBillingOwner(request);
    const billing = await loadBillingRow(context.orgId, context.supabase);
    const entitlements = resolveEntitlements({
      plan: billing.plan,
      status: billing.status,
      trialEndsAt: billing.trial_ends_at,
      currentPeriodEnd: billing.current_period_end,
      pastDueSince: billing.past_due_since
    });
    return NextResponse.json({
      data: {
        ...billing,
        entitlements,
        catalog: Object.fromEntries(Object.entries(billingCatalog).map(([plan, tariff]) => [
          plan, { ...tariff, savings: annualSavings(plan as keyof typeof billingCatalog) }
        ]))
      }
    });
  } catch (error) {
    return handleApiError(error);
  }
}

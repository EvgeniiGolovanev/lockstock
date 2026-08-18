import { ApiError } from "@/lib/api/errors";
import { billingIntervals, paidPlans, type BillingInterval, type PaidPlan } from "@/lib/billing/catalog";

const priceEnvironmentNames: Record<PaidPlan, Record<BillingInterval, string>> = {
  starter: { monthly: "STRIPE_PRICE_STARTER_MONTHLY", annual: "STRIPE_PRICE_STARTER_ANNUAL" },
  operations: { monthly: "STRIPE_PRICE_OPERATIONS_MONTHLY", annual: "STRIPE_PRICE_OPERATIONS_ANNUAL" },
  business: { monthly: "STRIPE_PRICE_BUSINESS_MONTHLY", annual: "STRIPE_PRICE_BUSINESS_ANNUAL" }
};

export function priceIdForSelection(plan: PaidPlan, interval: BillingInterval) {
  const environmentName = priceEnvironmentNames[plan][interval];
  const priceId = process.env[environmentName];
  if (!priceId) throw new ApiError(503, `Billing is not configured for ${plan} ${interval}.`);
  return priceId;
}

export function selectionForPriceId(priceId: string): { plan: PaidPlan; interval: BillingInterval } | null {
  for (const plan of paidPlans) {
    for (const interval of billingIntervals) {
      if (process.env[priceEnvironmentNames[plan][interval]] === priceId) return { plan, interval };
    }
  }
  return null;
}

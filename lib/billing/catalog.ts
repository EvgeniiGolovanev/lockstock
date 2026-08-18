import {
  BILLING_INTERVALS,
  PAID_PLANS,
  billingPlanContract,
  type BillingInterval,
  type PaidPlan
} from "@/lib/billing/plan-contract";

export { BILLING_INTERVALS as billingIntervals, PAID_PLANS as paidPlans, type BillingInterval, type PaidPlan };

export const billingCatalog: Record<PaidPlan, {
  monthly: number;
  annual: number;
  annualMonthlyEquivalent: number;
}> = Object.fromEntries(
  PAID_PLANS.map((plan) => [
    plan,
    {
      monthly: billingPlanContract[plan].pricing.monthly as number,
      annual: billingPlanContract[plan].pricing.annual as number,
      annualMonthlyEquivalent: billingPlanContract[plan].pricing.annualMonthlyEquivalent as number
    }
  ])
) as Record<PaidPlan, { monthly: number; annual: number; annualMonthlyEquivalent: number }>;

export function annualSavings(plan: PaidPlan) {
  const tariff = billingCatalog[plan];
  const amount = tariff.monthly * 12 - tariff.annual;
  return { amount, percentage: Math.round((amount / (tariff.monthly * 12)) * 100) };
}

export function isPaidPlan(value: unknown): value is PaidPlan {
  return typeof value === "string" && PAID_PLANS.includes(value as PaidPlan);
}

export function isBillingInterval(value: unknown): value is BillingInterval {
  return typeof value === "string" && BILLING_INTERVALS.includes(value as BillingInterval);
}

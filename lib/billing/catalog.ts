import type { BillingPlan } from "@/lib/billing/entitlements";

export type PaidPlan = Exclude<BillingPlan, "enterprise">;
export type BillingInterval = "monthly" | "annual";

export const paidPlans = ["starter", "operations", "business"] as const satisfies readonly PaidPlan[];
export const billingIntervals = ["monthly", "annual"] as const satisfies readonly BillingInterval[];

export const billingCatalog: Record<PaidPlan, {
  monthly: number;
  annual: number;
  annualMonthlyEquivalent: number;
}> = {
  starter: { monthly: 49, annual: 468, annualMonthlyEquivalent: 39 },
  operations: { monthly: 109, annual: 1068, annualMonthlyEquivalent: 89 },
  business: { monthly: 219, annual: 2148, annualMonthlyEquivalent: 179 }
};

export function annualSavings(plan: PaidPlan) {
  const tariff = billingCatalog[plan];
  const amount = tariff.monthly * 12 - tariff.annual;
  return { amount, percentage: Math.round((amount / (tariff.monthly * 12)) * 100) };
}

export function isPaidPlan(value: unknown): value is PaidPlan {
  return typeof value === "string" && paidPlans.includes(value as PaidPlan);
}

export function isBillingInterval(value: unknown): value is BillingInterval {
  return typeof value === "string" && billingIntervals.includes(value as BillingInterval);
}

import type { BillingInterval, PaidPlan } from "@/lib/billing/catalog";

const planRank: Record<PaidPlan, number> = { starter: 0, operations: 1, business: 2 };
type Selection = { plan: PaidPlan; interval: BillingInterval };

export type PlanChange = {
  mode: "immediate" | "scheduled" | "split";
  immediate: Selection | null;
  scheduled: Selection | null;
};

export function classifyPlanChange(
  currentPlan: PaidPlan,
  currentInterval: BillingInterval,
  targetPlan: PaidPlan,
  targetInterval: BillingInterval
): PlanChange {
  const tierDirection = planRank[targetPlan] - planRank[currentPlan];

  if (tierDirection < 0 || (tierDirection === 0 && currentInterval === "annual" && targetInterval === "monthly")) {
    return { mode: "scheduled", immediate: null, scheduled: { plan: targetPlan, interval: targetInterval } };
  }

  if (tierDirection > 0 && currentInterval === "annual" && targetInterval === "monthly") {
    return {
      mode: "split",
      immediate: { plan: targetPlan, interval: "annual" },
      scheduled: { plan: targetPlan, interval: "monthly" }
    };
  }

  return { mode: "immediate", immediate: { plan: targetPlan, interval: targetInterval }, scheduled: null };
}

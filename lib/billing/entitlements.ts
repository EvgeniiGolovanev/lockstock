import { ApiError } from "@/lib/api/errors";
import { billingPlanContract, type BillingPlan, type PlanFeatures, type PlanLimits } from "@/lib/billing/plan-contract";

export type BillingStatus = "trialing" | "active" | "past_due" | "cancelled" | "unpaid" | "incomplete" | "incomplete_expired" | "paused";

export type BillingState = {
  plan: BillingPlan;
  status: BillingStatus;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  pastDueSince?: string | null;
};

export type PlanEntitlements = {
  selectedPlan: BillingPlan;
  effectivePlan: BillingPlan;
  billingStatus: BillingStatus | "missing";
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  isReadOnly: boolean;
  accessReason: "trial" | "active_subscription" | "payment_grace" | "trial_expired" | "subscription_inactive" | "billing_missing";
  features: PlanFeatures;
  limits: PlanLimits;
};

export function resolveEntitlements(billing: BillingState | null, now = new Date()): PlanEntitlements {
  if (!billing) {
    return buildEntitlements("starter", "starter", "missing", null, null, true, "billing_missing");
  }

  if (billing.status === "active") {
    return buildEntitlements(
      billing.plan, billing.plan, billing.status, billing.trialEndsAt, billing.currentPeriodEnd, false, "active_subscription"
    );
  }

  const pastDueSince = billing.pastDueSince ? new Date(billing.pastDueSince) : null;
  if (billing.status === "past_due" && pastDueSince && !Number.isNaN(pastDueSince.getTime())) {
    const graceEndsAt = new Date(pastDueSince.getTime() + 7 * 24 * 60 * 60 * 1000);
    if (now <= graceEndsAt) {
      return buildEntitlements(
        billing.plan, billing.plan, billing.status, billing.trialEndsAt, billing.currentPeriodEnd, false, "payment_grace"
      );
    }
  }

  const trialEnd = billing.trialEndsAt ? new Date(billing.trialEndsAt) : null;
  if (billing.status === "trialing" && trialEnd && !Number.isNaN(trialEnd.getTime()) && trialEnd >= now) {
    return buildEntitlements(
      billing.plan, "starter", billing.status, billing.trialEndsAt, billing.currentPeriodEnd, false, "trial"
    );
  }

  const reason = billing.status === "trialing" ? "trial_expired" : "subscription_inactive";
  return buildEntitlements(
    billing.plan, "starter", billing.status, billing.trialEndsAt, billing.currentPeriodEnd, true, reason
  );
}

function buildEntitlements(
  selectedPlan: BillingPlan,
  effectivePlan: BillingPlan,
  billingStatus: PlanEntitlements["billingStatus"],
  trialEndsAt: string | null,
  currentPeriodEnd: string | null,
  isReadOnly: boolean,
  accessReason: PlanEntitlements["accessReason"]
): PlanEntitlements {
  const configuration = billingPlanContract[effectivePlan];
  return {
    selectedPlan, effectivePlan, billingStatus, trialEndsAt, currentPeriodEnd, isReadOnly, accessReason,
    features: { ...configuration.features }, limits: { ...configuration.limits }
  };
}

export function requireWorkspaceWriteAccess(entitlements: PlanEntitlements) {
  if (entitlements.isReadOnly) {
    throw new ApiError(402, "This workspace is read-only because its trial or subscription is not active.", {
      reason: entitlements.accessReason
    });
  }
}

export function requireFeature(entitlements: PlanEntitlements, feature: keyof PlanFeatures) {
  if (!entitlements.features[feature]) {
    const labels: Record<keyof PlanFeatures, string> = {
      organizationAuditLog: "Organization-wide audit history",
      auditCsvExport: "Audit CSV export"
    };
    throw new ApiError(403, `${labels[feature]} requires a paid plan.`, { feature, effectivePlan: entitlements.effectivePlan });
  }
}

export function requireWithinPlanLimit(
  entitlements: PlanEntitlements,
  limit: keyof PlanLimits,
  currentUsage: number,
  requested = 1
) {
  const maximum = entitlements.limits[limit];
  if (maximum !== null && currentUsage + requested > maximum) {
    throw new ApiError(403, `The ${entitlements.effectivePlan} plan limit for ${limit} has been reached.`, {
      limit, maximum, currentUsage, requested
    });
  }
}

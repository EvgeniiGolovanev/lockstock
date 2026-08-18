import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api/errors";
import {
  resolveEntitlements,
  requireFeature,
  requireWithinPlanLimit,
  requireWorkspaceWriteAccess,
  type BillingState
} from "@/lib/billing/entitlements";

describe("plan entitlements", () => {
  const now = new Date("2026-06-27T12:00:00.000Z");

  it("uses Starter capabilities during a valid trial regardless of selected plan", () => {
    const entitlements = resolveEntitlements(
      {
        plan: "business",
        status: "trialing",
        trialEndsAt: "2026-07-12T12:00:00.000Z",
        currentPeriodEnd: null
      },
      now
    );

    expect(entitlements.selectedPlan).toBe("business");
    expect(entitlements.effectivePlan).toBe("starter");
    expect(entitlements.isReadOnly).toBe(false);
    expect(entitlements.limits.locations).toBe(3);
    expect(entitlements.features.auditCsvExport).toBe(false);
  });

  it("makes an expired unpaid trial read-only", () => {
    const entitlements = resolveEntitlements(
      {
        plan: "operations",
        status: "trialing",
        trialEndsAt: "2026-06-27T11:59:59.000Z",
        currentPeriodEnd: null
      },
      now
    );

    expect(entitlements.isReadOnly).toBe(true);
    expect(entitlements.accessReason).toBe("trial_expired");
    expect(() => requireWorkspaceWriteAccess(entitlements)).toThrowError(ApiError);
  });

  it("grants selected-plan capabilities only to active subscriptions", () => {
    const entitlements = resolveEntitlements(
      {
        plan: "operations",
        status: "active",
        trialEndsAt: null,
        currentPeriodEnd: "2026-07-27"
      },
      now
    );

    expect(entitlements.effectivePlan).toBe("operations");
    expect(entitlements.isReadOnly).toBe(false);
    expect(entitlements.limits.teams).toBe(5);
    expect(entitlements.limits.locations).toBeNull();
    expect(entitlements.features.auditCsvExport).toBe(true);
    expect(entitlements.limits.auditExportDays).toBe(90);
  });

  it("denies paid features on Starter with an upgrade error", () => {
    const entitlements = resolveEntitlements(
      { plan: "starter", status: "active", trialEndsAt: null, currentPeriodEnd: null },
      now
    );

    expect(() => requireFeature(entitlements, "auditCsvExport")).toThrowError(
      "Audit CSV export requires a paid plan."
    );
  });

  it("fails safely as read-only Starter when billing data is missing", () => {
    const entitlements = resolveEntitlements(null, now);

    expect(entitlements.effectivePlan).toBe("starter");
    expect(entitlements.isReadOnly).toBe(true);
    expect(entitlements.accessReason).toBe("billing_missing");
  });

  it("enforces finite plan limits and permits enterprise unlimited usage", () => {
    const starter = resolveEntitlements(
      { plan: "starter", status: "active", trialEndsAt: null, currentPeriodEnd: null },
      now
    );
    const enterprise = resolveEntitlements(
      { plan: "enterprise", status: "active", trialEndsAt: null, currentPeriodEnd: null },
      now
    );

    expect(() => requireWithinPlanLimit(starter, "csvImportRows", 0, 101)).toThrow("starter plan limit");
    expect(() => requireWithinPlanLimit(enterprise, "materials", 1_000_000, 1)).not.toThrow();
  });

  it("keeps paid entitlements during the seven-day past-due grace period", () => {
    const duringGrace = resolveEntitlements({
      plan: "business",
      status: "past_due",
      trialEndsAt: null,
      currentPeriodEnd: "2026-07-01",
      pastDueSince: "2026-06-23T12:00:00.000Z"
    }, now);
    const afterGrace = resolveEntitlements({
      plan: "business",
      status: "past_due",
      trialEndsAt: null,
      currentPeriodEnd: "2026-07-01",
      pastDueSince: "2026-06-19T11:59:59.000Z"
    }, now);

    expect(duringGrace.isReadOnly).toBe(false);
    expect(duringGrace.effectivePlan).toBe("business");
    expect(afterGrace.isReadOnly).toBe(true);
  });

  const writeAccessCases: Array<{
    name: string;
    billing: BillingState | null;
    writable: boolean;
  }> = [
    {
      name: "active with an expired current period",
      billing: {
        plan: "business",
        status: "active",
        trialEndsAt: null,
        currentPeriodEnd: "2026-06-26T12:00:00.000Z"
      },
      writable: true
    },
    {
      name: "trial at the exact end boundary",
      billing: {
        plan: "business",
        status: "trialing",
        trialEndsAt: "2026-06-27T12:00:00.000Z",
        currentPeriodEnd: null
      },
      writable: true
    },
    {
      name: "trial one millisecond beyond the end boundary",
      billing: {
        plan: "business",
        status: "trialing",
        trialEndsAt: "2026-06-27T11:59:59.999Z",
        currentPeriodEnd: null
      },
      writable: false
    },
    {
      name: "past-due at the exact seven-day boundary",
      billing: {
        plan: "operations",
        status: "past_due",
        trialEndsAt: null,
        currentPeriodEnd: null,
        pastDueSince: "2026-06-20T12:00:00.000Z"
      },
      writable: true
    },
    {
      name: "past-due one millisecond beyond grace",
      billing: {
        plan: "operations",
        status: "past_due",
        trialEndsAt: null,
        currentPeriodEnd: null,
        pastDueSince: "2026-06-20T11:59:59.999Z"
      },
      writable: false
    },
    ...(["cancelled", "unpaid", "incomplete", "incomplete_expired", "paused"] as const).map((status) => ({
      name: `${status} subscription`,
      billing: { plan: "starter" as const, status, trialEndsAt: null, currentPeriodEnd: null },
      writable: false
    })),
    { name: "missing billing", billing: null, writable: false }
  ];

  it.each(writeAccessCases)("keeps TypeScript write access in parity for $name", ({ billing, writable }) => {
    expect(resolveEntitlements(billing, now).isReadOnly).toBe(!writable);
  });

  it("preserves the public read-only error message", () => {
    const entitlements = resolveEntitlements(null, now);

    expect(() => requireWorkspaceWriteAccess(entitlements)).toThrow(
      "This workspace is read-only because its trial or subscription is not active."
    );
  });
});

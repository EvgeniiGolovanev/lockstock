import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { billingCatalog } from "@/lib/billing/catalog";
import { resolveEntitlements } from "@/lib/billing/entitlements";
import {
  BILLING_PLANS,
  PAID_PLANS,
  billingPlanContract,
  buildPaymentCards,
  buildPricingCards,
  buildPricingLimitRows
} from "@/lib/billing/plan-contract";

describe("billing plan contract", () => {
  it("exports one authoritative contract for public pricing copy and internal entitlements", () => {
    expect(BILLING_PLANS).toEqual(["starter", "operations", "business", "enterprise"]);
    expect(PAID_PLANS).toEqual(["starter", "operations", "business"]);

    expect(buildPricingCards().map((plan) => plan.id)).toEqual(BILLING_PLANS);
    expect(buildPaymentCards().map((plan) => plan.id)).toEqual(PAID_PLANS);

    expect(billingPlanContract.business.public.limitLabels.workspaces).toBe("Pending Stage 2 decision");
    expect(billingPlanContract.enterprise.public.limitLabels.workspaces).toBe("Pending Stage 2 decision");
  });

  it("keeps billing catalog numbers and entitlement limits in parity with the shared contract", () => {
    expect(billingCatalog.starter).toMatchObject({
      monthly: billingPlanContract.starter.pricing.monthly,
      annual: billingPlanContract.starter.pricing.annual,
      annualMonthlyEquivalent: billingPlanContract.starter.pricing.annualMonthlyEquivalent
    });
    expect(billingCatalog.operations).toMatchObject({
      monthly: billingPlanContract.operations.pricing.monthly,
      annual: billingPlanContract.operations.pricing.annual,
      annualMonthlyEquivalent: billingPlanContract.operations.pricing.annualMonthlyEquivalent
    });
    expect(billingCatalog.business).toMatchObject({
      monthly: billingPlanContract.business.pricing.monthly,
      annual: billingPlanContract.business.pricing.annual,
      annualMonthlyEquivalent: billingPlanContract.business.pricing.annualMonthlyEquivalent
    });

    const entitlements = resolveEntitlements(
      { plan: "business", status: "active", trialEndsAt: null, currentPeriodEnd: null },
      new Date("2026-08-16T12:00:00.000Z")
    );

    expect(entitlements.limits).toMatchObject(billingPlanContract.business.limits);
    expect(entitlements.features).toMatchObject(billingPlanContract.business.features);
    expect(buildPricingLimitRows()[4][1]).toBe(billingPlanContract.starter.public.limitLabels.workspaces);
  });

  it("keeps the SQL plan matrix aligned with the reviewed contract values", () => {
    const migration = fs.readFileSync(
      path.join(process.cwd(), "supabase/migrations/202608131200_enforce_database_authorization_entitlements.sql"),
      "utf8"
    ).replace(/\s+/g, " ");

    expect(migration).toContain("interval '360 hours'");
    expect(migration).toContain(`case v_plan when 'starter' then ${billingPlanContract.starter.limits.users} when 'operations' then ${billingPlanContract.operations.limits.users} else ${billingPlanContract.business.limits.users} end`);
    expect(migration).toContain(`case v_plan when 'starter' then ${billingPlanContract.starter.limits.teams} when 'operations' then ${billingPlanContract.operations.limits.teams} else ${billingPlanContract.business.limits.teams} end`);
    expect(migration).toContain(`case v_plan when 'starter' then ${billingPlanContract.starter.limits.materials} when 'operations' then ${billingPlanContract.operations.limits.materials} else ${billingPlanContract.business.limits.materials} end`);
    expect(migration).toContain(`case v_plan when 'starter' then ${billingPlanContract.starter.limits.suppliers} when 'operations' then ${billingPlanContract.operations.limits.suppliers} else ${billingPlanContract.business.limits.suppliers} end`);
    expect(migration).toContain(`case v_plan when 'starter' then ${billingPlanContract.starter.limits.purchaseOrdersPerMonth} when 'operations' then ${billingPlanContract.operations.limits.purchaseOrdersPerMonth} else ${billingPlanContract.business.limits.purchaseOrdersPerMonth} end`);
    expect(migration).toContain(`case v_plan when 'starter' then ${billingPlanContract.starter.limits.stockMovementsPerMonth} when 'operations' then ${billingPlanContract.operations.limits.stockMovementsPerMonth} else ${billingPlanContract.business.limits.stockMovementsPerMonth} end`);
  });
});

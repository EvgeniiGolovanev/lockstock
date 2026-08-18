import { afterEach, describe, expect, it } from "vitest";
import { annualSavings, billingCatalog } from "@/lib/billing/catalog";
import { priceIdForSelection, selectionForPriceId } from "@/lib/billing/price-ids";

describe("billing catalog", () => {
  afterEach(() => {
    delete process.env.STRIPE_PRICE_STARTER_MONTHLY;
    delete process.env.STRIPE_PRICE_STARTER_ANNUAL;
  });

  it("publishes the agreed monthly and annual tariffs", () => {
    expect(billingCatalog.starter).toMatchObject({ monthly: 49, annual: 468, annualMonthlyEquivalent: 39 });
    expect(billingCatalog.operations).toMatchObject({ monthly: 109, annual: 1068, annualMonthlyEquivalent: 89 });
    expect(billingCatalog.business).toMatchObject({ monthly: 219, annual: 2148, annualMonthlyEquivalent: 179 });
  });

  it("calculates annual savings against twelve monthly payments", () => {
    expect(annualSavings("starter")).toEqual({ amount: 120, percentage: 20 });
  });

  it("maps validated selections to server-only Stripe Price IDs and back", () => {
    process.env.STRIPE_PRICE_STARTER_MONTHLY = "price_starter_monthly";
    process.env.STRIPE_PRICE_STARTER_ANNUAL = "price_starter_annual";

    expect(priceIdForSelection("starter", "monthly")).toBe("price_starter_monthly");
    expect(selectionForPriceId("price_starter_annual")).toEqual({ plan: "starter", interval: "annual" });
  });
});

import { describe, expect, it } from "vitest";
import { subscriptionIdFromEventObject } from "@/lib/billing/webhook-sync";

describe("Stripe webhook object mapping", () => {
  it("extracts subscription IDs from subscriptions, invoices, and schedules", () => {
    expect(subscriptionIdFromEventObject({ object: "subscription", id: "sub_direct" })).toBe("sub_direct");
    expect(subscriptionIdFromEventObject({ parent: { subscription_details: { subscription: "sub_invoice" } } })).toBe("sub_invoice");
    expect(subscriptionIdFromEventObject({ object: "subscription_schedule", subscription: "sub_schedule" })).toBe("sub_schedule");
  });
});

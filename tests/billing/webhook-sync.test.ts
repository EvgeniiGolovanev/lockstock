import { beforeEach, describe, expect, it, vi } from "vitest";
import { subscriptionIdFromEventObject, shouldApplyStripeEvent, syncStripeSubscription } from "@/lib/billing/webhook-sync";
import { getStripeClient } from "@/lib/billing/stripe";
import { getSupabaseServiceClient } from "@/lib/supabase-service";
import { selectionForPriceId } from "@/lib/billing/price-ids";
import { schedulePlanChange } from "@/lib/billing/subscription-service";

vi.mock("@/lib/billing/stripe", () => ({ getStripeClient: vi.fn() }));
vi.mock("@/lib/supabase-service", () => ({ getSupabaseServiceClient: vi.fn() }));
vi.mock("@/lib/billing/price-ids", () => ({ selectionForPriceId: vi.fn() }));
vi.mock("@/lib/billing/subscription-service", () => ({ schedulePlanChange: vi.fn() }));

describe("Stripe webhook object mapping", () => {
  it("extracts subscription IDs from subscriptions, invoices, and schedules", () => {
    expect(subscriptionIdFromEventObject({ object: "subscription", id: "sub_direct" })).toBe("sub_direct");
    expect(subscriptionIdFromEventObject({ parent: { subscription_details: { subscription: "sub_invoice" } } })).toBe("sub_invoice");
    expect(subscriptionIdFromEventObject({ object: "subscription_schedule", subscription: "sub_schedule" })).toBe("sub_schedule");
  });
});

describe("Stripe webhook event ordering", () => {
  it("skips events older than the current billing watermark and breaks ties by event id", () => {
    const eventCreated = Math.floor(Date.parse("2026-08-13T10:00:00.000Z") / 1000);
    expect(shouldApplyStripeEvent({
      last_stripe_event_created_at: "2026-08-13T10:00:00.000Z",
      last_stripe_event_id: "evt_b",
    } as never, eventCreated, "evt_a")).toBe(false);

    expect(shouldApplyStripeEvent({
      last_stripe_event_created_at: "2026-08-13T10:00:00.000Z",
      last_stripe_event_id: "evt_b",
    } as never, eventCreated, "evt_c")).toBe(true);
  });
});

describe("syncStripeSubscription", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does nothing when the subscription is not linked to a billing row", async () => {
    const select = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null })
      })
    });
    const update = vi.fn();
    vi.mocked(getSupabaseServiceClient).mockReturnValue({ from: vi.fn().mockReturnValue({ select, update }) } as never);
    const retrieve = vi.fn();
    vi.mocked(getStripeClient).mockReturnValue({ subscriptions: { retrieve } } as never);

    await syncStripeSubscription("sub_missing", 1755075600, "evt_missing");

    expect(retrieve).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it("skips an older event before calling Stripe or writing billing", async () => {
    const select = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({
          data: {
            org_id: "org-1",
            plan: "starter",
            status: "trialing",
            billing_interval: "monthly",
            stripe_customer_id: null,
            stripe_subscription_id: "sub_1",
            stripe_subscription_item_id: null,
            stripe_checkout_session_id: null,
            stripe_subscription_schedule_id: null,
            trial_ends_at: null,
            current_period_end: null,
            past_due_since: null,
            cancel_at_period_end: false,
            scheduled_plan: null,
            scheduled_interval: null,
            scheduled_effective_at: null,
            last_stripe_event_created_at: "2026-08-13T10:00:00.000Z",
            last_stripe_event_id: "evt_z"
          },
          error: null
        })
      })
    });
    const update = vi.fn();
    vi.mocked(getSupabaseServiceClient).mockReturnValue({ from: vi.fn().mockReturnValue({ select, update }) } as never);

    const retrieve = vi.fn();
    vi.mocked(getStripeClient).mockReturnValue({ subscriptions: { retrieve } } as never);
    vi.mocked(selectionForPriceId).mockReturnValue({ plan: "starter", interval: "monthly" } as never);
    vi.mocked(schedulePlanChange).mockResolvedValue({ id: "sched_1" } as never);

    await syncStripeSubscription("sub_1", 1755075600, "evt_skip");

    expect(retrieve).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it("logs and skips unknown prices without mutating billing", async () => {
    const select = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({
          data: {
            org_id: "org-1",
            plan: "starter",
            status: "trialing",
            billing_interval: "monthly",
            stripe_customer_id: null,
            stripe_subscription_id: "sub_1",
            stripe_subscription_item_id: null,
            stripe_checkout_session_id: null,
            stripe_subscription_schedule_id: null,
            trial_ends_at: null,
            current_period_end: null,
            past_due_since: null,
            cancel_at_period_end: false,
            scheduled_plan: null,
            scheduled_interval: null,
            scheduled_effective_at: null,
            last_stripe_event_created_at: null,
            last_stripe_event_id: null
          },
          error: null
        })
      })
    });
    const update = vi.fn();
    vi.mocked(getSupabaseServiceClient).mockReturnValue({ from: vi.fn().mockReturnValue({ select, update }) } as never);
    vi.mocked(getStripeClient).mockReturnValue({
      subscriptions: { retrieve: vi.fn().mockResolvedValue({ items: { data: [{ price: { id: "price_unknown" } }] } }) }
    } as never);
    vi.mocked(selectionForPriceId).mockReturnValue(null);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await syncStripeSubscription("sub_1", 1755075600, "evt_unknown");

    expect(errorSpy).toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});

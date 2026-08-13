import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/billing/webhook/route";
import { getStripeClient } from "@/lib/billing/stripe";
import { getSupabaseServiceClient } from "@/lib/supabase-service";
import { bindCheckoutSession } from "@/lib/billing/webhook-sync";

vi.mock("@/lib/billing/stripe", () => ({ getStripeClient: vi.fn() }));
vi.mock("@/lib/supabase-service", () => ({ getSupabaseServiceClient: vi.fn() }));
vi.mock("@/lib/billing/webhook-sync", () => ({
  bindCheckoutSession: vi.fn(),
  clearReleasedSchedule: vi.fn(),
  markInvoiceFailed: vi.fn(),
  markSubscriptionDeleted: vi.fn(),
  subscriptionIdFromEventObject: vi.fn(),
  syncStripeSubscription: vi.fn()
}));

describe("POST /api/billing/webhook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
  });

  it("rejects an invalid Stripe signature before touching the database", async () => {
    vi.mocked(getStripeClient).mockReturnValue({ webhooks: { constructEvent: vi.fn(() => { throw new Error("bad signature"); }) } } as never);
    const response = await POST(new NextRequest("http://localhost/api/billing/webhook", {
      method: "POST", headers: { "stripe-signature": "invalid" }, body: "payload"
    }));
    expect(response.status).toBe(400);
    expect(getSupabaseServiceClient).not.toHaveBeenCalled();
  });

  it("acknowledges duplicate events without applying them twice", async () => {
    vi.mocked(getStripeClient).mockReturnValue({ webhooks: { constructEvent: vi.fn(() => ({
      id: "evt_1", type: "checkout.session.completed", created: 100, data: { object: { id: "cs_1" } }
    })) } } as never);
    const insert = vi.fn().mockResolvedValue({ error: { code: "23505" } });
    vi.mocked(getSupabaseServiceClient).mockReturnValue({ from: vi.fn().mockReturnValue({ insert }) } as never);
    const response = await POST(new NextRequest("http://localhost/api/billing/webhook", {
      method: "POST", headers: { "stripe-signature": "valid" }, body: "payload"
    }));
    expect(response.status).toBe(200);
    expect(bindCheckoutSession).not.toHaveBeenCalled();
  });
});

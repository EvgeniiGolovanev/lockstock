import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/billing/webhook/route";
import { getStripeClient } from "@/lib/billing/stripe";
import { bindCheckoutSession } from "@/lib/billing/webhook-sync";
import { claimStripeWebhookEvent, completeStripeWebhookEvent, failStripeWebhookEvent } from "@/lib/billing/webhook-ledger";

vi.mock("@/lib/billing/stripe", () => ({ getStripeClient: vi.fn() }));
vi.mock("@/lib/billing/webhook-sync", () => ({
  bindCheckoutSession: vi.fn(),
  clearReleasedSchedule: vi.fn(),
  markInvoiceFailed: vi.fn(),
  markSubscriptionDeleted: vi.fn(),
  subscriptionIdFromEventObject: vi.fn(),
  syncStripeSubscription: vi.fn()
}));
vi.mock("@/lib/billing/webhook-ledger", () => ({
  claimStripeWebhookEvent: vi.fn(),
  completeStripeWebhookEvent: vi.fn(),
  failStripeWebhookEvent: vi.fn()
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
    expect(claimStripeWebhookEvent).not.toHaveBeenCalled();
  });

  it("acknowledges duplicate events without applying them twice", async () => {
    vi.mocked(getStripeClient).mockReturnValue({ webhooks: { constructEvent: vi.fn(() => ({
      id: "evt_1", type: "checkout.session.completed", created: 100, data: { object: { id: "cs_1" } }
    })) } } as never);
    vi.mocked(claimStripeWebhookEvent).mockResolvedValue({
      event_id: "evt_1",
      event_type: "checkout.session.completed",
      event_created_at: "1970-01-01T00:01:40.000Z",
      status: "processed",
      attempt_count: 1,
      claimed_at: "1970-01-01T00:01:40.000Z",
      processed_at: "1970-01-01T00:01:40.000Z",
      failed_at: null,
      last_error_code: null,
      last_error_message: null,
      claimed: false
    });
    const response = await POST(new NextRequest("http://localhost/api/billing/webhook", {
      method: "POST", headers: { "stripe-signature": "valid" }, body: "payload"
    }));
    expect(response.status).toBe(200);
    expect(bindCheckoutSession).not.toHaveBeenCalled();
  });

  it("returns a retryable response while another delivery is processing", async () => {
    vi.mocked(getStripeClient).mockReturnValue({ webhooks: { constructEvent: vi.fn(() => ({
      id: "evt_2", type: "checkout.session.completed", created: 100, data: { object: { id: "cs_2" } }
    })) } } as never);
    vi.mocked(claimStripeWebhookEvent).mockResolvedValue({
      event_id: "evt_2",
      event_type: "checkout.session.completed",
      event_created_at: "1970-01-01T00:01:40.000Z",
      status: "processing",
      attempt_count: 1,
      claimed_at: "1970-01-01T00:01:40.000Z",
      processed_at: null,
      failed_at: null,
      last_error_code: null,
      last_error_message: null,
      claimed: false
    });
    const response = await POST(new NextRequest("http://localhost/api/billing/webhook", {
      method: "POST", headers: { "stripe-signature": "valid" }, body: "payload"
    }));
    expect(response.status).toBe(409);
    expect(bindCheckoutSession).not.toHaveBeenCalled();
    expect(completeStripeWebhookEvent).not.toHaveBeenCalled();
  });

  it("marks failed processing when handler throws", async () => {
    vi.mocked(getStripeClient).mockReturnValue({ webhooks: { constructEvent: vi.fn(() => ({
      id: "evt_3", type: "checkout.session.completed", created: 100, data: { object: { id: "cs_3" } }
    })) } } as never);
    vi.mocked(claimStripeWebhookEvent).mockResolvedValue({
      event_id: "evt_3",
      event_type: "checkout.session.completed",
      event_created_at: "1970-01-01T00:01:40.000Z",
      status: "processing",
      attempt_count: 1,
      claimed_at: "1970-01-01T00:01:40.000Z",
      processed_at: null,
      failed_at: null,
      last_error_code: null,
      last_error_message: null,
      claimed: true
    });
    vi.mocked(bindCheckoutSession).mockRejectedValue(new Error("db write failed"));

    const response = await POST(new NextRequest("http://localhost/api/billing/webhook", {
      method: "POST", headers: { "stripe-signature": "valid" }, body: "payload"
    }));
    expect(response.status).toBe(500);
    expect(failStripeWebhookEvent).toHaveBeenCalledWith("evt_3", "processing_failed", "db write failed");
    expect(completeStripeWebhookEvent).not.toHaveBeenCalled();
  });
});

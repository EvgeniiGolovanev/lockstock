import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/billing/checkout-session/route";
import { ensureOwnedOrganization } from "@/lib/billing/ownership";
import { loadBillingRow } from "@/lib/billing/records";
import { getStripeClient } from "@/lib/billing/stripe";
import { getSupabaseServiceClient } from "@/lib/supabase-service";
import { requireAuthenticatedUserId } from "@/lib/api/auth";
import { consumePublicRateLimit } from "@/lib/api/public-rate-limit";

vi.mock("@/lib/billing/ownership", () => ({ ensureOwnedOrganization: vi.fn() }));
vi.mock("@/lib/billing/records", () => ({ loadBillingRow: vi.fn() }));
vi.mock("@/lib/billing/stripe", () => ({ getStripeClient: vi.fn() }));
vi.mock("@/lib/supabase-service", () => ({ getSupabaseServiceClient: vi.fn() }));
vi.mock("@/lib/api/auth", () => ({ requireAuthenticatedUserId: vi.fn() }));
vi.mock("@/lib/api/public-rate-limit", () => ({
  consumePublicRateLimit: vi.fn(),
  getRateLimitSubject: (_request: Request, subject: string) => `subject:${subject}`
}));

describe("POST /api/billing/checkout-session", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.STRIPE_PRICE_OPERATIONS_ANNUAL = "price_ops_year";
    vi.mocked(requireAuthenticatedUserId).mockResolvedValue("user-1");
    vi.mocked(ensureOwnedOrganization).mockResolvedValue({ orgId: "org-1", created: true });
    vi.mocked(loadBillingRow).mockResolvedValue({ stripe_customer_id: null, stripe_subscription_id: null, status: "incomplete" } as never);
    vi.mocked(consumePublicRateLimit).mockResolvedValue({ allowed: true, remaining: 9, retryAfterSeconds: 0 });
  });

  it("creates a taxed annual Stripe subscription Checkout Session", async () => {
    const single = vi.fn().mockResolvedValue({ data: { state: "claimed", claim_token: "claim-1", stripe_customer_id: null, stripe_checkout_session_id: null }, error: null });
    const rpc = vi.fn()
      .mockReturnValueOnce({ single })
      .mockResolvedValueOnce({ error: null });
    vi.mocked(getSupabaseServiceClient).mockReturnValue({ rpc } as never);
    const createCustomer = vi.fn().mockResolvedValue({ id: "cus_1" });
    const createSession = vi.fn().mockResolvedValue({ id: "cs_1", url: "https://checkout.stripe.com/session" });
    vi.mocked(getStripeClient).mockReturnValue({
      customers: { create: createCustomer },
      checkout: { sessions: { create: createSession } }
    } as never);

    const response = await POST(new NextRequest("http://localhost:3000/api/billing/checkout-session", {
      method: "POST",
      headers: { authorization: "Bearer token", "content-type": "application/json" },
      body: JSON.stringify({ plan: "operations", interval: "annual" })
    }));

    expect(response.status).toBe(201);
    expect(consumePublicRateLimit).toHaveBeenCalledWith("billing_checkout", expect.stringContaining("user-1"));
    expect(createSession).toHaveBeenCalledWith(expect.objectContaining({
      mode: "subscription",
      customer: "cus_1",
      automatic_tax: { enabled: true },
      billing_address_collection: "required",
      tax_id_collection: { enabled: true },
      line_items: [{ price: "price_ops_year", quantity: 1 }]
    }), expect.objectContaining({ idempotencyKey: "subscription-checkout:org-1:claim-1" }));
    expect(rpc).toHaveBeenLastCalledWith("complete_workspace_checkout_claim", expect.objectContaining({
      p_org_id: "org-1", p_claim_token: "claim-1", p_stripe_customer_id: "cus_1", p_stripe_checkout_session_id: "cs_1"
    }));
  });

  it("returns a retry hint when checkout requests exceed the durable limit", async () => {
    vi.mocked(consumePublicRateLimit).mockResolvedValue({ allowed: false, remaining: 0, retryAfterSeconds: 60 });

    const response = await POST(new NextRequest("http://localhost:3000/api/billing/checkout-session", {
      method: "POST",
      headers: { authorization: "Bearer token", "content-type": "application/json" },
      body: JSON.stringify({ plan: "operations", interval: "annual" })
    }));

    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("60");
  });
});

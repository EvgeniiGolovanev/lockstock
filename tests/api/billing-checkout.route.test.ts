import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/billing/checkout-session/route";
import { ensureOwnedOrganization } from "@/lib/billing/ownership";
import { loadBillingRow } from "@/lib/billing/records";
import { getStripeClient } from "@/lib/billing/stripe";
import { getSupabaseServiceClient } from "@/lib/supabase-service";
import { requireAuthenticatedUserId } from "@/lib/api/auth";

vi.mock("@/lib/billing/ownership", () => ({ ensureOwnedOrganization: vi.fn() }));
vi.mock("@/lib/billing/records", () => ({ loadBillingRow: vi.fn() }));
vi.mock("@/lib/billing/stripe", () => ({ getStripeClient: vi.fn() }));
vi.mock("@/lib/supabase-service", () => ({ getSupabaseServiceClient: vi.fn() }));
vi.mock("@/lib/api/auth", () => ({ requireAuthenticatedUserId: vi.fn() }));

describe("POST /api/billing/checkout-session", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.STRIPE_PRICE_OPERATIONS_ANNUAL = "price_ops_year";
    vi.mocked(requireAuthenticatedUserId).mockResolvedValue("user-1");
    vi.mocked(ensureOwnedOrganization).mockResolvedValue({ orgId: "org-1", created: true });
    vi.mocked(loadBillingRow).mockResolvedValue({ stripe_customer_id: null, stripe_subscription_id: null, status: "incomplete" } as never);
  });

  it("creates a taxed annual Stripe subscription Checkout Session", async () => {
    const eq = vi.fn().mockResolvedValue({ error: null });
    const update = vi.fn().mockReturnValue({ eq });
    vi.mocked(getSupabaseServiceClient).mockReturnValue({ from: vi.fn().mockReturnValue({ update }) } as never);
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
    expect(createSession).toHaveBeenCalledWith(expect.objectContaining({
      mode: "subscription",
      customer: "cus_1",
      automatic_tax: { enabled: true },
      billing_address_collection: "required",
      tax_id_collection: { enabled: true },
      line_items: [{ price: "price_ops_year", quantity: 1 }]
    }), expect.objectContaining({ idempotencyKey: expect.stringContaining("subscription-checkout:org-1:operations:annual") }));
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "@/app/api/billing/summary/route";
import { requireBillingOwner } from "@/lib/billing/ownership";
import { loadBillingRow } from "@/lib/billing/records";

vi.mock("@/lib/billing/ownership", () => ({ requireBillingOwner: vi.fn() }));
vi.mock("@/lib/billing/records", () => ({ loadBillingRow: vi.fn() }));

describe("GET /api/billing/summary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireBillingOwner).mockResolvedValue({ orgId: "org-1", userId: "user-1", token: "token", supabase: {} as never });
  });

  it("keeps the selected future plan visible during a trial while effective access stays Starter", async () => {
    vi.mocked(loadBillingRow).mockResolvedValue({
      org_id: "org-1",
      plan: "business",
      status: "trialing",
      billing_interval: "monthly",
      stripe_customer_id: null,
      stripe_subscription_id: null,
      stripe_subscription_item_id: null,
      stripe_checkout_session_id: null,
      stripe_subscription_schedule_id: null,
      trial_ends_at: "2026-08-28T10:00:00.000Z",
      current_period_end: null,
      past_due_since: null,
      cancel_at_period_end: false,
      scheduled_plan: null,
      scheduled_interval: null,
      scheduled_effective_at: null,
      last_stripe_event_created_at: null,
      last_stripe_event_id: null
    } as never);

    const response = await GET(new NextRequest("http://localhost/api/billing/summary", { headers: { authorization: "Bearer token", "x-org-id": "org-1" } }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.plan).toBe("business");
    expect(body.data.entitlements.selectedPlan).toBe("business");
    expect(body.data.entitlements.effectivePlan).toBe("starter");
    expect(body.data.entitlements.isReadOnly).toBe(false);
  });
});

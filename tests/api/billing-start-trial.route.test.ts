import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/billing/start-trial/route";
import { ensureOwnedOrganization } from "@/lib/billing/ownership";
import { loadBillingRow } from "@/lib/billing/records";
import { getSupabaseServiceClient } from "@/lib/supabase-service";
import { requireAuthenticatedUserId } from "@/lib/api/auth";

vi.mock("@/lib/billing/ownership", () => ({ ensureOwnedOrganization: vi.fn() }));
vi.mock("@/lib/billing/records", () => ({ loadBillingRow: vi.fn() }));
vi.mock("@/lib/supabase-service", () => ({ getSupabaseServiceClient: vi.fn() }));
vi.mock("@/lib/api/auth", () => ({ requireAuthenticatedUserId: vi.fn() }));

describe("POST /api/billing/start-trial", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAuthenticatedUserId).mockResolvedValue("user-1");
    vi.mocked(ensureOwnedOrganization).mockResolvedValue({ orgId: "org-1", created: false });
    vi.mocked(loadBillingRow).mockResolvedValue({
      stripe_customer_id: null,
      stripe_subscription_id: null,
      status: "incomplete",
      billing_interval: "monthly"
    } as never);
  });

  it("blocks a redeemed user from starting another trial on an owned workspace", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: { user_id: "user-1" }, error: null });
    const eq = vi.fn().mockReturnValue({ maybeSingle });
    const select = vi.fn().mockReturnValue({ eq });
    vi.mocked(getSupabaseServiceClient).mockReturnValue({ from: vi.fn().mockReturnValue({ select }) } as never);

    const response = await POST(new NextRequest("http://localhost:3000/api/billing/start-trial", {
      method: "POST",
      headers: { authorization: "Bearer token" }
    }));

    expect(response.status).toBe(409);
    expect(select).toHaveBeenCalledWith("user_id");
    expect(maybeSingle).toHaveBeenCalledOnce();
  });
});

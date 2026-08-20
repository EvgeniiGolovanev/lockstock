import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/billing/start-trial/route";
import { ensureOwnedOrganization } from "@/lib/billing/ownership";
import { loadBillingRow } from "@/lib/billing/records";
import { getSupabaseServiceClient } from "@/lib/supabase-service";
import { consumePublicRateLimit } from "@/lib/api/public-rate-limit";
import { requireAuthenticatedUserId } from "@/lib/api/auth";

vi.mock("@/lib/billing/ownership", () => ({ ensureOwnedOrganization: vi.fn() }));
vi.mock("@/lib/billing/records", () => ({ loadBillingRow: vi.fn() }));
vi.mock("@/lib/supabase-service", () => ({ getSupabaseServiceClient: vi.fn() }));
vi.mock("@/lib/api/public-rate-limit", () => ({
  consumePublicRateLimit: vi.fn(),
  getRateLimitSubject: (_request: Request, subject: string) => `subject:${subject}`
}));
vi.mock("@/lib/api/auth", () => ({ requireAuthenticatedUserId: vi.fn() }));

describe("POST /api/billing/start-trial", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(ensureOwnedOrganization).mockResolvedValue({ orgId: "org-1", created: false });
    vi.mocked(loadBillingRow).mockResolvedValue({
      stripe_customer_id: null,
      stripe_subscription_id: null,
      status: "incomplete",
      billing_interval: "monthly"
    } as never);
    vi.mocked(consumePublicRateLimit).mockResolvedValue({ allowed: true, remaining: 2, retryAfterSeconds: 0 });
    vi.mocked(requireAuthenticatedUserId).mockResolvedValue("user-1");
  });

  it("blocks a redeemed user from starting another trial on an owned workspace", async () => {
    const single = vi.fn().mockResolvedValue({ data: null, error: { message: "Trial already redeemed" } });
    const rpc = vi.fn().mockReturnValue({ single });
    vi.mocked(getSupabaseServiceClient).mockReturnValue({ rpc } as never);

    const response = await POST(new NextRequest("http://localhost:3000/api/billing/start-trial", {
      method: "POST",
      headers: { authorization: "Bearer token" }
    }));

    expect(response.status).toBe(409);
    expect(rpc).toHaveBeenCalledWith("start_workspace_trial", { p_org_id: "org-1" });
  });

  it("preserves the existing workspace plan when starting a trial on an owned workspace", async () => {
    vi.mocked(loadBillingRow).mockResolvedValue({
      plan: "business",
      stripe_customer_id: null,
      stripe_subscription_id: null,
      status: "incomplete",
      billing_interval: "monthly"
    } as never);

    const single = vi.fn().mockResolvedValue({ data: { trial_ends_at: "2026-09-01T00:00:00.000Z" }, error: null });
    const rpc = vi.fn().mockReturnValue({ single });
    vi.mocked(getSupabaseServiceClient).mockReturnValue({ rpc } as never);

    const response = await POST(new NextRequest("http://localhost:3000/api/billing/start-trial", {
      method: "POST",
      headers: { authorization: "Bearer token" }
    }));

    expect(response.status).toBe(201);
    expect(rpc).toHaveBeenCalledWith("start_workspace_trial", { p_org_id: "org-1" });
  });

  it("returns a retry hint when trial requests exceed the durable limit", async () => {
    vi.mocked(consumePublicRateLimit).mockResolvedValue({ allowed: false, remaining: 0, retryAfterSeconds: 86_400 });

    const response = await POST(new NextRequest("http://localhost:3000/api/billing/start-trial", {
      method: "POST",
      headers: { authorization: "Bearer token" }
    }));

    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("86400");
  });
});

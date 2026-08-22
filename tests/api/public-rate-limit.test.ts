import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { consumePublicRateLimit, getRateLimitSubject } from "@/lib/api/public-rate-limit";
import { getSupabaseServiceClient } from "@/lib/supabase-service";

vi.mock("@/lib/supabase-service", () => ({
  getSupabaseServiceClient: vi.fn()
}));

describe("public rate limiting", () => {
  beforeEach(() => vi.clearAllMocks());

  it("uses the left-most forwarded IP and a stable subject", () => {
    const request = new NextRequest("http://localhost/api/contact", {
      headers: { "x-forwarded-for": "203.0.113.10, 10.0.0.1" }
    });

    expect(getRateLimitSubject(request, "ada@example.com")).toBe("203.0.113.10:ada@example.com");
  });

  it("consumes an allowance through the service-role-only database RPC", async () => {
    const rpc = vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: { allowed: true, remaining: 4, retry_after_seconds: 0 }, error: null }) });
    vi.mocked(getSupabaseServiceClient).mockReturnValue({ rpc } as never);

    await expect(consumePublicRateLimit("contact", "203.0.113.10:ada@example.com")).resolves.toEqual({ allowed: true, remaining: 4, retryAfterSeconds: 0 });
    expect(rpc).toHaveBeenCalledWith("consume_public_rate_limit", {
      p_scope: "contact",
      p_subject: "203.0.113.10:ada@example.com"
    });
  });

  it("fails closed when durable rate-limit storage is unavailable", async () => {
    const rpc = vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: null, error: { message: "connection unavailable" } }) });
    vi.mocked(getSupabaseServiceClient).mockReturnValue({ rpc } as never);

    await expect(consumePublicRateLimit("billing_checkout", "203.0.113.10:user-1")).rejects.toThrow("Rate limiting is temporarily unavailable.");
  });
});

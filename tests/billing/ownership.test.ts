import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { ensureOwnedOrganization } from "@/lib/billing/ownership";
import { getSupabaseUserClient } from "@/lib/supabase-user";
import { extractBearerToken, requireAuthenticatedUserId } from "@/lib/api/auth";

vi.mock("@/lib/supabase-user", () => ({ getSupabaseUserClient: vi.fn() }));
vi.mock("@/lib/api/auth", () => ({
  extractBearerToken: vi.fn(() => "token"),
  requireAuthenticatedUserId: vi.fn()
}));

describe("ensureOwnedOrganization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(extractBearerToken).mockReturnValue("token");
    vi.mocked(requireAuthenticatedUserId).mockResolvedValue("user-1");
  });

  it("preserves the selected future plan when starting a trial workspace", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { id: "org-1" }, error: null });
    const authGetUser = vi.fn().mockResolvedValue({
      data: { user: { user_metadata: { company: "Acme Co", selected_plan: "business" } } },
      error: null
    });
    vi.mocked(getSupabaseUserClient).mockReturnValue({
      from: vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: [], error: null }) }) }),
      auth: { getUser: authGetUser },
      rpc
    } as never);

    await ensureOwnedOrganization(new NextRequest("http://localhost", { headers: { authorization: "Bearer token" } }), "starter", true);

    expect(rpc).toHaveBeenCalledWith("create_organization_with_owner", expect.objectContaining({
      p_name: "Acme Co",
      p_plan: "business",
      p_start_trial: true
    }));
    expect(authGetUser).toHaveBeenCalledOnce();
  });

  it("falls back to starter when no selected plan is present", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { id: "org-1" }, error: null });
    vi.mocked(getSupabaseUserClient).mockReturnValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: [], error: null })
        })
      }),
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { user_metadata: { company: "Acme Co" } } }, error: null }) },
      rpc
    } as never);

    await ensureOwnedOrganization(new NextRequest("http://localhost", { headers: { authorization: "Bearer token" } }), "starter", true);

    expect(rpc).toHaveBeenCalledWith("create_organization_with_owner", expect.objectContaining({
      p_plan: "starter",
      p_start_trial: true
    }));
  });
});

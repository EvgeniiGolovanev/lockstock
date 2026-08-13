import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { PATCH } from "@/app/api/platform/organizations/[id]/billing/route";
import { requirePlatformAdmin, logPlatformAccess } from "@/lib/api/platform-admin";

vi.mock("@/lib/api/platform-admin", () => ({
  requirePlatformAdmin: vi.fn(),
  requirePlatformMinRole: vi.fn((role: string, minimum: string) => {
    if (role !== "admin" || minimum !== "admin") throw new Error("admin required");
  }),
  logPlatformAccess: vi.fn()
}));

describe("PATCH /api/platform/organizations/:id/billing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(logPlatformAccess).mockResolvedValue(undefined);
  });

  it("lets a platform admin change a trial end date", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: { org_id: "11111111-1111-4111-8111-111111111111", trial_ends_at: "2026-07-31T23:59:59.000Z" },
      error: null
    });
    const select = vi.fn().mockReturnValue({ maybeSingle });
    const eq = vi.fn().mockReturnValue({ select });
    const update = vi.fn().mockReturnValue({ eq });
    const supabase = { from: vi.fn().mockReturnValue({ update }) };
    vi.mocked(requirePlatformAdmin).mockResolvedValue({ userId: "admin-1", role: "admin", supabase } as never);

    const request = new NextRequest(
      "http://localhost:3000/api/platform/organizations/11111111-1111-4111-8111-111111111111/billing",
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ trialEndsAt: "2026-07-31T23:59:59.000Z" })
      }
    );
    const response = await PATCH(request, {
      params: Promise.resolve({ id: "11111111-1111-4111-8111-111111111111" })
    });

    expect(response.status).toBe(200);
    expect(update).toHaveBeenCalledWith({ trial_ends_at: "2026-07-31T23:59:59.000Z" });
    expect(logPlatformAccess).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "admin-1" }),
      "platform.billing.trial_updated",
      expect.objectContaining({ orgId: "11111111-1111-4111-8111-111111111111" })
    );
  });
});

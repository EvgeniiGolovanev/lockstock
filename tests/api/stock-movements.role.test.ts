import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/stock/movements/route";
import { getSupabaseUserClient } from "@/lib/supabase-user";
import { extractBearerToken, requireAuthenticatedUserId } from "@/lib/api/auth";

vi.mock("@/lib/supabase-user", () => ({
  getSupabaseUserClient: vi.fn()
}));

vi.mock("@/lib/api/auth", () => ({
  extractBearerToken: vi.fn(),
  requireAuthenticatedUserId: vi.fn()
}));

function createSupabaseForRole(role: "viewer" | "member" | "manager" | "owner") {
  const orgUsersQuery = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: { role }, error: null })
  };

  const rpc = vi.fn().mockResolvedValue({ data: "move-1", error: null });

  return {
    from: vi.fn((table: string) => {
      if (table === "org_users") {
        return orgUsersQuery;
      }
      throw new Error(`Unexpected table access in test: ${table}`);
    }),
    rpc
  };
}

describe("POST /api/stock/movements role enforcement", () => {
  const orgId = "11111111-1111-4111-8111-111111111111";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 403 when role is viewer", async () => {
    vi.mocked(extractBearerToken).mockReturnValue("token");
    vi.mocked(requireAuthenticatedUserId).mockResolvedValue("user-1");
    const supabase = createSupabaseForRole("viewer");
    vi.mocked(getSupabaseUserClient).mockReturnValue(supabase as never);

    const request = new NextRequest("http://localhost:3000/api/stock/movements", {
      method: "POST",
      headers: { "x-org-id": orgId, Authorization: "Bearer token", "Content-Type": "application/json" },
      body: JSON.stringify({
        material_id: "2f208318-9607-4e8a-b061-fdf4ec4e8115",
        location_id: "1477645d-65e2-42fe-b5b6-d64dad99b3e9",
        quantity_delta: 1,
        reason: "adjustment"
      })
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toContain("member");
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it("allows member role and returns 201", async () => {
    vi.mocked(extractBearerToken).mockReturnValue("token");
    vi.mocked(requireAuthenticatedUserId).mockResolvedValue("user-1");
    const supabase = createSupabaseForRole("member");
    vi.mocked(getSupabaseUserClient).mockReturnValue(supabase as never);

    const request = new NextRequest("http://localhost:3000/api/stock/movements", {
      method: "POST",
      headers: { "x-org-id": orgId, Authorization: "Bearer token", "Content-Type": "application/json" },
      body: JSON.stringify({
        material_id: "2f208318-9607-4e8a-b061-fdf4ec4e8115",
        location_id: "1477645d-65e2-42fe-b5b6-d64dad99b3e9",
        quantity_delta: 1,
        reason: "adjustment"
      })
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.data.movement_id).toBe("move-1");
    expect(supabase.rpc).toHaveBeenCalledOnce();
  });
});

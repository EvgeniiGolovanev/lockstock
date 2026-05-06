import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { PATCH } from "@/app/api/locations/[id]/route";
import { requireMinRole, requireRequestContext } from "@/lib/api/route-context";

vi.mock("@/lib/api/route-context", () => ({
  requireRequestContext: vi.fn(),
  requireMinRole: vi.fn()
}));

function createLocationUpdateSupabase(updatedLocation: { id: string; name?: string; is_active?: boolean } | null) {
  const maybeSingle = vi.fn().mockResolvedValue({
    data: updatedLocation,
    error: null
  });
  const select = vi.fn().mockReturnValue({ maybeSingle });
  const eqOrg = vi.fn().mockReturnValue({ select });
  const eqId = vi.fn().mockReturnValue({ eq: eqOrg });
  const update = vi.fn().mockReturnValue({ eq: eqId });

  return {
    from: vi.fn((table: string) => {
      if (table === "locations") {
        return { update };
      }
      throw new Error(`Unexpected table in test: ${table}`);
    }),
    update
  };
}

describe("PATCH /api/locations/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireMinRole).mockImplementation(() => {});
  });

  it("updates location details for managers", async () => {
    const supabase = createLocationUpdateSupabase({
      id: "22222222-2222-4222-8222-222222222222",
      name: "Secondary Warehouse"
    });

    vi.mocked(requireRequestContext).mockResolvedValue({
      orgId: "11111111-1111-4111-8111-111111111111",
      userId: "user-1",
      role: "manager",
      supabase
    } as never);

    const request = new NextRequest("http://localhost:3000/api/locations/22222222-2222-4222-8222-222222222222", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Secondary Warehouse",
        code: "SEC",
        address: "  10 Supply Road  "
      })
    });

    const response = await PATCH(request, {
      params: Promise.resolve({ id: "22222222-2222-4222-8222-222222222222" })
    });

    expect(response.status).toBe(200);
    expect(requireMinRole).toHaveBeenCalledWith("manager", "manager");
    expect(supabase.update).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Secondary Warehouse",
        code: "SEC",
        address: "10 Supply Road"
      })
    );
  });

  it("updates location active state", async () => {
    const supabase = createLocationUpdateSupabase({
      id: "22222222-2222-4222-8222-222222222222",
      is_active: false
    });

    vi.mocked(requireRequestContext).mockResolvedValue({
      orgId: "11111111-1111-4111-8111-111111111111",
      userId: "user-1",
      role: "manager",
      supabase
    } as never);

    const request = new NextRequest("http://localhost:3000/api/locations/22222222-2222-4222-8222-222222222222", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: false })
    });

    const response = await PATCH(request, {
      params: Promise.resolve({ id: "22222222-2222-4222-8222-222222222222" })
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(supabase.update).toHaveBeenCalledWith(
      expect.objectContaining({
        is_active: false
      })
    );
    expect(body.data.is_active).toBe(false);
  });

  it("returns 404 when the location is outside the active group", async () => {
    const supabase = createLocationUpdateSupabase(null);

    vi.mocked(requireRequestContext).mockResolvedValue({
      orgId: "11111111-1111-4111-8111-111111111111",
      userId: "user-1",
      role: "manager",
      supabase
    } as never);

    const request = new NextRequest("http://localhost:3000/api/locations/missing", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: true })
    });

    const response = await PATCH(request, {
      params: Promise.resolve({ id: "missing" })
    });

    expect(response.status).toBe(404);
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/locations/route";
import { requireMinRole, requireRequestContext } from "@/lib/api/route-context";

vi.mock("@/lib/api/route-context", () => ({
  requireRequestContext: vi.fn(),
  requireMinRole: vi.fn()
}));

function createLocationsSupabase(returnedAddress: string | null) {
  const single = vi.fn().mockResolvedValue({
    data: {
      id: "location-1",
      org_id: "11111111-1111-4111-8111-111111111111",
      name: "Main Warehouse",
      code: "MAIN",
      address: returnedAddress,
      is_active: true
    },
    error: null
  });
  const select = vi.fn().mockReturnValue({ single });
  const insert = vi.fn().mockReturnValue({ select });

  return {
    from: vi.fn(() => ({ insert })),
    insert
  };
}

describe("POST /api/locations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireMinRole).mockImplementation(() => {});
  });

  it("creates a location with an address", async () => {
    const supabase = createLocationsSupabase("221B Baker Street");

    vi.mocked(requireRequestContext).mockResolvedValue({
      orgId: "11111111-1111-4111-8111-111111111111",
      role: "manager",
      supabase
    } as never);

    const request = new NextRequest("http://localhost:3000/api/locations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Main Warehouse",
        code: "MAIN",
        address: "221B Baker Street"
      })
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(requireMinRole).toHaveBeenCalledWith("manager", "manager");
    expect(supabase.from).toHaveBeenCalledWith("locations");
    expect(supabase.insert).toHaveBeenCalledWith({
      org_id: "11111111-1111-4111-8111-111111111111",
      name: "Main Warehouse",
      code: "MAIN",
      address: "221B Baker Street",
      is_active: true
    });
    expect(body.data.address).toBe("221B Baker Street");
  });

  it("stores a blank address as null", async () => {
    const supabase = createLocationsSupabase(null);

    vi.mocked(requireRequestContext).mockResolvedValue({
      orgId: "11111111-1111-4111-8111-111111111111",
      role: "manager",
      supabase
    } as never);

    const request = new NextRequest("http://localhost:3000/api/locations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Overflow Storage",
        code: "OVER",
        address: "   "
      })
    });

    const response = await POST(request);

    expect(response.status).toBe(201);
    expect(supabase.insert).toHaveBeenCalledWith({
      org_id: "11111111-1111-4111-8111-111111111111",
      name: "Overflow Storage",
      code: "OVER",
      address: null,
      is_active: true
    });
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { GET } from "@/app/api/reports/stock-health/route";
import { requireRequestContext } from "@/lib/api/route-context";

vi.mock("@/lib/api/route-context", () => ({
  requireRequestContext: vi.fn()
}));

describe("GET /api/reports/stock-health", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the SQL aggregate summary for the active organization", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [
        {
          total_materials: 12,
          total_quantity: 48,
          out_of_stock: 3,
          low_stock: 5
        }
      ],
      error: null
    });

    vi.mocked(requireRequestContext).mockResolvedValue({
      orgId: "11111111-1111-4111-8111-111111111111",
      userId: "user-1",
      role: "member",
      supabase: { rpc } as never
    } as never);

    const response = await GET(new NextRequest("http://localhost:3000/api/reports/stock-health"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("get_stock_health", {
      p_org_id: "11111111-1111-4111-8111-111111111111"
    });
    expect(body.data).toEqual({
      total_materials: 12,
      total_quantity: 48,
      out_of_stock: 3,
      low_stock: 5
    });
  });
});

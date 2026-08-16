import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { GET } from "@/app/api/alerts/low-stock/route";
import { requireRequestContext } from "@/lib/api/route-context";

vi.mock("@/lib/api/route-context", () => ({
  requireRequestContext: vi.fn()
}));

describe("GET /api/alerts/low-stock", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns low-stock materials from the SQL query contract", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [
        {
          material_id: "material-1",
          sku: "SKU-001",
          name: "Fasteners",
          min_stock: 20,
          quantity: 8,
          deficit: 12
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

    const response = await GET(new NextRequest("http://localhost:3000/api/alerts/low-stock"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("get_low_stock_materials", {
      p_org_id: "11111111-1111-4111-8111-111111111111"
    });
    expect(body.data).toEqual([
      {
        material_id: "material-1",
        sku: "SKU-001",
        name: "Fasteners",
        min_stock: 20,
        quantity: 8,
        deficit: 12
      }
    ]);
  });
});

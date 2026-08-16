import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST } from "@/app/api/stock/movements/route";
import { requireMinRole, requireRequestContext } from "@/lib/api/route-context";

vi.mock("@/lib/api/route-context", () => ({
  requireRequestContext: vi.fn(),
  requireMinRole: vi.fn()
}));

function createTransferSupabase() {
  const materialQuery = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({
      data: { id: "22222222-2222-4222-8222-222222222222", is_active: true },
      error: null
    })
  };

  return {
    from: vi.fn((table: string) => {
      if (table === "materials") {
        return materialQuery;
      }
      throw new Error(`Unexpected table in test: ${table}`);
    }),
    rpc: vi.fn().mockResolvedValue({
      data: ["move-out-1", "move-in-1"],
      error: null
    })
  };
}

function createMovementListSupabase() {
  const range = vi.fn().mockResolvedValue({
    data: [
      {
        id: "move-1",
        quantity_delta: -4,
        reason: "transfer",
        note: "Rack rebalance",
        created_at: "2026-04-03T10:15:00.000Z",
        material: { sku: "MAT-001", name: "Cement", uom: "bag", category: "Structural & Building Materials" },
        location: { code: "MAIN-A1", name: "Main / A1" }
      }
    ],
    error: null,
    count: 1
  });
  const order = vi.fn().mockReturnValue({ range });
  const eq = vi.fn().mockReturnValue({ order });
  const select = vi.fn().mockReturnValue({ eq });

  return {
    from: vi.fn(() => ({ select })),
    select,
    eq,
    order,
    range
  };
}

function createConsumptionSupabase(balance: { quantity: number } | null) {
  const materialQuery = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({
      data: { id: "22222222-2222-4222-8222-222222222222", is_active: true },
      error: null
    })
  };
  const balanceQuery = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({
      data: balance,
      error: null
    })
  };

  return {
    from: vi.fn((table: string) => {
      if (table === "materials") {
        return materialQuery;
      }
      if (table === "inventory_balances") {
        return balanceQuery;
      }
      throw new Error(`Unexpected table in test: ${table}`);
    }),
    rpc: vi.fn().mockResolvedValue({
      data: "move-consumption-1",
      error: null
    })
  };
}

describe("stock movement routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireMinRole).mockImplementation(() => {});
  });

  it("creates transfer movements through the dedicated RPC", async () => {
    const supabase = createTransferSupabase();

    vi.mocked(requireRequestContext).mockResolvedValue({
      orgId: "11111111-1111-4111-8111-111111111111",
      userId: "user-1",
      role: "member",
      supabase
    } as never);

    const request = new NextRequest("http://localhost:3000/api/stock/movements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        material_id: "22222222-2222-4222-8222-222222222222",
        from_location_id: "33333333-3333-4333-8333-333333333333",
        to_location_id: "44444444-4444-4444-8444-444444444444",
        quantity: 5,
        reason: "transfer",
        note: "Move to shipping zone"
      })
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(supabase.rpc).toHaveBeenCalledWith("create_stock_transfer", {
      p_org_id: "11111111-1111-4111-8111-111111111111",
      p_material_id: "22222222-2222-4222-8222-222222222222",
      p_from_location_id: "33333333-3333-4333-8333-333333333333",
      p_to_location_id: "44444444-4444-4444-8444-444444444444",
      p_quantity: 5,
      p_note: "Move to shipping zone",
      p_created_by: "user-1"
    });
    expect(body.data.movement_ids).toEqual(["move-out-1", "move-in-1"]);
  });

  it("rejects movement creation for blocked materials", async () => {
    const materialQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { id: "22222222-2222-4222-8222-222222222222", is_active: false },
        error: null
      })
    };
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "materials") {
          return materialQuery;
        }
        throw new Error(`Unexpected table in test: ${table}`);
      }),
      rpc: vi.fn()
    };

    vi.mocked(requireRequestContext).mockResolvedValue({
      orgId: "11111111-1111-4111-8111-111111111111",
      userId: "user-1",
      role: "member",
      supabase
    } as never);

    const request = new NextRequest("http://localhost:3000/api/stock/movements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        material_id: "22222222-2222-4222-8222-222222222222",
        location_id: "33333333-3333-4333-8333-333333333333",
        quantity_delta: 5,
        reason: "adjustment"
      })
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain("blocked");
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it("creates consumption movements after confirming enough stock at the location", async () => {
    const supabase = createConsumptionSupabase({ quantity: 4 });

    vi.mocked(requireRequestContext).mockResolvedValue({
      orgId: "11111111-1111-4111-8111-111111111111",
      userId: "user-1",
      role: "member",
      supabase
    } as never);

    const request = new NextRequest("http://localhost:3000/api/stock/movements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        material_id: "22222222-2222-4222-8222-222222222222",
        location_id: "33333333-3333-4333-8333-333333333333",
        quantity_delta: -3,
        reason: "consumption",
        note: "Released to site works"
      })
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(supabase.from).toHaveBeenCalledWith("inventory_balances");
    expect(supabase.rpc).toHaveBeenCalledWith("create_stock_movement", {
      p_org_id: "11111111-1111-4111-8111-111111111111",
      p_material_id: "22222222-2222-4222-8222-222222222222",
      p_location_id: "33333333-3333-4333-8333-333333333333",
      p_quantity_delta: -3,
      p_reason: "consumption",
      p_note: "Released to site works",
      p_created_by: "user-1"
    });
    expect(body.data.movement_id).toBe("move-consumption-1");
  });

  it("rejects consumption when the material is not stocked at the location", async () => {
    const supabase = createConsumptionSupabase(null);

    vi.mocked(requireRequestContext).mockResolvedValue({
      orgId: "11111111-1111-4111-8111-111111111111",
      userId: "user-1",
      role: "member",
      supabase
    } as never);

    const request = new NextRequest("http://localhost:3000/api/stock/movements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        material_id: "22222222-2222-4222-8222-222222222222",
        location_id: "33333333-3333-4333-8333-333333333333",
        quantity_delta: -1,
        reason: "consumption"
      })
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("Material does not exist in the specified location.");
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it("rejects consumption when the location has insufficient quantity", async () => {
    const supabase = createConsumptionSupabase({ quantity: 2 });

    vi.mocked(requireRequestContext).mockResolvedValue({
      orgId: "11111111-1111-4111-8111-111111111111",
      userId: "user-1",
      role: "member",
      supabase
    } as never);

    const request = new NextRequest("http://localhost:3000/api/stock/movements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        material_id: "22222222-2222-4222-8222-222222222222",
        location_id: "33333333-3333-4333-8333-333333333333",
        quantity_delta: -3,
        reason: "consumption"
      })
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("Not enough quantity at the specified location.");
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it("lists movement rows with pagination metadata", async () => {
    const supabase = createMovementListSupabase();

    vi.mocked(requireRequestContext).mockResolvedValue({
      orgId: "11111111-1111-4111-8111-111111111111",
      userId: "user-1",
      role: "viewer",
      supabase
    } as never);

    const request = new NextRequest("http://localhost:3000/api/stock/movements?page=2&limit=10");

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(supabase.from).toHaveBeenCalledWith("stock_movements");
    expect(supabase.select).toHaveBeenCalled();
    expect(supabase.eq).toHaveBeenCalledWith("org_id", "11111111-1111-4111-8111-111111111111");
    expect(supabase.order).toHaveBeenCalledWith("created_at", { ascending: false });
    expect(supabase.range).toHaveBeenCalledWith(10, 19);
    expect(body.data).toEqual([
      {
        id: "move-1",
        quantity_delta: -4,
        reason: "transfer",
        note: "Rack rebalance",
        created_at: "2026-04-03T10:15:00.000Z",
        material: { sku: "MAT-001", name: "Cement", uom: "bag", category: "Structural & Building Materials" },
        location: { code: "MAIN-A1", name: "Main / A1" }
      }
    ]);
    expect(body.meta).toEqual({
      page: 2,
      limit: 10,
      total: 1,
      total_pages: 1
    });
  });

  it("defaults movement pagination to 20 rows", async () => {
    const supabase = createMovementListSupabase();

    vi.mocked(requireRequestContext).mockResolvedValue({
      orgId: "11111111-1111-4111-8111-111111111111",
      userId: "user-1",
      role: "viewer",
      supabase
    } as never);

    const response = await GET(new NextRequest("http://localhost:3000/api/stock/movements"));

    expect(response.status).toBe(200);
    expect(supabase.range).toHaveBeenCalledWith(0, 19);
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { PATCH } from "@/app/api/materials/[id]/route";
import { requireMinRole, requireRequestContext } from "@/lib/api/route-context";

vi.mock("@/lib/api/route-context", () => ({
  requireRequestContext: vi.fn(),
  requireMinRole: vi.fn()
}));

function createMaterialUpdateSupabase(updatedMaterial: Record<string, unknown> | null) {
  const maybeSingle = vi.fn().mockResolvedValue({
    data: updatedMaterial,
    error: null
  });
  const select = vi.fn().mockReturnValue({ maybeSingle });
  const eqOrg = vi.fn().mockReturnValue({ select });
  const eqId = vi.fn().mockReturnValue({ eq: eqOrg });
  const update = vi.fn().mockReturnValue({ eq: eqId });

  return {
    from: vi.fn((table: string) => {
      if (table === "materials") {
        return { update };
      }
      throw new Error(`Unexpected table in test: ${table}`);
    }),
    update
  };
}

describe("PATCH /api/materials/[id] usage state", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireMinRole).mockImplementation(() => {});
  });

  it("updates material active state for managers", async () => {
    const supabase = createMaterialUpdateSupabase({
      id: "22222222-2222-4222-8222-222222222222",
      is_active: false
    });

    vi.mocked(requireRequestContext).mockResolvedValue({
      orgId: "11111111-1111-4111-8111-111111111111",
      userId: "user-1",
      role: "manager",
      supabase
    } as never);

    const request = new NextRequest("http://localhost:3000/api/materials/22222222-2222-4222-8222-222222222222", {
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

  it("updates editable material fields for managers", async () => {
    const supabase = createMaterialUpdateSupabase({
      id: "22222222-2222-4222-8222-222222222222",
      name: "Concrete mix",
      category: "Structural & Building Materials",
      subcategory: "Concrete & cement",
      min_stock: 12,
      description: "Ready-mix bags",
      sku: "MAT-001",
      uom: "BAG",
      is_active: true
    });

    vi.mocked(requireRequestContext).mockResolvedValue({
      orgId: "11111111-1111-4111-8111-111111111111",
      userId: "user-1",
      role: "manager",
      supabase
    } as never);

    const request = new NextRequest("http://localhost:3000/api/materials/22222222-2222-4222-8222-222222222222", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Concrete mix",
        category: "Structural & Building Materials",
        subcategory: "Concrete & cement",
        min_stock: 12,
        description: "Ready-mix bags"
      })
    });

    const response = await PATCH(request, {
      params: Promise.resolve({ id: "22222222-2222-4222-8222-222222222222" })
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(supabase.update).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Concrete mix",
        category: "Structural & Building Materials",
        subcategory: "Concrete & cement",
        min_stock: 12,
        description: "Ready-mix bags"
      })
    );
    expect(supabase.update).not.toHaveBeenCalledWith(expect.objectContaining({ sku: expect.anything() }));
    expect(supabase.update).not.toHaveBeenCalledWith(expect.objectContaining({ uom: expect.anything() }));
    expect(body.data.name).toBe("Concrete mix");
  });

  it("rejects immutable material number and uom updates", async () => {
    const supabase = createMaterialUpdateSupabase(null);

    vi.mocked(requireRequestContext).mockResolvedValue({
      orgId: "11111111-1111-4111-8111-111111111111",
      userId: "user-1",
      role: "manager",
      supabase
    } as never);

    const request = new NextRequest("http://localhost:3000/api/materials/22222222-2222-4222-8222-222222222222", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sku: "MAT-002", uom: "BOX" })
    });

    const response = await PATCH(request, {
      params: Promise.resolve({ id: "22222222-2222-4222-8222-222222222222" })
    });

    expect(response.status).toBe(400);
    expect(supabase.update).not.toHaveBeenCalled();
  });

  it("returns 404 when the material is outside the active group", async () => {
    const supabase = createMaterialUpdateSupabase(null);

    vi.mocked(requireRequestContext).mockResolvedValue({
      orgId: "11111111-1111-4111-8111-111111111111",
      userId: "user-1",
      role: "manager",
      supabase
    } as never);

    const request = new NextRequest("http://localhost:3000/api/materials/missing", {
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

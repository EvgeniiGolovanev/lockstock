import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { ApiError } from "@/lib/api/errors";
import { GET, POST } from "@/app/api/materials/route";
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

  const materialInsertQuery = {
    select: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({
      data: { id: "mat-1", sku: "MAT-001", name: "Cement" },
      error: null
    })
  };

  const materialListQuery = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    then: vi.fn((resolve) =>
      resolve({
        data: [],
        error: null,
        count: 0
      })
    )
  };

  const materialsTable = {
    select: vi.fn().mockReturnValue(materialListQuery),
    insert: vi.fn().mockReturnValue(materialInsertQuery)
  };

  return {
    from: vi.fn((table: string) => {
      if (table === "org_users") {
        return orgUsersQuery;
      }
      if (table === "materials") {
        return materialsTable;
      }
      throw new Error(`Unexpected table access in test: ${table}`);
    }),
    materialsTable,
    materialListQuery
  };
}

describe("POST /api/materials auth and role enforcement", () => {
  const orgId = "11111111-1111-4111-8111-111111111111";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when JWT user extraction fails", async () => {
    vi.mocked(extractBearerToken).mockReturnValue("invalid");
    vi.mocked(requireAuthenticatedUserId).mockRejectedValue(new ApiError(401, "Invalid or expired access token."));
    vi.mocked(getSupabaseUserClient).mockReturnValue(createSupabaseForRole("manager") as never);

    const request = new NextRequest("http://localhost:3000/api/materials", {
      method: "POST",
      headers: { "x-org-id": orgId, Authorization: "Bearer invalid", "Content-Type": "application/json" },
      body: JSON.stringify({ sku: "MAT-001", name: "Cement", uom: "bag", min_stock: 10 })
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toContain("Invalid or expired");
  });

  it("returns 403 when role is below manager", async () => {
    vi.mocked(extractBearerToken).mockReturnValue("token");
    vi.mocked(requireAuthenticatedUserId).mockResolvedValue("user-1");
    const supabase = createSupabaseForRole("member");
    vi.mocked(getSupabaseUserClient).mockReturnValue(supabase as never);

    const request = new NextRequest("http://localhost:3000/api/materials", {
      method: "POST",
      headers: { "x-org-id": orgId, Authorization: "Bearer token", "Content-Type": "application/json" },
      body: JSON.stringify({ sku: "MAT-001", name: "Cement", uom: "bag", min_stock: 10 })
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toContain("manager");
    expect(supabase.materialsTable.insert).not.toHaveBeenCalled();
  });

  it("allows manager to create a material with category metadata", async () => {
    vi.mocked(extractBearerToken).mockReturnValue("token");
    vi.mocked(requireAuthenticatedUserId).mockResolvedValue("user-1");
    const supabase = createSupabaseForRole("manager");
    vi.mocked(getSupabaseUserClient).mockReturnValue(supabase as never);

    const request = new NextRequest("http://localhost:3000/api/materials", {
      method: "POST",
      headers: { "x-org-id": orgId, Authorization: "Bearer token", "Content-Type": "application/json" },
      body: JSON.stringify({
        sku: "MAT-001",
        name: "Cement",
        description: "Gray cement for slab work",
        uom: "bag",
        category: "Structural & Building Materials",
        subcategory: "Concrete & cement",
        min_stock: 10
      })
    });

    const response = await POST(request);

    expect(response.status).toBe(201);
    expect(supabase.materialsTable.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        org_id: orgId,
        created_by: "user-1",
        description: "Gray cement for slab work",
        category: "Structural & Building Materials",
        subcategory: "Concrete & cement"
      })
    );
  });

  it("applies material catalog search and category filters", async () => {
    vi.mocked(extractBearerToken).mockReturnValue("token");
    vi.mocked(requireAuthenticatedUserId).mockResolvedValue("user-1");
    const supabase = createSupabaseForRole("member");
    vi.mocked(getSupabaseUserClient).mockReturnValue(supabase as never);

    const request = new NextRequest(
      "http://localhost:3000/api/materials?q=cement&category=Structural%20%26%20Building%20Materials&subcategory=Concrete%20%26%20cement&page=2&limit=10",
      {
        headers: { "x-org-id": orgId, Authorization: "Bearer token" }
      }
    );

    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(supabase.materialListQuery.or).toHaveBeenCalledWith("name.ilike.%cement%,sku.ilike.%cement%");
    expect(supabase.materialListQuery.eq).toHaveBeenCalledWith("org_id", orgId);
    expect(supabase.materialListQuery.eq).toHaveBeenCalledWith("category", "Structural & Building Materials");
    expect(supabase.materialListQuery.eq).toHaveBeenCalledWith("subcategory", "Concrete & cement");
    expect(supabase.materialListQuery.range).toHaveBeenCalledWith(10, 19);
  });
});

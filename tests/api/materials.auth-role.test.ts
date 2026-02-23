import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { ApiError } from "@/lib/api/errors";
import { POST } from "@/app/api/materials/route";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { requireAuthenticatedUserId } from "@/lib/api/auth";

vi.mock("@/lib/supabase-admin", () => ({
  getSupabaseAdmin: vi.fn()
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

  const materialsTable = {
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
    materialsTable
  };
}

describe("POST /api/materials auth and role enforcement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when JWT user extraction fails", async () => {
    vi.mocked(requireAuthenticatedUserId).mockRejectedValue(new ApiError(401, "Invalid or expired access token."));
    vi.mocked(getSupabaseAdmin).mockReturnValue(createSupabaseForRole("manager") as never);

    const request = new NextRequest("http://localhost:3000/api/materials", {
      method: "POST",
      headers: { "x-org-id": "org-1", Authorization: "Bearer invalid", "Content-Type": "application/json" },
      body: JSON.stringify({ sku: "MAT-001", name: "Cement", uom: "bag", min_stock: 10 })
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toContain("Invalid or expired");
  });

  it("returns 403 when role is below manager", async () => {
    vi.mocked(requireAuthenticatedUserId).mockResolvedValue("user-1");
    const supabase = createSupabaseForRole("member");
    vi.mocked(getSupabaseAdmin).mockReturnValue(supabase as never);

    const request = new NextRequest("http://localhost:3000/api/materials", {
      method: "POST",
      headers: { "x-org-id": "org-1", Authorization: "Bearer token", "Content-Type": "application/json" },
      body: JSON.stringify({ sku: "MAT-001", name: "Cement", uom: "bag", min_stock: 10 })
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toContain("manager");
    expect(supabase.materialsTable.insert).not.toHaveBeenCalled();
  });
});

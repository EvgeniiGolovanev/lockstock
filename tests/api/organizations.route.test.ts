import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST } from "@/app/api/organizations/route";
import { DELETE, PATCH } from "@/app/api/organizations/[id]/route";
import { getSupabaseUserClient } from "@/lib/supabase-user";
import { extractBearerToken, requireAuthenticatedUserId } from "@/lib/api/auth";

vi.mock("@/lib/supabase-user", () => ({
  getSupabaseUserClient: vi.fn()
}));

vi.mock("@/lib/api/auth", () => ({
  extractBearerToken: vi.fn(),
  requireAuthenticatedUserId: vi.fn()
}));

type Role = "viewer" | "member" | "manager" | "owner";

function createSupabaseForOrganizations(role: Role = "owner") {
  const listMembershipsQuery = {
    eq: vi.fn().mockResolvedValue({
      data: [
        {
          role: "owner",
          organization: {
            id: "11111111-1111-4111-8111-111111111111",
            name: "Alex Group",
            created_at: "2026-05-03T00:00:00Z"
          }
        }
      ],
      error: null
    })
  };

  const updateOrganizationResult = {
    maybeSingle: vi.fn().mockResolvedValue({
      data: {
        id: "11111111-1111-4111-8111-111111111111",
        name: "Renamed Group",
        created_at: "2026-05-03T00:00:00Z"
      },
      error: null
    })
  };

  const updateOrganizationQuery = {
    eq: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnValue(updateOrganizationResult)
  };

  const organizationsTable = {
    select: vi.fn().mockReturnValue(listMembershipsQuery),
    update: vi.fn().mockReturnValue(updateOrganizationQuery),
    delete: vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null })
    })
  };

  const orgUsersTable = {
    select: vi.fn().mockImplementation((columns: string) => {
      if (columns.includes("organization:organizations")) {
        return listMembershipsQuery;
      }
      return orgUsersTable;
    }),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: { role }, error: null })
  };

  return {
    rpc: vi.fn().mockResolvedValue({
      data: { id: "22222222-2222-4222-8222-222222222222" },
      error: null
    }),
    from: vi.fn((table: string) => {
      if (table === "organizations") {
        return organizationsTable;
      }
      if (table === "org_users") {
        return orgUsersTable;
      }
      throw new Error(`Unexpected table access in test: ${table}`);
    }),
    organizationsTable,
    orgUsersTable
  };
}

describe("organization group endpoints", () => {
  const orgId = "11111111-1111-4111-8111-111111111111";

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(extractBearerToken).mockReturnValue("token");
    vi.mocked(requireAuthenticatedUserId).mockResolvedValue("user-1");
  });

  it("lists groups for the authenticated user", async () => {
    const supabase = createSupabaseForOrganizations();
    vi.mocked(getSupabaseUserClient).mockReturnValue(supabase as never);

    const request = new NextRequest("http://localhost:3000/api/organizations", {
      method: "GET",
      headers: { Authorization: "Bearer token" }
    });

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data[0].organization.name).toBe("Alex Group");
  });

  it("creates another group for the authenticated user", async () => {
    const supabase = createSupabaseForOrganizations();
    vi.mocked(getSupabaseUserClient).mockReturnValue(supabase as never);

    const request = new NextRequest("http://localhost:3000/api/organizations", {
      method: "POST",
      headers: { Authorization: "Bearer token", "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Second Group" })
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.data.id).toBe("22222222-2222-4222-8222-222222222222");
    expect(supabase.rpc).toHaveBeenCalledWith("create_organization_with_owner", {
      p_name: "Second Group"
    });
  });

  it("renames a group for an owner", async () => {
    const supabase = createSupabaseForOrganizations("owner");
    vi.mocked(getSupabaseUserClient).mockReturnValue(supabase as never);

    const request = new NextRequest(`http://localhost:3000/api/organizations/${orgId}`, {
      method: "PATCH",
      headers: { "x-org-id": orgId, Authorization: "Bearer token", "Content-Type": "application/json" },
      body: JSON.stringify({ name: " Renamed Group " })
    });

    const response = await PATCH(request, { params: Promise.resolve({ id: orgId }) });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.name).toBe("Renamed Group");
    expect(supabase.organizationsTable.update).toHaveBeenCalledWith({ name: "Renamed Group" });
  });

  it("rejects group rename for a non-owner", async () => {
    const supabase = createSupabaseForOrganizations("manager");
    vi.mocked(getSupabaseUserClient).mockReturnValue(supabase as never);

    const request = new NextRequest(`http://localhost:3000/api/organizations/${orgId}`, {
      method: "PATCH",
      headers: { "x-org-id": orgId, Authorization: "Bearer token", "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Renamed Group" })
    });

    const response = await PATCH(request, { params: Promise.resolve({ id: orgId }) });
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toContain("owner");
  });

  it("deletes a group for an owner", async () => {
    const supabase = createSupabaseForOrganizations("owner");
    vi.mocked(getSupabaseUserClient).mockReturnValue(supabase as never);

    const request = new NextRequest(`http://localhost:3000/api/organizations/${orgId}`, {
      method: "DELETE",
      headers: { "x-org-id": orgId, Authorization: "Bearer token" }
    });

    const response = await DELETE(request, { params: Promise.resolve({ id: orgId }) });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toEqual({ id: orgId, deleted: true });
    expect(supabase.organizationsTable.delete).toHaveBeenCalledOnce();
  });

  it("rejects group deletion for a non-owner", async () => {
    const supabase = createSupabaseForOrganizations("member");
    vi.mocked(getSupabaseUserClient).mockReturnValue(supabase as never);

    const request = new NextRequest(`http://localhost:3000/api/organizations/${orgId}`, {
      method: "DELETE",
      headers: { "x-org-id": orgId, Authorization: "Bearer token" }
    });

    const response = await DELETE(request, { params: Promise.resolve({ id: orgId }) });
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toContain("owner");
    expect(supabase.organizationsTable.delete).not.toHaveBeenCalled();
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { DELETE, PATCH } from "@/app/api/organizations/[id]/members/[userId]/route";
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

function createSupabaseForRole(role: Role) {
  let orgUsersMaybeSingleCalls = 0;

  const patchUpdateResult = {
    maybeSingle: vi.fn().mockResolvedValue({
      data: { user_id: "target-user", role: "manager", created_at: "2026-03-03T00:00:00Z" },
      error: null
    })
  };

  const patchUpdateQuery = {
    eq: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnValue(patchUpdateResult)
  };

  const orgUsersDeleteQuery = {
    eq: vi.fn().mockReturnThis()
  };

  const orgUsersTable = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockImplementation(async () => {
      orgUsersMaybeSingleCalls += 1;
      if (orgUsersMaybeSingleCalls === 1) {
        return { data: { role }, error: null };
      }
      return { data: { user_id: "target-user", role: "member" }, error: null };
    }),
    update: vi.fn().mockReturnValue(patchUpdateQuery),
    delete: vi.fn().mockReturnValue(orgUsersDeleteQuery)
  };

  const teamsTable = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockResolvedValue({ data: [{ id: "team-default" }], error: null })
  };

  const teamMembersDeleteQuery = {
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockResolvedValue({ error: null })
  };

  const teamMembersTable = {
    delete: vi.fn().mockReturnValue(teamMembersDeleteQuery)
  };

  return {
    from: vi.fn((table: string) => {
      if (table === "org_users") {
        return orgUsersTable;
      }
      if (table === "teams") {
        return teamsTable;
      }
      if (table === "team_members") {
        return teamMembersTable;
      }
      throw new Error(`Unexpected table access in test: ${table}`);
    }),
    orgUsersTable,
    teamMembersTable
  };
}

describe("PATCH/DELETE /api/organizations/[id]/members/[userId]", () => {
  const orgId = "11111111-1111-4111-8111-111111111111";
  const targetUserId = "22222222-2222-4222-8222-222222222222";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 403 for non-owner role on PATCH", async () => {
    vi.mocked(extractBearerToken).mockReturnValue("token");
    vi.mocked(requireAuthenticatedUserId).mockResolvedValue("user-1");
    const supabase = createSupabaseForRole("manager");
    vi.mocked(getSupabaseUserClient).mockReturnValue(supabase as never);

    const request = new NextRequest(`http://localhost:3000/api/organizations/${orgId}/members/${targetUserId}`, {
      method: "PATCH",
      headers: { "x-org-id": orgId, Authorization: "Bearer token", "Content-Type": "application/json" },
      body: JSON.stringify({ role: "manager" })
    });

    const response = await PATCH(request, { params: Promise.resolve({ id: orgId, userId: targetUserId }) });
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toContain("owner");
  });

  it("updates member role for owner", async () => {
    vi.mocked(extractBearerToken).mockReturnValue("token");
    vi.mocked(requireAuthenticatedUserId).mockResolvedValue("owner-1");
    const supabase = createSupabaseForRole("owner");
    vi.mocked(getSupabaseUserClient).mockReturnValue(supabase as never);

    const request = new NextRequest(`http://localhost:3000/api/organizations/${orgId}/members/${targetUserId}`, {
      method: "PATCH",
      headers: { "x-org-id": orgId, Authorization: "Bearer token", "Content-Type": "application/json" },
      body: JSON.stringify({ role: "manager" })
    });

    const response = await PATCH(request, { params: Promise.resolve({ id: orgId, userId: targetUserId }) });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.user_id).toBe("target-user");
    expect(body.data.role).toBe("manager");
  });

  it("removes member and team memberships for owner", async () => {
    vi.mocked(extractBearerToken).mockReturnValue("token");
    vi.mocked(requireAuthenticatedUserId).mockResolvedValue("owner-1");
    const supabase = createSupabaseForRole("owner");
    vi.mocked(getSupabaseUserClient).mockReturnValue(supabase as never);

    const request = new NextRequest(`http://localhost:3000/api/organizations/${orgId}/members/${targetUserId}`, {
      method: "DELETE",
      headers: { "x-org-id": orgId, Authorization: "Bearer token" }
    });

    const response = await DELETE(request, { params: Promise.resolve({ id: orgId, userId: targetUserId }) });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.removed).toBe(true);
    expect(supabase.orgUsersTable.delete).toHaveBeenCalledOnce();
    expect(supabase.teamMembersTable.delete).toHaveBeenCalledOnce();
  });
});

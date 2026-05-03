import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET as GET_PENDING } from "@/app/api/invitations/pending/route";
import { POST as POST_ACCEPT } from "@/app/api/invitations/[id]/accept/route";
import { POST as POST_REJECT } from "@/app/api/invitations/[id]/reject/route";
import { getSupabaseUserClient } from "@/lib/supabase-user";
import { extractBearerToken, requireAuthenticatedUserId } from "@/lib/api/auth";

vi.mock("@/lib/supabase-user", () => ({
  getSupabaseUserClient: vi.fn()
}));

vi.mock("@/lib/api/auth", () => ({
  extractBearerToken: vi.fn(),
  requireAuthenticatedUserId: vi.fn()
}));

function createSupabaseForInvitations({
  invitationFound = true,
  memberOrgIds = [],
  memberships,
  invitationRows
}: {
  invitationFound?: boolean;
  memberOrgIds?: string[];
  memberships?: Array<{ org_id: string; role: string }>;
  invitationRows?: Array<Record<string, string>>;
}) {
  const invitationRow = {
    id: "11111111-1111-4111-8111-111111111112",
    org_id: "11111111-1111-4111-8111-111111111111",
    org_name: "Invited Org",
    role: "member",
    email: "invitee@example.com",
    status: "pending",
    expires_at: "2026-03-11T00:00:00Z",
    created_at: "2026-03-04T00:00:00Z"
  };
  const rows = invitationRows ?? [invitationRow];

  const orgInvitationsTable = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    gt: vi.fn().mockReturnThis(),
    order: vi.fn().mockResolvedValue({ data: rows, error: null }),
    maybeSingle: vi.fn().mockResolvedValue(invitationFound ? { data: invitationRow, error: null } : { data: null, error: null }),
    update: vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null })
    })
  };

  const orgUsersMembershipSelectQuery = {
    eq: vi.fn().mockResolvedValue({
      data: memberships ?? memberOrgIds.map((orgId) => ({ org_id: orgId, role: "member" })),
      error: null
    })
  };

  const orgUsersTable = {
    select: vi.fn().mockReturnValue(orgUsersMembershipSelectQuery),
    upsert: vi.fn().mockResolvedValue({ error: null })
  };

  const teamsTable = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: { id: "team-default" }, error: null })
  };

  const teamMembersTable = {
    upsert: vi.fn().mockResolvedValue({ error: null })
  };

  return {
    rpc: vi.fn().mockImplementation((fn: string) => {
      if (fn === "accept_org_invitation") {
        return Promise.resolve(
          invitationFound
            ? {
                data: [
                  {
                    id: invitationRow.id,
                    org_id: invitationRow.org_id,
                    org_name: invitationRow.org_name,
                    membership_role: "member"
                  }
                ],
                error: null
              }
            : { data: null, error: { message: "Pending invitation not found" } }
        );
      }
      if (fn === "reject_org_invitation") {
        return Promise.resolve(
          invitationFound
            ? {
                data: [
                  {
                    id: invitationRow.id,
                    org_id: invitationRow.org_id,
                    org_name: invitationRow.org_name,
                    status: "revoked"
                  }
                ],
                error: null
              }
            : { data: null, error: { message: "Pending invitation not found" } }
        );
      }
      throw new Error(`Unexpected rpc in test: ${fn}`);
    }),
    from: vi.fn((table: string) => {
      if (table === "org_invitations") {
        return orgInvitationsTable;
      }
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
    orgInvitationsTable,
    orgUsersTable,
    orgUsersMembershipSelectQuery,
    teamMembersTable
  };
}

describe("Invitation endpoints", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads pending invitations for authenticated user", async () => {
    vi.mocked(extractBearerToken).mockReturnValue("token");
    vi.mocked(requireAuthenticatedUserId).mockResolvedValue("invitee-user-id");
    const supabase = createSupabaseForInvitations({ invitationFound: true });
    vi.mocked(getSupabaseUserClient).mockReturnValue(supabase as never);

    const request = new NextRequest("http://localhost:3000/api/invitations/pending", {
      method: "GET",
      headers: { Authorization: "Bearer token" }
    });

    const response = await GET_PENDING(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].id).toBe("11111111-1111-4111-8111-111111111112");
    expect(body.data[0].organization_name).toBe("Invited Org");
    expect(body.data[0].direction).toBe("received");
    expect(body.data[0].email).toBe("invitee@example.com");
  });

  it("combines received invitations with owner sent invitations", async () => {
    vi.mocked(extractBearerToken).mockReturnValue("token");
    vi.mocked(requireAuthenticatedUserId).mockResolvedValue("owner-user-id");
    const ownedOrgId = "22222222-2222-4222-8222-222222222222";
    const supabase = createSupabaseForInvitations({
      memberships: [
        { org_id: "11111111-1111-4111-8111-111111111111", role: "member" },
        { org_id: ownedOrgId, role: "owner" }
      ],
      invitationRows: [
        {
          id: "received-invite",
          org_id: "33333333-3333-4333-8333-333333333333",
          org_name: "External Org",
          role: "member",
          email: "owner@example.com",
          status: "pending",
          expires_at: "2026-03-11T00:00:00Z",
          created_at: "2026-03-04T00:00:00Z"
        },
        {
          id: "sent-invite",
          org_id: ownedOrgId,
          org_name: "Owned Org",
          role: "member",
          email: "new.user@example.com",
          status: "pending",
          expires_at: "2026-03-12T00:00:00Z",
          created_at: "2026-03-05T00:00:00Z"
        },
        {
          id: "hidden-member-invite",
          org_id: "11111111-1111-4111-8111-111111111111",
          org_name: "Existing Org",
          role: "member",
          email: "owner@example.com",
          status: "pending",
          expires_at: "2026-03-13T00:00:00Z",
          created_at: "2026-03-06T00:00:00Z"
        }
      ]
    });
    vi.mocked(getSupabaseUserClient).mockReturnValue(supabase as never);

    const request = new NextRequest("http://localhost:3000/api/invitations/pending", {
      method: "GET",
      headers: { Authorization: "Bearer token" }
    });

    const response = await GET_PENDING(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toHaveLength(2);
    expect(body.data.map((invitation: { id: string }) => invitation.id)).toEqual(["received-invite", "sent-invite"]);
    expect(body.data[0].direction).toBe("received");
    expect(body.data[1].direction).toBe("sent");
    expect(body.data[1].email).toBe("new.user@example.com");
  });

  it("hides pending invitations for organizations user already belongs to", async () => {
    vi.mocked(extractBearerToken).mockReturnValue("token");
    vi.mocked(requireAuthenticatedUserId).mockResolvedValue("invitee-user-id");
    const supabase = createSupabaseForInvitations({
      invitationFound: true,
      memberOrgIds: ["11111111-1111-4111-8111-111111111111"]
    });
    vi.mocked(getSupabaseUserClient).mockReturnValue(supabase as never);

    const request = new NextRequest("http://localhost:3000/api/invitations/pending", {
      method: "GET",
      headers: { Authorization: "Bearer token" }
    });

    const response = await GET_PENDING(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toHaveLength(0);
    expect(supabase.orgUsersTable.select).toHaveBeenCalledOnce();
    expect(supabase.orgUsersMembershipSelectQuery.eq).toHaveBeenCalledWith("user_id", "invitee-user-id");
  });

  it("accepts invitation by invitation id", async () => {
    vi.mocked(extractBearerToken).mockReturnValue("token");
    vi.mocked(requireAuthenticatedUserId).mockResolvedValue("invitee-user-id");
    const supabase = createSupabaseForInvitations({ invitationFound: true });
    vi.mocked(getSupabaseUserClient).mockReturnValue(supabase as never);

    const request = new NextRequest("http://localhost:3000/api/invitations/11111111-1111-4111-8111-111111111112/accept", {
      method: "POST",
      headers: { Authorization: "Bearer token" }
    });

    const response = await POST_ACCEPT(request, {
      params: Promise.resolve({ id: "11111111-1111-4111-8111-111111111112" })
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.org_id).toBe("11111111-1111-4111-8111-111111111111");
    expect(body.data.organization_name).toBe("Invited Org");
    expect(body.data.membership_role).toBe("member");
    expect(supabase.rpc).toHaveBeenCalledWith("accept_org_invitation", {
      p_invitation_id: "11111111-1111-4111-8111-111111111112"
    });
  });

  it("rejects invitation by invitation id", async () => {
    vi.mocked(extractBearerToken).mockReturnValue("token");
    vi.mocked(requireAuthenticatedUserId).mockResolvedValue("invitee-user-id");
    const supabase = createSupabaseForInvitations({ invitationFound: true });
    vi.mocked(getSupabaseUserClient).mockReturnValue(supabase as never);

    const request = new NextRequest("http://localhost:3000/api/invitations/11111111-1111-4111-8111-111111111112/reject", {
      method: "POST",
      headers: { Authorization: "Bearer token" }
    });

    const response = await POST_REJECT(request, {
      params: Promise.resolve({ id: "11111111-1111-4111-8111-111111111112" })
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.invitation_id).toBe("11111111-1111-4111-8111-111111111112");
    expect(body.data.status).toBe("revoked");
    expect(supabase.rpc).toHaveBeenCalledWith("reject_org_invitation", {
      p_invitation_id: "11111111-1111-4111-8111-111111111112"
    });
    expect(supabase.orgUsersTable.upsert).not.toHaveBeenCalled();
  });

  it("returns 404 when accepting an inactive or missing invitation", async () => {
    vi.mocked(extractBearerToken).mockReturnValue("token");
    vi.mocked(requireAuthenticatedUserId).mockResolvedValue("invitee-user-id");
    const supabase = createSupabaseForInvitations({ invitationFound: false });
    vi.mocked(getSupabaseUserClient).mockReturnValue(supabase as never);

    const request = new NextRequest("http://localhost:3000/api/invitations/22222222-2222-4222-8222-222222222222/accept", {
      method: "POST",
      headers: { Authorization: "Bearer token" }
    });

    const response = await POST_ACCEPT(request, {
      params: Promise.resolve({ id: "22222222-2222-4222-8222-222222222222" })
    });
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toContain("not found");
    expect(supabase.rpc).toHaveBeenCalledOnce();
  });
});

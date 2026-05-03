import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST } from "@/app/api/organizations/[id]/members/route";
import { getSupabaseUserClient } from "@/lib/supabase-user";
import { extractBearerToken, requireAuthenticatedUserId } from "@/lib/api/auth";
import { sendTransactionalEmail } from "@/lib/api/mailer";

vi.mock("@/lib/supabase-user", () => ({
  getSupabaseUserClient: vi.fn()
}));

vi.mock("@/lib/api/auth", () => ({
  extractBearerToken: vi.fn(),
  requireAuthenticatedUserId: vi.fn()
}));

vi.mock("@/lib/api/mailer", () => ({
  sendTransactionalEmail: vi.fn()
}));

type Role = "viewer" | "member" | "manager" | "owner";

function createSupabaseForRole(role: Role) {
  let orgUsersMaybeSingleCalls = 0;

  const orgUsersTable = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockResolvedValue({
      data: [
        {
          user_id: "owner-1",
          role: "owner",
          created_at: "2026-03-01T00:00:00Z"
        },
        {
          user_id: "member-1",
          role: "member",
          created_at: "2026-03-02T00:00:00Z"
        }
      ],
      error: null
    }),
    maybeSingle: vi.fn().mockImplementation(async () => {
      orgUsersMaybeSingleCalls += 1;
      if (orgUsersMaybeSingleCalls === 1) {
        return { data: { role }, error: null };
      }
      return { data: null, error: null };
    })
  };

  const organizationsTable = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: { name: "LockStock Org" }, error: null })
  };

  const orgInvitationsTable = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockResolvedValue({
      data: [
        {
          accepted_by: "member-1",
          email: "member@example.com",
          status: "accepted"
        }
      ],
      error: null
    }),
    update: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockResolvedValue({ error: null })
    }),
    insert: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { id: "invite-1", email: "new.user@example.com", status: "pending" },
        error: null
      })
    })
  };

  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: "owner-1", email: "owner@example.com" } },
        error: null
      })
    },
    from: vi.fn((table: string) => {
      if (table === "org_users") {
        return orgUsersTable;
      }
      if (table === "organizations") {
        return organizationsTable;
      }
      if (table === "org_invitations") {
        return orgInvitationsTable;
      }
      throw new Error(`Unexpected table access in test: ${table}`);
    }),
    orgUsersTable,
    organizationsTable,
    orgInvitationsTable
  };
}

describe("POST /api/organizations/[id]/members owner-only management", () => {
  const orgId = "11111111-1111-4111-8111-111111111111";

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(sendTransactionalEmail).mockResolvedValue();
  });

  it("loads organization members with display identity fields", async () => {
    vi.mocked(extractBearerToken).mockReturnValue("token");
    vi.mocked(requireAuthenticatedUserId).mockResolvedValue("owner-1");
    const supabase = createSupabaseForRole("owner");
    vi.mocked(getSupabaseUserClient).mockReturnValue(supabase as never);

    const request = new NextRequest(`http://localhost:3000/api/organizations/${orgId}/members`, {
      method: "GET",
      headers: { "x-org-id": orgId, Authorization: "Bearer token" }
    });

    const response = await GET(request, { params: Promise.resolve({ id: orgId }) });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toEqual([
      {
        user_id: "owner-1",
        email: "owner@example.com",
        full_name: null,
        role: "owner",
        created_at: "2026-03-01T00:00:00Z"
      },
      {
        user_id: "member-1",
        email: "member@example.com",
        full_name: null,
        role: "member",
        created_at: "2026-03-02T00:00:00Z"
      }
    ]);
  });

  it("returns 403 when caller is not owner", async () => {
    vi.mocked(extractBearerToken).mockReturnValue("token");
    vi.mocked(requireAuthenticatedUserId).mockResolvedValue("user-1");
    const supabase = createSupabaseForRole("manager");
    vi.mocked(getSupabaseUserClient).mockReturnValue(supabase as never);

    const request = new NextRequest(`http://localhost:3000/api/organizations/${orgId}/members`, {
      method: "POST",
      headers: { "x-org-id": orgId, Authorization: "Bearer token", "Content-Type": "application/json" },
      body: JSON.stringify({ email: "new.user@example.com" })
    });

    const response = await POST(request, { params: Promise.resolve({ id: orgId }) });
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toContain("owner");
  });

  it("creates invitation and supersedes old pending invites for owner", async () => {
    vi.mocked(extractBearerToken).mockReturnValue("token");
    vi.mocked(requireAuthenticatedUserId).mockResolvedValue("owner-1");
    const supabase = createSupabaseForRole("owner");
    vi.mocked(getSupabaseUserClient).mockReturnValue(supabase as never);

    const request = new NextRequest(`http://localhost:3000/api/organizations/${orgId}/members`, {
      method: "POST",
      headers: { "x-org-id": orgId, Authorization: "Bearer token", "Content-Type": "application/json" },
      body: JSON.stringify({ email: "new.user@example.com" })
    });

    const response = await POST(request, { params: Promise.resolve({ id: orgId }) });
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.data.mode).toBe("invited");
    expect(body.data.email).toBe("new.user@example.com");
    expect(body.data.expires_in_days).toBe(7);
    expect(body.data.email_delivery).toBe("sent");
    expect(supabase.orgInvitationsTable.update).toHaveBeenCalledOnce();
    expect(supabase.orgInvitationsTable.insert).toHaveBeenCalledOnce();
    expect(supabase.organizationsTable.maybeSingle).toHaveBeenCalledOnce();
    expect(sendTransactionalEmail).toHaveBeenCalledOnce();
  });

  it("rejects self-invitation for owner email", async () => {
    vi.mocked(extractBearerToken).mockReturnValue("token");
    vi.mocked(requireAuthenticatedUserId).mockResolvedValue("owner-1");
    const supabase = createSupabaseForRole("owner");
    vi.mocked(getSupabaseUserClient).mockReturnValue(supabase as never);

    const request = new NextRequest(`http://localhost:3000/api/organizations/${orgId}/members`, {
      method: "POST",
      headers: { "x-org-id": orgId, Authorization: "Bearer token", "Content-Type": "application/json" },
      body: JSON.stringify({ email: "owner@example.com" })
    });

    const response = await POST(request, { params: Promise.resolve({ id: orgId }) });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain("own account");
    expect(supabase.orgInvitationsTable.insert).not.toHaveBeenCalled();
  });

  it("still creates invitation when email provider env is missing", async () => {
    vi.mocked(extractBearerToken).mockReturnValue("token");
    vi.mocked(requireAuthenticatedUserId).mockResolvedValue("owner-1");
    vi.mocked(sendTransactionalEmail).mockRejectedValue(new Error("Missing required environment variable: RESEND_API_KEY"));
    const supabase = createSupabaseForRole("owner");
    vi.mocked(getSupabaseUserClient).mockReturnValue(supabase as never);

    const request = new NextRequest(`http://localhost:3000/api/organizations/${orgId}/members`, {
      method: "POST",
      headers: { "x-org-id": orgId, Authorization: "Bearer token", "Content-Type": "application/json" },
      body: JSON.stringify({ email: "new.user@example.com" })
    });

    const response = await POST(request, { params: Promise.resolve({ id: orgId }) });
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.data.email_delivery).toBe("skipped");
    expect(body.data.email_delivery_message).toContain("not configured");
    expect(supabase.orgInvitationsTable.insert).toHaveBeenCalledOnce();
  });
});

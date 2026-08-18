import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { GET, POST } from "@/app/api/teams/route";
import { requireMinRole, requireRequestContext } from "@/lib/api/route-context";

vi.mock("@/lib/api/route-context", () => ({
  requireRequestContext: vi.fn(),
  requireMinRole: vi.fn()
}));

describe("POST /api/teams atomic creation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireMinRole).mockImplementation(() => {});
  });

  it("creates a team through the atomic RPC and returns the created row", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        id: "team-1",
        org_id: "org-1",
        name: "Field Crew",
        description: "Night shift",
        created_by: "user-1",
        is_default: false
      },
      error: null
    });

    vi.mocked(requireRequestContext).mockResolvedValue({
      orgId: "org-1",
      userId: "user-1",
      role: "manager",
      supabase: { rpc } as never
    } as never);

    const request = new NextRequest("http://localhost:3000/api/teams", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Field Crew", description: "Night shift" })
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(rpc).toHaveBeenCalledWith(
      "create_team_with_owner",
      expect.objectContaining({
        p_org_id: "org-1",
        p_name: "Field Crew",
        p_description: "Night shift"
      })
    );
    expect(body.data.name).toBe("Field Crew");
    expect(body.data.created_by).toBe("user-1");
  });
});

describe("GET /api/teams pagination", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns bounded teams with pagination metadata", async () => {
    const range = vi.fn().mockResolvedValue({
      data: [
        {
          id: "team-1",
          org_id: "org-1",
          name: "Field Crew",
          created_at: "2026-08-01T09:00:00.000Z",
          members: [{ user_id: "user-1" }]
        }
      ],
      error: null,
      count: 2
    });
    const order = vi.fn().mockReturnValue({ range });
    const eq = vi.fn().mockReturnValue({ order });
    const select = vi.fn().mockReturnValue({ eq });
    const from = vi.fn().mockReturnValue({ select });

    vi.mocked(requireRequestContext).mockResolvedValue({
      orgId: "org-1",
      userId: "user-1",
      role: "member",
      supabase: { from } as never
    } as never);

    const response = await GET(new NextRequest("http://localhost:3000/api/teams?page=2&limit=1"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(from).toHaveBeenCalledWith("teams");
    expect(select).toHaveBeenCalledWith("*, members:team_members(user_id)", { count: "exact" });
    expect(order).toHaveBeenCalledWith("created_at", { ascending: false });
    expect(range).toHaveBeenCalledWith(1, 1);
    expect(body.meta).toEqual({
      page: 2,
      limit: 1,
      total: 2,
      total_pages: 2
    });
    expect(body.data).toHaveLength(1);
  });
});

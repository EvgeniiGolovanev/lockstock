import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "@/app/api/audit-log/route";
import { ApiError } from "@/lib/api/errors";
import { hasMinRole, requireMinRole, requireRequestContext } from "@/lib/api/route-context";

vi.mock("@/lib/api/route-context", () => ({
  requireRequestContext: vi.fn(),
  requireMinRole: vi.fn(),
  hasMinRole: vi.fn()
}));

const orgId = "11111111-1111-4111-8111-111111111111";

function createAuditListSupabase() {
  const query = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    range: vi.fn().mockResolvedValue({
    data: [
      {
        id: "audit-1",
        org_id: orgId,
        actor_user_id: "user-1",
        action: "created",
        entity_type: "material",
        entity_id: "22222222-2222-4222-8222-222222222222",
        entity_label: "MAT-001",
        message: "Material created: MAT-001",
        metadata: { name: "Cement" },
        created_at: "2026-05-06T08:15:00.000Z"
      }
    ],
    error: null,
    count: 1
    })
  };

  return {
    from: vi.fn(() => query),
    ...query
  };
}

function createAuditExportSupabase() {
  const query = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockResolvedValue({
    data: [
      {
        created_at: "2026-05-06T08:15:00.000Z",
        actor_user_id: "user-1",
        action: "updated",
        entity_type: "supplier",
        entity_id: "33333333-3333-4333-8333-333333333333",
        entity_label: "ACME",
        message: "Supplier updated: ACME",
        metadata: { is_active: false }
      }
    ],
    error: null
    })
  };

  return {
    from: vi.fn(() => query),
    ...query
  };
}

describe("GET /api/audit-log", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireMinRole).mockImplementation((role, minimumRole) => {
      if (role === "viewer" && minimumRole === "member") {
        throw new ApiError(403, "This action requires member role or higher.");
      }
    });
    vi.mocked(hasMinRole).mockImplementation((role, minimumRole) => {
      const rank = { viewer: 0, member: 1, manager: 2, owner: 3 } as const;
      return rank[role] >= rank[minimumRole];
    });
  });

  it("returns only own latest audit entries for a member", async () => {
    const supabase = createAuditListSupabase();
    vi.mocked(requireRequestContext).mockResolvedValue({
      orgId,
      userId: "user-1",
      role: "member",
      supabase
    } as never);

    const response = await GET(new NextRequest("http://localhost:3000/api/audit-log"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(supabase.from).toHaveBeenCalledWith("audit_log");
    expect(supabase.eq).toHaveBeenCalledWith("org_id", orgId);
    expect(supabase.eq).toHaveBeenCalledWith("actor_user_id", "user-1");
    expect(supabase.order).toHaveBeenCalledWith("created_at", { ascending: false });
    expect(supabase.limit).toHaveBeenCalledWith(20);
    expect(body.data[0].message).toBe("Material created: MAT-001");
  });

  it("blocks CSV export for viewer role", async () => {
    const supabase = createAuditExportSupabase();
    vi.mocked(requireRequestContext).mockResolvedValue({
      orgId,
      userId: "user-1",
      role: "viewer",
      supabase
    } as never);

    const response = await GET(
      new NextRequest("http://localhost:3000/api/audit-log?format=csv&from=2026-05-01&to=2026-05-06")
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toContain("member");
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it("exports a member CSV scoped to own actions", async () => {
    const supabase = createAuditExportSupabase();
    vi.mocked(requireRequestContext).mockResolvedValue({
      orgId,
      userId: "user-1",
      role: "member",
      supabase
    } as never);

    const response = await GET(
      new NextRequest("http://localhost:3000/api/audit-log?format=csv&from=2026-05-01&to=2026-05-06")
    );

    expect(response.status).toBe(200);
    expect(supabase.eq).toHaveBeenCalledWith("org_id", orgId);
    expect(supabase.eq).toHaveBeenCalledWith("actor_user_id", "user-1");
  });

  it("exports a manager CSV for the requested date range", async () => {
    const supabase = createAuditExportSupabase();
    vi.mocked(requireRequestContext).mockResolvedValue({
      orgId,
      userId: "user-1",
      role: "manager",
      supabase
    } as never);

    const response = await GET(
      new NextRequest("http://localhost:3000/api/audit-log?format=csv&from=2026-05-01&to=2026-05-06")
    );
    const csv = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/csv");
    expect(response.headers.get("content-disposition")).toContain("audit-log-2026-05-01-2026-05-06.csv");
    expect(supabase.gte).toHaveBeenCalledWith("created_at", "2026-05-01T00:00:00.000Z");
    expect(supabase.lte).toHaveBeenCalledWith("created_at", "2026-05-06T23:59:59.999Z");
    expect(csv).toContain("created_at,actor_user_id,action,entity_type,entity_id,entity_label,message,metadata");
    expect(csv).toContain('"Supplier updated: ACME"');
  });
});

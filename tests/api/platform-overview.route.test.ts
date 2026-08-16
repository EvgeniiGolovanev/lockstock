import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "@/app/api/platform/overview/route";
import { ApiError } from "@/lib/api/errors";
import { requirePlatformAdmin, logPlatformAccess } from "@/lib/api/platform-admin";

vi.mock("@/lib/api/platform-admin", () => ({
  requirePlatformAdmin: vi.fn(),
  logPlatformAccess: vi.fn()
}));

function tableQuery(result: unknown) {
  const query = {
    select: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    ilike: vi.fn().mockReturnThis(),
    then: (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve)
  };

  return query;
}

function createPlatformSupabase() {
  const responses: Record<string, unknown> = {
    organizations: {
      data: [
        {
          id: "11111111-1111-4111-8111-111111111111",
          name: "Northstar Materials",
          created_at: "2026-05-01T09:00:00.000Z",
          updated_at: "2026-05-14T10:00:00.000Z"
        }
      ],
      error: null,
      count: 1
    },
    org_users: {
      data: [
        { org_id: "11111111-1111-4111-8111-111111111111", user_id: "user-1", role: "owner" },
        { org_id: "11111111-1111-4111-8111-111111111111", user_id: "user-2", role: "manager" }
      ],
      error: null
    },
    user_profiles: { data: null, error: null, count: 2 },
    materials: {
      data: [{ org_id: "11111111-1111-4111-8111-111111111111", id: "material-1" }],
      error: null
    },
    locations: {
      data: [{ org_id: "11111111-1111-4111-8111-111111111111", id: "location-1" }],
      error: null
    },
    stock_movements: {
      data: [
        {
          org_id: "11111111-1111-4111-8111-111111111111",
          id: "movement-1",
          created_at: "2026-05-14T08:00:00.000Z"
        }
      ],
      error: null
    },
    purchase_orders: {
      data: [{ org_id: "11111111-1111-4111-8111-111111111111", id: "po-1", status: "sent" }],
      error: null
    },
    organization_billing: {
      data: [
        {
          org_id: "11111111-1111-4111-8111-111111111111",
          plan: "operations",
          status: "trialing",
          billing_interval: "monthly",
          current_period_end: "2026-06-01",
          trial_ends_at: "2026-05-22T00:00:00.000Z",
          updated_at: "2026-05-14T00:00:00.000Z"
        }
      ],
      error: null
    },
    audit_log: {
      data: [
        {
          id: "audit-1",
          org_id: "11111111-1111-4111-8111-111111111111",
          actor_user_id: "user-1",
          action: "created",
          entity_type: "material",
          entity_label: "MAT-001",
          message: "Material created: MAT-001",
          metadata: { actor_email: "ava@example.com" },
          created_at: "2026-05-14T08:00:00.000Z"
        }
      ],
      error: null
    }
  };

  const queries: Record<string, ReturnType<typeof tableQuery>> = {};
  const supabase = {
    from: vi.fn((table: string) => {
      const query = tableQuery(responses[table]);
      queries[table] = query;
      return query;
    }),
    queries
  };

  return supabase;
}

describe("GET /api/platform/overview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(logPlatformAccess).mockResolvedValue(undefined);
  });

  it("returns cross-tenant read model with payment plan data for platform admins", async () => {
    const supabase = createPlatformSupabase();
    vi.mocked(requirePlatformAdmin).mockResolvedValue({
      userId: "platform-user",
      role: "operator",
      supabase
    } as never);

    const response = await GET(new NextRequest("http://localhost:3000/api/platform/overview"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.metrics.totalOrganizations).toBe(1);
    expect(body.metrics.registeredUsers).toBe(2);
    expect(body.tenants[0]).toMatchObject({
      id: "11111111-1111-4111-8111-111111111111",
      name: "Northstar Materials",
      plan: "operations",
      billingStatus: "trialing",
      users: 2,
      materials: 1,
      locations: 1,
      stockMovements: 1,
      purchaseOrders: 1,
      openPurchaseOrders: 1
    });
    expect(body.recentAudit[0].organizationName).toBe("Northstar Materials");
    expect(supabase.queries.materials.in).toHaveBeenCalledWith("org_id", ["11111111-1111-4111-8111-111111111111"]);
    expect(supabase.queries.locations.in).toHaveBeenCalledWith("org_id", ["11111111-1111-4111-8111-111111111111"]);
    expect(supabase.queries.stock_movements.in).toHaveBeenCalledWith("org_id", ["11111111-1111-4111-8111-111111111111"]);
    expect(supabase.queries.purchase_orders.in).toHaveBeenCalledWith("org_id", ["11111111-1111-4111-8111-111111111111"]);
    expect(supabase.queries.organization_billing.in).toHaveBeenCalledWith("org_id", ["11111111-1111-4111-8111-111111111111"]);
    expect(supabase.queries.audit_log.in).toHaveBeenCalledWith("org_id", ["11111111-1111-4111-8111-111111111111"]);
    expect(logPlatformAccess).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "platform-user", role: "operator", supabase }),
      "platform.overview.read",
      expect.objectContaining({ tenantCount: 1 })
    );
  });

  it("applies tenant search to organization lookup", async () => {
    const supabase = createPlatformSupabase();
    vi.mocked(requirePlatformAdmin).mockResolvedValue({
      userId: "platform-user",
      role: "support",
      supabase
    } as never);

    await GET(new NextRequest("http://localhost:3000/api/platform/overview?q=north"));

    expect(supabase.queries.organizations.ilike).toHaveBeenCalledWith("name", "%north%");
  });

  it("rejects non-platform admins before reading service data", async () => {
    vi.mocked(requirePlatformAdmin).mockRejectedValue(new ApiError(403, "Platform admin access is required."));

    const response = await GET(new NextRequest("http://localhost:3000/api/platform/overview"));
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toBe("Platform admin access is required.");
    expect(logPlatformAccess).not.toHaveBeenCalled();
  });
});

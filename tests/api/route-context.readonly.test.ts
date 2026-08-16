import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { requireRequestContext } from "@/lib/api/route-context";
import { extractBearerToken, requireAuthenticatedUserId } from "@/lib/api/auth";
import { getOrganizationEntitlements } from "@/lib/billing/server";
import { getSupabaseUserClient } from "@/lib/supabase-user";

vi.mock("@/lib/supabase-user", () => ({
  getSupabaseUserClient: vi.fn()
}));

vi.mock("@/lib/api/auth", () => ({
  extractBearerToken: vi.fn(),
  requireAuthenticatedUserId: vi.fn()
}));

vi.mock("@/lib/billing/server", () => ({
  getOrganizationEntitlements: vi.fn()
}));

function createRequest(method = "POST") {
  return new NextRequest("http://localhost/api/stock/movements", {
    method,
    headers: {
      authorization: "Bearer token",
      "x-org-id": "11111111-1111-4111-8111-111111111111"
    }
  });
}

describe("requireRequestContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(extractBearerToken).mockReturnValue("token");
    vi.mocked(requireAuthenticatedUserId).mockResolvedValue("user-1");
    vi.mocked(getOrganizationEntitlements).mockResolvedValue({
      selectedPlan: "starter",
      effectivePlan: "starter",
      billingStatus: "trialing",
      trialEndsAt: null,
      currentPeriodEnd: null,
      isReadOnly: true,
      accessReason: "trial_expired",
      features: { organizationAuditLog: false, auditCsvExport: false },
      limits: {
        users: 3,
        workspaces: 1,
        teams: 1,
        locations: 3,
        materials: 500,
        suppliers: 50,
        purchaseOrdersPerMonth: 50,
        stockMovementsPerMonth: 500,
        csvImportRows: 100,
        auditExportDays: 0
      }
    });
  });

  it("blocks write requests when the workspace is read only", async () => {
    const orgUsersQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: { role: "member" }, error: null })
    };
    vi.mocked(getSupabaseUserClient).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "org_users") return orgUsersQuery;
        throw new Error(`Unexpected table ${table}`);
      })
    } as never);

    await expect(requireRequestContext(createRequest())).rejects.toMatchObject({
      status: 402,
      message: "This workspace is read-only because its trial or subscription is not active."
    });
  });
});

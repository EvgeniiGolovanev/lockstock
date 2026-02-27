import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { ApiError } from "@/lib/api/errors";
import { PATCH } from "@/app/api/purchase-orders/[id]/status/route";
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
type Status = "draft" | "sent" | "partial" | "received" | "cancelled";

function createSupabaseForStatus(role: Role, currentStatus: Status = "draft") {
  const orgUsersQuery = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: { role }, error: null })
  };

  const poLookupQuery = {
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({
      data: { id: "po-1", po_number: "PO-1", status: currentStatus },
      error: null
    })
  };

  const poUpdateResult = {
    single: vi.fn().mockResolvedValue({
      data: { id: "po-1", po_number: "PO-1", status: "sent" },
      error: null
    })
  };

  const poUpdateQuery = {
    eq: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnValue(poUpdateResult)
  };

  const purchaseOrdersTable = {
    select: vi.fn().mockReturnValue(poLookupQuery),
    update: vi.fn().mockReturnValue(poUpdateQuery)
  };

  return {
    from: vi.fn((table: string) => {
      if (table === "org_users") {
        return orgUsersQuery;
      }
      if (table === "purchase_orders") {
        return purchaseOrdersTable;
      }
      throw new Error(`Unexpected table access in test: ${table}`);
    }),
    purchaseOrdersTable
  };
}

describe("PATCH /api/purchase-orders/[id]/status role and transition enforcement", () => {
  const orgId = "11111111-1111-4111-8111-111111111111";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when JWT user extraction fails", async () => {
    vi.mocked(extractBearerToken).mockReturnValue("invalid");
    vi.mocked(requireAuthenticatedUserId).mockRejectedValue(new ApiError(401, "Invalid or expired access token."));
    vi.mocked(getSupabaseUserClient).mockReturnValue(createSupabaseForStatus("manager") as never);

    const request = new NextRequest("http://localhost:3000/api/purchase-orders/po-1/status", {
      method: "PATCH",
      headers: { "x-org-id": orgId, Authorization: "Bearer invalid", "Content-Type": "application/json" },
      body: JSON.stringify({ status: "sent" })
    });

    const response = await PATCH(request, { params: Promise.resolve({ id: "po-1" }) });
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toContain("Invalid or expired");
  });

  it("returns 403 when role is below manager", async () => {
    vi.mocked(extractBearerToken).mockReturnValue("token");
    vi.mocked(requireAuthenticatedUserId).mockResolvedValue("user-1");
    const supabase = createSupabaseForStatus("member");
    vi.mocked(getSupabaseUserClient).mockReturnValue(supabase as never);

    const request = new NextRequest("http://localhost:3000/api/purchase-orders/po-1/status", {
      method: "PATCH",
      headers: { "x-org-id": orgId, Authorization: "Bearer token", "Content-Type": "application/json" },
      body: JSON.stringify({ status: "sent" })
    });

    const response = await PATCH(request, { params: Promise.resolve({ id: "po-1" }) });
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toContain("manager");
    expect(supabase.purchaseOrdersTable.update).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid transition", async () => {
    vi.mocked(extractBearerToken).mockReturnValue("token");
    vi.mocked(requireAuthenticatedUserId).mockResolvedValue("user-1");
    const supabase = createSupabaseForStatus("manager", "partial");
    vi.mocked(getSupabaseUserClient).mockReturnValue(supabase as never);

    const request = new NextRequest("http://localhost:3000/api/purchase-orders/po-1/status", {
      method: "PATCH",
      headers: { "x-org-id": orgId, Authorization: "Bearer token", "Content-Type": "application/json" },
      body: JSON.stringify({ status: "sent" })
    });

    const response = await PATCH(request, { params: Promise.resolve({ id: "po-1" }) });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain("Invalid status transition");
    expect(supabase.purchaseOrdersTable.update).not.toHaveBeenCalled();
  });

  it("allows manager to transition draft to sent", async () => {
    vi.mocked(extractBearerToken).mockReturnValue("token");
    vi.mocked(requireAuthenticatedUserId).mockResolvedValue("user-1");
    const supabase = createSupabaseForStatus("manager", "draft");
    vi.mocked(getSupabaseUserClient).mockReturnValue(supabase as never);

    const request = new NextRequest("http://localhost:3000/api/purchase-orders/po-1/status", {
      method: "PATCH",
      headers: { "x-org-id": orgId, Authorization: "Bearer token", "Content-Type": "application/json" },
      body: JSON.stringify({ status: "sent" })
    });

    const response = await PATCH(request, { params: Promise.resolve({ id: "po-1" }) });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.status).toBe("sent");
    expect(supabase.purchaseOrdersTable.update).toHaveBeenCalledOnce();
  });
});

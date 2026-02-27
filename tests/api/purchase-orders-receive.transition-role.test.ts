import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/purchase-orders/[id]/receive/route";
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

function createSupabaseForReceive(role: Role, status: Status) {
  const orgUsersQuery = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: { role }, error: null })
  };

  const poLookupQuery = {
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({
      data: { id: "po-1", status },
      error: null
    })
  };

  const rpc = vi.fn().mockResolvedValue({
    data: [{ po_status: status === "partial" ? "received" : "partial", total_lines: 2, fully_received_lines: 1 }],
    error: null
  });

  return {
    from: vi.fn((table: string) => {
      if (table === "org_users") {
        return orgUsersQuery;
      }
      if (table === "purchase_orders") {
        return {
          select: vi.fn().mockReturnValue(poLookupQuery)
        };
      }
      throw new Error(`Unexpected table access in test: ${table}`);
    }),
    rpc
  };
}

describe("POST /api/purchase-orders/[id]/receive transition and role enforcement", () => {
  const orgId = "11111111-1111-4111-8111-111111111111";
  const requestBody = {
    receipts: [
      {
        po_line_id: "2f208318-9607-4e8a-b061-fdf4ec4e8115",
        location_id: "1477645d-65e2-42fe-b5b6-d64dad99b3e9",
        quantity_received: 1
      }
    ]
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 403 when role is viewer", async () => {
    vi.mocked(extractBearerToken).mockReturnValue("token");
    vi.mocked(requireAuthenticatedUserId).mockResolvedValue("user-1");
    const supabase = createSupabaseForReceive("viewer", "sent");
    vi.mocked(getSupabaseUserClient).mockReturnValue(supabase as never);

    const request = new NextRequest("http://localhost:3000/api/purchase-orders/po-1/receive", {
      method: "POST",
      headers: { "x-org-id": orgId, Authorization: "Bearer token", "Content-Type": "application/json" },
      body: JSON.stringify(requestBody)
    });

    const response = await POST(request, { params: Promise.resolve({ id: "po-1" }) });
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toContain("member");
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it("returns 400 when trying to receive from draft", async () => {
    vi.mocked(extractBearerToken).mockReturnValue("token");
    vi.mocked(requireAuthenticatedUserId).mockResolvedValue("user-1");
    const supabase = createSupabaseForReceive("member", "draft");
    vi.mocked(getSupabaseUserClient).mockReturnValue(supabase as never);

    const request = new NextRequest("http://localhost:3000/api/purchase-orders/po-1/receive", {
      method: "POST",
      headers: { "x-org-id": orgId, Authorization: "Bearer token", "Content-Type": "application/json" },
      body: JSON.stringify(requestBody)
    });

    const response = await POST(request, { params: Promise.resolve({ id: "po-1" }) });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain("must be sent");
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it("allows member to receive from sent or partial", async () => {
    vi.mocked(extractBearerToken).mockReturnValue("token");
    vi.mocked(requireAuthenticatedUserId).mockResolvedValue("user-1");
    const supabase = createSupabaseForReceive("member", "sent");
    vi.mocked(getSupabaseUserClient).mockReturnValue(supabase as never);

    const request = new NextRequest("http://localhost:3000/api/purchase-orders/po-1/receive", {
      method: "POST",
      headers: { "x-org-id": orgId, Authorization: "Bearer token", "Content-Type": "application/json" },
      body: JSON.stringify(requestBody)
    });

    const response = await POST(request, { params: Promise.resolve({ id: "po-1" }) });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data[0].po_status).toBe("partial");
    expect(supabase.rpc).toHaveBeenCalledOnce();
  });
});

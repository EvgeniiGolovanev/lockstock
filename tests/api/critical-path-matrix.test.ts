import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST as postOrganizations } from "@/app/api/organizations/route";
import { POST as postStockMovement } from "@/app/api/stock/movements/route";
import { PATCH as patchPurchaseOrderStatus } from "@/app/api/purchase-orders/[id]/status/route";
import { POST as postReceivePurchaseOrder } from "@/app/api/purchase-orders/[id]/receive/route";
import { extractBearerToken, requireAuthenticatedUserId } from "@/lib/api/auth";
import { requireRequestContext } from "@/lib/api/route-context";

vi.mock("@/lib/supabase-user", () => ({
  getSupabaseUserClient: vi.fn()
}));

vi.mock("@/lib/api/auth", () => ({
  extractBearerToken: vi.fn(),
  requireAuthenticatedUserId: vi.fn()
}));

vi.mock("@/lib/api/route-context", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api/route-context")>("@/lib/api/route-context");
  return {
    ...actual,
    requireRequestContext: vi.fn()
  };
});

vi.mock("@/lib/billing/server", () => ({
  getOrganizationEntitlements: vi.fn().mockResolvedValue({ isReadOnly: false })
}));

type Role = "viewer" | "member" | "manager" | "owner";

function createStockSupabase(role: Role, materialActive = true, rpcError: Error | null = null) {
  const orgUsersQuery = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: { role }, error: null })
  };
  const materialsQuery = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: materialActive ? { id: "mat-1", is_active: true } : { id: "mat-1", is_active: false }, error: null })
  };
  return {
    from: vi.fn((table: string) => {
      if (table === "org_users") return orgUsersQuery;
      if (table === "materials") return materialsQuery;
      throw new Error(`Unexpected table ${table}`);
    }),
    rpc: vi.fn().mockResolvedValue(rpcError ? { data: null, error: rpcError } : { data: "move-1", error: null })
  };
}

function createPoSupabase(
  role: Role,
  currentStatus: "draft" | "sent" | "partial" | "received" | "cancelled",
  rpcResult: unknown = [{ po_status: currentStatus === "draft" ? "partial" : "received", total_lines: 1, fully_received_lines: 1 }]
) {
  const orgUsersQuery = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: { role }, error: null })
  };
  const poQuery = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: { id: "po-1", status: currentStatus, po_number: "PO-1" }, error: null })
  };
  const poTable = { select: vi.fn().mockReturnValue(poQuery) };
  const rpc = vi.fn().mockResolvedValue({ data: rpcResult, error: null });
  return {
    from: vi.fn((table: string) => {
      if (table === "org_users") return orgUsersQuery;
      if (table === "purchase_orders") return poTable;
      throw new Error(`Unexpected table ${table}`);
    }),
    rpc
  };
}

describe("critical path route matrix", () => {
  const orgId = "11111111-1111-4111-8111-111111111111";

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(extractBearerToken).mockReturnValue("token");
    vi.mocked(requireAuthenticatedUserId).mockResolvedValue("user-1");
  });

  it("rejects unauthenticated organization creation", async () => {
    vi.mocked(extractBearerToken).mockReturnValue(null);

    const response = await postOrganizations(new NextRequest("http://localhost/api/organizations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Acme", plan: "business" })
    }));

    expect(response.status).toBe(401);
  });

  it("covers the stock mutation matrix", async () => {
    const viewerSupabase = createStockSupabase("viewer");
    vi.mocked(requireRequestContext).mockResolvedValue({
      orgId,
      userId: "user-1",
      role: "viewer",
      supabase: viewerSupabase
    } as never);
    const viewerResponse = await postStockMovement(new NextRequest("http://localhost/api/stock/movements", {
      method: "POST",
      body: JSON.stringify({
        material_id: "22222222-2222-4222-8222-222222222222",
        location_id: "33333333-3333-4333-8333-333333333333",
        quantity_delta: 1,
        reason: "adjustment"
      })
    }));
    expect(viewerResponse.status).toBe(403);

    const inactiveSupabase = createStockSupabase("member", false);
    vi.mocked(requireRequestContext).mockResolvedValue({
      orgId,
      userId: "user-1",
      role: "member",
      supabase: inactiveSupabase
    } as never);
    const inactiveResponse = await postStockMovement(new NextRequest("http://localhost/api/stock/movements", {
      method: "POST",
      body: JSON.stringify({
        material_id: "22222222-2222-4222-8222-222222222222",
        location_id: "33333333-3333-4333-8333-333333333333",
        quantity_delta: 1,
        reason: "adjustment"
      })
    }));
    expect(inactiveResponse.status).toBe(400);

    const failingSupabase = createStockSupabase("member", true, new Error("db write failed"));
    vi.mocked(requireRequestContext).mockResolvedValue({
      orgId,
      userId: "user-1",
      role: "member",
      supabase: failingSupabase
    } as never);
    const failingResponse = await postStockMovement(new NextRequest("http://localhost/api/stock/movements", {
      method: "POST",
      body: JSON.stringify({
        material_id: "22222222-2222-4222-8222-222222222222",
        location_id: "33333333-3333-4333-8333-333333333333",
        quantity_delta: 1,
        reason: "adjustment"
      })
    }));
    expect(failingResponse.status).toBe(500);
  });

  it("covers the purchase-order lifecycle matrix", async () => {
    const memberSupabase = createPoSupabase("member", "draft");
    vi.mocked(requireRequestContext).mockResolvedValue({
      orgId,
      userId: "user-1",
      role: "member",
      supabase: memberSupabase
    } as never);
    const memberResponse = await patchPurchaseOrderStatus(new NextRequest("http://localhost/api/purchase-orders/po-1/status", {
      method: "PATCH",
      body: JSON.stringify({ status: "sent" })
    }), { params: Promise.resolve({ id: "po-1" }) });
    expect(memberResponse.status).toBe(403);

    const managerSupabase = createPoSupabase("manager", "draft", {
      id: "po-1",
      po_number: "PO-1",
      status: "sent",
      sent_at: "2026-08-16T10:00:00.000Z"
    });
    vi.mocked(requireRequestContext).mockResolvedValue({
      orgId,
      userId: "user-1",
      role: "manager",
      supabase: managerSupabase
    } as never);
    const managerResponse = await patchPurchaseOrderStatus(new NextRequest("http://localhost/api/purchase-orders/po-1/status", {
      method: "PATCH",
      body: JSON.stringify({ status: "sent" })
    }), { params: Promise.resolve({ id: "po-1" }) });
    expect(managerResponse.status).toBe(200);
    await expect(managerResponse.json()).resolves.toMatchObject({
      data: {
        id: "po-1",
        po_number: "PO-1",
        status: "sent",
        sent_at: "2026-08-16T10:00:00.000Z"
      }
    });

    const receiveDraftSupabase = createPoSupabase("member", "draft");
    vi.mocked(requireRequestContext).mockResolvedValue({
      orgId,
      userId: "user-1",
      role: "member",
      supabase: receiveDraftSupabase
    } as never);
    const receiveDraftResponse = await postReceivePurchaseOrder(new NextRequest("http://localhost/api/purchase-orders/po-1/receive", {
      method: "POST",
      body: JSON.stringify({ receipts: [{ po_line_id: "2f208318-9607-4e8a-b061-fdf4ec4e8115", location_id: "1477645d-65e2-42fe-b5b6-d64dad99b3e9", quantity_received: 1 }] })
    }), { params: Promise.resolve({ id: "po-1" }) });
    expect(receiveDraftResponse.status).toBe(400);

    const receiveSentSupabase = createPoSupabase("member", "sent");
    vi.mocked(requireRequestContext).mockResolvedValue({
      orgId,
      userId: "user-1",
      role: "member",
      supabase: receiveSentSupabase
    } as never);
    const receiveSentResponse = await postReceivePurchaseOrder(new NextRequest("http://localhost/api/purchase-orders/po-1/receive", {
      method: "POST",
      body: JSON.stringify({ receipts: [{ po_line_id: "2f208318-9607-4e8a-b061-fdf4ec4e8115", location_id: "1477645d-65e2-42fe-b5b6-d64dad99b3e9", quantity_received: 1 }] })
    }), { params: Promise.resolve({ id: "po-1" }) });
    expect(receiveSentResponse.status).toBe(200);
  });
});

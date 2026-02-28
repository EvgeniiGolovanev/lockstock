import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/purchase-orders/route";
import { requireMinRole, requireRequestContext } from "@/lib/api/route-context";

vi.mock("@/lib/api/route-context", () => ({
  requireRequestContext: vi.fn(),
  requireMinRole: vi.fn()
}));

function createSupabaseInsertHarness() {
  let insertedCurrency = "EUR";
  const poInsertSingle = vi.fn().mockImplementation(async () => ({
    data: { id: "po-1", po_number: "PO-1", status: "draft", currency: insertedCurrency },
    error: null
  }));
  const poInsertSelect = vi.fn().mockReturnValue({
    single: poInsertSingle
  });
  const poInsert = vi.fn().mockImplementation((row: { currency?: string }) => {
    insertedCurrency = row.currency ?? "EUR";
    return {
      select: poInsertSelect
    };
  });

  const poLinesInsertSelect = vi.fn().mockResolvedValue({
    data: [
      {
        id: "line-1",
        purchase_order_id: "po-1",
        material_id: "33333333-3333-4333-8333-333333333333",
        quantity_ordered: 1,
        quantity_received: 0,
        unit_price: 12
      }
    ],
    error: null
  });
  const poLinesInsert = vi.fn().mockReturnValue({
    select: poLinesInsertSelect
  });

  const supabase = {
    from: vi.fn((table: string) => {
      if (table === "purchase_orders") {
        return { insert: poInsert };
      }
      if (table === "po_lines") {
        return { insert: poLinesInsert };
      }
      throw new Error(`Unexpected table in test: ${table}`);
    })
  };

  return { supabase, poInsert };
}

describe("POST /api/purchase-orders currency persistence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireMinRole).mockImplementation(() => {});
  });

  it("uses EUR by default when currency is omitted", async () => {
    const { supabase, poInsert } = createSupabaseInsertHarness();

    vi.mocked(requireRequestContext).mockResolvedValue({
      orgId: "11111111-1111-4111-8111-111111111111",
      userId: "user-1",
      role: "manager",
      supabase
    } as never);

    const request = new NextRequest("http://localhost:3000/api/purchase-orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        supplier_id: "22222222-2222-4222-8222-222222222222",
        lines: [
          {
            material_id: "33333333-3333-4333-8333-333333333333",
            quantity_ordered: 1,
            unit_price: 12
          }
        ]
      })
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(poInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        currency: "EUR"
      })
    );
    expect(body.data.currency).toBe("EUR");
  });

  it("persists USD when explicitly requested", async () => {
    const { supabase, poInsert } = createSupabaseInsertHarness();

    vi.mocked(requireRequestContext).mockResolvedValue({
      orgId: "11111111-1111-4111-8111-111111111111",
      userId: "user-1",
      role: "manager",
      supabase
    } as never);

    const request = new NextRequest("http://localhost:3000/api/purchase-orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        supplier_id: "22222222-2222-4222-8222-222222222222",
        currency: "USD",
        lines: [
          {
            material_id: "33333333-3333-4333-8333-333333333333",
            quantity_ordered: 1,
            unit_price: 12
          }
        ]
      })
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(poInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        currency: "USD"
      })
    );
    expect(body.data.currency).toBe("USD");
  });
});

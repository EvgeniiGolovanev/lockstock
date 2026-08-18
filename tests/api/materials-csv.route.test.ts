import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/import/materials-csv/route";
import { requireRequestContext } from "@/lib/api/route-context";

vi.mock("@/lib/api/route-context", () => ({
  requireRequestContext: vi.fn(),
  requireMinRole: vi.fn()
}));

function createThenable<T>(result: T) {
  return {
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    then: vi.fn((resolve: (value: T) => void) => resolve(result))
  };
}

function createSupabase(options: {
  currentCount: number;
  existingSkus: string[];
  upsertData: unknown[];
}) {
  const countQuery = createThenable({ count: options.currentCount, error: null, data: null });
  const existingSkuQuery = createThenable({
    data: options.existingSkus.map((sku) => ({ sku })),
    error: null
  });
  const upsertQuery = createThenable({ data: options.upsertData, error: null });
  const upsertBuilder = {
    select: vi.fn().mockReturnValue(upsertQuery)
  };

  return {
    from: vi.fn((table: string) => {
      if (table !== "materials") {
        throw new Error(`Unexpected table ${table}`);
      }

      return {
        select: vi.fn((columns: string, queryOptions?: { count?: string; head?: boolean }) => {
          if (columns === "id" && queryOptions?.head) {
            return countQuery;
          }
          if (columns === "sku") {
            return existingSkuQuery;
          }
          throw new Error(`Unexpected select shape: ${columns}`);
        }),
        upsert: vi.fn().mockReturnValue(upsertBuilder)
      };
    })
  };
}

describe("POST /api/import/materials-csv", () => {
  const orgId = "11111111-1111-4111-8111-111111111111";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("imports Excel-style CSV rows with duplicate SKUs deterministically", async () => {
    const supabase = createSupabase({
      currentCount: 0,
      existingSkus: [],
      upsertData: [
        { id: "mat-1", sku: "MAT-001", name: "Stone, 25kg", uom: "bag", min_stock: 6 },
        { id: "mat-2", sku: "MAT-002", name: "Nails", uom: "box", min_stock: 0 }
      ]
    });

    vi.mocked(requireRequestContext).mockResolvedValue({
      orgId,
      userId: "user-1",
      role: "manager",
      entitlements: {
        effectivePlan: "starter",
        selectedPlan: "starter",
        billingStatus: "active",
        isReadOnly: false,
        accessReason: "paid_active",
        features: { organizationAuditLog: false, auditCsvExport: false },
        limits: { csvImportRows: 1000, materials: 1000 }
      },
      supabase
    } as never);

    const response = await POST(
      new NextRequest("http://localhost:3000/api/import/materials-csv", {
        method: "POST",
        body: "\ufeffsku;name;uom;min_stock\r\nMAT-001;\"Stone, 20kg\";bag;5\r\nMAT-001;\"Stone, 25kg\";bag;6\r\nMAT-002;Nails;box;0\r\n"
      })
    );

    const body = await response.json();

    expect(response.status).toBe(201);
    expect(supabase.from).toHaveBeenCalledTimes(3);
    expect(supabase.from).toHaveBeenNthCalledWith(1, "materials");
    expect(supabase.from).toHaveBeenNthCalledWith(2, "materials");
    expect(supabase.from).toHaveBeenNthCalledWith(3, "materials");
    expect(body.data).toMatchObject({ inserted: 2, updated: 0, duplicates: 1 });
  });

  it("returns row-numbered validation errors before any write", async () => {
    const supabase = createSupabase({
      currentCount: 0,
      existingSkus: [],
      upsertData: []
    });

    vi.mocked(requireRequestContext).mockResolvedValue({
      orgId,
      userId: "user-1",
      role: "manager",
      entitlements: {
        effectivePlan: "starter",
        selectedPlan: "starter",
        billingStatus: "active",
        isReadOnly: false,
        accessReason: "paid_active",
        features: { organizationAuditLog: false, auditCsvExport: false },
        limits: { csvImportRows: 1000, materials: 1000 }
      },
      supabase
    } as never);

    const response = await POST(
      new NextRequest("http://localhost:3000/api/import/materials-csv", {
        method: "POST",
        body: "sku,name,uom,min_stock\nMAT-001,,bag,abc\nMAT-002,Concrete,bag,-1\n"
      })
    );

    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe("validation_failed");
    expect(body.details.issues).toEqual([
      { row: 2, field: "name", message: "Name is required." },
      { row: 2, field: "min_stock", message: "Minimum stock must be a valid non-negative number." },
      { row: 3, field: "min_stock", message: "Minimum stock must be a valid non-negative number." }
    ]);
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it("rejects imports that would exceed the material plan limit before writing", async () => {
    const supabase = createSupabase({
      currentCount: 2,
      existingSkus: [],
      upsertData: []
    });

    vi.mocked(requireRequestContext).mockResolvedValue({
      orgId,
      userId: "user-1",
      role: "manager",
      entitlements: {
        effectivePlan: "starter",
        selectedPlan: "starter",
        billingStatus: "active",
        isReadOnly: false,
        accessReason: "paid_active",
        features: { organizationAuditLog: false, auditCsvExport: false },
        limits: { csvImportRows: 1000, materials: 3 }
      },
      supabase
    } as never);

    const response = await POST(
      new NextRequest("http://localhost:3000/api/import/materials-csv", {
        method: "POST",
        body: "sku,name,uom,min_stock\nMAT-001,Concrete,bag,0\nMAT-002,Sand,bag,0\n"
      })
    );

    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toContain("plan limit");
    expect(supabase.from).toHaveBeenCalledTimes(2);
  });

  it("rejects CSV inputs that exceed the plan row limit before parsing into writes", async () => {
    const supabase = createSupabase({
      currentCount: 0,
      existingSkus: [],
      upsertData: []
    });
    const csv = [
      "sku,name,uom,min_stock",
      ...Array.from({ length: 1001 }, (_, index) => `MAT-${String(index + 1).padStart(4, "0")},Item ${index + 1},bag,0`)
    ].join("\n");

    vi.mocked(requireRequestContext).mockResolvedValue({
      orgId,
      userId: "user-1",
      role: "manager",
      entitlements: {
        effectivePlan: "starter",
        selectedPlan: "starter",
        billingStatus: "active",
        isReadOnly: false,
        accessReason: "paid_active",
        features: { organizationAuditLog: false, auditCsvExport: false },
        limits: { csvImportRows: 1000, materials: 1000 }
      },
      supabase
    } as never);

    const response = await POST(
      new NextRequest("http://localhost:3000/api/import/materials-csv", {
        method: "POST",
        body: csv
      })
    );

    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toContain("csvImportRows");
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it("counts duplicate CSV rows against the plan row limit before writing", async () => {
    const supabase = createSupabase({ currentCount: 0, existingSkus: [], upsertData: [] });
    vi.mocked(requireRequestContext).mockResolvedValue({
      orgId,
      userId: "user-1",
      role: "manager",
      entitlements: {
        effectivePlan: "starter",
        selectedPlan: "starter",
        billingStatus: "active",
        isReadOnly: false,
        accessReason: "paid_active",
        features: { organizationAuditLog: false, auditCsvExport: false },
        limits: { csvImportRows: 2, materials: 1000 }
      },
      supabase
    } as never);

    const response = await POST(
      new NextRequest("http://localhost:3000/api/import/materials-csv", {
        method: "POST",
        body: "sku,name\nMAT-001,Concrete\nMAT-001,Concrete revised\nMAT-001,Concrete final\n"
      })
    );

    expect(response.status).toBe(403);
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it("rejects declared oversized uploads before reading or querying", async () => {
    const supabase = createSupabase({ currentCount: 0, existingSkus: [], upsertData: [] });
    vi.mocked(requireRequestContext).mockResolvedValue({
      orgId,
      userId: "user-1",
      role: "manager",
      entitlements: {
        effectivePlan: "starter",
        selectedPlan: "starter",
        billingStatus: "active",
        isReadOnly: false,
        accessReason: "paid_active",
        features: { organizationAuditLog: false, auditCsvExport: false },
        limits: { csvImportRows: 1000, materials: 1000 }
      },
      supabase
    } as never);

    const response = await POST(
      new NextRequest("http://localhost:3000/api/import/materials-csv", {
        method: "POST",
        headers: { "content-length": String(5 * 1024 * 1024 + 1) },
        body: "sku,name\nMAT-001,Concrete\n"
      })
    );

    expect(response.status).toBe(413);
    expect(supabase.from).not.toHaveBeenCalled();
  });
});

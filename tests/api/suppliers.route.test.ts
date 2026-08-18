import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { GET, POST } from "@/app/api/suppliers/route";
import { requireMinRole, requireRequestContext } from "@/lib/api/route-context";

vi.mock("@/lib/api/route-context", () => ({
  requireRequestContext: vi.fn(),
  requireMinRole: vi.fn()
}));

describe("GET /api/suppliers pagination", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns bounded suppliers with pagination metadata and status filters", async () => {
    const result = {
      data: [
        {
          id: "sup-1",
          org_id: "org-1",
          name: "Acme Supply",
          vendor_number: 42,
          is_active: true,
          created_at: "2026-08-01T09:00:00.000Z"
        }
      ],
      error: null,
      count: 2
    };
    const builder: Record<string, unknown> = {};
    const select = vi.fn().mockReturnValue(builder);
    const eq = vi.fn().mockImplementation(() => builder);
    const order = vi.fn().mockImplementation(() => builder);
    const range = vi.fn().mockImplementation(() => builder);
    const or = vi.fn().mockImplementation(() => builder);
    Object.assign(builder, { eq, order, range, or });
    Object.assign(builder, {
      then(resolve: (value: typeof result) => void) {
        resolve(result);
      }
    });
    const from = vi.fn().mockReturnValue({ select });

    vi.mocked(requireRequestContext).mockResolvedValue({
      orgId: "org-1",
      userId: "user-1",
      role: "member",
      supabase: { from } as never
    } as never);

    const response = await GET(new NextRequest("http://localhost:3000/api/suppliers?page=2&limit=1&status=active&q=acme"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(from).toHaveBeenCalledWith("suppliers");
    expect(select).toHaveBeenCalledWith("*", { count: "exact" });
    expect(eq).toHaveBeenCalledWith("org_id", "org-1");
    expect(or).toHaveBeenCalledWith("name.ilike.%acme%,phone.ilike.%acme%,address.ilike.%acme%,vendor_number::text.ilike.%acme%");
    expect(eq).toHaveBeenCalledWith("is_active", true);
    expect(range).not.toHaveBeenCalledWith(0, 19);
    expect(order).toHaveBeenCalledWith("vendor_number", { ascending: true });
    expect(order).toHaveBeenCalledWith("created_at", { ascending: true });
    expect(range).toHaveBeenCalledWith(1, 1);
    expect(body.meta).toEqual({
      page: 2,
      limit: 1,
      total: 2,
      total_pages: 2
    });
    expect(body.data).toHaveLength(1);
  });

  it("defaults supplier pagination to 20 rows", async () => {
    const result = {
      data: [],
      error: null,
      count: 0
    };
    const builder: Record<string, unknown> = {};
    const select = vi.fn().mockReturnValue(builder);
    const eq = vi.fn().mockImplementation(() => builder);
    const order = vi.fn().mockImplementation(() => builder);
    const range = vi.fn().mockImplementation(() => builder);
    const or = vi.fn().mockImplementation(() => builder);
    Object.assign(builder, { eq, order, range, or });
    Object.assign(builder, {
      then(resolve: (value: typeof result) => void) {
        resolve(result);
      }
    });
    const from = vi.fn().mockReturnValue({ select });

    vi.mocked(requireRequestContext).mockResolvedValue({
      orgId: "org-1",
      userId: "user-1",
      role: "member",
      supabase: { from } as never
    } as never);

    const response = await GET(new NextRequest("http://localhost:3000/api/suppliers", { headers: { "x-org-id": "org-1" } }));

    expect(response.status).toBe(200);
    expect(range).toHaveBeenCalledWith(0, 19);
  });
});

describe("POST /api/suppliers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireMinRole).mockImplementation(() => {});
  });

  it("creates a supplier", async () => {
    const single = vi.fn().mockResolvedValue({
      data: {
        id: "sup-2",
        org_id: "org-1",
        name: "Beta Supply"
      },
      error: null
    });
    const select = vi.fn().mockReturnValue({ single });
    const insert = vi.fn().mockReturnValue({ select });
    const from = vi.fn().mockReturnValue({ insert });

    vi.mocked(requireRequestContext).mockResolvedValue({
      orgId: "org-1",
      userId: "user-1",
      role: "manager",
      supabase: { from } as never
    } as never);

    const request = new NextRequest("http://localhost:3000/api/suppliers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Beta Supply",
        lead_time_days: 5
      })
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        org_id: "org-1",
        created_by: "user-1",
        name: "Beta Supply"
      })
    );
    expect(body.data.name).toBe("Beta Supply");
  });
});

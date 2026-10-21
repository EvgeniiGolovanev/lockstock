import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "@/app/api/replenishment/route";
import { POST } from "@/app/api/replenishment/drafts/route";
import { requireRequestContext } from "@/lib/api/route-context";
vi.mock("@/lib/api/route-context", () => ({ requireRequestContext: vi.fn(), requireMinRole: vi.fn() }));
const rpc = vi.fn();
const id = "11111111-1111-4111-8111-111111111111";
describe("replenishment routes", () => {
  beforeEach(() => { vi.clearAllMocks(); vi.mocked(requireRequestContext).mockResolvedValue({ orgId: id, role: "manager", supabase: { rpc } } as never); });
  it("reads full server aggregates with bounded paging", async () => {
    rpc.mockResolvedValue({ data: { rows: [], total: 0, counts: {} }, error: null });
    const date = new Date(); date.setUTCDate(date.getUTCDate()+2);
    const response = await GET(new NextRequest(`http://localhost/api/replenishment?required_by=${date.toISOString().slice(0,10)}&timezone=UTC&limit=999`));
    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("list_replenishment", expect.objectContaining({ p_org_id: id, p_limit: 100 }));
  });
  it("maps stale DB snapshots to conflict, not generic internal failure", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "40001", message: "Recommendations changed; review again" } });
    const date = new Date(); date.setUTCDate(date.getUTCDate()+2);
    const response = await POST(new NextRequest("http://localhost/api/replenishment/drafts", { method: "POST", body: JSON.stringify({ request_id: id, required_by: date.toISOString().slice(0,10), timezone: "UTC", rows: [{ material_id: id, supplier_id: id, snapshot_token: "abc", quantity: "1", currency: "EUR" }] }) }));
    expect(response.status).toBe(409);
    expect((await response.json()).error).toContain("review again");
  });
  it("rejects invalid dates without hitting the database", async () => {
    const response = await GET(new NextRequest("http://localhost/api/replenishment?required_by=2000-01-01&timezone=UTC"));
    expect(response.status).toBe(400); expect(rpc).not.toHaveBeenCalled();
  });
});

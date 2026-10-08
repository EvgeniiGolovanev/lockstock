import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { ApiError } from "@/lib/api/errors";
const mocks = vi.hoisted(() => ({ context: vi.fn(), rpc: vi.fn() }));
vi.mock("@/lib/api/route-context", () => ({ requireRequestContext: mocks.context }));
import { POST } from "@/app/api/organizations/[id]/leave/route";
beforeEach(() => {
  vi.clearAllMocks();
  mocks.context.mockResolvedValue({ orgId: "org", userId: "self", role: "member", supabase: { rpc: mocks.rpc } });
  mocks.rpc.mockResolvedValue({ data: { user_id: "self", removed: true }, error: null });
});
const call = (id = "org") => POST(new NextRequest(`http://localhost/api/organizations/${id}/leave`, { method: "POST" }), { params: Promise.resolve({ id }) });
it("uses the authenticated user as the only removal target", async () => {
  const response = await call();
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ data: { user_id: "self", removed: true } });
  expect(mocks.rpc).toHaveBeenCalledWith("remove_org_member_with_team_memberships", { p_org_id: "org", p_target_user_id: "self" });
});
it("rejects a mismatched workspace without removing membership", async () => {
  expect((await call("another")).status).toBe(400);
  expect(mocks.rpc).not.toHaveBeenCalled();
});
it("prevents owners leaving their workspace", async () => {
  mocks.context.mockResolvedValue({ orgId: "org", userId: "self", role: "owner" });
  expect((await call()).status).toBe(403);
  expect(mocks.rpc).not.toHaveBeenCalled();
});
it("preserves membership authorization failures", async () => {
  mocks.context.mockRejectedValue(new ApiError(403, "Not a member"));
  expect((await call()).status).toBe(403);
  expect(mocks.rpc).not.toHaveBeenCalled();
});
it("does not report a database failure as a successful departure", async () => {
  mocks.rpc.mockResolvedValue({ data: null, error: { message: "failed" } });
  expect((await call()).status).toBe(500);
});

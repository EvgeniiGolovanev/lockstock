import { NextRequest, NextResponse } from "next/server";
import { ApiError, handleApiError } from "@/lib/api/errors";
import { requireRequestContext } from "@/lib/api/route-context";
import { planningQuery } from "@/lib/validators/replenishment";
import { replenishmentRpc } from "@/lib/replenishment/service";
import type { ReplenishmentList } from "@/lib/replenishment/contracts";

export async function GET(request: NextRequest) {
  try {
    const context = await requireRequestContext(request);
    const q = request.nextUrl.searchParams;
    let plan;
    try { plan = planningQuery(q.get("required_by") ?? "", q.get("timezone") ?? ""); }
    catch { throw new ApiError(400, "Select a valid planning date and timezone."); }
    const state = q.get("state") ?? "all";
    if (!["all", "ready", "review", "setup", "draft", "covered"].includes(state)) throw new ApiError(400, "Invalid state");
    const positive = (key: string, fallback: number, max: number) => Math.min(max, Math.max(1, Number.parseInt(q.get(key) ?? "", 10) || fallback));
    const data = await replenishmentRpc<ReplenishmentList>(context, "list_replenishment", {
      p_org_id: context.orgId, p_required_by: plan.required_by, p_timezone: plan.timezone,
      p_state: state, p_page: positive("page", 1, 1_000_000), p_limit: positive("limit", 50, 100)
    });
    return NextResponse.json({ data: { ...data, can_write: ["owner", "manager"].includes(context.role) && !context.entitlements?.isReadOnly } }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return handleApiError(error); }
}

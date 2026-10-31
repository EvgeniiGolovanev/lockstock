import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ApiError, handleApiError } from "@/lib/api/errors";
import { requireRequestContext } from "@/lib/api/route-context";
import { replenishmentRpc } from "@/lib/replenishment/service";
export async function GET(request: NextRequest, { params }: { params: Promise<{ requestId: string }> }) {
  try {
    const context = await requireRequestContext(request);
    const id = z.string().uuid().parse((await params).requestId);
    const data = await replenishmentRpc(context, "get_replenishment_result", { p_org_id: context.orgId, p_request_id: id });
    if (!data) throw new ApiError(404, "No committed result found. Retry with the same request ID.");
    return NextResponse.json({ data }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return handleApiError(error); }
}

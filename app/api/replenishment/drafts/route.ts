import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/api/errors";
import { requireMinRole, requireRequestContext } from "@/lib/api/route-context";
import { batchSchema } from "@/lib/validators/replenishment";
import { replenishmentRpc } from "@/lib/replenishment/service";
import type { DraftResult } from "@/lib/replenishment/contracts";
export async function POST(request: NextRequest) {
  try {
    const context = await requireRequestContext(request); requireMinRole(context.role, "manager");
    // Calendar validity is checked in the DB after idempotent replay. A retry on
    // the next day must still be able to recover yesterday's committed result.
    const input = batchSchema.parse(await request.json());
    const data = await replenishmentRpc<DraftResult>(context, "create_replenishment_drafts", { p_org_id: context.orgId, p_payload: input });
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) { return handleApiError(error); }
}

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { handleApiError } from "@/lib/api/errors";
import { requireBillingOwner } from "@/lib/billing/ownership";
import { loadBillingRow } from "@/lib/billing/records";
import { previewPlanChange } from "@/lib/billing/subscription-service";

const schema = z.object({ plan: z.enum(["starter", "operations", "business"]), interval: z.enum(["monthly", "annual"]) });

export async function POST(request: NextRequest) {
  try {
    const context = await requireBillingOwner(request);
    const target = schema.parse(await request.json());
    const billing = await loadBillingRow(context.orgId, context.supabase);
    return NextResponse.json({ data: await previewPlanChange(billing, target.plan, target.interval) });
  } catch (error) { return handleApiError(error); }
}

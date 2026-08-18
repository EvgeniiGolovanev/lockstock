import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/api/errors";
import { requireRequestContext } from "@/lib/api/route-context";

export async function GET(request: NextRequest) {
  try {
    const { entitlements } = await requireRequestContext(request);
    return NextResponse.json({ data: entitlements });
  } catch (error) {
    return handleApiError(error);
  }
}

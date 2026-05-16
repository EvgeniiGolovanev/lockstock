import { NextRequest, NextResponse } from "next/server";
import { ApiError, handleApiError } from "@/lib/api/errors";
import { requirePlatformAdmin } from "@/lib/api/platform-admin";

export async function GET(request: NextRequest) {
  try {
    const context = await requirePlatformAdmin(request);

    return NextResponse.json({
      isPlatformAdmin: true,
      role: context.role
    });
  } catch (error) {
    if (error instanceof ApiError && error.status === 403) {
      return NextResponse.json({
        isPlatformAdmin: false,
        role: null
      });
    }

    return handleApiError(error);
  }
}

import { NextRequest, NextResponse } from "next/server";
import { ApiError, handleApiError } from "@/lib/api/errors";
import { extractBearerToken, requireAuthenticatedUserId } from "@/lib/api/auth";
import { getSupabaseUserClient } from "@/lib/supabase-user";
import { createOrganizationSchema } from "@/lib/validators/organization";

function isTrialRedeemedError(error: { message?: string } | null) {
  return error?.message === "Trial already redeemed";
}

export async function GET(request: NextRequest) {
  try {
    const token = extractBearerToken(request);
    if (!token) {
      return NextResponse.json({ error: "Missing Authorization Bearer token." }, { status: 401 });
    }

    const userId = await requireAuthenticatedUserId(request);
    const supabase = getSupabaseUserClient(token);

    const { data, error } = await supabase
      .from("org_users")
      .select("role, organization:organizations(id,name,created_at)")
      .eq("user_id", userId);

    if (error) {
      throw new ApiError(500, "Failed to load organizations.", error.message);
    }

    return NextResponse.json({ data });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = extractBearerToken(request);
    if (!token) {
      return NextResponse.json({ error: "Missing Authorization Bearer token." }, { status: 401 });
    }

    await requireAuthenticatedUserId(request);
    const supabase = getSupabaseUserClient(token);
    const payload = createOrganizationSchema.parse(await request.json());

    let { data: org, error: orgError } = await supabase.rpc("create_organization_with_owner", {
      p_name: payload.name,
      p_plan: payload.plan
    });

    // The first workspace can receive the account-level trial. Subsequent
    // workspaces are valid, independently billed tenants, so retry without a
    // trial rather than returning a misleading creation failure.
    if (isTrialRedeemedError(orgError)) {
      ({ data: org, error: orgError } = await supabase.rpc("create_organization_with_owner", {
        p_name: payload.name,
        p_plan: payload.plan,
        p_start_trial: false
      }));
    }

    if (orgError) {
      throw new ApiError(500, "Failed to create organization.", orgError.message);
    }

    if (!org) {
      throw new ApiError(500, "Failed to create organization.");
    }

    return NextResponse.json({ data: org }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

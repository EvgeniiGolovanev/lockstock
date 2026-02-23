import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/api/errors";
import { requireAuthenticatedUserId } from "@/lib/api/auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { createOrganizationSchema } from "@/lib/validators/organization";

export async function GET(request: NextRequest) {
  try {
    const userId = await requireAuthenticatedUserId(request);
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from("org_users")
      .select("role, organization:organizations(id,name,created_at)")
      .eq("user_id", userId);

    if (error) {
      throw error;
    }

    return NextResponse.json({ data });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await requireAuthenticatedUserId(request);
    const supabase = getSupabaseAdmin();
    const payload = createOrganizationSchema.parse(await request.json());

    const { data: org, error: orgError } = await supabase
      .from("organizations")
      .insert({ name: payload.name })
      .select("*")
      .single();

    if (orgError) {
      throw orgError;
    }

    const { error: memberError } = await supabase.from("org_users").insert({
      org_id: org.id,
      user_id: userId,
      role: "owner"
    });

    if (memberError) {
      throw memberError;
    }

    return NextResponse.json({ data: org }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

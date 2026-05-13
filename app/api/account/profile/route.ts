import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/api/errors";
import { extractBearerToken, requireAuthenticatedUserId } from "@/lib/api/auth";
import { getSupabaseUserClient } from "@/lib/supabase-user";

function metadataString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export async function POST(request: NextRequest) {
  try {
    const token = extractBearerToken(request);
    if (!token) {
      return NextResponse.json({ error: "Missing Authorization Bearer token." }, { status: 401 });
    }

    const userId = await requireAuthenticatedUserId(request);
    const supabase = getSupabaseUserClient(token);
    const { data, error: userError } = await supabase.auth.getUser();
    if (userError) {
      throw userError;
    }

    const fullName = metadataString(data.user?.user_metadata?.full_name);
    const email = metadataString(data.user?.email);

    const { error } = await supabase.from("user_profiles").upsert(
      {
        user_id: userId,
        email,
        full_name: fullName,
        updated_at: new Date().toISOString()
      },
      { onConflict: "user_id" }
    );

    if (error) {
      throw error;
    }

    return NextResponse.json({ data: { user_id: userId, email, full_name: fullName } });
  } catch (error) {
    return handleApiError(error);
  }
}

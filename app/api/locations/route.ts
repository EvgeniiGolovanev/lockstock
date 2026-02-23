import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/api/errors";
import { requireMinRole, requireRequestContext } from "@/lib/api/route-context";
import { createLocationSchema } from "@/lib/validators/location";

export async function GET(request: NextRequest) {
  try {
    const { orgId, supabase } = await requireRequestContext(request);

    const { data, error } = await supabase
      .from("locations")
      .select("*")
      .eq("org_id", orgId)
      .order("name", { ascending: true });

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
    const { orgId, role, supabase } = await requireRequestContext(request);
    requireMinRole(role, "manager");
    const payload = createLocationSchema.parse(await request.json());

    const { data, error } = await supabase
      .from("locations")
      .insert({
        org_id: orgId,
        name: payload.name,
        code: payload.code ?? null,
        is_active: payload.is_active
      })
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

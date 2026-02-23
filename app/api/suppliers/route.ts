import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/api/errors";
import { requireMinRole, requireRequestContext } from "@/lib/api/route-context";
import { createSupplierSchema } from "@/lib/validators/supplier";

export async function GET(request: NextRequest) {
  try {
    const { orgId, supabase } = await requireRequestContext(request);
    const q = request.nextUrl.searchParams.get("q");

    let query = supabase.from("suppliers").select("*").eq("org_id", orgId).order("created_at", { ascending: false });
    if (q) {
      query = query.ilike("name", `%${q}%`);
    }

    const { data, error } = await query;
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
    const { orgId, userId, role, supabase } = await requireRequestContext(request);
    requireMinRole(role, "manager");

    const payload = createSupplierSchema.parse(await request.json());

    const { data, error } = await supabase
      .from("suppliers")
      .insert({
        org_id: orgId,
        created_by: userId,
        ...payload
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

import { NextRequest, NextResponse } from "next/server";
import { ApiError, handleApiError } from "@/lib/api/errors";
import { requireMinRole, requireRequestContext } from "@/lib/api/route-context";
import { updateSupplierSchema } from "@/lib/validators/supplier";

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { orgId, role, supabase } = await requireRequestContext(request);
    requireMinRole(role, "manager");
    const { id } = await context.params;
    const payload = updateSupplierSchema.parse(await request.json());

    const { data, error } = await supabase
      .from("suppliers")
      .update({
        ...payload,
        updated_at: new Date().toISOString()
      })
      .eq("id", id)
      .eq("org_id", orgId)
      .select("*")
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      throw new ApiError(404, "Supplier not found.");
    }

    return NextResponse.json({ data });
  } catch (error) {
    return handleApiError(error);
  }
}

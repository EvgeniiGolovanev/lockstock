import { NextRequest, NextResponse } from "next/server";
import { ApiError, handleApiError } from "@/lib/api/errors";
import { requireMinRole, requireRequestContext } from "@/lib/api/route-context";
import { createStockMovementSchema } from "@/lib/validators/stock";

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

function parsePositiveInt(value: string | null, fallback: number) {
  if (!value) {
    return fallback;
  }
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

export async function GET(request: NextRequest) {
  try {
    const { orgId, supabase } = await requireRequestContext(request);
    const page = parsePositiveInt(request.nextUrl.searchParams.get("page"), 1);
    const limit = Math.min(parsePositiveInt(request.nextUrl.searchParams.get("limit"), DEFAULT_LIMIT), MAX_LIMIT);
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data, error, count } = await supabase
      .from("stock_movements")
      .select("id, quantity_delta, reason, note, created_at, material:materials(sku, name, uom, category), location:locations(code, name)", {
        count: "exact"
      })
      .eq("org_id", orgId)
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error) {
      throw error;
    }

    const total = count ?? 0;

    return NextResponse.json({
      data: data ?? [],
      meta: {
        page,
        limit,
        total,
        total_pages: Math.max(1, Math.ceil(total / limit))
      }
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { orgId, userId, role, supabase } = await requireRequestContext(request);
    requireMinRole(role, "member");
    const payload = createStockMovementSchema.parse(await request.json());

    const { data: material, error: materialError } = await supabase
      .from("materials")
      .select("id,is_active")
      .eq("id", payload.material_id)
      .eq("org_id", orgId)
      .maybeSingle();

    if (materialError) {
      throw materialError;
    }
    if (!material) {
      throw new ApiError(404, "Material not found.");
    }
    if (material.is_active === false) {
      throw new ApiError(400, "Material is blocked for usage.");
    }

    if (payload.reason === "transfer") {
      const { data, error } = await supabase.rpc("create_stock_transfer", {
        p_org_id: orgId,
        p_material_id: payload.material_id,
        p_from_location_id: payload.from_location_id,
        p_to_location_id: payload.to_location_id,
        p_quantity: payload.quantity,
        p_note: payload.note ?? null,
        p_created_by: userId
      });

      if (error) {
        throw error;
      }

      return NextResponse.json({ data: { movement_ids: data } }, { status: 201 });
    }

    const { data, error } = await supabase.rpc("create_stock_movement", {
      p_org_id: orgId,
      p_material_id: payload.material_id,
      p_location_id: payload.location_id,
      p_quantity_delta: payload.quantity_delta,
      p_reason: payload.reason,
      p_note: payload.note ?? null,
      p_reference_type: payload.reference_type ?? null,
      p_reference_id: payload.reference_id ?? null,
      p_created_by: userId
    });

    if (error) {
      throw error;
    }

    return NextResponse.json({ data: { movement_id: data } }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

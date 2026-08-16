import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/api/errors";
import { requireMinRole, requireRequestContext } from "@/lib/api/route-context";
import { createSupplierSchema } from "@/lib/validators/supplier";

const DEFAULT_LIMIT = 20;
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
    const q = request.nextUrl.searchParams.get("q")?.trim();
    const status = request.nextUrl.searchParams.get("status");
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabase
      .from("suppliers")
      .select("*", { count: "exact" })
      .eq("org_id", orgId)
      .order("vendor_number", { ascending: true })
      .order("created_at", { ascending: true })
      .range(from, to);

    if (q) {
      query = query.or(`name.ilike.%${q}%,phone.ilike.%${q}%,address.ilike.%${q}%,vendor_number::text.ilike.%${q}%`);
    }
    if (status === "active") {
      query = query.eq("is_active", true);
    } else if (status === "blocked") {
      query = query.eq("is_active", false);
    }

    const { data, error, count } = await query;
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

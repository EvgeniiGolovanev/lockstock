import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/api/errors";
import { requireMinRole, requireRequestContext } from "@/lib/api/route-context";
import { createMaterialSchema } from "@/lib/validators/material";

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
    const q = request.nextUrl.searchParams.get("q")?.trim();
    const page = parsePositiveInt(request.nextUrl.searchParams.get("page"), 1);
    const limit = Math.min(parsePositiveInt(request.nextUrl.searchParams.get("limit"), DEFAULT_LIMIT), MAX_LIMIT);
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabase
      .from("materials")
      .select("*", { count: "exact" })
      .eq("org_id", orgId)
      .order("created_at", { ascending: false })
      .range(from, to);

    if (q) {
      query = query.or(`name.ilike.%${q}%,sku.ilike.%${q}%`);
    }

    const { data, error, count } = await query;

    if (error) {
      throw error;
    }

    const total = count ?? 0;

    return NextResponse.json({
      data,
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

    const payload = createMaterialSchema.parse(await request.json());

    const { data, error } = await supabase
      .from("materials")
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

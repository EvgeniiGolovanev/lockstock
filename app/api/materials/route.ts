import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/api/errors";
import { requireMinRole, requireRequestContext } from "@/lib/api/route-context";
import { createMaterialSchema } from "@/lib/validators/material";

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

type MaterialBalanceRow = {
  quantity: number | string | null;
  location?: { code: string | null; name: string } | null;
};

type MaterialListRow = {
  min_stock: number | string | null;
  balances?: MaterialBalanceRow[];
  [key: string]: unknown;
};

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
      .select("*, balances:inventory_balances(quantity, location:locations(code,name))", { count: "exact" })
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
    const enriched = ((data ?? []) as MaterialListRow[]).map((material) => {
      const balances = (Array.isArray(material.balances) ? material.balances : []) as MaterialBalanceRow[];
      const totalQuantity = balances.reduce((sum: number, balance: MaterialBalanceRow) => sum + Number(balance.quantity ?? 0), 0);
      const topBalance =
        balances
          .filter((balance: MaterialBalanceRow) => Number(balance.quantity ?? 0) > 0)
          .sort((a: MaterialBalanceRow, b: MaterialBalanceRow) => Number(b.quantity ?? 0) - Number(a.quantity ?? 0))[0] ??
        balances[0] ??
        null;
      const primaryLocation = topBalance?.location
        ? `${topBalance.location.code ? `${topBalance.location.code} - ` : ""}${topBalance.location.name}`
        : null;

      const minStock = Number(material.min_stock ?? 0);
      const stockStatus = totalQuantity <= 0 ? "out-of-stock" : totalQuantity <= minStock ? "low-stock" : "in-stock";

      return {
        ...material,
        total_quantity: totalQuantity,
        primary_location: primaryLocation,
        stock_status: stockStatus
      };
    });

    return NextResponse.json({
      data: enriched,
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

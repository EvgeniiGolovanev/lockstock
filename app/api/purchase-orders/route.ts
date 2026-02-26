import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/api/errors";
import { requireMinRole, requireRequestContext } from "@/lib/api/route-context";
import { createPurchaseOrderSchema } from "@/lib/validators/purchase-order";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const PO_STATUSES = new Set(["draft", "sent", "partial", "received", "cancelled"]);

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

function makePoNumber() {
  const stamp = new Date().toISOString().replaceAll("-", "").replaceAll(":", "").replace("T", "-").slice(0, 15);
  return `PO-${stamp}`;
}

export async function GET(request: NextRequest) {
  try {
    const { orgId, supabase } = await requireRequestContext(request);
    const status = request.nextUrl.searchParams.get("status");
    const supplierId = request.nextUrl.searchParams.get("supplier_id");
    const q = request.nextUrl.searchParams.get("q")?.trim();
    const page = parsePositiveInt(request.nextUrl.searchParams.get("page"), 1);
    const limit = Math.min(parsePositiveInt(request.nextUrl.searchParams.get("limit"), DEFAULT_LIMIT), MAX_LIMIT);
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabase
      .from("purchase_orders")
      .select("*, supplier:suppliers(id,name), lines:po_lines(*)", { count: "exact" })
      .eq("org_id", orgId)
      .order("created_at", { ascending: false })
      .range(from, to);

    if (status && status !== "all" && PO_STATUSES.has(status)) {
      query = query.eq("status", status);
    }

    if (supplierId && supplierId !== "all") {
      query = query.eq("supplier_id", supplierId);
    }

    if (q) {
      query = query.ilike("po_number", `%${q}%`);
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
    const payload = createPurchaseOrderSchema.parse(await request.json());
    const poNumber = payload.po_number ?? makePoNumber();

    const { data: po, error: poError } = await supabase
      .from("purchase_orders")
      .insert({
        org_id: orgId,
        supplier_id: payload.supplier_id,
        po_number: poNumber,
        expected_at: payload.expected_at ?? null,
        notes: payload.notes ?? null,
        created_by: userId,
        status: "draft"
      })
      .select("*")
      .single();

    if (poError) {
      throw poError;
    }

    const lineRows = payload.lines.map((line) => ({
      org_id: orgId,
      purchase_order_id: po.id,
      material_id: line.material_id,
      quantity_ordered: line.quantity_ordered,
      unit_price: line.unit_price ?? null
    }));

    const { data: lines, error: linesError } = await supabase.from("po_lines").insert(lineRows).select("*");
    if (linesError) {
      throw linesError;
    }

    return NextResponse.json({ data: { ...po, lines } }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

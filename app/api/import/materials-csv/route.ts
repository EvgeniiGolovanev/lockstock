import { NextRequest, NextResponse } from "next/server";
import { ApiError, handleApiError } from "@/lib/api/errors";
import { requireMinRole, requireRequestContext } from "@/lib/api/route-context";

type ParsedCsvRow = {
  sku: string;
  name: string;
  uom: string;
  min_stock: number;
};

function parseCsv(input: string): ParsedCsvRow[] {
  const lines = input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length < 2) {
    return [];
  }

  const [header, ...rows] = lines;
  const columns = header.split(",").map((item) => item.trim().toLowerCase());
  const skuIndex = columns.indexOf("sku");
  const nameIndex = columns.indexOf("name");
  const uomIndex = columns.indexOf("uom");
  const minStockIndex = columns.indexOf("min_stock");

  if (skuIndex < 0 || nameIndex < 0) {
    throw new ApiError(400, "CSV requires sku and name columns.");
  }

  return rows.map((row) => {
    const parts = row.split(",").map((item) => item.trim());
    return {
      sku: parts[skuIndex],
      name: parts[nameIndex],
      uom: uomIndex >= 0 ? parts[uomIndex] || "unit" : "unit",
      min_stock: minStockIndex >= 0 ? Number(parts[minStockIndex] || 0) : 0
    };
  });
}

export async function POST(request: NextRequest) {
  try {
    const { orgId, userId, role, supabase } = await requireRequestContext(request);
    requireMinRole(role, "manager");

    const csv = await request.text();
    const parsed = parseCsv(csv);

    const rows = parsed.map((item) => ({
      org_id: orgId,
      created_by: userId,
      sku: item.sku,
      name: item.name,
      uom: item.uom,
      min_stock: Number.isFinite(item.min_stock) ? item.min_stock : 0,
      is_active: true
    }));

    if (rows.length === 0) {
      return NextResponse.json({ data: { inserted: 0 } });
    }

    const { data, error } = await supabase
      .from("materials")
      .upsert(rows, { onConflict: "org_id,sku", ignoreDuplicates: false })
      .select("id,sku,name,uom,min_stock");

    if (error) {
      throw error;
    }

    return NextResponse.json({ data: { inserted: data.length, materials: data } }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

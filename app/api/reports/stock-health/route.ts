import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/api/errors";
import { requireRequestContext } from "@/lib/api/route-context";

type StockHealthRow = {
  total_materials: number;
  total_quantity: number;
  out_of_stock: number;
  low_stock: number;
};

export async function GET(request: NextRequest) {
  try {
    const { orgId, supabase } = await requireRequestContext(request);

    const { data, error } = await supabase.rpc("get_stock_health", {
      p_org_id: orgId
    });

    if (error) {
      throw error;
    }

    const summary = (data?.[0] as StockHealthRow | undefined) ?? {
      total_materials: 0,
      total_quantity: 0,
      out_of_stock: 0,
      low_stock: 0
    };

    return NextResponse.json({ data: summary });
  } catch (error) {
    return handleApiError(error);
  }
}

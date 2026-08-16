import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/api/errors";
import { requireRequestContext } from "@/lib/api/route-context";

type LowStockRow = {
  material_id: string;
  sku: string;
  name: string;
  min_stock: number;
  quantity: number;
  deficit: number;
};

export async function GET(request: NextRequest) {
  try {
    const { orgId, supabase } = await requireRequestContext(request);

    const { data, error } = await supabase.rpc("get_low_stock_materials", {
      p_org_id: orgId
    });

    if (error) {
      throw error;
    }

    const lowStock = (data ?? []) as LowStockRow[];

    return NextResponse.json({ data: lowStock });
  } catch (error) {
    return handleApiError(error);
  }
}

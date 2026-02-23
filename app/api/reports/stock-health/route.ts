import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/api/errors";
import { requireRequestContext } from "@/lib/api/route-context";

type MaterialRow = {
  id: string;
  min_stock: number;
  inventory_balances: Array<{ quantity: number }> | null;
};

export async function GET(request: NextRequest) {
  try {
    const { orgId, supabase } = await requireRequestContext(request);

    const { data, error } = await supabase
      .from("materials")
      .select("id,min_stock,inventory_balances(quantity)")
      .eq("org_id", orgId)
      .eq("is_active", true);

    if (error) {
      throw error;
    }

    const rows = data as MaterialRow[];
    const summary = rows.reduce(
      (acc, row) => {
        const quantity = (row.inventory_balances ?? []).reduce((sum, balance) => sum + Number(balance.quantity), 0);
        acc.total_materials += 1;
        acc.total_quantity += quantity;
        if (quantity === 0) {
          acc.out_of_stock += 1;
        }
        if (quantity <= row.min_stock) {
          acc.low_stock += 1;
        }
        return acc;
      },
      { total_materials: 0, total_quantity: 0, out_of_stock: 0, low_stock: 0 }
    );

    return NextResponse.json({ data: summary });
  } catch (error) {
    return handleApiError(error);
  }
}

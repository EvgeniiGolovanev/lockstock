import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/api/errors";
import { requireRequestContext } from "@/lib/api/route-context";

type MaterialWithBalances = {
  id: string;
  sku: string;
  name: string;
  min_stock: number;
  inventory_balances: Array<{ quantity: number }> | null;
};

export async function GET(request: NextRequest) {
  try {
    const { orgId, supabase } = await requireRequestContext(request);

    const { data, error } = await supabase
      .from("materials")
      .select("id,sku,name,min_stock,inventory_balances(quantity)")
      .eq("org_id", orgId)
      .eq("is_active", true);

    if (error) {
      throw error;
    }

    const lowStock = (data as MaterialWithBalances[]).flatMap((material) => {
      const totalQuantity = (material.inventory_balances ?? []).reduce((acc, balance) => acc + Number(balance.quantity), 0);
      if (totalQuantity > material.min_stock) {
        return [];
      }

      return [
        {
          material_id: material.id,
          sku: material.sku,
          name: material.name,
          min_stock: material.min_stock,
          quantity: totalQuantity,
          deficit: Math.max(0, material.min_stock - totalQuantity)
        }
      ];
    });

    return NextResponse.json({ data: lowStock });
  } catch (error) {
    return handleApiError(error);
  }
}

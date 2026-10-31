import { ApiError } from "@/lib/api/errors";
import type { RequestContext } from "@/lib/api/route-context";

export async function replenishmentRpc<T>(context: RequestContext, name: string, args: Record<string, unknown>): Promise<T> {
  // The transport is shared by five SQL commands; callers own their return contract.
  const rpc = context.supabase.rpc.bind(context.supabase) as (name: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { code?: string; message: string } | null }>;
  const { data, error } = await rpc(name, args);
  if (error) {
    const status = error.code === "PT409" || error.code === "40001" || error.code === "40P01" ? 409 : error.code === "42501" ? 403 : ["22023", "22P02", "23514", "23505", "22003"].includes(error.code ?? "") ? 400 : 500;
    if (status === 500) throw error;
    throw new ApiError(status, error.code === "40P01" ? "Data changed concurrently; retry the same request." : error.message);
  }
  return data as T;
}

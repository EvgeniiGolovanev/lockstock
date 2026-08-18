import { ApiError } from "@/lib/api/errors";
import type { Database } from "@/types/database";
import { getSupabaseServiceClient } from "@/lib/supabase-service";

export type OrganizationBillingRow = Database["public"]["Tables"]["organization_billing"]["Row"];

export async function loadBillingRow(orgId: string, supabase = getSupabaseServiceClient()) {
  const { data, error } = await supabase.from("organization_billing").select("*").eq("org_id", orgId).maybeSingle();
  if (error) throw new ApiError(500, "Failed to load organization billing.", error.message);
  if (!data) throw new ApiError(404, "Organization billing record not found.");
  return data;
}

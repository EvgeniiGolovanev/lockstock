import { NextRequest } from "next/server";
import { ApiError } from "@/lib/api/errors";
import { extractBearerToken, requireAuthenticatedUserId } from "@/lib/api/auth";
import { getSupabaseServiceClient } from "@/lib/supabase-service";
import { getSupabaseUserClient } from "@/lib/supabase-user";
import type { BillingPlan } from "@/lib/billing/plan-contract";

export type BillingOwnerContext = {
  orgId: string;
  userId: string;
  token: string;
  supabase: ReturnType<typeof getSupabaseServiceClient>;
};

export async function requireBillingOwner(request: NextRequest): Promise<BillingOwnerContext> {
  const token = extractBearerToken(request);
  if (!token) throw new ApiError(401, "Missing Authorization Bearer token.");
  const userId = await requireAuthenticatedUserId(request);
  const orgId = request.headers.get("x-org-id");
  if (!orgId) throw new ApiError(400, "Missing x-org-id request header.");
  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .from("org_users")
    .select("role")
    .eq("org_id", orgId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new ApiError(500, "Failed to validate billing access.", error.message);
  if (!data || data.role !== "owner") throw new ApiError(403, "Only the organization owner can manage billing.");
  return { orgId, userId, token, supabase };
}

export async function ensureOwnedOrganization(request: NextRequest, plan: BillingPlan, startTrial: boolean) {
  const token = extractBearerToken(request);
  if (!token) throw new ApiError(401, "Missing Authorization Bearer token.");
  const userId = await requireAuthenticatedUserId(request);
  const userClient = getSupabaseUserClient(token);
  const { data: memberships, error: membershipError } = await userClient
    .from("org_users")
    .select("org_id,role")
    .eq("user_id", userId);
  if (membershipError) throw new ApiError(500, "Failed to load owned workspace.", membershipError.message);
  const owned = (memberships ?? []).find((membership) => membership.role === "owner");
  if (owned) return { orgId: owned.org_id as string, created: false };

  const { data: userData } = await userClient.auth.getUser();
  const user = userData.user;
  const company = typeof user?.user_metadata?.company === "string"
    ? user.user_metadata.company.trim()
    : "";
  const selectedPlan = startTrial && isBillingPlan(user?.user_metadata?.selected_plan)
    ? user.user_metadata.selected_plan
    : plan;
  const { data: organization, error } = await userClient.rpc("create_organization_with_owner", {
    p_name: company || "My Workspace",
    p_plan: selectedPlan,
    p_start_trial: startTrial
  });
  if (error || !organization) throw new ApiError(500, "Failed to create billing workspace.", error?.message);
  return { orgId: organization.id as string, created: true };
}

function isBillingPlan(value: unknown): value is BillingPlan {
  return value === "starter" || value === "operations" || value === "business" || value === "enterprise";
}

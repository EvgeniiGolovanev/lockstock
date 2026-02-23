import { NextRequest } from "next/server";
import { ApiError } from "@/lib/api/errors";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { requireAuthenticatedUserId } from "@/lib/api/auth";

const roleRank = {
  viewer: 0,
  member: 1,
  manager: 2,
  owner: 3
} as const;

type Role = keyof typeof roleRank;

export type RequestContext = {
  orgId: string;
  userId: string;
  role: Role;
  supabase: ReturnType<typeof getSupabaseAdmin>;
};

export async function requireRequestContext(request: NextRequest): Promise<RequestContext> {
  const orgId = request.headers.get("x-org-id");
  const userId = await requireAuthenticatedUserId(request);

  if (!orgId) {
    throw new ApiError(400, "Missing x-org-id request header.");
  }

  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("org_users")
    .select("role")
    .eq("org_id", orgId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new ApiError(500, "Failed to validate organization membership.", error.message);
  }

  if (!data) {
    throw new ApiError(403, "User is not a member of this organization.");
  }

  const role = data.role as Role;

  return { orgId, userId, role, supabase };
}

export function requireMinRole(currentRole: Role, minimumRole: Role) {
  if (roleRank[currentRole] < roleRank[minimumRole]) {
    throw new ApiError(403, `This action requires ${minimumRole} role or higher.`);
  }
}

export async function requireUserInOrg(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  orgId: string,
  userId: string
) {
  const { data, error } = await supabase
    .from("org_users")
    .select("user_id")
    .eq("org_id", orgId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new ApiError(500, "Failed to validate requested user membership.", error.message);
  }

  if (!data) {
    throw new ApiError(400, "Requested user is not a member of this organization.");
  }
}

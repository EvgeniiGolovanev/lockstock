import { NextRequest } from "next/server";
import { ApiError } from "@/lib/api/errors";
import { getSupabaseUserClient } from "@/lib/supabase-user";
import { extractBearerToken, requireAuthenticatedUserId } from "@/lib/api/auth";

const roleRank = {
  viewer: 0,
  member: 1,
  manager: 2,
  owner: 3
} as const;

type Role = keyof typeof roleRank;

const uuidV4LikePattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type RequestContext = {
  orgId: string;
  userId: string;
  role: Role;
  supabase: ReturnType<typeof getSupabaseUserClient>;
};

export async function requireRequestContext(request: NextRequest): Promise<RequestContext> {
  const orgId = request.headers.get("x-org-id");
  const token = extractBearerToken(request);

  if (!token) {
    throw new ApiError(401, "Missing Authorization Bearer token.");
  }

  const userId = await requireAuthenticatedUserId(request);

  if (!orgId) {
    throw new ApiError(400, "Missing x-org-id request header.");
  }
  if (!uuidV4LikePattern.test(orgId)) {
    throw new ApiError(400, "x-org-id must be a valid UUID.");
  }

  const supabase = getSupabaseUserClient(token);

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
  supabase: ReturnType<typeof getSupabaseUserClient>,
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

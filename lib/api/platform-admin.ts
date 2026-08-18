import { NextRequest } from "next/server";
import { ApiError } from "@/lib/api/errors";
import { requireAuthenticatedUserId } from "@/lib/api/auth";
import { getSupabaseServiceClient } from "@/lib/supabase-service";
import type { Json } from "@/types/database";

export const platformRoleRank = {
  support: 0,
  operator: 1,
  admin: 2
} as const;

export type PlatformRole = keyof typeof platformRoleRank;

export function requirePlatformMinRole(currentRole: PlatformRole, minimumRole: PlatformRole) {
  if (platformRoleRank[currentRole] < platformRoleRank[minimumRole]) {
    throw new ApiError(403, `This action requires platform ${minimumRole} access.`);
  }
}

export type PlatformAdminContext = {
  userId: string;
  role: PlatformRole;
  supabase: ReturnType<typeof getSupabaseServiceClient>;
};

export async function requirePlatformAdmin(request: NextRequest): Promise<PlatformAdminContext> {
  const userId = await requireAuthenticatedUserId(request);
  const supabase = getSupabaseServiceClient();

  const { data, error } = await supabase
    .from("platform_admins")
    .select("role")
    .eq("user_id", userId)
    .is("disabled_at", null)
    .maybeSingle();

  if (error) {
    throw new ApiError(500, "Failed to validate platform admin access.", error.message);
  }

  if (!data) {
    throw new ApiError(403, "Platform admin access is required.");
  }

  return {
    userId,
    role: data.role as PlatformRole,
    supabase
  };
}

export async function logPlatformAccess(context: PlatformAdminContext, action: string, metadata: Json = {}) {
  const { error } = await context.supabase.from("platform_access_log").insert({
    actor_user_id: context.userId,
    actor_role: context.role,
    action,
    metadata
  });

  if (error) {
    throw new ApiError(500, "Failed to record platform access.", error.message);
  }
}

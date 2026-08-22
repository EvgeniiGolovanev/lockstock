import { ApiError } from "@/lib/api/errors";
import { getSupabaseServiceClient } from "@/lib/supabase-service";

export type PublicRateLimitScope = "contact" | "billing_checkout" | "billing_trial";

type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retry_after_seconds: number;
};

export function getRateLimitSubject(request: Request, subject: string) {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = request.headers.get("x-real-ip")?.trim();
  return `${forwardedFor || realIp || "unknown"}:${subject.toLowerCase()}`;
}

export async function consumePublicRateLimit(scope: PublicRateLimitScope, subject: string) {
  const { data, error } = await getSupabaseServiceClient()
    .rpc("consume_public_rate_limit", { p_scope: scope, p_subject: subject })
    .single();

  if (error || !data) {
    console.error("Durable rate limit check failed", { scope, message: error?.message ?? "No result returned" });
    throw new ApiError(503, "Rate limiting is temporarily unavailable.");
  }

  const result = data as RateLimitResult;
  return {
    allowed: result.allowed,
    remaining: result.remaining,
    retryAfterSeconds: result.retry_after_seconds
  };
}

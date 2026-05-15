const CONTACT_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const CONTACT_RATE_LIMIT_MAX_REQUESTS = 5;

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

const contactRateLimitStore = new Map<string, RateLimitEntry>();

export function getContactRateLimitKey(request: Request, email: string) {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = request.headers.get("x-real-ip")?.trim();
  const clientIp = forwardedFor || realIp || "unknown";

  return `${clientIp}:${email.toLowerCase()}`;
}

export function checkContactRateLimit(key: string, now = Date.now()) {
  const existing = contactRateLimitStore.get(key);

  if (!existing || existing.resetAt <= now) {
    contactRateLimitStore.set(key, {
      count: 1,
      resetAt: now + CONTACT_RATE_LIMIT_WINDOW_MS
    });
    return { allowed: true, remaining: CONTACT_RATE_LIMIT_MAX_REQUESTS - 1 };
  }

  if (existing.count >= CONTACT_RATE_LIMIT_MAX_REQUESTS) {
    return { allowed: false, remaining: 0 };
  }

  existing.count += 1;
  return { allowed: true, remaining: CONTACT_RATE_LIMIT_MAX_REQUESTS - existing.count };
}

export function resetContactRateLimit() {
  contactRateLimitStore.clear();
}

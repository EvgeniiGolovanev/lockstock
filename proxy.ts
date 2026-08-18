import { NextRequest, NextResponse } from "next/server";
import { extractBearerToken, requireAuthenticatedUserId } from "@/lib/api/auth";

const PUBLIC_API_PATHS = new Set(["/api/health", "/api/contact", "/api/billing/webhook"]);

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  // Playwright supplies deterministic browser fixtures and intercepts every
  // protected API response. Its development server has no Supabase Auth
  // service, so keep this opt-in escape hatch confined to that process.
  if (process.env.PLAYWRIGHT_E2E === "true") {
    return NextResponse.next();
  }

  if (PUBLIC_API_PATHS.has(pathname)) {
    return NextResponse.next();
  }

  if (!extractBearerToken(request)) {
    return NextResponse.json({ error: "Missing Authorization Bearer token." }, { status: 401 });
  }

  try {
    await requireAuthenticatedUserId(request);
    return NextResponse.next();
  } catch {
    return NextResponse.json({ error: "Invalid or expired access token." }, { status: 401 });
  }
}

export const config = {
  matcher: ["/api/:path*"]
};

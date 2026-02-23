import { createClient } from "@supabase/supabase-js";
import { NextRequest } from "next/server";
import { ApiError } from "@/lib/api/errors";

let authClient: ReturnType<typeof createClient> | null = null;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function getAuthClient() {
  if (authClient) {
    return authClient;
  }

  authClient = createClient(requireEnv("NEXT_PUBLIC_SUPABASE_URL"), requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"), {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });

  return authClient;
}

export function extractBearerToken(request: NextRequest): string | null {
  const authorization = request.headers.get("authorization");
  if (!authorization) {
    return null;
  }

  const [scheme, token] = authorization.split(" ");
  if (!scheme || !token || scheme.toLowerCase() !== "bearer") {
    return null;
  }

  return token;
}

export async function requireAuthenticatedUserId(request: NextRequest): Promise<string> {
  const token = extractBearerToken(request);
  if (!token) {
    throw new ApiError(401, "Missing Authorization Bearer token.");
  }

  const { data, error } = await getAuthClient().auth.getUser(token);
  if (error || !data.user) {
    throw new ApiError(401, "Invalid or expired access token.");
  }

  return data.user.id;
}

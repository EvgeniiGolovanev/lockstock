/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from "@supabase/supabase-js";

let client: ReturnType<typeof createClient<any>> | null = null;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function getSupabaseAdmin() {
  if (client) {
    return client;
  }

  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRole = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

  client = createClient<any>(url, serviceRole, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });

  return client;
}

import { createClient } from "@supabase/supabase-js";

/** Recovery credentials stay in memory and never replace the regular browser session. */
export async function openRecoverySession(hash: string) {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  const access_token = params.get("access_token");
  const refresh_token = params.get("refresh_token");
  if (params.get("type") !== "recovery" || params.has("error") || !access_token || !refresh_token) {
    throw new Error("Invalid recovery link");
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Auth unavailable");
  const client = createClient(url, key, {
    auth: { persistSession: false, detectSessionInUrl: false, autoRefreshToken: false, storageKey: "lockstock-password-recovery" }
  });
  const { data, error } = await client.auth.setSession({ access_token, refresh_token });
  if (error || !data.session) throw new Error("Invalid recovery session");
  const verified = await client.auth.getUser();
  if (verified.error || !verified.data.user) throw new Error("Invalid recovery user");
  return client;
}

import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { browserApiRequest } from "@/lib/api/browser-request";
import { buildPostSignUpPath } from "@/lib/auth/signup";

export type GoogleOnboarding = {
  fullName: string;
  company: string;
  onboardingMode: "trial" | "paid";
  selectedPlan: "starter" | "operations" | "business";
};
type GoogleIntent = Partial<GoogleOnboarding> & { returnTo: string; createdAt: number };
const INTENT_KEY = "lockstock.google-intent";
const ORG_KEY = "lockstock.orgId";
const RETURN_PATHS = new Set(["/inventory", "/account", "/payment", "/materials", "/locations", "/vendors", "/purchase-orders", "/stock-movements", "/members", "/workflows"]);

export function safeGoogleReturnPath(value = "/inventory") {
  // Exact pathname allow-list also rejects protocol-relative and encoded redirects.
  const path = value.split("?")[0];
  return RETURN_PATHS.has(path) && !/[\\\r\n#]/.test(value) ? value : "/inventory";
}

function readIntent(): GoogleIntent | null {
  try {
    const intent = JSON.parse(window.sessionStorage.getItem(INTENT_KEY) ?? "null");
    if (!intent || typeof intent.createdAt !== "number" || Date.now() - intent.createdAt > 30 * 60_000 || intent.createdAt > Date.now()) return null;
    return { ...intent, returnTo: safeGoogleReturnPath(typeof intent.returnTo === "string" ? intent.returnTo : undefined) };
  } catch { return null; }
}

export async function startGoogleSignIn(input: Partial<GoogleOnboarding> & { returnTo?: string } = {}) {
  const intent: GoogleIntent = { ...input, returnTo: safeGoogleReturnPath(input.returnTo), createdAt: Date.now() };
  window.sessionStorage.setItem(INTENT_KEY, JSON.stringify(intent));
  try {
    const { error } = await getSupabaseBrowserClient().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` }
    });
    if (error) throw error;
  } catch (error) {
    window.sessionStorage.removeItem(INTENT_KEY);
    throw error;
  }
}

async function requireSession() {
  const { data, error } = await getSupabaseBrowserClient().auth.getSession();
  if (error || !data.session) throw new Error("google.failed");
  return data.session;
}

async function selectWorkspace(session: Awaited<ReturnType<typeof requireSession>>) {
  const { data } = await browserApiRequest<{ data: { organization: { id: string } | null }[] }>("/api/organizations", { getSession: async () => session });
  const ids = data.flatMap(item => item.organization ? [item.organization.id] : []);
  const previous = window.localStorage.getItem(ORG_KEY);
  const selected = ids.find(id => id === previous) ?? ids[0];
  if (selected) window.localStorage.setItem(ORG_KEY, selected);
  else window.localStorage.removeItem(ORG_KEY);
  return selected;
}

export async function finishGoogleSignIn(href: string) {
  const url = new URL(href);
  const params = new URLSearchParams(url.hash.slice(1));
  if (params.has("error") || url.searchParams.has("error")) throw new Error("google.cancelled");
  const intent = readIntent();
  if (!intent || !params.get("access_token") || !params.get("refresh_token")) throw new Error("google.failed");
  // Keep the app's existing browser-session flow. The SDK consumes the fragment
  // during initialization; do not introduce cookie auth or change email signup.
  const session = await requireSession();
  if (session.access_token !== params.get("access_token")) throw new Error("google.failed");
  if (!await selectWorkspace(session)) return "/auth/complete";
  window.sessionStorage.removeItem(INTENT_KEY);
  return intent.returnTo;
}

export async function loadGoogleOnboarding(): Promise<GoogleOnboarding & { redirectTo?: string }> {
  const session = await requireSession();
  const intent = readIntent();
  const workspace = await selectWorkspace(session);
  return {
    fullName: intent?.fullName || String(session.user.user_metadata.full_name ?? ""),
    company: intent?.company || String(session.user.user_metadata.company ?? ""),
    onboardingMode: intent?.onboardingMode === "paid" ? "paid" : "trial",
    selectedPlan: intent?.selectedPlan === "operations" || intent?.selectedPlan === "business" ? intent.selectedPlan : "starter",
    ...(workspace ? { redirectTo: intent?.returnTo ?? "/inventory" } : {})
  };
}

export async function completeGoogleOnboarding(input: GoogleOnboarding) {
  const session = await requireSession();
  const intent = readIntent();
  // A retry or another tab may already have completed signup. Never start
  // another trial or overwrite an existing member's profile in that case.
  if (await selectWorkspace(session)) return intent?.returnTo ?? "/inventory";
  if (!input.fullName.trim() || !input.company.trim()) throw new Error("google.detailsRequired");
  const selectedPlan = input.onboardingMode === "trial" ? "starter" : input.selectedPlan;
  const { error } = await getSupabaseBrowserClient().auth.updateUser({ data: {
    full_name: input.fullName.trim(), company: input.company.trim(),
    onboarding_mode: input.onboardingMode, selected_plan: selectedPlan
  } });
  if (error) throw error;
  if (input.onboardingMode === "trial") {
    const { data } = await browserApiRequest<{ data: { orgId: string } }>("/api/billing/start-trial", { method: "POST", getSession: async () => session });
    window.localStorage.setItem(ORG_KEY, data.orgId);
  }
  window.sessionStorage.removeItem(INTENT_KEY);
  const path = buildPostSignUpPath(input);
  const annual = intent?.returnTo.startsWith("/payment?") && new URLSearchParams(intent.returnTo.split("?")[1]).get("interval") === "annual";
  return input.onboardingMode === "paid" && annual ? `${path}&interval=annual` : path;
}

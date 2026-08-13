import { createClient } from "@supabase/supabase-js";

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function classifyRow(row, cutoffIso) {
  const hasStripeEvidence = Boolean(row.stripe_subscription_id || row.stripe_customer_id || row.stripe_checkout_session_id || row.stripe_subscription_schedule_id);
  if (row.status === "trialing") {
    return { category: "trial", reason: row.trial_ends_at ? "active_trial" : "trial_without_expiry" };
  }
  if (row.status === "active" && hasStripeEvidence) {
    return { category: "paid", reason: "stripe-backed" };
  }
  if (row.status === "active" && row.plan === "starter" && !hasStripeEvidence && row.org_created_at < cutoffIso) {
    return { category: "grandfathered", reason: "pre_cutoff_active_starter_without_stripe" };
  }
  if (row.status === "active") {
    return { category: "unknown", reason: hasStripeEvidence ? "active_unclassified_with_stripe" : "active_without_stripe_evidence" };
  }
  return { category: "inactive", reason: row.status };
}

async function main() {
  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const cutoffIso = process.env.LEGACY_BILLING_CUTOFF_ISO || "2026-06-27T15:00:00.000Z";
  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const { data, error } = await supabase
    .from("organization_billing")
    .select("org_id,plan,status,billing_interval,trial_ends_at,current_period_end,stripe_customer_id,stripe_subscription_id,stripe_checkout_session_id,stripe_subscription_schedule_id,organizations:org_id(created_at,name)")
    .order("org_id", { ascending: true });

  if (error) {
    throw new Error(`Failed to load billing rows: ${error.message}`);
  }

  const rows = (data ?? []).map((row) => ({
    org_id: row.org_id,
    org_name: row.organizations?.name ?? null,
    org_created_at: row.organizations?.created_at ?? cutoffIso,
    plan: row.plan,
    status: row.status,
    billing_interval: row.billing_interval,
    trial_ends_at: row.trial_ends_at,
    current_period_end: row.current_period_end,
    stripe_customer_id: row.stripe_customer_id,
    stripe_subscription_id: row.stripe_subscription_id,
    stripe_checkout_session_id: row.stripe_checkout_session_id,
    stripe_subscription_schedule_id: row.stripe_subscription_schedule_id
  }));

  const classified = rows.map((row) => ({ ...row, ...classifyRow(row, cutoffIso) }));
  const counts = classified.reduce((acc, row) => {
    acc[row.category] = (acc[row.category] ?? 0) + 1;
    return acc;
  }, {});

  console.log(JSON.stringify({
    cutoffIso,
    counts,
    rows: classified
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

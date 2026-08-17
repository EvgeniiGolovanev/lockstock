# P1: Preserve trial plan intent and audit legacy access

**Status: completed — 2026-08-17.** Completed in `54c6a16` with separate plan
intent, effective trial access, and legacy access audit coverage.

Keep the user's selected future plan separate from effective Starter trial
access, and make legacy active access an explicit business decision rather than
an accidental migration default.

## Evidence and risk

`20260627155735_subscription_checkout.sql` writes `starter` whenever
`p_start_trial` is true, even if the caller supplies Operations or Business.
The selected future plan can therefore be lost before conversion. Separately,
`202606271500_plan_trials_and_entitlements.sql` marks every pre-existing tenant
active on Starter. That may grant indefinite writes to an unpaid workspace and
conflicts with the agreed expired-or-inactive read-only behavior.

## Minimal implementation

Use the database test seam and resolve data semantics before catalog cleanup.

1. Add failing tests for selected Operations or Business plus effective Starter
   trial access, trial expiry, and later paid activation of the selection.
2. Store selected plan independently, either in the existing `plan` column when
   status is trialing or in a narrowly named field. Do not infer it from user
   metadata after workspace creation.
3. Produce a read-only report of legacy billing rows with evidence for paid,
   intentionally grandfathered, trial, and unknown cases.
4. Obtain a product decision for unknown legacy tenants. Prepare a previewable,
   idempotent backfill; never disable confirmed paid tenants.
5. Add regression tests for signup, workspace creation, billing summary, and
   activation.

## Acceptance criteria

Trial entitlements remain Starter while the chosen future plan survives every
flow. Expired unpaid workspaces become read-only. Every active legacy row has a
documented reason or is corrected by an approved backfill with before/after
counts.

## Non-goals and pitfalls

Do not deduplicate the pricing catalog or implement multi-workspace support in
this task. Avoid treating missing Stripe IDs alone as proof that a tenant is
unpaid; older manual contracts may require explicit confirmation.

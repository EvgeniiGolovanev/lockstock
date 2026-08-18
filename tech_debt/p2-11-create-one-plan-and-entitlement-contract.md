# P2: Create one plan and entitlement contract

**Status: completed — 2026-08-17.** Completed in `5931f09` with one reviewed
plan contract shared by billing, entitlements, and product copy.

Make pricing copy, Stripe selection, TypeScript entitlements, database limits,
trial semantics, and UI gating derive from one reviewed product contract.

## Evidence and risk

After the correctness work in `p1-04`, plan prices and features remain repeated
in `app/pricing/page.tsx`,
`lib/billing/catalog.ts`, `lib/billing/entitlements.ts`, payment card copy, and
SQL `CASE` expressions. Only CSV row limits use `requireWithinPlanLimit` in API
code. The application also exposes a `workspaces` limit while the current
creation RPC returns the user's first owned organization.

## Minimal implementation

First write an explicit contract test and a short product decision record. Do
not build multi-workspace support in this task.

1. Create one TypeScript catalog for prices, public features, and UI copy.
2. Generate or validate SQL limit fixtures from the same reviewed values.
3. Add parity tests for every plan, billing status, grace boundary, and limit.
4. Mark unsupported advertised capabilities, especially workspaces, pending the
   Stage 2 decision.

## Acceptance criteria

A plan or price change has one authoritative edit path plus automated parity
checks. No UI claims a capability the backend cannot provide.

## Non-goals and pitfalls

Do not generate SQL migrations automatically at runtime, implement Enterprise
sales workflows, or solve multi-workspace ownership here. Backfills must be
previewable and must not disable a genuinely paid tenant.

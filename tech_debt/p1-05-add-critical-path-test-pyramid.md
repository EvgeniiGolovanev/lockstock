# P1: Add a critical-path test pyramid

Create the smallest test harness that can protect billing, tenancy, and the
workbench during refactoring. Measure coverage, but optimize for meaningful
behavior rather than a large test count.

## Evidence and risk

Vitest runs only in a Node environment. There is no React component test
library, browser E2E suite, coverage provider, or local-Supabase integration
suite. Sixteen route modules have no direct route test, including most billing
actions, CSV import, health reports, suppliers, and teams. Two UI regressions
are tested by reading component source text, so they can pass without proving
runtime behavior.

The existing 219 tests are valuable for pure functions and mocked route logic,
but mocks cannot prove RLS, migrations, DOM interaction, browser session
behavior, or Stripe/Supabase failure boundaries.

## Minimal implementation

Add three focused layers without replacing working tests:

1. Add Vitest coverage and publish a baseline. Require at least 80% lines and
   branches for new or materially changed modules; do not impose an arbitrary
   global threshold on untouched legacy code yet.
2. Add React Testing Library with a DOM environment for account, payment, and
   each extracted workbench slice. Replace source-text tests with behavior.
3. Expand the P0 disposable-Supabase seam with transaction and entitlement
   cases as the relevant tasks are implemented.
4. Add a minimal Playwright suite for sign-up/trial, login/workspace selection,
   one inventory mutation, one purchase-order lifecycle, read-only rejection,
   and owner billing actions.
5. Build a route-method-role matrix. Cover success, unauthenticated,
   unauthorized role, read-only, invalid input, and dependency failure where
   applicable.

## Independently closable child tasks

Execute this epic as separate changes: component behavior harness, route-method-
role contract matrix, and critical browser E2E. The P0 database seam is already
owned by `p0-00`; do not wait for the full pyramid before fixing P0 defects.

## TDD rollout

Introduce the harness with one critical test per layer, prove each test fails
for the intended reason, then expand only along active refactor paths. Use
factories for tenant, role, and billing state. Keep external Stripe and email
calls mocked; keep the database real for RLS and RPC tests.

## Acceptance criteria

The task is complete when CI runs all three layers, failed migrations or RLS
changes break CI, runtime UI tests replace source-string assertions, critical
E2E flows are deterministic, and a coverage report is retained as an artifact.
The fast unit suite must remain suitable for local iteration.

## Non-goals and pitfalls

Do not snapshot the 5,000-line workbench or pursue global 100% coverage. Avoid
tests that assert CSS classes, hook internals, or implementation call order.
Never run integration tests against the linked production database.

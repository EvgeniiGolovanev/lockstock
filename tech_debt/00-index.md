# LockStock technical debt backlog

This backlog converts the August 13, 2026 repository review into small,
ordered tasks. Stage 1 protects correctness and creates safe seams for
incremental refactoring. Stage 2 contains architectural changes that need a
product or operating-cost decision before implementation.

## Review baseline

The review used the current working tree, including the uncommitted billing
and payment work. Existing product files were not changed. The baseline was:

- `npm run test:api`: 52 files and 219 tests passed.
- `npm run lint`: passed.
- `npm run typecheck`: failed at
  `components/lockstock-landing.tsx:281` because a `string` is passed to a
  typed Next.js route.
- `npm audit --omit=dev`: four high-severity production dependency findings.
- `components/lockstock-workbench.tsx`: 5,062 lines, 108 `useState` calls,
  27 `useEffect` calls, and four disabled exhaustive-dependency checks.
- `app/globals.css`: 4,580 lines.
- The Vitest environment is `node`; there is no component renderer, browser
  E2E suite, coverage provider, or database integration suite.

## Execution order

Complete the tasks in this order unless an active incident changes the order.
Each task contains its own tests, non-goals, and rollback notes.

1. **P0** —
   [Restore verification and database test seams](p0-00-restore-green-verification-baseline.md).
2. **P0** —
   [Enforce database authorization and entitlements](p0-01-enforce-database-authorization-and-entitlements.md).
3. **P0** —
   [Patch production dependency vulnerabilities](p0-02-patch-production-dependency-vulnerabilities.md).
4. **P0** —
   [Make Stripe state monotonic and retry-safe](p0-03-make-stripe-state-monotonic-and-retry-safe.md).
5. **P1** —
   [Preserve trial plan intent and audit legacy access](p1-04-preserve-trial-plan-intent-and-audit-legacy-access.md).
6. **P1** —
   [Add a critical-path test pyramid](p1-05-add-critical-path-test-pyramid.md).
7. **P1** —
   [Add an accessibility interaction baseline](p1-05a-add-accessibility-interaction-baseline.md).
8. **P1** —
   [Decompose the workbench by vertical slice](p1-06-decompose-workbench-by-vertical-slice.md).
9. **P1** —
   [Make multi-write domain commands atomic](p1-07-make-domain-commands-atomic.md).
10. **P1** —
   [Generate Supabase types and detect drift](p1-08-generate-supabase-types-and-detect-drift.md).
11. **P1** —
    [Harden the API client and auth boundary](p1-09-harden-api-client-and-auth-boundary.md).
12. **P1** —
    [Bound list and aggregation queries](p1-10-bound-list-and-aggregation-queries.md).
13. **P2** —
    [Create one plan and entitlement contract](p2-11-create-one-plan-and-entitlement-contract.md).
14. **P2** —
    [Make CSV import standards-safe and atomic](p2-12-make-csv-import-safe-and-atomic.md).
15. **P2** —
    [Remove repository rudiments and documentation drift](p2-13-remove-rudiments-and-documentation-drift.md).

## Stage 2 discussion and readiness queue

Do not start these tasks automatically. Some require a product decision; others
require evidence or completion of the Stage 1 extraction work.

1. [Decide the multi-workspace product
   model](stage2-15-decide-multi-workspace-model.md).
2. [Replace DOM-mutation
   translation](stage2-16-replace-dom-mutation-translation.md).
3. [Modularize global CSS without
   redesigning](stage2-17-modularize-global-css.md).
4. [Add distributed abuse
   controls](stage2-18-add-distributed-abuse-controls.md).

## Definition of done for the backlog

Closing a Markdown file is not enough. A task is complete only when its
acceptance criteria pass, the new test fails before the implementation fix,
and the full verification baseline remains green. Avoid percentage-driven
test padding: require at least 80% branch and line coverage for newly extracted
or materially changed modules, then raise global thresholds only after a
measured baseline exists.

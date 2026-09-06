# LockStock technical debt backlog

This index tracks the tasks from the August 13, 2026 repository review.
The status summary below reflects the linked task records as of September 6,
2026; it does not replace verification of a release commit or production.

## Current status and next step

All 15 Stage 1 tasks are recorded as completed. Three Stage 2 tasks are also
recorded as completed. Distributed abuse controls are implemented in the
public-launch candidate, with production acceptance handled by the
[public launch runbook](../docs/public-launch-runbook.md).

For release work, start with that runbook and record evidence for the exact
release commit. This index does not establish whether its production checks
have passed. Reopen a completed task only when new evidence identifies a
regression or an unmet acceptance criterion.

## Historical review baseline — August 13, 2026

The original review used the working tree at that time, including uncommitted
billing and payment work. The following results are historical, not current
test results or open findings:

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

## Stage 1 — completed task records

All tasks below are marked completed in their linked records. The list retains
the original execution order; each record contains acceptance criteria and
implementation evidence.

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

## Stage 2 — task status

The linked records supersede the original deferred queue. Their recorded
statuses are:

1. **Completed August 17, 2026:** [Decide the multi-workspace product
   model](stage2-15-decide-multi-workspace-model.md).
2. **Completed August 18, 2026:** [Replace DOM-mutation
   translation](stage2-16-replace-dom-mutation-translation.md).
3. **Completed August 18, 2026:** [Modularize global CSS without
   redesigning](stage2-17-modularize-global-css.md).
4. **Implemented in the candidate August 20, 2026; release gate applies:**
   [Add distributed abuse controls](stage2-18-add-distributed-abuse-controls.md).

## Definition of done for the backlog

Closing a Markdown file is not enough. A task is complete only when its
acceptance criteria pass, the new test fails before the implementation fix,
and the full verification baseline remains green. Avoid percentage-driven
test padding: require at least 80% branch and line coverage for newly extracted
or materially changed modules, then raise global thresholds only after a
measured baseline exists.

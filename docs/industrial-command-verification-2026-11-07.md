# Industrial Command verification

The approved Industrial Command design is applied to LockStock's existing
website, account, and operational screens. The change preserves the existing
business behavior and uses the current application as the authority for fields,
copy, roles, prices, units, state boundaries, and calculations.

## Scope

The implementation replaces the prior ivory/forest visual treatment with
graphite navigation and headers, a steel canvas, white working panels, orange
actions, compact data grids, and structured forms.

Shared styling covers the 28 current routes, including the three expanded
French industry routes. Account profile, email, password, subscription, and
activity sections retain their fields and persistent state. The existing
inventory command block moves before the metrics without changing any
condition, route, handler, or disabled state.

No API, database, billing, authorization, calculation, dependency, or provider
code changes are included. The only production TSX change is that presentation
reorder. The generated hero texture is a local 25,762-byte WebP.

## Fresh checks

All checks below completed successfully on the November 7 candidate.

| Check | Result |
| --- | --- |
| Baseline sidebar/account unit checks | 35 tests passed in 2 files. |
| `npm run verify` after the visual changes | Types, lint, 640 tests in 121 files, and production build passed. |
| `npm run verify` after contrast fixes | Passed again: types, lint, 640 tests, and production build. |
| Windows Chromium full E2E | 25 passed after inspecting/refreshing visual baselines; final replay without snapshot updates also passed, 25 tests. |
| Linux Chromium full E2E | 25 passed after inspecting/refreshing visual baselines; final replay without snapshot updates also passed, 25 tests. |
| Responsive route sweep | 26 direct routes at 1440px and 375px; callback/onboarding covered by separate browser scenarios. |
| Campaign contrast regression | New secondary-link assertion failed before the CSS fix and passed afterward. |
| Disposable SQL suite | 231 checks in 13 files passed. |
| Data API and race checks | JWT matrix, workspace race, and seven finite-limit races passed. |
| Disposable real application/database acceptance | 44 browser scenarios passed in 7.9 minutes. |
| `npm run repo:hygiene` | Passed. |
| `git diff --check` | Passed. |

The real-database scenarios include CSV imports and atomic rejection of invalid
batches, catalog changes, stock adjustments/consumption/transfers, partial/full
purchase receipts, roles and tenant isolation, membership, replenishment,
duplicate-order prevention, and recovery without repeating committed writes.
Loading, read errors, and GET-only retry are exercised on desktop and mobile.

The first disposable application build preceded the final French-secondary-link
and footer color correction. No business or operational component behavior
changed afterward. The final unit/build and Windows/Linux suites include those
corrections and the new contrast assertion.

## Visual review

The source reference, normalized comparison images, focused comparisons,
intentional source-preserving differences, and final assessment are documented
in [the design QA report](../../design-qa.md).

One independent read-only review found a P2 cascade issue on a secondary
campaign link. It was reproduced and corrected. The reviewer found no additional
substantiated P1/P2 issue in the inspected diff and screenshots, and confirmed
that the inventory reorder retains its permission conditions and handlers.

The in-app browser also verified live home-to-pricing-to-home navigation and
opening the sign-in dialog. The modal retains the disabled submit state when
required fields are empty. No account or stock data was written during that
manual visual check.

## Environment and limits

Evidence logs and screenshots are in the ignored working-copy directory
`.superpowers/industrial-command/`. Windows/Linux snapshots are refreshed only
for the approved appearance change and replayed without updates.

The disposable project stopped successfully and its temporary directory was
removed. Only the original development Supabase containers remained afterward.
The original `localhost:3000` process and development database were preserved.

Three pre-existing lint warnings remain in unchanged behavior: internal
navigation through `window.location.assign`, an effect-cleanup ref, and an unused
workflow parameter. Workflow screenshots also retain their existing Next.js
image-loading advisory.

This is local verification. It does not claim hosted production acceptance,
CI execution, live payment charges, or external email delivery. The disposable
environment has no `RESEND_API_KEY`; invitation persistence and acceptance are
verified separately from delivery through that provider. No production data,
provider secrets, or external configuration was changed.

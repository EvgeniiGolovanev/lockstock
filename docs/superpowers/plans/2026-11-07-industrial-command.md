# Industrial Command implementation plan

> **For agentic workers:** Use `superpowers:executing-plans` to execute
> these tasks inline and request one fresh review at the end.

**Goal:** Apply the approved Industrial Command visual system across LockStock
without changing its operational behavior.

**Architecture:** Restyle the existing CSS and presentation markup. Keep the
current components, handlers, routes, data contracts, billing, and permissions.
Use shared tokens for graphite navigation, steel surfaces, orange actions,
compact tables, and bounded forms. Use one raster background for marketing.

**Tech stack:** Next.js 16.4.3, React 19, CSS Modules, Vitest, Playwright.

**Spec:** Approved reference and full gallery at
`C:/Users/golov/.codex/visualizations/2026/11/07/lockstock-industrial-command/`.
The selected source is `exec-6786d549-b753-4c05-8d47-82831ad96a83.png`.

## Global constraints

The user approved implementation on November 7, 2026 and requires all existing
functionality and business logic to remain intact.

- Preserve APIs, SQL, calculations, roles, billing, and provider integrations.
- Preserve EN/FR copy, actual routes, prices, limits, and legal draft status.
- Preserve table columns, filters, sorts, CSV, validation, recovery, and units.
- Keep left navigation, collapse preference, package-plus icon, and all links.
- Retain existing mobile navigation behavior rather than inventing a drawer.
- Source code wins over inaccurate mock captions, demo values, and validation.
- No dependency changes, deployment, or production-data mutations.

## Review focus

Verification must account for the conditions below.

- French navigation and constrained desktop heights must keep actions reachable.
- Mobile tables scroll internally without hiding forms or persistent controls.
- Primary, secondary, destructive, and selected controls remain legible.
- Account anchors and form fields remain usable after navigation and scrolling.
- Loading and read failures must remain distinct from successfully loaded zeros.

## Task 1: Shared ERP workspace

Files: `app/globals.css`, `components/app-sidebar.module.css`, and operational
CSS Modules under `components/workbench`, `components/replenishment`, account,
payment, workflow, and platform surfaces.

- [x] Run baseline sidebar/account tests and inspect existing source markup.
- [x] Replace ivory/forest styling with graphite, steel, white, and orange.
- [x] Add bounded panels, compact data grids, and clear toolbar hierarchy.
- [x] Preserve every handler, field, permission, and data-state boundary.
- [x] Verify desktop/mobile navigation, tables, dialogs, and account anchors.

## Task 2: Website and authentication

Files: `components/marketing-shell.module.css`, marketing page CSS Modules,
`components/france-campaign.module.css`, recovery/auth styles, and landing
presentation markup; one generated asset under `public/design`.

- [x] Install the approved raster hero texture without adding a dependency.
- [x] Apply dark marketing headers, split hero, product preview, and panels.
- [x] Restyle pricing, contact, French pages, legal, and auth with source copy.
- [x] Verify EN/FR pages, real links, forms, and responsive layout.

## Task 3: Regression and visual verification

Files: existing Playwright snapshots, `design-qa.md`, and verification report.

- [x] Run `npm run verify` for types, lint, unit tests, and production build.
- [x] Run all Windows and Linux browser tests; inspect refreshed snapshots.
- [x] Run disposable-database acceptance if available, preserving the dev DB.
- [x] Compare reference and rendered screenshots at normalized dimensions.
- [x] Record intentional source-preserving deviations and test limits.
- [x] Request one fresh review and resolve actionable findings.

## Task 4: Local integration

Local integration is authorized by the user's instruction to apply the design.

- [x] Verify the original checkout has no tracked edits and unchanged base.
- [x] Commit only this visual change and fast-forward the original dev branch.
- [x] Confirm the actual running site reflects the design and leave it open.
- [x] Report local completion separately from publication.

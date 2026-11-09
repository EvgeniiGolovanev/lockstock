# Quiet Ledger implementation plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan.
> Steps use checkbox syntax for tracking.

**Goal:** Apply the approved option 2 to every existing LockStock screen while
preserving all business behavior.

**Architecture:** Keep existing components, handlers, data loading, permissions,
routes, and calculations. Replace the legacy visual skin in shared/global and
scoped CSS. Recompose the shared navigation horizontally while retaining the
existing collapse preference, language controls, sign-out, and every destination.
Account section links provide direct access without unmounting forms.

**Tech stack:** Next.js 16.4.3, React 19, CSS Modules, Vitest, Playwright.

**Spec:** Approved Quiet Ledger boards in
C:/Users/golov/.codex/visualizations/2026/10/24/01a16ed0-8623-7d00-94c9-12955c5baf2b/lockstock-option-2-2026-10-31/manifest.json

## Global constraints

- Preserve business logic, API calls, permissions, routes, calculations, and forms.
- Preserve EN/FR text, actual plan pricing, legal draft status, and error recovery.
- Use warm ivory #f7f5ef, forest #344d43, ink #272d28, thin rules, small radii.
- Use serif display typography only on public marketing headings.
- Keep all table columns, units, sorting, filters, exports, and row actions.
- Keep desktop and mobile keyboard access, visible focus, and reduced motion.
- Work only in this isolated worktree; preserve the original dev instance.

## Review focus

- Long French navigation and translated labels must remain reachable.
- Wide operational tables scroll inside their container, not across the page.
- Disabled, destructive, error, and success states retain distinct semantics.
- Account security fields retain state and original submission handlers.
- Route-to-route CSS loading must not restore the previous visual theme.

## Tasks

- [x] 1. Establish baseline: install locked dependencies, run existing Vitest suite,
  inspect installed Next CSS guide and current components. Record failures.
- [x] 2. Replace shared app and marketing styles; update all scoped page styles.
  Files: app/globals.css, components/*.module.css, app/*/page.module.css,
  components/workbench/*.module.css. Keep markup and behavior intact where possible.
  Verify with typecheck, lint, existing UI/API tests.
- [x] 3. Recompose presentation: horizontal app navigation, faithful landing preview,
  account section anchors. Files: components/app-sidebar.module.css,
  components/lockstock-landing.tsx, components/lockstock-account.tsx,
  components/lockstock-account.module.css, lib/i18n.ts.
  Add one meaningful account navigation regression test before markup changes.
- [x] 4. Validate all routes at desktop/mobile and normal form/navigation flows.
  Run full Vitest, typecheck, lint, production build, Playwright critical paths,
  catalog controls, auth/recovery, and isolated database acceptance where available.
  Inspect real rendered pages. Refresh visual baselines only after visual review.
- [x] 5. Request one fresh code review, resolve material findings, record checks,
  and provide the reviewable branch and local preview. Do not claim production
  deployment unless merge/deployment and hosted acceptance are actually verified.

## Decisions

Account navigation uses section anchors instead of unmounting tab panels, retaining
existing visibility and field state; section groups still follow the four approved
account areas. All business controls take precedence over mock-image simplifications.


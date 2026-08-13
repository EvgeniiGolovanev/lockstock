# P1: Decompose the workbench by vertical slice

Turn `LockstockWorkbench` into a thin authenticated shell plus independently
testable feature slices. Preserve user behavior and styling throughout the
refactor.

## Evidence and risk

`components/lockstock-workbench.tsx` is 5,062 lines and coordinates demo data,
Supabase sessions, token persistence, organization bootstrap, 108 `useState`
calls, 27 `useEffect` calls, networking, filtering, forms, modals, and all
feature screens. Four
effects disable `react-hooks/exhaustive-deps`. A change to one workflow can
trigger stale closures or refreshes in another. The component has no runtime
component test.

## Safe target shape

Keep one shell responsible for route selection, session state, active
organization, and shared navigation. Extract feature slices behind explicit
props or narrow hooks. Start with one slice; do not introduce a global state
framework unless extraction demonstrates a real cross-slice need.

Recommended order is materials, locations, suppliers, stock movements,
purchase orders, members, then dashboard. Move demo fixtures into a separate
module early, but keep the same `?demo=1` behavior.

Treat the shell/fixture extraction and each listed feature slice as an
independently closable child ticket. Limit a pull request to one cohesive slice
or one shared seam; do not close this epic after only moving files.

## TDD procedure per slice

Repeat this loop for each slice:

1. Add characterization tests for visible states, validation, permissions,
   mutation success, mutation failure, and refresh behavior.
2. Extract pure view models and form validation before JSX.
3. Extract the feature component without changing API calls or markup.
4. Move network orchestration into a narrow feature hook or service only after
   behavior is green.
5. Delete the old branch from the god component in the same commit.
6. Re-enable exhaustive dependency checks and fix stale closures with stable
   callbacks or reducer events.

## Acceptance criteria

The task is complete when the shell contains no domain form fields or domain
mutation handlers, no effect dependency suppression remains, extracted slices
meet the touched-code coverage threshold, and critical E2E flows remain green.
Use file size only as a warning signal, not as a target; cohesion is the goal.

## Non-goals and pitfalls

Do not rewrite all slices in one pull request, redesign the UI, add Redux, or
replace the API. Preserve focus, modal keyboard behavior, translations, demo
mode, pagination, and activity messages. Abort in-flight requests or ignore
stale responses when a tenant or filter changes during loading.

## Dependencies

Complete the test-harness task first. Coordinate API-client extraction with
`p1-09` so two tasks do not create competing fetch wrappers.

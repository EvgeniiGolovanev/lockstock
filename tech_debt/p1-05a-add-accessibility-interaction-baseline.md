# P1: Add an accessibility interaction baseline

**Status: completed — 2026-08-17.** Completed in `a1749a2` with keyboard,
dialog, focus, live-region, and interaction regression coverage.

Make dialogs, forms, navigation, status messages, and busy states usable by
keyboard and assistive-technology users before component extraction multiplies
the current patterns.

## Evidence and risk

The components render fifteen elements with `role="dialog"`, but the
code has no visible focus trap, Escape handling, initial focus, or focus return.
There is no accessibility test dependency or browser accessibility gate. ARIA
labels exist in several places, so this task must preserve useful semantics
rather than replace them with snapshots.

## Minimal implementation

Create one accessible shared dialog primitive and migrate dialogs slice by
slice with the workbench refactor. Add automated checks for obvious violations
and manual keyboard criteria for behavior automation cannot prove.

1. Add component tests for initial focus, Tab containment, Escape, close button,
   focus restoration, accessible name, and busy/disabled behavior.
2. Associate every form control with a visible label or accessible name and
   connect validation text through `aria-describedby`.
3. Announce mutation success and failure through an appropriate live region
   without reading the entire activity history.
4. Add a small browser accessibility scan for landing, account, inventory, and
   payment pages at desktop and mobile widths.
5. Document a manual keyboard and zoom checklist for changed interaction
   components.

## Acceptance criteria

All migrated dialogs satisfy keyboard behavior, critical pages have no serious
automated accessibility violations, validation is programmatically associated,
and 200% zoom does not block primary actions. Tests use roles and accessible
names rather than CSS selectors.

## Non-goals and pitfalls

Do not claim complete WCAG conformance from an automated scanner. Do not make a
visual redesign, add ARIA where native HTML is sufficient, or ship a focus trap
that prevents browser or assistive-technology escape.

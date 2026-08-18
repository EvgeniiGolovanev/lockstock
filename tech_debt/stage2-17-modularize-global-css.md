# Stage 2: Modularize global CSS without redesigning

**Status: completed on August 18, 2026.**

The migration reduced `app/globals.css` from 4,580 to 1,153 lines. Feature
styles now live beside their owners in CSS Modules; the remaining global rules
are reset, tokens, authenticated-app shell, and shared UI primitives. Removed
legacy selectors were verified with repository searches. Visual baselines cover
the landing, Members table, and About, Contact, and Pricing at desktop and
mobile widths.

Reduce the blast radius of `app/globals.css` while preserving the current
visual system and avoiding a framework migration.

## Readiness gate

Start after at least two workbench slices are extracted, or when selector
collisions and regression cost are measurable. The global sheet is 4,580 lines
and contains styles for marketing, account, payment, platform, and every
workbench feature.

## Minimal migration

Document shared tokens and primitives, then move styles alongside one extracted
slice at a time using CSS Modules or another existing Next.js-native boundary.
Keep reset, tokens, typography, and truly shared utilities global. Add visual
screenshots at stable desktop and mobile widths before moving selectors.

## Exit criteria

Feature selectors are locally owned, unused selectors are removed with
evidence, global CSS contains only shared foundations, and visual plus
accessibility checks show no unintended change.

## Non-goals

Do not introduce Tailwind, CSS-in-JS, or a new design system solely to reduce
line count. Do not combine the migration with a redesign.

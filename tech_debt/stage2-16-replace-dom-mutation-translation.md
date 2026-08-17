# Stage 2: Replace DOM-mutation translation

## Completion

Completed on August 18, 2026. The application uses render-time typed messages,
including workbench exports. The DOM mutation compatibility layer and raw-string
aliases have been removed. The verified gates are `npm run test:api` (90 files,
331 tests), `npm run typecheck`, and `git diff --check`.

Move localization from post-render DOM rewriting to explicit render-time
messages without pausing feature delivery for a full rewrite.

## Decision gate

Start when French remains a supported product locale and either translation
defects or workbench rendering cost becomes material. The current provider
walks the entire body and observes every text mutation, while `lib/i18n.ts`
maps hundreds of raw English strings and regex prefixes.

## Minimal migration

Choose a small typed message API and migrate one extracted workbench slice at
a time. Keep the old translator as a compatibility layer only for unmigrated
screens, with an explicit boundary attribute. Add missing-key tests, variable
interpolation tests, and browser checks for locale persistence and document
language.

## Exit criteria

No MutationObserver rewrites React-owned text or attributes, all active strings
use stable message keys, dynamic messages use typed parameters, and English and
French E2E flows pass. Remove raw-string aliases only after usage is zero.

## Non-goals

Do not add locale routing, a translation SaaS, or more languages unless product
requirements demand them.

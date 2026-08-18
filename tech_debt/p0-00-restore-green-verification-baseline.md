# P0: Restore verification and database test seams

**Status: completed — 2026-08-13.** `npm run verify` and the disposable
`npm run test:db` gate pass from the committed baseline. Independent review:
9/10, approved after one fix/re-review pass.

Make the repository's verification contract true and add the disposable
database seam required to change authorization migrations safely. Complete
this task before every other backlog item.

## Evidence and risk

The API/unit suite and lint pass, but `npm run typecheck` fails because
`buildPostSignUpPath` returns `string` and `router.push` expects a typed route.
The CI workflow runs typecheck before tests, so the branch cannot pass as-is.
Pull-request CI also has no local database reset, migration, RLS, or RPC test;
the migration workflow acts only after changes reach `main`.

## Minimal implementation

Fix the route type at its source without casting an arbitrary string. Add a
single local `verify` script and the smallest local-Supabase integration job
needed by P0 database work.

1. Write a failing unit test for every post-sign-up mode and plan path.
2. Return a `Route`-compatible finite union or validate dynamic output before
   navigation.
3. Add `npm run verify` for typecheck, lint, tests, and build. Keep commands
   individually callable.
4. Add a disposable database job that starts local Supabase, applies every
   migration from zero, seeds isolated fixtures, and runs SQL assertions.
5. Prove the job can detect one denied and one allowed RLS/RPC operation.
6. Update CI only if local and CI commands differ after the scripts are added.

## Acceptance criteria

The task is complete when `npm run verify` succeeds from a clean install, CI
uses the same effective commands, no unsafe route cast was added, and the
disposable database job fails on a deliberately invalid migration or
authorization policy. Behavior coverage matters; the exact test count does not.

## Non-goals and pitfalls

Do not combine this task with product migration fixes or dependency upgrades. A
production build may require environment placeholders; document safe test
values rather than weakening environment validation. Never connect the test
job to a linked or production database. Preserve the user's uncommitted work.

# P0: Enforce database authorization and entitlements

**Status: completed — 2026-08-17.** Completed in `2a79586` with disposable
database authorization, entitlement, Data API, concurrency, and rollback proof.

Database writes must require both an authorized tenant role and writable plan
state, even when a caller bypasses the Next.js API. Plan limits must also remain
correct under concurrent writes.

## Evidence and risk

`lib/api/route-context.ts` blocks non-read HTTP methods, but authenticated users
hold a Supabase JWT. The role-aware RLS policies permit managers and owners to
update or delete domain rows directly. The plan migration adds only `BEFORE
INSERT` triggers for seven tables. It does not guard `UPDATE`, `DELETE`,
`po_lines`, `team_members`, `supplier_materials`, or mutation RPCs. Count-then-
insert checks can also admit two concurrent writes past the same limit.

More critically, `create_stock_movement`, `create_stock_transfer`, and
`receive_purchase_order` are `SECURITY DEFINER` functions that accept caller-
supplied organization and actor IDs. No later migration revokes default
`PUBLIC` execute for these functions, and the functions do not assert
`auth.uid()` membership or manager role. A direct RPC caller may therefore
bypass both RLS and route role checks. Treat both defects as authorization and
billing-integrity bugs, not optional hardening.

## Minimal implementation

Keep RLS role checks and add one database-level billing predicate that can be
reused by policies and mutation functions. Apply it to every domain mutation
surface, including RPCs. Keep reads unchanged.

1. Use the disposable database seam from `p0-00`. Create active, valid-trial,
   expired-
   trial, past-due-in-grace, past-due-after-grace, and missing-billing tenants.
2. For viewer, member, manager, owner, anonymous, and authenticated non-member
   callers, prove direct table writes and every `SECURITY DEFINER` RPC enforce
   the intended role even when the workspace is active.
3. Revoke function execution from `PUBLIC` and `anon`, then grant only the
   required principals. Inside each definer function, derive the actor from
   `auth.uid()` and reject caller-supplied actor spoofing.
4. Prove that direct `INSERT`, `UPDATE`, `DELETE`, and relevant RPC calls fail
   for read-only tenants and succeed for writable authorized tenants.
5. Introduce a stable function such as `workspace_has_write_access(org_id)`.
   It must use the same status and seven-day grace rules as
   `resolveEntitlements`.
6. Add the predicate to mutation RLS policies or narrowly scoped guard
   triggers. Cover child tables by resolving their organization reliably.
7. Serialize limit enforcement per organization, or replace count-then-write
   with another transaction-safe mechanism. Do not add a usage-cache service.
8. Add a parity test that compares representative TypeScript and SQL decisions.

## TDD sequence

Start with failing database tests, implement the smallest SQL guard, and then
remove duplicate trigger branches only while tests stay green. Test direct
Data API access because route-handler mocks cannot prove this invariant.

## Acceptance criteria

The task is complete when all mutation surfaces are covered and:

- Active non-members and insufficient roles cannot mutate any tenant through
  direct tables or RPCs, and actor IDs cannot be spoofed.
- Expired, inactive, and missing-billing tenants can select data but cannot
  mutate it with an authenticated JWT.
- Active, valid-trial, and valid-grace tenants retain the expected writes.
- Concurrent writes cannot exceed each finite plan limit.
- Service-role Stripe synchronization remains able to update billing rows.
- API responses preserve the current user-facing read-only message.
- `npm run test:api`, database integration tests, typecheck, lint, and build
  pass.

## Non-goals and pitfalls

Do not redesign billing, add a metering service, or move all writes into a new
backend. Avoid recursive RLS predicates on `org_users`. Check RPCs declared as
`SECURITY DEFINER` separately because caller RLS assumptions may not apply.
Ship the migration additively and test rollback on a disposable local database.
Audit every `SECURITY DEFINER` function, not only the three currently known.

## Likely files

The work belongs in a new migration, the database test harness, and possibly
`lib/billing/entitlements.ts` if shared fixtures reveal rule drift. Do not edit
historical migrations already applied to linked environments.

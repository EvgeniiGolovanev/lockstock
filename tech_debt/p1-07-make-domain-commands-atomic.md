# P1: Make multi-write domain commands atomic

**Status: completed — 2026-08-17.** Completed in `f01ceb4` with transactional
domain commands and rollback regression coverage.

Ensure that a domain command either completes fully or leaves no partial row.
Focus on commands that currently perform dependent writes across multiple
client calls.

## Evidence and risk

`POST /api/purchase-orders` inserts the order and then its lines. If the line
insert fails, an empty purchase order remains. `POST /api/teams` inserts a team
and then the creator membership, leaving an incomplete team on the second
failure. Member removal deletes team memberships before organization
membership, so a later failure partially removes access. Similar sequences
must be inventoried, but single-row handlers do not need conversion.

## Minimal implementation

Move only dependent multi-write commands into transaction-scoped Postgres
functions. Keep validation and HTTP response mapping in the route. Reuse the
existing RPC pattern used for stock movements and purchase-order receipt.

1. Write database tests that force each second or final write to fail and
   assert that earlier writes roll back.
2. Add typed RPCs for purchase-order creation, team creation, and atomic member
   removal if the inventory confirms the risk.
3. Validate organization ownership and role inside the transaction, even when
   the route already checks it.
4. Return the complete result needed by the current API response.
5. Remove obsolete route-level write sequences after the RPC tests pass.

## Acceptance criteria

No targeted command can leave orphan headers, missing default membership, or
partially removed access. Duplicate retries produce either the same logical
result or a clear conflict. Audit triggers still record the intended command,
and route response contracts remain stable.

## Non-goals and pitfalls

Do not turn every CRUD call into an RPC. Keep authorization explicit in
`SECURITY DEFINER` functions, lock the `search_path`, and grant execute only to
the required role. Avoid manual compensating deletes when a database
transaction can provide the invariant.

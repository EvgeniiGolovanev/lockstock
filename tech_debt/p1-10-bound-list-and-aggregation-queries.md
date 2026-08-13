# P1: Bound list and aggregation queries

Prevent tenant growth from turning list pages and the platform cockpit into
large in-memory scans while preserving existing response contracts.

## Evidence and risk

The platform overview limits organizations to 25 but loads every organization
user, material, location, stock movement, purchase order, and billing row, then
aggregates them in Node.js. Low-stock and stock-health routes load every active
material and every balance. Supplier and team lists are unpaginated. The
Starter plan bounds some tables, but higher plans are much larger or unlimited.

## Minimal implementation

Push counts and grouped aggregates to SQL and add consistent bounded pagination
to user-facing lists. Prefer views or narrowly scoped SQL functions over a new
analytics service.

1. Add query-contract tests for page bounds, invalid inputs, totals, empty
   pages, and tenant isolation.
2. Replace platform full-table selects with count/group queries scoped to the
   displayed tenants plus separate global counts where required.
3. Compute stock health and low-stock results in SQL with indexed joins.
4. Add pagination metadata to suppliers and teams; adapt the relevant UI slice.
5. Add or verify indexes with `EXPLAIN ANALYZE` on representative volumes.

Close this epic through three independent child tickets: platform cockpit
aggregates, inventory health/low-stock queries, and supplier/team pagination.
Each ticket must include its own query plan and UI contract tests.

## Acceptance criteria

No route materializes an unbounded organization-wide domain table in the Node
process, response time scales with page size rather than total history, and
totals remain correct. Tests include at least one dataset above current plan
page sizes.

## Non-goals and pitfalls

Do not add Redis, background cubes, or a data warehouse. Avoid offset-free
cursor work unless measured deep-page performance requires it. Preserve exact
tenant filtering in every aggregate.

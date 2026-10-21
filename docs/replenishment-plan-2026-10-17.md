# Stock replenishment: product design and implementation plan

**Status:** Draft for review. Planning only; no implementation is authorized by
this document. Baseline inspected on October 17, 2026.

**Goal:** Let a manager turn an observed material shortage into reviewed draft
purchase orders without re-entering materials or duplicating planned purchases.

**Architecture:** Calculate recommendations on the server from organization-wide
balances and complete purchase-order data. Use existing purchase-order commands
inside one atomic batch, with server revalidation and persistent idempotency.
Keep the replenishment UI in a focused module beside the existing workbench.

**Tech stack:** Next.js 16.4.0 App Router, React 19, TypeScript, Zod, Supabase
Postgres, Vitest, Playwright, and the existing disposable database test harness.

**Spec:** The product-design sections in this document define the proposed v1.
All new names and paths below are proposals, not existing interfaces.

## Product design

The intended user is a manager responsible for materials and purchasing.
Success means the manager can explain a recommended quantity, check existing
orders, and create an ordinary draft PO that works with the current lifecycle.
The operational quantity is in the material's existing unit of measure.

### Existing capabilities and gaps

The following baseline comes from local code and migrations. It does not prove
that each capability is currently exercised successfully on production.

| Area | Confirmed existing basis | Required addition |
| --- | --- | --- |
| Materials | SKU, name, UoM, category, `min_stock`, active flag | Optional target quantity and replenishment settings UI |
| Balances | Quantities by material and location | Server aggregate across all locations in the selected organization |
| Low stock | `get_low_stock_materials` and `/api/alerts/low-stock` | Incoming quantities, draft quantities, explanations, and actions |
| Suppliers | Active flag and `lead_time_days` | Select preferred supplier for a material; handle absent or conflicting preferences |
| Supplier mapping | `supplier_materials` already has `supplier_sku`, `last_price`, `currency`, and `preferred` | Authenticated UI/API to maintain these links; no new equivalent table |
| PO creation | Manager-or-owner check, active material/supplier checks, atomic `create_purchase_order_with_lines` | Atomic grouped draft creation, revalidation, persistent request identity |
| PO lifecycle | `draft`, `sent`, `partial`, `received`, `cancelled`; dates and received quantities | Interpret remaining quantities and date uncertainty for planning |
| Receiving | Receipt specifies a location and updates stock | Reuse unchanged lifecycle; no receipt during replenishment |
| Access/billing | Workspace membership, write-access checks, DB insert limits | Apply the same checks to settings and each resulting PO |
| Tests | API/UI tests and isolated persisted inventory acceptance | Calculation, concurrency, idempotency, and end-to-end replenishment coverage |

Baseline files:

- `lib/validators/material.ts` and `lib/validators/purchase-order.ts`.
- `app/api/materials/route.ts` and `app/api/purchase-orders/route.ts`.
- `app/api/alerts/low-stock/route.ts`.
- `supabase/migrations/202602231350_init.sql`.
- `supabase/migrations/202608131200_enforce_database_authorization_entitlements.sql`.
- `supabase/migrations/20260816203550_make_purchase_order_with_lines_optional_args.sql`.
- `supabase/migrations/20260816211834_p1_10_bounded_inventory_queries.sql`.

Important details: the old low-stock RPC casts quantities to `bigint`, while
underlying quantities support three decimals. The new calculation must retain
`numeric(14,3)` precision. The existing PO number uses seconds and can collide
when multiple drafts are generated together. The new batch needs collision-safe
numbers. The PO list and material list are paginated; a loaded browser page is
not a valid source for organization-wide recommendations.

### Scope choice and alternatives

There are three reasonable approaches. The middle approach is recommended.

| Approach | Benefit | Limitation |
| --- | --- | --- |
| Prefill the existing PO form from low stock | Smallest change | Does not fully address incoming stock, repeated recommendations, or grouped creation |
| Organization-wide replenishment with reviewed drafts | Completes one useful workflow using the current model | Does not detect a shortage at one site when another site holds enough stock |
| Location-level replenishment and transfer proposals | Better fit for multi-site operations | Requires location policies and an explicit destination/allocation for incoming PO quantities |

V1 uses organization-wide stock. Show this scope prominently; do not offer a
location filter that silently changes the meaning of an organization-wide
minimum. Existing PO lines have no destination, and the receiving location is
chosen later. V1 must not invent an allocation of an open order to a warehouse.

V1 includes target configuration, supplier mapping, shortage planning, grouped
review, draft creation, retry safety, and current EN/FR localization.
It excludes automatic sending, scheduled buying, forecasts, reservations,
MOQ/pack-size conversion, location policies, supplier emails, and AI.
Supplier lead time is informational; it must not invent a promised delivery
date. Each new draft's expected date is optional and explicitly reviewed.

### Settings and roles

The following rules make setup explicit and preserve existing material data.

- Keep `materials.min_stock` as the existing trigger. Add nullable
  `materials.target_stock numeric(14,3)`. No invented default multiplier.
- Effective target is `target_stock ?? min_stock`. A configured target must be
  at least the minimum. A higher target makes batching purchases practical.
- Extend the existing material editor/validators to display the target when
  changing the minimum. Reject a minimum above a configured target with an
  actionable field error; allow saving both together through the settings
  command. Do not silently lower the minimum or raise the target.
- If both values are zero and stock is zero, show “Set replenishment levels”;
  do not recommend buying an arbitrary quantity.
- When stock equals the minimum and the target also equals the minimum,
  recommendation is zero. Explain that a higher target is needed to propose
  a positive order at this boundary.
- Use the existing supplier mapping. Exactly one active preferred mapping can
  preselect a supplier. No mapping or multiple preferred mappings require a
  manager's choice. Never choose the cheapest supplier without a pricing model.
- Saving a preferred mapping clears other preferences for that material in one
  authorized transaction, serialized on the material. Historical conflicts
  remain visible until a manager resolves them; migrations must not guess.
- Reads follow existing organization membership. Settings and creation require
  manager or owner and an active writable workspace, enforced in API and DB.
- Offer replenishment on existing plans within their current PO limits.
  A batch that needs three POs consumes three PO slots, including drafts.

### Calculation and status rules

The manager selects a planning date `required_by`. Default to today plus 14
calendar days. This is a visible planning horizon, not a forecast of stock
coverage. Capture the browser's date/timezone explicitly for the request; verify
the IANA timezone and derive today on the server. Never use the server host's
implicit timezone. Dates are ISO calendar dates, and DST must not shift them.
Require `today <= required_by <= today + 365 calendar days`; refresh the date
context on a local date rollover before submission.

For each active material in the organization calculate:

```text
on_hand = sum(inventory_balances.quantity)
remaining_PO_line = max(quantity_ordered - quantity_received, 0)
confirmed_incoming = remaining quantity in sent/partial POs
                     with today <= expected_at <= required_by
draft_planned = remaining quantity in existing draft POs
target = target_stock if configured, otherwise min_stock
need_before_drafts = max(0, target - on_hand - confirmed_incoming)
suggested_order = max(0, need_before_drafts - draft_planned)
shortage_trigger = on_hand <= min_stock
```

Drafts reduce a duplicate purchasing proposal, but never count as confirmed
incoming supply or increase physical/available stock. Show their quantity in a
separate column and link to the existing drafts. Count all existing drafts for
duplicate planning, regardless of their dates; warn if their date is absent or
outside the horizon. The manager resolves or cancels the existing draft before
using this workflow to buy that portion again. Manual PO creation remains an
explicit user action outside this recommendation constraint.

Unreceived `sent`/`partial` quantities with missing or overdue dates, or dates
after the horizon, are shown separately. They are not automatically subtracted
as timely supply. These rows require an explicit acknowledgment in review
before an additional draft can be created; show the order numbers and risk of
double buying. If a date changes, the acknowledgment must be reconfirmed.

The following table defines the screen states.

| Condition | State and action |
| --- | --- |
| Stock exceeds minimum | Normally hidden; no automatic top-up merely because stock is below target |
| Stock below/equal minimum and confirmed incoming covers target | Covered by scheduled orders; inspect linked POs |
| Need remains but drafts cover it | Draft already in progress; open existing draft |
| Positive suggestion, valid supplier, no unresolved warning | Ready for review |
| Positive suggestion, no valid selected supplier/currency | Setup required; creation blocked |
| Positive suggestion and uncertain/late incoming | Review incoming orders; acknowledgment required |
| Target/minimum produce zero quantity | Nothing to order or settings required; no zero-quantity PO line |

Use exact decimal arithmetic and reject more than three quantity decimals;
do not round fractional quantities to integers. No currency conversion.
Group drafts by `(supplier_id, currency)`. `last_price` can prefill a price only
when its currency matches the group. Missing price remains null and is labelled
“Price not set”; it is not represented as a zero-cost purchase.

Examples, each independently triggered with minimum 10 and target 50:

| Stock | Timely incoming | Drafts | Suggestion | Explanation |
| --- | --- | --- | --- | --- |
| 8 | 0 | 0 | 42 | Top up to target |
| 8 | 30 | 0 | 12 | Existing supply covers 30 |
| 8 | 0 | 42 | 0 | Purchase already planned, not confirmed |
| 8 | 30 | 5 | 7 | Account for both types without calling a draft incoming |
| 8 | 60 | 0 | 0 | Existing incoming covers target |
| 10 | 0 | 0 | 40 | Equality triggers review; target exceeds minimum |

Additional numeric fixture: minimum 2.000, target 5.500, stock 1.250, timely
incoming 0.500, drafts 0.250 gives 3.500 in the existing UoM.

### User journey

The UI is a task-oriented table with one primary creation action.

1. Open **Replenishment / Réapprovisionnement** from inventory or navigation.
   Show the workspace, organization-wide scope, planning date, and refresh time.
2. Fetch a server-calculated list. Default to actionable shortages; provide
   filters for covered, draft-in-progress, and setup-required rows.
3. Inspect material, UoM, physical quantity, minimum, target, timely incoming,
   existing drafts, suggestion, supplier, and warnings. Expand a row to see
   arithmetic and the contributing orders.
4. Configure target or supplier where needed. Refresh the server calculation
   after saving. Exclude inactive materials/suppliers from valid selections.
5. Select rows. In review, group by supplier and currency. The manager may
   reduce a positive quantity; increasing it above the latest suggestion uses
   the normal manual PO workflow instead of hiding extra buying in this flow.
6. Review quantities, optional prices, optional expected dates, partial-value
   totals, and incoming-order acknowledgments. Different dates for the same
   supplier/currency require separate submissions in v1.
7. Click **Create draft orders / Créer les brouillons**. Revalidate the complete
   selected set on the server. Any changed relevant input returns a conflict
   and creates no orders; present refreshed recommendations for review.
8. On success, show every created PO number with links to the current orders
   screen/details. Clear selection and refresh replenishment. The new drafts
   appear under planned quantity, and repeated recommendations are reduced.
9. Continue through the existing send/partial-receipt/full-receipt lifecycle.
   Only receiving changes stock. Cancelling a draft releases planned coverage.

Loading, failure, no configured levels, no shortage, shortage already covered,
and read-only access are distinct states. A failed refresh must not look like
an empty warehouse. On workspace change, abort pending reads and clear prior
rows, selection, review, and request state. Ignore stale responses. Preserve
safe edits on refresh conflicts and identify the rows that changed.

### Persistence, revalidation, and retries

The server owns the authoritative calculation and the write transaction.

- Read recommendations through a dedicated aggregate RPC. Aggregate complete
  balances and PO data before filtering/pagination. Default page size 50,
  maximum 100; deterministic SKU/ID order and accurate state counts.
- Return a per-row `snapshot_token` derived from canonical relevant inputs:
  quantities, policy, contributing PO IDs/statuses/dates/remaining quantities,
  supplier mapping/price/currency, date, and timezone. It is a stale-state
  detector, never an authorization credential.
- Limit creation to 100 unique material rows and 20 supplier/currency groups
  per submission. Reject duplicate material rows and invalid quantities.
- Generate a client UUID `request_id` before submit and retain it across
  retries/reloads until the result is resolved. Scope saved recovery state by
  user and workspace. Never persist tokens or secrets with it.
- Persist successful request payload hash and resulting PO IDs in
  `replenishment_requests`, unique by `(org_id, request_id)`. Reuse of the same
  ID/payload returns the original result; a different payload returns 409.
- In one DB transaction: authorize, acquire the existing organization advisory
  lock namespace, replay prior success if present, recalculate selected inputs,
  validate snapshots, validate all groups, create drafts using the existing
  command, persist request result, and commit. Any failure rolls back the batch.
- Acquire the same organization lock at the start of ordinary PO creation and
  PO status/receipt commands before their own row locks. This coordinates
  supported commands with replenishment and existing plan-insert limits.
  Inventory can change after any snapshot; do not promise a stock reservation.
- Preserve DB membership/write checks for direct RPC calls. Review direct table
  mutation permissions during implementation: an uncoordinated PO-line write
  must not silently invalidate the concurrency claim. Either route that write
  through the shared locking boundary or narrow the guarantee explicitly before
  acceptance. This is a mandatory implementation gate, not optional hardening.
- A lost POST response offers **Check result**, using
  `GET /api/replenishment/requests/{request_id}`. If absent, retry the identical
  POST with the same ID. A committed mutation followed by failed refresh only
  retries the refresh. Never create a new request ID to resolve uncertainty.
- Use collision-safe PO numbers, such as `PO-` plus a generated UUID. Keep the
  existing uniqueness constraint as the final guard.
- Record actor, source `replenishment`, request ID, selected quantities,
  acknowledgments, and resulting PO IDs server-side. Existing audit mechanisms
  must receive the ordinary PO creation events. Local storage activity alone
  is not sufficient evidence.

## Proposed interfaces and files

The following interfaces keep the new calculation and state out of the large
workbench component. Paths not present today are explicitly new.

| File | Responsibility |
| --- | --- |
| New migration created with Supabase CLI | Target column; supplier preference command; numeric recommendation RPC; request table and RLS; batch command and shared locking integration |
| `types/database.ts` (update) | Regenerated database types |
| `lib/replenishment/contracts.ts` (new) | Decimal-string row, warning, request, and result contracts |
| `lib/validators/replenishment.ts` (new) | Date/timezone, settings, selection, and batch validation |
| `lib/replenishment/service.ts` (new) | User-scoped RPC calls and mapping of domain conflicts |
| `app/api/replenishment/route.ts` (new) | GET paginated recommendations |
| `app/api/replenishment/settings/route.ts` (new) | PATCH target and preferred supplier mapping atomically |
| `app/api/replenishment/drafts/route.ts` (new) | POST reviewed batch; 201 new / 200 replay / 409 stale or conflicting key |
| `app/api/replenishment/requests/[requestId]/route.ts` (new) | GET current-workspace result; 404 when not committed |
| `app/replenishment/page.tsx` (new) | Route using the current authenticated workbench shell |
| `components/replenishment/replenishment-screen.tsx` (new) | Table, settings, filters, and expansion |
| `components/replenishment/review-dialog.tsx` (new) | Grouped editable review and confirmation |
| `lib/replenishment/use-replenishment.ts` (new) | Fetch, workspace changes, review, and retry state |
| `components/replenishment/replenishment.module.css` (new) | Existing design-system styling and responsive layout |
| `components/lockstock-workbench.tsx`, `components/nav-item-icon.tsx` (update) | Navigation and focused module integration |
| `lib/i18n.ts` (update) | EN/FR user-facing strings |
| `lib/validators/material.ts`, `components/workbench/catalog-forms.tsx` (update) | Minimum/target consistency in the existing material editing flow |

`ReplenishmentRow` contains material ID/SKU/name/UoM, minimum/target, on-hand,
timely incoming, draft-planned, suggested quantity, selected/preferred supplier,
currency, nullable unit price, linked contributing orders, warnings, status,
and snapshot token. Decimal values cross API boundaries as strings.

`CreateReplenishmentDraftsInput` contains `request_id`, `required_by`, `timezone`,
and `rows[]`: material ID, snapshot token, supplier ID, currency, quantity,
optional unit price, optional expected date, and explicit warning acknowledgments.
The canonical payload hash ignores JSON property order and normalizes decimal
strings. Expected dates must agree inside each supplier/currency group.

`CreateReplenishmentDraftsResult` contains request ID and `orders[]` with ID,
number, supplier ID, currency, and draft status. Result recovery rechecks access
and returns no data from a different workspace.

## Global constraints

All implementation tasks inherit these requirements.

- Preserve existing manual PO and receiving behavior except shared locking.
- Keep organization isolation, role checks, and current billing limits in DB.
- Use existing UoM, three quantity decimals, and EUR/USD without conversion.
- Keep EN/FR parity and desktop/mobile operation.
- Do not derive demand from a paginated browser list or count drafts as stock.
- Before writing Next.js code, read the relevant bundled guides under
  `node_modules/next/dist/docs/`; `route.md` was inspected during planning.
- Before implementing DB changes, consult current Supabase function/RLS guidance
  and the applicable skill. Create migrations through the CLI; do not alter a
  linked production database during development. Inspect the current grants
  before choosing invoker/definer execution, with explicit auth for the latter.

## Review focus

The following failure modes are mandatory acceptance cases, assigned below.

1. Fractional quantities silently truncated by legacy aggregate casts: Task 1.
2. Lost response after commit creates duplicate POs: Tasks 2 and 4.
3. Two managers and a manual PO change the same planning inputs: Task 2.
4. A filtered/paginated UI omits supply or leaks a prior workspace: Tasks 1 and 3.
5. Mixed currencies, unknown prices, or an uncertain date appear trustworthy:
   Tasks 1 and 3.

## Implementation tasks

Each task begins with a failing test, adds the smallest implementation, verifies
the result, and ends with a separately reviewable commit. This is an execution
plan for after approval, not a record of completed work.

### Task 1: Settings and authoritative recommendations

This task delivers a read-only planning calculation with editable policy.

**Files:** Migration, contracts, validators, service, GET/settings routes,
generated database types; new `supabase/tests/replenishment.test.sql`,
`tests/api/replenishment.route.test.ts`, and
`tests/validators/replenishment.test.ts`.

**Interfaces:** Produce `listReplenishment(context, query)` and
`updateReplenishmentSettings(context, input)` in the service module, plus the
row/input types described above. DB numeric arithmetic is authoritative.

- [ ] Write calculation tests for every numeric example above; assert the
  fractional fixture is exactly `3.500`, not `3` or `4`.
- [ ] Test sent/partial remaining quantities, cancellation/full receipt,
  multiple drafts, zero stock without balance rows, inactive materials,
  threshold equality, missing target, and dates at both horizon boundaries.
- [ ] Test organization isolation, reader versus manager writes, invalid
  suppliers/currencies, conflicting preferred mappings, and consistent
  defaults for legacy material rows.
- [ ] Test a contributing PO outside the first 100 list rows and page/state
  counts; test snapshot changes on quantity, date, policy, or supplier changes.
- [ ] Test two locations and multiple PO lines do not multiply quantities through
  SQL joins; aggregate each source before joining per-material totals. Test
  changing minimum above target yields an actionable validation error.
- [ ] Run targeted Vitest tests and `npm run test:db`; confirm expected failures.
- [ ] Implement the numeric SQL calculation, RLS/commands, settings validation,
  paging, snapshot generation, and user-scoped API; regenerate DB types.
- [ ] Rerun the targeted tests, DB tests, and `npm run db:types:check`; require
  success before committing this task.

### Task 2: Atomic draft batch and result recovery

This task delivers reliable writes using ordinary PO records.

**Files:** Migration/DB commands, service, drafts/result routes, relevant
existing PO commands; new `tests/api/replenishment-drafts.route.test.ts`,
`tests/inventory/replenishment-integrity.spec.ts`, and SQL tests.

**Interfaces:** Produce `createReplenishmentDrafts(context, input)` and
`getReplenishmentRequest(context, requestId)`; return the result contract above.

- [ ] Test stock 8 / target 50 creates one draft of 42, leaves balances unchanged,
  and reduces the next suggestion to zero through draft-planned quantity.
- [ ] Test supplier/currency grouping, unique PO numbers, optional prices,
  group-date consistency, max 100 materials/20 groups, and duplicate rows.
- [ ] Test same ID/same payload returns the same PO IDs; same ID/different
  payload conflicts; lookup is isolated by workspace and current membership.
- [ ] Test a failure in group two and a quota overflow roll back all groups
  and the success receipt; no partially-created draft survives.
- [ ] With independent real DB connections, test two new request IDs using the
  same snapshots: only one batch commits; the other must refresh. Test a
  concurrent manual PO, cancellation, and receipt through shared commands.
- [ ] Enumerate direct PO/header/line write paths and test their locking or
  permissions. Resolve uncovered bypasses before claiming concurrency safety.
- [ ] Run targeted Vitest and DB/inventory integrity tests; confirm expected
  failures, then implement transaction/replay/revalidation and error mapping.
- [ ] Rerun tests, existing PO role/currency/receiving tests, and verify a created
  draft can be sent, partly received, fully received, and cancelled where valid.
- [ ] Commit the verified task with no linked production mutations.

### Task 3: Replenishment table, setup, and grouped review

This task delivers the user-facing path using the APIs from Tasks 1 and 2.

**Files:** New route/components/hook/CSS, workbench navigation, localization;
new `tests/ui/replenishment.test.tsx`.

**Interfaces:** Consume `ReplenishmentRow` and the API contracts. Expose
`ReplenishmentScreen` inside the existing workspace shell; review uses the same
hook and request identity rather than a separate purchase-order write path.

- [ ] Test loading/error/empty/setup/covered/draft-in-progress states, selecting
  rows, explanation expansion, supplier setup, and quantity reduction.
- [ ] Test a missing price has an explicit label and partial total; currencies
  never share a combined total; uncertain incoming requires acknowledgment.
- [ ] Test refreshing a stale row preserves safe user input and requires fresh
  review; a failed refresh never clears a known successful creation result.
- [ ] Test workspace switch aborts/ignores stale results, clears selection and
  warnings, and prevents submitting the old workspace's review.
- [ ] Test viewer/member cannot submit and read-only workspace is explained;
  ensure EN/FR parity, accessible labels, focus return, and keyboard operation.
- [ ] Run `npx vitest run tests/ui/replenishment.test.tsx` to confirm expected
  failures; implement focused modules, then rerun to pass and commit.

### Task 4: Persisted acceptance and release evidence

This task proves the workflow against real persistence and failure recovery.

**Files:** New `tests/inventory/replenishment-acceptance.spec.ts`, integrity
tests from Task 2, and an update to `docs/testing/inventory-acceptance.md`.

**Interfaces:** Reuse the existing inventory fixture and ordinary PO lifecycle.
Add replenishment cases to the disposable harness; do not substitute demo data.

- [ ] Write browser cases at 1440px and 390px for setup → shortage → explanation
  → supplier-grouped review → draft → existing PO details/lifecycle.
- [ ] Write a fault case that commits creation but loses the HTTP response;
  recover through request lookup and assert exactly one PO batch in the DB.
- [ ] Test incoming 30 changes a 42-unit recommendation to 12; verify a partial
  receipt increases physical stock and decreases remaining incoming once.
- [ ] Test cancellation makes planned quantity eligible again; uncertain/late
  supply requires fresh review; a changed balance returns a review conflict.
- [ ] Run `npm run test:inventory` and `npm run verify`; run database type and
  repository hygiene checks. Fix regressions, then commit the acceptance work.
- [ ] Create a PR with scope, migration notes, test evidence, and v1's
  organization-wide limitation. Verify CI before treating it as ready to merge.
- [ ] After an authorized deployment, verify the same hosted scenario at
  `https://lockstockapp.com` on desktop and mobile using disposable data. Record
  actual PR/commit/CI/deployment evidence and cleanup. Local checks alone do not
  establish a production release.

## Acceptance and follow-up

V1 is complete when a manager can calculate an explainable shortage, inspect
timely incoming and existing drafts separately, create the correct ordinary
drafts, and recover an uncertain response without duplicates. Stock must remain
unchanged until receiving. Concurrent requests, role/workspace isolation,
three-decimal quantities, EN/FR, and desktop/mobile cases must pass.

For a pilot, measure time from shortage to draft, how often recommendations are
edited, how often setup blocks progress, and duplicate-order incidents. Establish
a baseline before setting a numerical improvement target. These metrics need
not introduce a new telemetry system in v1.

Location-level v2 adds per-location policies, PO destination allocation, and
transfer-before-buy recommendations. A separate purchasing depth increment can
add MOQ, packs, supplier-specific lead times, and reservations. Neither is
silently included in this plan.

Next action: review the organization-wide scope, target fallback, draft coverage,
and uncertain-incoming acknowledgment rules before starting implementation.

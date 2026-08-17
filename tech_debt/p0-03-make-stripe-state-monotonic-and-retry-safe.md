# P0: Make Stripe state monotonic and retry-safe

**Status: completed — 2026-08-17.** Completed in `4246e4a` with monotonic event
ordering, idempotency, retry handling, and regression coverage.

Stripe event handling must converge on the newest subscription state under
duplicates, retries, concurrent delivery, and out-of-order events. A successful
HTTP response must mean the event was processed, not merely observed.

## Evidence and risk

`app/api/billing/webhook/route.ts` inserts an event row before processing and
returns success for a duplicate. Two concurrent deliveries can therefore let
the duplicate return success while the first later fails and deletes the row.
Stripe may then stop retrying the failed work.

`syncStripeSubscription` has a timestamp guard, but related handlers do not
consistently use it. An old `invoice.payment_failed` can set `past_due` after a
newer paid event, and an old deletion or schedule event can overwrite newer
state. Several Supabase updates ignore returned errors. The current tests cover
only a small happy-path subset.

## Minimal implementation

Use the existing `stripe_webhook_events` table as a small processing ledger.
Do not introduce a queue unless measured webhook duration requires one.

1. Add states such as `processing`, `processed`, and `failed`, plus attempt and
   error metadata. Claim an event atomically.
2. Return duplicate success only for `processed`. Retry or safely reclaim
   `failed` and stale `processing` rows.
3. Centralize the event-created comparison and apply it to subscription,
   invoice-failure, deletion, checkout binding, and schedule handlers.
4. Check every Supabase read and write result. A persistence failure must make
   the webhook return a retryable non-2xx response.
5. Keep external Stripe calls idempotent. Record state only after the required
   local mutation succeeds.
6. Verify that `current_period_end` precision and type match the database
   contract; do not silently truncate timestamps unless the column is a date.
7. Emit structured diagnostics with request ID, Stripe event ID, event type,
   attempt, outcome, and safe error code. Never log signatures or payload
   secrets.

## TDD matrix

Write failing tests for duplicate concurrency, first-attempt failure followed
by retry, older failure after newer payment, older deletion after recreation,
unknown price IDs, missing billing rows, and database-write failure. Include a
route-level signature test and service-level state-transition tests.

## Acceptance criteria

The task is complete when:

- Replaying any processed event is a no-op with HTTP 2xx.
- A failed first attempt remains retryable and cannot be hidden by a duplicate.
- No event older than `last_stripe_event_created_at` can regress local state.
- Unknown subscriptions and prices create actionable structured diagnostics.
- All database errors are observed and tested.
- Checkout, upgrade, downgrade, cancellation, failed payment, recovery, and
  schedule release have regression coverage.

## Non-goals and pitfalls

Do not build event sourcing or a generic job platform. Stripe event IDs are
unique, but event `created` timestamps can tie; define a deterministic rule for
ties. Never acknowledge unprocessed work merely to suppress retries. Avoid
deleting failure evidence after an exception.

## Likely files

Expected changes include a new migration,
`app/api/billing/webhook/route.ts`, `lib/billing/webhook-sync.ts`, and billing
tests. Keep public API response shapes stable.

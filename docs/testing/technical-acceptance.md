# Technical acceptance

You can verify these technical flows with disposable accounts and data before
legal publication or live payment activation. These checks complement the
[public launch runbook](../public-launch-runbook.md); they don't approve launch.

## Automated local acceptance

Run `npm run test:inventory` with Docker, Supabase CLI, and Chromium available.
The runner builds an isolated production application and destroys the temporary
stack after the checks, including on failure.

| Area | Evidence checked |
| --- | --- |
| Inventory | Persisted stock, partial/full receipts, invalid operations, rollback, competing writes, and safe 4xx errors |
| Stock recovery | Actual adjustment/consumption/transfer writes, persisted balances and ledger, failed follow-up reads, guard after dismiss/reopen, and GET-only retry at desktop/mobile widths |
| List responses | Real delayed GET responses after newer search/filter/page results, switching between two workspaces and back, unchanged stored rows, and no domain writes at desktop/mobile widths |
| List loading and retry | Initial/read failures, delayed responses, connection aborts, distinct empty results, stale-row warnings, preserved search/page/status, GET-only retries, and workspace isolation at desktop/mobile widths |
| Account journal and CSV | Actual audit rows and CSV contents, delayed/failed GETs, preserved export dates, workspace switching, suppressed stale downloads, real export denial after role revocation, and recovery at desktop/mobile widths |
| Purchase order feedback | Visible creation/receipt/status failures, preserved drafts, and read-only refresh retries after committed writes, including dismissing the form |
| Membership | Invite, accept, replay, wrong recipient, expiry, supersede, reject, change role, remove, self-leave, owner protection, and tenant isolation |
| Browser membership | Send and accept an invitation through the UI, refresh actions, reload persisted membership, and leave through confirmation |
| Member feedback | Visible rejected rename/invite/accept/reject/remove/leave operations, delivery status, unchanged stored rows, and GET-only recovery after committed writes at desktop/mobile widths |
| Catalog and CSV | Persisted edits, blocked destinations, quoted fields, duplicate SKUs, updates, and no writes from an invalid batch |
| Catalog feedback | Visible material/location/supplier failures after role revocation, preserved drafts, persisted retries, and refresh-only recovery after committed writes at desktop/mobile widths |
| Auth email | Actual local confirmation/recovery emails, confirmation-required login, reset redirect, URL credential removal, changed password, and consumed-link rejection |
| Monitoring | An unhandled Next.js route error reaches a real local HTTP receiver without query parameters, cookies, or raw error text |
| Rate limiting | Concurrent clients share one durable contact budget; anon/authenticated callers cannot execute the service RPC; actual contact responses include 429 and Retry-After; loss of RPC access fails closed with 503 |
| Recovery | A logical public/Auth dump restores into a separate disposable database, preserves row fingerprints, and retains tenant isolation and restricted RPC privileges |

The application receives no external email or Stripe credentials during this
suite. Invitation email delivery is explicitly `skipped`. Contact attempts
return a configuration error until their durable rate limit is exhausted.
Local Auth emails stay in Mailpit. The alert receiver binds only to loopback.

The restore drill measures local dump/restore duration. Its recovery point is
the dump snapshot. It doesn't validate the hosted backup service, PITR,
production recovery time, or customer acceptance. The monitoring check verifies
unhandled errors through Next.js instrumentation; it doesn't establish that a
production on-call recipient receives alerts for every handled API error.

## Opt-in external invitation delivery

Use only an inbox whose owner explicitly authorized the test. This separate
check creates a unique owner and workspace in local Supabase, invokes the real
invitation route with Resend credentials, and deletes those fixtures afterward.
The email links to a temporary local workspace. It isn't a production invite.

Run the check from a configured checkout:

```powershell
$env:LOCKSTOCK_EXTERNAL_EMAIL_RECIPIENT = "your-authorized-test-inbox@example.com"
node --use-system-ca --env-file=.env.local node_modules/vitest/vitest.mjs run --config vitest.external.config.ts
Remove-Item Env:\LOCKSTOCK_EXTERNAL_EMAIL_RECIPIENT
```

The test requires a loopback Supabase URL, its public and service keys,
`RESEND_API_KEY`, and `EMAIL_FROM`. It checks provider acceptance. Verify inbox
receipt separately. The default CI suite doesn't discover or execute this test.
Don't print keys or recovery-link tokens in test records.

## Remaining external gates

Complete these checks in the appropriate test or production environment:

See the [remaining technical work register](technical-next-steps.md) for the
next implementation priority and the access needed for each external check.

- Stripe sandbox checkout, renewal, plan changes, cancellation, webhook replay,
  and entitlement synchronization need actual sandbox credentials and event IDs.
- Google OAuth provider interaction needs a browser account; the automated
  Google regression suite uses intercepted Auth responses.
- Hosted Auth confirmation and complete password reset need disposable hosted
  accounts. Requesting a recovery email doesn't verify a completed reset.
- Production monitoring needs a configured receiver, uptime monitor, alert
  routing, and a received alert.
- Hosted backup recovery needs a non-production restore from the actual backup
  method and a dated recovery record.

Keep these separate from legal identity, approved Terms/Privacy, tax
registrations, refund policy, and live paid-launch approval.

# Remaining technical work

This register covers work you can perform without choosing a legal entity or
approving public paid onboarding. Update the evidence for each tested release;
the presence of a runbook does not establish that a provider is configured.

## Purchase order feedback release

PR #81 makes creation, receipt, send, and cancellation failures
visible. Failed mutations preserve the draft or confirmation dialog. After a
successful mutation, a failed follow-up read produces a completion warning and
a read-only **Refresh data** action. Closing a committed form retains a page
guard, so another mutation cannot repeat the operation against stale data.

Verify the candidate with component tests and the real-database browser suite:

```powershell
npm.cmd run verify
node scripts/verify-database.mjs --inventory --grep "purchase order feedback preserves"
```

The browser checks use actual API mutations and stored rows at desktop and
mobile widths. They interrupt only follow-up purchase-order reads to reproduce
a committed write followed by a failed refresh. They check rejected operations
for partial writes and ensure that retrying a refresh does not replay a write.

PR #81 merged on October 16, 2026 as `7ee92ef`. Both PR and main CI passed.
The production deployment and real-browser checks on `lockstockapp.com`
passed at 1440px and 390px. Temporary test accounts and workspaces were removed.

## Catalog feedback release

Material, location, and supplier forms now display accessible errors when
creation, editing, or a usage change fails. Rejected writes preserve the draft
or confirmation dialog. Successful writes wait for a refresh before closing.
If that read fails, the dialog reports completion, disables further writes,
and offers **Refresh data**. Dismissing and reopening a dialog keeps that guard
until a read succeeds.

Run the targeted real-database browser checks with Docker available:

```powershell
node scripts/verify-database.mjs --inventory --grep "catalog feedback preserves"
```

These scenarios revoke the user's workspace role after the dialog opens,
verify real 403 responses and unchanged stored rows, restore the role, and
retry successfully. Only follow-up GET requests are interrupted to reproduce
refresh failures. The checks cover creation, editing, blocking, and unblocking
at desktop and mobile widths. This release doesn't change database schema,
dependencies, or production configuration.

Local verification on October 16, 2026 passes: 506 component/API tests,
194 database assertions, and both real-browser scenarios. Types, lint,
production build, repository hygiene, and the production dependency audit pass.
The changed components have over 99% line and 88% branch coverage. The runner
destroys the temporary database after the checks. These results describe the
candidate. PR #82 merged as `04972b5`; PR/main CI and the production browser
checks on `lockstockapp.com` passed on October 16, 2026.

## Member feedback release

The Members page now shows failures for renaming a group, invitations,
acceptance, rejection, member removal, leaving, and list refreshes. Rejected
writes preserve input and available actions. Invitation creation reports
email delivery separately as sent, skipped, or failed.

After a committed write, a failed read blocks further changes and offers
**Refresh data**. Recovery uses GET requests only, without resending an
invitation or repeating acceptance, removal, or leaving. Group switching is
blocked during recovery. Account changes invalidate delayed recovery reads
before they update local state and release the pending busy state.

Run the targeted real-database browser checks:

```powershell
node scripts/verify-database.mjs --inventory --grep "member feedback recovers"
```

The checks use two actual accounts at desktop and mobile widths. They revoke
owner rights, expire invitations, and enforce owner leave protection to
produce real rejected writes. Stored organization, membership, invitation,
team, and audit rows must remain unchanged after rejection. Only subsequent
GETs are interrupted to verify recovery without repeating writes. The isolated
application has no email provider credentials; delivery is visibly skipped.

Local verification on October 16, 2026 passes: 527 component/API tests,
194 database assertions, and both real-browser scenarios. Types, lint,
production build, hygiene, and the production dependency audit pass. The action
and section modules have over 99% line and 92% branch coverage. The temporary
database is destroyed afterward. PR #83 merged as `e4a37ba`; PR/main CI and
production browser checks passed on October 16, 2026.

## Stock movement recovery release

Adjustment, consumption, and transfer forms now distinguish a rejected write
from a successful write followed by a failed refresh. A committed operation
disables submission and offers **Refresh data**. The warning and write guard
survive closing and reopening the form. A successful refresh closes the form.

Recovery reads only material balances, movement history, and locations. Account
or workspace changes invalidate delayed responses. Each refresh batch also
invalidates its outstanding requests when it fails, so a late sibling response
cannot overwrite a later successful retry.

Run the targeted real-database browser checks:

```powershell
node scripts/verify-database.mjs --inventory --grep "stock recovery never repeats"
```

At desktop and mobile widths, the checks perform actual adjustments,
consumption, and transfers, interrupt only subsequent list reads, and verify
persisted balances and ledger rows. They exercise another failed refresh,
closing/reopening the form, and read-only recovery without a repeated POST.
A genuine insufficient-stock rejection must preserve the draft and leave
stored rows unchanged. No provider credentials or legal decisions are needed.

Local verification on October 16, 2026 passes: 533 component/API tests,
194 database assertions, both real-browser recovery scenarios, and 22 mocked
E2E regressions. Three existing real-browser regressions also pass: the full
stock/receipt cycle and rejected stock writes with correction at both widths.
Types, lint, production build, hygiene, and the production
dependency audit pass. Focused stock-section coverage is 100% lines, 92.25%
branches, and 81.48% functions. The browser checks verify that refresh retries
leave the persisted balances and ledger unchanged. PR #84 merged as `82e1cae`;
PR/main CI and production checks at both widths passed on October 16, 2026.
Temporary hosted users, sessions, workspaces, and their data were removed.

## List response protection candidate

Materials, stock movements, locations, suppliers, active supplier choices,
purchase orders, member loading, and invitations now reject superseded
responses before updating state. Each list tracks its latest request and
rendered query. Workspace/account changes invalidate older callbacks and
clear the prior workspace's displayed rows and totals.

Changing search, filters, or pages reloads the affected list without restarting
workspace bootstrap. Delayed failures from older reads cannot clear a newer
session or overwrite newer results. A filter change during a shared refresh
does not discard unrelated location or supplier-choice reads. A genuine failed
refresh still invalidates its remaining sibling reads before a retry.

Real acceptance also exposed an existing supplier-search failure: PostgREST
rejects numeric-column casts in filters. Text fields now use quoted search
values, and complete vendor IDs use numeric equality within the schema's
range. Displayed IDs with leading zeros are accepted. Longer numeric phone
searches stay text searches instead of overflowing the vendor ID column.

Run the real-database browser checks:

```powershell
node scripts/verify-database.mjs --inventory --grep "lists keep current results"
```

At desktop and mobile widths, the checks use actual API responses delayed
until newer searches, status filters, and pages have completed. They switch
between two real workspaces, return to the first, and deliver the older
workspace's reads last. Native history keeps the same Workbench instance
while inspecting its lists, so a route remount cannot hide stale state.
Stored rows must remain unchanged and browsing must issue no domain writes.
Both list scenarios passed on October 16, 2026. Local verification also passes:
552 component/API tests, 194 database assertions, and 22 mocked browser
regressions, plus types, lint, production build, repository hygiene, and the
production dependency audit. The new request and supplier-search modules have
100% statement, branch, function, and line coverage in the focused tests.
Nine existing real-browser regressions also pass: the full stock/receipt
cycle and catalog, membership, purchase-order, and stock recovery at both
widths. The isolated database stacks are destroyed after the runs.
This candidate has not been released to production.

## External technical acceptance

These checks remain distinct from implementation and legal approval. Local
verification does not establish that the hosted flow passes.

| Area | Remaining proof | Required access |
| --- | --- | --- |
| Stripe sandbox | Checkout, renewal failure, changes, cancellation, event replay, and entitlement synchronization | Actual sandbox keys, prices, portal configuration, and signed webhook events |
| Hosted Auth | Confirmation and a complete password reset with old-password rejection | An authorized disposable hosted account and inbox |
| Google OAuth | Real provider sign-in and return to the intended workspace | An authorized browser account |
| Production monitoring | A received scrubbed alert and working uptime escalation | An authenticated receiver and agreed alert destination |
| Hosted recovery | A non-production restore from the actual backup method, with RPO/RTO and isolation evidence | A hosted backup and an approved non-production restore target |

On October 16, 2026, the local `.env.local` has no Stripe secret/webhook key or
`OBSERVABILITY_ENDPOINT`. This describes local configuration only; it does not
establish whether production provider settings exist. The local Mailpit,
loopback monitoring, and logical restore checks are documented in
[technical acceptance](technical-acceptance.md).

## Next steps

Review and release the list response protection candidate after its checks pass.
Run external acceptance when the listed access is available, then add dated
evidence to the release record. Legal text, tax
registration, and live paid-launch approval remain separate decisions.

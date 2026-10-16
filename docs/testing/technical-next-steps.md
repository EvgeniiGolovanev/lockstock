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

## Member feedback candidate

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
database is destroyed afterward. These results describe the candidate.

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

Review and release the member feedback candidate after its checks pass.
Run external acceptance when the listed access is available, then add dated
evidence to the release record. Legal text, tax
registration, and live paid-launch approval remain separate decisions.

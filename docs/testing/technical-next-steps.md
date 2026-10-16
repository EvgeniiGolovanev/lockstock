# Remaining technical work

This register covers work you can perform without choosing a legal entity or
approving public paid onboarding. Update the evidence for each tested release;
the presence of a runbook does not establish that a provider is configured.

## Purchase order feedback candidate

The current candidate makes creation, receipt, send, and cancellation failures
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

Local verification on October 16, 2026 passes: 482 component/API tests, 194
database assertions, and both targeted real-browser scenarios. Types, lint,
production build, repository hygiene, and the production dependency audit also
pass. The temporary database is destroyed after the browser run. These results
describe the candidate, not a production deployment.

## Next implementation priority

Catalog forms still contain failure paths that only call `onActivity` in
`components/workbench/catalog-forms.tsx`. Extend visible feedback and real
failure/retry checks to location and material creation, editing, and usage
changes. Audit supplier actions for the same pattern. These tasks need no
additional provider account or legal decision.

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

Complete catalog feedback next. Run external acceptance when the listed access
is available, then add dated evidence to the release record. Legal text, tax
registration, and live paid-launch approval remain separate decisions.

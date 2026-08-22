# Public launch runbook

This runbook defines the evidence required before LockStock can accept public
self-service payments. Complete every item for the exact release commit and
store the evidence with the release record.

> **Warning:** This runbook is a release procedure, not evidence that the
> production services are configured. Keep public paid onboarding disabled
> until the release owner records a passing result for every required item.

## Legal and customer communication

You must publish approved final text at `/privacy` and `/terms` before launch.
Replace every unresolved item in `docs/privacy-policy.md` and
`docs/terms-of-service.md` with the actual legal entity, SIREN or SIRET,
registered address, contacts, effective date, data processors, retention
periods, cookie choices, taxes, refund policy, and support commitments.

The footer on the landing, pricing, about, and contact pages links to these
routes. The security reporting route is `/security`; it directs reporters to
the contact form without claiming a security certification or an unpublished
response commitment. Verify the links in both English and French before
release.

## Production configuration

Configure and verify the following production settings before accepting a
payment:

- Deploy the release commit to the production domain with HTTPS enabled.
- Set `APP_URL` to the canonical HTTPS origin. Never use a preview URL.
- Configure Supabase production URL, publishable key, service-role key, and
  the production `/payment` redirect allow-list entry.
- Verify the Resend API key, sender domain, and `EMAIL_FROM` identity with a
  real invitation email.
- Configure all six live `STRIPE_PRICE_*` values, `STRIPE_SECRET_KEY`,
  `STRIPE_WEBHOOK_SECRET`, and `STRIPE_PORTAL_CONFIGURATION_ID`.
- Configure Stripe Tax registrations and the Customer Portal according to
  `docs/billing-setup.md`.
- Create the signed production webhook at
  `https://YOUR_DOMAIN/api/billing/webhook` and subscribe it to every event
  listed in `docs/billing-setup.md`.
- Set `OBSERVABILITY_ENDPOINT` to an authenticated error-ingestion endpoint.
  The application reports a generated correlation ID, error type and digest,
  method, query-free path, and route metadata. It never reports request
  headers, cookies, raw error messages, request bodies, payment data, or
  email addresses.

> **Warning:** The service-role key and Stripe secrets must never use a
> `NEXT_PUBLIC_` variable or appear in browser code.

## Release verification

Run the following checks from the exact release commit before deployment. They
verify application behavior, generated database types, and database access
control against a disposable local Supabase project.

```powershell
npm.cmd run audit:prod
npm.cmd run verify
npm.cmd run test:db
npm.cmd run db:types:check
```

After production deployment, use a real Stripe test customer to verify these
customer-visible flows in sequence:

1. Sign up, confirm email, and create a workspace.
2. Start a trial, then verify its Starter entitlement and end date.
3. Complete monthly and annual checkout.
4. Upgrade, schedule a downgrade, cancel, and reactivate a subscription.
5. Trigger a failed renewal and verify the seven-day grace period followed by
   read-only access.
6. Replay a Stripe webhook and verify that billing state changes only once.
7. Send and accept an invitation, then confirm that another workspace remains
   inaccessible.
8. Submit the contact form and verify delivery plus a 429 response after the
   configured rate limit.

## Durable public rate limits

The database-backed limiter applies the following shared limits across all
application instances. It hashes the combined client IP and account subject
before storing it and fails closed with `503` if the durable store is not
available.

| Endpoint | Scope | Limit | Window | Exhaustion response |
| --- | --- | ---: | --- | --- |
| Contact form | `contact` | 5 requests | 15 minutes | `429` and `Retry-After` |
| Checkout session | `billing_checkout` | 10 requests | 15 minutes | `429` and `Retry-After` |
| Start trial | `billing_trial` | 3 requests | 24 hours | `429` and `Retry-After` |

The `consume_public_rate_limit` database function is a `SECURITY DEFINER`
function. Only `service_role` can execute it. Do not grant it to `anon`,
`authenticated`, or `PUBLIC`.

## Operations and recovery

Assign a named owner and an escalation backup for support, billing
reconciliation, backups, incidents, and releases. Record their contacts in
the approved legal and support material.

Before launch, configure uptime monitoring for `/api/health`, server-error
alerts through `OBSERVABILITY_ENDPOINT`, and alert routing to the on-call
owner. Perform and record one restore drill using the production backup method.
The drill must restore a non-production copy, confirm tenant isolation, and
document the recovery time and data-loss window.

### Alert and incident workflow

The release owner must configure the following response workflow before public
onboarding starts.

1. Route uptime failures and error-ingestion alerts to the named incident
   owner and escalation backup.
2. Acknowledge a customer-impacting alert within the agreed operational target
   and record the correlation ID, first-observed time, impact, and owner.
3. Pause public onboarding when checkout, entitlement updates, tenant
   isolation, or alert delivery is affected.
4. Use the hosting-platform rollback action for application regressions.
   Validate Stripe webhook delivery and the affected customer state before
   declaring recovery.
5. Restore only into a non-production project during a drill. Record the
   recovery point, elapsed time, isolation result, gaps, and remediation owner.

### Evidence register

Complete this table in the release record. Replace every `TBD` value before
enabling live Stripe keys or public onboarding.

| Gate | Required evidence | Owner | Backup | Status | Link or identifier |
| --- | --- | --- | --- | --- | --- |
| Legal approval | Counsel-approved, versioned Terms and Privacy Policy | TBD | TBD | Not started | TBD |
| Deployment | Release SHA, production URL, and HTTPS redirect check | TBD | TBD | Not started | TBD |
| Supabase | Migration state, Auth redirects, SMTP delivery result | TBD | TBD | Not started | TBD |
| Stripe | Live price IDs, portal ID, webhook event delivery | TBD | TBD | Not started | TBD |
| Monitoring | Uptime monitor and received error alert | TBD | TBD | Not started | TBD |
| Recovery | Dated non-production restore-drill record | TBD | TBD | Not started | TBD |
| Live acceptance | Customer-flow checklist and Stripe event IDs | TBD | TBD | Not started | TBD |
| Go/no-go | Signed release decision and release SHA | TBD | TBD | Not started | TBD |

Use the hosting platform rollback action to return application code to the
previous release. Apply database migrations only through the reviewed
production GitHub environment, and do not roll back a migration by restoring a
database snapshot without validating customer billing and inventory data.

## Next steps

Complete the evidence record, obtain legal approval, and have the release owner
sign off on every section before enabling live Stripe keys or public onboarding.

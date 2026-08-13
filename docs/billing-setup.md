# Stripe billing setup

LockStock uses Stripe Checkout for new subscriptions, Stripe Billing for plan
changes, and Stripe Customer Portal for payment methods and invoices. Stripe
webhooks are the only mechanism that activates or changes paid entitlements.

## Create products and prices

Create one Stripe product for each self-service plan. Configure each price as
tax-exclusive EUR recurring revenue with the following values.

| Plan | Monthly price | Annual price |
| --- | ---: | ---: |
| Starter | EUR 49 | EUR 468 |
| Operations | EUR 109 | EUR 1,068 |
| Business | EUR 219 | EUR 2,148 |

Copy the six Price IDs into the matching `STRIPE_PRICE_*` variables in
`.env.local`. Enterprise remains a contact-sales plan and doesn't have a Stripe
Price ID.

## Configure Stripe Tax and Customer Portal

Checkout requests billing addresses and tax IDs and enables Stripe Tax. Complete
your Stripe Tax registrations before accepting live payments.

Create a Customer Portal configuration that enables payment-method updates and
invoice history. Disable subscription changes and cancellation in the portal.
LockStock applies those operations through its own endpoints so upgrade,
downgrade, and cancellation timing remains consistent. Set the resulting
configuration ID as `STRIPE_PORTAL_CONFIGURATION_ID`.

## Configure webhooks

Create a webhook endpoint at `https://YOUR_DOMAIN/api/billing/webhook`. Subscribe
it to these events:

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `customer.subscription.pending_update_applied`
- `customer.subscription.pending_update_expired`
- `invoice.paid`
- `invoice.payment_failed`
- `subscription_schedule.updated`
- `subscription_schedule.completed`
- `subscription_schedule.released`
- `subscription_schedule.canceled`

Set the endpoint signing secret as `STRIPE_WEBHOOK_SECRET`. Never expose this
value or `STRIPE_SECRET_KEY` through a `NEXT_PUBLIC_` variable.

## Apply database and authentication configuration

Apply all Supabase migrations, including
`20260627155735_subscription_checkout.sql`. Add the production `/payment` URL to
the Supabase Auth redirect allow list. The local configuration already permits
`http://localhost:3000/payment` and `http://127.0.0.1:3000/payment`.

## Understand subscription changes

LockStock applies billing changes with these rules:

- Tier upgrades and monthly-to-annual changes invoice prorations immediately.
- Entitlements change only after Stripe confirms successful payment.
- Tier downgrades and annual-to-monthly changes begin at renewal.
- Cancellation begins at renewal and can be reversed before that date.
- Failed renewals retain paid access for seven days, then become read-only.
- Downgrades preserve existing data but block new resources above the lower
  plan's limit.

## Verify the integration

Use Stripe test mode and the Stripe CLI before enabling live keys. Complete a
new monthly checkout, annual checkout, immediate upgrade, scheduled downgrade,
failed renewal, cancellation, and reactivation. Confirm that replaying a webhook
doesn't change billing state twice.

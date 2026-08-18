---
date: 2026-08-17
topic: workspace-subscription-model
---

# Workspace subscription model

Each LockStock subscription pays for exactly one workspace. A person can own
or join more than one workspace, but their access and billing do not merge.

## Decision

LockStock uses the workspace as the billing unit. The rejected alternative is
an account-level subscription that contains several workspaces.

- Each workspace has its own billing record, Stripe customer/subscription
  references, plan, and read-only state.
- A member can belong to multiple workspaces. Membership in one workspace does
  not grant data access in another.
- Transferring ownership changes administration of that workspace only. It
  does not move, duplicate, or renew its subscription.
- An account can redeem one trial only. Creating another workspace creates an
  incomplete, read-only workspace until it receives its own subscription.
- Platform administrators can support individual workspaces without gaining a
  new account-level billing construct.

## Why this model

The model keeps the customer-facing billing promise simple: one invoice pays
for one operational workspace. It also keeps workspace deletion, ownership
transfer, Stripe reconciliation, and read-only enforcement scoped to a single
tenant record.

## Consequences

Product copy says "1 per subscription" for every plan. A Business plan no
longer advertises three workspaces, because that would contradict independent
workspace subscriptions. The database creation RPC no longer returns an older
workspace owned by the same person; it creates the requested new workspace and
protects the account-level one-time trial record transactionally.

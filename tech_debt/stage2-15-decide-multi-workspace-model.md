# Stage 2: Decide the multi-workspace product model

Resolve whether one user can own multiple workspaces before implementing the
Business plan claim of three workspaces.

## Decision gate

Start only after product confirms the billing unit, owner transfer rules,
cross-workspace membership behavior, and whether one subscription covers one
workspace or an account. Today, `create_organization_with_owner` returns the
first owned organization, while entitlements advertise workspace limits.

## Options to compare

Compare two minimal models: one subscription per workspace with users owning
multiple workspaces, or one billing account containing several workspaces. Use
real customer needs, not theoretical flexibility. Include deletion, transfer,
invitation, trial abuse, and platform-admin implications.

## Implementation outline

After the decision, write end-to-end tests for creation limits, switching,
billing ownership, and read-only isolation. Remove the single-owned-workspace
shortcut, enforce the chosen limit transactionally, and update UI and pricing.

## Exit criteria

The decision record states the chosen model and rejected alternative. Product
copy and backend behavior match, and tenants cannot use workspace creation to
restart trials or bypass billing limits.

---
date: 2026-06-27
topic: plan-entitlements
---

# Plan Entitlements

## What We're Building

Organizations choose Starter, Operations, Business, or Enterprise when starting a trial. The selected plan is retained as the intended paid plan, but every trial receives Starter functionality for 15 days. Platform admins can change the trial end date. When a trial expires without an active subscription, the organization becomes read-only.

Active subscriptions receive the feature access and operational limits advertised on the pricing page. Plan decisions are enforced by the API and also exposed to the client so unavailable controls can be explained or disabled.

## Why This Approach

Entitlements are derived centrally from billing state instead of scattering plan-name checks throughout the product. This keeps server enforcement authoritative and gives the UI one consistent read model. Storing the chosen plan during the trial preserves purchase intent without accidentally granting paid capabilities.

## Key Decisions

- Trial duration: 15 days from organization creation; editable by a platform admin.
- Trial capabilities: Starter, independent of the selected future plan.
- Expired/unpaid behavior: reads remain available and workspace mutations are rejected.
- Paid capabilities: only `active` billing records use the selected plan.
- Missing billing data: fail safely as read-only Starter access for existing organizations.

## Open Questions

- Payment checkout and automatic activation are outside this change; admins or a future billing webhook can set subscriptions active.

## Next Steps

Implement and test the shared entitlement resolver, trial creation, API enforcement, feature gates, and admin trial editing.

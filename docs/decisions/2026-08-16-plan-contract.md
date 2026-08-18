---
date: 2026-08-16
topic: plan-contract
---

# Plan Contract

We use one reviewed plan contract as the source of truth for:

- pricing cards
- public pricing copy
- paid-plan checkout copy
- TypeScript entitlements
- SQL limit parity checks

The selected paid plan is still retained during a trial, but the trial itself
only receives Starter capabilities. Active subscriptions receive the selected
plan's capabilities and limits. Missing billing remains read-only Starter.

Unsupported multi-workspace behavior is intentionally not promised in the UI.
Business and Enterprise workspace copy is marked as pending the Stage 2
decision until backend support exists.

The SQL migration remains the enforcement layer, and the tests in
`tests/billing/plan-contract.test.ts` pin the contract, billing catalog, and
migration matrix together.

# P0: Patch production dependency vulnerabilities

**Status: completed — 2026-08-17.** Completed in `9dd747a`; production audit is
repeatable in CI and verification covers the upgraded dependency set.

Move production dependencies to versions without the currently reported high-
severity advisories, and make dependency auditing a repeatable CI signal.

## Evidence and risk

On August 13, 2026, `npm audit --omit=dev` reports four high-severity production
chains: direct `next@16.2.9` and transitive `postcss`, `sharp`, and `nanoid`.
The Next.js advisories include proxy bypass, denial of service, and SSRF cases.
The package also pins `postcss@8.5.10` through `overrides`, which keeps a known
vulnerable line in place.

Audit output changes over time, so capture a fresh report immediately before
implementation rather than copying version numbers from this task blindly.

## Minimal implementation

Upgrade the smallest compatible dependency set that clears the production
report. Prefer a patched stable Next.js release and remove the PostCSS override
if the framework resolves a safe version itself.

1. Save the pre-change audit and dependency tree for affected packages.
2. Update lockfile and direct dependency declarations intentionally.
3. Run typecheck, lint, all tests, and a production build.
4. Smoke-test auth proxy behavior, image rendering, Stripe routes, and the main
   workbench pages.
5. Add `audit:prod` using the system CA requirement documented for this Windows
   environment, and run it in CI with an explicit severity policy.

## Acceptance criteria

The task is complete when a fresh production audit has no known high or
critical findings, the complete verification suite passes, and the deployed
runtime uses the patched versions. Document any accepted residual advisory
with exploitability evidence, an owner, and a review date.

## Non-goals and pitfalls

Do not run `npm audit fix --force` or mix unrelated major upgrades into this
patch. Confirm that the fixed Next.js release does not change typed-route or
proxy semantics. Do not suppress audit exit codes globally.

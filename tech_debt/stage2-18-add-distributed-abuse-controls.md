# Stage 2: Add distributed abuse controls

## Status: implemented in the public-launch candidate on August 20, 2026

The release candidate replaces the process-local contact limiter with the
database-backed `public_rate_limits` table and the service-role-only
`consume_public_rate_limit` RPC. The control covers contact, checkout, and
trial-start requests; hashes rate-limit subjects; expires stale rows; and fails
closed when the durable store is unavailable.

Before marking the release live, run `npm.cmd run test:db`, verify the exact
migration state in production, and execute the public rate-limit acceptance
checks in `docs/public-launch-runbook.md`. This ticket is superseded by that
release gate and does not need a separate shared-store implementation.

The previous deferred decision no longer applies. Do not restore the
process-local limiter or add a second rate-limit store without an operational
need and an explicit migration plan.

Replace process-local abuse controls only when the deployment topology or
incident volume justifies shared infrastructure. Minimal structured diagnostics
belong in P0-03 and P1-09, not in this Stage 2 task.

## Decision gate

Start when production runs multiple instances or contact abuse is observed.
The contact limiter is an unbounded in-memory map keyed by forwarded IP and
email, so limits differ by instance and reset on restart.

## Minimal implementation

Use the deployment platform's existing durable store with TTL and atomic
increments. Trust proxy headers only from the configured edge. Add alerting
only for an observed operational need and reuse the structured events delivered
by earlier tasks.

## Exit criteria

Limiter keys expire, multiple instances enforce the same policy, trusted proxy
handling is documented, and store failure has an explicit fail-open or fail-
closed rule per endpoint. Rate-limit infrastructure must not block normal
inventory operations.

## Non-goals

Do not deploy a full telemetry stack, message bus, or SIEM for a low-volume
application. Prefer the hosting platform's existing logs and metrics.

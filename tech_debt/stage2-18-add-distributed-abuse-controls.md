# Stage 2: Add distributed abuse controls

## Status: deferred August 17, 2026

This work is explicitly deferred by the product owner. Keep the current
process-local contact limiter in place, and do not add shared rate-limit
infrastructure until production uses multiple instances or contact abuse is
observed. This task remains open and is not part of the current release scope.

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

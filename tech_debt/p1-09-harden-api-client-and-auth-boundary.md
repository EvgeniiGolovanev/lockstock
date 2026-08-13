# P1: Harden the API client and auth boundary

Create one predictable request path for browser code, stop persisting a second
manual copy of the access token, and return safe errors without hiding server
diagnostics.

## Evidence and risk

The workbench stores the Supabase access token in `localStorage` even though
Supabase already manages its session. Account, payment, platform, and workbench
components each build headers and parse errors differently. `apiRequest`
accepts a user-controlled base URL, has no abort signal, assumes JSON parsing,
and throws message-only errors. The proxy validates the JWT and handlers often
validate it again. `handleApiError` returns database messages, details, hints,
and codes to clients, which can expose internal schema information.

## Minimal implementation

Build a small typed browser request helper that obtains the current session
from the Supabase client, attaches the active organization, supports
`AbortSignal`, and normalizes safe errors. Migrate callers incrementally as
workbench slices are extracted.

1. Characterize 401, 403, 402, validation, non-JSON, network, and aborted
   request behavior.
2. Stop writing `lockstock.accessToken`; remove the manual token input from
   normal production UI. If needed for local diagnostics, gate it to explicit
   development mode and never persist it.
3. Restrict the browser client to same-origin API paths in production.
4. Return stable public error codes and messages. Log database details only on
   the server with a request correlation ID.
5. Measure duplicate auth validation before changing proxy behavior. Keep
   handler-level authorization authoritative.
6. Add minimal structured logs for critical 5xx and authorization failures;
   share the correlation format with Stripe webhook diagnostics.

## Acceptance criteria

No app-owned local-storage key contains a bearer token, all migrated consumers
handle abort and safe errors consistently, tenant changes cannot apply stale
responses, and internal database text is absent from 500 responses. Auth and
role tests remain green.

## Non-goals and pitfalls

Do not replace Supabase Auth, introduce a general SDK generator, or trust the
proxy as the only authorization layer. Preserve API support for legitimate
external bearer-token clients documented by the project.

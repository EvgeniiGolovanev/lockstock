# LockStock Scaffold

Starter scaffold for LockStock, a material stock management web application built for low-ops maintenance by a solo founder.

## Stack

- Next.js (App Router, TypeScript)
- Supabase (Postgres + Auth + RPC)
- Stripe Billing, Checkout, Tax, and Customer Portal
- Zod for request validation

## Quick Start

1. Install dependencies:

```bash
npm install
```

2. Configure env vars:

```bash
cp .env.example .env.local
```

Email integration vars:

- `RESEND_API_KEY`: API key for sending organization invitation emails.
- `EMAIL_FROM`: sender identity used by invitation emails (must be a verified domain in your provider).

Stripe billing requires the server keys and six recurring Price IDs documented
in [`docs/billing-setup.md`](docs/billing-setup.md).

3. Start the local Supabase stack:

```bash
supabase start
```

The repository uses ports outside common Windows-managed ranges:

- API: `http://127.0.0.1:55321`
- Database: `postgresql://postgres:postgres@127.0.0.1:55322/postgres`
- Studio: `http://127.0.0.1:55323`

Set `NEXT_PUBLIC_SUPABASE_URL` to the local API URL and use the keys from
`supabase status` in `.env.local`.

4. Apply SQL migrations in order:
   - `supabase/migrations/202602231350_init.sql`
   - `supabase/migrations/202602232210_user_scoped_org_bootstrap.sql`
   - `supabase/migrations/202602240110_fix_is_org_member_rls.sql`

5. Run development server:

```bash
npm run dev
```

On PowerShell where script execution is restricted, use:

```bash
npm.cmd run dev
```

## Auth / Org Context in This Scaffold

API routes currently use request headers:

- `x-org-id`: organization UUID
- `Authorization: Bearer <access_token>`: Supabase JWT access token

The backend validates JWTs against Supabase Auth and uses a user-scoped database client (RLS-enforced) for API data access.

Bootstrap flow:

1. Call `POST /api/organizations` with `Authorization: Bearer <access_token>` and `{ "name": "My Org" }`.
2. Use returned organization id as `x-org-id` for all org-scoped endpoints.

Example:

```bash
curl -X POST http://localhost:3000/api/organizations \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <access_token>" \
  -d "{\"name\":\"Demo Org\"}"
```

Account signup uses Supabase Auth email confirmation with redirect to `/payment`.
Users can then start a 15-day Starter trial or purchase a monthly or annual plan.

## Implemented Endpoints

- `GET /api/health`
- `GET /api/organizations`
- `POST /api/organizations`
- `GET /api/organizations/:id/members`
- `POST /api/organizations/:id/members`
- `PATCH /api/organizations/:id/members/:userId`
- `DELETE /api/organizations/:id/members/:userId`
- `GET /api/locations`
- `POST /api/locations`
- `GET /api/materials`
- `POST /api/materials`
- `GET /api/suppliers`
- `POST /api/suppliers`
- `GET /api/teams`
- `POST /api/teams`
- `POST /api/teams/:id/members`
- `GET /api/invitations/pending`
- `POST /api/invitations/:id/accept`
- `POST /api/invitations/:id/reject`
- `POST /api/stock/movements`
- `GET /api/purchase-orders`
- `POST /api/purchase-orders`
- `POST /api/purchase-orders/:id/receive`
- `POST /api/import/materials-csv` (CSV body; columns: `sku,name,uom,min_stock`)
- `GET /api/alerts/low-stock`
- `GET /api/reports/stock-health`
- `GET /api/billing/summary`
- `POST /api/billing/checkout-session`
- `POST /api/billing/start-trial`
- `POST /api/billing/change-preview`
- `POST /api/billing/change`
- `POST /api/billing/cancel`
- `POST /api/billing/reactivate`
- `POST /api/billing/portal-session`
- `POST /api/billing/webhook` (Stripe signature required)

List endpoint query params:

- `GET /api/materials?q=&page=&limit=`
- `GET /api/purchase-orders?q=&status=&supplier_id=&page=&limit=`

## Suggested Next Steps

1. Add audit log table + endpoint for critical stock and PO operations.
2. Add integration workers (QBO/Shopify) behind feature flags.
3. Add role-aware UI controls (viewer/member/manager/owner) to hide forbidden actions.
4. Add optimistic updates to reduce full reload calls after create/receive actions.

## Smoke Test Script

Run end-to-end API smoke checks with JWT auth:

```bash
npm run smoke:test -- -AccessToken "<supabase_access_token>"
```

Optional custom base URL:

```bash
npm run smoke:test -- -AccessToken "<supabase_access_token>" -BaseUrl "http://localhost:3000"
```

## Built-in Workbench UI

Open `http://localhost:3000` and use the workbench to:

1. Sign in with Supabase email/password (or paste JWT manually).
2. Let workspace auto-bootstrap organization context.
3. Create location, material, and supplier.
4. Create and receive purchase orders.
5. Record stock movement.
6. Use server-side filters/pagination for materials and purchase orders.
7. Refresh stock health and low-stock metrics.

## API Auth/Role Tests

Run API integration-style tests for `401` auth and `403` role enforcement:

```bash
npm run test:api
```

## Verification

Run the application verification contract locally with:

```bash
npm run verify
```

This runs typecheck, lint, the Vitest suite, and a production build in the same
order used by CI. Each command remains individually callable.

Database authorization tests require Docker and Supabase CLI `2.98.2` or newer:

```bash
npm run test:db
```

The database command copies the local Supabase project into a temporary
directory, assigns a unique local project ID and free database port, resets it
from all migrations, seeds it, runs the pgTAP RLS/RPC assertions, and removes
the temporary containers and volume. It always uses `--local`; it does not use
or modify a linked Supabase project or an already-running development stack.

## CI Pipeline Gates

GitHub Actions workflow: `.github/workflows/ci.yml`

The application job runs `npm run verify`, which enforces, in order:

1. `npm run typecheck`
2. `npm run lint`
3. `npm run test:api`
4. `npm run build`

The database job separately runs the same `npm run test:db` command documented
above against a disposable local Supabase project.

On pushes to `main`, it also runs a linked-database migration drift gate and fails if the remote DB is missing any local migration in `supabase/migrations`.

Required repository secrets for the migration gate:

- `SUPABASE_ACCESS_TOKEN`
- `SUPABASE_PROJECT_REF`
- `SUPABASE_DB_PASSWORD`

## Release Automation

GitHub Actions workflow: `.github/workflows/release.yml`

Trigger:

- Runs automatically after `CI` succeeds on pushes to `main`.

Steps:

1. Link Supabase project and apply pending migrations (`supabase db push --linked`).
2. Build and deploy production app to Vercel.

Required repository secrets:

- `SUPABASE_ACCESS_TOKEN`
- `SUPABASE_PROJECT_REF`
- `SUPABASE_DB_PASSWORD`
- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`

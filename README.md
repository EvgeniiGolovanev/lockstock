# LockStock Scaffold

Starter scaffold for LockStock, a material stock management web application built for low-ops maintenance by a solo founder.

## Stack

- Next.js (App Router, TypeScript)
- Supabase (Postgres + Auth + RPC)
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

3. Apply SQL migrations in order:
   - `supabase/migrations/202602231350_init.sql`
   - `supabase/migrations/202602232210_user_scoped_org_bootstrap.sql`
   - `supabase/migrations/202602240110_fix_is_org_member_rls.sql`

4. Run development server:

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

## Implemented Endpoints

- `GET /api/health`
- `GET /api/organizations`
- `POST /api/organizations`
- `GET /api/locations`
- `POST /api/locations`
- `GET /api/materials`
- `POST /api/materials`
- `GET /api/suppliers`
- `POST /api/suppliers`
- `GET /api/teams`
- `POST /api/teams`
- `POST /api/teams/:id/members`
- `POST /api/stock/movements`
- `GET /api/purchase-orders`
- `POST /api/purchase-orders`
- `POST /api/purchase-orders/:id/receive`
- `POST /api/import/materials-csv` (CSV body; columns: `sku,name,uom,min_stock`)
- `GET /api/alerts/low-stock`
- `GET /api/reports/stock-health`

## Suggested Next Steps

1. Replace header auth with Supabase JWT auth middleware.
2. Add endpoint-level tests for role/validation behavior.
3. Add UI screens for materials, suppliers, teams, and PO receiving flow.
4. Add integration workers (QBO/Shopify) behind feature flags.

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
2. Load organizations and select active org.
3. Create an organization (if needed).
4. Create location, material, and supplier.
5. Create and receive purchase orders.
6. Record stock movement.
7. Refresh stock health and low-stock metrics.

## API Auth/Role Tests

Run API integration-style tests for `401` auth and `403` role enforcement:

```bash
npm run test:api
```

## CI Pipeline Gates

GitHub Actions workflow: `.github/workflows/ci.yml`

It enforces, in order:

1. `npm run typecheck`
2. `npm run lint`
3. `npm run test:api`
4. `npm run build`

On pushes to `main`, it also runs a linked-database migration drift gate and fails if the remote DB is missing any local migration in `supabase/migrations`.

Required repository secrets for the migration gate:

- `SUPABASE_ACCESS_TOKEN`
- `SUPABASE_PROJECT_REF`
- `SUPABASE_DB_PASSWORD`

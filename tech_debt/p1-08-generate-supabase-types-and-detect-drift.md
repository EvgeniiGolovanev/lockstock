# P1: Generate Supabase types and detect drift

Make the checked-in database types a generated contract for the complete local
schema and fail CI when migrations and TypeScript disagree.

## Evidence and risk

`types/database.ts` has no generated header and contains none of the billing
tables or recent billing fields. Billing code compensates with
`as unknown as OrganizationBillingRow`, hand-written row shapes, and unchecked
status strings. This removes compile-time protection precisely where schema
drift can affect payments and access.

## Minimal implementation

Use the Supabase CLI against a disposable local database after all migrations.
Commit the generated output and wrap only ergonomic domain aliases by hand.

1. Add a reproducible `db:types` command.
2. Regenerate `types/database.ts` from the local migrated schema.
3. Type browser, user, and service clients with `Database`.
4. Remove billing double-casts and redundant row definitions where generated
   types are sufficient.
5. Add a CI drift check that regenerates to a temporary file and compares it.

## Acceptance criteria

Generated types include every table, enum, view, and RPC used by the app;
billing code no longer requires `as unknown as`; and a migration without a type
refresh fails CI. Typecheck, tests, and build remain green.

## Non-goals and pitfalls

Do not hand-edit generated rows. Keep domain presentation types separate from
database types. Generation must never connect to production or require linked
project credentials in pull-request CI.

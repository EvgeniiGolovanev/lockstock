# Inventory acceptance tests

Run `npm run test:inventory` to verify the inventory workflow against a real
Next.js server and an isolated Supabase database. No API responses are mocked.
The command also runs the existing database assertions, authorization checks,
and database concurrency checks before the inventory suite.

## Run locally

You need Node.js, the installed project dependencies, Docker running, Supabase
CLI (CI uses 2.98.2), and Playwright Chromium.

```sh
npx playwright install chromium
npm run test:inventory
```

Forward Playwright options to select a test or open a browser:

```sh
npm run test:inventory -- --grep "two materials" --headed
```

Every run uses a unique database project and available ports. Every test creates
a fresh authenticated user and workspace. The application runs from a temporary
source copy without the repository's environment files. The runner deletes the
temporary stack, its data, and the source copy in `finally`, including when a test
fails. On Windows, the temporary directory is next to the repository so Webpack
and the dependency junction stay on the same drive. Your normal development
database and application remain separate.

The browser report and failure traces are in `test-results/inventory-report`
and `test-results/inventory`. CI runs this command in the database job and uploads
these artifacts on failure. They contain disposable test-account data.

## Acceptance scenario

The browser test signs in, creates two materials with PC and KG units, creates two
locations and two vendors, and performs each operation through the UI. Each PO
contains one material and uses a different vendor. Receipts go to location A.

| Operation | Material 1, PC | Material 2, KG |
| --- | ---: | ---: |
| Adjustment into A | 100 | 1,000 |
| Consumption from A | 10 | 100 |
| Transfer from A to B | 9 | 90 |
| PO ordered quantity | 200 | 2,000 |
| First receipt | 40 (20%) | 2,000 (100%) |
| Balance in A | 121 | 2,810 |
| Balance in B | 9 | 90 |
| Total per material | 130 | 2,900 |
| Final receipt of outstanding quantity | 160 | 0 |
| Ending balance in A | 281 | 2,810 |
| Ending balance in B | 9 | 90 |

Assertions check intermediate balances, movement-ledger reconciliation, material
units, vendor assignment, ordered/received quantities, PO statuses, and
persistence after page reload. Transfer quantities are 10% of the stock remaining
after consumption. Quantities with different units are never combined into a
single expected total.

## Additional coverage

The integrity tests call the real application API with authenticated user tokens
and inspect persisted rows independently. Service credentials are used only for
test setup and inspection, not for the inventory commands under test.

The complete-workbench component tests in
`tests/ui/workbench-catalog-dialogs.test.tsx` also check that location create,
edit, and block dialogs mount on the Locations page and that the Vendors page
has one creation toolbar. These cover integration defects found by the browser
acceptance test that the isolated form tests did not detect.

- Invalid quantities, same-location transfers, insufficient stock, and exact
  depletion, including decimal KG quantities.
- Multi-line receipts with different destination locations, partial and complete
  PO status, and rollback when a later receipt line fails.
- Draft and cancelled PO receipt rejection, over-receipt, receipt of a line from
  another PO, and repeated full receipt.
- Concurrent consumption and transfer competing for the same balance, and
  concurrent full receipts of the same PO.
- Viewer write restrictions, unauthenticated writes, and foreign-workspace
  access rejection.
- Failed-command snapshots of balances, movements, PO headers and lines, audit
  records, and catalog data.

Database business-rule errors currently return HTTP 500 from the application's
generic database error handler. Tests distinguish these from validation (400)
and authorization (401/403) errors and verify that rejected commands leave no
partial writes. They do not claim that the error mapping is an ideal API contract.

Concurrent calls are submitted together; their assertions check persisted
invariants regardless of which request wins. They do not force every possible
database lock interleaving or prove general request idempotency.

## Service-wide verification

This suite adds a real inventory acceptance path. It does not establish that
every service feature has complete end-to-end coverage. Use the existing suites
for the broader regression checks:

| Command | Coverage boundary |
| --- | --- |
| `npm run verify` | Type checking, lint, unit/API/component tests, and production build |
| `npm run test:e2e` | Existing browser interactions with mocked application APIs |
| `npm run test:inventory` | Real inventory browser/API workflows plus database verification |
| `npm run test:coverage` | Instrumented Vitest coverage; excludes browser/database execution |

Catalog editing and deactivation, search/filtering, CSV import/export, reports,
authentication variants, membership management, and billing have separate tests
under `tests/api`, `tests/ui`, `tests/auth`, `tests/import`, and `tests/billing`.
External email delivery and live payment processing are outside this local suite.

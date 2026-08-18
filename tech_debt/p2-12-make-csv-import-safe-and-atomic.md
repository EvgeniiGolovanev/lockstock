# P2: Make CSV import standards-safe and atomic

**Status: completed — 2026-08-17.** UTF-8 spreadsheet CSV is parsed and
validated before a single atomic upsert; byte, raw-row, plan, and resulting
material-count bounds are enforced. Independent review: 6/10, request changes;
both review-alignment passes were completed and the full verification gate is green.

Make material import handle real spreadsheet CSV files, validate every row,
and avoid partial or misleading results.

## Evidence and risk

`app/api/import/materials-csv/route.ts` splits lines and cells on commas. It
cannot parse quoted commas, escaped quotes, embedded newlines, byte-order
marks, or common semicolon-delimited French exports. Missing cells become
`undefined`, invalid minimum stock silently becomes zero, duplicate SKUs are
upserted without a dry-run summary, and the route has no direct tests.

## Minimal implementation

Use a maintained streaming CSV parser already compatible with the runtime, or
implement only a narrowly tested parser if dependency cost is unjustified.

1. Add fixtures for Excel UTF-8 BOM, quoted fields, commas, semicolons, CRLF,
   empty rows, duplicate SKUs, invalid numbers, and the maximum plan size.
2. Normalize headers and validate each row with Zod.
3. Return row-numbered validation errors before any database write.
4. Retain a single bounded atomic upsert. If input size later requires chunks,
   use one transactional RPC rather than multiple client-side batches.
5. Enforce both CSV row limits and resulting material-count limits.

## Acceptance criteria

Valid Excel-style files import correctly, invalid files write nothing, every
error identifies its row and field, and retries are deterministic. Large input
is bounded before expensive parsing or insertion.

## Non-goals and pitfalls

Do not build a background import platform or arbitrary column mapper. Reject
unsupported encodings clearly. Formula execution is not part of CSV, but
exported error previews must not create spreadsheet-formula injection.

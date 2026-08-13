# P2: Remove repository rudiments and documentation drift

Reduce duplicated tooling, unnamed artifacts, stale instructions, and unclear
generated assets so contributors can tell what is authoritative.

## Evidence and risk

The repository tracks near-identical skills under `.agent`, `.agents`,
`.claude`, and `.cline`. It also tracks three `supabase/snippets/Untitled query
*.sql` files, duplicate workflow SVG sources under `design` and `public`, two
large language-specific demo capture sets, and more than 18 MB of public
assets. Some duplication may be intentional, so deletion requires provenance.
README instructions refer to a missing release workflow and older migrations.

## Minimal implementation

Inventory ownership and consumers before deleting anything. Prefer one source
plus a documented generation or copy step when multiple runtimes need the same
content.

1. Classify tracked artifacts as source, generated output, runtime asset,
   local-only artifact, or obsolete.
2. Choose one canonical skill directory and generate or link compatibility
   copies only if each tool actually requires them.
3. Rename useful SQL snippets descriptively or remove them after confirming
   they are not operational runbooks.
4. Keep workflow SVG sources in `design`; publish only runtime copies required
   by routes and document the sync command.
5. Add an asset-size report and verify that demo media is referenced.
6. Align README and docs with actual workflows and commands.

## Acceptance criteria

Every retained duplicate has a documented reason, generated assets have a
reproducible source, unnamed SQL files are gone, and all documentation links
resolve. The application and contributor tools still work after cleanup.

## Non-goals and pitfalls

Do not delete user-owned design history or media based on size alone. Git links
and junctions behave differently across Windows and CI; prefer a small sync
script when portability matters.

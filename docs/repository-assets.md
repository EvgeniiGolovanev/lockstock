# Repository assets and agent skills

This repository keeps authored assets separate from runtime copies and checks
their provenance in CI-compatible local commands. Run the synchronization
command after editing a canonical source, then run the hygiene command before
committing.

## Ownership

The following locations are authoritative for their artifact types.

| Artifact | Canonical source | Runtime or compatibility copy | Reason |
| --- | --- | --- | --- |
| Agent skills | `.agents/skills/` | `.agent/skills/`, `.claude/skills/`, `.cline/skills/` | Each supported agent runtime discovers skills from its own directory. |
| Workflow diagrams | `design/workflows/*.svg` | Eight referenced SVGs in `public/workflows/` | The authenticated workflow UI loads only these public SVG paths. |
| Demo captures | `design/demo-captures*/` | None | The video renderer reads these source screenshots. They are not application assets. |
| Demo videos | `scripts/create-lockstock-demo-video.py` | `public/lockstock-demo*.mp4` | The landing UI uses the localized MP4 files. |

## Synchronize generated copies

Run this command from the repository root after changing a canonical skill or
workflow SVG. It copies only files managed by the canonical manifest. It fails
instead of deleting an unexpected managed file, and it preserves non-SVG files
in `public/workflows/`.

```bash
npm run sync:repository-assets
```

The command does not generate demo video files. To regenerate them, install
Python with Pillow and `ffmpeg`, then run the renderer once for English and once
for French:

```bash
python scripts/create-lockstock-demo-video.py
python scripts/create-lockstock-demo-video.py --fr
```

## Verify repository hygiene

Run the hygiene report before committing asset or documentation changes.

```bash
npm run repo:hygiene
```

The check verifies that compatibility skill files and public workflow SVGs
exactly match their canonical source, that demo media is referenced by the
application, and that local Markdown links resolve. It also reports the public
asset count, total size, and ten largest files.

## SQL snippets

`supabase/snippets/` contains manually run, descriptive operational snippets.
It is not a migration directory. Put schema changes in a dated migration under
`supabase/migrations/`; do not add ad hoc schema changes to snippets.

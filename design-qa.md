# Industrial Command design QA

The rendered application uses the approved Industrial Command visual system.
This review compares its visual language and usability with the selected
generated concept while preserving the real application's content and behavior.

## Sources and normalization

The selected source visual is
`C:/Users/golov/.codex/generated_images/01a16ed0-8623-7d00-94c9-12955c5baf2b/exec-6786d549-b753-4c05-8d47-82831ad96a83.png`.
The complete approved page boards are in
`C:/Users/golov/.codex/visualizations/2026/11/07/lockstock-industrial-command/images/`.

The source board is 921 × 1708 pixels. Its embedded workspace is approximately
904 × 758 pixels, rather than a browser capture with reliable CSS dimensions.
The implementation captures use 1440 × 1000 and 375 × 1000 CSS-pixel viewports
at device scale 1. Full-page image heights vary with actual page content.
Comparisons normalize embedded source and implementation frame widths and
preserve aspect ratio. This is a visual-system review, not pixel-identity proof.

The inventory source shows ten fictional rows. The browser fixture has one
material; it retains its actual quantity, price, totals, status, and location.
The website capture is signed in, so its account actions replace Sign in.

## Evidence

Browser-rendered evidence is saved under `.superpowers/industrial-command/`.
The directory is ignored and belongs to this working copy.

- Full views: `compare-inventory.png` and `compare-home.png` place the source
  and implementation together in the same image.
- Focused view: `compare-inventory-focus.png` compares navigation, heading,
  command ribbon, metrics, and filters at the same normalized width.
- Final desktop and mobile page captures:
  `screenshots/win32/1440-inventory.png`, `1440-home.png`, `1440-account.png`,
  `375-account.png`, and the corresponding route captures in that directory.
- Contrast correction: `france-contrast-final.png`, `contrast-red.log`, and
  `contrast-green.log` record the reproduced and corrected state.

## Required fidelity surfaces

The following surfaces were checked against the source and rendered evidence.

| Surface | Result |
| --- | --- |
| Typography | System sans-serif throughout; strong headings, 14px operational text, tabular numeric data; no editorial serif display style. |
| Spacing and layout | Persistent left navigation, command ribbon before inventory metrics, bounded panels and forms, compact grid rows, and internal table scrolling. |
| Colors and tokens | Graphite navigation and marketing header, steel canvas, white panels, orange active/primary actions, and semantic stock statuses. |
| Image quality | Real generated industrial hero texture, optimized to a 25,762-byte WebP; supplied source vector logo/icons and workflow assets retained. |
| Copy and content | Real EN/FR wording, legal draft status, prices, fields, units, routes, permissions, and calculations retained instead of generated inaccuracies. |

## Comparison history and findings

The initial comparison established the shared palette, split hero, operational
panels, and table hierarchy. It exposed a light product-preview caption on a
white surface: the broad hero paragraph rule also reached the nested preview.
A dedicated preview-caption rule restored its muted foreground and compact
spacing before the final browser captures.

The independent review then found a P2 contrast failure on the secondary
French campaign hero link. Equally specific module rules allowed the light-page
orange foreground to win on graphite. A browser regression reproduced the
failure, and stronger campaign scoping restored white text. Direct footer
links also use a light foreground on graphite. The regression passes after the
fix, including the existing account-anchor and destructive-hover assertions.

No actionable P0/P1/P2 findings remain in the inspected desktop/mobile states.

## Intentional source-preserving differences

These differences are accepted to keep the application usable and unchanged
in behavior, rather than reproduce errors or omissions in the generated art.

- Keep the existing 16rem sidebar, collapse preference, localized navigation,
  and mobile scrollable navigation. Do not introduce a new drawer workflow.
- Keep actual workspace controls and contextual Workflow links; do not add a
  fictional avatar menu or duplicate workspace switcher from the image.
- Keep the real stock dataset and all ten inventory columns. Additional rows
  appear only when data actually exists.
- Use darker orange `#b7460c` for white-text buttons to maintain contrast.
- Keep existing marketing copy, sections, supplied icons, and product-preview
  data. The miniature preview remains an illustration of source functionality.
- Keep the existing readable form order and persistent account sections.

## Interaction and accessibility coverage

The browser suite checks navigation and collapse, workspace switching,
membership, stock movements, purchase-order actions, account billing actions,
Google onboarding, password recovery, public forms, page identity, mobile
overflow, account anchors, and primary/secondary/destructive text contrast.
The route sweep includes 26 direct pages at 1440 and 375 pixels; callback and
onboarding routes have separate browser scenarios.

There is no claim of exhaustive accessibility conformance, every role/error
combination, or every viewport. Existing lint warnings and workflow-image
loading advisories are documented separately from this visual change.

## Implementation checklist

The visual checklist is complete for the inspected states.

- [x] Apply the approved visual system without new product functions.
- [x] Inspect full-view and focused source/rendered comparisons.
- [x] Inspect desktop and mobile screens.
- [x] Reproduce and correct the campaign contrast regression.
- [x] Preserve source content and document intentional deviations.

final result: passed

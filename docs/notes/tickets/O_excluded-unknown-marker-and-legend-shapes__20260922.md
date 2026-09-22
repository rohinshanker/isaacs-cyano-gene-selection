# O_excluded-unknown-marker-and-legend-shapes__20260922 — Active

- Scope: map marker for CDSs that are both excluded by filters and unknown or unclassified; legend swatches that must depict the real marker shapes.
- Status: active
- Opened: 2026-09-22
- Updated: 2026-09-22

## Current State

Implementation and validation are complete on `feat/marker-legend-shapes`:
excluded unknown CDSs have their own filled-dot canvas bucket and counted
legend row, marker conventions share inline-SVG swatches, and visible export
category buckets have regression coverage.

## Original State

In `site/js/ui/scatter.js`, every CDS excluded by filters draws as a grey
outlined square (`GHOST_COLOR` fill, `GHOST_BORDER` stroke) when **Show
filtered-out** is on, regardless of its category. In Function category colour
mode an included unknown-or-unclassified CDS draws as an open ring in
`CATEGORY_UNKNOWN_COLOR`. The legend (`site/js/ui/legend.js`, `makeSwatch`
and `addNote`, styled by `.legend-swatch-box` in `site/css/app.css`) shows
every marker convention as a CSS box: the shortlist row is a rotated square
and the pinned row is a plain circle, so neither matches the diamond outline
or the ring-with-crosshairs actually drawn on the canvas.

Two changes:

1. **Excluded and unknown.** In Function category colour mode, a CDS that is
   excluded by the active filters and resolves to unknown or unclassified
   draws as the unknown greyed-out dot with **no outline**: a small filled
   circle in the unknown grey at the ghost marker size, no stroke. A CDS that
   is excluded but has a reviewed category keeps the grey outlined square.
   Outside category mode the ghost square is unchanged. The legend's
   "Excluded by filters" wording and count must distinguish the two
   treatments (for example "excluded, reviewed category: grey outlined
   square" and "excluded, unknown: grey dot"), and the category legend hover
   preview, the category filter, and the export's visible-bucket fields must
   still classify these CDSs consistently. Draw order stays: excluded
   markers behind included unknown rings, reviewed colours on top.

2. **Legend swatches match the canvas.** Replace the CSS-box swatches for
   marker conventions with small inline SVGs that reproduce the drawn shape
   at legend scale: filled grey square with border for excluded, filled grey
   dot for excluded-unknown, open ring for unknown or missing, diamond
   outline for shortlisted, ring with four crosshair ticks for pinned, and
   the filled circle for coloured points. Apply to both the category legend
   and the numeric legend notes so the same convention never has two
   pictures. Swatches are decorative (`aria-hidden`), sized to the legend
   text, and use the exact colours the canvas uses (`site/js/ui/colors.js`).

Read `docs/validation/viewer-interaction-state.md` (category legend filter,
pinned and shortlist marker rules) and `function-categories.md` (marker
conventions and export bucket fields) before changing draw order or wording.

## Verification

`npm test` passes 457 tests; Python passes 301 tests plus 22 subtests; the data
contract, live-metric check, and `git diff --check` pass. Rendered inspection at
1280×800 and 390×844 shows 1,768 excluded unknown dots and seven excluded
reviewed squares under a CDS-length filter, with shortlisted and pinned marker
overlays matching the inline-SVG legend. Numeric legend notes use the same SVG
geometry. Both widths have no horizontal overflow and no console warnings or
errors.

## Cleanup

Record the marker and swatch conventions in
`docs/validation/function-categories.md` and
`docs/validation/viewer-interaction-state.md`, then delete this ticket and
its queue row.

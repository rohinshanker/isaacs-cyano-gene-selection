# O_excluded-unknown-marker-and-legend-shapes__20260922 — Open

- Scope: map marker for CDSs that are both excluded by filters and unknown or unclassified; legend swatches that must depict the real marker shapes.
- Status: open
- Opened: 2026-09-22
- Updated: 2026-09-22

## Current State

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

Pending: unit tests for the marker classification of excluded-and-unknown
versus excluded-and-reviewed CDSs and for the export bucket fields; existing
`tests/js` suites green, including `interface-copy` and any test that reads
legend text; rendered inspection at desktop and about 390 px with Show
filtered-out on in category mode showing the grey dot for excluded unknown
CDSs and the outlined square for excluded reviewed CDSs, plus the legend
swatches visibly matching a shortlisted diamond and a pinned crosshair ring
on the canvas, per the `ui-render-inspect-repair` skill.

## Cleanup

Record the marker and swatch conventions in
`docs/validation/function-categories.md` and
`docs/validation/viewer-interaction-state.md`, then delete this ticket and
its queue row.

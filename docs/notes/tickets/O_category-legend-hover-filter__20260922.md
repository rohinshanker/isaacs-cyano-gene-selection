# O_category-legend-hover-filter__20260922 — Open

- Scope: viewer function-category legend, map highlighting, filter state, URL state, and export.
- Status: open
- Opened: 2026-09-22
- Updated: 2026-09-22

## Current State

The **Reviewed function categories** legend (`site/js/ui/legend.js`, shown when
**Colour by** is Function category) is display-only. Make each category row
interactive:

- Hovering a category row previews only that category's genes on the map:
  other CDSs recede to the filtered-out treatment while the hover lasts, and
  the map returns to its prior state on mouse leave. Hover is a preview only
  and must not change filter or URL state.
- Clicking a category row selects it as a filter, so only genes in the chosen
  category remain active. Clicking a selected row deselects it.
- Multiple categories can be selected at once (additive, OR semantics across
  selected categories). Selected rows are visibly marked in the legend.
- A reset control clears every category selection. **Clear all filters** must
  also clear category selections so no stale category filter remains visible or
  encoded in the URL (see `docs/validation/viewer-interaction-state.md`).
- Keyboard users need the same paths: rows are focusable, focus previews like
  hover, Enter/Space toggles selection.

Constraints:

- The `unknown-or-unclassified` and `multiple-functions` buckets are selectable
  like any other category, so the whole CDS set stays reachable.
- Category filtering must compose with existing numeric and activity filters and
  respect the grey-outlined-square convention for excluded CDSs.
- Encode selected categories in the URL state and record them in the export
  manifest alongside the existing colour-mode and category fields.
- Do not change category assignments or the category vocabulary; this ticket is
  interaction only (`docs/validation/function-categories.md`).

## Verification

Pending: unit tests for the category filter reducer, URL round-trip, and export
manifest fields; rendered inspection of hover, multi-select, reset, keyboard
path, and Clear all filters at desktop and narrow breakpoints per the
`ui-render-inspect-repair` skill; existing `tests/js` suites green.

## Cleanup

Distill the category filter contract into
`docs/validation/viewer-interaction-state.md` (or `function-categories.md` if
it fits better), update `docs/validation/INDEX.md`, then delete this ticket and
its queue row.

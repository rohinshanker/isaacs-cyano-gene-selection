# O_category-legend-hover-filter__20260922 — Open

- Scope: viewer function-category legend, map highlighting, filter state, URL state, and export.
- Status: open
- Opened: 2026-09-22
- Updated: 2026-09-22

## Current State

Implemented on branch `feat/category-legend-filter`. The legend rows in
`site/js/ui/legend.js` are now interactive (hover/focus preview via
`app.js`'s `previewCategory`, click/Enter/Space toggle via
`toggleCategorySelection` in `site/js/core/function-categories.js`), the
selection lives in `state.categoryFilter` (`site/js/core/url-state.js`,
key `cf`, extends `STATE_VERSION` 2 without a bump), composes with the
existing filter mask in `app.js`'s `computeMask` (a separate `context.baseMask`
keeps hover preview independent of numeric/exception/expression/protein
filters and of the current category selection), and is cleared by both the
scoped legend reset and **Clear all filters** (`clearedFilterState`). Selected
categories are recorded in the export manifest's `filterState.categoryFilter`
and `viewState.categoryFilter`. Below is the original ask, retained for
reference:

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

Done: unit tests added for the category filter reducer
(`tests/js/function-categories.test.mjs`), URL round-trip
(`tests/js/url-state.test.mjs`), and export manifest fields
(`tests/js/export-manifest.test.mjs`); `npm test` (373 tests) and
`python -m pytest -q` (246 tests) both green; `tools/validate_contract.py`
and `node tools/check_live_metrics.mjs` both pass. Rendered inspection via
`playwright-cli` at 1280×900 and 390×844 covered hover preview (no URL/state
change, restores on mouse leave), click multi-select with OR semantics (8 of
2,715 genes for two 3+5-gene categories), keyboard focus-preview and
Enter-toggle, the `unknown-or-unclassified`/`multiple-functions` buckets
(2,703 of 2,715 selected together), the scoped "Clear category selection"
control and **Clear all filters** both removing `cf=` from the URL, and an
end-to-end CSV/manifest export confirming `filterState.categoryFilter` and
`viewState.categoryFilter`. Zero browser console errors observed.

## Cleanup

Distill the category filter contract into
`docs/validation/viewer-interaction-state.md` (or `function-categories.md` if
it fits better), update `docs/validation/INDEX.md`, then delete this ticket and
its queue row.

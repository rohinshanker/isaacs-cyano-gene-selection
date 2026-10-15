# R_custom-filters-panel__20261013 — Resolved

Scope: Add a collapsed-by-default Custom filters section above Filters in the left controls column and move the existing Add filter area into it.
Status: resolved
Opened: 2026-10-13
Updated: 2026-10-14

## Current State

Requested by the owner. Claimed 2026-10-14 by session cyano-unblocked-tix, implementing on branch `work/filters-tickets-20261014` in `../worktrees/filters-tickets-20261014`.
`FilterPanel.build()` in `site/js/ui/filters.js` currently places Add filter,
its metric selector/Add button and custom range rows below the built-in filters.
The left column currently registers Gene visualizer, Recoding scheme and Filters.
See the [controls-column contract](../../validation/controls-column-and-resets.md).

## Acceptance

- Add a separate left-column panel titled **Custom filters**, immediately above
  **Filters** in the default and reset layouts. It starts collapsed by default.
- Move the existing Add filter label, metric selector and Add button into this
  panel, together with the editors for the custom filters they create. Remove
  their old placement at the bottom of Filters; keep one shared filter state.
- Keep built-in filters, including Hide low-traffic genes, in Filters. Adding,
  editing or removing custom filters retains the existing metric eligibility,
  range/missing-value semantics, counts, histograms and combined filtering result.
  Collapsing either panel does not disable or clear its filters. Global Clear all
  filters still clears both sections and retains its existing confirmation.
- Reuse the existing panel heading, collapse/reorder controls, keyboard/focus
  handling and responsive layout. Preserve held-slider gestures and focus when
  custom range rows update after moving to their new host.
- Include the new panel in shared layout state and resets. For older links with
  no Custom filters panel, insert it above Filters and default it to collapsed;
  preserve the relative order and explicit collapse state of the existing panels.
  New links retain an explicitly opened or repositioned Custom filters panel.
- Restore saved custom filters accurately even when the panel is collapsed;
  keep active-filter summaries and exports consistent with the effective mask.

## Verification

Ticket creation: inspected the queue, current FilterPanel layout and the panel
order/collapse/share-link contract. Implementation must use the UI skill and
inspect fresh/reset, collapsed/expanded and populated states at mobile, tablet
and desktop widths. Exercise Add/edit/remove, clear-all confirmation, live slider
updates, keyboard focus, old/new shared links and organism/tab changes. Verify
unchanged filtering results and run the repository's required gates.

## Outcome

Closed 2026-10-14 by session cyano-unblocked-tix, which owned and implemented it.

Custom filters is a fourth left-column panel, collapsed by default, directly above
Filters (de6688a). It holds Add filter, its metric selector and the range rows it
creates; Filters keeps every built-in filter, the passing count and Clear all
filters, which clears both. One `FilterPanel` writes one filter state. Encoder
version 9: an older link inserts the panel above Filters, collapsed, keeping its
own order and collapse state; a version 9 link keeps the panel opened or moved.
The Reset panel layout copy names both collapsed panels. Contract distilled to
`docs/validation/controls-column-and-resets.md` (c81bce2).

## Findings against the work

- Review: no finding against this ticket's scope (Codex, on bfb78d2..9c1ae27).
- Self-found: the Reset panel layout tooltip and dialog still said only the gene
  visualizer starts collapsed; resolved in 20147cd.

No finding is open.

## Final validation

Final validation, 2026-10-14, on branch `work/filters-tickets-20261014` after merging
`origin/main` at 7dedca7: `npm test` 1,623 pass; `.venv/bin/python -m pytest -q`
2,080 pass, 20 skipped, run with the main checkout's ignored raw inputs linked in;
`.venv/bin/python tools/validate_contract.py` 130 pass, 1 skipped; module preloads
match the import graph. Rendered in Chromium at 375, 768, 1280 and 1440 px with no
console errors, failed requests or horizontal overflow; screenshots under
`.playwright-cli/filters-tix-20261014/` in the worktree (ignored). Cross-provider
review by Codex `gpt-6-astra` at xhigh on bfb78d2..9c1ae27 returned R1 to R7;
the same reviewer confirmed all seven resolved in 617204a with no new defects in
c81bce2 or 617204a, and confirmed 469a767.

Rendered: fresh, collapsed and expanded, populated with a range row, Add, Remove,
Clear all with its confirmation, version 9 links, and the UTEX 2973, E. coli K-12
and Syn61 organisms. Node tests cover version 8 and unversioned link migration,
the held-slider update in the moved row, and the split hosts.

## Cleanup

Claim ownership before editing shared panel/filter files. Coordinate with the
[low-traffic pooling/Provenance ticket](R_low-traffic-provenance-disclosure__20261013.md),
which also touches FilterPanel; its built-in controls remain in Filters.
Resolve every finding, distill the revised panel/state contract into validation
guidance and its index, then remove this ticket and queue row under AGENTS.md.
Leave other sessions and unrelated ticket scope untouched.

# A_custom-filters-panel__20261013 — Active

Scope: Add a collapsed-by-default Custom filters section above Filters in the left controls column and move the existing Add filter area into it.
Status: active
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

## Cleanup

Claim ownership before editing shared panel/filter files. Coordinate with the
[low-traffic pooling/Provenance ticket](A_low-traffic-provenance-disclosure__20261013.md),
which also touches FilterPanel; its built-in controls remain in Filters.
Resolve every finding, distill the revised panel/state contract into validation
guidance and its index, then remove this ticket and queue row under AGENTS.md.
Leave other sessions and unrelated ticket scope untouched.

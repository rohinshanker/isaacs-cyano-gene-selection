# A_pca-grid-wheel-zoom__20261009 — Active

- **Scope:** Restrict PCA wheel zoom to the plotted grid, excluding axes and outer canvas margins.
- **Status:** active
- **Opened:** 2026-10-09
- **Updated:** 2026-10-09

## Current State

Implementation owned by `cyano-regulatory-sites` at the owner's request, in
`worktrees/pca-grid-wheel-zoom-20261009` on branch
`work/pca-grid-wheel-zoom-20261009`, baseline `3e6651e`. Other chat worktrees,
browsers and processes are out of scope. The owner wants wheel zoom to require the
pointer to be inside the PCA grid itself. Scrolling over the areas containing
axis labels or ticks, or outside the grid, should scroll the page normally.

## Acceptance

- Use the plot's actual inner grid bounds to decide whether a wheel event zooms;
  do not use the whole canvas bounds or approximate fixed margins.
- Ignore wheel zoom over both axes and all outer margins, leaving normal page
  scrolling available there. Test the grid boundary on every side.
- Preserve pointer-centered wheel zoom within the grid, pan, reset, and button
  and keyboard zoom. Keep the hit boundary correct after viewport or rail resizing.
- Check every scatter view using the shared plot component for consistent wheel
  behavior; keep chromosome scrolling independent.

## Verification

Ticket-only intake. The requested wheel boundary has not been reproduced or
implemented. Before closure, use the real application at mobile, tablet and
desktop widths, wheel over grid/axes/margins and immediately across each edge,
resize the map, and run the gates in `AGENTS.md`.

## Cleanup

The implementing session owns closure, records every remaining finding, and
distills the reusable wheel hit-boundary and page-scroll contract into
[viewer-interaction-state.md](../../validation/viewer-interaction-state.md).
Follow the resolved-ticket lifecycle; retain no completion ledger.

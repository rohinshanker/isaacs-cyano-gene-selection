# A_pca-grid-wheel-zoom__20261009 — Active

- **Scope:** Restrict PCA wheel zoom to the plotted grid, excluding axes and outer canvas margins.
- **Status:** active
- **Opened:** 2026-10-09
- **Updated:** 2026-10-09

## Current State

Implementation owned by `cyano-regulatory-sites` at the owner's request, in
`worktrees/pca-grid-wheel-zoom-20261009` on branch
`work/pca-grid-wheel-zoom-20261009`, baseline `3e6651e`. Other chat worktrees,
browsers and processes are out of scope. The shared scatter wheel handler now
checks its live drawing rectangle before cancelling an event. Axes and margins
scroll the page; the grid retains pointer-centred zoom. Visible and accessible
instructions describe the boundary. Four regression tests exercise the real
handler and camera mathematics.

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

- `npm test`: 1,467 passed.
- `.venv/bin/python -m pytest -q`: 958 passed, 1 skipped, 46 subtests passed.
- `.venv/bin/python tools/validate_contract.py`: 126 passed, 0 failed, 1 declared
  spliced-CDS exemption.
- Chromium reproduced the original margin interception using the baseline
  handler. The final handler passes every grid edge in native, metric X/Y,
  recoding-risk, UMAP, perturbation, and Syn61 parent-reference projections.
- Rendered screenshots and semantic state inspected at 375, 768, 959, 960, 1239,
  1240, 1280 and 1440 px. No horizontal overflow or browser/console/request errors.
  Real grid wheel input zooms without page scrolling; real wheel input in all four
  margins scrolls the page without changing zoom. Resized rail, unavailable map,
  pointer-centred zoom, drag and keyboard pan, button/keyboard zoom, reset and
  double-click reset pass. Chromosome wheel zoom remains functional independently.
- `git diff --check` passes. Temporary browser scripts, screenshots and logs are
  ignored under this worktree's `.playwright-cli/pca-wheel/`.

## Cleanup

The implementing session owns closure, records every remaining finding, and
distills the reusable wheel hit-boundary and page-scroll contract into
[viewer-interaction-state.md](../../validation/viewer-interaction-state.md).
Follow the resolved-ticket lifecycle; retain no completion ledger.

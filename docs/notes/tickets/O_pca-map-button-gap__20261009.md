# O_pca-map-button-gap__20261009 — Open

- **Scope:** Add a small gap between the buttons immediately above the PCA map and the map itself.
- **Status:** open
- **Opened:** 2026-10-09
- **Updated:** 2026-10-09

## Current State

Opened by `cyano-ui-fixes` at the owner's request. Implementation is unassigned
and has not started. The buttons directly above the PCA map should have a small
visible separation from the map edge instead of touching it. This requests
spacing between the button row and the plot, rather than a change to spacing
between individual buttons. No exact pixel value was specified.

## Acceptance

- Inspect the rendered PCA view to identify the adjacent button row and map
  boundary, then add a small vertical gap consistent with existing spacing.
- Keep the gap visible when buttons wrap at narrow widths. Avoid excess blank
  space or shrinking the usable map unnecessarily.
- Preserve normal flow when search results, filter status, or loading/failure
  content appears between controls and the plot. Do not introduce overlays or
  obscure buttons, plotted points, or focus outlines.
- Check other map tabs using the shared toolbar/canvas layout for unintended
  spacing or sizing changes; preserve pan, zoom, reset, and resize behavior.

## Verification

Ticket-only intake; the owner-reported spacing has not been independently
rendered or repaired in this intake. Intake validation on 2026-10-09 passed
metadata/link checks and the repository gates: 1,395 JavaScript tests; 925 Python
tests and 36 subtests with one skip; 119 contract checks with one declared skip.
This validates the baseline, not the unimplemented spacing change.

Before closure,
render PCA at mobile, tablet, and desktop widths, including wrapped controls,
search/filter messages, and loading states. Inspect the actual row-to-map gap
and map bounds, exercise the buttons, and check other shared map layouts. Run
the gates in `AGENTS.md`.

## Cleanup

The implementing session owns closure and records every remaining finding.
Distill any reusable toolbar-to-map spacing rule into
[responsive-workspace.md](../../validation/responsive-workspace.md), update the
validation index if needed, and follow the required resolved-ticket lifecycle.

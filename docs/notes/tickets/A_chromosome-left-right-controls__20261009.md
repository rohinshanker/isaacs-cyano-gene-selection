# A_chromosome-left-right-controls__20261009 — Active

- **Scope:** Add visible left and right pan controls to the chromosome visualizer.
- **Status:** active
- **Opened:** 2026-10-09
- **Updated:** 2026-10-09

## Current State

Owned by `cyano-ui-fixes` for implementation, integration and closure. Work started
2026-10-09 under the owner's request to complete unblocked tickets. The owner wants to scroll left or right through the chromosome
using controls, without needing to drag the track with the mouse.

The current chromosome toolbar exposes zoom and reset controls; track dragging
and Shift+arrow keyboard panning already exist. Add discoverable on-screen
directional controls using the same viewport logic. This request concerns the
chromosome track in Chromosome/Gene.

## Acceptance

- Place left and right pan buttons beside the chromosome's existing navigation
  controls. Use clear directional icons and accessible names such as "Pan left"
  and "Pan right"; support mouse clicks, touch taps and keyboard activation.
- Move the visible coordinate window horizontally while preserving its zoom
  level. Choose a useful step relative to the current window, retaining enough
  overlap to follow nearby features; repeated activation must remain responsive.
- Keep the current drag, zoom, reset and keyboard navigation available. Respect
  the existing primary-track toolbar scope and independent replicon windows.
- Reuse the existing coordinate bounds; never pan into invalid coordinates.
  Make unavailable directions clear at either end and when the entire chromosome
  is already visible. Do not introduce new origin-wrapping behavior.
- Keep coordinate labels and aligned gene, initiation-site and tRNA tracks in
  sync with the new viewport. Panning must preserve selected genes, evidence,
  filters and colour settings, and must not select a gene accidentally.
- Keep both buttons reachable with visible keyboard focus at mobile, tablet and
  desktop widths, including when the toolbar wraps.

## Verification

Ticket-only intake; no UI behavior has changed. The requested controls have not
been implemented or rendered during intake.
Metadata, the validation-document link and the queue entry were checked. Intake
gates passed on 2026-10-09: 1,396 JavaScript tests; 938 Python tests and 36 subtests
with one skip; 119 contract checks with one declared skip. These results validate
the baseline, not an implementation of the requested controls.

Before closure, use the UI render skill at mobile, tablet and desktop widths.
Check left/right movement at several zoom levels, repeated activation, both
coordinate limits, full-chromosome view, organism/replicon changes, and aligned
annotation tracks. Confirm mouse, touch and keyboard operation, zoom preservation,
reset and drag behavior, focus visibility and absence of console errors. Add
focused viewport/control regression coverage and run the gates in `AGENTS.md`.

## Cleanup

The implementing session owns closure and records every remaining finding.
Distill the navigation step, boundary and accessibility rules into
[chromosome-view.md](../../validation/chromosome-view.md), update its validation
index row if needed, and follow the required resolved-ticket lifecycle.

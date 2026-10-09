# R_chromosome-left-right-controls__20261009 — Resolved

- **Scope:** Add visible left and right pan controls to the chromosome visualizer.
- **Status:** resolved
- **Opened:** 2026-10-09
- **Updated:** 2026-10-09

## Outcome

Closed by **cyano-ui-fixes**, 2026-10-09. Pan left/right are implemented in
`812b901`, integrated with the published Scale layout. Each action moves 15% of
the primary chromosome window while preserving its span, clamping to coordinates
and synchronizing gene, Tan and tRNA tracks. Disabled directions and the full-view
state are explicit; keyboard focus moves to the opposite button at a boundary.
Existing drag, zoom, Shift+arrow, selection and all-track Reset remain available.

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

Final integrated code `f531145` passed 1,412 JavaScript tests, 938 Python tests
and 36 subtests (one skip), and 119 contract checks (one declared skip). Raw inputs
came from the canonical checkout through local read-only links, never new data.

Real Chromium renders covered UTEX at 375, 768, 1280 and 1440 px, both sides of
959/960 and 1239/1240 breakpoints, and every E. coli organism at 375 px. Checked
fixed-span movement, both bounds, disabled full view, Enter/Space/Shift+arrow,
mouse and emulated-touch taps, focus handoff, aligned tracks, retained Scale
alignment, drag/wheel/reset, selection and zero overflow/runtime errors. Seven
behavior mutations failed the new unit tests. No automated axe scan or physical
device/screen-reader certification was performed.

Independent Codex review DEM-335 approved exact chromosome scope `a300092` after
its documentation fixes. Later gene-viewer changes do not change this scope.

## Findings at closure

- **PAN-1:** missing visible left/right controls — resolved by `812b901`.
- **DEM-335-F1:** inaccurate chromosome-only Reset prose and stale confirmation
  instructions — resolved by `a300092`, independently confirmed.
- **DEM-335-F2:** incorrect numeric example for a 15% step — resolved by
  `a300092`, independently confirmed.
- No open finding remains against this ticket.

## Cleanup

Reusable step size, scope, boundary, focus and verification rules are in
[chromosome-view.md](../../validation/chromosome-view.md) and its validation index
row. Inbound overlap-ticket guidance points there. The live queue row is removed;
deleting this resolved ticket is the final cleanup step. No ticket-only contract
or unresolved finding needs to survive elsewhere.

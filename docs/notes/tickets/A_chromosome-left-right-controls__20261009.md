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

**Implemented on branch `agent/claude-implementer/dem-333` (DEM-333), awaiting
the owning session's integration and closure.** `Pan left` and `Pan right` open
the view-button row ahead of the zoom pair and `Reset view`, each a shared
`chip-button` carrying a directional glyph and the bare accessible name. One
step is `PAN_STEP_FRACTION` (0.15 of the window) through the model's existing
`panWindow`, so the span — and therefore the zoom — is preserved, the window is
clamped to the replicon, and no origin wrapping is introduced. The buttons and
Shift+arrow call the one `panByStep`. `syncPanButtons`, called from
`renderSummaries`, disables each direction at its coordinate limit, which also
covers the whole-replicon case; a button that disables itself under the reader's
hand hands keyboard focus to the opposite direction, and Shift+arrow announces a
refused step because the canvas keeps the focus there. The rules are distilled in
[chromosome-view.md](../../validation/chromosome-view.md) under "Panning the
chromosome by a step", and its validation index row was extended.

No shared CSS, `app.js`, `index.html` or data file was touched.

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

### Implementation validation, 2026-10-09

Gates on the implementation patch: 1,404 JavaScript tests; 938 Python tests and
36 subtests with one skip; 119 contract checks with one declared skip. The Python
gate needs the gitignored `data/raw` inputs, which a fresh worktree does not
carry; it was run with those canonical files linked in read-only and the links
removed afterwards. Seven mutations of the new behaviour — the button state never
syncing, the step changing the span, the focus handoff removed, the limit left
silent, the start-site row reading a stale window, `Pan right` never dimming, and
Shift+arrow inverted — each fail the new tests.

Rendered against `python3 -m http.server 8857 --directory site` from this
worktree, Chromium session `chromosome-pan-20261009`, route `#p=chromosome`, at
375x812, 768x1024, 1280x800, 1440x900 and at 959/960 and 1239/1240 px. Both
buttons visible, hit-testable and 34 px tall at every width, no horizontal
overflow anywhere, and the row wraps into pan / zoom / reset groups at 375 px.
Exercised: both directions by click, by genuine touch tap on an emulated mobile
device, and by Enter and Space; repeated activation to each coordinate limit,
which dims only that direction and moves focus to the other; a drag to base 1
dimming `Pan left` by itself; `Reset view`, double-click, wheel zoom and drag all
still working and resyncing the buttons; the tRNA track caption and the axis
labels following the window; and a pinned gene with its detail, filters, colour
and checkboxes unchanged across pans, with no new hash field. Console and network
clean (0 messages, every request 200). Evidence is transient and lives outside the
repository under `/tmp/cyano-ui-unblocked-20261009/pan/`.

Not verified: no automated accessibility scan ran — the repository has no
`@axe-core/playwright` and adding one was out of scope. Keyboard, focus
visibility and accessible names were checked by hand in the render.

## Cleanup

The implementing session owns closure and records every remaining finding.
Distill the navigation step, boundary and accessibility rules into
[chromosome-view.md](../../validation/chromosome-view.md), update its validation
index row if needed, and follow the required resolved-ticket lifecycle.

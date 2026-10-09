# O_regulatory-feature-hit-targets__20261009 — Open

- **Scope:** Enlarge hover and click targets for initiation sites and regulatory features in both gene viewers.
- **Status:** open
- **Opened:** 2026-10-09
- **Updated:** 2026-10-09

## Current State

Opened by `cyano-ui-fixes` at the owner's request. Implementation is unassigned
and has not started. The owner reports that initiation-site and regulatory-feature
targets are too small to hover or click comfortably. Apply the improvement to
both the smaller gene viewer and the larger sequence close-up, including Tan
initiation sites, termination sites and other displayed regulatory annotations.

## Acceptance

- Add modest padding around the visible markers for hover and click detection.
  Keep biological coordinates and visible annotation extents accurate; interaction
  padding must not imply that a site spans additional bases.
- Keep the added tolerance useful across zoom levels and responsive layouts.
  Choose and record the padding after checking the real viewers.
- Hovering within the padded target activates the existing outline and source
  details; clicking selects the same feature. Avoid flicker at marker edges.
- Preserve access to nearby and overlapping features. Resolve competing targets
  predictably, retain existing evidence/overlap precedence, and do not let a
  padded target obscure adjacent sequence controls or intercept pan/zoom gestures.
- Hidden or out-of-window features must not leave active hit targets. Preserve
  keyboard inspection, touch selection where supported, and independent viewer
  state when the selected gene, upstream extent or marker visibility changes.

## Verification

Ticket-only intake; no UI behavior has changed. The reported interaction issue
has not been independently reproduced or repaired during intake.
Metadata, related-ticket links and the queue entry were checked. Repository
gates passed on 2026-10-09: 1,396 JavaScript tests; 938 Python tests and 36 subtests
with one skip; 119 contract checks with one declared skip. These checks validate
the intake baseline, not an implementation of this request.

Before closure, use the UI render skill on both viewers at mobile, tablet and
desktop widths. Check isolated and overlapping markers, both strands, multiple
zoom levels and sites near viewport edges. Exercise pointer positions inside the
new padding and immediately outside it; confirm tooltip/outline/selection identity,
keyboard access, hidden states and unaffected sequence navigation. Add focused
hit-testing regression coverage and run the gates in `AGENTS.md`.

## Cleanup

The implementing session owns closure and records every remaining finding.
Distill reusable hit-testing and overlap rules into the relevant viewer validation
documentation, update its index, and follow the required resolved-ticket lifecycle.

## Related work

- [Tan sites in the larger gene viewer](O_tan-sites-large-gene-viewer__20261009.md)
  covers whether admitted sites are visible and placeable; this ticket covers
  ease of interacting with displayed markers.
- [Regulatory methods](A_regulatory-methods-shortlist__20261008.md) retains the
  existing computed-tag, overlap and hover-outline decisions. This ticket adds
  no new predictions or evidence layers.

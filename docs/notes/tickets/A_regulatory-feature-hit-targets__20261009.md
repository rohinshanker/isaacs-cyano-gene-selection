# A_regulatory-feature-hit-targets__20261009 — Active

- **Scope:** Enlarge hover and click targets for initiation sites and regulatory features in both gene viewers.
- **Status:** active
- **Opened:** 2026-10-09
- **Updated:** 2026-10-09

## Current State

Owned by `cyano-ui-fixes` for implementation, integration and closure. Work started
2026-10-09 under the owner's request to complete unblocked tickets. The owner reports that initiation-site and regulatory-feature
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

Implemented by `codex-implementer` on 2026-10-09 for DEM-334; coordinator
integration and closure remain pending. Both gene viewers now separate visible
marker geometry from interaction geometry. Each marker receives 5 px of padding,
with padding between neighbouring features partitioned at their centre midpoint;
exact overlaps retain source-last SVG paint precedence. The invisible targets do
not change biological coordinates or visible extents, and the sequence target is
confined to the marker row so it does not intercept base/codon navigation. Start
and stop codons receive 5 units/px of vertical and outward-edge padding in both
viewers; their gene-facing edges remain exact so nearby bases keep their identity.

Focused regression tests cover isolated, neighbouring, exact-overlap, hidden and
focus states. Real-browser checks passed at 375×812, 768×1024, 960×900,
1240×900, 1280×800 and 1440×900 with no horizontal overflow, console error or
failed request. Pointer probes immediately inside and outside the padding
confirmed the correct hover/selection identity in both viewers. Keyboard paths
passed; padding-only hover and immediate-outside movement also passed for both
start and stop annotations in the small viewer and close-up cell/bar modes.
Touch tapping remains unverified because the available browser context
did not expose touch input.

Final repository gates passed after copying the canonical checkout's verified,
gitignored raw inputs into this isolated worktree: 1,402 JavaScript tests; 938
Python tests and 36 subtests with one skip; 119 contract checks with one declared
skip. No scientific source, coordinate, evidence row or admission changed.

Before closure, use the UI render skill on both viewers at mobile, tablet and
desktop widths. Check isolated and overlapping markers, both strands, multiple
zoom levels and sites near viewport edges. Exercise pointer positions inside the
new padding and immediately outside it; confirm tooltip/outline/selection identity,
keyboard access, hidden states and unaffected sequence navigation. Add focused
hit-testing regression coverage and run the gates in `AGENTS.md`.

## Cleanup

The coordinator owns closure and records every remaining finding.
Distill reusable hit-testing and overlap rules into the relevant viewer validation
documentation, update its index, and follow the required resolved-ticket lifecycle.

## Related work

- [Tan sites in the larger gene viewer](A_tan-sites-large-gene-viewer__20261009.md)
  covers whether admitted sites are visible and placeable; this ticket covers
  ease of interacting with displayed markers.
- [Regulatory methods](A_regulatory-methods-shortlist__20261008.md) retains the
  existing computed-tag, overlap and hover-outline decisions. This ticket adds
  no new predictions or evidence layers.

## Integration findings

- **HIT-2:** start/stop annotation padding and padding-only outlines were added
  in `aea4257` alongside the regulatory marker targets.
- **HIT-3:** the integrated render at `cd7e8ef` showed outlines but no hover
  details over standalone codon padding. The target now carries the visible
  annotation's exact hint text; the browser contract checks both details and
  dismissal in small-view and sequence cell/bar modes. Final review pending.

- **DEM-336-F1:** camera-action focus loss overlaps the Tan ticket; fixed by
  `f531145`, pending the final confirmation review.
- **DEM-336-F3:** a distant neighbour could consume a wide interval's padding.
  The helper now partitions by adjacent edges, preserving wide/nested intervals
  and exact-overlap precedence. Regression tests cover separated/near/overlapping
  intervals and invalid inputs. Final review pending.
- **DEM-336-F4:** browser checks falsely required horizontal padding in dense
  clusters. Checks now require visible-head containment and allow consumed padding
  only with overlapping neighbours; all five reported loci and zoom-out are checked.
  Final review pending.
- **DEM-336-F5:** marker targets had no automated padding-only interaction check.
  The browser contract now checks exact hints, outlines, dismissal, target focus
  and preserved codon selection for both viewers. Final review pending.

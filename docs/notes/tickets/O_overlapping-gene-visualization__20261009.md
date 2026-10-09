# O_overlapping-gene-visualization__20261009 — Open

- **Scope:** Visualize overlapping genes in the chromosome, expanded gene viewer and smaller gene viewer, with an OG tag usable for filtering and colouring.
- **Status:** open
- **Opened:** 2026-10-09
- **Updated:** 2026-10-09

## Current State

Opened by `cyano-ui-fixes` at the owner's request. Implementation is unassigned
and has not started. The owner requests full overlap visibility in the chromosome
and expanded gene viewer, a partial/compact representation in the smaller viewer,
and an **OG** (overlapping genes) tag that can also drive filtering and colouring.

Existing export and panel-design code reads `overlapsNeighbor`; its presence alone
does not establish complete overlap relationships or the requested UI. Audit its
producer, coverage and definition before reusing it. Reuse the chromosome model's
annotated CDS segments where applicable, rather than assuming every gene occupies
its entire bounding interval.

## Owner questions

Asked in chat on 2026-10-09; answers are pending. Recommendations below are
proposals, not owner decisions. Record answers here before implementing the
dependent overlap definition and compact-view design.

| ID | Question | Choices / recommendation | Decision |
| --- | --- | --- | --- |
| Q1 | Which annotated features count toward OG? | Protein-coding genes only initially (recommended), or all annotated genes including tRNA/rRNA. | Pending |
| Q2 | What counts as an overlap? | Any shared genomic base between actual annotated gene/CDS segments, on either strand (recommended); same-strand only; or an owner-specified minimum overlap length. | Pending |
| Q3 | How much should the smaller gene viewer show? | OG badge plus a compact overlap strip with partner names on hover/click (recommended); badge only linking to the expanded viewer; or all overlapping partner genes drawn directly. | Pending |

## Acceptance

- Establish one documented overlap definition from Q1/Q2 and apply it consistently
  across all views, tags, filters and colours. Use the selected organism's native
  annotation and same-replicon coordinate intersections; never join different
  strains/replicons or count a feature against itself.
- Preserve explicit partner identities, strand directions and shared intervals,
  including multiple partners and containment. Handle discontinuous and
  origin-crossing features from their actual segments, avoiding false overlaps
  introduced by a broad start/end envelope. Keep unavailable context distinct
  from a confirmed absence of overlap.
- **Chromosome:** make overlapping loci identifiable and inspectable without one
  gene hiding its partner. Expose partners and shared coordinates, retain strand
  information and provide a readable representation at both broad and close zoom.
- **Expanded gene viewer:** align overlapping partner genes with the selected
  gene on the same coordinate scale. Show directions, shared bases/intervals and
  partner names, with a clear way to inspect or navigate to a partner. Indicate
  partners extending beyond the displayed window.
- **Smaller gene viewer:** provide the compact/partial representation chosen in
  Q3 and a route to full overlap details without crowding sequence annotations.
- **OG tag:** explain the abbreviation and overlap rule. Offer OG-only,
  non-overlapping-only and unrestricted filtering, plus a categorical OG colour
  mode with a clear legend. The tag records genomic context and must not disappear
  merely because its partner is hidden by another filter. Keep the underlying
  overlap identity consistent with exports and existing panel-design consumers.
- Preserve gene pin/selection, other colouring choices, regulatory-site evidence
  and existing navigation. Keep dense overlaps keyboard/touch accessible and
  avoid recalculating relationships on every pointer movement or redraw.

## Verification

Ticket-only intake; no UI or overlap data has changed. Intake baseline gates on
2026-10-09 passed: 1,396 JavaScript tests; 938 Python tests and 36 subtests with
one skip; 119 contract checks with one declared skip. These results do not
validate an overlap implementation. Ticket metadata, local links and the queue
entry were checked.

Before closure, add deterministic tests for non-overlaps, endpoint/minimum-length
rules, both strands, containment, several partners, distinct replicons, split CDSs
and origin-crossing loci. Render all three views at mobile, tablet and desktop
widths with the UI render skill. Exercise dense overlaps, zoom/pan, partner
navigation, hidden partners, OG filters/colour legend, keyboard focus, touch and
unavailable data. Confirm consistent tags/counts and no console or performance
regressions, then run the gates in `AGENTS.md`.

## Cleanup

The implementing session owns closure, names the closer and records every
remaining finding. Distill the chosen overlap definition/data contract and viewer
interaction rules into `docs/validation/`, update its index, and follow the
required resolved-ticket lifecycle.

## Related work

- [Larger regulatory-feature hit targets](A_regulatory-feature-hit-targets__20261009.md)
  covers interaction tolerance; preserve access to nearby gene and site marks.
- [Chromosome left/right controls](../../validation/chromosome-view.md)
  covers navigation; overlap tracks must stay aligned with that viewport.

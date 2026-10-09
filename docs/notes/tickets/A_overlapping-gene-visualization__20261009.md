# A_overlapping-gene-visualization__20261009 — Active

- **Scope:** Visualize overlapping genes in the chromosome, expanded gene viewer and smaller gene viewer, with an OG tag usable for filtering and colouring.
- **Status:** active
- **Opened:** 2026-10-09
- **Updated:** 2026-10-09

## Current State

Owned by `cyano-ui-fixes` (coordinator and closer). Implementation started on
2026-10-09 at the owner's request, after committing completed UI work and tickets.
Work runs in isolated worktrees; canonical baseline is `6235d1e`.
 The owner requests full overlap visibility in the chromosome
and expanded gene viewer, a partial/compact representation in the smaller viewer,
and an **OG** (overlapping genes) tag that can also drive filtering and colouring.

Existing export and panel-design code reads `overlapsNeighbor`; its presence alone
does not establish complete overlap relationships or the requested UI. Audit its
producer, coverage and definition before reusing it. Reuse the chromosome model's
annotated CDS segments where applicable, rather than assuming every gene occupies
its entire bounding interval.

## Owner questions

Owner decisions recorded on 2026-10-09. All three questions are answered;
implementation can proceed with the definition and compact-view design below.

| ID | Question | Choices / recommendation | Decision |
| --- | --- | --- | --- |
| Q1 | Which annotated features count toward OG? | Protein-coding genes only initially (recommended), or all annotated genes including tRNA/rRNA. | All annotated genes, including tRNA/rRNA. |
| Q2 | What counts as an overlap? | Any shared genomic base between actual annotated gene/CDS segments, on either strand (recommended); same-strand only; or an owner-specified minimum overlap length. | Any shared genomic base between actual annotated gene/CDS segments, on either strand. |
| Q3 | How much should the smaller gene viewer show? | OG badge plus a compact overlap strip with partner names on hover/click (recommended); badge only linking to the expanded viewer; or all overlapping partner genes drawn directly. | OG badge plus a compact overlap strip with partner names on hover/click and explicit direction indicators. |

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

Implementation is in progress; no overlap feature is yet complete.
Ticket intake; no UI or overlap data had changed at intake. Intake baseline gates on
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

- [Larger regulatory-feature hit targets](../../validation/gene-sequence-closeup.md)
  covers interaction tolerance; preserve access to nearby gene and site marks.
- [Chromosome left/right controls](../../validation/chromosome-view.md)
  covers navigation; overlap tracks must stay aligned with that viewport.

## Implementation and open review findings

`cyano-ui-fixes` coordinates, integrates and closes this ticket. Multica
`DEM-337` (`claude-implementer`) owns the isolated implementation on
`agent/claude-implementer/dem-337`. The integration branch is
`work/overlapping-genes-integration-20261009`. Neither implementation nor closure
is complete. The independent native-annotation comparison agrees with all 3,121
pairs in the first generated payloads; final-patch validation is pending.

| Finding | State | Required resolution |
| --- | --- | --- |
| OG-F1 | open | Confirm native identity coverage explicitly before classifying an omitted gene as non-overlapping. |
| OG-F2 | open | Keep unavailable OG results distinct from the legacy adjacent-CDS flag in exports, panel design and active filters. |
| OG-F3 | open | Never classify an unrecorded partner strand as both strands. |
| OG-F4 | open | Label summed per-pair shared bases as pairwise; they can differ from distinct genomic bases. |
| OG-F5 | open | Clearing the overlap layer must clear joined per-gene state. |
| OG-F6 | open | Remove unsupported biological generalizations and distinguish added scan-only candidates from computational annotations already in the pinned release. |
| OG-UI1 | open | Fit expanded-view partner labels without accidental left-edge clipping; keep full identity accessible. |
| OG-UI2 | open | Keep the OG legend concise and put full coverage/definition in a disclosure; omit internal field-token wording from user copy. |
| OG-UI3 | open | Preserve meaningful keyboard focus after selecting an overlapping partner. |

Reproduction notes, independent comparison scripts and early rendered evidence
are under `/tmp/cyano-overlap-20261009/`; see `model-review-findings.md` and
`coordinator-review-cases.md`. These are working evidence, not final approval.
Record resolving commits for every row before closure and retain the reusable
contracts and regression checks in the repository.

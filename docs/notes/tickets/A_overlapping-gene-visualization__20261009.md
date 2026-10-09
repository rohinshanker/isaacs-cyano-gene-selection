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

## Implementation, 2026-10-09 (`claude-implementer`, DEM-337)

Delivered on `agent/claude-implementer/dem-337` from baseline `4518be8`. The
reusable contract is now
[docs/validation/gene-overlaps.md](../../validation/gene-overlaps.md); the
payload is in
[data-contract.md](../../validation/data-contract.md#overlapping-genes-and-what-overlapsneighbor-is-not).

**Audit of the old producer.** `scripts/build_features.py::add_context` writes
`overlapsNeighbor` from the gap to the two CDSs adjacent in coordinate order,
on each gene's bounding envelope. It is adjacency-only, coding-only,
envelope-based and carries no partner, so it misses 3 / 70 / 8 / 34 / 15
plotted loci per organism against the full annotation. It keeps its own meaning
and its own export column and is **never** used as the OG answer or as a
fallback for it.

**Layer.** `tools/build_gene_overlaps.py` builds `gene_overlaps.json` per
organism from that organism's pinned GFF3: every `gene`/`pseudogene` row with a
locus tag, extent from its annotated child segments (exons where present, the
gene row's own span only where the release gives no child), overlap = at least
one shared base on the same replicon on either strand, exact integer
arithmetic. It publishes `coveredGenes`, the inventory of every gene compared,
so zero partners is a measured absence for a named identity.

| organism | annotated genes | overlapping | pairs | pairwise shared bases | plotted CDSs tagged |
| --- | --- | --- | --- | --- | --- |
| utex2973 | 2,776 | 717 | 402 | 5,236 | 714 of 2,715 |
| ecoli-k12-mg1655 | 4,651 | 1,454 | 842 | 16,518 | 1,361 of 4,287 |
| ecoli-mds42-public-reference | 3,763 | 1,029 | 592 | 4,827 | 1,015 of 3,586 |
| ecoli-dh10b-public-reference | 4,590 | 1,316 | 761 | 6,629 | 1,255 of 4,227 |
| ecoli-syn61-delta3-ev5 | 3,808 | 926 | 524 | 3,789 | 896 of 3,549 |

No organism needs an unavailable state for missing input. `tools/validate_contract.py`
re-derives the whole relation from the pinned annotation independently of the
producer and agrees for all five.

**Views.** Chromosome: a dedicated overlap row per band with one block per
shared stretch, direction arrows at a readable zoom, a dark underline inside
each overlapping CDS's own bar, a `role="status"` readout naming both genes,
both partners outlined together, labelled Previous/Next overlap controls and
`O`/`Shift+O`. Expanded (sequence close-up): one aligned partner track per
partner on the strip's own coordinates, shared bases solid, direction arrows,
edge-continuation chevrons, and a Pin button per plotted partner. Compact
viewer: the OG badge, a reserved one-lane overlap strip with per-partner
direction arrows, and the complete partner list with an Open button per plotted
partner. OG colour mode with a five-class key, a three-state filter writing one
class-selection channel, and `og=` in the hash.

**Coordinator findings resolved.** OG-F1 (`coveredGenes` inventory, validated
against every plotted CDS), OG-F2 (no legacy fallback anywhere; the class
filter is suspended and says so while the layer is unread), OG-F3
(`overlap-strand-unrecorded` class), OG-F4 (`pairwiseSharedBases`, labelled),
OG-F5 (clearing the layer clears the joined gene fields), OG-F6 (no biological
generalisation; the "predicted" wording narrowed), OG-UI1 (`fitPartnerLabel`
plus a CSS specificity fix the browser verified at 54.2 px inside a 60 px
gutter), OG-UI2 (short rule in the key, full definition in the colour
explanation), OG-UI3 (focus handed back to a named region), OG-UI4 (a mark is a
pair, with a `key`; stepper controls reach every coincident pair).

## Verification

Final gates on `agent/claude-implementer/dem-337`, 2026-10-09: `npm test`
1,461 JavaScript tests; canonical `.venv/bin/python -m pytest -q` 957 tests and
46 subtests with one skip; `tools/validate_contract.py` 126 / 88 / 94 / 94 /
100 checks with one declared skip each over the five organisms;
`tools/build_gene_overlaps.py check` and `tools/build_data_manifest.py check`
clean for all five. Rendered against the real app served from this worktree at
375×812, 768×1024, 1280×800 and 1440×900 and across the 960 px and 1240 px
breakpoints: no horizontal overflow, no console message, no failed request.
Exercised: whole-genome and close zoom, pan, a one-base overlap, a tRNA partner
the map does not plot, an origin-crossing locus, the OG colour mode on three
organisms, all three filter states and a colour-key class selection, partner
navigation from both viewers including a partner the filters hide, keyboard
focus on the overlap marks, touch-pointer inspection of the row, the
Previous/Next overlap stepper over MG1655's coincident `b4793`/`b4455` and
`b4793`/`b4647` pairs, and the unavailable state served from a deployment with
no layer. Screenshots and snapshots are under
`/tmp/cyano-overlap-20261009/worker/dem-337-cyano-overlaps/`, outside Git.

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
| OG-UI4 | open | Distinguish coincident pairs by identity and make each reachable by keyboard and touch/click; MG1655 b4793/b4647 and b4793/b4455 share the same interval. |
| OG-UI5 | open | Describe the disabled scale generically for categorical colours; the OG mode must not be labelled Function category. |

Reproduction notes, independent comparison scripts and early rendered evidence
are under `/tmp/cyano-overlap-20261009/`; see `model-review-findings.md` and
`coordinator-review-cases.md`. These are working evidence, not final approval.
Record resolving commits for every row before closure and retain the reusable
contracts and regression checks in the repository.

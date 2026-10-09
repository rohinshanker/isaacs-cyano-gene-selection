# A_overlapping-gene-visualization__20261009 — Active

- **Scope:** Visualize overlapping genes in the chromosome, expanded gene viewer and smaller gene viewer, with an OG tag usable for filtering and colouring.
- **Status:** active
- **Opened:** 2026-10-09
- **Updated:** 2026-10-09

## Current State

Owned by `cyano-ui-fixes` (coordinator and closer). Implementation and
coordinator verification are complete in
`work/overlapping-genes-integration-20261009`, based on main `90d3f36`.
Independent review and deployment remain open; this ticket is not closed.
The owner has authorized pushing the accepted result to main.

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

## Verification

Coordinator gates: 1,461 JavaScript tests pass at `80130a8`; 958 Python tests
and 46 subtests pass with one declared skip at `1cf01c3`; all five organism
contracts pass (126 / 88 / 94 / 94 / 100 checks, one declared skip each).
The only subsequent runtime change is the categorical scale explanation in
`80130a8`, covered by the repeated JavaScript suite and fresh browser render.

Independent exhaustive native-GFF intersections agree with all 3,121 pairs
across 19,588 annotated loci. A separate 1,000-case finite-base oracle checks
the sweep; browser-index checks cover every plotted gene; geometry checks
cover 6,008 partner tracks. All five overlap builders and manifests check clean.

The real integrated application was rendered at 375×812, 768×1024, 1280×800,
1440×900 and both sides of the 960/1240 px breakpoints. Checks cover all three
viewers, five organisms, one-base overlaps, RNA/pseudogene partners, coincident
pairs, hidden partners, partner navigation and focus, filter/colour changes,
loading/unknown context, keyboard controls and actual mobile touch controls.
No unexpected console/page/request errors or horizontal page overflow occurred.
Manual screenshot and semantic inspection complements DOM/keyboard checks;
Chromium was used, with no automated accessibility audit or other browser run.
No visual regression baselines were added or changed.

Transient evidence is in `/tmp/cyano-overlap-20261009/final-ui/`, with gate and
independent-oracle reports in its parent directory. Reusable checks and native
fixtures are in [gene-overlaps.md](../../validation/gene-overlaps.md) and tests.

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

## Review findings and closure ownership

`cyano-ui-fixes` owns integration and closure; Multica `DEM-337` delivered the
isolated implementation, integrated as `fb4daa3`. Independent exact-patch review
is pending. No other session's tickets are included in this closure.

| Finding | Resolving commit | Resolution |
| --- | --- | --- |
| OG-F1 | `fb4daa3` | Explicit native identity inventory; omitted/uncovered identities stay unknown. |
| OG-F2 | `fb4daa3`, `8bc6956` | No legacy fallback; unavailable filter is suspended and says it is not applied. |
| OG-F3 | `fb4daa3` | Unrecorded strand has its own class, never an invented both-strands relation. |
| OG-F4 | `fb4daa3` | Summed shared bases are explicitly pairwise. |
| OG-F5 | `fb4daa3` | Clearing a layer clears joined per-gene state. |
| OG-F6 | `fb4daa3` | Removed unsupported biological generalizations and clarified native versus added scan-only annotations. |
| OG-UI1 | `fb4daa3` | Labels fit the expanded gutter with full accessible identity. |
| OG-UI2 | `fb4daa3` | Short legend plus full disclosure; removed internal field names from user text. |
| OG-UI3 | `fb4daa3` | Partner navigation restores focus to a named viewer region. |
| OG-UI4 | `fb4daa3` | Pair identity plus explicit keyboard/touch steppers reaches coincident pairs. |
| OG-UI5 | `80130a8` | Generic categorical-scale explanation also describes OG mode accurately. |
| OG-R1 | open | DEM-339 found Enter pins a stale overlap partner after arrow navigation; repair and exact-patch recheck in progress. |
| OG-R2 | open | DEM-339 found OG radio changes lose focus; repair and consecutive browser-key regression checks in progress. |
| OG-REVIEW | open | DEM-339 requested these two changes on `30f2c9e`; no other actionable findings in its bounded review. |

Before closure, record the reviewer result and named closer/date here, preserve
any new findings, then follow the resolved-ticket lifecycle. The permanent
contract is already distilled into `docs/validation/gene-overlaps.md` and
`data-contract.md`, with a validation index row.

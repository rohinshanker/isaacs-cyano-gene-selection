# A_neighbor-tss-coding-overlap__20261012 — Active

Scope: Filter, colour and visualize genes whose coding segments contain TSSs or RBSs associated with neighbouring genes, wherever admitted native-coordinate evidence exists.
Status: active
Opened: 2026-10-12
Updated: 2026-10-12

## Current State

Requested by the owner. Add a shared relationship between a source-associated
neighbouring-gene transcription start site (TSS) and each focal gene whose coding
segments contain that site's coordinate. Claimed by `cyano-regulatory-sites`
(Agent Deck `e6e54b6e-1791581192`) on 2026-10-12. Coordinator owns integration,
review, and closure. Implementation uses isolated worktrees from main
`f0509153281550e902b78e9270a8ddd0b19bc4b8`; other sessions are not interrupted.

Owner clarification: cover both RBSs and TSSs in both viewers, filters, and
colouring. Verify current coverage and explicitly disclose if only Tan 2018
TSSs are available. Do not invent RBS coordinates, conflate TSS with RBS, or
resume the held RBS Calculator work. Missing RBS evidence is unavailable,
not a negative site call. Reuse admitted native evidence; no new source admission
or cross-strain coordinate transfer is authorized by this ticket.

## Source boundary and assignments

Existing release evidence, checked 2026-10-12 at baseline `4c6a8b9`:

- UTEX `tss_evidence.json` carries 2,432 exact-current-locus gTSS records from
  Tan 2018 Table S1. The four condition layers retain one coordinate set;
  the legacy pooled score is a different metric and must not supply coordinates.
- `regulatory_tss.json` separately carries 2,333 aTSS/iTSS/nTSS rows with source
  associations, including unmapped and unassociated rows. Source associations
  are context, never proof of a regulatory edge. Table S8 potential targets do
  not become site ownership.
- `core/marker-layers.js` has an RBS interval representation, but no RBS dataset
  is declared in the six organism records. Its TIS vocabulary is not an RBS
  measurement. The RBS Calculator ticket and code dependency stay separate.
- Reuse [the admitted data contract](../../validation/data-contract.md#the-shared-marker-representation)
  and [Tan provenance](../../../data/expression/TAN2018_TSS_PROVENANCE.md).
  No new scientific source, measurement or transferred coordinate is admitted.

Multica DEM-387 implements in `work/neighbor-sites-impl-20261012`; DEM-388 is a
read-only inventory and independent coordinate oracle against the baseline.
Coordinator integrates in `work/neighbor-sites-20261012` and owns this ticket.
Implementation is integrated as `02050704c8e8fc68db25562c4863cfd8ee46bc7a`.
Cross-provider review DEM-389 is active against that exact commit; no closure
until its findings are reconciled.

## Requested behaviour

- **Filters:** allow all genes, genes with a neighbouring-gene TSS in their coding
  segments, or genes without such a recorded overlap. Compose with existing
  filters and distinguish unavailable evidence from a known empty result.
- **Color by:** add a corresponding neighbouring-gene TSS overlap option. The
  legend must distinguish recorded overlap, no recorded overlap and unavailable
  evidence; gene details expose the distinct-site count and contributing sites.
- **Chromosome viewer:** mark the exact overlapping TSS positions against the
  affected coding segments. Identify the TSS-associated neighbouring gene and
  the gene containing the site, with site strand and source provenance.
- **Gene viewer:** show the same sites within the focal gene's coding track in
  compact and expanded views. Support inspecting the site and navigating to its
  associated gene where that gene is selectable. Preserve readable targeting when
  multiple sites coincide or lie close together.

## Acceptance criteria

- Join only records with matching organism, native assembly and replicon. Test
  TSS anchors against the union of actual CDS segments, including boundary bases;
  gaps between split segments and upstream display padding do not count.
- Include both same- and opposite-strand associations, with strand labels
  relative to the focal gene. Handle reverse strands and circular-origin joins.
- Preserve the source's TSS-to-gene association. Do not assign ownership from
  coordinate proximity or silently restrict candidates to the closest plotted
  neighbour. A site associated only with the focal gene is not a neighbouring-
  gene TSS; retain all associations for multiply assigned sites. Report ambiguous
  or unassigned associations explicitly without inventing a neighbouring owner.
- Use admitted, coordinate-resolved site evidence. Define deduplication for
  repeated site/condition records while retaining their provenance and conditions.
  A point overlap does not establish a promoter footprint, expression effect or
  regulatory interaction; label the displayed relationship accordingly.
- Derive filter status, colour status, counts and viewer marks from one shared
  relationship. Hiding a neighbouring gene must not erase its site's overlap.
  Source selection, loading failures and organism changes must update or suspend
  all affected controls consistently; unknown evidence must never become zero.
- Preserve existing TSS visibility controls, self-associated TSS markers and OG
  gene-overlap controls. Follow existing reset and saved-state/share-link rules.

Related work: [native neighbouring genes](../../validation/gene-neighbours.md),
[overlapping genes](../../validation/gene-overlaps.md), and the separately owned
[Tan condition-selection contract](../../validation/data-contract.md). Preserve
the accepted four-condition source-selection semantics.

## Findings

- **NS-1 — open:** The initial rendered implementation counted 617 genes by
  treating regulatory rows with unmapped source locus IDs as known neighboring
  associations. Only exact mapped current associations enter this count;
  unresolved IDs remain inspectable context. Independent baseline oracle:
  805 site/focal relationships across 603 focal genes (gTSS 795/598; mapped
  non-gTSS 10/10; five focal genes shared). Repair guidance is recorded in DEM-387.

- **NS-2 — open:** Neighboring Tan markers bypass existing per-view TSS
  visibility. The all-hidden `mk` URL still produced 18 compact markers for
  `M744_RS01690`. Hide marks and their interaction targets consistently without
  changing evidence counts; offer visibility controls for neighbor-only sites.
- **NS-3 — open:** E. coli unavailable evidence currently instructs selection of
  a Tan source the organism does not offer. Distinguish undeclared evidence from
  UTEX source deselection in the shared reason.
- **NS-4 — open:** The neighboring-site scatter legend currently drops the
  existing shortlisted, pinned and filtered-out marker conventions. Preserve
  applicable conventions using the shared legend presentation.

- **NS-5 — open (validation):** The coincident-site browser fixture changes a
  manifest-pinned payload without updating its byte/hash entry, so the loader
  correctly rejects it. Supply consistent fixture metadata and keep unexpected
  request failures in the asserted diagnostic collector; scope exceptions only
  to the deliberate failure phase. Production integrity checks remain intact.

## Verification

Implementation gates at `0205070`: JavaScript 1,577 passed; Python 1,751 passed,
16 skipped and 51 subtests passed; UTEX contract 130 passed, zero failed, one
explicit spliced-CDS exemption. All six organism manifests, live metrics and
contracts pass; annotation verify/check, readiness and Tan extract reproduction
pass. No shipped data payloads changed.

Independent baseline oracle comparison matches every one of 805 site/focal/owner
relationships (802 distinct sites in 603 focal genes). Rendered checks cover both
compact mounts, expanded sequence, filters/colour/counts, all eight required
widths, all six organisms, shared-link reload and exported view/filter state.
Worker browser checks also cover conditions, hidden markers and owners, dense and
coincident sites, loading, failed source/retry and empty results. RNA browser
regression passes 32-case worker parity plus lifecycle and responsive checks.

NS-1 through NS-5 are candidate-fixed by `0205070`; independent review remains
open. Final review, publication and live-content checks remain pending.

## Cleanup

Remain active until implemented and independently reviewed. The owning session must account for
all open findings, preserve the reusable association/coordinate and display
contracts in docs/validation, then resolve and remove this ticket and its queue
row under the repository's closure rules.

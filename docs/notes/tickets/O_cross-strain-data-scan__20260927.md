# O_cross-strain-data-scan__20260927 — Open

- **Scope:** Scan the academic literature and public repositories for reliable
  *S. elongatus* data in the admitted sister-strain data types, build the approved
  PCC 6311 and PCC 7943 RefSeq crosswalk, decide how comparable-condition datasets
  combine across strains, extend the shipped gene viewer, and design the chromosome
  visualizer and dataset selectors that display them. Covers `docs/`, `data/`, and
  `site/`.
- **Status:** open
- **Opened:** 2026-09-27
- **Updated:** 2026-09-28

## Current state

The data contract admits PCC 6301, PCC 6311, PCC 7942, PCC 7943, and UTEX 3055 as
sister strains of UTEX 2973 for gene annotations, transcriptomics, proteomics,
ribosome occupancy, TIS, TSS, and TTS. See
[the sister-strain rules](../../validation/data-contract.md#sister-strains-admitted-for-utex-2973-data)
and [condition comparability](../../validation/data-contract.md#condition-comparability).
Nothing has been scanned or ingested against that widened scope yet. The site
currently ships one PCC 7942 abundance table, native Tan 2018 TSS evidence, borrowed
PCC 7942 essentiality, and computed sequence metrics.

The goal is larger than one more column. The site should bring many published
*S. elongatus* datasets into one coordinate system, so a scientist can look up a gene
and see what every study measured about it.

### Owner decisions recorded 2026-09-27

- **TDS was a misstatement and is withdrawn.** The intended type was TTS. No
  degradation or decay data type is admitted, and nothing should be scanned for one.
- **UTEX 3055 is admitted**, in a separate tier from the four PCC strains because its
  gene content genuinely differs.
- **The PCC 6311 and PCC 7943 RefSeq crosswalk is approved to build.**
- **Positional features feed a planned gene viewer.** A chromosome visualizer is
  also planned, intended to replace the gene PCA view rather than sit beside it. The
  owner corrected the earlier "plasmid visualizer" wording on 2026-09-27: the view
  is centred on the single chromosome, with the two plasmids as explicit secondary
  tracks; see section 5.
- **Condition thresholds are recorded with concrete numbers**, and pairs whose
  biological comparability stays uncertain go to the biological-decisions list for
  the owner to resolve rather than being decided here.

## Work

### Who does which step

Fixed 2026-09-28 in
[claude-science-handoff.md](../../validation/claude-science-handoff.md), which also
fixes the claims mechanism every gated step uses. In short: steps **2 and 3** are Claude
Science's, because their truth lives outside this repository and it has the archive
and literature reach to establish it — the four packages are specified in
[the offload ticket](O_claude-science-offload__20260927.md#work-packages). Steps
**1, 4, 5, and 6** are the in-repo coding agents', and none of them waits on the scan:
the crosswalk build is a pipeline job against pinned RefSeq releases, and the
chromosome tab and the selectors are UI work whose design decisions are already
recorded below. Sister-strain overlay *data* waits on step 2; the tab that will draw
it does not.

The crosswalk is the one step that gets a second pair of eyes: once built, Claude
Science re-derives the matched, unmatched, and ambiguous counts from the pinned
releases independently, in the same spirit as the two existing checkers that
deliberately do not share code with the pipeline.

### 1. Build the PCC 6311 and PCC 7943 crosswalk

**Dispatched 2026-09-28 as Multica DEM-147 (codex-implementer).** Releases to pin,
identified by Claude Science and to be re-verified against NCBI before pinning:
PCC 6311 `GCF_022984265.1`, release `GCF_022984265.1-RS_2025_12_2`; PCC 7943
`GCF_022984345.1`, release `GCF_022984345.1-RS_2025_12_2`. Both are
Chromosome-level assemblies, not Complete Genome, so an unmatched locus may be
assembly incompleteness rather than absence; the audit records that. The sweep
below found no functional-genomics deposit for either strain, so this crosswalk
unlocks nothing currently available: it is forward-looking infrastructure.

Approved. The pangenome workbook gives these two strains pangenome IDs, coordinates,
and strand but no NCBI locus column, so no source keyed by their own RefSeq tags can
join until this exists.

Follow the
[identifier-crosswalk contract](../../validation/annotation-release-readiness.md#identifier-crosswalk-contract):
pin each strain's RefSeq annotation release with its checksum, join on exact shared
protein sequence or accession, admit one mapping per locus, and preserve ambiguity
instead of resolving it. Report matched, unmatched, and ambiguous counts. Until a
strain's crosswalk passes, its sources stay unadmitted.

### 2. Scan

Search per data type across the six strains. Record every candidate, including
rejected ones, with strain, assay, conditions, replicate count, genome build, licence,
artifact identifier, and whether a per-gene table is downloadable.

| Data type | Where to look |
| --- | --- |
| Transcriptomics | GEO, SRA, ArrayExpress, ENA; the iModulon ELPRECISE300 compendium already ranked in the roadmap |
| Proteomics | PRIDE, PeptideAtlas, MassIVE, ProteomeXchange |
| Ribosome occupancy | GEO/SRA ribo-seq submissions; cyanobacterial ribosome-profiling papers |
| TIS | ribo-seq initiation variants, TIS-profiling papers |
| TSS | dRNA-seq and Cappable-seq studies; Tan 2018 already shipped |
| TTS | Term-seq and Rend-seq; GSE309256 already ranked in the roadmap |
| Annotations | RefSeq, UniProt, InterPro, GO, KEGG, CyanoBase successors |

Deliverable: a ranked candidate table appended to
[future-data-roadmap.md](../../validation/future-data-roadmap.md), following its
existing admission contract. Do not download anything whose reuse terms are
unverified.

#### Result, 2026-09-28

Package A returned and passed intake (recorded in the offload ticket). The 57
accepted candidates are in the
[package A candidate register](../../validation/future-data-roadmap.md#package-a-candidate-register-2026-09-28);
promotion to a ranked entry waits on packages B and C. Three findings change the
plan: ribosome occupancy, TIS, TSS, and TTS returned zero new candidates across all
six strains; PCC 6311, PCC 7943, and UTEX 3055 have no functional-genomics deposits
and contribute annotation only; UTEX 2973 has exactly one public deposit, Tan 2018,
already shipped. Every rejected row, kept so a later sweep does not re-raise it:

| Artifact | Assay | Reason |
| --- | --- | --- |
| GEO GSE104202; PMID 29239721 | ChIP-seq (not an admitted data … | ChIP-seq is not an admitted data type |
| GEO GSE106824; PMID 29241543 | transcriptomics (RNA-seq) | listed as an RNA-seq candidate, but all 12 samples are `library_strategy = ChIP-Seq`; treated as rejected pending the package correction |
| GEO GSE114693 | ChIP-seq (not an admitted data … | ChIP-seq is not an admitted data type |
| GEO GSE14225; PMID 19666549 | ChIP-seq (not an admitted data … | ChIP-seq is not an admitted data type |
| GEO GSE205444; PMID 35814646 | transcriptomics (RNA-seq) | shipped: PCC 7942 abundance table - recognised, not new |
| GEO GSE22468; PMID 21896749 | ChIP-seq (not an admitted data … | ChIP-seq is not an admitted data type |
| GEO GSE28430 | ChIP-seq (not an admitted data … | ChIP-seq is not an admitted data type |
| GEO GSE29264; PMID 21612627 | ChIP-seq (not an admitted data … | ChIP-seq is not an admitted data type |
| GEO GSE309256; PMID 41292882,42148773 | TTS (Term-seq/Rend-seq) | already ranked in future-data-roadmap |
| GEO GSE343576 | ChIP-seq (not an admitted data … | ChIP-seq is not an admitted data type |
| GEO GSE42542; PMID 23913328 | ChIP-seq (not an admitted data … | ChIP-seq is not an admitted data type |
| GEO GSE47015 | ChIP-seq (not an admitted data … | ChIP-seq is not an admitted data type |
| GEO GSE48901; PMID 24244001 | ChIP-seq (not an admitted data … | ChIP-seq is not an admitted data type |
| GEO GSE51093; PMID 24315105 | ChIP-seq (not an admitted data … | ChIP-seq is not an admitted data type |
| GEO GSE55637; PMID 26058805 | ChIP-seq (not an admitted data … | ChIP-seq is not an admitted data type |
| ENA PRJNA420395 / SRP125902; DOI 10.1186/s13068-018-1215-8 | TSS (dRNA-seq) + RNA-seq, prima… | already shipped as TAN2018_TSS - recognised, not new |
| RefSeq GCF_000817325.1 | annotation (RefSeq PGAP) | genome of record, already pinned |


### 3. Decide how datasets combine

The thresholds are now written down. This step applies them and reports the result.

- Score every candidate pair against each axis of
  [condition comparability](../../validation/data-contract.md#condition-comparability)
  and record the verdict with the failing axis where one fails.
- Choose and justify a normalization per data type. Within-source percentile or rank
  is the contract's default; a stronger calibration needs a validated cross-study
  model.
- Report the agreement statistic between overlapping datasets and show it in the
  interface. A poor fit is displayed, never averaged away.
- Add a pair whose comparability is genuinely uncertain to rows 13 through 15 of
  [AAA-biological-decisions-to-review.md](../../validation/AAA-biological-decisions-to-review.md)
  with its assay, both condition sets, and the marginal axis.
- Keep both source values where two strains disagree at one locus; any resolution is
  a separate `inferred` field naming its rule.

Raw per-source fields are never merged. A combined view is an additional layer with
its own inputs, method, and uncertainty.

### 4. Gene viewer — first version shipped 2026-09-27

Built and validated in the browser. It draws one gene in transcription orientation
in both side columns, from offsets against the annotated start rather than genomic
position, which is the frame sister-strain positional evidence has to arrive in. The
contract, the evidence boundaries, and the rendered checks are in
[controls-column-and-resets.md](../../validation/controls-column-and-resets.md).

Shipped: the coding span with each `cdsSegments` piece and the gap between them, the
initiation triplet and terminal stop as marks with a readable minimum width, native
Tan 2018 start sites at the distances that study published against its own gene
model, the splice and translational-exception flags, and a sentence-level accessible
description. Verified against the spliced `M744_RS00920` and the multi-site
`M744_RS08615`.

Still to build. The 2026-09-28 sweep found no ribosome-occupancy, TIS, TSS, or
TTS deposit for any admitted strain, so the first two items below are gated on data
that does not currently exist, not on this ticket's progress. Decision recorded
2026-09-28: the viewer states that absence explicitly in its evidence caveats rather
than leaving an empty track, and the overlay code is not built ahead of a source.

- sister-strain TSS, TIS, and TTS overlays, drawn as offsets against a named UTEX
  locus and labelled with strain, study, and condition, visibly transferred;
- ribosome occupancy as a positional track where a source supports one, and as a
  per-gene value otherwise;
- the flanking-neighbour context and the explicit [-30,60) start window, which the
  current version states numerically but does not draw as a separate band.

### 5. Chromosome visualizer

Owner correction, recorded 2026-09-27: this is a chromosome visualizer, not a
plasmid visualizer. UTEX 2973 has one distinct chromosome, `NZ_CP006471.1`, and the
owner's correction records that this one chromosome is present in multiple copies per
cell, as cyanobacterial polyploidy. Polyploidy is a copy-number property of the
single chromosome, not a set of distinct chromosomes, so it adds no second coordinate
system to draw. It does mean that every per-gene value on this view is per genome
copy and never a per-cell dosage. The copy number varies with growth condition, and
no source in this repository records it, so the view states none.

The [genome of record](../../validation/genome-provenance.md#genome-of-record)
has three sequences. The chromosome is 2,690,418 bp and carries 2,655 of the 2,715
plotted CDSs. The plasmids `NZ_CP006472.1` (46,366 bp) and `NZ_CP006473.1`
(7,842 bp) carry 54 and 6 plotted CDSs. The pangenome workbook labels those two
replicons `pANL-pMAL` and `pANS` in its `Chromosome` column and gives their UTEX
rows the separate `pgB` and `pgC` locus series (`UTEX2973_pgB001`,
`UTEX2973_pgC001`), so plasmid loci join by the same per-locus routes as
chromosomal ones.

### It is its own tab

Owner decision, recorded 2026-09-28. The chromosome view is a **separate
selectable tab in the existing tablist**, exactly as Native codon space, Metric X
vs Y, Lengths, Regulatory sites, and Citations & sources already are. It is not a
mode of the scatter map and not a panel in a side column.

The tablist is built from `ALL_TABS` in `site/js/app.js`, which is `PANELS` from
`site/js/ui/panels.js` followed by the standalone tabs. A tab that is not a
scatter projection follows the pattern the Lengths, Regulatory sites, and
Citations tabs already use, so this view is built the same way:

- export a frozen descriptor from its own module, with `id`, `name`, `blurb`, and
  `source`, as `LENGTH_TAB` in `site/js/ui/length-explorer.js` does;
- add it to `ALL_TABS`, and give it its own `role="tabpanel"` container in
  `site/index.html` beside `length-view`, `regulatory-view`, and `citations-view`;
- follow the active-tab branch in `renderCurrentView`, which sets the blurb from
  the descriptor and shows one panel at a time;
- take a layout class on the layout element if it needs a different column count,
  as `lengths-active` and `regulatory-active` do in `workspaceColumns` in
  `site/js/ui/workspace-resize.js`. Decide deliberately whether the gene detail
  column stays open beside it.

The tab id is what `p` in the URL hash carries, so a link opens straight onto this
view. Choosing an id means choosing that permanent URL token; `chromosome` is the
obvious one. Adding a tab needs no change to the encoder, because `p` already
accepts any id in `ALL_TABS` and falls back to `native` for an unknown one.

Because it is a tab rather than a replacement, shipping it does **not** by itself
retire the native codon-space PCA. That remains open question 4 and stays a
separate, explicit decision.

Design decisions, confirmed by the owner 2026-09-28 and **dispatched as Multica
DEM-148 (claude-implementer)** with rendered validation at three widths required:

- **Linear, not circular.** A 2.69 Mb chromosome cannot share one circle or one scale
  legibly with a 46 kb and a 7.8 kb plasmid, and a linear track zooms and shares its
  horizontal axis with the gene viewer. The origin is position 1 of `NZ_CP006471.1`.
  The two circular-origin CDSs, `M744_RS13290` and `M744_RS13620`, are drawn as their
  two `cds_segment` rows joined across the ends with a wrap marker, never as a span
  beyond the replicon length.
- **The chromosome is the primary track; the two plasmids are explicit secondary
  tracks.** Each plasmid is drawn beneath the chromosome at its own scale, labelled
  with accession, length, and plotted CDS count. Plasmid coordinates are never
  concatenated onto the chromosome axis, and the plasmid tracks are never hidden,
  because their 60 CDSs are part of the plotted set.
- **Same genes as every other view.** The dots are the same 2,715 CDSs; pinning,
  colour, filter, and selection state carry over under
  [viewer-interaction-state.md](../../validation/viewer-interaction-state.md). This is
  the whole-replicon map and the gene viewer in section 4 is the zoomed locus:
  selecting a CDS here opens it there. Metric X vs Y is unchanged.
- **Metrics and evidence layers.** Each CDS is a mark at its UTEX coordinate, above or
  below the axis by strand, coloured by the existing colour selector: the reviewed
  function category or any registered metric, such as CAI, tAI, ENC, GC3, rare-codon
  fraction, or expression percentile with its basis label, each keeping the evidence
  label it already carries. Borrowed PCC 7942 essentiality stays candidate evidence
  in the detail panel, as today. Operon membership from `operonId` is drawn as a
  bracket. Native Tan 2018 TSS features are measured on this assembly and may be
  placed at their absolute coordinates.
- **Sister-strain positional evidence arrives as gene-relative offsets.** Coordinates
  do not transfer between strains, so a TSS, TIS, or TTS from an admitted sister
  strain reaches this view only as an offset against a named UTEX locus, drawn
  anchored to that locus and labelled with strain, study, and condition. At
  chromosome scale it collapses to a mark on the gene; the offset detail belongs to
  the gene viewer. No sister-strain coordinate is ever placed on the axis directly. A
  missing sister-strain value, especially from UTEX 3055, renders as absent, never as
  zero.

Retiring the native codon-space PCA, whose scores are `codonPca` in `genes.json`
and whose loadings are `codon_pca.json` behind the "What drives these axes" table,
is a separate step now that this view is its own tab. It is a user-facing removal,
so confirm the intent before
deleting the view, its loadings table, the audit documentation
([pca-length-sensitivity.md](../../validation/pca-length-sensitivity.md)) and its
script `tools/audit_pca_length.py`, the validation index row, and the reference in
row 9 of
[AAA-biological-decisions-to-review.md](../../validation/AAA-biological-decisions-to-review.md).
The recoding-risk, perturbation, and UMAP maps are computed live and are outside this
decision unless the owner extends it.

### 6. Dataset and condition selectors

Requested behaviour:

- Where a metric has several conditions, a control at the bottom of the view selects
  among them. Low-light versus high-light proteome is the motivating case.
- The user can select a single paper's dataset to display.
- The user can select several at once when a defensible normalization exists, with a
  visible warning and the agreement statistic when they do not align well.

Still to design: placement at each breakpoint, URL-hash encoding, interaction with the
existing colour, axis, and filter selectors, and what happens to genes missing from
one selected dataset. Follow
[responsive-workspace.md](../../validation/responsive-workspace.md) and
[viewer-interaction-state.md](../../validation/viewer-interaction-state.md).

## Open questions for the lab

1. **Default view.** When several datasets cover one gene, does the site open on the
   native UTEX value, the newest, the best-replicated, or a combined estimate?
2. **Disagreement.** When two datasets in the same condition disagree sharply, does
   the site show both, show neither, or show both with the conflict flagged?
3. **Scope of the reference.** Is the audience the recoding-panel workflow this site
   was built for, or general *S. elongatus* lookup? The second implies genes and
   features outside the 2,715 screened CDSs, which is a schema change.
4. **PCA retirement.** The chromosome view ships as its own tab, so retiring the
   native codon-space PCA is now a separate decision rather than a consequence of
   building it. Confirm whether that PCA is removed once the chromosome tab exists,
   since that deletes a view and its audit trail, and state whether the live
   recoding-risk and perturbation PCA maps are also retired or stay.

## Verification

Not started. When work lands, each ingested source needs its manifest entry,
checksum, mapping audit with matched, unmatched, and ambiguous counts, contract tests,
and the sister-strain, condition-comparability, and UTEX 3055 coverage rows of
[AAA-manual-review-checklist.md](../../validation/AAA-manual-review-checklist.md)
checked against the rendered site. The gene viewer and chromosome visualizer are UI
work
and need rendered validation at mobile, tablet, and desktop widths, not source
inspection.

## Cleanup

On resolution, distil the crosswalk runbook, the per-type normalization defaults, the
positional-offset display contract, and the multi-dataset selector contract into
`docs/validation/`, update `validation/INDEX.md`, then delete this ticket and its
index row.

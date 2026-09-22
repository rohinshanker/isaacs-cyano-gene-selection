# Tan 2018 TSS and differential-transcription evidence

**This is not transcript abundance. Read the next section before using it.**

`tan2018_utex2973_tss_initiation.tsv` gives a transcription-start-site initiation
score for 1,727 of the 2,715 UTEX 2973 protein-coding genes, or 63.6 percent.

| Field | Value |
| --- | --- |
| Publication | Tan et al., 2018, doi:10.1186/s13068-018-1215-8 |
| BioProject | PRJNA420395 |
| Processed data | Figshare 5712016, CC BY 4.0 |
| **Organism measured** | ***S. elongatus* UTEX 2973 — the target strain** |
| Assay | dRNA-seq, transcription start site mapping |
| Conditions | Control 33 °C, 50 µmol photons m⁻² s⁻¹ continuous light, 3% CO2; plus high light 1,000 µmol (duration conflicts between Results and Methods); high temperature 45 °C for 30 min; dark for 2 h |
| Derivation | Per locus, the sum over its separately pinned Figshare TSS feature set of the arithmetic mean of the eight per-TSS sample count fields; this is not a sum over the Table S1 site list (see [Exact layer mismatch](#exact-layer-mismatch)) |
| Retrieved | 2026-09-18 |

The site also carries `tan2018_utex2973_tss_table_s1.tsv`, an exact-column
extraction of the 2,475 gene-associated TSS (`gTSS`) rows in the publisher's
[Additional file 1, Table S1](https://static-content.springer.com/esm/art%3A10.1186%2Fs13068-018-1215-8/MediaObjects/13068_2018_1215_MOESM1_ESM.xlsx).
The 3,339,692-byte XLSX has SHA-256
`098ecbd204cd1042a6edee1d2a500eaeca4efe034c503e2ade3db1c605e79b00`;
the extracted TSV has SHA-256
`d06524cf492aa8f009bf004c596a5d305ac54acbe7537ec98bbc7992ce164bff`.
The workbook is CC BY 4.0. Regenerate the TSV with
`python scripts/prepare_tan2018.py MOESM1.xlsx data/expression/tan2018_utex2973_tss_table_s1.tsv`.
The extraction retains each gTSS's published distance to the historical start
codon (`source_start_distance_nt`); it is not recomputed from the current gene
model.

Table S1 has two biological replicate cultures per condition: CT1/CT2 (control),
D1/D2 (dark), HL1/HL2 (high light), and HT1/HT2 (high temperature). The site's
gene detail keeps the eight **raw** TSS counts and the authors' DESeq2
`log2FoldChange`/`padj` for each of dark, high light, and high temperature versus
control. It does not calculate gene-level fold changes from raw counts, and a
missing DESeq2 result stays unknown. The separate biomass/glycogen Fig. 4 has
`n=3` and is not the transcriptomic replicate count. The paper's Results say
high-light exposure was 2 h, whereas its Methods specify 30 min; the source
contains that discrepancy, so condition labels here omit an asserted duration.
The authors' differential-transcript threshold is `|log2FC| ≥ 1` and adjusted
`p ≤ 0.01`; identified TSSs had at least 300 raw reads in one library. These
are source-selection and significance conventions, not a site's gene-level
expression call.

## What it measures, and what it does not

A TSS initiation score reflects **how much transcription initiates at a gene's start
sites**. It is not the amount of transcript present, which is what RNA-seq abundance
measures. The two differ whenever transcript stability, elongation, or processing
differ between genes.

The size of that difference is measurable here. Against the PCC 7942 abundance table we
also ship, across 1,666 genes present in both:

| Comparison | Spearman |
| --- | --- |
| Tan TSS initiation vs PCC 7942 abundance | **0.313** |

That is weak. These are different quantities, and substituting one for the other will
change which genes look highly expressed. Do not average them, and do not present them
in one column.

## Why gene-body abundance is not available

The study's raw reads are in PRJNA420395, but the processed coverage published on
Figshare is a 77 MB PDF visualisation, not a machine-readable track. Deriving true
per-gene abundance therefore requires downloading the raw reads and running an
alignment and quantification pipeline. That work has not been done.

Table S1 is a machine-readable **start-site count and differential-transcription**
table, not a gene-body coverage or abundance table. It does not alter that boundary.

## Coverage and what is missing

- 1,727 of 2,715 target genes carry a score. All locus tags validate against the
  current annotation, with no duplicates, no zeros, and no negative values.
- **988 target genes have no TSS association at all** and must render as unknown, never
  as zero. A gene with no mapped start site is not a gene with no transcription.
- The published annotation carries 2,670 protein-coding loci; 51 are absent from the
  current target set and 77 TSS locus mentions do not resolve, reflecting nine years of
  annotation revision between the 2017 model and the current one.
- Of 2,475 gTSS rows in Table S1, 2,432 map by exact historical locus tag to
  1,789 current genes. Ten rows have no direct locus identifier and 33 name a
  locus outside the current target set. The other 926 current genes have no
  mapped gTSS row. A gene can have several gTSSs (up to 20 in the current join);
  preserve them separately. Do not infer absence of transcription from an empty list.
  The ten non-locus rows remain unresolved even when a current gene symbol is
  unique: a name match is not a release-pinned historical locus crosswalk.
  Every mapped row agrees with its current gene's replicon and strand. Fifteen
  published gTSS positions fall inside the current CDS boundary in transcription
  direction; historical versus current start models and leaderless initiation
  make these coordinate relationships nontrivial. The site retains the published
  association but does not silently reinterpret those sites as upstream promoters.
  Of the 2,432 mapped rows, 236 belong to loci whose current start coordinate
  differs from the paper-era annotation. Review current boundaries before using
  any TSS-to-start spacing for construct design.

The older pooled score and Table S1 are distinct processed artifacts with distinct
selection and mapping rules, so their coverage differs (1,727 versus 1,789 genes).
The site does not fill a missing pooled score from Table S1 or infer a score by
averaging raw counts across conditions.

### Exact layer mismatch

The two browser layers use independent, exact membership rules; there is no
TSS-to-start distance window in either current join:

- `tssInitiation` is present only when the separately pinned pooled-score TSV has
  that current `M744_RS` locus tag. It contains 1,727 loci. The build performs an
  exact locus-tag lookup and does not create a value from Table S1.
- Mapped site evidence is present only when a gTSS row in the pinned Table S1
  extract names a syntactically valid current `M744_RS` locus tag that occurs in
  the 2,715-CDS site dataset. All such rows are retained, regardless of the
  published `source_start_distance_nt`; 2,432 rows map to 1,789 loci. No symbol,
  coordinate-nearest, or fuzzy join is used.

The overlap is 1,317 loci. Consequently, **472 loci have one or more exact-locus
Table S1 site rows but no pooled score**, while **410 have a pooled score but no
exact-locus Table S1 site row**. `M744_RS00030` is a site-only example: Table S1
maps `gTSS+5332` to it at a published start distance of 25 nt, but the pooled-score
TSV has no row. `M744_RS00010` is a score-only example: its pooled score is
164.375 (`Tan2018_dRNAseq_TSS_count_sum_1TSS`), but no Table S1 gTSS row maps to
that exact current locus tag. These examples demonstrate that the mismatch is not
explained by a shared distance cutoff. Until the lab chooses a reconciliation,
the site keeps the layers separate and labels the missing side explicitly.

`tests/test_tss_layer_mismatch.py` recomputes these sets from both pinned TSVs and
the committed browser data, asserts all five membership counts, and fails if the
joins or copies drift.

The workbook labels its eight sample fields `RawReads`, but 26 count values among
the mapped gTSS rows end in `.5`. The site preserves these published fractional
values rather than rounding them to whole reads; the publisher does not explain
their origin in Table S1, so no allocation mechanism is assumed.

## Non-gTSS regulatory evidence

`tan2018_utex2973_regulatory_tss_table_s1.tsv` is a separate extraction of all
2,333 non-gTSS rows in the same pinned Table S1 workbook: 1,380 antisense TSS
(`aTSS`), 724 internal TSS (`iTSS`), and 229 orphan/novel TSS (`nTSS`). It does
not duplicate any of the 2,475 gTSS rows. Each row retains the published
coordinate, strand, type, source locus association, eight raw replicate counts,
and the authors' three differential-statistic pairs. Blank source values and
blank differential results remain blank; they are not imputed or converted to
zero. The derived TSV has SHA-256
`98a19729bf47940bf6832e3f08c3548fc4ddc7bb866176ab70e9c92c7c8d3dbe`.

The mapping fields are an exact identifier join against the 2,715 CDS records in
the current `site/data/genes.json`; gene symbols, descriptions, coordinates, and
nearest-gene prose are never used to infer a match. All source rows remain in the
table, including failures:

| Mapping reason | Rows |
| --- | ---: |
| `exact_current_locus_id` | 2,068 |
| `source_locus_missing` | 180 |
| `source_locus_absent_from_current_cds` | 79 |
| `source_locus_not_current_id` | 6 |

Regenerate after obtaining the pinned workbook (the workbook itself remains
untracked):

```sh
python3 scripts/prepare_tan2018_regulatory.py \
  MOESM1.xlsx site/data/genes.json \
  data/expression/tan2018_utex2973_regulatory_tss_table_s1.tsv
python3 -m pytest tests/test_tan2018_regulatory.py
```

The browser's separate regulatory-sites view reads `site/data/regulatory_tss.json`.
It is a lossless JSON copy of this TSV's string fields, with source conditions
and checksums attached. Run `python3 tools/regulatory_tss.py write` after
regenerating the TSV; CI runs the corresponding `check` mode.

Table S8 in the same checked workbook lists 101 condition-specific antisense
site/potential-target pairs (77 dark, 21 high light, 3 high temperature) across
96 aTSS IDs. `tan2018_utex2973_asrna_potential_targets_table_s8.tsv` retains
the source TSS and target identifiers, strand, coordinates, author-provided
symbol/product, both reported log2 fold changes, and each comparison's
selection threshold. Its SHA-256 is
`0aa810d75f1e92200044ac445a7ba4ee90652a9d82d575040a803c9d66607a69`.
Regenerate with
`python3 scripts/prepare_tan2018_asrna_targets.py MOESM1.xlsx data/expression/tan2018_utex2973_regulatory_tss_table_s1.tsv data/expression/tan2018_utex2973_asrna_potential_targets_table_s8.tsv`.
The browser labels each as a **potential** target selected from opposite
transcript changes; no direct regulatory effect or current gene identity is
inferred from the author-era symbol or product.
Table S8 used opposite-sign aTSS and gTSS changes with magnitude at least
1.5 log2FC for dark and high light, but at least 1.0 for high temperature.

The source workbook contains a conflict at coordinate 320358. For
`aTSS-320358` under dark versus control, Table S1 reports log2FC
`8.61934317511037` while Table S8 reports `-4.78047469754605`; its Table S8
potential-target claim depends on the latter. The Table S8 value also equals
Table S1's value for opposite-strand `iTSS+320358`, whose raw counts rise from
control (0, 9) to dark (420, 422) despite its reported negative log2FC. This
pattern suggests an annotation or value swap, but that is an inference rather
than a source correction. Both sites receive a warning; all published values
remain intact and no gene-level effect is inferred. `tools/regulatory_tss.py`
pins the exact cross-table disagreement and both source cautions.

This is feature-level regulatory evidence, not a gene-level regulation call.
Multiple features may associate with one locus, and an association does not
justify collapsing counts or differential statistics across features.

## How it should be presented

As its own labelled axis, named for what it is, alongside rather than merged with the
PCC 7942 abundance overlay and the codon-adaptation proxy. `expressionBasis` per gene
tells the reader which of these they are looking at. The strain is right and the
conditions are documented, which the PCC data cannot claim; the quantity is indirect,
which the PCC data can.

## Other evidence in this release

This release does not include a verified UTEX 2973 Ribo-seq dataset. A 2025 UTEX
2973 RNA-seq paper, doi:10.1007/s10123-025-00715-x, states that no datasets were
generated or analysed and provides no usable accession. That bounded release
statement should not be read as proof that no relevant dataset can exist.

# Tan 2018 TSS and differential-transcription evidence

**This is not transcript abundance. Read the next section before using it.**

Five TSS-initiation layers ship, all declaring the `tss_initiation` quantity:

- four **condition layers** built from Table S1 (owner decision, 2026-10-12: "use
  the s1 table"), one per condition, each with 1,789 of the 2,715 UTEX 2973
  protein-coding genes; see [Condition layers](#condition-layers-table-s1);
- the **legacy pooled** `tan2018_utex2973_tss_initiation.tsv`, a score for 1,727
  genes (63.6 percent) whose site set was recovered, not documented; see
  [Pooled score audit](#pooled-score-audit). Its bytes are unchanged and it is
  not the average of the condition layers.

| Field | Value |
| --- | --- |
| Publication | Tan et al., 2018, doi:10.1186/s13068-018-1215-8 |
| BioProject | PRJNA420395 |
| Processed data | Figshare 5712016, CC BY 4.0 |
| **Organism measured** | ***S. elongatus* UTEX 2973 — the target strain** |
| Assay | dRNA-seq, transcription start site mapping |
| Conditions | Control 33 °C, 50 µmol photons m⁻² s⁻¹ continuous light, 3% CO2; plus high light 1,000 µmol (duration conflicts between Results and Methods); high temperature 45 °C for 30 min; dark for 2 h |
| Condition layers | Per gene, the sum over its exact-locus Table S1 gTSS rows of one condition's two-replicate mean, published fractions kept; built and checked by `tools/tan2018_condition_initiation.py` |
| Legacy pooled derivation | Per locus, the sum over its separately pinned Figshare TSS feature set of the arithmetic mean of the eight per-TSS sample count fields; this is not a sum over the Table S1 site list (see [Exact layer mismatch](#exact-layer-mismatch)). No script was committed; the rule recovered on 2026-10-12 is in [Pooled score audit](#pooled-score-audit) |
| Retrieved | 2026-09-18; Figshare archive and article re-retrieved 2026-10-12 |

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

## Condition layers (Table S1)

| Source id | Metric key | Replicates (Table S1 columns) | Group | File | SHA-256 |
| --- | --- | --- | --- | --- | --- |
| `TAN2018_TSS_CONTROL` | `tssInitiationControl` | `CT1_RawReads`, `CT2_RawReads` | `other` | `tan2018_utex2973_tss_initiation_control.tsv` | `1264631c1fd9f041082c970828cf2a3a40c87999b692601f6de8aa4d53b4eb65` |
| `TAN2018_TSS_DARK` | `tssInitiationDark` | `D1_RawReads`, `D2_RawReads` | `stress` | `tan2018_utex2973_tss_initiation_dark.tsv` | `330c4bd5536f1fa0740b8ccc7c80156b4e0a3710957b785ab093409ee4a0ee51` |
| `TAN2018_TSS_HIGH_LIGHT` | `tssInitiationHighLight` | `HL1_RawReads`, `HL2_RawReads` | `elevated` | `tan2018_utex2973_tss_initiation_high_light.tsv` | `e45a034a78ff42541ff334e2bd2a5929656e91fc091411daaf986a368e513e13` |
| `TAN2018_TSS_HIGH_TEMPERATURE` | `tssInitiationHighTemperature` | `HT1_RawReads`, `HT2_RawReads` | `stress` | `tan2018_utex2973_tss_initiation_high_temperature.tsv` | `92b865680c18388794a1636a3a8ffd7b66d0f8d1541c56dc35caac9233ae6816` |

**Derivation.** Input is the pinned gTSS extract above (2,475 rows), itself
re-extracted byte for byte from the pinned workbook by `verify-source`. A row
joins a gene only when its `Locus_tags` value is exactly a current `M744_RS`
locus tag: 2,432 rows join 1,789 genes; 33 name a locus absent from the current
CDS set and 10 carry a gene symbol, and all 43 stay unjoined. Per gene and
condition, the value is the sum over its joined rows of the mean of the
condition's two replicates, in exact arithmetic, written at six decimals. The
26 published `.5` counts are kept, so values may end in `.25`, `.5` or `.75`.
No distance window, coordinate condition, truncation or file-order rule is
applied; none of the legacy pool's recovered rule carries over.

**Zero versus unknown.** A gene with joined rows whose counts are all zero would
score `0.000000`; none does today, though three dark rows and one high-light row
are zero. The 926 genes with no joined row have no table row and are `null` in
`expression_layers.json`, never zero.

**Each table** is `locus_tag`, `abundance` (the quantity's pinned column name),
and `source_gene_id`, the joined Table S1 TSS ids in position order, `;`-separated.
Rows are sorted by locus tag, lines end in LF.

| Gene | Table S1 gTSS rows | Control | Dark | High light | High temp. |
| --- | --- | ---: | ---: | ---: | ---: |
| `M744_RS00030` | `gTSS+5332` (CT 635/764, D 148/177, HL 295/437, HT 703/320) | 699.5 | 162.5 | 366 | 511.5 |
| `M744_RS09190` | `gTSS+1828797`, `+1828807`, `+1828837` (HL 574.5/472.5 at the last) | 982 | 10.5 | 7,502 | 51.5 |
| `M744_RS00020` | `gTSS-4241` | 670 | 27 | 2,481.5 | 358 |
| `M744_RS00010` | none | unknown | unknown | unknown | unknown |

`M744_RS00030` has no legacy pooled score at all, and `M744_RS00025`'s four-layer
mean is 167.875 against a legacy 208.0; `M744_RS00020` agrees (884.125). Of
1,789 condition-layer genes and 1,727 legacy ones, 1,317 are shared.

**Conditions, quoted from the Methods** (PMC6091082, Strains and culture
conditions): control "subjected to standard (control) culture conditions
(33 °C, 50 μmol photons/m 2 /s constant illumination, 3% CO 2 aeration)"; the
treatments "(i) high light, 1000 μmol photons/m 2 /s for 30 min; (ii) high
temperature, 45 °C for 30 min; and (iii) darkness, no illumination for 2 h."
Two source conflicts are kept, not resolved: the Results say "transferred to
darkness or high light for 2 h", so the high-light duration is 30 min or 2 h;
and the Background calls the high-temperature condition "high light coupled with
high-temperature", which the Methods do not mention, so its light level is
recorded as conflicting. Control at 33 °C is outside the 28–32 °C standard range
and is grouped `other`.

**Source and licence.** The workbook is the publisher's Additional file 1,
<https://static-content.springer.com/esm/art%3A10.1186%2Fs13068-018-1215-8/MediaObjects/13068_2018_1215_MOESM1_ESM.xlsx>,
re-retrieved 2026-10-12 (3,339,692 bytes, SHA-256 `098ecbd2…5e79b00`, HTTP
`last-modified` 2022-06-21, ETag `a89eea95493414a204af355eaa2fe73d`). Its `Table S1`
header row is pinned in full, including the eight `<replicate>_RawReads` columns.
The article (pinned above) states: "Open Access This article is distributed
under the terms of the Creative Commons Attribution 4.0 International License"
and "The Creative Commons Public Domain Dedication waiver
( http://creativecommons.org/publicdomain/zero/1.0/ ) applies to the data made
available in this article, unless otherwise stated." The layers carry the
stricter CC BY 4.0 attribution; `verify-source` re-matches both lines.

```sh
.venv/bin/python tools/tan2018_pooled_audit.py fetch                 # article (and archive)
.venv/bin/python tools/tan2018_condition_initiation.py fetch         # workbook into data/interim/expression/tan2018/
.venv/bin/python tools/tan2018_condition_initiation.py verify-source # workbook checksum, header, re-extraction; licence lines
.venv/bin/python tools/tan2018_condition_initiation.py write         # the four tables
.venv/bin/python tools/tan2018_condition_initiation.py check         # rebuild equals the tables and sources.json checksums
.venv/bin/python tools/tan2018_condition_initiation.py summary       # the counts above
.venv/bin/python -m pytest tests/test_tan2018_condition_initiation.py
```

`check`, `summary` and the tests need only committed files; the workbook and
article tests skip until fetched.

## Pooled score audit

The pooled table was committed on 2026-09-18 (commit `615ed16`) with this
document and no script. It is, byte for byte, the TSV the DEM-33 agent attached
that day (SHA-256 `c3e1b6bac26ff80db7d16c00f38e227407d6fd4debaa4f41a7fb1cc0fd607fd9`,
every line CRLF); commit `e5122f9` later rewrote only its header line ending.
The only documented derivation is that run's sentence: sum the eight-count means
"across TSS features whose published feature text names that locus". Read
literally, that names 2,213 current loci and matches 1,196 of the 1,727 values,
so it does not reproduce the table.

`tools/tan2018_pooled_audit.py` recovers the actual feature set from the
authors' archive. The rule below is **inferred, not documented**: it has no tuned
numeric parameter and rebuilds the committed table byte for byte (SHA-256
`5ebd8043e70309a2ea04fcec37e475069cb8540397f9d052bd246401aa6325be`, LF header and
CRLF rows included), including every row's `_<n>TSS` site count, which is an
independent check on membership. Its position condition gives exactly the same
membership as a single pass through each GenBank file that resolves a named
locus only once that locus's `gene` feature has been read, which is the likely
mechanism; a test pins that equivalence. Neither reading is the authors'
association, and no surviving script or transcript of the DEM-33 run shows which
one ran. Simpler candidates fail: gTSS sites alone match 431 values.

| Input | Value |
| --- | --- |
| Archive | Figshare 5712016 file 10060636, `Supplymentary_Dataset_2.tar.gz`, <https://ndownloader.figshare.com/files/10060636>, retrieved 2026-10-12 |
| Archive bytes and checksums | 1,679,986 bytes; MD5 `ff227555b1a28dbbd974a83d549e16b5`, equal to Figshare's supplied and computed MD5; SHA-256 `6de018947f165acb99f01deb7628a52cd89f0f34ca07d3286b25dbfef780a0e8` |
| Members | `Supplymentary_Dataset_2/UTEX2973_genome_with_TSS.gbk`, 9,114,585 bytes, SHA-256 `407d960f4d417c58f975bce6d47a3ddc47689970f92aec050d7295bab0eccc80`; `Supplymentary_Dataset_2/UTEX2973_CP006472_with_TSS.gbk`, 155,175 bytes, SHA-256 `02d9493a317f88d202c9ca9363985fbb1b4bd866e46b83ead521b5caf5d7fa63` |
| Archive licence | Figshare record `license`: CC BY 4.0, <https://creativecommons.org/licenses/by/4.0/> |
| Article | Europe PMC `PMC6091082/fullTextXML`, 190,589 bytes, SHA-256 `7063969b6577a330390269bec64df5f22c696203239257cb06fc21ef5148f7d8`, retrieved 2026-10-12; licence block: "Open Access This article is distributed under the terms of the Creative Commons Attribution 4.0 International License" |

**Sample fields.** The archive's 4,827 TSS features carry eight counts named only
`tSSCount_Sample_0` to `_7`. Matched to the pinned Table S1 extracts by type,
strand and position, 4,805 features have a Table S1 row, and in every one all
eight counts equal Table S1's `<replicate>_RawReads` columns in this order:

| Archive field | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Table S1 replicate | CT1 | CT2 | D1 | D2 | HL1 | HL2 | HT1 | HT2 |

No other pairing matched more than 48 times. Twenty-two archive features have no
Table S1 row and three Table S1 rows have no archive feature. Every audit run
re-checks the order and the 4,805 count.

**The recovered rule.**

- A site belongs to every `M744_RS` locus its `/score` sentence names, when that
  locus is a `gene` feature with `gene_biotype="protein_coding"` in the same
  GenBank file, is in the current 2,715-gene target set, and the site's position
  is at or after the gene's lowest coordinate, on either strand.
- Each published count is truncated to a whole number.
- A locus scores the sum over its sites of the eight-count mean.

**What the rule does, and why it matters.**

- **It is strand-asymmetric.** An upstream gTSS of a reverse-strand gene lies
  above the gene's coordinates and is kept; one of a forward-strand gene lies
  below and is dropped. Of the named site–locus pairs it drops, 1,286 are
  forward-strand gTSS, 145 forward-strand nTSS, 42 forward-strand aTSS, 32
  reverse-strand aTSS and 19 reverse-strand nTSS (1,524). It keeps 1,113
  reverse-strand gTSS pairs and only 26 forward-strand ones, those at or inside
  the start. 1,008 current genes lose at least one named site and 486 lose every
  one, so have no score. This is not a biological selection. The owner chose
  Table S1 for new condition layers; retain this recovered legacy score only
  for explicitly labelled historical analyses, never as the fresh default.
- **It truncates.** 137 published count fields are fractional (`.5`, `.33`, …).
  Twelve pooled values sit below the sum of the printed counts, by 0.0625 to
  3.28: `M744_RS02730`, `03145`, `03175`, `05310`, `09190`, `09455`, `10840`,
  `10895`, `10920`, `11690`, `12905` and `13455`. `M744_RS03175` scores 256.125
  from one nTSS whose printed counts give 256.25 (442.5 and 629.5 lose their
  halves).
- Pseudogenes earn no score, nor does the origin-spanning plasmid gene
  `M744_RS13290`, whose `gene` feature has no `gene_biotype`. Of the 2,670
  paper-era protein-coding genes, 51 are not current targets. 85 site mentions
  name a locus that is not paper-era protein-coding and 60 one that is not a
  current target; the earlier figure of 77 unresolved mentions was not
  reproduced and its definition is unknown. A site naming two eligible loci
  counts for both.

**Examples against the Table S1 gTSS rows.** Summing the eight-count mean over
each gene's exact-locus Table S1 gTSS rows gives 1,789 genes; 1,317 are shared
with the pooled table and 431 of those carry the same value.

| Gene | Strand | Pooled score | Pooled site set | Table S1 gTSS sum |
| --- | --- | ---: | --- | ---: |
| `M744_RS00010` | + | 164.375 | one iTSS | none |
| `M744_RS00015` | + | 843.75 | its gTSS at the start codon | 843.75 |
| `M744_RS00020` | − | 884.125 | its gTSS 26 nt upstream | 884.125 |
| `M744_RS00025` | + | 208.0 | one antisense aTSS; its gTSS 46 nt upstream dropped | 167.875 |
| `M744_RS00030` | + | none | its gTSS 25 nt upstream dropped | 434.875 |
| `M744_RS09190` | + | 3,308.625 | 19 iTSS and 2 aTSS, truncated; its 3 upstream gTSS dropped | 2,136.5 |

Reproduce with:

```sh
.venv/bin/python tools/tan2018_pooled_audit.py fetch    # archive and article into data/interim/expression/tan2018/
.venv/bin/python tools/tan2018_pooled_audit.py check    # fails unless the rule rebuilds the committed table
.venv/bin/python tools/tan2018_pooled_audit.py summary  # the counts above
.venv/bin/python -m pytest tests/test_tan2018_pooled_audit.py
```

Without the fetched archive the archive-backed tests skip. The same tests
re-match every article-sourced Tan condition quote in `sources.json` against the
pinned article text, element runs joined by spaces.

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

- In the legacy pooled layer, 1,727 of 2,715 target genes carry a score. All locus tags
  validate against the current annotation, with no duplicates, no zeros, and no negative
  values. In each condition layer 1,789 genes carry a value and 926 are unknown.
- **988 target genes have no legacy pooled score** and must render as unknown, never
  as zero. A gene with no mapped start site is not a gene with no transcription.
- The paper-era annotation carries 2,670 protein-coding loci; 51 are absent
  from the current target set. The verified site-mention denominators are
  recorded in the reconstruction audit above; a missing current target does
  not by itself establish the reason for an annotation difference.
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
averaging raw counts across conditions. The four condition layers use the same
exact join as the Table S1 site layer and so share its 1,789 genes; a test pins
each layer value to the sum of that gene's `tss_evidence.json` replicate means.

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

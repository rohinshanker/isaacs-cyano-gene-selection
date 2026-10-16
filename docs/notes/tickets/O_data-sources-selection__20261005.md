# O_data-sources-selection__20261005 — Open

- **Scope:** Build the Data Sources feature in the site: the section below
  "Color by", the data selection peek, the source-selection controls in the
  filters, the axes and the projection views, the structured condition records
  behind them, and the loading of each admitted dataset the window offers.
  Split out of step 6 of [O_cross-strain-data-scan__20260927](O_cross-strain-data-scan__20260927.md)
  on the owner's instruction of 2026-10-05. Covers `site/`, `scripts/`, `tools/`,
  `data/`, `tests/`, and `docs/validation/`.
- **Status:** open
- **Opened:** 2026-10-05
- **Updated:** 2026-10-16

## Current state

Owner decision, 2026-10-14 (D11): retain **PXD036717 proximity-label enrichment
ratios** and **PXD044412 metabolite–protein interaction measurements** as separate
evidence types. Neither is protein abundance, and neither is admitted by this
decision alone. The source-specific readers are now implemented; identifier,
condition and browser-admission checks remain. The owner has settled whether
these evidence types are wanted.

PXD044412 reader preparation is complete (cyano-regulatory-sites, 2026-10-16):
[the pinned analyzed-peptide reader](../../validation/pxd044412-peptides.md) uses
the paper-linked Figshare S3, which already supplies fold changes, adjusted
p-values and source significance labels. It streams all 391,900 rows across 42
comparison labels, preserves every source cell, and provides conservative
source-protein summaries without averaging fold changes. Ambiguous-only groups
are not evaluated, not negative. This supersedes the assumption that the seven
PRIDE intensity reports must be the reader input. S3's CC BY 4.0 terms are
separate from PRIDE's CC0. Remaining PXD044412 admission work: exact source-to-UTEX
identity validation, comparison/condition metadata, distinct interaction
presentation, citations and rendered validation. No PXD044412 browser values
are admitted by this reader.

Owner decisions, 2026-10-15 (D12): PXD036717 browser release requires a
reconstruction from raw LFQ intensities before admission; expose twelve
replicate comparisons plus optional averages within each of the four baits.
The bounded reader/reconstruction is complete; its reusable
[contract](../../validation/pxd036717-enrichment.md) pins the publisher workbook,
retains original cells/formulas and distinguishes reconstructed values from the
authors' imputed ratios. LFQ intensities are processed MaxQuant outputs, not raw
mass spectra. Complete-case means require all three valid ratios.

PXD-JOIN is complete (cyano-lit-unreach, 2026-10-15; independently reviewed
implementation `b890507`): the pinned exact join assigns
1,466 source rows and preserves all 159 exclusions, including eleven groups,
seven rows with two RefSeq identifier disagreements, and 84 rows without
RefSeq confirmation. No measurements change;
source evidence remains labelled PCC 7942. See the
[mapping contract](../../validation/pxd036717-enrichment.md#exact-identifier-mapping).

PXD036717 admission findings and handoff:

- **PXD-IDENT — evidence checks implemented; release policy settled 2026-10-16:** the reader
  exposes all six source samples’ peptide counts/coverage with cells, states and
  diagnostics. The supplementary methods require two unique peptides and two
  spectral counts, but mmc1 lacks spectral counts and includes 962 positive-LFQ
  entries with one unique peptide. No source row is discarded or labelled as
  passing identification. The owner selected reconstructed measurements with evidence flags
  for eventual browser release; full verification of the source identification
  rule is not required first. Counts below two and absent spectral counts are
  explicit flags, not automatic measurement exclusions or interaction calls. See the [identification contract](../../validation/pxd036717-enrichment.md#identification-evidence).
  Q31PP6/Q31NP5 remain excluded from UTEX assignment because the pinned UniProt
  and crosswalk RefSeq fields disagree; restoring them requires a recorded
  identity check. The same hold applies to 84 rows (35 accessions) without a
  UniProt RefSeq cross-reference: their source protein lengths also differ from
  the proposed UTEX targets. This does not block admission of other eligible rows.
- **PXD-CONDITION — implemented by cyano-lit-unreach, 2026-10-16:** source-pinned
  metadata and a tested builder produce twelve separate comparison records and
  four optional within-bait mean records. Cultivation and labeling remain
  distinct; unknown harvest phase and sample-specific IPTG details remain unknown.
  The raw-file `__IPTG` marker has no explicit +/− sign and is retained without
  inferring induction. One three-file control set is listed for four bait analyses;
  repeated workbook controls are not treated as independent biological controls.
  The supplementary/PRIDE “both” versus workbook/article three-replicate
  discrepancy is retained explicitly. See the [condition contract](../../validation/pxd036717-enrichment.md#condition-records).
- **PXD-RELEASE:** separate enrichment quantity, twelve replicate layers plus
  four optional complete-case means, original/reconstruction provenance,
  source-specific citation/terms and rendered validation. No PXD036717 browser
  values have been admitted by the reader work.
- **PXD-DETECTION (implementation open; owner decision settled 2026-10-15):**
  show a separate detection category alongside numeric ratios. Preserve
  bait-only/control-only/neither states; a missing numerical ratio is not
  absence of evidence. There are 784 bait-only comparisons, and
  101 of 107 author-selected three-replicate bait/protein entries lack a
  complete non-imputed mean. The reader preserves these states explicitly;
  this category concerns browser presentation, not imputation or new interactor
  calls. Ratios remain missing when either intensity is missing; detection does
  not claim a confirmed interaction. Decision recorded by cyano-lit-unreach.

The existing-report portion of S6 is implemented and independently reviewed by
`cyano-ui-fixes`; its [browser contract](../../validation/expression-agreement.md#browser-presentation)
covers level/response agreement, empirical sample ranges, provenance and explicit
coverage gaps. Further admission and statistical work remain in this parent ticket.

Design settled by the owner in three rounds on 2026-10-04 and 2026-10-05; the
decisions are listed below and the second-round requirements are recorded in the
scan ticket under step 6. A working prototype with every requested behaviour is
`docs/notes/handoff/cyano_dataset_panel_mockup_v2_20261005.html`, rendered and
exercised at four widths. The two sentences that follow were written on
2026-10-05, when the site shipped values for two sources only (the GSE205444
PCC 7942 abundance table and Tan 2018 initiation) and the prototype's 59
condition sets were descriptions rather than loaded values; both have been
overtaken by S5, and the measured current counts are under "Shipped sources,
measured 2026-10-12" below. Built in the main checkout on `main`, by owner
instruction, and pushed when ready; no interim version with placeholder rows is
shipped.

### Owner decisions that fix the design

1. **Placement.** A "Data Sources" section directly below "Color by", listing the
   selected sources, with a hide control and a "Change Data Selection" button that
   opens a centre peek. The page behind the peek is dimmed and inert.
2. **Where a source is chosen.** Each place that reads a dataset has its own
   control. The filters section gets a toggle "Use same source as colouring", on by
   default; off, it shows a "Select source" button that opens the peek. The PCA and
   UMAP views show the control where they read a source. On the axes, a metric
   with several sources gets a per-axis source choice.
3. **The peek.** Tabs for transcriptomics, proteomics and fitness screens are
   always available; the opening tab follows the map's current metric. Array
   datasets are listed apart from RNA-seq by default with an option to include
   them, and an array row says it covers only chosen targets. Groups come from the
   condition record; inside a group, each comparable set is a subgroup with a
   select-all box, sets with no partner sit under one heading without one, and
   the top-level "Other" group has no select-all box either. A group that would
   split into one subgroup shows none.
4. **Comparability for subgrouping.** An axis only one side reports does not keep
   two sets apart; at least three axes must be shared; treatment tags must match;
   the owner's pair judgements override in both directions, a conditional one only
   where its condition can be checked. The turbidostat series GSE18902, GSE50908,
   GSE50919 and GSE52486 pass on the spectrum axis; passing does not merge
   anything, because a shared layer still needs a recorded judgement.
5. **Rows.** Selection is per condition set. Rows of one study share a highlight
   colour, and a legend at the foot of the list maps each colour to its paper.
   Every row has tick marks on its condition tracks aligned with one labelled
   header axis, a linear CO₂ scale from 0 to 5.5%, and an info button opening each
   condition as the paper reports it, with quote, location, replicates, per-gene
   table, and a linked citation.
6. **Filters.** Custom filters on condition ranges, strain, platform, light
   regime, medium, treatment and study text, beside the groups, with a flat-table
   view and "Select all shown".
7. **Explanations** go behind a help icon with a popover, or a peek for longer
   text; no standing explanatory lines.

### Assumptions still put to the owner

- "No stopgap needed" is read as: the window lists only sources whose values are
  loaded, and the feature is pushed when it works for those; loading more
  datasets continues under this ticket afterwards.
- The owner's sentence on the turbidostat series ended with "if this would lead
  to them being merged, then"; it is read as "ask first". Nothing merges without
  a recorded judgement, so no merge follows.

### Progress, 2026-10-05

Stages S1 to S4 are built for the two shipped sources and committed on `main`:

- Every entry of `data/expression/sources.json` carries a structured condition
  `record`, validated by `scripts/condition_record.py` in the pipeline and
  re-checked independently by the contract validator; `meta.expressionSources`
  carries it to the site. The pipeline rebuild left `genes.json` byte-identical.
- `core/data-sources.js` arranges datasets: groups, complete-linkage comparable
  sets with the owner's judgements, filters, the default selection, study colours.
- `ui/data-sources.js` renders the section under "Colour by" and the peek; the
  page behind is inert while it is open, focus is trapped and returned.
- `app.js` scopes the colour, axis and filter menus to the selected sources, falls
  back when a chosen metric is deselected, encodes `ds` in the link only when
  the selection differs from the default, records the selection in exports,
  shows a per-axis source select when an axis metric's data type has several
  selected sources, and gives the filters the "Use same source as colouring"
  toggle with a "Select source" button that opens the peek in single-choice mode.
- Rendered at 375, 768, 1280 and 1440 px with the peek open and closed, no
  horizontal overflow, focus returning to the button, console clean.

S5, first pass (2026-10-05): `tools/ingest_expression.py` (tested in
`tests/test_ingest_expression.py`) turns a spec in `data/expression/ingest/` into
one layer per condition set: checksum-pinned download, per-sample CPM or
as-deposited values, replicate means, one-to-one PCC 7942 → UTEX 2973 mapping
through the pinned crosswalk, the condition record with the Package B quotes, and
a `citationId` into the ledger. Eleven layers from GSE288532, GSE222067,
GSE327989, GSE79726 and GSE89999 ship (`data/expression/INGESTED_SOURCES.md`);
`citations.json` carries the five studies; metric help derives each layer's
method and citation from its `ingest` block. Rendered with 13 condition sets:
five groups, two comparable subgroups under Diel and one under Standard, the
seven-study legend, colour and filter menus scoped to the five default sources.
GSE104203 followed on 2026-10-06 as four layers (Low Light, Clear Day, High
Light pulse, Shade pulse; Package B rows 9 to 12), which needed the tool to read
replicate sheets side by side, to name repeated columns by the block title above
them (two title rows, the first that has one winning), and to let a layer carry
its own condition record and table row; the deposit's log2-ratio blocks are not
abundances and are left out. PXD062851 followed the same day as the first
proteomics layer (one DIA layer over twenty runs, Package B row 77), which
needed a `zipMember` reader and a `uniprot_pcc7942` identifier route: UniProt
accession to PCC 7942 ordered-locus name through a pinned UniProt table
(`data/expression/ingest/uniprot_pcc7942_orf_names.tsv`, CC BY 4.0), then the
old-locus-tag crosswalk, one-to-one at both steps. PXD030282 (Li et al. 2022,
Package B row 73) followed on 2026-10-06 as two label-free spectral-count
layers of the limonene-producing L1118 strain, log and stationary phase, under
Engineered strain; its deposit is DTASelect search output, not a table, so the
tool gained a `dtaselect` reader (one count column per report, accession from
the UniProt FASTA locus, decoys dropped; 576 and 703 genes). Its other archive
(L1118 against Lsps) holds only `.sepr` search-engine state and is not
readable. Twenty-nine sources shipped as of that date; the current count is in
"Shipped sources, measured 2026-10-12" below. Still waiting: PXD019731 and
PXD074299 deposit no proteome-wide table; GSE45762 is excluded for
contradictory sample labels.

The pair judgements are a data file since 2026-10-06
(`data/expression/pair_judgements.json`, 33 pairs since J2 on 2026-10-06, emitted as
`meta.pairJudgements` and validated on both sides); none of the judged pairs yet
has both sides ingested, so the shipped comparable sets are still the
thresholds', and the judgements take effect as those studies land. The eleven
ingested layers ship apart from `genes.json` in `expression_layers.json`
(per-dataset loading, tier 3), and the comparison and designer read the scoped
registry.

Not yet done: S1's five gaps are confirmed only where the feature needed them
(the menus scope; the provenance list and export caveats still read the legacy
single source); the chromosome tab's own colour row has no Data Sources
section; the rest of S5 (GSE104203, the CC0 proteomes) and S6.

## Design round 4, owner, 2026-10-06

1. **Colour by lists data types, not conditions.** The Expression family offers
   the kind of data (transcript abundance by RNA-seq, by array, protein
   abundance, …), and the Data Sources section chooses which dataset informs
   that metric; a filter likewise names the type and takes its source there.
2. **Collapsed at the start.** The Data Sources section opens closed.
3. **Hidden when irrelevant.** When the colouring metric has no data selection
   behind it (GC3, CAI, a live metric), the section is not shown.
4. **Annotation sources belong to it.** For Function category, the UTEX 2973,
   PCC 7942 and GO IEA toggles are data sources: they move into the opened
   Data Sources section, directly below "Function category explained".
5. **Type size.** The section's text is a different size from its neighbours;
   match it.

Done 2026-10-06 for 2 to 5: the section opens closed; it is shown only while
the colouring metric has a data selection behind it (a dataset metric, or
function category); under function category it holds the organism's
annotation-source toggles, directly below "Function category explanation", on
the map and on the chromosome tab (which has its own section), and the legend no
longer draws them; its summary and body match the help disclosure's type sizes.
Rendered at 375 and 1280 px.

Done 2026-10-06 for 1: `site/js/core/type-metrics.js` collapses the datasets
into type metrics (`type.<dataType>.<platform>.<kind>`), each reading the
dataset that informs it; the selectors offer the types and never a dataset's
own metric; the informing dataset is chosen by a radio in the section, on the
axis source select, or through the filters' Select source peek, and rides in
the link as `src=`; a link naming a dataset's own metric adopts into its type
with that dataset informing it (the colour wins over a filter of the same
type). Rendered at 1280 px: the Expression group lists two types, the radio
switch rewrote the legend's unit and the scale, the axis select and the Select
source peek both set `src=`, console clean; at 375 px the opened section with
radios keeps to the column. Still shown as its own entry: "Expression percentile
(PCC 7942)", a derived rank tied to GSE205444; whether it should become a rank
over the informing dataset is a follow-up.

## Design round 5, owner, 2026-10-06

1. **Pool.** Several selected datasets of one type show a pooled value; naming
   one dataset (radio, axis source select, Select source) is the override.
   Rule, since the deposits' units differ: an abundance pools as the mean of
   each dataset's within-dataset mid-rank percentile (unitless, 0 to 1); a
   fitness pools as the mean of the published log2 values, which share a scale.
   The legend, the help and the axis note state the rule as the unit. Done
   2026-10-06 (`site/js/core/type-metrics.js`, `contributingDatasets`).
2. **Engineered strains in their own group.** A dataset measured in a
   production, reporter or rescue strain is listed under "Engineered strain",
   before Other, and named as such; GSE288532 (cscB-sps) and GSE89999
   (clock-rescue) moved there, and PXD030282's two L1118 layers entered under
   it the same day. Done 2026-10-06.
3. **Fitness Browser**: proceed — read its terms, record a ledger decision, then
   ingest. Blocked 2026-10-06 by Cloudflare bot verification on every page the
   agents request; per the gated-pages ticket the owner opens the site in their
   own browser with the agent present, or supplies the terms text and the
   PCC 7942 fitness and experiment tables.
   Resolved: the owner's two tables are staged by hand and the compendium ships
   as 90 condition sets. This item is no longer blocked.

## Owner report, 2026-10-06, and design round 6

"The data sources for transcript initiation, abundance and protein abundance in
the working build do not have the proper data sources available; the fitness
metric category also does not appear." Cause: a type was offered only while a
dataset of it was selected, and the section listed only the selected datasets of
a type, so fitness (whose sets are all in the biofilm group, outside the default
selection) never appeared and most datasets were out of reach from the section.
Fixed the same day: every type the release has a dataset for is offered; asking
for a type with none of its datasets selected selects its defaults (shipped
originals and standard-growth sets, else all of the type); and the section
lists every dataset of the colouring type with an include checkbox, a pooled
row and "alone informs" radios, then the other selected datasets by data type.

Found later the same day, while verifying PXD030282 in the rendered build: the
section's relevance check knew only dataset metric keys, so colouring by any
type (which is all the colour menu offers for measured data) hid the whole
section even though its list was built; the deployed build from round 6 had
this. `dataTypeOfMetric` now resolves a type key to its datasets' data type,
with the panel test asserting a type key shows the section and a type with no
dataset hides it. Verified at 1280: Protein abundance shows "1 of 3", the two
L1118 layers listed under their engineered-strain chip, and naming one colours
the map with its spectral-count unit (576 genes valued).

## Shipped sources, measured 2026-10-12

Counted from `data/expression/sources.json` rather than from this ticket's
narrative, which had drifted: 164 layers over 27 studies, 162 of them carrying
an `ingest` block (GSE205444 and the Tan 2018 initiation source, PRJNA420395,
predate the tool).

| Data type | Layers |
| --- | --- |
| fitness | 99 |
| transcriptomics | 55 |
| proteomics | 10 |

Fitness is 90 Fitness Browser condition sets plus 9 GSE205443 biofilm
fractions, over 2 studies. Transcriptomics is 20 studies; proteomics is 5:
PXD000510 (4 layers), PXD005851 (2), PXD030282 (2), PXD005105 (1) and
PXD062851 (1).

This supersedes "Twenty-nine sources ship" above and design round 5 item 3:
the Fitness Browser is no longer blocked by Cloudflare, because its two tables
are staged by hand under the [fitness-source
contract](../../validation/fitness-screen-data.md) rather than fetched.

## Remaining admission shortlist, 2026-10-12

**No RNA-seq candidate remains.** Every row of the package B/C register that
deposits a per-gene table is ingested. The unshipped rows are each accounted
for, and none is waiting on this ticket: the seven microarray series now ship as 122 separate processed samples and
five optional summaries under the [array contract](../../validation/geo-array-reader.md);
GSE122841 is the [raw-read pilot](A_raw-read-pilot-execution__20261007.md);
GSE140121, GSE205445, GSE227397 and GSE50922 deposit raw files only;
GSE103606 is a SuperSeries container whose five RNA SubSeries all ship;
GSE106824 is ChIP-seq, which is not an admitted data type; GSE104204 is a
mixed 37-ChIP-seq/60-RNA-seq series escalated in package B; GSE45762 is
excluded for contradictory sample labels.

**The five undetermined PRIDE deposits are now determined.** The package A
register recorded their contents as "not determined — PRIDE per-project protein
listing is not served for classic PXD submissions", so none had been through
the three-step check in the [deposit-reader
contract](../../validation/proteomics-deposit-readers.md). Each file listing was
paged from the PRIDE v3 API
(`https://www.ebi.ac.uk/pride/ws/archive/v3/projects/<acc>/files`, 100 per page)
on 2026-10-12. Metadata only; nothing was downloaded.

| Deposit | Strain | What the deposit serves | Route | Gate |
| --- | --- | --- | --- | --- |
| PXD023591 | PCC 7942 | 3 files: one mzIdentML (`hf2019103123.mzid.gz`), its MGF, one raw | the existing `mzidentml` reader, one spectral-count layer | its condition record. Growth details are unreported and the depositor query is drafted and deferred by the owner |
| PXD027430 | PCC 7942 | 9 files: three mzIdentML with their MGFs and raws | the same reader, three runs | its condition record, and that this is a TMT study whose reporter-ion quantification is not in the deposit, so counts are the only quantity it can yield. Conditions and the 0 h baseline assignments are open depositor questions, deferred |
| PXD014590 | **UTEX 2973, native** | 135 files: 27 top-down runs as `.raw`, 27 `.ms1ft` MS1 feature files, 27 search archives and 54 `*_MSAlign_Results_XML.zip` | no protein-level table; an MSAlign result-XML reader would be new | top-down results identify proteoforms, not gene-level amounts. Roadmap item 7 directs a presence overlay first; define/validate that output contract before a layer ships |
| PXD036717 | PCC 7942 CscB-SPS, engineered | 24 archive files; four APEX2 baits against CscB-SPS. Owner-supplied publisher `mmc1.xlsx` provides LFQ intensities and ratios directly, without extracting the search/peak RARs | pinned workbook reader and non-imputed reconstruction; identifier/condition/release checks above remain | separate enrichment approved D11; D12 requires raw-LFQ reconstruction, twelve replicate comparisons and optional within-bait means; not protein abundance |
| PXD044412 | multi-organism archive; S3 is PCC 7942 | 2,002 PRIDE entries include seven PCC 7942 intensity reports; paper-linked Figshare v1 S3 supplies 391,900 analyzed peptide rows across 42 labels | pinned streaming S3 reader and conservative source-protein evidence summaries implemented; full cell preservation and ambiguity/missingness checks | distinct interaction type approved D11; native identifier/crosswalk and condition validation, browser admission and rendering remain; no protein-abundance interpretation |

Unchanged and still outside the shortlist: PXD019731 and PXD074299 deposit no
proteome-wide table and wait on reprocessing; PXD011485 is PCC 11801, outside
the admitted strains, so it has no admission route; PXD010000 was rejected by
package B with no grant over its files.

**What this leaves S5.** Two deposits, PXD023591 and PXD027430, are readable
today by a reader that already exists and is already tested. Neither is blocked
by licence, by tooling or by the crosswalk. Both are blocked by the same thing:
a condition record, which needs depositor answers the owner has deferred. PXD014590 still needs a new reader and presence-overlay output contract.
PXD036717 and PXD044412 now have bounded readers and source-specific output
contracts; their remaining admission work is listed above. D11 approves separate
enrichment/interaction evidence types, not reinterpretation as protein abundance.
Reader completion does not itself admit either source to the browser.


## Work

| Stage | Work | Depends on |
| --- | --- | --- |
| S1 | Confirm in the code the five gaps the returned integration map names (provenance attached only to expression-recognised metrics; the legacy single-source readers in the provenance panel, the dataset module and the export; the registry built once; the contract's evidence bases unread in `site/js`; the unmarked z clamp) and close the ones the feature needs | — |
| S2 | Structured condition records on every entry of the expression sources manifest: study, data type, platform, strain, basis, replicates, one object per axis with value, status and quote, treatment tags, group; writer in the pipeline, checks in the contract validator; back-fill the two shipped sources | S1 |
| S3 | Build-time grouping and subgrouping from the records under decision 4, with the pair judgements as a data file; group recipe in `meta.json` | S2 |
| S4 | The section, the peek, the filters toggle and button, the per-axis and projection-view controls, the `ds` link field with a state-version bump, the export manifest fields, unit tests, and rendered checks at mobile, tablet and desktop widths with the accessible description read | S2, S3 |
| S5 | Load datasets one at a time under the admission contract: the processed table, checksum, the join through the exact shared-protein crosswalk with matched, unmatched and ambiguous counts, one layer per condition set, contract tests. The original first-candidate list (GSE104203, GSE222067, GSE288532, GSE327989, GSE79726, GSE89999, then the CC0 proteomes with tables) is fully consumed: all six series and five proteomes ship. The remaining candidates, each with the route and the gate that actually holds it, are under "Remaining admission shortlist, 2026-10-12" below | S2; each needs its condition record |
| S6 | Agreement statistics beside the conditions: level correlation against replicate bands and fold-change agreement where both sides have a control; distribution comparison as a units check only; no pass mark | S5 with replicates; reprocessed data for the rest |

## Verification

S6's reproducible export prerequisite is complete: the
[agreement runbook](../../validation/expression-agreement.md) documents a CLI
that projects a full report into statistics-only JSON and both review TSVs,
retaining metadata, denominators and caveats with exact input/exporter checksums.
The tables reproduce the preserved artifacts byte for byte. S6's current-report
UI integration is complete: 53 report-backed RNA-seq sources, two explicit coverage
gaps, 1,378 level pairs and 26 recorded response pairs. Further data admission,
new statistical work and distribution-comparison presentation stay open here.

UI verification is active. Condition-guide rendered checks cover the Data Selection peek at eight widths and found two repaired defects: mobile tabs/Close overflow and keyboard focus falling to the body after tab or row replacement. Tabs now support arrow/Home/End navigation. The provenance disclosure and dataset provenance now read every per-condition declaration. Export manifests/caveats carry compact provenance only for contributing measurement columns, including pooled contributors, with legacy single-source fallback. S1’s source readers and S4’s current-release UI are covered. Further data admission, statistics beyond the accepted report and judgement-dependent overlays remain under their original gates. The current-release UI and export repairs are accepted by independent DEM-259 review; its data-admission and statistical stages retain their stated gates. Each stage runs the gates:

```sh
npm test
.venv/bin/python -m pytest -q
.venv/bin/python tools/validate_contract.py
```

S4 needs rendered checks at 375, 768, 1280 and 1440 px with the peek open and
closed, the background confirmed inert, focus returning to the button, and the
accessible description read. S5 needs, per dataset, the manifest entry, the
checksum, the join audit, and a contract test pinning the shipped values.

## Cleanup

On resolution, distil the condition-record schema, the grouping rule, the
source-selection contract and the per-dataset admission runbook into
`docs/validation/`, update `validation/INDEX.md`, record in the scan ticket that
step 6 shipped here, then delete this ticket and its index row.

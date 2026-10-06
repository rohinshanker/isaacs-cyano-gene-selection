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
- **Updated:** 2026-10-05

## Current state

Design settled by the owner in three rounds on 2026-10-04 and 2026-10-05; the
decisions are listed below and the second-round requirements are recorded in the
scan ticket under step 6. A working prototype with every requested behaviour is
`docs/notes/handoff/cyano_dataset_panel_mockup_v2_20261005.html`, rendered and
exercised at four widths. The site ships values for two sources today
(the GSE205444 PCC 7942 abundance table and Tan 2018 initiation); the 59
condition sets in the prototype are descriptions with quotes and citations, not
loaded values. Built in the main checkout on `main`, by owner instruction, and
pushed when ready; no interim version with placeholder rows is shipped.

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
abundances and are left out. Seventeen sources ship. Still to ingest: the CC0
proteomes (PXD019731, PXD030282, PXD062851, PXD074299 first, each a candidate
row with a per-gene table); GSE45762 is excluded for contradictory sample labels.

The pair judgements are a data file since 2026-10-06
(`data/expression/pair_judgements.json`, 32 pairs, emitted as
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

Open from this round, asked 2026-10-06: when several datasets of one type are
selected, does the type metric show one chosen dataset (default: the first
selected, changeable in the section) or a pooled value across the comparable
set? Units differ between deposits (CPM, TPM, RPKM, as deposited), so pooling
needs a stated normalisation and is not done by default.

## Work

| Stage | Work | Depends on |
| --- | --- | --- |
| S1 | Confirm in the code the five gaps the returned integration map names (provenance attached only to expression-recognised metrics; the legacy single-source readers in the provenance panel, the dataset module and the export; the registry built once; the contract's evidence bases unread in `site/js`; the unmarked z clamp) and close the ones the feature needs | — |
| S2 | Structured condition records on every entry of the expression sources manifest: study, data type, platform, strain, basis, replicates, one object per axis with value, status and quote, treatment tags, group; writer in the pipeline, checks in the contract validator; back-fill the two shipped sources | S1 |
| S3 | Build-time grouping and subgrouping from the records under decision 4, with the pair judgements as a data file; group recipe in `meta.json` | S2 |
| S4 | The section, the peek, the filters toggle and button, the per-axis and projection-view controls, the `ds` link field with a state-version bump, the export manifest fields, unit tests, and rendered checks at mobile, tablet and desktop widths with the accessible description read | S2, S3 |
| S5 | Load datasets one at a time under the admission contract: the processed table, checksum, the join through the exact shared-protein crosswalk with matched, unmatched and ambiguous counts, one layer per condition set, contract tests. First candidates are the licence-permitted series with deposited per-gene tables and replicates: GSE104203, GSE222067, GSE288532, GSE327989, GSE79726, GSE89999, then the CC0 proteomes with tables | S2; each needs its condition record |
| S6 | Agreement statistics beside the conditions: level correlation against replicate bands and fold-change agreement where both sides have a control; distribution comparison as a units check only; no pass mark | S5 with replicates; reprocessed data for the rest |

## Verification

Not started. Each stage runs the gates:

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

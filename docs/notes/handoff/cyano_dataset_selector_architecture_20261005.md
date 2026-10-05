# Architecture: grouped dataset selector, condition scales and agreement viewer

Prepared 2026-10-05 by a Claude Science session for the in-repo agents (Fable, multica, mythos).
This is a design recommendation. It does not edit the contract, admit any data, decide
comparability for any pair, or close any ticket (`docs/validation/claude-science-handoff.md:231-242`).
Every contract or ticket change named here is an edit for the in-repo agents to make
after the owner confirms it.

Companion files in `docs/notes/handoff/`, all dated 20261005:

- `cyano_repo_integration_map_20261005.md`: extension points (a.1-a.8), binding rules
  B1-B61 and risks d.1-d.14. All `file:line` references below come from it and use
  working-tree line numbers at HEAD `70bc590`.
- `cyano_comparability_methods_20261005.md` and `cyano_comparability_methods_citations_20261005.tsv`:
  the literature basis, with metrics M1-M7.
- `cyano_comparability_pilot_20261005.md` with its TSVs and figure: a sandbox calibration
  on seven PCC 7942 GEO tables.
- `cyano_dataset_panel_mockup_20261005.html`: a static mockup built from package B values.
- `cyano_dataset_condition_records_20261005.json`: the 63 hand-parsed condition records the
  mockup uses, given as an example of the proposed structured schema.
- `cyano_blocked_task_register_20261005.md` and `.tsv`: the register of incomplete tasks.

## 1. The owner's instruction (2026-10-04)

Recorded verbatim, as given in the Claude Science session:

> for determining if data can be grouped, it is okay to compare the data and see if the
> distributions are similar enough to consider them comparable as one condition. regardless,
> there can be a feature to toggle on a bunch of different datasets, which will be grouped by
> similar conditions but not explicitly bound by them (e.g. for transcriptomics, there would be
> a group for "other" which for each dataset will mention its specific conditions and have them
> toggleable. for another conditions like anoxic + cold, each dataset should still have metrics
> listed so users can compare how closely they align. for things like temperature, the number
> could be colored/placed on a scale so that the user can easily compare the conditions for each
> dataset, but it should not be so bulky that it becomes hard for the user to compare multiple at
> once. there could even be some additional viewer for this if it makes sense). once an analysis
> is done, this should be left to human discretion to determine if they align well enough based
> on certain metrics + their conditions. note how any of the tasks run earlier were not able to
> complete, so that in a later human review for the in-repo work these questions can be
> resolved/files manually uploaded/workarounds provided (e.g. me manually downloading biocyc data
> or providing my credentials for a browsing session so an agent can). these changes should be
> researched + architectured so that the in-repo agents/mythos agents can work on this

### 1.1 What it changes

The instruction makes five separable decisions. Each one maps onto existing text.

| # | Decision in the instruction | Existing text it touches | Proposed edit (for the in-repo agents after owner confirmation) |
| --- | --- | --- | --- |
| D1 | Data may be compared to judge whether datasets count as one condition. | data-contract.md:142 (B1: comparable only when every axis agrees); future-data-roadmap.md:28-29 (B28). | Make the axis thresholds a default screen and evidence, not the sole gate. Data-derived agreement statistics (section 4) are shown beside them. A pair becomes poolable only when the lab records a judgement for it (AAA row 14). |
| D2 | Many datasets can be toggled on at once. They are grouped by similar conditions, but group membership does not bind them. | Scan ticket step 6, :566-567 (B59: multi-select only "when a defensible normalization exists"). | Multi-select is always allowed for separate layers. A warning and the agreement statistics appear when the shown datasets do not align. Any pooling still follows D1. |
| D3 | An "Other" group lists each dataset's own conditions and keeps it toggleable. | None; new. | Section 5.2. |
| D4 | Compact per-axis condition scales, plus an optional extra viewer. | B5-B6 (data-contract.md:131-151) define the axes and regime bands. | Sections 6.3 and 6.4. |
| D5 | The final alignment call is human. Incomplete tasks are recorded for human review. | AAA rows 13-14 (:24-25); B4 (:155-157); B26. | Already consistent. The register is proposed as its own ticket (section 9). |

**Unchanged by the instruction**, and therefore still binding:

- Separate layers only; no automatic pooling (B3, data-contract.md:153-155).
- Raw fields are never merged; any consensus is a separately named `inferred` field (B17, :476, :480-482).
- Native and transferred values stay distinguishable (B8, :49).
- The strain is named wherever a value is used (B9, :114-115).
- Nulls stay null (B14).
- Admission runs the full admission contract (B25, B30).

The instruction allows distribution comparison. The literature and the pilot both show that
whole-distribution similarity is the weakest of the available statistics (section 4.1). The
design therefore implements D1 with stronger statistics and keeps the distribution check as a
units sanity check. This is a refinement of how D1 is met, not a refusal of it. The owner may
overrule it.

## 2. Concepts

| Term | Meaning | Where it lives |
| --- | --- | --- |
| Dataset | One admitted source: one `metricKey`, one per-gene field and one `meta.metrics` entry (B16). A study with several conditions contributes one dataset per condition set that is published as a layer. | `data/expression/sources.json` becomes `meta.expressionSources[]` (metric-registry.js:386-391). |
| Condition set | One group of samples inside a study that shares one condition. This is the unit used by package B rows and package D pairs. | The structured `conditions` object of each dataset (section 3.1). |
| Study | A GEO series or PRIDE project, with its paper. | New field `studyId`. |
| Data type | The top-level tab: transcriptomics, proteomics or fitness screen. Whether array and RNA-seq count as one type is open (MET-07). | New field `dataType`; `platform` is recorded separately. |
| Group | An advisory display grouping produced by an ordered rule recipe (section 5). It never creates a value. | Computed at build time and written as `group` on each dataset. |
| Pair judgement | A human decision, recorded for one pair, that it may share a layer or not. | AAA row 14 entries, later a `pairJudgements` list (section 4.4). |

## 3. Data model

### 3.1 Extend each `expressionSources` entry with structured conditions

Extend the existing list rather than add a sibling list. `buildMetricRegistry` already keys
sources by `metricKey` (metric-registry.js:386-391). `describeExpressionSource`
(metric-registry.js:357-372) is the single boundary every source shape passes through. The free-text
`condition` string stays as written, because it is the human-readable statement. The new fields
sit beside it:

```json
{
  "id": "<source id>",
  "metricKey": "<metric key>",
  "studyId": "<GSE or PXD series>",
  "dataType": "transcriptomics",
  "platform": "RNA-seq",
  "unitAsDeposited": "<unit as deposited>",
  "strain": "PCC 7942",
  "basis": "transferred",
  "replicates": "<integer or null>",
  "conditions": {
    "temperature":    {"lo": "<number>", "hi": "<number>", "unit": "C", "status": "reported", "quote": "<source sentence>"},
    "lightIntensity": {"lo": "<number>", "hi": "<number>", "unit": "umol photons m-2 s-1", "status": "reported", "quote": "<source sentence>"},
    "lightRegime":    {"kind": "continuous", "photoperiod": null, "spectrumClass": null, "status": "reported", "quote": "<source sentence>"},
    "co2":            {"value": null, "status": "not reported", "quote": null},
    "medium":         {"base": "BG-11", "modified": false, "conditioned": false, "status": "reported", "quote": "<source sentence>"},
    "format":         {"value": "planktonic liquid", "status": "reported", "quote": "<source sentence>"},
    "phase":          {"label": "<as stated>", "od": null, "odNm": null, "status": "reported", "quote": "<source sentence>"},
    "treatments":     []
  },
  "group": "standard"
}
```

Angle-bracketed values are placeholders that show the shape only. The pipeline fills real values
from the admitted source records, not from this document.

Rules:

1. `status` takes one of `reported`, `not reported`, `not retrieved` or `conflicting`. These are
   the same vocabulary package B uses. The intake correction for package B rows 31 and 70
   (MET-01) is exactly the difference between `not retrieved` and `not reported`, so the
   distinction must survive into the site.
2. A stated tolerance becomes a range: "29 ± 2 °C" is stored as `lo` 27 and `hi` 31. This is
   the parse rule package D used.
3. `quote` holds the source sentence that the value was read from. The interface shows it in
   tooltips and the detail view, so a compact scale never replaces the source.
4. `treatments` is a new axis. Package B has no perturbation field, yet the owner's example
   ("anoxic + cold") needs one. The proposed controlled vocabulary comes from the 63 mockup
   records: oxidative (H2O2), salt, nitrogen starvation or resupply, zinc exposure, O2 saturation,
   CO2 series, high-light pulse, shade pulse, dark time course, diel or circadian time course,
   photoperiod, IPTG, theophylline or ZnCl2 induction, biofilm assay, conditioned medium,
   membrane bioreactor, and co-culture. The tags are hand-assigned in
   `cyano_dataset_condition_records_20261005.json`. A
   keyword pass was tried first and gave false positives ("o2" inside "CO2"; "dark" inside a
   photoperiod), so the pipeline should take tags from a curated column, not from text matching.
5. `basis` uses the contract's five bases (B7). Today the site has only `isTargetOrganism` (risk d.11).
6. The writer is `scripts/build_features.py` (data-contract.md:437-438, implemented at
   build_features.py:384-385). The validator gains checks in `tools/validate_contract.py`
   (near :1295-1302): every axis has a status; every range has `lo <= hi`; units come from a
   fixed list; tags come from the vocabulary.

Package B coverage over the 63 condition sets parsed for the mockup:

| Axis | Sets with a value |
| --- | --- |
| Medium | 58 |
| Culture format | 57 |
| Temperature | 54 |
| Light intensity | 51 |
| Light regime | 40 |
| Spectrum class | 35 |
| Growth phase or OD | 34 |
| CO2 | 31 |

These gaps will show as hatched cells, which is intended (B53).

### 3.2 A new agreement file: `site/data/dataset-agreement.json`

The statistics are precomputed per data type by the pipeline and loaded as a later-tier file:

- Add it to `DATA_FILES` (core/data-files.js:44-60) at tier 4, not required.
- Give it an applier in `DATA_APPLIERS` (core/dataset.js:267-371) that validates the whole file before use.
- List it in `data-manifest.json`, which is written last (B24).
- It is not part of `genes.json`, so it does not use up that file's 6 MB budget (B23; `genes.json` is 5,169,989 bytes now).

Content: one block per data type.

- `datasets[]`, one per dataset:
  - M1 feature count;
  - M2 replicate band per condition set: median, minimum, maximum and number of replicate pairs, or `notComputable` with a reason.
- `pairs[]`, one per within-type pair of datasets:
  - the shared feature count (M1);
  - M3: median and IQR of cross-sample Spearman ρ, plus Lin's CCC on mean ranks;
  - the position of the M3 median against each side's M2 band, as two numbers (cross median minus band median), never as a label;
  - an M4 summary: count of genes outside the replicate-derived band, and the top 20 by name;
  - M5 per contrast pair where both datasets have a control: ρ of shrunken log2 fold changes, the replicate-split reference for each contrast, the percentile within the type's unrelated-contrast distribution, and the response magnitude on each side;
  - M7 KS D, flagged as a units check only;
  - the package D pair id, so axis verdicts can be shown beside the statistics without being merged into them;
  - a `notComputable` reason code for every metric that is missing.

Computation rules:

1. Use stored values (B50): ranks within each sample over the shared features, no batch
   correction (memo pitfall 4).
2. Never produce a composite score or a pass mark (memo, "Recommended metric set"; B26).
3. Within-study pairs are reported as the reference, not as cross-study comparisons.
4. Size: package D enumerates 941 cross-study pairs over 63 units. At about 300 bytes per pair
   the file is around 300 KB before compression. This is an estimate, not a measurement.

### 3.3 Where the input tables come from

The methods memo counted per-gene tables with a provisional keyword pass over package B:

- Transcriptomics: 32 of 57 rows record no per-gene table, 17 mention counts and 1 mentions TPM.
- Proteomics: none of the 22 rows records a table.

Most of M2-M6 therefore needs reprocessing from raw reads, as the PCC 7942 iModulon compendium
did (Yuan et al. 2024, doi 10.1073/pnas.2410492121). Uniform reprocessing would also remove
memo pitfall 2 (unit mismatch) within RNA-seq. Whether to reprocess is an owner decision under
the admission contract (section 10, Q5).

## 4. Which statistics, and why

### 4.1 Evidence

The methods memo (44 papers; 29 read in full and 15 from abstracts) ranks the evidence as
follows:

1. Agreement on the condition response (each study's treatment-versus-own-control fold
   changes) is the strongest data-derived evidence of comparable biology (SEQC/MAQC-III 2014;
   every cyanobacterial compendium compares within-study contrasts).
2. Level agreement is weaker, and means something only against each dataset's replicate band.
3. Whole-distribution similarity after normalization mostly tests whether the two studies used
   the same normalization (Hicks and Irizarry 2015; Robinson and Oshlack 2010).

The pilot reproduced this ordering on seven licence-permitted PCC 7942 GEO tables: 10,440
sample pairs, of which 87 are replicate pairs, 2,541 are within-study different-condition pairs
and 7,812 are cross-study pairs. GSE45762 was excluded because its column labels contradict its
own sample sheet.

- **Within a study, Spearman ρ separates replicates from different conditions.** AUROC is
  0.942-0.975 in GSE104203, GSE222067 and GSE288532 and 0.932 pooled; Spearman has the
  highest AUROC of the three statistics in 3 of 5 studies (KS D is higher in GSE222067 and
  GSE79726). KS D has a per-study median AUROC of 0.825. Wasserstein distance on standardized values ranges from 0.525 to 0.941.
- **Across studies, level statistics track the study pair, not the condition.**
  - No cross-study pair reaches the replicate Spearman bound of 0.939 (0 of 7,812).
  - Study-pair identity explains 34% of the cross-study variance in Spearman.
  - Similar BG-11 ~30 °C controls are not more concordant than other cross-study pairs:
    AUROC 0.462 for Spearman.
- **Fold-change agreement was the only statistic that matched conditions across studies.**
  - The GSE104203 shade pulse and GSE89999 darkness agree at ρ 0.613 and 0.688, inside the
    same-contrast replicate-split range of 0.391-0.894.
  - The high-light pulse anticorrelates with both (−0.470 to −0.713).
  - Unrelated perturbations span −0.600 to 0.392.
  - This rests on two contrast pairs and is provisional.
- **Package D's count of passed axes barely tracks the data within a study pair.** Its
  correlation with Spearman is 0.311 across study pairs but 0.016 within them.

### 4.2 Consequences for the design

- **Level similarity must not drive grouping.** It would group by laboratory. Groups come from
  the condition record (section 5). Data similarity is offered as a suggestion only, and a
  response-based suggestion (M5) is preferred where one exists.
- **Every level statistic is drawn against the two replicate bands.** The reader sees the
  distance from the noise floor, not a bare correlation (memo, "What the interface should show",
  items 1-2).
- **The KS or density view stays.** The owner asked for distribution comparison and it catches
  unit errors, but it is labelled "units check, not comparability" (M7).
- **No thresholds are proposed.** The memo found none in the literature (memo, "Open gaps").
  The lab sets any threshold under AAA row 13.

### 4.3 States that must be visible

| Metric | Not computable when | Shown as |
| --- | --- | --- |
| M2 replicate band | Fewer than 2 replicate profiles in the condition set | "single replicate: no noise floor" |
| M3 level concordance | No per-gene table, or no shared features | Reason text; never 0 |
| M5 response concordance | Either side lacks its own control, or has fewer than 2 replicates per arm | "no within-study contrast" |
| M6 study-versus-condition split | Every study has a unique condition (confounded) | "study and condition are confounded; split not identifiable" |

### 4.4 Recording human judgements

A pair judgement is recorded by the lab, never by an agent. It is first an AAA row 14 entry.
Once the format settles, it becomes a list in the agreement file:

```json
{"pair": ["GSE50908", "GSE50919"], "judgement": "may share a layer", "by": "lab", "date": "YYYY-MM-DD", "basis": "free text naming the metrics and axes consulted"}
```

The viewer shows the judgement status of a pair in one of three states:

- no judgement;
- judged comparable;
- judged not comparable.

A combined layer, if one is ever built, may use only pairs judged comparable, and it is
published as a separate `inferred` field (B17, B20).

## 5. Soft grouping

### 5.1 Recipe

Groups come from an ordered list of rules over the structured condition fields, kept in a
small recipe file (proposed name `data/expression/dataset-groups.json`; its location is an
in-repo choice). A dataset sits in the first group whose rule it meets. Every group header
shows its rule in plain words. Each rule is a conjunction of axis predicates, so the owner's
"anoxic + cold" example is written as `treatments contains "O2 saturation varied" AND
temperature.hi < 28`.

The illustrative recipe used in the mockup is below. The final recipe is the lab's choice
(OWN-11).

| Order | Group | Rule |
| --- | --- | --- |
| 1 | Biofilm, bioreactor and co-culture | A biofilm assay, a bioreactor, or a second organism in the culture |
| 2 | Elevated temperature or high light | Temperature 36-40 °C, or light above 400 µmol photons m⁻² s⁻¹ |
| 3 | Stress and nutrient perturbation | An applied stress or nutrient change: oxidative, salt, nitrogen, zinc, O2, CO2 series, or a light shift |
| 4 | Diel and circadian | Sampled across a light-dark cycle or a circadian free-run |
| 5 | Standard photoautotrophic growth | BG-11, 28-32 °C, ≤ 400 µmol photons, continuous light, planktonic, no applied stress |
| 6 | Other | Fits no group above, or too little is reported to place it |

Membership produced by this recipe on the 63 package B condition sets:

| Data type | Biofilm | Elevated | Stress | Diel | Standard | Other |
| --- | --- | --- | --- | --- | --- | --- |
| Transcriptomics (40) | 4 | 4 | 7 | 13 | 7 | 5 |
| Proteomics (20) | 0 | 5 | 2 | 2 | 3 | 8 |
| Fitness screen (3) | 3 | 0 | 0 | 0 | 0 | 0 |

These are condition sets from package B, not admitted datasets. Under the ledger, only licence-permitted
and admitted sources would ever appear.

### 5.2 Behaviour

- **Advisory, not binding.** Each row always carries its own condition strip. The group only
  orders the list and offers a group checkbox.
- **"Other" is a normal group.** Its rows show every reported axis, so a reader can see why each
  row did not fit. A row with too little reported to place it says so ("4 of 8 axes not
  reported").
- **A dataset never moves between groups because of its data.** A "similar datasets"
  disclosure on each row lists the nearest datasets by M5 where it exists (otherwise by M3
  relative to the replicate bands), each with its statistic and replicate reference. This is a
  suggestion only.
- **Group order and collapse state are presentation.** They are kept in `localStorage`, not
  in the link (B34).

## 6. Interface

### 6.1 Placement

- Add a fourth controls-column panel, "Datasets", to `LEFT_PANELS`
  (core/left-panels.js:17-21) after `filters`.
- It inherits `po`/`pc` order and collapse encoding (url-state.js:27). It changes
  `DEFAULT_PANEL_ORDER` (left-panels.js:26), and `tests/js/layout.test.mjs` must be updated.

Behaviour at the three breakpoints:

| Width | Behaviour |
| --- | --- |
| Below 960 px | Single column. The panel appears in controls DOM order (B33). Rows stack the name above the strip. |
| 960-1239 px | Left rail of at least 260 px (B32). Rail-mode strip: three 48 px tracks (temperature, light, CO2) plus the light-regime glyph. Medium, format, phase and treatments move into a row disclosure. |
| 1240 px and above | Same rail. The agreement viewer (6.4) opens in the analysis column, where the full seven-column strip of the mockup fits. |

Run the regression widths in B35. The document must never scroll horizontally. A wide matrix
scrolls inside its own container.

### 6.2 Toggle semantics

Follow the colour-source precedent: `renderSourceToggles` (ui/legend.js:119-149), the fixed id
list in core/annotation-source.js:18-25, URL field only when non-default, and recorded in exports
(export-manifest.js:437-440). The proposed behaviour of the shown set:

1. **What the set scopes.** It decides which dataset metrics are offered in the colour, axis
   and filter selectors (`registry.families`, app.js:1339-1372), in the side-panel Expression
   family (side-panel.js:783-867) and in the agreement viewer. It does not remove a source from
   the provenance list (app.js:1554-1620), which keeps listing every admitted source. This
   matches the precedent that a toggle scopes a view without hiding evidence elsewhere (B40).
2. **Hiding a dataset in active use.** If a hidden dataset is the colour metric or an axis, the
   view self-heals to the default (viewer-interaction-state.md:287-289) and says so in one line.
   If it carries an active filter, the filter stays in force. The filters panel lists it as
   "active on a hidden dataset" until the user clears it. Hiding never changes the mask silently.
3. **Not a filter channel.** The shown set does not join "Clear all filters"
   (filters.js:85-94).
4. **Group checkbox.** It is tri-state and toggles every member. The group count reads
   "N condition sets · M studies · K shown".
5. **Direct-UTEX-only switch.** One switch at the top restricts the shown set to datasets with
   basis `direct` (B9, B20). Today that is Tan 2018 and, if admitted, PXD014590, the only
   native UTEX 2973 proteome in package B.
6. **Default set.** The currently shipped layers (GSE205444, Tan 2018) are shown, and newly
   admitted datasets start hidden. This avoids changing what an old link shows. The final
   default is owner question 1 of the scan ticket (OWN-11).
7. **Many datasets at once.** Any number may be shown as separate layers (D2). When two or more
   shown datasets of one type have no pair judgement, a single line under the panel says that
   they are shown separately and have not been judged comparable, with a link to the viewer.
8. **Colour scales.** The colour ramp stays single-metric (legend.js:510-623). Colouring by a
   group is not offered (B3).

### 6.3 Compact condition scales

The encoding is specified so that many rows can be read down a column at once:

- **Shared fixed axes.** Every row uses the same axis for an axis, and the ticks are printed
  once in a sticky header:
  - temperature: linear, 15-45 °C;
  - light: log scale, 1-1000 µmol photons m⁻² s⁻¹;
  - CO2: log scale, 0.03-12%.
  Values therefore line up vertically and can be compared by position alone.
- **Regime bands from the contract (B6).**
  - Temperature: tinted bands at 28-32 °C (standard) and 36-40 °C (elevated).
  - Light: a dashed line at 400 µmol.
  - CO2: a tick at 0.04% (ambient) and a band at 1% or more (elevated).
- **Value marks.** A dot marks a single value and a bar marks a reported range. The mark colour
  repeats the regime (standard, elevated, ambient, or grey for outside both), but position
  carries the value. Colour is never the only channel (B48).
- **Light regime glyph.** A bar is split into light and dark in proportion to the photoperiod.
  Two short ticks before the bar mean "after entrainment". A short spectrum code (CWF, WW-LED,
  630/680, or "?") sits at its end. The unnamed "white light" class that blocks package D's
  six nearest-miss pairs is shown as "?", not hidden.
- **Missing values.** An unreported axis is a hatched cell with "?". `not reported` and
  `not retrieved` differ in the tooltip and accessible name, and could also differ by outline
  style. A missing axis is never drawn as zero or as an empty track (B14).
- **Exact source text.** Every cell's tooltip shows the source quote. Every row has an
  accessible name that reads the conditions as a sentence, with "not reported" spelled out.
- **Widths.** Wide mode uses 70 px tracks. Rail mode uses 48 px tracks and keeps only
  temperature, light, CO2 and regime. The remaining columns are one disclosure away.

### 6.4 Agreement viewer

Make this a new analysis panel in `PANELS` (ui/panels.js:13-53), not a tab of `ComparePanel`:

- `ComparePanel` series are genes and its axes are metrics (compare.js:99, :274-289; risk d.10).
- Its robust z-scale (compare-model.js:113-137) carries the unmarked ±3 clamp of audit item
  A-01, which a new view must not inherit (B61).

The panel has three parts:

1. **Condition matrix.** Rows are the shown datasets and columns are the axes, drawn as larger
   versions of the strip on the same scales. Under each axis is a spread summary, for example
   "27-37 °C across 4; not reported for 1". The mockup's "Compare selected" pane is this part.
2. **Agreement matrix.** A pairwise heatmap within one data type.
   - Each cell shows the M3 median and a small glyph placing it against the two replicate bands.
   - A second tab shows M5 where it is computable.
   - Not-computable cells carry their reason code.
   - The cell colour encodes distance from the replicate band, never the raw ρ.
   - Datasets of different types are never placed in one matrix.
3. **Pair detail.** Opened by choosing a cell. It shows:
   - M1 feature counts;
   - both M2 bands;
   - the M3 distribution with the bands overlaid;
   - the M4 difference-versus-mean plot with its listed genes;
   - M5 with its replicate-split reference and the unrelated-contrast distribution;
   - M7 labelled as a units check;
   - platform, unit as deposited, and whether the values were reprocessed uniformly;
   - strain on each side, with a cross-strain marker (memo pitfall 7);
   - the package D axis verdicts in their own row;
   - the pair's judgement status.

Up to ten datasets get distinct identity encodings (compare-model.js:100-110). Beyond ten, only
the matrix is drawn. Chart, legend, accessible name and table agree (B47). A plain table version
of the matrix is always available.

### 6.5 Per-gene view and missing genes

- **Side panel.** Group the Expression family's dataset rows by dataset group, collapsed beyond
  the first three. Show one condensed provenance line per group instead of one per row
  (side-panel.js:852-862 repeats the full sentence today).
- **Two kinds of missing.**
  - A gene with no value in a dataset shows "no value".
  - When the strain lacks the gene, the reason is "gene absent from strain", not "not
    quantified" (B55, AAA row 15).
- **Agreement statistics use the intersection of shared features, and n is printed beside
  every value.** Display uses each dataset's own coverage. Missing values never get a position
  (B45) and are never kept by a brush (B46).
- **Filters.** The existing per-metric "Include the N genes with no …" control
  (filters.js:457-480) applies unchanged to each dataset metric.

### 6.6 URL state

- Add key `ds`: an explicit, sorted list of short dataset ids, written only when the set differs
  from the default (url-state.js:21-28, :87-119).
- Bump `STATE_VERSION` to 7 and freeze the v7 default list in `url-state.js`. An absent `ds`
  then means one thing per version, and a later change of default is another version bump
  (B38-B39; risk d.13).
- Decode tolerantly. Unknown ids are dropped without discarding neighbouring fields
  (viewer-interaction-state.md:292-294).
- A link that opens the agreement viewer adds `dataset-agreement.json` to `promotedFileKeys`
  (app.js:1761-1771). The link's state is kept while that file loads or after it fails (B44).
- Viewer layout, group collapse and sort stay out of the link (B34).

### 6.7 Loading and export

- **Loading.** The viewer asks for load state only through `pendingState`, `isLoading`,
  `hasFailed` and `firstUnsettled` (B42). It shows "loading", never empty cells (B41).
- **Export: shown set.** The manifest gains `shownDatasets`, as `functionColourSources` does
  (export-manifest.js:437-440).
- **Export: per-metric provenance.** Each manifest metric gains its structured `provenance`,
  including `conditions` (export-manifest.js:510-525).
- **Export: caveats.** They are generated per shown source instead of from the legacy single
  source (export-manifest.js:184-188, :434; B13).
- **Export: waiting.** An export that includes agreement statistics waits for the file (B43).

## 7. Prerequisites in the existing code

These are already defects or gaps for more than one dataset. The selector depends on them, so
they come first. Each is from the integration map.

1. **Provenance attaches only to expression-recognised metrics** (metric-registry.js:42-47,
   :418-432). Generalise attachment to every metric whose key is in `expressionSources`.
   Otherwise proteomics datasets lose their condition notes and organism warnings (d.6).
2. **Legacy single-source readers** in the provenance panel (app.js:1619-1620),
   `dataset.provenance` (dataset.js:233) and export (export-manifest.js:184-188, :434). Move them
   to `meta.expressionSources` (d.7).
3. **The registry is built once** (app.js:1688-1690). If per-dataset values are split out of
   `genes.json` to stay under 6 MB, add a rebuild path and a branch in `flushLandings`
   (app.js:1788-1817) (d.8). Until then, new datasets fit in `genes.json` only while it stays
   under budget.
4. **Contract bases are not read anywhere in `site/js`**: `direct`, `transferred`, `inferred`,
   `sisterStrain` and `bestAvailableBasis` (d.11). The direct-UTEX-only switch needs `basis`.
5. **Audit item A-01** (unmarked clamp) lands before any view reuses `zScore` (d.9).

## 8. Suggested sequence

| Stage | Work | Depends on |
| --- | --- | --- |
| S0 | Owner confirms D1-D5. The in-repo agents edit data-contract.md:135-157, future-data-roadmap.md:28-29, scan ticket step 6 :566-567 and AAA rows 13-14. | Owner |
| S1 | Prerequisites 1, 2, 4 (section 7). | None |
| S2 | Structured `conditions`, `treatments`, `basis`, `studyId`, `dataType`, `platform` in `sources.json`, with writer and validator checks. Backfill the two shipped sources. | S1 |
| S3 | Group recipe file and build-time `group` assignment; recipe text in `meta.json`. | S2; OWN-11 for the final recipe |
| S4 | Datasets panel with compact scales, toggles, `ds` URL field (v7), export `shownDatasets`. | S2, S3 |
| S5 | Agreement pipeline writing `dataset-agreement.json` (M1-M5, M7), data file, applier, manifest. | S2; Q5 (reprocessing) for most datasets |
| S6 | Agreement viewer panel. | S5; A-01 |
| S7 | Pair-judgement recording (AAA row 14 first, file list later). | S0 |

S4 is useful with only the two shipped sources plus any newly admitted ones, so it does not wait
for S5.

## 9. Placement in tickets

The duplicate check against `docs/notes/tickets/` found that the selector and the agreement
statistic are already scan-ticket work:

- Step 3, "Decide how datasets combine": per-type normalization; "Report the agreement
  statistic … A poor fit is displayed, never averaged away" (:408-420).
- Step 6, "Dataset and condition selectors": placement, URL hash, selector interaction and
  missing genes are still to be designed (:563-571, :605-606).

Proposed placements:

- **Scan ticket step 3** gains sections 3.2, 3.3 and 4 of this document as its method:
  metrics M1-M5 and M7, display with no thresholds, pair judgements.
- **Scan ticket step 6** gains sections 5 and 6 as its design, answering each of its four open
  items (placement 6.1, URL 6.6, interaction 6.2, missing genes 6.5).
- **New ticket, blocked-task register**: no existing ticket covers manual downloads, browsing
  sessions or credentials. The full proposal is in the return file
  `RET_claude-science-session__20261005.md`.
- **Section 7 prerequisites** are either a new ticket or sub-steps of step 6. The in-repo
  agents choose. The audit-fixes ticket already holds A-01.

## 10. Questions for the owner

1. **D1-D5 (section 1.1).** Confirm or amend, so the in-repo agents can edit the contract
   (register OWN-12).
2. **Default shown set and the conflict display.** These are scan ticket open questions 1-2
   (OWN-11).
3. **Data type.** Do array and RNA-seq form one transcriptomics type, or two (MET-07)?
4. **Group recipe.** Accept the illustrative six groups, or name others. Name any condition
   combinations wanted as their own groups, such as "anoxic + cold".
5. **Reprocessing.** Should transcriptomics be reprocessed uniformly from raw reads, so that the
   agreement statistics exist for most datasets? Without it, about half the transcriptomics rows
   and all proteomics rows have no per-gene table (section 3.3).
6. **Distribution comparison.** Is it acceptable that it appears as a units check rather than as
   the comparability statistic (section 1.1, last paragraph)?

## 11. Limits

- The mockup has not been rendered in a browser here. Its script parses and renders against a
  DOM stub only. The in-repo agents' browser tooling should check it at the B35 widths.
- The groups and treatment tags are this session's reading of package B labels. They are
  illustrative.
- All pilot data are PCC 7942, from seven tables with small replicate counts. Its cross-study
  fold-change result rests on two contrast pairs. No UTEX 2973 locus was used.
- The 300 KB size of the agreement file is an estimate.

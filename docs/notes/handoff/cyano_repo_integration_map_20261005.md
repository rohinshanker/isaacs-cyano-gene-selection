# Repository integration map: grouped dataset selector and comparability viewer

Survey date: 2026-10-05. Read-only survey of
`/Users/Rohin/Desktop/coding_stuff/ISAACS-LAB/isaacs-cyano-gene-selection`. Nothing in the
repository was created, edited, moved or deleted.

## 0. Repository state at survey time

- **HEAD:** `70bc59004337b5f0db7811dd829474efda4e98a4` (Wed Sep 30 23:46:11 2026 −0400,
  "Drop the blank line at the end of the module preload tool").
- **Working tree is dirty and was left untouched:** 49 entries in `git status --porcelain`
  (32 modified tracked files, 17 untracked files). Modified files include every governing
  document cited below except `responsive-workspace.md`, `viewer-interaction-state.md`,
  `progressive-loading.md` and `candidate-comparison-and-export.md`, plus
  `site/js/ui/chromosome-view.js` and `site/js/ui/gene-viewer.js`. Untracked files include
  `docs/notes/handoff/cyano_package_{A,B,C,D}_*.tsv`, `RET_claude-science-session__20261004.md`,
  and `docs/notes/tickets/O_data-use-audit-fixes__20261004.md`.
- **Line numbers are working-tree line numbers.** Every `site/js` module cited in section (a)
  is unmodified relative to HEAD, so its line numbers also hold at HEAD.
  `docs/validation/data-contract.md` differs from HEAD by one hunk inserted at line 578
  (+12 lines): lines cited below 578 hold at HEAD; lines 640 and later sit 12 lines lower than at HEAD.
  `future-data-roadmap.md`, `AAA-biological-decisions-to-review.md`, the scan ticket
  (+307 lines) and `claude-science-handoff.md` (+41) are also modified, so their line numbers
  are working-tree only.

---

## (a) Extension points

"Selector need" says what a grouped, toggleable multi-dataset selector would require from
each point. It describes constraints, not a design decision.

### a.1 Metric registry: how a dataset becomes a metric (`site/js/core/metric-registry.js`)

| file:line | What it does now | What the selector would need from it |
| --- | --- | --- |
| `metric-registry.js:383-461` `buildMetricRegistry(meta, genes, liveFields)` | Builds the single metric list. One metric per `meta.metrics` key (loop at :392). A declared key with no finite value in any gene is skipped and listed in `declaredButMissing` (:395-397). | Each toggleable dataset must currently be **its own per-gene field in `genes.json` plus its own `meta.metrics` entry**; there is no other route into the registry. A dataset group/condition concept does not exist at this level. |
| `metric-registry.js:386-391` | `meta.expressionSources` is turned into a `Map` keyed by `metricKey`; entries without a string `metricKey` are dropped. | The existing two-entry list (GSE205444 → `expression`, TAN2018_TSS → `tssInitiation`) is the precedent for N datasets: one manifest entry ↔ one metric key. Grouping metadata (group id, structured condition axes) would have to be added to these entries or a sibling list. |
| `metric-registry.js:418-432` | For a measured expression metric only (`isExpressionMetric && !isExpressionProxyMetric`), attaches `metric.provenance` from `expressionSources.get(key)`, else from the raw key with `Percentile` stripped (:423-426), else the legacy `meta.expressionSource` for `expression` only. If `provenance.id === meta.tssEvidenceSource.pooledScoreSourceId`, also attaches `metric.tssEvidenceSource` (:428-431). | **Provenance is attached only to metrics recognised as expression evidence.** A proteomics or ribosome-occupancy dataset whose family/key/unit does not match the expression patterns would receive no `provenance`, so no condition note, coverage clause or organism label would follow it into the UI. The selector needs provenance attachment generalised to every dataset-backed metric. |
| `metric-registry.js:42-47` `isExpressionMetric` | True when `family` matches /expression/i, or key starts with expression/expr/tpm/rpkm/fpkm/rnaSeq/transcript, or unit names tpm/rpkm/fpkm/"reads per"/"transcripts per". | Name/declaration heuristics decide which datasets get provenance, basis tags, low-traffic eligibility. A proteome dataset is not matched. |
| `metric-registry.js:54-56` `isExpressionProxyMetric`, `:62-64` `isMeasuredMetric`, `:71-73` `isNativeMeasuredMetric` | Proxy = expression metric with "proxy" in key/label. Native = measured and `provenance.isTargetOrganism === true`. | Only a boolean organism flag exists. The contract's five bases (`direct/transferred/inferred/proxy/unknown`) and `sisterStrain` are **not read anywhere in `site/js`** (grep for `sisterStrain`, `transferred`, `bestAvailableBasis` returns nothing). |
| `metric-registry.js:87-97` `orderMeasuredFirst`, `:108-121` `metricsInDisplayOrder`, `:482-495` `orderMetricFamilies` | Default ordering: native measured, then borrowed measured, then the rest; families holding a native measurement lead; "Expression" is moved ahead of "Translation". | A grouped dataset list must not contradict this precedence in default orderings (contract cross-references these functions by name, data-contract.md:667-674). |
| `metric-registry.js:163-169` `defaultColorMetricKey`, `:182-185` `freshViewColorKey` | Fresh colour = function category if present; else first native measured metric with unit `fraction|rank|percentile|index`; else `gc3`. | Toggling datasets on must not silently change the fresh-view colour unless the promotion rule is met. |
| `metric-registry.js:201-211` `measurementLimitClauses` | Emits `condition: …` and `N of M genes have a value` from the metric's own provenance only. | Per-dataset condition text already flows to UI from `provenance.condition`; it is a **free-text string**, not per-axis values. Compact per-axis scales need structured fields. |
| `metric-registry.js:214-220` `expressionSourceScope` | Short label: "measured in this organism" / "measured elsewhere" / "measurement source unrecorded". | Candidate per-row label in a dataset list. |
| `metric-registry.js:223` `EXPRESSION_BASES`; `:226-228` `isPrimaryAbundanceMetric`; `:235-256` `metricScopedExpressionBasis`; `:271-307` `expressionBasisOf`; `:315-324` `expressionBasisCounts` | Gene-level `expressionBasis`/`expressionSourceId` apply only to the primary `expression` field (and its percentile). Every other measured metric gets a metric-scoped basis: `measured` if finite, else `none`; TSS uses `tssInitiationBasis`. | Multi-dataset basis per gene already works metric-by-metric; a selector need not touch the legacy gene-level fields. |
| `metric-registry.js:336-347` `normalizeExpressionSource`; `:357-372` `describeExpressionSource` | Reconciles legacy (`organismMeasured/normalization/accession`) and current (`organism/units/id`) shapes; builds the plain-language provenance sentence (organism, condition, units, coverage, id, caveat). | Single boundary any new dataset-entry shape must pass through. |
| `metric-registry.js:497-504` `rebindLiveMetrics` | After a scheme change, rebinds readers of `source:'live'` metrics only. | There is **no rebuild path for pipeline metrics**: the registry is built once (`app.js:1688-1690`, guarded by `if (!context.registry)`). A dataset file that lands after boot cannot add metrics without a new rebuild path. |

### a.2 Data files, staged loading and the content manifest

| file:line | What it does now | What the selector would need from it |
| --- | --- | --- |
| `core/data-files.js:44-60` `DATA_FILES` | Frozen list of 13 fetched files with `tier` 1–4, `required`, `needs`. `genes.json`/`meta.json` are tier 1 and required. | Per-dataset payloads, if split out of `genes.json`, need entries here (new tier or tier 3) and an applier. The list is frozen and enumerated; datasets cannot be discovered dynamically. |
| `core/data-files.js:21-30` `FILE_STATE` | `loading` / `ready` / `absent` / `failed`. | A toggled-on dataset whose file is still loading must render as loading, not missing (progressive-loading.md:15-18). |
| `core/data-files.js:73-78` `TIER_LABELS` | Plain words for the loading bar per tier. | New tier would need a label. |
| `core/data-files.js:92-105` `normalizeManifest`; `:108-110` `versionKey`; `:126-135` `dataRequest` | Manifest must be `schemaVersion: 1` with `{bytes, sha256}` per file; file requested as `name?v=<16 hex>` with `force-cache`. | Every new dataset file must be listed in `data-manifest.json`, which `tools/build_data_manifest.py build` writes last (data-contract.md:734-738). |
| `core/data-files.js:141-169` `pendingState`, `isLoading`, `hasFailed`, `firstUnsettled` | The only sanctioned ways a view asks about load state. | Dataset rows and agreement statistics must ask through these. |
| `core/dataset.js:92` `buildCoreDataset` | Indexes tier 1; `dataset.provenance.expressionSource` set from legacy `meta.expressionSource` only (`dataset.js:233`). | Multi-source provenance is not carried on `dataset.provenance`. |
| `core/dataset.js:267-371` `DATA_APPLIERS` | One validator-and-join per later file; validates the whole file before joining (e.g. `tssEvidence` :324-338). | A per-dataset applier would join values onto genes; the registry would then need rebuilding (see a.1). |
| `core/dataset.js:413-421` `matchesManifest` | Size then SHA-256 check against manifest entry; mismatched bytes are refused (:651-655). | Applies unchanged to new dataset files. |
| `core/dataset.js:441` `TIER_LEAD_BYTES`; `:472-...` `loadDatasetStaged` | Tier gating by outstanding bytes; `needs` dependencies (:721-735); `retry(key)`. | Unchanged contract for new tiers. |
| `site/data/meta.json` (single-line, minified) key `expressionSource` | Legacy single source: accession GSE205444, `organismMeasured` PCC 7942, `isTargetOrganism:false`, `condition` "WT, fresh BG-11, day 1, mean of 3 replicates", `normalization` "DESeq2 normalized counts", coverage 2551/2715, caveat, `provenanceDoc`. | Still read by `dataset.js:233`, `app.js:1619-1620` (provenance panel) and `export-manifest.js:184-187, 434` (export caveat and manifest). |
| `meta.json` key `expressionSources` | Two entries, each with `id, file, metricKey, label, organism, isTargetOrganism, assay, units, condition, sha256, licence, caveat, provenanceDoc, coverage`. TAN2018_TSS `condition` is one string naming four pooled conditions. | Only `condition` (free text) describes conditions; no temperature, light, CO₂, medium, format or replicate fields. |
| `meta.json` key `tssEvidenceSource` | `id` TAN2018_TABLE_S1, DOI 10.1186/s13068-018-1215-8, `replicatesPerCondition: 2`, `conditions: [control, dark, highLight, highTemperature]`, `comparisonReference: control`, `pooledScoreSourceId: TAN2018_TSS`, join summary. | The only place in `meta.json` with a structured condition list and replicate count; `metric-help.js:103-108, 137-143` read replicates only from here. |
| `meta.json` `metrics.expression` (example entry) | `label` "Expression (PCC 7942)", `unit` "DESeq2 normalized counts", `desc` (states organism, condition, coverage, caveat), `family` "Expression", `scale` "sequential", `missingPolicy` "null renders as unknown, never as zero or median", `direction` "contextual". | Template for one dataset-backed metric. 35 metric keys are declared. |
| `site/data/data-manifest.json` | `schemaVersion: 1`; 15 files listed (includes `citations.json` and never-fetched `pcc7942-essentiality-v1.json`). `genes.json` is 5,169,989 bytes. | Size budget: `genes.json` "stays under 6 MB uncompressed" (data-contract.md:768-769). Many additional per-gene dataset fields inside `genes.json` would consume the remaining headroom; the contract's stated remedy is splitting payloads (:772-773). |

### a.3 Legend, colour-source toggles, value scales

| file:line | What it does now | What the selector would need from it |
| --- | --- | --- |
| `ui/legend.js:119-149` `renderSourceToggles` with `core/annotation-source.js:18-25` `SOURCE_TOGGLES`, `DEFAULT_COLOR_SOURCES` | Three checkboxes (UTEX 2973, PCC 7942, GO IEA) inside the category legend; govern colour and legend counts only; encoded as URL `cs`. | **Closest existing precedent for a toggleable source set**: fixed id list, canonical order, explicit `none`, URL field only when non-default, export records `functionColourSources` (`export-manifest.js:438-440`). |
| `ui/legend.js:510-623` `renderLegend(host, state)` | Ramp legend for one metric; appends basis counts (:609-615) and `state.provenanceNote` as `.provenance-warning` (:617-622). Caller passes `formatExpressionSource(metric.provenance)` (`app.js:771`). | Legend is single-metric. A colour by a grouped/merged dataset is not representable and would also contravene data-contract.md:153-155. |
| `ui/legend.js:429` `rampTicks`, `:460` `describeValueScale`, `:480` `describeRamp`, `:491` `describeBasisCounts` | Tick placement and scale/basis sentences. | Reusable for compact per-axis condition scales only in style; they are value ramps, not condition axes. |
| `core/value-scales.js:23` `VALUE_SCALES`, `:29` `AXIS_SCALES`, `:62` `SKEWED_DEFAULT_SHARE`, `:232` `valueScaleAvailability`, `:284-288` `defaultValueScale`, `:327` `valueScaleTransform` | "The one way this interface rescales a column of metric reads" (:2); a scale changes position/colour only, never a stored value (:6-9). | Any agreement statistic or comparison plot must compute on stored values, not transformed ones; display scale is separate. |

### a.4 Comparison views (`ui/compare.js`, `ui/compare-model.js`)

| file:line | What it does now | What the selector would need from it |
| --- | --- | --- |
| `compare.js:26-30` `TABS` | Radar, Parallel coordinates, Pairwise delta. | A dataset-agreement viewer would be a new tab or a separate view. |
| `compare.js:99-` `ComparePanel`; `:274-289` `update(state)` | **Series are shortlisted genes; axes are metrics.** `state = {ids, dataset, registry, tab, axisKeys}`. | Dataset comparison inverts the roles (datasets as series or axes, genes as points). Existing panel is not directly reusable without that change. |
| `compare.js:291-297` `scaleFor(metric)`; `:299-301` `zScore` | Robust scale computed over **all genes** for each metric key, cached per update. | Agreement between datasets would need its own scale per dataset (and over the shared gene set), not this gene-panel scale. |
| `compare.js:256-269` `activeAxes`; `:239-244` `setAxisKeys` → `handlers.onAxesChange` | Chosen axes win if ≥ `MIN_AXES`; else defaults minus dropped. Chosen keys persisted to `localStorage` `cyano.compare-axes.v1` (`app.js:95, 2236, 2250-2252`). Comment at `compare.js:278` still says "A link carries the chosen metrics", which no longer matches url-state v6. | Precedent for a reading preference kept out of the link. |
| `compare.js:579` `radiusFor`, `:722-724` ±Z_LIMIT labels, `:826-828` `zToY` | Map clamped z to geometry. | Shared code subject to audit item A-01 (clamp not marked). |
| `compare.js:662`, `:794` `drawMissingGlyph` calls; `:830-855` `brushedIds` ("Unknown is not inside any range", :839) | Missing values get a glyph outside the ring/below the axis; brushing never keeps unknowns. | Must hold in any new viewer (candidate-comparison-and-export.md §1). |
| `compare.js:336-345` `renderMeasurementNote` → `compare-model.js:44-56` `measurementLimitNote` | One line of replicate/condition/coverage per measured source on display, de-duplicated by `provenance.id`. | Already de-duplicates by source id; usable for N datasets if each has provenance. |
| `compare-model.js:24-27` `DEFAULT_AXES` | `tssInitiation, gc3, enc, rareFraction, cps, mfeStart, targetFraction, cai, tai`; borrowed PCC 7942 not an implicit default. | New datasets do not enter default axes unless listed. |
| `compare-model.js:68-72` `normalizeCompareAxes` | Sanitises a stored key list from `localStorage`. | Pattern for sanitising a stored dataset-toggle list. |
| `compare-model.js:81` `Z_LIMIT = 3`; `:113-126` `robustScale` (median, MAD×1.4826, IQR fallback); `:132-137` `zScore` (NaN for missing, clamped ±3) | Robust z. | A-01: 16.5% of `expression` and 15.7% of `tssInitiation` values are clamped on the shipped release and nothing marks them (O_data-use-audit-fixes__20261004.md:29-37). A new viewer reusing `zScore` inherits that defect until A-01 lands. |
| `compare-model.js:100-110` `SERIES_STYLES`, `seriesStyle` | Ten colour+dash+marker encodings; `repeated` flag beyond ten. | If datasets become series, the ten-series identity budget applies to datasets. |
| `compare-model.js:143-150` `axisUnavailableReason`; `:162-178` `defaultAxes` | Drops no-spread axes with a reason. | Same "dropped and explained" rule for a dataset with no spread or no overlap. |
| `compare-model.js:192` `presentRuns`; `:221` `missingRanks`; `:239` `countMissing`; `:285-296` `describeMissing*`; `:389` `drawMissingGlyph` | Missing geometry, fan-out, counts. | Directly reusable. |

### a.5 Filters and mask

| file:line | What it does now | What the selector would need from it |
| --- | --- | --- |
| `ui/filters.js:40-57` `orderTrafficCandidates(registry)` | Low-traffic threshold candidates: native measured expression, then borrowed measured (`isTargetOrganism === false`), then `cai`, `tai`, then remaining expression. | Each newly toggled measured dataset enters this list automatically if it is recognised as expression and has provenance; a dataset with `isTargetOrganism` undefined falls to `rest`. |
| `ui/filters.js:60-71` `defaultTrafficCandidate` | Implicit choice is native evidence or a local proxy, never a borrowed assay. | Toggling a borrowed dataset on must not make it the implicit threshold. |
| `ui/filters.js:129-135` `openRange` (`includeMissing: true`); `:457-480` `missingControl`; `:450-452`, `:638-639` | Every numeric filter with missing values shows an "Include the N genes with no …" checkbox, default on. | "What happens to genes missing from one selected dataset" (step 6) is already answered per metric by this control; a multi-dataset selection would need a per-dataset or union/intersection rule on top. |
| `ui/filters.js:388-392`, `:597` | Shows `formatExpressionSource(metric.provenance)` beside measured expression filters. | Same note per dataset. |
| `ui/filters.js:482-515` measured-only control | Shown only when the dataset records an expression basis. | Gene-level basis is primary-`expression` only. |
| `ui/filters.js:85-94` `clearedFilterState` | Atomic reset of all filter channels. | If a dataset toggle set is a filter channel it must join this reset; if it is a view preference it must not. |
| `app.js:307-335` `computeMask` | Applies `state.filters` per registry key; missing values kept unless `includeMissing === false`; counts `missingHidden` per key. | Filtering remains per metric key. |

### a.6 URL state and persistence

| file:line | What it does now | What the selector would need from it |
| --- | --- | --- |
| `core/url-state.js:21-28` `KEYS` | Short field names (`p, c, s, n, x, f, l, g, t, v, e, m, k, ver, lc, pr, ax, ay, cf, cs, xs, ys, po, pc, csc, dt`). | A dataset-toggle field would add a key here. |
| `core/url-state.js:30-64` `STATE_VERSION = 6` and its doc comment | Bump only when an omitted field would mean two things to two readers; history v1→v6 recorded. | See constraint c.2. |
| `core/url-state.js:73-76` `MEASURED_AXES_VERSION`, `LEGACY_METRIC_AXES` | Legacy-default preservation for omitted axes. | Precedent if the default dataset set ever changes. |
| `core/url-state.js:87-119` `defaultState` | All shareable fields and defaults. | New field and default. |
| `core/url-state.js:181-191` `encodeFilters`; `:193-206` `decodeFilters` | `key:min:max[:0]` where trailing `:0` = missing dropped. | Filters on dataset metrics already round-trip by key. |
| `core/url-state.js:209-285` `encodeState`; `:289-391` `decodeState` (v5 `cm` dropped at :384-387) | Encoder/decoder; unknown keys ignored. | New field must decode tolerantly (malformed field ignored without discarding neighbours, viewer-interaction-state.md:292-294). |
| `app.js:106-123` `store`; `:85-95` storage keys (`cyano.schemes.v1`, `cyano.shortlist.v1`, `cyano.compare-axes.v1`); `:523-530` `persist` | `localStorage` wrapper; every render writes the hash with `replaceState`. | Storage-vs-hash decision for the toggle set (c.2). |

### a.7 Gene detail, panels, provenance

| file:line | What it does now | What the selector would need from it |
| --- | --- | --- |
| `ui/side-panel.js:783-867` metric groups in `SidePanel` | For each family: `orderMeasuredFirst` rows (:784-786); value, unit, `no value` for non-finite (:817-823); basis tag for measured expression (:826-833); percentile bar (:835-847); **provenance note row beneath each metric with provenance**, `.provenance-warning` when `isTargetOrganism === false` (:852-862). | Per-gene per-dataset rows already exist by family; with many datasets the Expression family would grow linearly and repeat a full provenance sentence per row. Grouping/condensing belongs here. |
| `ui/side-panel.js:37-58` `BASE_OPEN_FAMILIES`, `metricFamilyStartsOpen` | Expression/Size/Translation open by default. | Group disclosure defaults. |
| `ui/side-panel.js:202` `pendingSection` | Loading section for files in flight. | Per-dataset loading state in detail. |
| `ui/side-panel.js:459-545` `tssEvidenceDisclosure` | Per-condition Tan 2018 tables and caveat (:476-482). | Existing per-condition display for one study. |
| `ui/panels.js:13-53` `PANELS` | Map panels (native, axes, risk, umap, perturbation) with blurbs; `axes` blurb promises a condition/replicate note (:26-29). | A side-by-side dataset viewer could be a new panel/tab; `core/left-panels.js:17-21` `LEFT_PANELS` (gene-viewer, scheme, filters) is the controls-column registry if the selector is a controls panel. |
| `app.js:1554-` `renderProvenance` (`:1619-1620`) | Provenance list shows only legacy `provenance.expressionSource`. | Multi-dataset provenance list. |
| `app.js:1079-1161` `renderAll` | Passes `registry`, `filters`, `missingHidden`, `basisCounts`, `trafficKey` to `FilterPanel`; `ids/dataset/registry/tab/axisKeys` to `ComparePanel`; ends with `persist()`. | State flow: hash/state → `normalizeAndApply` (`:1663-1703`) → `renderAll` → component `update()` → `persist()`. Selector state would join this path. |
| `app.js:1761-1771` `promotedFileKeys` | Later files a link's reveal waits for (category filter, protein filter, regulatory tab, pinned gene). | A link that enables a dataset in a later tier must add that file here. |
| `app.js:1788-1817` `flushLandings` | Recomputes specific start-up values per landed file, then `renderAll`. | Would need a branch that rebuilds the registry when a dataset file lands. |

### a.8 Export

| file:line | What it does now | What the selector would need from it |
| --- | --- | --- |
| `core/export-manifest.js:163-243` `caveatsFor` | Fixed caveat list; expression caveat built from **legacy `meta.expressionSource` only** (:184-188); Tan caveat from `tssEvidenceSource` (:189-193). | N datasets need per-source caveats (organism, basis, conditions) — data-contract.md:209-210 requires them wherever a value affects export. |
| `core/export-manifest.js:434` | Manifest carries `expressionSource: meta.expressionSource ?? null`. | Should carry the enabled dataset set analogous to `functionColourSources` (:437-440). |
| `core/export-manifest.js:510-525` manifest `metrics` | Per metric: key, label, unit, desc, method, origin, coverage, citationIds, family, source, scale. No `provenance`/condition object. | Structured per-dataset provenance absent from export. |
| `core/export-manifest.js:246-266` `EXPORT_FILE_KEYS`, `exportBlockedReason` | Export waits for named later files. | Dataset files in later tiers must be added. |
| `core/panel-export.js:170-205` `buildPanelExport` | Extends base export; appends a coverage-design caveat (:197-200). | Inherits whatever the base export does. |

---

## (b) Binding rules

Quotes are verbatim from the working tree.

| # | Quote | file:line | Implication for the feature |
| --- | --- | --- | --- |
| B1 | "Two datasets are comparable only when **every** axis the assay responds to agrees." | data-contract.md:142 | Current gate for sharing a layer or combined estimate. Conflicts with the owner's 2026-10-04 instruction (see d.1). |
| B2 | "These thresholds decide whether two datasets may share one displayed layer or a combined estimate. They are a starting rule … pending lab sign-off" | data-contract.md:137-141 | Thresholds are provisional; AAA row 13 is the sign-off point. |
| B3 | "A pair failing any axis may still be published, as separate selectable layers with their conditions stated. What it may not do is enter one combined estimate or one colour scale as though the difference were biological." | data-contract.md:153-155 | Grouping in a selector is allowed if each dataset stays a separate layer; pooling or one shared colour scale across non-comparable datasets is not. |
| B4 | "Record every rejected pair and its failing axis, and add a pair whose comparability is genuinely uncertain to the biological-decisions list rather than resolving it silently." | data-contract.md:155-157 | Agreement statistics must not auto-decide; uncertain pairs go to AAA row 14. |
| B5 | "Record each source's light, temperature, CO₂, medium, and growth phase, and keep values from different conditions in different layers." | data-contract.md:131-133 | Per-axis condition metadata is required per source; supports per-axis scales. |
| B6 | Threshold table: temperature "Within 2 °C, and both inside one regime: standard 28–32 °C or elevated 36–40 °C"; light "Within ±25% … both at or below 400 µmol photons m⁻² s⁻¹, or both above it"; light regime, CO₂ "ambient near 0.04% or elevated at 1% or more", medium, culture format and phase. | data-contract.md:144-151 | Defines the axes and regime boundaries a compact condition scale would show (e.g. 400 µmol boundary, 28–32/36–40 °C bands). |
| B7 | Evidence bases `direct`, `transferred`, `inferred`, `proxy`, `unknown`. | data-contract.md:52-58 | Each dataset row needs a basis label; site currently has none of these (a.1). |
| B8 | "Every non-native value must remain distinguishable from a native value." | data-contract.md:49 | Grouping must not visually merge native and transferred datasets. |
| B9 | "A sister-strain value is still `transferred`, never `direct`." … "the interface must still name the strain wherever the value is shown, filtered, coloured, ranked, or exported, and must still offer a direct-UTEX-only view." | data-contract.md:109, 114-115 | Selector needs a direct-UTEX-only restriction and strain names per dataset row. |
| B10 | "**Coordinates never transfer.**" | data-contract.md:119 | Positional datasets (TSS/TTS/TIS) in the selector are gene-relative offsets only. |
| B11 | "**Condition match still governs quantitative transfer.**" | data-contract.md:126 | Quantitative cross-strain display still condition-gated. |
| B12 | "Where a close-cluster value and a UTEX 3055 value both exist and disagree, prefer neither silently: keep both and record the conflict." | data-contract.md:86-87 | Disagreement display requirement. |
| B13 | "label the organism, evidence basis, conditions, and material caveat anywhere the value affects colour, filtering, ranking, panel selection, comparison, or export" | data-contract.md:209-210 | Every surface in section (a) that consumes a dataset must carry these labels (export currently does not for N sources, a.8). |
| B14 | "retain `null`/`unknown` when the mapping or estimate is not defensible. Neither is ever converted to zero, false, a median, or a confident annotation." | data-contract.md:212-213 | Missing-gene handling across selected datasets. |
| B15 | "raw counts from different assays or organisms are not commensurate. Transfer uses a documented common scale such as a within-source percentile, rank, or controlled qualitative band unless a validated cross-study model supports stronger calibration." | data-contract.md:215-218 | Agreement statistics and side-by-side views should operate on a documented common scale; rank-based statistics are consistent with this. |
| B16 | "Each source contributes **its own per-gene field**, named by its `metricKey`, and **its own `meta.metrics` entry**" | data-contract.md:471-472 | Matches registry mechanics (a.1). |
| B17 | "Raw source fields are never merged, averaged, or overwritten." … "A later best-available or consensus layer may use multiple admitted sources only as a separately named `inferred` field" | data-contract.md:476, 480-482 | A "group" in the selector cannot be a merged field; any combined value is a separate inferred metric. |
| B18 | "The build must not infer its inputs from a directory listing. `data/expression/sources.json` names every selected source explicitly" | data-contract.md:437-438 | Dataset list is manifest-driven; implemented by `scripts/build_features.py:384-385`. |
| B19 | "the interface must never present a mixed column as though it were one measurement." | data-contract.md:501-502 | Applies to any grouped display. |
| B20 | "If a unified best-available view is added, each row must carry a separate `bestAvailableBasis` … while a user can still restrict the view to direct UTEX 2973 measurements." | data-contract.md:508-512 | Contracted shape for a combined view. |
| B21 | "Wherever expression is displayed or used to filter, the interface states the source organism in plain words." | data-contract.md:675-677 | Per-dataset organism label. |
| B22 | "A threshold must not silently discard genes that simply have no measurement; offer an explicit \"include unmeasured\" control, defaulting to include." | data-contract.md:678-680 | Already implemented per metric (a.5). |
| B23 | "`genes.json` stays under 6 MB uncompressed" | data-contract.md:768-769 | Many per-gene dataset fields constrain payload placement. |
| B24 | `data-manifest.json` "must run **last**" and a mismatched manifest is refused by `tools/build_data_manifest.py check`, `tools/validate_contract.py`, and deploy. | data-contract.md:734-738 | New dataset files must be manifest-listed. |
| B25 | "Every new source needs a manifest entry with organism and strain, assay, conditions, units, licence, retrieval date, immutable artifact identifier, checksum, mapping method, orthology relationship, sequence identity/coverage when applicable, ambiguity, and missingness." | future-data-roadmap.md:67-70 | Admission prerequisites before any dataset appears in a selector. |
| B26 | "A model may help review bounded descriptions or produce a calibrated estimate, but must not decide licence permission, invent joins, or turn a prediction into a measurement." | future-data-roadmap.md:73-75 | Agreement statistics remain evidence for humans. |
| B27 | "Before publishing a source, report matched, unmatched, and ambiguous rows; … add contract and UI tests; and verify that direct-source nulls remain null." | future-data-roadmap.md:77-79 | Per-dataset admission checks. |
| B28 | "each pair of datasets must pass the condition-comparability thresholds before sharing a layer." | future-data-roadmap.md:28-29 | Restates B1 in the roadmap; would need the same revision as B1. |
| B29 | "Preserve every raw assay as a separate UI layer; publish any cross-source estimate separately on a documented common scale." | future-data-roadmap.md:62-63 | Matches the owner's per-dataset toggles. |
| B30 | "A permitted decision is a licence decision only: admission still runs the admission contract above" | future-data-roadmap.md:312-313 | A licence-permitted candidate is not yet a selectable dataset. |
| B31 | Breakpoints: "At 960 px the controls and analysis form two columns … At 1240 px detail becomes the third column." | responsive-workspace.md:19-20 | Selector placement must be specified at <960, 960–1239, ≥1240. |
| B32 | "Each rail stays at least 260 px wide and the map column at least 400 px wide." | responsive-workspace.md:29-30 | Compact condition scales in a rail must fit 260 px. |
| B33 | "This DOM order is also the single-column mobile reading and focus order; CSS never moves a later element visually ahead of an earlier one." | responsive-workspace.md:12-13 | Selector DOM position fixes its mobile order. |
| B34 | "Presentation widths stay out of URL and scientific exports." | responsive-workspace.md:33-34 | Viewer layout state is not hash state. |
| B35 | "The document itself must not scroll horizontally." / regression widths "375×812, 768×1024, 959/960 px, 1239/1240 px, 1280×800, and 1440×900" | responsive-workspace.md:79-80, 84-85 | Render checks for any new panel; wide comparison tables scroll in their own container. |
| B36 | "Below 560 px both labels sit above their controls" | responsive-workspace.md:55 | Label placement rule if the selector sits in a toolbar row. |
| B37 | Precedence "1. explicit URL fields; 2. local persistence only for fields an older or absent URL truly leaves unspecified; and 3. defaults." | viewer-interaction-state.md:251-256 | Toggle set precedence. |
| B38 | "A default that changes what an old snapshot means is versioned rather than applied to it." | viewer-interaction-state.md:258-259 | If the default dataset set changes as datasets are admitted, an omitted toggle field becomes ambiguous (c.2). |
| B39 | "A version number earns its place only where the **absence** of a field has to mean two different things to two readers" | viewer-interaction-state.md:275-277 | Same. |
| B40 | Colour-source toggles "govern function-category colouring and the legend counts only; the detail panel, shortlist and comparison tables, panel-designer gene list, search suggestions, and export always show every source" | viewer-interaction-state.md:89-93 | Precedent: a toggle that scopes a view without hiding evidence elsewhere. |
| B41 | "A file that has not landed has **unknown** content. Its place is taken by a statement that it is loading … never by a zero." | progressive-loading.md:15-18 | Toggled-on dataset in flight must read as loading. |
| B42 | "`pendingState`, `isLoading`, `hasFailed` and `firstUnsettled` are the only ways a view asks." | progressive-loading.md:23-24 | API constraint. |
| B43 | "**Exports wait.**" | progressive-loading.md:60 | Export blocked until enabled dataset files settle. |
| B44 | A link's filters "are **kept, not dropped**, while their file loads and while it has failed and may be retried" | progressive-loading.md:114-117 | A link enabling a not-yet-loaded dataset keeps that state. |
| B45 | "A gene with no measurement has **no position**. It is never the median, never zero, never an imputed value." | candidate-comparison-and-export.md:11-12 | Side-by-side viewer rule. |
| B46 | "A brushed range on an axis **never keeps** a candidate whose value there is unknown." | candidate-comparison-and-export.md:31-32 | Same. |
| B47 | "Chart, legend, accessible name, and table must agree." | candidate-comparison-and-export.md:34 | Same. |
| B48 | "Colour alone never carries identity." | candidate-comparison-and-export.md:48-49 | Dataset identity in a viewer needs a second channel. |
| B49 | "A default axis with no spread is **dropped and explained**, not drawn flat." | candidate-comparison-and-export.md:58 | Same for datasets. |
| B50 | "**the CSV rows and every manifest field carry the stored value, never a transformed one**" | candidate-comparison-and-export.md:77-78 | Agreement computed on stored values; display scale separate. |
| B51 | "Do not assume a single measured source: more than one may exist, so label by basis and source id" | candidate-comparison-and-export.md:95-97 | Directly supports N datasets. |
| B52 | AAA row 13: "**Confirm the condition-comparability thresholds before any multi-dataset layer ships.**" | AAA-biological-decisions-to-review.md:24 | A multi-dataset *layer* (pooled) is gated on lab sign-off; separate toggleable layers are not pooling. |
| B53 | AAA row 13 evidence: "CO₂ is reported for 41, replicate count for 46, light intensity for 66, temperature for 68" of 79 condition-set rows | AAA-biological-decisions-to-review.md:24 | Metadata gaps will be visible in compact scales as missing axes. |
| B54 | AAA row 14: "A pair may pass every threshold on paper and still not be comparable, or fail one axis narrowly and still be worth pooling." / "No pair is decided." | AAA-biological-decisions-to-review.md:25 | Aligns with owner's "human discretion"; decisions stay with the lab. |
| B55 | AAA row 15: UTEX 3055 "carries 303 pangenome CDS rows absent from all five close-cluster strains, and 134 UTEX 2973 CDSs have no UTEX 3055 counterpart, so a missing value is often gene content rather than a failed assay." | AAA-biological-decisions-to-review.md:26 | Missing-gene messaging must distinguish gene-content absence for UTEX 3055 datasets. |
| B56 | Step 3: "Report the agreement statistic between overlapping datasets and show it in the interface. A poor fit is displayed, never averaged away." | O_cross-strain-data-scan__20260927.md:411-412 | Agreement statistics are already a ticketed requirement. |
| B57 | Step 3: "Choose and justify a normalization per data type. Within-source percentile or rank is the contract's default" | O_cross-strain-data-scan__20260927.md:408-410 | Normalization per data type still to be chosen. |
| B58 | Step 3: "Raw per-source fields are never merged. A combined view is an additional layer with its own inputs, method, and uncertainty." | O_cross-strain-data-scan__20260927.md:419-420 | Restates B17. |
| B59 | Step 6: "The user can select several at once when a defensible normalization exists, with a visible warning and the agreement statistic when they do not align well." | O_cross-strain-data-scan__20260927.md:566-567 | Multi-select gated on normalization; owner's 2026-10-04 text allows toggling many regardless (d.3). |
| B60 | Handoff hard boundaries: "No admission.", "No lab decision.", "No claim without a checkable source." | claude-science-handoff.md:231, 237, 242 | This survey and any Claude Science agreement analysis are evidence only. |
| B61 | A-01: "The clamp itself is a visual encoding and may stay; hiding it may not." | O_data-use-audit-fixes__20261004.md:36-37 | A new viewer sharing `zScore`/`Z_LIMIT` must mark clamped values. |

---

## (c) Step-6 open items and the constraints on each

Step 6 lists as still undesigned: "placement at each breakpoint, URL-hash encoding,
interaction with the existing colour, axis, and filter selectors, and what happens to genes
missing from one selected dataset" (O_cross-strain-data-scan__20260927.md:569-571). Step 6
also names the "control at the bottom of the view" for multi-condition metrics (:563-564) and
single-paper selection (:565). The ticket's Verification section repeats "The dataset and
condition selectors (step 6) are not yet designed" (:605-606).

### c.1 Placement at each breakpoint

- Three layouts exist: single column below 960 px, two columns 960–1239 px, three columns
  ≥ 1240 px (responsive-workspace.md:19-20).
- DOM order is focus and mobile order; CSS cannot reorder visually (:12-13). Fixed centre
  order is map → comparison → designer → shortlist → provenance (:5-9), verified by
  `tests/js/layout.test.mjs` (:111).
- Rails ≥ 260 px, map ≥ 400 px (:29-30); compact condition scales placed in a rail must read
  at 260 px. No horizontal document scroll (:79-80).
- Controls column panels are a fixed registry, `core/left-panels.js:17-21` (gene-viewer,
  scheme, filters), whose order/collapse is encoded as `po`/`pc` (`url-state.js:27`).
  Adding a dataset panel there adds an id to `LEFT_PANELS`, which changes `DEFAULT_PANEL_ORDER`
  (`left-panels.js:26`).
- Step 6 asks for a control "at the bottom of the view" (:563-564); the map toolbar order is
  fixed in controls-column-and-resets.md (responsive-workspace.md:40-41).
- Regression widths: responsive-workspace.md:84-85.

### c.2 URL-hash encoding

- Field map `url-state.js:21-28`; version 6 (`:64`); versioning rule (`:30-63`,
  viewer-interaction-state.md:275-277).
- **Ambiguity of an omitted field.** If "no field" means "the default dataset set" and that
  default changes as datasets are admitted, an old link would silently show a different
  set — the situation viewer-interaction-state.md:258-259 requires versioning for. An
  explicit list avoids this but lengthens links.
- **Precedent for keeping reading preferences out of the link:** compare axes moved from
  hash `cm` (v5) to `localStorage` `cyano.compare-axes.v1` (v6) "to keep a shared link
  readable" (`url-state.js:384-387`; controls-column-and-resets.md:127-131). Counter-precedent:
  colour sources `cs` stay in the hash because they change what is drawn and are recorded in
  exports (viewer-interaction-state.md:97-99).
- Filters on dataset metrics already round-trip by metric key (`url-state.js:181-206`).
- Malformed field must be ignored without discarding neighbours (viewer-interaction-state.md:292-294).
- A link that enables a later-tier dataset must add that file to `promotedFileKeys`
  (`app.js:1761-1771`) and keep the state while it loads (progressive-loading.md:114-117).
- Tests: `tests/js/url-state.test.mjs`.

### c.3 Interaction with colour, axis and filter selectors

- All three consume the single registry (`app.js:1688-1690`); grouped selectors use
  `registry.families` (`metric-registry.js:482-495`; `app.js:1339-1372`
  `familyMetrics`/`buildColorSelect`). Toggling a dataset off could mean either hiding its
  metric from these selectors or only from a dataset viewer; nothing in the code expresses
  "toggled off" today.
- Colour: one metric, one ramp, one legend (`legend.js:510-623`). Colouring by a group is not
  representable and would contravene data-contract.md:153-155 for non-comparable datasets.
  Fresh colour defaults must not change (`metric-registry.js:163-185`).
- Axes: Metric X vs Y fallback/defaults via `resolveDefaultMetricAxes` (`app.js:1700-1702`);
  a toggled-off dataset currently selected on an axis or as `colorBy` would need a resolution
  rule (the existing pattern is self-healing to the default, viewer-interaction-state.md:287-289).
- Filters: low-traffic candidate order (`filters.js:40-71`) is automatic; a borrowed dataset
  is never the implicit threshold. "Clear all filters" is atomic (viewer-interaction-state.md:301-303;
  `filters.js:85-94`); whether the toggle set is a filter channel decides whether it joins it.
- Comparison panel: chosen axes in storage; measurement-limit note de-duplicated by
  `provenance.id` (`compare-model.js:44-56`).

### c.4 Genes missing from one selected dataset

- Per metric, missing is unknown, kept by default, with an explicit include/exclude control
  (data-contract.md:678-680; `filters.js:457-480`; `app.js:317-334`).
- In comparison geometry, missing has no position, is marked, fans out, and is counted
  (candidate-comparison-and-export.md:11-32; `compare-model.js:192-296, 389`).
- UTEX 3055 absence is often gene content (data-contract.md:83-86; AAA row 15), and the
  contract forbids rendering it as zero or negative.
- Undecided: whether a multi-dataset view uses the union or intersection of genes for
  agreement statistics, and how a gene absent from some selected datasets is shown in a
  per-gene dataset strip. No existing code or rule settles this beyond B14/B45.

### c.5 Multi-condition control and single-paper selection (step 6 bullets 1–2)

- Only Tan 2018 has a structured condition list (`meta.tssEvidenceSource.conditions`), and its
  pooled score is one metric (`tssInitiation`) whose `condition` string names four pooled
  conditions. Per-condition values exist only inside `tss_evidence.json` rows
  (`validate_contract.py:1343-1345` checks `control, dark, highLight, highTemperature`).
  A "select among conditions" control has no per-condition metric to switch between today.
- No "paper" or "study" grouping key exists in `meta.expressionSources`; `id` is a per-dataset
  accession.

---

## (d) Risks and conflicts noticed

1. **Owner instruction vs. the all-axes gate.** The owner's 2026-10-04 instruction permits
   judging comparability from data ("compare the data and see if the distributions are similar
   enough") and leaves the final call "to human discretion … based on certain metrics + their
   conditions." data-contract.md:142 (B1) and future-data-roadmap.md:28-29 (B28) make
   comparability a pass/fail on every condition axis. The two rules disagree on what decides
   "one condition." AAA row 13 (B52) already marks the thresholds as unsigned; AAA row 14 (B54)
   already anticipates human case-by-case judgement. Revising B1/B28 is a contract change for
   the in-repo agents and the lab, not for this survey.
2. **Grouping vs. layering.** The owner asks for datasets "grouped by similar conditions but
   not explicitly bound by them," including an "Other" group. Under B3/B5/B17, a group can only
   be a display grouping of separate layers; if a group were ever rendered as one colour scale
   or one value it would contravene data-contract.md:153-155 and :476.
3. **Multi-select gate.** Step 6 permits multi-select "when a defensible normalization exists"
   (B59); the owner's text allows toggling many datasets on regardless, with metrics shown for
   comparison. The step-6 wording would need to follow the owner's instruction.
4. **Package D status is stale in two tickets.** The scan ticket says pair scoring "waits on
   package D, which has not been sent" (O_cross-strain-data-scan__20260927.md:604-605), and the
   offload ticket says "Package D has not been sent" (O_claude-science-offload__20260927.md:30),
   while `docs/notes/handoff/cyano_package_D_pairs_20261004.tsv` (941 data rows; verdicts:
   731 not comparable, 178 undecidable, 32 escalate, 0 comparable) and
   `RET_claude-science-session__20261004.md` are present as untracked files. The tickets may
   predate intake; this is reported, not resolved.
5. **Condition metadata is unstructured where the UI reads it.** `meta.expressionSources[].condition`
   is one free-text string; package B's `conditions` column is semi-structured text
   (`axis = value [source quote]` clauses joined by `;;`, 88 rows). Compact per-axis scales and
   any condition-distance metric need structured per-axis fields (value, unit, "not reported"
   vs. "not retrieved"), which requires a `meta.json` schema addition, a pipeline writer
   (`scripts/build_features.py:384-385, 1116`) and validator checks (`tools/validate_contract.py:1295-1302`).
6. **Provenance attaches only to expression-recognised metrics** (`metric-registry.js:418-432`,
   `:42-47`). Proteomics, ribosome occupancy, TIS/TTS datasets would load without provenance
   and therefore without condition notes, organism warnings, or basis tags.
7. **Legacy single-source readers.** Provenance panel (`app.js:1619-1620`), `dataset.provenance`
   (`dataset.js:233`), export caveat (`export-manifest.js:184-188`) and export manifest
   (`export-manifest.js:434`) read only `meta.expressionSource`. With N datasets, these surfaces
   would omit every source but GSE205444 (TSS has its own caveat path), contrary to B13.
8. **Registry is built once.** `app.js:1688-1690` builds the registry only if absent;
   `rebindLiveMetrics` rebinds live metrics only. Dataset payloads split into later tiers
   (needed under the 6 MB `genes.json` budget, B23; `genes.json` is 5,169,989 bytes now) would
   need a registry rebuild path and `flushLandings` handling.
9. **A-01 shares code with any new comparison viewer.** Unmarked ±3 robust-z clamping affects
   16.5% of `expression` and 15.7% of `tssInitiation` values (O_data-use-audit-fixes__20261004.md:29-37).
   Reusing `zScore`/`Z_LIMIT` (`compare-model.js:81, 132-137`) for dataset comparison inherits
   the defect until A-01 lands; a dataset-agreement view also needs a scale over the shared gene
   set rather than the per-metric all-gene scale at `compare.js:291-297`.
10. **Compare view roles are genes × metrics.** A dataset-comparison viewer is a different
    geometry (datasets as series or axes); the ten-series identity budget (B48;
    `compare-model.js:100-110`) would cap simultaneously distinguishable datasets at ten.
11. **Contract fields with no implementation.** `direct/transferred/inferred` bases,
    `sisterStrain`, `bestAvailableBasis` and a direct-UTEX-only view (B7, B9, B20) are required
    by the contract but read nowhere in `site/js`; the only organism signal is
    `provenance.isTargetOrganism`.
12. **Stale code comment.** `compare.js:278-280` says "A link carries the chosen metrics", but
    v6 moved them to `localStorage` (`url-state.js:384-387`). Cosmetic, noted for whoever
    extends that panel.
13. **Hash ambiguity if the default set moves** (c.2, B38-B39).
14. **Two Tan 2018 layers.** AAA row 11 keeps the site-row layer (1,789 genes) and pooled
    score (1,727) independent; meta.json counts both without naming the layer (audit item
    A-10, O_data-use-audit-fixes__20261004.md:75-79). A dataset list that shows coverage per
    dataset must name which layer a count describes.

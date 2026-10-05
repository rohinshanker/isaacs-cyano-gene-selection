# Data-use audit — 20261003

Commit audited: `70bc5900` on `main`, plus the uncommitted working-tree modifications listed below.

Findings table: `cyano_data_use_audit_20261003.tsv`, SHA-256 `708a3294f993fc1574f76ef6a969e519721a4c21816c262f3db9fe19d60e4913`.

## Findings

### A-01 — denominator or scale error

- **Location** — site/js/ui/compare-model.js:81 and :129; drawn at site/js/ui/compare.js:579 and :722
- **Claim** — Z_LIMIT = 3, with the comment "z-scores are clamped to this many robust spreads either side of the median" and "Robust z-score of one value, clamped to ±Z_LIMIT.". The radar draws rings at z = -1, 1, 3 and the parallel-coordinates axis is labelled only "+3" and "median".
- **Source** — Nothing in the view or in docs/validation/candidate-comparison-and-export.md marks a clamped value as clamped. On the pinned release 421 of 2,551 valued genes (16.5%) exceed |z|=3 on `expression` and 272 of 1,727 (15.7%) on `tssInitiation`; the largest robust z is 432.3 and 378.4 respectively. Seven of the 35 registry metrics clamp more than 5% of their valued genes.
- **Severity** — high - the comparison views are where two shortlisted candidates are judged against each other. A gene at robust z = 432 is drawn at the same rim position as one at z = 3, so a reader comparing two candidates on measured expression or TSS initiation sees them as equal when one is two orders of magnitude further from the median. This is the "ramp flattening a heavy-tailed measurement into one bucket" case the audit brief names, on the two metrics most likely to be compared.
- **Evidence** — Recompute: median and 1.4826*MAD (IQR fallback, as robustScale does) over each metric column of site/data/genes.json, then count |(v-median)/spread| > 3. For `expression`: 421 of 2551. Open the radar with two genes whose expression z exceeds 3 and observe identical rim placement.
- **Confidence** — high - the clamp is explicit in the source and the counts are computed from the shipped genes.json with the same robust-scale definition the code uses. Uncertain only in whether the owner considers rim placement self-evidently a clamp.

### A-02 — meaning drift

- **Location** — site/js/core/gene-view-model.js:106 against site/js/ui/chromosome-view.js:1302 (paintTss)
- **Claim** — The gene visualizer places each Tan 2018 gTSS at "offset: -site.sourceStartDistanceNt", i.e. the published distance measured back from THIS release's start. The chromosome view places the same site at its published absolute coordinate (its own docstring opens "Tan 2018 gene-linked start sites, at the absolute positions that study" and continues "published on this assembly.").
- **Source** — Both choices are individually documented (docs/validation/controls-column-and-resets.md:186-189; docs/validation/chromosome-view.md:65) and both are defensible. What no document or caveat records is that they disagree. Recomputing the implied distance from site/data/genes.json starts against the published positions in site/data/tss_evidence.json: 2,196 of 2,432 gTSS rows agree exactly (90.3%), but 236 rows over 178 of the 1,789 loci differ, by 3 to 198 nt (median 34.5). For 15 sites the published position now falls INSIDE the current CDS (implied distance negative, to -146 nt), e.g. M744_RS04380 / gTSS+849362 (published 22 nt, implied -146) and M744_RS01035 / gTSS+192954 (published 38, implied -121).
- **Severity** — high - a reader who locates a promoter in the gene visualizer and then finds the same TSS on the chromosome view gets two genomic positions up to 198 nt apart, with nothing saying which is which. For the 15 sites whose published position is now inside the CDS, the gene visualizer still draws an upstream mark, so a construct boundary drawn from that panel would be placed outside the region the source actually reported.
- **Evidence** — For each entry of site/data/tss_evidence.json take position and sourceStartDistanceNt; take the matching gene start (start for + strand, end for -) from site/data/genes.json; implied = start-position on +, position-end on -. Compare implied with sourceStartDistanceNt. 236 of 2432 differ.
- **Confidence** — high - computed from the two shipped files; the 90.3% exact agreement validates the strand arithmetic. No judgement is offered on which placement is right; that is a lab decision.

### A-03 — document drift

- **Location** — site/js/core/live-metrics.js:235-238, disclosed at site/js/core/projection-help.js:12 and :20
- **Claim** — "const fallback = finite > 0 ? sum / finite : 0;" then "matrix[r * cols + c] = Number.isFinite(v) ? v : fallback;" - buildFeatureMatrix substitutes the column mean for every missing cell before the risk and perturbation PCAs are fitted. The help text says so: "Unknown cells use the finite mean of their column."
- **Source** — docs/validation/data-contract.md states "The site renders null as an em-space, never as zero", and every metric in site/data/meta.json carries missingPolicy "null renders as unknown, never as zero or median". The contract records no exception for projections. docs/validation/metric-explanations.md:7 grants one - "skipping fields missing from the registry, mean-imputing nonfinite cells" - but that document is not the authoritative one and the data contract never refers to it for this rule.
- **Severity** — low on this release, latent thereafter - none of the 14 pipeline-side RISK_FEATURES has a null in the shipped genes.json and the scheme-derived columns are complete, so the fill is currently dormant and no gene is misplaced today. It is unlabelled per gene: if any feature column ever gains a null, the affected gene is silently placed at the centroid of that axis and drawn as an ordinary dot. Two validation documents currently give opposite answers about whether that is allowed.
- **Evidence** — Count nulls per RISK_FEATURES key in site/data/genes.json: all zero today. Read live-metrics.js buildFeatureMatrix and compare with the missingPolicy string on any metric in meta.json and with metric-explanations.md:7.
- **Confidence** — high on the code and the document conflict; high on the dormancy, which is computed. Whether the owner intends metric-explanations.md to override the data contract is not something the audit can settle.

### A-04 — prose overstatement

- **Location** — site/js/ui/length-explorer.js:154 (aria-label), :198 (caption), :164 (per-bin title), gated at :146
- **Claim** — The histogram's accessible label reads "Blue shows loci inside the selected range; grey shows the rest.", the caption template reads "blue counts loci inside the selected range, " followed by "grey counts the rest.", and and every bar title is the template "Bin ${index + 1}: ${passed[index]} of ${count} loci within range".
- **Source** — Three lines earlier the same method passes null for both bounds whenever the cohort is not the CDS-length cohort: "cohort.field === 'cdsLengthNt' ? (range?.min ?? null) : null". passingLengthBins (site/js/core/length-cohorts.js:87-94) then counts every finite value as passing, so the blue bar exactly covers the grey one and the whole chart is blue. The component's own text summary gates the identical clause correctly at line 49 ("if (cohort.field === 'cdsLengthNt')").
- **Severity** — medium - for the gene-span cohort the length range filter does not apply at all, but the chart tells the reader every locus is inside their selected range. A screen-reader user has only the aria-label and no way to see that the chart is uniformly blue, so they are told a filter result that was never computed.
- **Evidence** — Open the length explorer, choose a gene-span cohort, set a narrow length range, and read the aria-label, the caption and any bar tooltip. Compare with the text summary above the chart, which correctly omits the range clause.
- **Confidence** — high - the gating condition, the null bounds and the passingLengthBins behaviour are all in the supplied source and agree.

### A-05 — meaning drift

- **Location** — site/js/ui/regulatory-sites.js:113
- **Claim** — Every entry of regulatory_tss.json.sourceWarnings is rendered with the fixed prefix "Source caution — Dark vs control: ".
- **Source** — Each warning object in site/data/regulatory_tss.json carries its own comparison field, which exists precisely to say which comparison the caution concerns; the renderer never reads it. Both shipped warnings (aTSS-320358, iTSS+320358) are comparison "dark", so the label is accurate on this release.
- **Severity** — low, latent - correct today. A warning added for high light or high temperature would be presented to the reader as a caution about the dark comparison, attaching a source dispute to the wrong condition.
- **Evidence** — grep "sourceWarnings" in site/data/regulatory_tss.json: two entries, both comparison "dark". Read regulatory-sites.js:113, which interpolates only sourceWarning.message.
- **Confidence** — high - the discarded field and the hardcoded string are both visible in the shipped files.

### A-06 — disallowed fill

- **Location** — site/js/ui/regulatory-sites.js:80
- **Claim** — "if (row.source_start_distance_nt) {" gates the note built from "nt from the 2018 start model; " and "this distance was not recalculated against current coordinates."
- **Source** — A truthiness test treats a distance of exactly 0 as absent. The three sibling code paths that read the same field all use a finiteness test instead: site/js/ui/side-panel.js:501, site/js/core/gene-view-model.js:103, site/js/core/chromosome-model.js:524. In site/data/regulatory_tss.json the value 0 does not occur (180 nulls, 0 zeros), but it occurs 47 times in the sibling gTSS extract data/expression/tan2018_utex2973_tss_table_s1.tsv, so 0 is a real value of this field in this source.
- **Severity** — low, latent - no row in the file this view reads is affected today. Were one added, a site sitting exactly at the 2018 annotated start would lose both its distance and the "not recalculated against current coordinates" caveat, which is the one sentence telling the reader the number is paper-era.
- **Evidence** — Count zeros in source_start_distance_nt: 0 in site/data/regulatory_tss.json rows, 47 in data/expression/tan2018_utex2973_tss_table_s1.tsv. Compare the guard at regulatory-sites.js:80 with side-panel.js:501.
- **Confidence** — high.

### A-07 — disallowed fill

- **Location** — site/js/ui/gene-viewer.js:235, enabled by site/js/ui/format.js:53
- **Claim** — "${formatCount(model.lengthNt)} nt, ${formatCount(model.lengthCodons ?? 0)} sense codons" renders a missing codon count as the literal "0 sense codons". formatCount itself is "return Number(value).toLocaleString('en-US');" with no missing guard, so Number(null) prints "0".
- **Source** — site/js/ui/format.js opens with "Value formatting. A missing value is an em-space, never a zero." and exports MISSING for exactly this purpose; formatValue, formatDelta and formatPercentile all return MISSING for a non-finite input. The data contract gives the same rule. The two sibling views pass the same field without the coercion: site/js/ui/side-panel.js:645 and site/js/ui/gene-sequence-view.js:273.
- **Severity** — low, latent - lengthCodons has no nulls in the shipped genes.json, so no gene displays "0 sense codons" today. It is the only place in the interface that would write a missing count as zero, and formatCount would do the same for any count that becomes nullable later.
- **Evidence** — grep "?? 0" in site/js/ui/gene-viewer.js:235; read the header of site/js/ui/format.js; count nulls in lengthCodons across site/data/genes.json (zero).
- **Confidence** — high.

### A-08 — disallowed fill

- **Location** — site/js/ui/loadings.js:46 and :69
- **Claim** — "strength: Math.hypot(entry.pc[0] ?? 0, entry.pc[1] ?? 0)" ranks the strongest contributors, and "row.append(label, bar(entry.pc[0] ?? 0), bar(entry.pc[1] ?? 0))" draws them.
- **Source** — Same rule as A-07: a missing loading becomes a real zero, drawn as a zero-width bar indistinguishable from a genuine zero loading, and scored as a true zero in the ranking that selects which contributors are shown. site/data/codon_pca.json has 59 loadings with no non-finite pc component, and the live PCA always produces finite loadings, so nothing is affected today.
- **Severity** — low, latent - a missing component would silently reduce a contributor's rank rather than mark it unknown, which is a quiet way to drop a feature from the list the reader uses to interpret an axis.
- **Evidence** — Check site/data/codon_pca.json loadings for non-finite pc entries: none. Read loadings.js:46 and :69.
- **Confidence** — high on the code; the dormancy is computed from the shipped file.

### A-09 — document drift

- **Location** — site/data/genes.json field expressionPercentile against site/js/core/stats.js:77 (percentileRank)
- **Claim** — The pipeline-written expressionPercentile uses the average-rank convention - meta.json describes it as "Average-rank percentile of the measured PCC 7942 expression values, in (0, 1]" and the shipped column reaches exactly 1.0. The browser's percentileRank returns "(below + equal / 2) / sorted.length", the mid-rank convention, whose range on the same column is 0.000196 to 0.999804.
- **Source** — docs/validation/metric-convention-parity.md exists to keep one quantity from having two definitions across the pipeline and the browser, and pins CAI, tAI, ENC, GC3 and codon-pair score with a 1e-6 tolerance. It has no row for the percentile convention, and the mid-rank form is used for the gene-detail rank column (site/js/app.js:245-252), the percentile colour ramp and the percentile axis (site/js/core/value-scales.js:362-369).
- **Severity** — low - the two conventions differ by 1/(2n), at most 1.97e-4 on this column, so no reader draws a wrong scientific conclusion from the magnitude. The defect is that the parity document does not cover a quantity that now has two definitions, which is exactly the condition it was written to prevent.
- **Evidence** — Recompute both conventions over the 2,551 finite expression values in site/data/genes.json and difference them against the shipped expressionPercentile: average-rank matches to 5.0e-7 (rounding), mid-rank differs by up to 1.97e-4.
- **Confidence** — high - computed. The only uncertainty is whether the owner regards the stored column and the live scale as the same quantity; they carry the same word in the interface.

### A-10 — document drift

- **Location** — site/data/meta.json: tssEvidenceSource.summary.genesWithoutMappedTss and metrics.tssInitiation.desc
- **Claim** — The same file states "genesWithoutMappedTss": 926 - which implies 1,789 of 2,715 genes carry TSS evidence - and, in the metric description, "available for 1,727 of 2,715 genes".
- **Source** — Both numbers are correct for their own layer and docs/validation/data-contract.md:608 explains the split ("The former has 1,789 exact-locus genes and the latter 1,727; their intersection is 1,317, leaving 472 site-only and 410 score-only loci"). meta.json is the file the site reads at load, and neither of its two counts names which layer it describes.
- **Severity** — low - no displayed value is wrong. A reader or a future tool taking coverage from meta.json alone can report 1,789 or 1,727 for "genes with Tan 2018 TSS data" and be right either way, with no field to disambiguate. This bears on open lab decision rows 13-15, which the audit does not resolve.
- **Evidence** — Read meta.tssEvidenceSource.summary and meta.metrics.tssInitiation.desc in site/data/meta.json; 2715 - 926 = 1789 != 1727. Confirm the shipped column: genes.json tssInitiation is non-null for exactly 1,727 genes; tss_evidence.json has exactly 1,789 keys.
- **Confidence** — high - computed from the shipped files.

## Checked and found correct

- **Pipeline-to-browser value fidelity.** Every value in data/expression/tan2018_utex2973_tss_initiation.tsv (1,727 rows) and data/expression/GSE205444_pcc7942_wt_bg11_day1.tsv (2,551 rows) reproduces exactly in site/data/genes.json: 0 mismatches, 0 shipped values absent from the source table.
- **Expression coverage claims.** meta.expressionSource.coverage 2,551 of 2,715 and meta.expressionProxy.coverage 2,715 of 2,715 both match the shipped columns exactly. meta.metrics.tssInitiation 'available for 1,727 of 2,715 genes' matches the shipped column (see A-10 for the second count in the same file).
- **Tan 2018 condition metadata.** meta.metrics.tssInitiation describes the control as 33 degC, 50 umol photons m-2 s-1, 3% CO2; the paper's Methods read 'standard (control) culture conditions (33 °C, 50 μmol photons/m2/s constant illumination, 3% CO2 aeration)'. meta.tssDiscoveryMinimumRawReadsInAnyLibrary 300 matches 'only TSSs with a minimum of raw reads ≥300 at one of the libraries were kept'. meta.replicatesPerCondition 2 matches 'each of the two replicate cultures'. The pinned Table S1 extract honours the threshold: the minimum row-maximum raw count across all 2,475 gTSS rows is exactly 300.
- **Tan 2018 results-vs-methods conflict.** The paper gives 2 h in Results and 30 min in Methods for the high-light exposure. data/expression/TAN2018_TSS_PROVENANCE.md records the conflict and declines to assert a duration, which is the correct handling and needs no finding.
- **TSS initiation is never called abundance.** Every one of the six user-facing strings that mention a TSS alongside abundance wording is a disclaimer, not a conflation (side-panel.js:478, gene-viewer.js:305, tss-evidence.js:5, export-manifest.js:192, README.md:96 and :119). No view, export column, filter label or metric description presents initiation as transcript abundance.
- **PCC 7942 essentiality counts.** site/data/pcc7942-essentiality-v1.json reproduces docs/validation/pcc-essentiality.md exactly: 2,542 admitted joins, 660 essential, 154 beneficial, 1,617 non-essential, 71 ambiguous, 1 not_analyzed, 39 missing, 173 unknown, over 2,715 plotted loci. No ambiguous, not_analyzed or absent call is rendered as non-essential anywhere in byLocus.
- **Borrowed-evidence ordering.** orderTrafficCandidates (site/js/ui/filters.js:40-57) ranks native target-organism measurements first, then borrowed measured assays, then proxies, keyed on provenance.isTargetOrganism exactly as the data contract's expression section requires. defaultTrafficCandidate (:60-70) never implicitly selects a borrowed assay.
- **Paint priority and missing values.** site/js/core/paint-priority.js gates the valued tier on hasValue before any value is compared, so its Number.isFinite(signed) ? signed : 0 guard can never lift a gene with no value into the valued tier; the 'lowest on top' direction reverses only that tier. Documented in the module and consistent with the contract.
- **Percentile populations.** The percentile axis ranks the filter-visible cohort (metric-axes.js:144-147) while the colour ramp and the gene-detail rank column rank every valued gene (app.js:245-252, app.js:641). The split is deliberate and is stated in docs/validation/explicit-metric-axes.md:90-95. Only the rank convention is unpinned - see A-09.
- **Operon fields.** operonId and operonPosition are null for all 899 singleton genes and operonSize is 1 for exactly those genes, matching both metric descriptions. No singleton is given a fabricated position.
- **Metric family grouping.** The shared 'Expression' family on the PCC 7942 abundance metric and the UTEX 2973 TSS metric is used only to group menu entries (filters.js:242, side-panel.js:785, compare.js:358, panel-designer.js:76). No code averages, merges or columns them together, as data/expression/TAN2018_TSS_PROVENANCE.md requires.
- **Export caveats.** site/js/core/export-manifest.js:163-242 attaches, per export, the PCC 7942 organism caveat, the two-culture Tan 2018 limit with its initiation-not-abundance sentence, the Rubin cross-strain assumption, the GO IEA computational-suggestion note and the derived-category threshold. The expressionBasis column is defined in the manifest as measured/proxy/none/unrecorded.
- **Precomputed projections.** The native codon map and the baseline risk UMAP emit NaN for a gene without coordinates (panels.js), so such a gene is dropped rather than placed. All 2,715 genes carry both, so neither path is exercised. This is the opposite handling to the live PCAs in A-03.
- **CAI reference set.** meta.caiReferenceSet.locusTags holds exactly 71 entries, matching both meta.caiReferenceSet.n and the '71-gene ribosomal-plus-housekeeping reference set' in the CAI metric description.
- **Table S1 extraction scale.** meta.tssEvidenceSource.summary.sourceRows 2,475 matches the row count of data/expression/tan2018_utex2973_tss_table_s1.tsv, and site/data/tss_evidence.json has exactly 1,789 locus keys, matching summary.matchedGenes.

## Not checked, and why

- **The deployed site.** Every check was run against the mounted working tree. https://rohinshanker.github.io/isaacs-cyano-gene-selection/ was not fetched, so nothing here confirms the deployed build matches this tree.
- **Rendered output.** No browser was run. Findings about what a reader sees are derived from the source that produces it, not from a render. A-01 and A-04 in particular would be worth confirming on screen before a fix is designed.
- **Two uncommitted UI files.** site/js/ui/chromosome-view.js and site/js/ui/gene-viewer.js carry uncommitted modifications in the mounted tree. A-02 and A-07 cite those working-tree contents, not commit 70bc590 as pushed.
- **Exhaustive per-file semantic sweep.** A model-assisted read covered 49 of 84 file chunks; the remaining 35, including app.js, chromosome-view.js chunk 0, filters.js, compare.js and panel-designer.js, were covered instead by targeted pattern sweeps for the named hazards (null-to-zero and null-to-false coercion, percentile and z-score populations, clamping, median or mean imputation, initiation-versus-abundance wording, formatCount arguments) plus direct reading of the matches. That is narrower than a full read of those files, and a prose defect in them that matches none of those patterns would not have been caught.
- **Rubin 2015 and Adomako 2022 primary text.** The essentiality claims were checked against docs/validation/pcc-essentiality.md and the shipped JSON, which reproduce exactly. The Rubin and Adomako papers themselves were not re-read in this pass; Tan 2018 was.
- **Open lab decisions.** Rows 13 to 15 of docs/validation/AAA-biological-decisions-to-review.md concern the TSS layer split that A-02 and A-10 touch. The audit reports where the unresolved question shows in the interface and resolves nothing.

## Candidates raised and rejected

Recorded so a later audit does not re-raise them as new.

- "TypeSafe Jev" reads as a fabricated provenance label in legend.js:288 and go-iea-essentiality.js:132 — Rejected. TypeSafe System One with pinned model jev-1.13.0 is a real, documented judgment source: docs/validation/cai-reference-set.md:24-27, source-derived-categories.md, citations.json, and the judgment blocks inside site/data/go-iea-essentiality-v1.json and source-derived-categories-v1.json.
- "Lab-reviewed category" in gene-search-results.js:60 may label a model-derived category — Rejected. scoreReviewedCategory (site/js/core/gene-search.js:114-118) reads only gene.reviewedFunctionLabels and carries the comment "Only labels assigned by the reviewed table can match this tier." Derived categories cannot reach that tier.
- chromosome-view.js paintTss places Tan 2018 TSSs at absolute coordinates, which the no-coordinate-transfer rule forbids — Rejected. Tan 2018 measured UTEX 2973 itself, on CP006471/CP006472/CP006473, the genome of record. The cross-strain coordinate ban does not apply, and the paper-era caveat concerns the gene model, not the assembly. The real issue is the divergence between the two views, filed as A-02.

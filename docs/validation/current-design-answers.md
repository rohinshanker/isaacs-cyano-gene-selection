# Current design answers for the lab feedback

- Purpose: Answer the lab's design questions from the current, cited code and release records.
- Scope: The UTEX 2973 site as checked against this repository on 2026-09-22.
- Last verified: 2026-09-22
- Genome: *Synechococcus elongatus* UTEX 2973 RefSeq assembly `GCF_000817325.1`; annotation release `GCF_000817325.1-RS_2026_05_13`.

## Which records are on the map, and do they lead to recorded proteins?

The plotted set is **2,715 screened protein-coding CDSs**, not every annotated gene or RNA. The pipeline starts from 2,722 CDS sequences and excludes seven pseudogenes or invalid coding records using the rules in [the data contract](data-contract.md). The 2,715 CDSs correspond to **2,711 unique RefSeq protein FASTA records**, because four protein accessions each occur at two loci. The [protein identity audit](protein-evidence.md) verifies the CDS translations against those records. A protein accession is evidence of an annotation/sequence record; it is not proof of protein detection in a UTEX 2973 experiment. The deposited proteomics materials do not support an admitted per-locus detection list, so that evidence remains unknown. The length explorer has a RefSeq protein-record cohort; the separate protein-evidence filter shows direct UTEX 2973 detection as unavailable with the reason. [Genome provenance](genome-provenance.md) explains the counts, and the [annotation runbook](annotation-release-readiness.md) describes exact protein and PCC 7942 cross-references.

The coding sequence is the sum of its CDS segments, including its terminal stop. A joined gene such as `prfB` is therefore shorter than the span from its first to last genomic coordinate. In the current plotted data, the shortest CDS is **75 nt** and one is exactly 75 nt; there are none below 75 nt. This observation does not validate every short annotation. The length view flags CDSs strictly below 75 nt for annotation review without excluding them.

## Can I filter a length interval now?

Yes. In **Filters → Add filter**, choose **Size → CDS length**, select **Add**, then set the inclusive minimum and maximum to, for example, **201** and **2001 nt**. This uses `lengthNt`, including the stop. Each numeric filter has a small histogram. The separate **Lengths** tab compares all 2,776 annotated gene/pseudogene features, the 2,715 plotted CDSs, and RefSeq protein-record loci. Direct proteomics detection appears as unavailable because an accepted per-locus list is missing. Switching the chart cohort does not change the map population or refit its coordinates. [Length cohort definitions](length-cohorts.md) distinguish gene span from joined CDS length.

## What do “rare codon,” CAI, and tAI mean here?

| Feature | Current convention | Important limit |
| --- | --- | --- |
| Rare codon | A sense codon whose frequency **within its amino-acid synonym family** across all included UTEX 2973 CDSs is below **0.1**. The pipeline counts its fraction, total, longest consecutive run, and count in the first 50 sense codons. | This is a genome-wide usage rule, not a measured translation-speed threshold. |
| CAI | Sharp–Li relative adaptiveness from a fixed **71-locus** ribosomal/housekeeping product-name reference. A zero-count synonym gets a 0.5 count; the gene score is a geometric mean excluding Met and Trp. | The reference is a reproducible convention, **not measured high expression**. The 71-locus set is frozen for this release; a blinded semantic audit identified ten plausible additions for future biological review. |
| tAI | dos Reis-style adaptiveness calculated from the annotated **genomic tRNA gene copies** and bacterial wobble penalties. The gene score is a geometric mean excluding Met. A codon with zero modeled supply receives the geometric mean of nonzero weights. The `Ile-CAT` lysidine and inosine conventions are explicit. | Copy count is **not tRNA abundance, expression, charging, or direct decoding measurement**. The zero-weight substitution is a model convention. |

Because both are conventions rather than measurements, neither is a fresh-view default. The default axes, the colour and axis selector order, the default detail-panel field order, the default comparison axes, and the guided panel's default feature order all place measured UTEX 2973 evidence first: Tan 2018 TSS initiation counts and their condition comparisons, tested Ungerer 2018 alleles, and admitted PCC 7942 essentiality with its cross-strain wording. A measurement with few replicates still outranks a codon-usage convention, and wherever a thin measurement is a default the interface states its replicate count, condition, and coverage beside it. The one deliberate exception is the colour of the first paint. Owner decision, 2026-09-28: a fresh view opens coloured by the reviewed **function category**, because a categorical colour answers what a gene is before any metric answers how much. When a dataset ships no category table the colour falls back to GC3, not to a measurement; owner decision, 2026-09-29, confirmed that this metric fallback stays GC3, so no measurement is promoted into a default position by the colour scale below. **The rule that a ramp is never rescaled was reversed by owner decision on 2026-09-29**: the ramp now carries a reader-chosen, clearly labelled scale, and a heavily skewed metric opens on a logarithmic one, because a labelled nonlinear ramp serves the reader better than a linear ramp that paints nearly every gene one colour. See [The colour scale](#the-colour-scale). The measurement leads the colour list and opens the **Metric X vs Y** tab, where its spread is visible and can be zoomed. A later release changes that metric fallback with no code change only within a narrow rule: the metric must be one the registry already reads as expression evidence measured in this organism, and its declared unit must be exactly `fraction`, `rank`, `percentile`, or `index`. A native assay published in any other unit needs that list widened deliberately. That rule was written because a linear ramp over an unbounded quantity is what hid this measurement in the first place; the selectable scale answers the ramp half of that problem, and the narrow promotion rule is kept anyway, because which metric a fresh view opens on is a separate decision from how its values are spread across a ramp. CAI and tAI stay in the datasets, the metric registry, the filters, every selector, and the export, with their explanations and citations; their explanation now adds one line saying they are convention-derived indices to read as supporting context. An encoded nondefault axis or colour in a shared link still wins over these defaults.

The calculations live in [feature_metrics.py](../../scripts/feature_metrics.py) and [build_features.py](../../scripts/build_features.py). [CAI reference audit](cai-reference-set.md) explains reference selection and its limitations; [metric parity](metric-convention-parity.md) records the browser and pipeline conventions. tRNA anticodons come from coordinates in the pinned RefSeq GFF and match both [the 44-gene table](../../data/trna/anticodon_gene_copies.tsv) and a [pinned tRNAscan-SE rerun](trna-annotation-validation.md). The rerun supports computational plausibility; it does not measure tRNA expression or charging. The selected-colour disclosure gives a short explanation, calculation details, source, and relevant method citations; it stays open as the colour changes. See [the metric explanation contract](metric-explanations.md).

## The colour scale

Owner decision, 2026-09-29. The colour ramp carries a reader-chosen **Scale**,
beside Colour by on every scatter tab and on the chromosome tab. It offers
exactly five: **Linear**, **Logarithmic**, **Percentile**, **Square root**, and
**Symmetric log**. Clipped linear was considered and not offered. The scale
changes only which colour a value takes. Every number on screen or in a file —
the detail cards, the tooltips, the filters and their thresholds, the sorting,
the candidate comparison, the CSV export — is the stored value, and a gene with
no value stays uncoloured under every scale.

**One module, shared with the axes.** `site/js/core/value-scales.js` holds the
names, the availability tests, the disabled wording, the transforms and their
inverses. The Metric X vs Y axes import the same module and offer the first three
of the five; [explicit-metric-axes.md](explicit-metric-axes.md) says why the axes
offer the smaller set.

**Availability is stated, never silent.** A scale a metric cannot support is
listed and disabled with its reason, never hidden and never quietly swapped for
another. Logarithmic requires every finite value strictly positive. Square root
requires every finite value non-negative. A logarithm has no value at zero, so it
is also refused for a metric whose ramp is centred on zero. **No offset is ever
added to make a logarithm work**; a metric with a zero offers Square root or
Symmetric log instead. Scale is disabled entirely when Colour by is Function
category, which has no ramp over values to scale.

**Every reason is visible text, not only a tooltip.** A disabled option's `title`
needs a pointer to reach, and a select disabled as a whole cannot be focused at
all, so a reason carried only there does not exist for a keyboard or screen-reader
reader. The reasons therefore also appear in a short note directly beneath the
Colour by and Scale row — one per unavailable scale, or the single Function
category reason — which the Scale select names in `aria-describedby`. The
sentences are the ones `scaleControlState` already produces, verbatim, so the note
and the titles cannot describe the metric differently. The note is empty and
hidden, occupying nothing, when every scale the metric can take is available.
`syncScaleSelect` writes the selector and the note in one call, from one control
state, for the same reason that state travels with the options: a caller cannot
update one and leave the other stale. Both toolbars have their own note
(`#color-scale-notice`, `#chromosome-color-scale-notice`) and receive the same
state.

**What a change says is read from that state too.** Choosing a colour or a scale
announces the colour channel that resulted: the metric and the scale it is now
read under, or — for Function category — the metric and the one reason there is
no scale, taken from the control state's own `reason` rather than a second copy
of that sentence. The two handlers and the sentence live in
[site/js/ui/color-controls.js](../../site/js/ui/color-controls.js) rather than
inline in `app.js`, because `app.js` boots the whole application on import and
nothing inside it can be reached by a unit test. That is not hypothetical: the
sentence once named a constant after it had moved to another module, and the
`ReferenceError` was raised only for a reader who chose Function category in a
browser, leaving the previous metric's sentence standing in the live region.
[tests/js/color-controls.test.mjs](../../tests/js/color-controls.test.mjs) drives
a real `change` on each selector and asserts the text; the static half is
[tests/js/module-constants.test.mjs](../../tests/js/module-constants.test.mjs),
which fails on any UPPER_SNAKE constant a published module names without
importing or declaring it.

**The default is a rule, not a list.** A metric opens **Logarithmic** when every
finite value is strictly positive and at least `SKEWED_DEFAULT_SHARE` (0.9) of its
valued genes fall in the lowest tenth of its linear range. A metric that meets
that skew test but carries a zero or a negative value opens **Symmetric log**.
Everything else opens **Linear**. A column with no measurable range — nothing
finite, or one value repeated — has no skew to correct and opens Linear. On the
release measured at `main` `0ee1885` the rule selects Logarithmic for
`tssInitiation` and `expression`, Symmetric log for `neighborDownstreamNt` and
`neighborUpstreamNt`, and Linear for every other metric, `rareCount` (76%)
included. That selection is pinned in
[tests/js/color-scale.test.mjs](../../tests/js/color-scale.test.mjs), so a change
in the data that moves a metric across the 0.9 line is seen in review rather than
discovered in the picture. **Do not move the threshold to make a metric land
where it is wanted**: the threshold is the rule, and a metric that crosses it is
a fact about the data.

**Symmetric log's transition scale** is one deterministic value per metric: the
median of the non-zero absolute finite values, rounded down to a power of ten.
Roughly half the valued genes then fall below it, where small signed differences
near zero read very nearly as they are, while the long tail above it is
compressed logarithmically. Rounding to a decade keeps the legend legible ("±10
nt", not "±53 nt") and keeps the value from moving on an ordinary data refresh.
Both neighbour distances get 10 nt on this release. The legend states it.

Call it a **transition scale and not a linear threshold**: the transform is one
smooth formula, `sign(v) · log10(1 + |v| / t)`, everywhere. It is approximately
linear for magnitudes well under `t` and logarithmic for magnitudes well over it,
and the bend is spread around ±`t` rather than being a straight segment that
stops there — `f(5)/f(10)` is 0.585 on a transition scale of 10, where a strictly
linear interval would give 0.5. Owner decision, 2026-09-29: **keep the smooth
transform**, because a piecewise one would put a kink in the colour at the
threshold. Nothing in the interface or in these documents may promise a linear
interval it does not have; the derivation rule above is unchanged.

**The legend states the scale and reads in real values.** The scale's name sits
beside the ramp; the ramp's tick labels are the metric's own values placed at the
positions the scale actually puts them, not spaced evenly; a logarithmic ramp
labels its middle tick with the nearest power of ten, at that decade's real
position. A reader never has to guess whether a colour difference is tenfold or
ten units. The accessible description of the scatter canvas and of the chromosome
canvas both name the scale.

**A tick's position is `scale.normalize(its own value)`, by construction**, for
every scale and every metric, so a label can never name a value whose colour is
somewhere else on the ramp. Two consequences follow, and both are deliberate.
Under **Percentile** a tick is a value the cohort really holds, placed at the rank
it really has, which for a heavily tied column puts the middle label off the
middle of the ramp — that is the truth about a rank scale, not a bug. Where a
**diverging** ramp pads the shorter of its two arms to keep zero at the centre,
the padded end stands for no measurement, so the extreme value is labelled where
it truly falls rather than at the edge of the ramp. A crowded label is never
nudged along the ramp; it drops to a second row at its own position, and a
duplicate value is one tick. **The end ticks are the column's own minimum and
maximum**, on every scale and every metric a ramp does not pad, because those two
genes are the ones that take the end colours: a rank scale's inverse returns the
cohort's own value at a rank rather than interpolating between two of them, which
is what once labelled TSS initiation's percentile ramp 79.0 to 221,305 in place
of 77.375 to 323,995.75. The invariant is swept over every shipped metric and
every available scale in
[tests/js/color-scale.test.mjs](../../tests/js/color-scale.test.mjs).

**A diverging metric keeps its centre.** A metric the legend draws as diverging
around zero has its ramp centred where the scale puts zero, with the same reach
on each arm, under every scale offered for it. Grey therefore means zero and the
sign of a colour is the sign of the value.

**Percentile ranks against every gene with a value**, not against the
filter-visible cohort, so a filter change does not repaint the map. That is a
deliberate difference from the percentile *axis*, which ranks the visible cohort
because a plot's coordinates are about the cohort on screen. The legend note says
which it is.

**Shared state.** The scale is one value, read by both views and the legend, and
it lives in the URL under `csc`. It round-trips, follows a live hash change, and
survives a tab change. **A hash that names a colour but no scale opens on that
metric's default scale** (owner decision, 2026-09-29), so an existing link to TSS
initiation renders logarithmically from now on and agrees with a fresh view.
Changing Colour by resets Scale to the new metric's default unless the hash says
otherwise. A hash asking for a scale the metric cannot take resolves to the
metric's default and the visible control and the URL correct themselves to match.
`STATE_VERSION` was **not** bumped for `csc`, and the reasoning is recorded in
`site/js/core/url-state.js`: a version number is only useful where the absence of
a field must mean two different things to two readers, and an absent `csc` means
the metric's default scale to every reader, which is exactly what a fresh view
shows. The per-axis `xs`/`ys` scales were added on the same reasoning.

**The export manifest records the scale in effect** in `viewState.colorScale`,
so an exported view can be reproduced; a categorical colour records `null`,
because no scale is in effect. The exported values are the stored values,
unscaled.

**The toolbar order** this decision fixed, top to bottom on every scatter tab:
the axis chooser row (Metric X vs Y only, unchanged); a row holding Colour by and
Scale; the colour explanation directly beneath that row; a row holding Find a
gene alone, full width at every breakpoint; then the existing view buttons. DOM
order is keyboard order, so that is also the tab order. The chromosome tab's
toolbar gains Scale beside its Colour by and keeps its own explanation directly
beneath. See [controls-column-and-resets.md](controls-column-and-resets.md) and
[responsive-workspace.md](responsive-workspace.md).

## How was native codon space projected, and could gene length affect it?

Native space is PCA of **59 RSCU values per gene**, not percent of each codon among all codons. For each amino acid, RSCU is `count(codon) × number of synonyms / total count of that amino acid`; a completely absent amino-acid family contributes zeros. Met and Trp are omitted. Each RSCU column is standardized across the 2,715 genes before fitting six PCs; the map uses PC1 and PC2. See [rscu()](../../scripts/feature_metrics.py), [the PCA build](../../scripts/build_features.py), and [the projection reader](../../site/js/ui/panels.js).

This normalization removes overall codon count as a direct input, but it does **not** remove sampling noise. A short CDS has fewer observations and is more likely to have zero counts, including absent amino-acid families. The [length-sensitivity audit](pca-length-sensitivity.md) finds a modest PC2 association with length and sparsity; within-gene downsampling explains part of the short-versus-long shift, not all of it. The published PCA stays fixed when filters change. The scheme-specific risk and perturbation maps use standardized feature matrices computed in the browser; the baseline risk UMAP uses a separate precomputed risk feature set. [Panel definitions](../../site/js/ui/panels.js) name their included fields. **Metric X vs Y** is a separate plot tab with CDS length versus measured UTEX 2973 TSS initiation as its default axes, using [direct numeric coordinates](explicit-metric-axes.md).

## Why does `kaiA` show a product instead of a gene symbol?

The current record for `M744_RS10050` has `name: null` but `product: circadian clock protein KaiA`. The next two clock records have names `kaiB` and `kaiC`. The pipeline reads `gene` and `product` as separate fields from the pinned RefSeq GFF. The interface now shows the annotated product beside KaiA's locus tag and in descriptions on hover and keyboard focus in detail, search, shortlist, and plot views. A product mentioning KaiA does not establish a `gene=kaiA` qualifier in this release, so the UI labels it as a product rather than inventing a symbol. See [GFF parsing](../../scripts/build_features.py), [gene identity](../../site/js/core/gene-identity.js), and [identifier crosswalk rules](annotation-release-readiness.md).

## What function evidence and search are already available?

Search covers exact/partial locus tags, gene names, products, curated aliases, approved function-category labels, and GO terms clearly labelled as computational suggestions. The pinned NCBI GAF contains **3,898 GO relationships over 1,584 loci**; all current rows are `IEA` (electronic inference). They remain evidence-coded in a collapsed gene-detail section. **Function category** colour uses only the 13 exact locus-to-category rows the user approved; 2,703 CDSs remain unknown/unclassified. Multiple reviewed functions have a separate bucket, although none of the current approved rows has more than one. IEA GO does not assign category colour or assert pathway membership. See [the category contract](function-categories.md) and [annotation runbook](annotation-release-readiness.md). The current site is a pregenerated, static UTEX 2973 dataset; an arbitrary GenBank accession mode would need a separate acquisition and feature-availability design. [Search code](../../site/js/core/gene-search.js) documents the search scope.

## How do Pin, Shortlist, and the two Reset actions work?

Pinning selects one `pinnedId`; the map also has separate transient hover and keyboard previews. Clicking an already pinned map point unpins it. Search rows toggle Pin/Unpin and Shortlist/Remove, and the detail panel has an Unpin icon beside Pinned. **Reset view** resets canvas zoom and pan only. **Reset selections** clears the pin and candidate shortlist while retaining filters, the recoding scheme, and map camera. See [app wiring](../../site/js/app.js) and [interaction state](viewer-interaction-state.md).

## What was drawn from the three cited papers?

- [Ungerer et al. 2018](https://doi.org/10.1073/pnas.1814912115) compares UTEX 2973 and PCC 7942 and reports tested `atpA`, `ppnK`, and `rpaA` alleles with growth and biochemical phenotypes. The [protein evidence release](protein-evidence.md) records those three as tested-allele evidence; it does not generalize their effects to other loci or conditions.
- [Rubin et al. 2015](https://doi.org/10.1073/pnas.1519220112) reports PCC 7942 transposon-screen essentiality, including 718 essential genes under its laboratory conditions. The site takes per-gene calls from [Adomako et al. 2022](https://doi.org/10.1128/mbio.00862-22) Data Set S1 only when the current PCC and UTEX loci agree through a unique, exact shared RefSeq protein. Candidate details and exports label them as borrowed PCC evidence. [Ungerer et al. 2018](https://doi.org/10.1128/mBio.02327-17) reported similar growth at PCC-compatible 400 µmol photons m⁻² s⁻¹, while documenting different growth optima. Neither this observation nor a matching protein establishes UTEX essentiality or a recoding outcome.
- [Tan et al. 2018](https://doi.org/10.1186/s13068-018-1215-8) reports 4,808 UTEX 2973 TSSs across control, dark, high-light, and high-temperature conditions. Gene-linked Table S1 TSS counts and differential comparisons appear as transcription-initiation evidence. A separate regulatory-sites tab makes 2,333 non-gTSS rows searchable by site ID and coordinate, including antisense, internal, and orphan/novel sites; potential antisense targets retain source cautions. These features have no PCA coordinates. Filtered CDS points with map coordinates are dimmed and retain an outline. TSS signal is not gene-body RNA or protein abundance. See [Tan provenance](../../data/expression/TAN2018_TSS_PROVENANCE.md) and [interaction behavior](viewer-interaction-state.md).

For scientific questions to discuss before an experiment, use [biological decisions for lab review](AAA-biological-decisions-to-review.md). For the exact panel and release gates, use the [manual review checklist](AAA-manual-review-checklist.md).

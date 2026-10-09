# Explicit metric axes

`Metric X vs Y` is a separate map tab. Its default X axis is CDS length
(`lengthNt`, nt) and its default Y axis is the strongest measurement this
release publishes for UTEX 2973 — Tan 2018 TSS initiation (`tssInitiation`,
summed mean TSS counts) today. `resolveDefaultMetricAxes` reads the registry's
declared provenance, so a future native assay becomes the default with no code
change: this organism's own measurement leads, then a borrowed measurement with
its caveat, then any published metric that is not a codon-usage convention.
CAI and tAI are never a fresh-view axis; they stay selectable on either axis and
keep their explanations and citations. Because a default measurement can be
thin, the axis note carries that measurement's declared replicate count,
condition, and coverage beside the plot. Both selectors read only the
numeric metric registry used by colour and filters, listed measured evidence
first. Each axis keeps its native units; the canvas fits X and Y independently,
while the PCA maps retain equal geometric scaling. The plot never refits a PCA.

`site/js/core/metric-axes.js` preserves gene row order and `NaN` for missing
values. A gene is drawable only when both selected metrics are finite. The
interface reports this pair count; equal X/Y selections are allowed and
identified as a diagonal. Missing or unknown axis keys from old/edited links
fall back to available registry defaults. The URL `ax` and `ay` fields record
nondefault choices, and `applyDecoded` writes them after the fresh-view
defaults, so an encoded `ay=cai` still wins over the measured default. The
measured default arrived with encoder version 3: a hash declaring version 1 or 2
and no `ax`/`ay` decodes to the pair those versions defaulted to, CDS length
against CAI, so a link shared before the change keeps plotting what its author
saw. See [viewer-interaction-state.md](viewer-interaction-state.md). The
candidate export manifest records the active panel, colour metric, axis keys,
and axis scales in `viewState`; numeric CSV rows remain unchanged.

## Independent dataset contributors

A type metric on X and the same type metric on Y are two independent applied
measurements. `axisXSources` and `axisYSources` hold their dataset ids; `xds`
and `yds` carry those choices in shared links. The axis-specific type-metric
instances read only their own contributors, so committing X never changes Y,
the colour/filter selection, or PCA. The export view records both the selected
ids and the datasets that actually contributed, together with the unit,
pooling flag, and provenance id.

An older link has no `xds`/`yds`. At first load only, each axis copies the
contributors the old global source and informing-source fields would have used.
The copies are then ordinary independent state; global changes cannot become a
fallback that recouples them. A newly chosen type starts from that type's
existing default rule. Computed metrics keep an empty dataset selection.

The axis dataset button is present whenever the catalogue admits more than one
dataset for the selected type, even if the global selection currently contains
one. Its label distinguishes an individual condition from a pooled selection.
Pooling still uses the type metric's established rule: within-dataset ranks for
poolable abundance-like quantities, a mean for the declared shared-scale
fitness quantity, and one informing dataset for quantities that do not pool.

An axis whose measurement file is loading or retryable keeps its requested
datasets and scale and names the resource state. In a mixed-file pool, ready
contributors continue to draw, but the pair count is labelled as a partial
result and the axis note names the unavailable dataset ids plus the available
and requested contributor counts. The type metric's values, units, provenance,
feature explanation, and canvas description use only the contributors readable
now; no missing contributor is included in a claimed pool. The export records
selected ids, requested contributors, actual contributors, resource state, and
whether the requested and actual views are pooled separately. Retry keeps the
selection intact; loading changes to the full established pool as soon as its
file settles. A transient empty in-memory column therefore does not disable
Log10, reset the URL to linear, claim that the metric is absent, or emit
coverage conclusions that require loaded values.

The shared scatter renderer applies independent X/Y fit factors only to this
tab. Hit testing, keyboard neighbor selection, zoom, pan, ticks, pin and
shortlist marks use those factors. A length filter changes visibility only and
does not move the fixed native PCA coordinates. The PCA length audit and its
sampling limits are in [pca-length-sensitivity.md](pca-length-sensitivity.md).

## One value-scale module, two controls

`site/js/core/value-scales.js` is the single place a column of metric reads is
rescaled. It declares the scale names, the availability test for each, the
disabled-option wording, the transform and its inverse, the symmetric-log
transition-scale rule, and the rule that picks a metric's default scale. Both the
Metric X vs Y axes and the colour ramp import it: the axis controls offer
`linear`, `log10` and `percentile` (`AXIS_SCALES`), and the colour ramp offers
those three plus `sqrt` and `symlog` (`VALUE_SCALES`). `metric-axes.js`
re-exports `AXIS_SCALES`, `log10Availability` and `log10DisabledReason` from
that module rather than defining its own, so a scale is declared once.

The axes deliberately offer the smaller set. An axis draws the transformed
numbers directly on its ticks — a `log10` axis reads 3 where the value is 1,000
— so the axis title names the scale and drops the native unit. Symmetric log
would put unlabelled symlog units on an axis with its transition scale visible
nowhere, and square root adds nothing an axis reader cannot get from `log10` or
`percentile`. The colour ramp is the opposite case: its tick labels are read
back into the metric's own units, so a nonlinear scale stays readable there.
Extending the axes is a separate change, with its own axis-tick and title work.

An axis reads only `apply`; the colour ramp reads `invert` as well, to label a
ramp position. The two rank conventions must therefore agree, and `invert` is
defined so that they do: `apply` puts the cohort's *i*-th value at rank
`(i + 0.5) / n`, and `invert` reads a rank back as an index, rounds to the
nearest one and returns that value. It is the exact inverse of `apply` for every
value in the cohort, ties included, and it never returns a number between two
ranks — a measurement no gene has. The percentile **axis** semantics are
unchanged by this: it ranks the filter-visible cohort through `apply` alone.

Two naming registers, on purpose. A **control** names the scale in words —
Linear, Logarithmic, Percentile, Square root, Symmetric log (`VALUE_SCALE_LABELS`,
shared by the axis and colour selectors). A **plot axis** annotates it in the
conventional short form, `, log10` or `, percentile` (`axisScaleName`), and the
note beside the plot matches that register (`log10DisabledReason`).

## Per-axis scale

Each axis independently offers **linear** (the fresh-view default), **log10**,
and **percentile**. `buildMetricAxesProjection` in `site/js/core/metric-axes.js`
applies the scale after the raw metric values are read, so the CSV export and
every other consumer of the registry still see the metric's real numbers; only
the plotted coordinates and the axis title change.

Log10 is available only when every finite value on that axis is strictly
positive. `log10Availability` reports the count of zero or negative values, and
`log10DisabledReason` turns it into the sentence shown beside the plot; the
X/Y scale selector disables its Log10 option accordingly. A stale or
hand-edited link that requests `log10` on a metric that cannot take it falls
back to linear rather than drawing every gene as unavailable, and the visible
selector and URL correct themselves to match.

Percentile ranks each gene's value against the finite values of the **visible
cohort** — the current filter mask, not the whole dataset — so tightening a
filter can move every point on a percentile axis. A gene hidden by a filter
still receives a rank against that cohort and keeps a map coordinate, the same
as under every other scale; only its marker style (ghosted vs. coloured)
reflects the filter.

The axis title always names a nonlinear scale (`axisTitle`, e.g. "TSS
initiation (UTEX 2973), log10" or "CDS length, percentile") and drops the raw
unit, since the plotted numbers are no longer in it. `formatTick` needs no
knowledge of the scale: it already keeps neighbouring ticks distinct at any
spacing, and log10/percentile values are ordinary numbers to it.

The scale is encoded per axis as `xs`/`ys`, independent of the `ax`/`ay` keys,
and is written only when nondefault. Unlike the axis keys, an omitted scale has
never meant anything but linear, so no encoder version governs it: a hash from
before this feature, or one missing `xs`/`ys` entirely, decodes to linear on
both axes with no migration needed. See
[tests/js/metric-axes.test.mjs](../../tests/js/metric-axes.test.mjs) and
[tests/js/url-state.test.mjs](../../tests/js/url-state.test.mjs).

The **colour ramp**'s own scale is the same mechanism on the other side of the
map: one shared value in the URL under `csc`, read by both the scatter map and
the chromosome view, with its own default rule and its legend reading in the
metric's units. Its contract is in
[current-design-answers.md](current-design-answers.md#the-colour-scale) and its
tests are [tests/js/value-scales.test.mjs](../../tests/js/value-scales.test.mjs)
and [tests/js/color-scale.test.mjs](../../tests/js/color-scale.test.mjs).

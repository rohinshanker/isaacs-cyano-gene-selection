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

The shared scatter renderer applies independent X/Y fit factors only to this
tab. Hit testing, keyboard neighbor selection, zoom, pan, ticks, pin and
shortlist marks use those factors. A length filter changes visibility only and
does not move the fixed native PCA coordinates. The PCA length audit and its
sampling limits are in [pca-length-sensitivity.md](pca-length-sensitivity.md).

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

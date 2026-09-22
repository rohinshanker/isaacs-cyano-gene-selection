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
candidate export manifest records the active panel, colour metric, and axis keys
in `viewState`; numeric CSV rows remain unchanged.

The shared scatter renderer applies independent X/Y fit factors only to this
tab. Hit testing, keyboard neighbor selection, zoom, pan, ticks, pin and
shortlist marks use those factors. A length filter changes visibility only and
does not move the fixed native PCA coordinates. The PCA length audit and its
sampling limits are in [pca-length-sensitivity.md](pca-length-sensitivity.md).

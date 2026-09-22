# Explicit metric axes

`Metric X vs Y` is a separate map tab. Its default X axis is CDS length
(`lengthNt`, nt) and its default Y axis is CAI (`cai`, index). Both selectors
read only the numeric metric registry used by colour and filters. Each axis
keeps its native units; the canvas fits X and Y independently, while the PCA
maps retain equal geometric scaling. The plot never refits a PCA.

`site/js/core/metric-axes.js` preserves gene row order and `NaN` for missing
values. A gene is drawable only when both selected metrics are finite. The
interface reports this pair count; equal X/Y selections are allowed and
identified as a diagonal. Missing or unknown axis keys from old/edited links
fall back to available registry defaults. The URL `ax` and `ay` fields record
nondefault choices. The candidate export manifest records the active panel,
colour metric, and axis keys in `viewState`; numeric CSV rows remain unchanged.

The shared scatter renderer applies independent X/Y fit factors only to this
tab. Hit testing, keyboard neighbor selection, zoom, pan, ticks, pin and
shortlist marks use those factors. A length filter changes visibility only and
does not move the fixed native PCA coordinates. The PCA length audit and its
sampling limits are in [pca-length-sensitivity.md](pca-length-sensitivity.md).

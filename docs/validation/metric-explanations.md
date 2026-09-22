# Map and metric explanation contract

The map has four distinct feature matrices. Native codon space is the pinned,
standardized 59-column RSCU PCA from `scripts/build_features.py`. Baseline UMAP
is the pinned, standardized 17-column wild-type risk matrix from that release.
Risk PCA uses the 18 preferred keys in `site/js/ui/panels.js`, skipping fields
missing from the registry, mean-imputing nonfinite cells, and recomputing for
the active scheme. Perturbation PCA uses ten change/load keys and requires a
scheme. The **Features used** disclosure gets its entries from the same key
lists and release metadata as those projections. Its summary must say whether
the view is fixed or recomputed. Native PCA uses scikit-learn in the offline
build; the two live PCAs use `site/js/core/pca.js`, so their disclosure must not
attribute the computation to scikit-learn.

`site/js/core/metric-help.js` defines the calculation and method citations for
each selectable colour metric. Registry descriptions supply the short meaning,
while the shared `metricHelp` result supplies units, pinned data origin,
finite-value coverage, and citation IDs. Both the on-page disclosure and the
candidate export manifest consume it. Keep the method-key completeness test in
sync with the registry whenever a metric is added. Citation IDs must resolve in
`site/data/citations.json`; a missing citation URL is shown as text, not a
fabricated link. A missing metric hides the disclosure and missing gene values
remain unknown rather than becoming zero.

Critical conventions: rare codons have genome-wide within-amino-acid frequency
strictly below 0.1; CAI has a fixed 71-locus reference and adds 0.5 to zero
reference counts; tAI uses annotated genomic tRNA copy counts and the declared
wobble/zero-weight assumptions. PCC 7942 transcript abundance and its percentile
are borrowed measurements. Tan 2018 TSS initiation counts are UTEX 2973
start-site evidence, not gene-body abundance. Recoded metrics use the active
scheme. The colour disclosure remains open and updates in place when selection
changes or a URL-restored metric is loaded.

Verify with `node --test tests/js/metric-help.test.mjs
tests/js/export-manifest.test.mjs`, then render native/risk/UMAP/perturbation
maps at narrow and wide viewports, switch colour while the disclosure is open,
follow its citation links, and restore a colour selection from the URL.

# Validation Index

Reusable contracts and runbooks for this repository.

| Document | Covers |
| --- | --- |
| [data-contract.md](data-contract.md) | Frozen `site/data/*.json` interface, including separate Tan 2018 gTSS evidence and missing-value semantics |
| [Tan 2018 TSS provenance](../../data/expression/TAN2018_TSS_PROVENANCE.md) | Reproducing pinned gTSS and non-gTSS Table S1 extracts, exact-locus mapping, missingness, and interpretation boundaries |
| [genome-provenance.md](genome-provenance.md) | Reacquiring and re-verifying the UTEX 2973 genome, and the wrong-accession trap |
| [metric-convention-parity.md](metric-convention-parity.md) | Keeping the browser's recomputed CAI, tAI, ENC, GC3 and codon-pair score equal to the pipeline's |
| [metric-explanations.md](metric-explanations.md) | Exact map feature matrices, selected-colour calculation/source/citation disclosure, and export parity |
| [pca-length-sensitivity.md](pca-length-sensitivity.md) | Fixed native RSCU PCA, length/sparsity audit, within-gene downsampling, and reproducible sensitivity checks |
| [explicit-metric-axes.md](explicit-metric-axes.md) | Direct numeric X/Y plotting, independent canvas scales, missing pairs, URL, and export state |
| [trna-annotation-validation.md](trna-annotation-validation.md) | Reproducing the pinned tRNAscan-SE comparison, 44-locus concordance, anticodon conventions, and computational-evidence limits |
| [cai-reference-set.md](cai-reference-set.md) | Deterministic 71-locus CAI reference convention, blinded Jev audit, disagreement review, and change policy |
| [candidate-comparison-and-export.md](candidate-comparison-and-export.md) | Missing-value integrity, ten distinguishable candidates, colour ramps, metric-scoped expression provenance, and reproducible exports |
| [annotation-release-readiness.md](annotation-release-readiness.md) | Release manifest, companion-input gates, ambiguity-preserving crosswalk, annotation evidence, identifier display, GO evidence, and external-source boundaries |
| [go-term-names.md](go-term-names.md) | Pinned GO name lookup, obsolete source IDs, rebuild checks, and attribution |
| [function-categories.md](function-categories.md) | Exact lab-reviewed UTEX 2973 function categories, sparse assignments, unknowns, and reproducible build checks |
| [protein-evidence.md](protein-evidence.md) | Pinned CDS-to-protein reconciliation, PASS00399 admission limits, tested-allele joins, and distinct evidence tiers |
| [go-iea-essentiality-context.md](go-iea-essentiality-context.md) | GO IEA fallback tier and precedence, Jev question wording, thresholds, calibration, blinded spot check, and discrepancy contract |
| [pcc-essentiality.md](pcc-essentiality.md) | Licensed Adomako/Rubin PCC 7942 calls, exact UTEX cross-strain joins, growth-context citation, missingness, and assumption boundary |
| [length-cohorts.md](length-cohorts.md) | Annotated-locus and joined-CDS denominators, inclusive length filtering, short-CDS review flag, and protein filter evidence boundary |
| [future-data-roadmap.md](future-data-roadmap.md) | Ranked remaining downloadable evidence after Tan 2018 integration, joins, licence gates, version pins, and admission rules |
| [source-ledger.md](source-ledger.md) | Public citation coverage, exact repository-file downloads, attribution boundaries, and release checks |
| [current-design-answers.md](current-design-answers.md) | Lab-readable answers on the present CDS set, protein/tRNA evidence, CAI/tAI/rare codons, projections, identifiers, search, and selection controls |
| [biological-decisions-to-review.md](biological-decisions-to-review.md) | Prioritized scientific questions, ticket outcomes and remaining gaps, and exact panel sign-off |
| [rna-folding.md](rna-folding.md) | Exact local ViennaRNA build, strand-aware context, cancellation/cache semantics, numeric and rendered validation |
| [responsive-workspace.md](responsive-workspace.md) | Center-column workflow, breakpoint behavior, hash-preserving navigation, bounded detail scrolling, and responsive checks |
| [guided-panel-design.md](guided-panel-design.md) | Deterministic constrained panel objective, feature/missing-data policy, stable saved-scheme identity, golden case, and export contract |
| [viewer-interaction-state.md](viewer-interaction-state.md) | Keyboard/touch map behavior, reversible pinning and selection reset, URL version and precedence, live navigation, and draft clearing |
| [manual-review-checklist.md](manual-review-checklist.md) | Ordered local review, biological sign-off, evidence/licensing decisions, automated gates, deployment, and production smoke test |

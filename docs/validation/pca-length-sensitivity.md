# Native PCA length sensitivity

The published native map is PCA of 59 relative synonymous codon use (RSCU)
values per CDS, standardized across all 2,715 plotted genes. Each absent amino
acid family contributes zeros for its synonymous codons. The length filter
changes point emphasis only; it does not refit or move the published axes.

Reproduce the audit from the versioned site data:

```sh
.venv/bin/python tools/audit_pca_length.py > /tmp/cyano-pca-length-audit.json
```

The script rejects a changed RSCU order or a failure to reconstruct published
PC1/PC2 scores (maximum observed difference was 0.0000023). It uses seed 2973,
20 within-gene draws, 75 sense codons per draw, and a 1,000-resample gene-level
bootstrap. The 75-codon sample matches the short stratum's median 225 nt. The
source `site/data/genes.json` contains the exact packed codons and RSCU values.

| Quantity | PC1 | PC2 |
| --- | ---: | ---: |
| Published explained variance | 10.831% | 5.185% |
| Pearson correlation with CDS length | -0.064 | 0.141 |
| Spearman correlation with CDS length | -0.108 | 0.181 |
| Pearson correlation with zero-RSCU count | -0.086 | -0.274 |
| Pearson correlation with absent-family count | 0.014 | -0.190 |

The 337 CDSs at most 300 nt have median 24 zero RSCU entries, mean 1.98 absent
families, and mean PC2 -0.934. The 1,087 CDSs over 900 nt have median 4 zero
entries, mean 0.11 absent families, and mean PC2 +0.277. Short examples include
`M744_RS14315` (75 nt, 41 zeros) and `M744_RS02405` (93 nt, 41 zeros). A long
example is `M744_RS09355` (5,412 nt, zero zeros).

Refitting the same standardized RSCU PCA after removing CDSs at most 300 nt
changes PC1/PC2 explained variance to 13.367%/5.823%, but their loading
cosines against the published axes remain 0.9978/0.9865. At 600 and 900 nt
exclusion cutoffs, PC2 loading cosines remain 0.9697 and 0.9577. These are
sensitivity refits only; they do not replace the published coordinates.

Within each long gene, drawing 75 sense codons without replacement raises the
zero-RSCU count by 18.60 on average. Projecting these draws onto the fixed
published axes shifts PC2 by -0.128 on average (gene-bootstrap 95% interval
-0.153 to -0.104), taking the long-gene mean from +0.277 to +0.148. The
observed short-gene mean is -0.934. Sampling sparsity contributes to PC2, but
this within-gene control does not explain the full between-gene shift. It also
cannot establish whether the remainder is biological: naturally short genes
differ in function and amino acid composition from long genes.

Keep fixed coordinates for comparisons. Interpret short-CDS PC2 positions with
the length and zero-RSCU context visible, and use the separate explicit-metric
plot when a direct length relationship is the question.

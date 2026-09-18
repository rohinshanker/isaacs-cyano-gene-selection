# Staged expression sources, not loaded by the build

`scripts/build_features.py` globs `data/expression/*.tsv` and **requires exactly one**
table. A second file in that directory fails the build.

Anything here is a real, documented dataset that is not yet the selected source. Moving
a file up one level makes it the selected source, and the previous one must move down
here at the same time.

That one-in, one-out rule is a stopgap. The proper fix is an explicit selected-dataset
manifest naming organism, assay, condition, units, checksum and licence, so the build
does not infer its input from a directory listing. That is recorded as P3 in
`docs/notes/tickets/O_data-annotation-release-readiness__20260918.md`.

## Currently staged

- `tan2018_utex2973_tss_initiation.tsv` — the only direct measurement of UTEX 2973,
  covering 1,727 of 2,715 genes. It is a transcription-start-site initiation score, not
  transcript abundance, and correlates with the currently selected PCC 7942 table at
  Spearman 0.313. See `TAN2018_TSS_PROVENANCE.md` before using it.

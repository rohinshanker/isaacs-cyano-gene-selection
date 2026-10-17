# PXD044412 analyzed-peptide input

`source-manifest.json` pins the paper-linked Figshare v1 Supplementary Data S3,
its distinct CC BY 4.0 grant, source quotations and author-code revisions.
`native-summary.json` is a compact independent JSON audit of that exact TSV input:
391,900 rows grouped by literal source `Entry` and `Label`, with ambiguous rows
excluded from unique-protein evidence and no fold-change averaging.

`identity-summary.json` records the independent exact accession/locus/RefSeq
mapping audit, all excluded identities and per-label totals. Reproduce it with
`reproduce_identity_audit.py`, which imports no project reader or mapper and
verifies all four input pins plus source statistic validity. The
[mapping contract](../../../docs/validation/pxd044412-mapping.md) gives the command,
expected counts and assignment limits.

`conditions.json` retains the independently inspected S1 dose cells and source
receipts, candidate label assignments, cultivation/assay distinction, pooled
biological inputs, prepared technical replication, unknown analyzed n and
contrast direction, and reconstructable article evidence spans.

The full source and generated row exports are not committed. This directory
contains reproducibility receipts and non-release checks, not site data. For
reader use, output semantics, counts and source limits, see the
[reader contract](../../../docs/validation/pxd044412-peptides.md).

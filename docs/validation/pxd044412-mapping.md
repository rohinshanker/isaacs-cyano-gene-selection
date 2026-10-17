# PXD044412 protein identity mapping

The mapping companion links the [pinned S3 peptide evidence](pxd044412-peptides.md)
to UTEX 2973 genes through the existing, release-pinned PCC 7942 identifier route.
It preserves source comparisons and their evidence states. It does not admit a
browser layer or claim measured UTEX interactions, confirmed binding, or genomic
coordinates.

## Identity contract

A transfer requires agreement between the literal S3 accession and ordered-locus
annotation, the pinned PCC 7942 UniProt table, and the exact shared RefSeq protein
identifier in the UTEX annotation crosswalk. Uniqueness is checked in both
directions across the complete mapping tables, including entries not observed
in this experiment and flagged edges. No accession aliases, fuzzy matches,
source-order winner, or inferred missing comparisons are allowed.

The source ordered-locus annotation must identify one supported PCC locus and
agree with the independent UniProt route. Missing, multiple, inconsistent or
unsupported source annotations cannot authorize assignment. Missing or
non-overlapping versioned RefSeq references remain excluded. A disagreement
between records is not proof of a biological mismatch; resolving it requires a
separate identity check. Preserve the original annotation and candidate links.

The route uses annotation identifiers, not the study's original protein
sequences. It cannot establish the identity of every assayed allele. Preserve
PCC 7942 evidence labels when displaying a linked UTEX gene. The
[established crosswalk contract](annotation-release-readiness.md) and the
[earlier exact-mapping policy](pxd036717-enrichment.md#exact-identifier-mapping)
explain this boundary.

Peptide ambiguity and protein identity are separate. A unique gene link does not
make an `ambig=yes` peptide informative for that protein. A linked comparison
with only ambiguous peptides stays `not_evaluated`; a comparison with no
significant evaluated peptides is limited to that observed evidence. No
protein-level fold change is manufactured, and the 42 source comparisons stay
separate.

## Pinned inputs

The tool verifies the S3, UniProt and crosswalk hashes before accepting output.
The independent length check additionally uses the protein-identity artifact.
All pins and byte sizes are in
[the native identity audit](../../data/audits/pxd044412/identity-summary.json).

| Input | SHA-256 |
| --- | --- |
| S3 PCC 7942 peptide table | `c6cb4794f0a1ff854899b83ddec2ebbef20577387c262b279a6f2519be9a06b5` |
| UniProt ordered-locus table | `d3a018d87aa173c89468a068da5d71aa8c4166b9b5607c777354bab807bee515` |
| Identifier crosswalk v1 | `97e3022e53cd1e31f5931ead37f425e1d99c032704e5ff8f02c0d75d1755e9ae` |
| Protein identity v1, length check only | `3e9b2b4dafab2ed7e88d09a6126e4464d83bf7929e9e5fc7f5ffdf70eb19e79a` |

The original source and large generated mapping bundle stay under ignored
`data/interim/` or an external staging directory. The source remains CC BY 4.0;
retain the Sporre et al. article and versioned Figshare attribution documented by
the peptide reader. This identity audit changes no source terms.

## Reproduce and consume

```sh
.venv/bin/python tools/map_pxd044412.py \
  --input data/interim/pxd044412/S3-pcc7942.tsv \
  --output-dir data/interim/pxd044412/identity-output
.venv/bin/python -m pytest -q tests/test_map_pxd044412.py tests/test_pxd044412_peptides.py
```

The output directory must be new. `mapping.json` contains an identity record for
each source `Entry`, one group for each observed `Entry`/`Label`, input pins,
attribution, and global/per-label audits. Source data-row numbers and physical
line references point back to S3; original cells remain in the pinned source and
the peptide reader's lossless export. Failed parsing or validation removes this
run's incomplete output. The CLI accepts only the approved pins.

Only `identities[].status == "mapped"` authorizes the attached UTEX identity.
Member-level links and candidates are diagnostic even when a containing record
is excluded. `groups[].mappingStatus` repeats that decision, while the original
`evidenceState` and counts stay unchanged. `mappedEvidenceState` is null for an
excluded identity or a group without any evaluable unambiguous peptide. It must
not become a negative interaction call. Entry-wide source-locus conflicts
exclude every label for that accession; target collisions exclude all competitors.

## Independent regression checks

The audit was computed directly from the pinned TSVs without importing the
project reader or mapper. Recheck all per-label totals, not only the global sum.
It retains every excluded accession, source locus/length and comparison count.

| Identity route | Distinct source accessions | Observed Entry/Label comparisons |
| --- | ---: | ---: |
| Assigned | 1,849 | 58,914 |
| RefSeq confirmation missing | 197 | 5,394 |
| RefSeq disagreement | 26 | 658 |
| Crosswalk edge missing | 66 | 1,926 |
| UniProt ordered locus missing | 6 | 216 |
| Multiple UniProt loci | 4 | 168 |
| Total | 2,148 | 67,276 |

All 1,849 assigned source proteins have S3 lengths equal to the candidate UTEX
protein lengths. Length agreement supports this check but does not independently
establish sequence identity. The four multiple-locus accessions are `P04997`,
`P06539`, `P11005` and `P13530`. The six source accessions with an S3 locus but no
corresponding pinned UniProt locus remain unassigned; source annotation alone
cannot repair a missing independent link.

Assigned comparisons retain 3,466 `significant_peptide_evidence`, 55,274
`no_significant_peptide_evidence`, and 174 `not_evaluated` states. These are
source comparisons linked to genes, not counts of confirmed interactions. All
67,276 original comparisons remain represented, including 8,362 unassigned ones.

## Admission boundary

The parent [data-sources ticket](../notes/tickets/O_data-sources-selection__20261005.md)
retains the separate condition records, browser admission, interaction-specific
quantity/missingness display, citations and rendered verification. Mapping
output stays `releaseEligible: false`. A future consumer must honor both the
mapping assignment and the preserved peptide evidence state.

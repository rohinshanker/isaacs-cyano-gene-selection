# PXD036717 enrichment reconstruction

[`tools/pxd036717_enrichment.py`](../../tools/pxd036717_enrichment.py) reads the
Santos-Merino et al. supplement and reconstructs log2 APEX2/control enrichment
from deposited MaxQuant LFQ intensities. It produces **non-release evidence**,
not browser layers or interactor calls. LFQ intensities are processed
quantification outputs; this does not reprocess raw mass spectra.

The owner requires reconstruction before browser release and wants twelve
replicate comparisons plus four optional within-bait averages (2026-10-15).
RpaA, CikB, NblS and ManS are separate baits; none may be pooled with another.
This is proximity-label enrichment in engineered PCC 7942 CscB-SPS backgrounds,
not protein abundance or native UTEX 2973 measurements.

## Source pins and reproduction

Primary references: [the article](https://doi.org/10.1016/j.ymben.2023.11.001)
and [PRIDE project metadata](https://www.ebi.ac.uk/pride/ws/archive/v3/projects/PXD036717).
The source workbook is the owner-supplied publisher supplement, not a file
extracted from PRIDE's search-result RAR archives.

| Artifact | Verified | Bytes | SHA-256 |
| --- | --- | ---: | --- |
| `1-s2.0-S1096717623001490-mmc1.xlsx` | 2026-10-15 | 506,106 | `287d5f49a71425ba2b085a7070053a34f9f17219833663e1231ea3ab81d86804` |
| PRIDE v3 project JSON | 2026-10-15 | 11,852 | `3fe76e2dd3765bfa4e10afd5e4ad47bbfc64ebf62c14bf2fbb87f4a7c0f525ca` |

The private publisher ZIP is
`../private-literature/santos-merino metab eng 2024/ScienceDirect_files_05Oct2026_15-28-50.812.zip`
relative to the canonical checkout. Extract only the named workbook member to
`data/interim/pxd036717/`; retain the original ZIP unchanged. A local copy of
the verified project response is `data/interim/pxd036717/pride-project.json`.
Re-fetches of project metadata can change and must receive a new receipt.
These source copies and the generated evidence JSON remain ignored.

```sh
.venv/bin/python tools/pxd036717_enrichment.py \
  --input data/interim/pxd036717/1-s2.0-S1096717623001490-mmc1.xlsx \
  --output data/interim/pxd036717/evidence.json
.venv/bin/python -m pytest -q tests/test_pxd036717_enrichment.py
```

The command verifies the immutable workbook hash before opening it and rejects
changed sheet names/order, headers or populated extra columns. Tests include
synthetic source defects and an optional real-source regression, enabled when
the pinned workbook is present. Repository [release gates](release-gate.md)
still apply to code changes.

## Preservation and calculation

Every nonblank row retains all 32 original cells, coordinates, types, formulas
and cached values. The original workbook remains the authority for formatting,
comments and other workbook features; the JSON preserves the tabular evidence,
not an editable workbook replica. No Excel recalculation occurs. Blank trailing
columns carry no data, and skipped blank row numbers remain in the output.
Rows retain their source identifiers verbatim, including semicolon-delimited
protein groups. Repeated identifiers are reported without dropping rows.

For each A/A, B/B and C/C source comparison, reconstruction is
`log2(bait LFQ) - log2(control LFQ)` when both inputs are finite and positive.
This follows the published column indexing without claiming a biologically
paired design. Zero or blank intensity yields null. Invalid nonnumeric or
negative intensity is separately flagged and also yields null. No minimum
replacement, pseudocount, significance test or protein-identification threshold
is introduced. The row's unique-peptide and coverage columns remain available
for a later admission check.

An optional mean is the arithmetic mean of all three reconstructed log2 ratios,
equivalently the log2 geometric mean of their linear ratios. It is null if any
replicate is missing. It is not a ratio of arithmetic mean intensities. The
valid-replicate count remains available even when a mean is missing.

Diagnostics compare every source log against its positive intensity, every
published ratio against its source logs, and every calculable ratio against
the reconstruction. Absolute tolerance is `1e-7`, with zero relative tolerance.
Source cells never change in response to diagnostics. Published log values with
no positive underlying intensity have an explicit flag, with an additional flag
for literal log zero. Formula caches that are missing or erroneous stay visible
and cannot masquerade as a valid numeric source result.

## Regression counts and source caveats

Counts below are source rows/protein groups, not unique genes or mapped loci.
The workbook has 1,625 rows, 4,875 replicate comparisons, 11,009 formula cells,
and no repeated accession cell within any bait tab. Eleven rows have multiple
accessions and remain unresolved groups. ManS's extra AG column is empty.

| Bait | Rows | Valid A | Valid B | Valid C | Complete three-replicate means |
| --- | ---: | ---: | ---: | ---: | ---: |
| RpaA | 383 | 239 | 198 | 230 | 196 |
| CikB | 365 | 200 | 156 | 186 | 152 |
| NblS | 420 | 309 | 231 | 287 | 212 |
| ManS | 457 | 220 | 156 | 169 | 144 |

All 2,581 positive-input comparisons agree with the published ratios within
floating-point precision. The other 2,294 comparisons remain missing in the
reconstruction. All 4,875 published ratios agree with their cached log
differences; this arithmetic agreement does not validate the source's handling
of missing intensities.

The PRIDE `dataProcessingProtocol` states
`missing intensity values were imputed using the “min” method`. This exact
substring was mechanically matched against the pinned JSON on 2026-10-15.
The workbook generally substitutes a tab-specific positive log2
floor, but CikB has 145 bait log-zero cells with zero or blank source intensity
(141 zero, four blank). For example, `CikB-APEX2!H2` and `N2` are both zero,
while `F2` is zero and `L2` is 19.31251961. Neither the zero nor the positive
substitute supplies a measured enrichment. Reconstruction leaves these pairs
missing, while retaining the published values.

The same protocol says “both CscB-SPS replicates,” also matched mechanically,
whereas the workbook has A/B/C columns and the existing article intake records
three biological replicates. Preserve this source discrepancy. Supplement
`mmc2` contains selected interactor lists and `mmc4` an RpaA pull-down context
table; neither supplies per-row p-values. Those selection calls are separate
evidence and are not inferred by this reader.

## Admission boundary

Before releasing browser layers, complete the source-specific identifier join,
protein-group ambiguity policy, peptide/identification checks, condition record,
separate enrichment quantity, citation/provenance wiring and rendered tests.
Reconstruction alone does not admit any row or establish an interactor. Preserve
PCC 7942-to-UTEX transfer labels if an approved crosswalk is used.

The PRIDE response's CC0 field describes the archive deposit; it does not
relicense a separate publisher supplement. Keep the article's recorded
CC BY-NC-ND terms and the owner's citation-only distribution decision under the
[source ledger](source-ledger.md) rather than silently relabelling the workbook.
The open data-sources ticket owns these remaining admission steps.

# PXD036717 enrichment reconstruction

[`tools/pxd036717_enrichment.py`](../../tools/pxd036717_enrichment.py) reads the
Santos-Merino et al. supplement and reconstructs log2 APEX2/control enrichment
from deposited MaxQuant LFQ intensities. It produces **non-release evidence**,
not browser layers or interactor calls. LFQ intensities are processed
quantification outputs; this does not reprocess raw mass spectra.

The owner requires reconstruction before browser release and wants twelve
replicate comparisons plus four optional within-bait averages (2026-10-15).
The owner also selected a separate detection category alongside numeric ratios
on that date. Its browser implementation remains part of source admission;
one-arm detections keep a missing ratio and do not claim a confirmed interaction.
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
| `1-s2.0-S1096717623001490-mmc2.xlsx` (author-selected lists, audit only) | 2026-10-15 | 21,565 | `d1772cbc72cb156f49d15fce5159e011c460292403a4ed8d91f992a1a7166625` |
| `1-s2.0-S1096717623001490-main.pdf` | 2026-10-15 | 10,056,603 | `376ad183e1fb089bbf33613e45a0f7ef6e13a8b453cf11709a93a907738c22e0` |
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

Each comparison separately records `detectionState`: `both`, `bait_only`,
`control_only`, `neither`, or `invalid` for malformed intensity inputs. Every
row and bait tab carries counts of these states. Here "detection" means only
presence of a positive deposited LFQ intensity; it is not a protein-identification
or interaction call. A bait-only comparison has a null ratio but retains its
distinct detection state. No pseudocount or artificial infinite ratio is added.

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

Of the 2,294 null comparisons, 784 are bait-only, 188 control-only and 1,322
neither; no source input is invalid. Bait-only counts are RpaA 370, CikB 81,
NblS 174 and ManS 159. This missingness is scientifically consequential: the
`Common 3 replicates` lists in `mmc2`, columns A/B, contain 107 author-selected
bait/protein entries. An exact accession join within each bait to `mmc1` finds
90 bait-only in all three replicates and 101 missing means (RpaA 69/72,
CikB 5/5, NblS 13/16, ManS 14/14). Only six have complete reconstructed means.
These are author selections, not new calls or 107 unique proteins. Reproduce
this check using nonblank column-B IDs under that heading, exact tab-local
accession equality, and each matched row's detection counts and mean. A numeric
ratio alone would hide roughly 94% of these selections; the detection state
must remain accessible in any later release.

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
whereas the workbook has A/B/C columns. The pinned article PDF, physical page 8
(printed page 45), section 3.6, says: “Biotinylated proteins from three biological
replicates for each strain were extracted using streptavidin beads”. On
2026-10-15 this quote was matched after whitespace normalization against
`pdftotext -f 8 -l 8` output and checked on the rendered page. This is a direct
article receipt; the older condition intake did not establish the count.
Preserve the discrepancy with the archive protocol. Supplement
`mmc2` contains selected interactor lists and `mmc4` an RpaA pull-down context
table; neither supplies per-row p-values. Those selection calls are separate
evidence and are not inferred by this reader.

## Exact identifier mapping

[`tools/map_pxd036717.py`](../../tools/map_pxd036717.py) attaches an audited
identity result to every original workbook row without changing its cells,
ratios, means, flags or detection counts. It re-reads the pinned workbook,
rather than trusting a previously edited evidence JSON. Its output still has
`releaseEligible: false`; an identity link is not source admission.

```sh
.venv/bin/python tools/map_pxd036717.py \
  --input data/interim/pxd036717/1-s2.0-S1096717623001490-mmc1.xlsx \
  --output data/interim/pxd036717/mapped-evidence.json
.venv/bin/python -m pytest -q tests/test_map_pxd036717.py tests/test_pxd036717_enrichment.py
```

The command also verifies these existing repository inputs before using them:

| Input | Rows | SHA-256 |
| --- | ---: | --- |
| `data/expression/ingest/uniprot_pcc7942_orf_names.tsv` | 2,751 | `d3a018d87aa173c89468a068da5d71aa8c4166b9b5607c777354bab807bee515` |
| `data/annotation/releases/GCF_000817325.1-RS_2026_05_13/identifier-crosswalk-v1.tsv` | 22,356 | `97e3022e53cd1e31f5931ead37f425e1d99c032704e5ff8f02c0d75d1755e9ae` |

The route is exact UniProt accession → one PCC 7942 ordered-locus name →
one UTEX locus under `pcc7942_old_locus_tag`. That crosswalk relationship is
based on an exact shared RefSeq protein identifier between the PCC and UTEX
annotations, as documented in the [existing provenance](../../data/expression/PROVENANCE.md)
and [crosswalk contract](annotation-release-readiness.md). This does not compare
the study's original protein sequences or establish identity of engineered
alleles. The UniProt table is reused as pinned; no live lookup, alias repair or
new homology inference is performed. Preserve PCC 7942 evidence labels.

Uniqueness is evaluated in both directions across each entire mapping input,
including proteins absent from this experiment. All 2,567 relevant crosswalk
edges participate in ambiguity detection; the sixteen flagged edges cannot
be made harmless by filtering them away first. Source protein groups stay
unassigned even if individual members have candidate links. Native PCC
identities remain inspectable when no UTEX assignment is allowed. The exact
`B` and trailing-letter locus identifiers present in the input are preserved;
these are identifiers, not aliases or a spelling correction.

The row's `mapping.status` and `mapping.utexLocus` govern assignment. Only
`status: mapped` assigns a UTEX locus. Each member retains candidate identifiers,
versioned RefSeq IDs and 1-based physical TSV row numbers (including the header)
for audit. `proteinCompetitors` and `crosswalkCompetitors` also identify the
other source identifiers and TSV rows responsible for reverse collisions.
Member candidates never authorize assigning a group's measurements.
If two source rows would assign the same target within one bait, **both** become
`target_collision` with no assigned UTEX locus; file order never wins. The same
target in different baits is allowed because the experiments remain separate.

If a nonempty UniProt RefSeq list has no accession in common with the
crosswalk's shared-protein evidence, the row is `refseq_disagreement` and its
UTEX assignment is withheld. Assignment requires `refseqComparison: agrees`.
A missing RefSeq list is explicitly `not_available` and produces the non-assigning
status `refseq_unconfirmed`; missing confirmation never authorizes a transfer.
Isoform annotations following
an accession are retained in the pinned source but do not change that accession.
These two observed disagreements affect seven source rows:

| UniProt | PCC locus | UniProt RefSeq | Crosswalk evidence | Unassigned UTEX candidate |
| --- | --- | --- | --- | --- |
| Q31PP6 | Synpcc7942_0943 | WP_011377800.1 | WP_321167209.1 | M744_RS11435 |
| Q31NP5 | Synpcc7942_1294 | WP_011377967.1 | WP_231621311.1 | M744_RS09670 |

Different accession versions/records do not establish a biological mismatch.
They do require a separate, recorded identity check before restoring these
rows. Do not silently substitute the newer identifier. Both forms of missing
confirmation retain the original evidence and candidate identifiers.

The pinned source has 84 additional rows (35 accessions) with no UniProt RefSeq
confirmation. Their workbook `Sequence length` (column AE) differs from the
candidate UTEX `protein_length_aa` in every case. The seven explicitly disagreeing
rows also have different lengths; all 1,466 assigned rows have matching lengths.
Reproduce this offline comparison using
`data/protein-evidence/releases/GCF_000817325.1-RS_2026_05_13-protein-evidence-v1/protein-identity-v1.tsv`
(SHA-256 `3e9b2b4dafab2ed7e88d09a6126e4464d83bf7929e9e5fc7f5ffdf70eb19e79a`).
Length equality alone does not establish sequence identity. These results support
withholding unconfirmed assignments, rather than interpreting an empty RefSeq
cell as a safe transfer. Restoring any of these 91 rows requires a recorded
identity check.

### Mapping regression counts

| Bait | Assigned rows | No crosswalk edge | No UniProt locus | Ambiguous UniProt locus | Groups | RefSeq disagreement | RefSeq unconfirmed | Assigned valid A/B/C | Assigned complete means |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: |
| RpaA | 347 | 8 | 2 | 3 | 1 | 2 | 20 | 218 / 181 / 209 | 179 |
| CikB | 330 | 8 | 2 | 3 | 4 | 1 | 17 | 180 / 140 / 167 | 136 |
| NblS | 381 | 8 | 2 | 3 | 3 | 2 | 21 | 279 / 211 / 261 | 194 |
| ManS | 408 | 13 | 2 | 3 | 3 | 2 | 26 | 199 / 142 / 155 | 131 |

All 1,625 source rows are retained: 1,466 assigned and 159 unassigned. These are
bait/protein rows, not 1,466 distinct UTEX genes. There are 2,342 assigned
replicate ratios and 640 assigned complete means. The JSON includes every
exclusion with source worksheet/row and member-level reasons, plus each bait's
assigned detection-state totals. No source row is discarded because its
ratios are missing. Tests cover whole-table conflicts, flagged edges, duplicate
rows, groups, missing mappings, source/output alias protection, all three pins,
real-source counts and exact preservation of the reader's original output.
The real-input regression asserts every exclusion status and detection total,
including the absence of target collisions, not only assigned-row counts.

## Admission boundary

The identifier join and ambiguity policy above are implemented. Before releasing
browser layers, complete peptide/identification checks, the condition record,
separate enrichment quantity, citation/provenance wiring and rendered tests.
Reconstruction alone does not admit any row or establish an interactor. Preserve
PCC 7942-to-UTEX transfer labels if an approved crosswalk is used.

The PRIDE response's CC0 field describes the archive deposit; it does not
relicense a separate publisher supplement. Keep the article's recorded
CC BY-NC-ND terms and the owner's citation-only distribution decision under the
[source ledger](source-ledger.md) rather than silently relabelling the workbook.
The open data-sources ticket owns these remaining admission steps.

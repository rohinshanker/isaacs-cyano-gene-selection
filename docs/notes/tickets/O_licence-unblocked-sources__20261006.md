# O_licence-unblocked-sources__20261006 — Open

- **Scope:** Ingest, under the admission contract, every candidate source the
  withdrawn distribution rule kept back, and offer the downloads it withheld.
  Covers `data/expression/`, `data/essentiality/`, `site/data/citations.json`,
  `docs/validation/source-ledger.md` and the roadmap register.
- **Status:** open
- **Opened:** 2026-10-06
- **Updated:** 2026-10-07

## Current state

Opened on the owner's decision of 2026-10-06 that the source ledger's distribution
rule is withdrawn: data are cited by source, deposit and article, and nothing is
held link-only for its licence. The ledger and the roadmap register now read
"permitted with citation" on every row, with the earlier reading kept in
brackets. Nothing in this ticket is ingested yet; each source still needs the
admission contract (condition record, manifest entry, checksum pin, documented
join, tests) that every shipped layer has.

## Original-download decision, 2026-10-07

Owner: "if it is not causing any issues for now, leave it. open a ticket for my
own review that describes the pros and cons of doing this" in response to adding
the original RefSeq GFF/feature tables and Rubin Dataset S3 to a download manifest
with citations, sizes and checksums.

Leave the current original-file download and manifest presentation unchanged.
No present defect requiring this catalogue expansion was established. Rows 8
and 9 are deferred to
[O_review-original-source-downloads__20261007](O_review-original-source-downloads__20261007.md).
This does not hold ingestion of rows 1 to 7 or alter their citation/admission
requirements. The review covers download discovery and provenance, not a new
licence decision.

## Sources unblocked

Ranked by what can be ingested from the deposit as it stands. "Table" is the
per-gene file package B found; conditions are the package B rows, amended by the
2026-10-06 addendum.

| # | Artifact | Assay | Table | Notes |
| --- | --- | --- | --- | --- |
| 1 | GSE103462, GSE103463, GSE103644, GSE103704, GSE105774 (Puszyńska and O'Shea 2017) | RNA-seq | `GSE*_Expression.xls.gz` each | Wild type and rel mutants, constant light and light/dark, 30 °C, 40 µE cool fluorescent, BG-11; CO₂ not reported; two biological replicates. Article CC BY-NC-ND. |
| 2 | GSE237858, GSE254350, GSE335065 | RNA-seq | count matrices | Article CC BY-NC-ND; conditions in package B. GSE335065 lists *Rhodotorula toruloides* on nine samples; take only the PCC 7942 samples. |
| 3 | GSE252562 | RNA-seq | `GSE252562_transcript_count_matrix.csv.gz` | Six samples titled `LD8:16` with characteristics `LD16:8`; the depositor query in the condition-gaps ticket must be answered before the diel sets are labelled. |
| 4 | GSE311172, GSE225426 | RNA-seq | counts / processed workbooks | No publication; conditions only as the deposit states them. |
| 5 | GSE51112 (Markson 2013) | RNA-seq | `GSE51112_RNAseq_ProcessedData.txt.gz` | One sample per time point and condition (Table S7C); turbidostat per Vijayan 2009. Article © Elsevier. |
| 6 | GSE50908, GSE50919, GSE50920, GSE52486, GSE59112 (Markson 2013), GSE18902 (Vijayan 2009), GSE102914 (Vicente 2019) | array | raw `_RAW.tar` only | Need the array reader the data contract reserves for arrays (listed apart by owner decision J5); GSE50919 also deposits a log2 ratio table, which is not an abundance. |
| 7 | PXD000510 (Guerreiro 2014), PXD005105 (Wang 2016), PXD005851 (Table S1 already CC BY) | LC-MS/MS | no proteome-wide table served by PRIDE | Need the deposit's result files opened, as PXD030282's were; PXD005851's Table S1 route is already documented. |
| 8 | Rubin et al. 2015 Dataset S3 | essentiality | PNAS supplement | Original-file download/catalogue deferred for owner review 2026-10-07; calls already shown through the Adomako 2022 republication. |
| 9 | RefSeq annotation inputs for the admitted strains | annotation | GFF and feature tables | Original-file download/catalogue deferred for owner review 2026-10-07; retain existing NCBI RefSeq and EcoCyc attribution. |

## Work

1. Rows 1 and 2: specs under `data/expression/ingest/` with condition records
   from package B and the addendum, ingestion, manifest, pins, gates.
2. Row 5, then row 7 as the archives allow.
3. Row 6: an array reader (per-probe to per-gene mean, deposited normalisation
   kept) and the "array" platform listed apart in Data Sources.
4. Rows 3 and 4 as their condition questions resolve. Rows 8 and 9 await the
   separate owner review; do not add original-file downloads or catalogue fields
   as part of this ingestion pass.
5. Keep the ledger and the roadmap register's bracketed history accurate as
   each lands.

## Verification

Documentation update verified 2026-10-07: the 32-ticket filename/H1/status,
main-queue membership and local-link checks passed; `git diff --check` was clean.
Required gates on the isolated docs worktree: `npm test` 1,116 passed;
`.venv/bin/python -m pytest -q` 494 passed, 1 skipped, 36 subtests;
`.venv/bin/python tools/validate_contract.py` 116 passed, 0 failed, 1 declared
skip. This pass changed no application code, release data or browser UI;
implementation-specific validation remains separate.

Not started. Each source: the gates (`npm test`, pytest, `tools/validate_contract.py`),
the join audit counts in its `ingest` block, a rendered check of its Data Sources
entry and legend, and its citation row with downloads that resolve.

## Cleanup

On resolution, distil any new reader or array rule into
`docs/validation/data-contract.md`, update `validation/INDEX.md`, then delete
this ticket and its index row.

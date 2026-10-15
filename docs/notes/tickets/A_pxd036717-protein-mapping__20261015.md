# A_pxd036717-protein-mapping__20261015 — Active

Scope: Resolve PXD-JOIN in the data-sources ticket using the existing pinned
UniProt ordered-locus table and approved PCC 7942-to-UTEX identifier crosswalk.
Status: active
Opened: 2026-10-15
Updated: 2026-10-15
Owner: cyano-lit-unreach (80c81443-1791314087)

## Current State

Isolated branch `work/pxd036717-mapping-20261015`, baseline `491c6f86`, in
`../worktrees/pxd036717-mapping-20261015`. Canonical repository:
`/Users/Rohin/Desktop/coding_stuff/ISAACS-LAB/isaacs-cyano-gene-selection`.
Leave the TSS and unknown-function sessions' paths/worktrees unchanged.

The source-preserving reader and non-imputed ratios are already complete.
This ticket adds a deterministic, audited identifier join. Keep every source
row, including unmapped/ambiguous groups; do not spread a multi-accession
group's values over multiple genes. Require one-to-one links in both mapping
inputs, preserve exact identifiers, source rows and pins, and retain the
distinction between PCC 7942 evidence and transferred UTEX identifiers.
No alias matching, new homology inference, coordinate transfer, imputation,
browser release, or change to the other ingestion routes is authorized here.

## Verification

Implementation: `0609c1a`. Independent source-only audit DEM-426 reproduced
the exact-locus counts and found two RefSeq disagreements affecting seven
rows. The mapper withholds those rows: 1,550 assigned and 75 unassigned,
with all 1,625 source rows and measurements preserved.

Passed on 2026-10-15: 73 focused reader/mapping tests; `npm test` (1,653
passed); Python `pytest -q` (2,375 passed, 23 skipped, 51 subtests passed);
`tools/validate_contract.py` (130 passed, one declared spliced-CDS skip).
The private pinned workbook regression ran, rather than skipping.

DEM-427 review findings (repair in progress):
- **MAP-1 open:** RefSeq confirmation must be present, not merely non-conflicting.
  An offline comparison independently confirmed different source/UTEX protein
  lengths for all 84 affected rows; withhold these as `refseq_unconfirmed`.
- **MAP-2 open:** pin every real-input exclusion status and detection count.
- **MAP-3 open:** expose competing identifiers and rows for reverse collisions.

The repair now assigns 1,466 rows and retains 159 unassigned, with no source
measurements changed. Pending: repair tests, exact-patch re-review and gates.

## Cleanup

Resolve only this session's bounded ticket. Move reusable join rules and
reproduction checks into the PXD036717 validation guide. Preserve PXD-IDENT,
PXD-CONDITION, PXD-RELEASE and PXD-DETECTION as open in the parent ticket.

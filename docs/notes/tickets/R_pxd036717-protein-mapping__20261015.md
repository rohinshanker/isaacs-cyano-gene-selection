# R_pxd036717-protein-mapping__20261015 — Resolved

Scope: Resolve PXD-JOIN with a pinned, exact PCC 7942-to-UTEX identifier join.
Status: resolved
Opened: 2026-10-15
Updated: 2026-10-15
Closed by: cyano-lit-unreach (80c81443-1791314087), 2026-10-15.

## Outcome

Implemented in `0609c1a`, repaired in `b890507`, with final test refinements in
`48e6769`. All 1,625 source rows remain intact: 1,466 assigned and 159
unassigned, with every source measurement preserved. Assignment requires
whole-input mutual uniqueness and agreeing RefSeq identifiers. Protein groups,
collisions, disagreements and missing confirmation remain unassigned with
inspectable candidates and source-row provenance. No browser layer is released.

Reusable source pins, mapping rules, exclusion counts, length checks and
reproduction commands are preserved in
[the PXD036717 validation contract](../../validation/pxd036717-enrichment.md#exact-identifier-mapping).

## Verification

- Independent source-only audit DEM-426; exact-patch review DEM-427 approved
  `b890507` after one repair pass.
- MAP-1 (missing RefSeq confirmation): resolved `b890507`.
- MAP-2 (complete exclusion/detection regression counts): resolved `b890507`.
- MAP-3 (reverse-conflict source provenance): resolved `b890507`.
- Review nits (empty competitor-list assertion and blank-line style): resolved
  `48e6769`; 74 focused tests passed on that final test change.
- Full required gates on the repaired implementation: `npm test` 1,653 passed;
  Python `pytest -q` 2,376 passed, 23 skipped, 51 subtests passed;
  `tools/validate_contract.py` 130 passed, one declared spliced-CDS skip.
  The private pinned-workbook regression ran. No UI paths changed.
- Local documentation links, queued ticket H1 identifiers and `git diff --check`
  passed. The global ticket checker passed its six configured scopes; this
  repository's links were checked separately.

## What remains

No audit findings remain open against this bounded mapper. The parent
[O_data-sources-selection__20261005](O_data-sources-selection__20261005.md)
retains **PXD-IDENT open**, **PXD-CONDITION open**, **PXD-RELEASE open** and
**PXD-DETECTION open**. The 91 rows lacking RefSeq confirmation remain withheld;
restoring any requires a recorded identity check under PXD-IDENT. This ticket
neither closes the parent nor admits the source to the browser.

## Cleanup

Reusable guidance has been distilled. Remove this ticket's queue row, commit
closure, then delete this resolved ticket last. Integrate and push only this
session's completed commits; preserve other sessions' worktrees and tickets.

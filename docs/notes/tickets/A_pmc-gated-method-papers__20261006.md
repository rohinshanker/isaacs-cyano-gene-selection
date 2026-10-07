# A_pmc-gated-method-papers__20261006 — Active

- **Scope:** Read the four PMC-deposited statistics-method papers the
  comparability memo cites from abstracts only, once the owner saves them past
  PMC's proof-of-work check, and update the memo's marks. Covers
  `docs/notes/handoff/cyano_comparability_methods*` only.
- **Status:** active
- **Opened:** 2026-10-06
- **Updated:** 2026-10-07

## Owner delivered the papers, 2026-10-07

All four are saved in
`~/Desktop/coding_stuff/ISAACS-LAB/private-literature/pmc/` (outside the
repository). The owner filed them under paper titles rather than PMC ids, so the
mapping, verified 2026-10-07, is:

| PMC id | Saved file |
| --- | --- |
| PMC3272078, MAQC Consortium 2006 | `The MicroArray Quality Control (MAQC) project shows inter- and intraplatform reproducibility of gene expression measurements - PMC.html` |
| PMC4260565, Lin et al. 2014 | `Comparison of the transcriptional landscapes between human and mouse tissues - PMC.html` |
| PMC3810845, Reese et al. 2013 | `A new statistic for identifying batch effects in high-throughput genomic data that uses guided principal component analysis - PMC.html` |
| PMC6171491, Evans et al. 2017 | `Selecting between-sample RNA-Seq normalization methods from the perspective of their assumptions - PMC.html` |

**The access blocker is gone** and item 2 of
[AAA-next-steps.md](../../validation/AAA-next-steps.md) is done. Remaining work
is unchanged and unblocked: re-match the comparability memo's claims against the
full texts and clear the "(abstract only)" marks that the full text supports.

## Current state

On 2026-10-06 PMC article pages answered the agents with a proof-of-work
interstitial and Europe PMC's `fullTextXML` returned HTTP 500 for MAQC 2006
(PMC3272078), Lin 2014 (PMC4260565), Reese 2013 (PMC3810845) and Evans 2017
(PMC6171491). The owner will clear the check and save the pages; instructions
are item 2 of [AAA-next-steps.md](../../validation/AAA-next-steps.md). Nothing
in the data waits on this: the memo already marks every abstract-only claim.

## Work

1. Owner: save the four pages into the drop folder.
2. Extract the text, re-match each memo claim the paper backs, drop the
   "(abstract only)" mark where the full text supports the claim, and record the
   check with `tools/check_addendum_quotes.py` conventions.

## Verification

Not started. The memo's claims and the companion table's `retrieved_via` column
agree; no other file changes.

## Cleanup

On resolution, delete this ticket and its index row; nothing to distil.

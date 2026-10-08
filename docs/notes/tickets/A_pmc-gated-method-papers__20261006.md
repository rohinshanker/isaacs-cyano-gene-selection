# A_pmc-gated-method-papers__20261006 — Active

- **Scope:** Read the four PMC-deposited statistics-method papers the
  comparability memo cites from abstracts only, once the owner saves them past
  PMC's proof-of-work check, and update the memo's marks. Covers
  `docs/notes/handoff/cyano_comparability_methods*` only.
- **Status:** active
- **Opened:** 2026-10-06
- **Updated:** 2026-10-07
- **Owner:** `cyano-general-ticket-closing` (`bfdd1b08-1791384632`), integrating
  on branch `pmc-method-papers-20261007` from `be5b3b3`.

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

All four saved HTML articles were read and pinned in
`docs/notes/handoff/cyano_comparability_methods_fulltext_20261007.json`.
The reproducible script in `docs/validation/comparability-methods-evidence.md`
verified four HTML/text hash pairs and all 12 excerpts at their cited anchors.
The citation inventory is 44 papers: 33 full text, 11 abstract only; the four
promoted rows and memo marks agree. Full-text reading adds the limits below.

- `npm test`: 1,272 passed.
- Python gate: the first worktree run lacked nine ignored raw inputs; all 13
  affected tests passed after linking the pinned canonical inputs. The final
  full gate passed: 783 passed, one skipped, 36 subtests passed.
- `tools/validate_contract.py`: 116 passed, 0 failed, one declared spliced-CDS
  contiguity exemption.
- `git diff --check`: passed.
- Multica `DEM-308`: independent four-paper reading in progress; exact-patch
  review has not started. This ticket cannot close until review clears.

## Open findings

- `PMC-1` — open: MAQC's strong A/B reference contrast needs its limitation on
  weaker biological contrasts retained.
- `PMC-2` — open: Lin's species clustering needs its tissue-selection and
  principal-component scope retained.
- `PMC-3` — open: gPCA uses supplied batch labels; it does not identify a
  technical cause when study and biology are confounded.
- `PMC-4` — open: Evans distinguishes constant total mRNA/cell from balanced
  expression assumptions and explicitly scopes its analysis to mRNA/cell.

## Cleanup

On resolution, name the closing session/date and disposition every finding.
Preserve the evidence pins and reusable quote/anchor verification contract,
replace links to this ticket, then remove the resolved ticket and queue row.

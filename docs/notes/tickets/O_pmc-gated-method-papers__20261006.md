# O_pmc-gated-method-papers__20261006 — Open

- **Scope:** Read the four PMC-deposited statistics-method papers the
  comparability memo cites from abstracts only, once the owner saves them past
  PMC's proof-of-work check, and update the memo's marks. Covers
  `docs/notes/handoff/cyano_comparability_methods*` only.
- **Status:** open
- **Opened:** 2026-10-06
- **Updated:** 2026-10-06

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

# O_package-e-evidence-gaps__20261005 — Open

- **Scope:** Close the gaps in the evidence Claude Science package E returned, so the
  owner and labmates decide on results that can be reproduced: the pilot's missing
  code, its small sample, the hand-built condition records, and the audit's unread
  files. Covers `docs/` and, if approved, a re-implementation outside the release.
- **Status:** open
- **Opened:** 2026-10-05
- **Updated:** 2026-10-05

## Current state

Opened at the owner's request. Package E returned 2026-10-05 and has not been through
intake; `docs/notes/handoff/INTAKE_PROMPT_20261005_rev1.txt` is the prompt for that.
Checked here already: all 16 file checksums match, and the pilot's headline numbers
recompute from its pairs file (pooled AUROC 0.932, replicate bound 0.939, 0 of 7,812
cross-study pairs inside it, similar-controls AUROC 0.462). Register rows covered:
AUD-01, AUD-02.

**Mockup, resolved 2026-10-05.** Claude Science never rendered it. Rendered here at
1440, 768 and 375 px: it loads with no script error, the three data-type tabs and
the group checkboxes work, and ticking condition sets fills the compare pane.
Defects seen: at 375 px the condition strip is clipped inside its pane after the
light column; the spectrum code overlaps the light-regime bar; the phase chips
truncate. These are notes for whoever builds the real panel, not fixes to make in
the mockup.

## Work

| Gap | Why it matters | Manual workaround | Automated workaround |
| --- | --- | --- | --- |
| The pilot names `pilot_code.tar.gz`; it was not delivered | The 10,440-pair file cannot be regenerated, so the figure rests on trust in one run | Owner saves the archive from the Claude Science session into `docs/notes/handoff/` | The agents re-implement the pilot from its written method and its seven checksummed GEO files, as an independent second check. Needs the owner's yes to download those seven tables for calibration |
| AUROCs carry no confidence intervals; sample pairs are not independent | A reader cannot tell 0.94 from 0.90 | — | A bootstrap that resamples samples, not pairs, in the re-implementation |
| The one cross-study result that works, fold-change agreement, rests on two contrast pairs from two studies | It is the statistic the design proposes to rely on | Labmates name further matched perturbations they know of in these series | Extend to every control-and-treatment contrast once uniformly processed values exist; see [O_condition-metadata-gaps__20261005](O_condition-metadata-gaps__20261005.md) item 6 |
| GSE45762 was dropped because its labels contradict themselves | One of seven tables lost | Ask the submitter; drafted under the metadata ticket | — |
| 15 of 44 method sources were read from abstracts only | Some support key claims | Supply full texts | Read those with a deposit; see [O_unreadable-literature-workarounds__20261005](O_unreadable-literature-workarounds__20261005.md) item 5 |
| The 63 condition records were parsed by hand after a keyword pass gave false positives; package D's first automated parse also misread values | The mockup and any future selector read these records | A second person reads a sample against package B | A checker that every number in a record appears in the package B cell it cites, plus a validator for ranges, units and the tag vocabulary |
| The audit's model read covered 49 of 84 file chunks | The unread files include the comparison and filter views a selector would change | — | A follow-up audit package naming only the 35 chunks, or an in-repository read; the owner chooses |
| A-01 and A-04 were never confirmed on screen | The audit-fixes ticket requires it before either fix is designed | — | Rendered check at three widths, already item 1 and item 3 of [O_data-use-audit-fixes__20261004](O_data-use-audit-fixes__20261004.md) |

## Decisions, 2026-10-05

- **Calibration downloads: allowed.** The agents may download the candidate tables
  and the iModulon compendium for calibration, with nothing entering `data/` or
  `site/` outside the admission contract. Recorded in the source ledger.
- **The unread audit files: an in-repository read.** Claude Science is now the last
  resort, so the 35 chunks are read here.
- **The blocked-task register is not opened as a ticket.** Its actionable rows live
  in the tickets opened 2026-10-05, grouped by remedy; the returned table stays in
  `docs/notes/handoff/` as evidence.

## Verification

Not started, except the mockup render recorded above. A re-implementation counts as
agreement only if it reproduces the pair counts by class and the headline statistics
without reading the missing archive. Calibration files stay outside the release.

## Cleanup

On resolution, record in `docs/validation/` which statistics the pilot supports and
with what uncertainty, update `validation/INDEX.md`, then delete this ticket and its
index row.

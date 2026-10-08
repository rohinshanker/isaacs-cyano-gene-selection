# R_pmc-gated-method-papers__20261006 — Resolved

- **Scope:** Integrate the four owner-saved PMC methods papers into the comparability memo and citation table; preserve reproducible full-text evidence.
- **Status:** resolved
- **Opened:** 2026-10-06
- **Updated:** 2026-10-07
- **Closing session:** `cyano-general-ticket-closing` (`bfdd1b08-1791384632`), 2026-10-07.

## Outcome

MAQC 2006, Lin 2014, Reese 2013 and Evans 2017 support their attributed claims with the retained limitations. The memo and table now agree on 44 citations: 33 full text and 11 abstract only. No source admission, normalization implementation, licence decision, identifier join or lab decision changed. Canonical integration: `b10c572f4d2ad8d82993deb51cbb200068f8f246`; reviewed identical documentation: `dd35f762359329a98b1baafcdc1b1e1ffa692999`.

## Findings and what remains

| Finding | Disposition |
| --- | --- |
| PMC-1 — MAQC strong-reference-contrast scope | Resolved by `b10c572`; filtering and weaker-contrast limits retained |
| PMC-2 — Lin tissue/component scope | Resolved by `b10c572`; tissue-subset and later-component results retained |
| PMC-3 — gPCA supplied labels and confounding | Resolved by `b10c572`; independent simulations, CNV scope and project-specific inference explicit |
| PMC-4 — Evans method-specific assumptions and expression target | Resolved by `b10c572`; balance, per-cell/per-transcriptome and control limits retained |
| DEM-311 exact-patch audit | Completed and accepted 2026-10-07; no material finding |

No open finding or remaining step in this ticket's scope. The other 40 sources were not re-reviewed; the 11 remaining abstract-only sources keep their marks. Supplements, MAQC's publisher version and its comment letters were outside this four-paper read, and no claim depends on promoting them.

## Verification

- Independent Claude evidence reading `DEM-308`: all four claims supported with caveats; completed.
- Independent exact-patch review `DEM-311`: accepted `dd35f76`; completed.
- Four source HTML hashes and four extracted-text hashes verified; 12 of 12 excerpts matched within their cited body anchors.
- Citation parity: only the four assigned rows promoted; the 11 remaining abstract-only sources keep their first-use marks.
- `npm test`: 1,272 passed.
- Full Python gate: 783 passed, one skipped, 36 subtests passed, after providing nine ignored pinned raw inputs from the canonical checkout.
- Contract validator: 116 passed, zero failed, one declared spliced-CDS contiguity exemption.
- `git diff --check`: passed.

## Cleanup

The reusable evidence pins, filename/PMC mapping, located excerpts and interpretation limits are in `docs/notes/handoff/cyano_comparability_methods_fulltext_20261007.json`. The reproducible extraction/hash/anchor check and citation-status contract are in `docs/validation/comparability-methods-evidence.md`, listed in its index. The owner next-steps link points there and this queue row is removed. Nothing a later reader needs remains only in this ticket. Delete this resolved file last; retain no task ledger or terminal output.

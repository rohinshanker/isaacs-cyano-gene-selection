# O_tss-site-rows-vs-initiation-mismatch__20260922 — Open

- Scope: Tan 2018 TSS evidence joins; `tssInitiation` metric versus Table S1 site rows; detail-panel and export wording.
- Status: open
- Opened: 2026-09-22
- Updated: 2026-09-22

## Decision (2026-09-22, owner)

Keep the layers independent, Option C, with the reason on every detail and
export row; recorded in `AAA-biological-decisions-to-review.md` row 11 for lab
review. No reconciliation or shared rebuild in this ticket.

## Lab review boundary

The repository owner selected Option C: keep the layers independent and state
the reason in every detail and export row. The biological-decision register
retains all three quantified options for lab review; this ticket does not merge,
backfill, or rebuild either pinned layer.

## Current State

The implementation now reproduces the exact 472 site-only and 410 score-only
loci, documents that the mismatch comes from two independent exact-locus source
tables rather than a shared distance window, and labels both directions in gene
detail and exports. The layers remain separate under the owner's Option C
decision, pending lab review of the biological-decision register.

Two Tan 2018 derived layers disagree about which genes have TSS evidence.
Exactly 472 loci have Table S1 TSS site rows but no `tssInitiation` value, and
exactly 410 loci have a `tssInitiation` value but no site rows. A gene can
therefore show "TSS initiation evidence (2 mapped sites)" beside a metric row
that reads "no basis". This predates the CAI/tAI default changes and was
surfaced while promoting measured evidence to the defaults. Sources:
`data/expression/TAN2018_TSS_PROVENANCE.md`, `scripts/tss_evidence.py`,
`scripts/prepare_tan2018*.py`, `site/js/core/tss-evidence.js`, and
`docs/validation/data-contract.md` (separate gTSS evidence section).

Work required:

- Reproduce the two counts from the pinned Tan extracts and explain each
  direction: which join, filter, or locus-mapping rule admits a site row but
  not a metric value, and the reverse. Record the rule, not a guess.
- Decide, and record for lab review in
  `docs/validation/AAA-biological-decisions-to-review.md` (or its renamed
  successor), whether the two layers should share one locus set, whether one
  should fall back on the other with a labelled basis, or whether they stay
  separate with clearer wording. Do not merge them silently; the gTSS and
  non-gTSS extracts have distinct interpretation boundaries in the provenance
  document.
- Whatever is decided, the detail panel and export must never show a mapped
  site count beside an unexplained "no basis" metric row: state the reason in
  the row (for example, sites present but outside the initiation window the
  metric uses).
- Keep every pinned extract and checksum unchanged unless the decision
  requires a rebuild, in which case follow the provenance document's rebuild
  steps and update its counts.

## Verification

- `tests/test_tss_layer_mismatch.py` calls the production
  `load_tss_evidence` join and asserts 1,789 site loci, 1,727 score loci, a
  1,317-locus intersection, 472 site-only loci, and 410 score-only loci.
- JavaScript coverage verifies absent-layer exports, provenance-driven wording,
  the one-shape manifest basis, the shipped mismatch examples, and the corrected
  metric help.
- `npm test`: 498 passed. Python: 302 passed and 22 subtests passed. Contract
  validation: 82 passed, one declared spliced-CDS skip. Live metrics: passed.
- The real site was inspected at 1440×900 and 390×844 with `M744_RS00030`
  pinned: the Figshare/Table S1 wording and site-only basis wrapped without page
  or help overflow. The no-Tan fixture exported blank TSS basis, reason, and site
  count fields. Both final browser sessions had zero console messages.

## Cleanup

Distill the reconciliation rule into
`data/expression/TAN2018_TSS_PROVENANCE.md` and
`docs/validation/data-contract.md`, update `docs/validation/INDEX.md`, then
delete this ticket and its queue row.

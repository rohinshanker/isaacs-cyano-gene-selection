# O_tss-site-rows-vs-initiation-mismatch__20260922 — Open

- Scope: Tan 2018 TSS evidence joins; `tssInitiation` metric versus Table S1 site rows; detail-panel and export wording.
- Status: open
- Opened: 2026-09-22
- Updated: 2026-09-22

## Requires your validation

An agent can reproduce the counts, record the join rule, and fix the wording,
but the reconciliation choice is yours. When the implementer's report lands,
decide one of: (a) one shared locus set for both layers; (b) each layer falls
back on the other with a labelled basis; (c) the layers stay separate with
the reason stated in every row. Record the decision in
`docs/validation/AAA-biological-decisions-to-review.md`; the implementer must
not merge the layers without it.

## Current State

Two Tan 2018 derived layers disagree about which genes have TSS evidence.
About 472 loci have Table S1 TSS site rows but no `tssInitiation` value, and
about 410 loci have a `tssInitiation` value but no site rows. A gene can
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

Pending: a reproducible count script or test that asserts the two mismatch
counts against the pinned data and fails if they drift; unit tests for the
new wording path; contract validator green; rendered inspection of a locus in
each mismatch direction at desktop and about 390 px.

## Cleanup

Distill the reconciliation rule into
`data/expression/TAN2018_TSS_PROVENANCE.md` and
`docs/validation/data-contract.md`, update `docs/validation/INDEX.md`, then
delete this ticket and its queue row.

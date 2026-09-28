# O_claude-science-data-use-audit__20260928 — Open

- **Scope:** Commission a Claude Science audit of how this repository already uses,
  derives, and interpolates every dataset it ships: whether each displayed value
  still means what its source measured, and whether any derivation crosses a line
  the data contract draws. Reviews `data/`, `site/`, `scripts/`, `tools/`, and the
  reader-facing prose. Produces findings only; every fix is a separate change.
- **Status:** open
- **Opened:** 2026-09-28
- **Updated:** 2026-09-28

## Current state

The release ships measured values, borrowed values, model-derived values, and
sequence-derived proxies side by side. The rules keeping them apart are written
down, in the [data contract](../../validation/data-contract.md) and the per-source
documents in `docs/validation/`, and parts of them are checked mechanically by
`tools/validate_contract.py` and the test suites.

What no check covers is whether the *meaning* still holds. A validator confirms a
field is present, correctly typed, and re-derivable from its inputs. It cannot
confirm that the sentence beside the number is true, that a percentile was taken
over the right denominator, that a ramp is not flattening the measurement it
displays, or that a caveat written for one view is still attached in a second view
that reuses the value. Those are semantic judgments across a large surface, and
they are what this audit is for.

The [offload ticket](O_claude-science-offload__20260927.md) covers finding *new*
data. This one covers the data already here. The two must not be merged: one looks
outward and returns candidates, this one looks inward and returns findings.

## Before dispatch

The same unresolved item as the offload ticket applies, and is recorded there:
Claude Science's interface, its access to the primary literature behind these
datasets, and whether it can be given this repository's contents are unconfirmed.
Confirm them, and confirm how findings come back, before scoping the packages
below to what it can actually do. Nothing here assumes an answer.

If the audit can be given repository contents, give it the pinned release and the
validation documents together, because a finding is only useful when it names both
the claim and the rule it breaks.

## What to audit

### A. Does each value still mean what its source measured?

For every field the site displays, filters on, colours by, ranks with, or exports,
trace it back to the artifact it came from and check the displayed meaning against
the source's own description. Known hazards to check rather than assume:

- **TSS initiation is not transcript abundance.** Tan et al. 2018 counts measure
  promoter initiation. Check every place the value is displayed, filtered, ordered,
  or described, including the low-traffic threshold, the comparison views, the
  metric registry description, the map blurbs, and the export columns.
- **The PCC 7942 expression table is a different organism**, from a biofilm and
  conditioned-media experiment with no light or CO₂ metadata.
- **PCC 7942 essentiality is a borrowed call** under Rubin's conditions, joined by
  exact shared protein. Absent, ambiguous, and not-analyzed states are not
  non-essential.
- **CAI, tAI, and the expression proxy are conventions derived from this genome**,
  not measurements of anything.
- **GO IEA terms are computational suggestions**, and the source-derived function
  categories are model judgments above a fixed probability threshold.
- **The gene visualizer draws Tan 2018 start sites at the distances that study
  published against its own gene model**, never remeasured against this release.

### B. Where is anything filled in, and is it allowed?

Find every place a value is produced rather than read, and judge it against the
contract's rules on missingness and derivation:

- any `null` that becomes zero, a median, a false, or a confident annotation
  anywhere between the pipeline and the pixel, including in charts, ramps, sorts,
  aggregates, exports, and accessible descriptions;
- any average, merge, or score combining two sources that the contract requires to
  stay separate, and any derived field that does combine them without recording its
  inputs, normalization, uncertainty, and conflicts;
- any percentile, rank, or z-score, checked for which population it was computed
  over and whether that denominator is the one the label implies;
- any interpolation across coordinates, conditions, replicates, or strains,
  including anything that would place a sister-strain coordinate on this genome's
  axis, which the contract forbids outright;
- imputation hidden inside a library default, such as a chart filling a gap in a
  line, a scale treating absent as zero, or a sort placing unknown at an extreme
  without saying so.

### C. Are units and scales honestly mixed?

Check every axis, ramp, table column, tooltip, and export column where two
quantities of different kinds can appear together: measured against proxy, raw
count against percentile, wild type against recoded, one organism against another.
Check that a ramp is not flattening a heavy-tailed measurement into one bucket, and
that a shared scale across candidates is stated where it is used.

### D. Does the prose match the data?

Audit the reader-facing text as evidence claims: the README, the map blurbs, the
metric descriptions in `meta.json`, the help panel, the legend notes, the gene
visualizer's caveats, and the accessible descriptions. A description that overstates
what a number supports is the same defect as a wrong number, and it is the one a
validator can never catch.

### E. Do the validation documents match the code?

Every document in `docs/validation/` states a contract. Check that the shipped code
and data still satisfy it, and report drift in either direction: a rule the code
broke, and a rule the code outgrew that the document never recorded.

## Required return format

One finding per row, each independently checkable:

| Field | Contents |
| --- | --- |
| Location | Exact file and line, or the exact data field and artifact. |
| Claim | What the site currently asserts or does, quoted. |
| Source | What the underlying artifact or contract actually supports, cited. |
| Category | Meaning drift, disallowed fill, denominator or scale error, prose overstatement, or document drift. |
| Severity | Whether a reader could draw a wrong scientific conclusion, and how. |
| Evidence | How to reproduce the check. |
| Confidence | Explicit, with the reason for any uncertainty. |

Report what was checked and found correct, not only what failed, so the audit's
coverage is legible and a later run can be compared against it. Report anything the
audit could not check, and why.

## Hard boundaries

- **Findings, not fixes.** The audit changes no file in this repository. Each
  accepted finding becomes its own change with its own review.
- **Evidence, not verdicts.** A finding cites the source or the contract clause it
  rests on. An assertion without one is not a finding.
- **No new data.** This audit does not admit, download, or propose datasets. That
  is the offload ticket's scope.
- **It does not resolve the lab's open questions.** Rows 13 to 15 of
  [AAA-biological-decisions-to-review.md](../../validation/AAA-biological-decisions-to-review.md)
  and the open questions in the scan ticket stay with the lab. The audit may note
  that a question is unresolved and where that shows in the interface.
- **Uncertainty is reported, not resolved.** Where the audit cannot tell whether a
  use is defensible, it says so and states what would settle it.

## Intake

Triage each finding into: accepted and fixed, accepted and ticketed, rejected with
a recorded reason, or escalated to the lab as a scientific judgment. A rejected
finding keeps its reason, so a later audit does not re-raise it as new.

## Verification

Not started. When findings arrive, each accepted one needs its fix, a regression
test or contract check where the defect was mechanically detectable, and an update
to whichever validation document states the rule. Where a defect was **not**
mechanically detectable, record that explicitly: a class of error that only a
reader can catch is worth knowing about before the next release.

Re-run the existing gates after any fix:

```sh
npm test
.venv/bin/python -m pytest -q
.venv/bin/python tools/validate_contract.py
```

## Cleanup

On resolution, distil any durable rule the audit establishes into the relevant
`docs/validation/` document, add the audit's reusable checklist to
`docs/validation/` if it is worth repeating before a release, update
`validation/INDEX.md`, then delete this ticket and its index row. Do not retain the
findings list itself once each row is fixed, ticketed, or rejected with its reason.

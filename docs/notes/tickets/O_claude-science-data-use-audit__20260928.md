# O_claude-science-data-use-audit__20260928 — Open

- **Scope:** Commission a Claude Science audit of how this repository already uses,
  derives, and interpolates every dataset it ships: whether each displayed value
  still means what its source measured, and whether any derivation crosses a line
  the data contract draws. Reviews `data/`, `site/`, `scripts/`, `tools/`, and the
  reader-facing prose. Produces findings only; every fix is a separate change.
- **Status:** open
- **Opened:** 2026-09-28
- **Updated:** 2026-10-04

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

**Returned 2026-10-03, intake 2026-10-04.** Sent 2026-10-02. The return is
[`cyano_data_use_audit_20261003.tsv`](../handoff/cyano_data_use_audit_20261003.tsv)
(SHA-256 `708a3294f993fc1574f76ef6a969e519721a4c21816c262f3db9fe19d60e4913`, 10
findings) with its rendering
[`cyano_data_use_audit_20261003.md`](../handoff/cyano_data_use_audit_20261003.md)
(SHA-256 `e80d6a6b18dbb71f5619381cca3fb7781db0f9dee229d0a40c6b38e6b72e0514`) and
section D of
[`RET_claude-science-session__20261003.md`](../handoff/RET_claude-science-session__20261003.md).
Both checksums recomputed and match. It audited commit `70bc5900` plus the
working tree; the triage under "Intake" below was done against the working tree
of 2026-10-04, in which the two modified files it names carry only the changes
the diff shows. The findings were pasted back as a results block (the two files
above) and are triaged and
fixed by the in-repo agents, never by the audit itself. The block shape, the intake
checks, and the rule that a return carries no patch are fixed in
[claude-science-handoff.md](../../validation/claude-science-handoff.md); this audit is
a work package under that contract, not a claim row.

## Before dispatch

Resolved 2026-09-28. The confirmations live in the offload ticket under
[Before dispatch](O_claude-science-offload__20260927.md#confirmed-2026-09-28) and are
not duplicated here. What they mean for this audit:

- **It can be given this repository.** The branch was mounted read-write and both
  `data/expression/sources.json` checksums recomputed and matched, so the audit can
  be handed the pinned release and `docs/validation/` together, which is what the
  paragraph below asks for.
- **It can read the primary literature behind the shipped datasets.** Tan 2018 is
  CC BY 4.0 in PMC and its record resolves; the PNAS 2018 comparative-genomics paper
  is subscription-only but readable from its PMC deposit. Retrieval is by deposit,
  not by subscription, so a source paper with no deposit would have to be supplied by
  the lab — none of the currently shipped sources is in that position.
- **Findings come back** as a saved artifact, one row per finding in the format below
  as TSV plus a Markdown rendering, optionally written into the working tree. No
  fix is applied, per the hard boundaries.
- **No narrowing on licence legends.** Per-file licence legends come from Europe
  PMC, not from publisher hosts, so a finding that turns on the exact wording of a
  supplement legend is checkable the same route package C's licence evidence uses;
  see
  [claude-science-handoff.md](../../validation/claude-science-handoff.md#what-claude-science-is-for-this-repository).

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

### Intake check, 2026-10-04

Every location the ten findings cite was opened on the working tree and holds the
quoted code or field. The uncommitted diffs in `site/js/ui/chromosome-view.js`
(one constant exported) and `site/js/ui/gene-viewer.js` (an accessible-description
sentence added above the cited line) do not touch what A-02 and A-07 cite, so both
findings hold on commit `70bc5900` as well. Every number was recomputed from the
shipped files with the same definitions the audit states and reproduced exactly:

| Finding | Recomputed on 2026-10-04 |
| --- | --- |
| A-01 | 421 of 2,551 `expression` values and 272 of 1,727 `tssInitiation` values exceed robust \|z\| = 3 (median and 1.4826 × MAD, IQR fallback); maxima 432.3 and 378.4. Eight of 35 registry metrics clamp more than 5% of their valued genes; the audit's seven excludes `rareCount`, which sits at exactly 5.0%. |
| A-02 | 2,432 gTSS rows; 2,196 agree, 236 rows over 178 loci differ by 3 to 198 nt, median 34.5; 15 implied distances negative. `tss_evidence.json` has 1,789 keys. |
| A-03 | None of the pipeline risk-feature columns has a null in `genes.json`; the fill is dormant. |
| A-05 | Both `sourceWarnings` entries carry `comparison: "dark"`. |
| A-06 | 0 zeros and 0 nulls in `source_start_distance_nt` across the 2,333 `regulatory_tss.json` rows; 47 zeros in the Table S1 extract. |
| A-07 | `lengthCodons` has no nulls. |
| A-08 | 59 loadings, all components finite. |
| A-09 | Average-rank reproduces the shipped `expressionPercentile` to 5.0e-7; mid-rank differs by up to 1.97e-4; shipped maximum 1.0. |
| A-10 | `genesWithoutMappedTss` 926; `tssInitiation` non-null for 1,727; 2,715 − 926 = 1,789. |

The audit's three rejected candidates were re-read and the rejections stand for
the reasons it gives (pinned `jev-1.13.0` is a documented judgment source; the
lab-reviewed search tier reads only `reviewedFunctionLabels`; Tan 2018 absolute
coordinates are native to the genome of record). They are recorded here as
rejected so a later audit does not re-raise them.

### Triage, 2026-10-04

Each fix is its own change with its own review, per the hard boundaries. The code
fixes are collected in
[O_data-use-audit-fixes__20261004](O_data-use-audit-fixes__20261004.md), one
item per finding; the two document-only fixes were made here.

| Finding | Triage | Where |
| --- | --- | --- |
| A-01 clamp hides heavy tails in the comparison views | Accepted and ticketed | Fixes ticket item 1: mark clamped values in the radar and parallel-coordinates views and record the clamp in `candidate-comparison-and-export.md`; needs rendered validation |
| A-02 gene visualizer and chromosome view place the same gTSS differently | Accepted and ticketed, and escalated to the lab | Fixes ticket item 2 labels the divergence in both views and both documents; which placement a construct boundary should follow is a scientific judgment, added as evidence to row 8 of [AAA-biological-decisions-to-review.md](../../validation/AAA-biological-decisions-to-review.md) |
| A-03 live PCAs mean-impute, contract silent | Accepted and fixed (document) | [data-contract.md](../../validation/data-contract.md) now records the exception and points to `metric-explanations.md`; whether to drop the exception instead is an owner choice, noted there |
| A-04 length histogram text claims a range filter it did not apply | Accepted and ticketed | Fixes ticket item 3; needs rendered validation including the accessible label |
| A-05 hardcoded "Dark vs control" prefix | Accepted and ticketed | Fixes ticket item 4 |
| A-06 truthiness guard drops a distance of 0 | Accepted and ticketed | Fixes ticket item 5 |
| A-07 `lengthCodons ?? 0` renders a missing count as 0 | Accepted and ticketed | Fixes ticket item 6 |
| A-08 `?? 0` on PCA loadings | Accepted and ticketed | Fixes ticket item 7 |
| A-09 two percentile-rank conventions | Accepted and fixed (document), remainder ticketed | [metric-convention-parity.md](../../validation/metric-convention-parity.md) now records the split and its bound; unifying the two is fixes ticket item 8 |
| A-10 `meta.json` carries two TSS coverage counts without naming the layer | Accepted and ticketed | Fixes ticket item 9: a pipeline change adding the layer name beside each count |

No finding was rejected. Nothing here touches rows 13 to 15 of the
biological-decisions list.

## Verification

Intake complete 2026-10-04 (checksums recomputed, every cited location opened,
every number reproduced; table above). The two document fixes landed with this
intake; the repository gates were re-run after them. Each code fix is verified in
[O_data-use-audit-fixes__20261004](O_data-use-audit-fixes__20261004.md). For
findings A-01 and A-04 the audit itself notes that no browser was run, so the fix
is designed only after the defect is confirmed on screen. When findings arrive, each accepted one needs its fix, a regression
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

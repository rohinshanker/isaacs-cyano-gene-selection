# Data-use audit checklist

A release-time review of whether every displayed value still *means* what its
source measured. The validator and the test suites confirm a field is present,
typed, and re-derivable; they cannot confirm that the sentence beside a number is
true, that a percentile was taken over the right denominator, that a ramp is not
flattening a measurement, or that a caveat written for one view is still attached
in another. Those are semantic judgments across the whole surface, and this is
the list to walk before a release. Its first run (2026-10-03, intake
2026-10-04) returned ten findings; every one is closed, and what each class
taught is recorded below.

## What to walk

### A. Does each value still mean what its source measured?

For every field the site displays, filters on, colours by, ranks with, or
exports, trace it to its artifact and check the displayed meaning against the
source's own description. Known hazards to check, never assume:

- TSS initiation is promoter initiation, not transcript abundance: check every
  place the value is shown, thresholded, ordered, or described.
- The PCC 7942 expression tables are a different organism; each ingested layer
  carries its own strain, condition record, and caveat.
- PCC 7942 essentiality is a borrowed call under Rubin's conditions; absent,
  ambiguous, and not-analyzed are not non-essential.
- CAI, tAI, and the expression proxy are conventions derived from this genome.
- GO IEA terms are computational suggestions; source-derived categories are
  model judgments above a fixed probability.
- The gene view draws Tan 2018 start sites at the published distance and the
  chromosome view at the published coordinate; the two differ for a minority of
  sites and each view says so ([controls-column-and-resets.md](controls-column-and-resets.md),
  [chromosome-view.md](chromosome-view.md)).

### B. Where is anything filled in, and is it allowed?

Find every place a value is produced rather than read:

- any `null` that becomes zero, a median, a false, or a confident annotation
  between the pipeline and the pixel, including charts, ramps, sorts,
  aggregates, exports, and accessible descriptions;
- any average, merge, or score combining sources the contract keeps apart;
- any percentile, rank, or z-score, checked for its population and whether that
  denominator is the one the label implies;
- any interpolation across coordinates, conditions, replicates, or strains;
- imputation hidden in a library default: a chart bridging a gap, a scale
  treating absent as zero, a sort placing unknown at an extreme silently.

### C. Are units and scales honestly mixed?

Every axis, ramp, column, tooltip, and export column where two kinds of
quantity can meet: measured against proxy, raw count against percentile, wild
type against recoded, one organism against another. A ramp must not flatten a
heavy-tailed measurement into one bucket; a clamp must be visible where it acts
([candidate-comparison-and-export.md](candidate-comparison-and-export.md)).

### D. Does the prose match the data?

Audit reader-facing text as evidence claims: README, map blurbs, metric
descriptions in `meta.json`, help, legend notes, gene-view caveats, accessible
descriptions. An overstatement is the same defect as a wrong number, and it is
the one a validator never catches.

### E. Do the validation documents match the code?

Every document here states a contract; report drift in both directions, a rule
the code broke and a rule the code outgrew.

## Return format

One row per finding: id, severity, location (path and line or data key), the
observation with reproduced numbers, the evidence (how to reproduce it from the
shipped files), and the rule it bears on. A return carries findings, never a
patch; the fixes are made here, one change per finding, each with a regression
test or contract check where the defect was mechanically detectable.

## What the first run taught

| Class | Example | Mechanically detectable? | Now checked by |
| --- | --- | --- | --- |
| A clamp or ramp hiding a tail | ±3-spread clamp pinned 16.5% of expression values unmarked | Yes, once the share is pinned | `tests/js/compare-model.test.mjs` pins the shipped clamped counts |
| Two views placing one datum differently | gene view (distance) vs chromosome view (coordinate), 236 of 2,432 sites | Yes | `tests/js/gene-view-tan-evidence.test.mjs` pins 236 and 15 |
| A label describing an encoding that is not applied | length histogram "blue/grey by range" on cohorts the range ignores | No; only a reader notices | unit test on the gene-span cohort's label |
| A fixed prefix standing in for a data field | every source warning read "Dark vs control" | Yes, when a second value exists | test over a non-dark warning |
| A truthiness gate dropping a legitimate zero | a start distance of 0 lost its number and caveat | Yes | test over a zero |
| `?? 0` or `?? median` on a missing value | missing codon count drawn as "0 sense codons"; missing loading component ranked as 0 | Yes | `formatCount` missing guard; loadings test |
| Two conventions for one statistic | pipeline average-rank vs browser mid-rank percentile | Yes | parity check in `check_live_metrics.mjs` and `tests/js/stats.test.mjs` ([metric-convention-parity.md](metric-convention-parity.md)) |
| A count with no named denominator | `genesWithoutMappedTss` and "available for N genes" named no layer | Yes | `validate_contract.py` pins both against the shipped columns |
| A document silent on an exception the code makes | live PCAs mean-impute | No | recorded in [data-contract.md](data-contract.md) |

The two classes a machine cannot catch, a label describing an encoding that is
not applied and a document silent on an exception, are the reason to walk this
list by eye before a release rather than rely on the gates.

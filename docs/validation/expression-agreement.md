# Processed expression agreement

`tools/expression_agreement.py` calculates descriptive evidence from the admitted
RNA-seq tables. It does not admit a source, judge biological comparability, combine
layers, or replace the separate raw-read reprocessing workflow. The owner's J6
rule is level correlation beside within-condition replication and response
correlation where each contrast has its own reference arm; no statistic has a
pass mark.

## Inputs and reproduction

The reviewed `config/expression_agreement.json` pins each ingestion specification
by SHA-256. Each specification pins the deposited files, reader, identifier
namespace, normalization and admitted sample columns. The plan explicitly names
replicate type, exact time/condition strata, treatment and control columns, and
which response pairs to compare. Changing a source, sample scope or contrast
requires reviewing and repinning the plan. Column order alone never establishes
replication or a control relationship.

```sh
.venv/bin/python tools/expression_agreement.py \
  config/expression_agreement.json /tmp/cyano-expression-agreement.json \
  --interim data/interim/expression
.venv/bin/python -m pytest -q tests/test_expression_agreement.py
```

The tool checks cached/downloaded bytes before reading. It uses the ingestion
reader, per-sample normalization and pinned exact one-to-one PCC 7942 to UTEX 2973
crosswalk. Ambiguous mappings and absent measurements remain absent. CPM library
size is computed over the same retained source features as the admitted layer,
before crosswalk loss. Calibration output belongs outside `data/` and `site/`.
Plan, specification, source-file and crosswalk hashes travel with the report.
An isolated worktree may link its cache files to the canonical checkout: those
bytes are checked by the same pins. Source names must be plain filenames, and
the output cannot overwrite a source through either its name or a link alias.

The [current statistics summary](../notes/handoff/cyano_processed_expression_agreement_current_20261007.json)
retains all metadata, denominators, correlations and caveats for 18 studies and
53 layers. It carries the accepted sampling-temperature corrections: GSE237858
and GSE252562 state maintenance at 30°C, but do not establish that temperature
for the sampled cultures. The sampling values stay `not reported` with the
maintenance quotation preserved. Its [replicate ranges](../notes/handoff/cyano_processed_expression_agreement_20261007_replicates.tsv)
and [response comparisons](../notes/handoff/cyano_processed_expression_agreement_20261007_responses.tsv)
are also available as tables. The summary explicitly omits the per-gene `means`
and contrast `vector` fields; the command above regenerates those full vectors.
It records the implementation checksum and numerical-library versions as well
as the input pins. Never read an omitted vector as a missing measurement.

`tools/export_expression_agreement.py` re-serialises an existing full report into
that statistics-only shape and both review tables without recomputing a number:

```sh
.venv/bin/python tools/export_expression_agreement.py \
  /tmp/cyano-expression-agreement.json \
  --json /tmp/cyano-agreement-exports/summary.json \
  --replicates /tmp/cyano-agreement-exports/replicates.tsv \
  --responses /tmp/cyano-agreement-exports/responses.tsv
.venv/bin/python -m pytest -q tests/test_export_expression_agreement.py
```

It accepts only a complete schema-1 report. A summary whose vectors are already
omitted, a duplicate layer, stratum or contrast identity, a broken layer or
contrast cross-reference, a denominator that disagrees with its own vector, and a
non-finite or overflowed number are each refused by name before any destination
is touched. Structure and value types are checked the same way, and never by
recomputing a statistic: every field the generator writes must be present; every
mean, response value and correlation must be a finite number; a correlation must
lie in [-1, 1] and a fraction in [0, 1]; a null statistic must state its reason
and a defined one must not carry one; an empirical range must be null exactly
when it has no defined correlation and otherwise ordered min ≤ median ≤ max; a
shared-gene count may not exceed the means or responses it is drawn from, nor a
direction count its own denominator; a reference must carry the sample range and
biological band of the layer it names; and every input pin must carry a
64-character lowercase SHA-256. The export omits exactly the layer `means` and
contrast `vector` fields, declares that omission with its regeneration command,
and copies every other metadata field, denominator, null, zero value,
limitation and caveat unchanged. Output is deterministic: sorted JSON keys, the
established column order, the same float repr and empty cells for nulls,
CSV-quoted cells, and LF line endings. The three destinations are preflighted
together — never inside `data/` or `site/`, never the input report or a pinned
input through a path, symlink or hard link, never two destinations naming one
file, never below a path component that already exists as something other than a
directory, never one destination inside another, and never an unresolvable path
such as a symlink loop — so a request rejected by validation or preflight leaves
existing files intact. Each output is replaced atomically; an unexpected I/O
failure after writing begins does not roll back outputs already replaced.

Path identity for those checks folds letter case and Unicode composition, because
case-insensitive volumes can treat such names as one file while a resolved path
keeps the spelling it was given and two destinations that do not exist yet cannot
be compared by inode. The deliberate consequence is that paths differing only in
case or Unicode form are refused on every filesystem, including case-sensitive
ones where they would be distinct; name destinations that differ by more than
case. A declared input is protected wherever it resolves — inside the repository
root or outside it, including through a symlink that leaves the root — and one
that cannot be resolved at all is named rather than skipped.

The export records its own path and checksum and the input report's exact bytes
and SHA-256 in an `export` block. It writes no `implementation` block: it did not
compute the statistics it carries, and the generator's report does not declare
its own identity. The preserved summary above carries that block from its
original generation, so when comparing an export of a regenerated report with
it, expect exactly two provenance differences — the export's `export` block and
the preserved summary's `implementation` block — and identical statistics.

The [original frozen summary](../notes/handoff/cyano_processed_expression_agreement_20261007.json)
preserves the earlier metadata snapshot and its original pins. Use the current
summary for condition interpretation. The corrections change seven layer
metadata records; every quantitative statistic and both table projections remain
identical. To reproduce the original snapshot, use an isolated checkout of
`6645de58a040973dfc5fec5e787cf11c2c006a4a` with the same pinned cache and numerical
library versions. The command above regenerates the current snapshot.

## Level and replicate statistics

Layer means use each admitted layer's exact sample columns and normalization,
with measurements required in every column. Pairwise level Spearman correlation
uses only genes measured on both sides, includes measured zeros, and records the
shared-gene denominator. Spearman uses average ranks for ties. Constant vectors
or fewer than three shared genes have a null result and an explicit reason.
The implementation uses SciPy's coefficient fields from
[spearmanr](https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.spearmanr.html)
and [pearsonr](https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.pearsonr.html);
their returned p-values are not part of this report.

Replicate correlations compare sample columns only within an explicit time and
condition stratum. The reported minimum, median and maximum are an empirical
range of these observed correlations, **not a confidence interval**. Time points
are never treated as replicates. Unknown biological/technical replication yields
descriptive sample correlations and no biological band; single-sample strata
have no replicate correlation. Pooled cultures or repeated fractions do not
supply independent biological replicates.

A time-course layer mean and its per-time-point replicate range summarize
different aggregations; their correlations may also use different shared-gene
sets. Reading them side by side is descriptive and does not create a calibrated
noise threshold. Two replicates yield one correlation per stratum, which gives
no estimate of a correlation sampling distribution.

## Control-relative response statistics

Each contrast explicitly names its own treatment and reference arm. Their
normalized arithmetic means are calculated separately; the response is
`log2(treatment mean / control mean)`. A gene must be measured in every arm
sample, and both means must be strictly positive. There is no pseudocount.
Report the measured intersection, positive-gene count and number excluded for
zero means. This is an unshrunk descriptive log ratio; it is not a differential
expression test or a shrunken effect estimate.
For numerical reproduction, preserve the specified `log2(treatment / control)`
formulation. Algebraically equivalent log subtraction can reorder near-tied
responses through floating-point rounding and slightly change their Spearman
coefficient; it does not change the biological interpretation.

Only the plan's explicit response pairs are compared. Spearman, Pearson and
response sign agreement use shared finite responses. Sign agreement excludes a
zero response on either side and records its own denominator. Sample size and
response magnitude still matter: a high correlation does not establish a
biological effect, specificity, matching controls or comparable culture
conditions. No p-values or inferential confidence intervals are claimed.

The plan keeps qualifications attached to each contrast and pair. In particular,
dusk/dawn and day-0 references confound time with treatment; engineered and
adapted backgrounds are distinct; the salt pair differs in dose and timing;
and GSE225426/GSE311172 do not declare biological versus technical replication.
GSE79726 nitrogen withdrawal uses the time-matched N-plus 48h arm rather than
the earlier 24h baseline. Light pulses use only sampled times also present in
the clear-day arm. Disputed population columns and unadmitted mutant arms are
excluded. GSE252562's disputed photoperiod stays conflicting in its source
record and does not acquire a resolved label from a correlation.

## Verification and extension

Tests cover numerical ties/degeneracy, missing and zero values, normalization
before mapping, exact sample scopes, time strata, replication status, control
arm integrity, pins and CLI failure behavior. For a new plan, check every
selected column against the pinned deposit, verify each biological stratum
against the source's replicate statement, and recompute representative means
and correlations independently before trusting the report.

Keep the frozen processed-source report separate from Package E's seven-table
pilot and from uniform raw reprocessing. It supplies additional descriptive
evidence; it cannot establish reproduction of an undelivered pilot program or
close the pilot's bootstrap and intake requirements.

## Browser presentation

`tools/promote_expression_agreement.py` projects the accepted current summary
into `site/data/expression_agreement.json`. This separate promotion step keeps
the scientific exporter's prohibition on writing to `site/` intact. It validates
the report and joins its layers to admitted `meta.expressionSources[].id` values,
never metric keys or approximate names. The payload retains report, metadata,
promotion-code and statistics-code identities, input pins and regeneration notes.
It omits per-gene vectors, while preserving correlations, source caveats, strata,
sample-pair denominators, exact response arms and contrast caveats.

```sh
.venv/bin/python tools/promote_expression_agreement.py
.venv/bin/python tools/build_data_manifest.py build
.venv/bin/python -m pytest -q tests/test_promote_expression_agreement.py
node --test tests/js/expression-agreement.test.mjs tests/js/data-sources-panel.test.mjs
```

The deterministic-promotion test compares the committed payload with a fresh
projection. A change to the report, metadata or promotion code requires rebuilding
the payload and manifest together. Promotion refuses output aliases of its report,
site metadata, pinned inputs and implementation files (including symlink, hard-link,
case and Unicode aliases), and rejects unusable output paths before writing.
Unknown source IDs, mismatched study identities
and malformed statistics are errors; a source absent from the report remains an
explicit coverage gap. The organism registry declares this optional companion for
UTEX only. The staged loader checks its published integrity and validates its
shape before exposing statistics; a failed load can be retried without closing
the Data Selection dialog, and no previous report remains visible on failure.

In Data Sources, **Processed-expression agreement** offers two source selectors
beside the condition comparison. Choosing comparison sources does not change the
selected measurement layers or their grouping. Source cards distinguish the
layer-mean gene count from the counts behind within-stratum sample correlations.
Evidence disclosures retain strain, units, normalization, sample identities and
their denominators. An empirical range is not a confidence interval, and unknown
replication never receives a biological-replicate band.

Layer-level Spearman is displayed with its shared-gene count. Response comparisons
are the report's explicitly recorded **study contrasts**, which need not describe
the two selected layer conditions. Each response disclosure names both studies,
treatment and reference samples, each contrast's caveat and the pair caveat.
Direction agreement retains its nonzero-response denominator separately from the
shared-response count. Missing comparisons and null results remain explicit;
correlations do not supply a comparability decision or pass mark. The report
disclosure also exposes the exact calculation and mapping methods, including
positive-arm filtering, no pseudocount and normalization before crosswalk mapping.
A single observed correlation does not estimate a sampling distribution.

At phone widths the data-selection dialog fills the viewport, gives the comparison
pane enough space for a complete standard source card and places Done after that
pane in both visual and keyboard order. Condition labels stack above their scales
on the smallest screens so the scale geometry stays intact.

Exports include agreement provenance only when the validated report is loaded
and the export contains a report-backed source. The manifest names those covered
source IDs and retains report/input/code identities and global limitations. This
provenance does not imply that an unavailable source or an arbitrary selected
pair has an agreement statistic.

For rendered regression, serve the repository root on an unused task-specific
port and open `/site/?uiArtifacts=/absolute/artifact/directory` in a uniquely named
`playwright-cli` session, then run:

```sh
playwright-cli -s=YOUR_SESSION run-code --filename=tools/ui/check_expression_agreement.js
```

The harness exercises known level/response evidence, exact arms and caveats,
unknown replication, missing comparisons, source gaps, loading, absent and
failed/retry states, keyboard dismissal/focus return and the responsive matrix.
Inspect its screenshots and supplement them with readable viewport captures of
open evidence disclosures. The ordinary repository and release gates still apply.

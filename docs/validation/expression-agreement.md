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

The frozen [statistics summary](../notes/handoff/cyano_processed_expression_agreement_20261007.json)
retains all metadata, denominators, correlations and caveats for 18 studies and
53 layers. Its [replicate ranges](../notes/handoff/cyano_processed_expression_agreement_20261007_replicates.tsv)
and [response comparisons](../notes/handoff/cyano_processed_expression_agreement_20261007_responses.tsv)
are also available as tables. The summary explicitly omits the per-gene `means`
and contrast `vector` fields; the command above regenerates those full vectors.
It records the implementation checksum and numerical-library versions as well
as the input pins. Never read an omitted vector as a missing measurement.

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

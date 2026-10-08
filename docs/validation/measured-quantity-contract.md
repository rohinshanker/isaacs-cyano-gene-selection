# The measured-quantity contract

A source's `dataType` names the experiment, not the number. One
differential-expression deposit publishes an abundance, a raw read count, a log2
fold change, a p-value and sometimes a translation-efficiency ratio, and every
one of them is "transcriptomics by RNA-seq". The site has one abundance column,
one low-traffic threshold and one pooling rule, so a deposit of this shape
cannot be admitted under `dataType` alone without some of its columns being
drawn, filtered and averaged as abundances.

A source may therefore declare the `quantity` its values are. That declaration
decides the published column, the admissible values, the sign convention, the
colour ramp, the metric family, the reader-facing label and whether several
selected deposits of it pool. **Nothing is inferred from the assay sentence.** A
regular expression over natural language is how a p-value becomes an abundance;
the contract exists so that cannot happen.

The contract is **opt-in**. A source that declares no `quantity` behaves exactly
as it did before — same column, same sign rule, same family — and every shipped
source is in that state today.

## The quantities

`scripts/expression_table.py` holds the table. `tools/validate_contract.py`
re-states it independently, so a pipeline that publishes the wrong meaning for a
column fails the gate even when its own tests agree with it;
`tests/test_expression_quantity_gate.py` holds the two statements together.

| `quantity` | Value column | Family | Ramp | Values | Pools |
| --- | --- | --- | --- | --- | --- |
| `rpkm` | `abundance` | Expression | sequential | finite, ≥ 0 | yes, as rank |
| `read_count` | `read_count` | Expression | sequential | finite, ≥ 0, whole | yes, as rank |
| `log2_fold_change` | `log2_fold_change` | Fold change | diverging | finite, either sign | no |
| `edger_log2_fold_change` | `log2_fold_change` | Fold change | diverging | finite, either sign | no |
| `p_value` | `p_value` | Significance | sequential | finite, in [0, 1] | no |
| `translation_efficiency_log2_fold_change` | `translation_efficiency_log2_fold_change` | Translation efficiency | diverging | finite, either sign | no |

Only `transcriptomics` on `RNA-seq` or `Ribo-seq` may declare these. Anything
else is refused rather than reinterpreted.

**The two fold changes share one column** because both really are log2 fold
changes; a reader downloading the table is told what the number is. Which
estimator produced it is the source's declaration, because edgeR's moderated
estimate and an unmoderated log ratio are two estimators of one contrast and
must not be averaged with each other.

## Why the family matters more than it looks

The low-traffic threshold, the measured-evidence orderings, the fresh-view
colour promotion and the "measured expression" wording all select on the metric
family, not on a metric's name. A signed ratio or a probability sitting in
`Expression` would be offered as a measure of how busy a gene is, and a reader
would filter genes out of the map by their p-value. `Fold change`,
`Significance` and `Translation efficiency` exist so those three stay out —
note that none of them contains the word "expression", because
`isExpressionMetric` matches on it.

They are still measurements. `hasDeclaredMeasurement` is what everything that
*reports a measurement's limits* asks, so a fold change still shows its
condition, coverage, citation and source link; it is simply not an abundance.

## Why these three never pool

A type metric pools several selected datasets when the reader has named none.
An abundance may: the deposits report different units, so each is ranked within
itself and the ranks averaged, which is scale-free (see
[log-scaled-layers.md](log-scaled-layers.md)).

A fold change, a p-value and a translation-efficiency ratio may not. Each is one
contrast evaluated by one method. Averaging two of them mixes contrasts, or
mixes two estimators of one contrast, and the number that comes out answers no
question anyone asked — worse, a mean of two p-values reads like stronger
evidence than either input.

Such a type therefore **reads one dataset however many are selected**: the
reader's named choice, else the first selected in manifest order, which is
deterministic. The interface says so rather than letting a reader believe they
are seeing several:

- the Data Sources selector offers **no pooled row** for the type, and prints a
  line saying one of the included datasets is read;
- the metric carries `pools: false` and a `selectionNote` naming the dataset
  actually read and the count selected, which its description repeats.

## Tiny p-values are published exactly

Generated JSON is rounded to six decimals for compactness. A published p-value
of 3e-18 rounds to zero there, turning the strongest evidence in a deposit into
an exact zero. A quantity marked `exact` in the contract — `p_value` today — is
exempt from that rounding wherever the walk meets its metric key, and
`expression_table.format_value` writes it at full round-trip precision when a
table is generated rather than at the four decimals every other column uses.

Both ends are tested on 1e-300, because a rounding bug here is silent: the
column still validates, still draws, and reports the opposite of the truth.

## The four places that enforce it

A declaration is only worth as much as the readers that honour it, and the
browser keeps its own validation, so a layer can be refused on the page while
every gate is green (that is how [log-scaled-layers.md](log-scaled-layers.md)
was found). All four were changed together:

1. `scripts/expression_table.py` — the contract, the headers, the value bounds,
   the cell formatting, and the facts the pipeline publishes.
2. `scripts/build_features.py` — refuses an unsupported quantity, a quantity its
   data type or platform does not publish, a manifest that contradicts the
   contract's `signed`/`logScale`, a mismatched header, and a value the quantity
   does not admit; stamps the resolved facts onto the published source entry and
   exempts an `exact` layer from rounding.
3. `tools/validate_contract.py` — independently re-derives every published fact,
   refuses two quantities that would collapse into one type metric, refuses a
   non-abundance filed as an abundance, and checks layer and gene columns
   against the quantity's bounds.
4. `site/js/core/type-metrics.js`, `metric-registry.js`, `dataset.js` and
   `ui/data-sources.js` — read the published declaration for the kind, label,
   family, ramp, pooling and value bounds. None of them parses an assay
   sentence for a source that declares a quantity.

## Adding a quantity

Add a row to `QUANTITIES` in `scripts/expression_table.py` and the matching row
to `EXPRESSION_QUANTITIES` in `tools/validate_contract.py`, decide its family
deliberately (an abundance or not), decide whether it pools, and extend
`QUANTITY_FACTS`/`QUANTITY_RULES` in `tests/js/data-sources-fixture.mjs`. The
parity test fails until the two Python statements agree, and
`tests/test_expression_table.py` fails until the kind is distinct from every
other quantity's on each platform — which is what stops a new quantity from
silently joining an existing metric.

## Gates

```sh
npm test
.venv/bin/python -m pytest -q
.venv/bin/python tools/validate_contract.py
```

Rendered checks for the source selector and the metric panel are required at
mobile, tablet and desktop widths whenever the selector's pooling rules change.
A synthetic data directory is the way to see them before a real source is
admitted: copy `site/data`, inject declared sources into
`meta.expressionSources` with their columns in `expression_layers.json`, drop
`data-manifest.json` so the loader asks for every file, and open the page with
`?data=<that directory>`.


Declared-quantity sources keep individual source/sample labels in Data Sources
and axis choices, even when many fields share one study and culture condition.
They do not enter the compound/dose compendium grid: different omics fields and
replicates are not distinct compound doses. RPKM/count types retain their
explicit pooling control; a non-pooling type names the source actually read.
The regression test uses the real sixteen-source Syn61 release, including its
three otherwise identically described RNA cultures.

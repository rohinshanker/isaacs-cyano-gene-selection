# Log-scaled expression layers, and how they pool

Some deposits publish abundance already log-transformed. The AG3C series is the
first in this repository: Caglar 2017's Methods state that *"All resulting data
sets were checked for quality, normalized, and log-transformed"*, over the 152
RNA and 105 protein samples this repository reads. Verified against the article
on 2026-10-07, not inferred from the values.

## What that means for a reader

A log-scaled value is not a count. Differences are multiplicative: a gap of 1
is roughly a doubling and a gap of 3 roughly eightfold, not three more of
something. About 30% of the AG3C transcript values are negative, which means an
abundance below one unit on the deposit's own scale. It does not mean missing,
and it does not mean below some baseline.

## Why it is not the `signed` flag

The repository already had a flag for values that may be negative, and reusing
it here would have been wrong. The two say different things and drive different
behaviour:

| Declaration | What it claims | Ramp | Pooling |
| --- | --- | --- | --- |
| `signed` | a quantity centred on zero, like a fitness log-ratio | diverging | mean of the values, which share one log2 scale |
| `logScale` | a one-sided abundance expressed in logs | sequential | mean of within-dataset rank, as any abundance |

Declaring AG3C `signed` would have drawn it on a red-to-blue ramp presenting
zero as a neutral midpoint, which it is not. A source declaring both is refused
by the build, because the two prescribe different pooling and the result would
depend on which rule won.

Three places enforce the distinction, and all three needed it: the pipeline
(`scripts/build_features.py`), the contract validator, and the browser loader
(`site/js/core/dataset.js`). The browser kept its own copy of the check, so the
layers were rejected on the page while every gate was green. Only the rendered
view showed it.

## Pooling a log-scaled deposit with a linear one is already exact

A type metric pools several datasets when the reader has named none. Under the
owner's rule of 2026-10-06, **an abundance pools as the mean of each dataset's
within-dataset mid-rank percentile**, a unitless 0 to 1, precisely because units
differ between deposits.

That statistic is invariant under any monotonic transform. A gene's rank inside
its own dataset is identical whether that dataset is logged or linear, so a
log-scaled deposit and an RPKM one may share a type with no rescaling of either.

This is the normalisation, and there is no second one to add. Rescaling the
values to a common linear scale would be worse: it would require assuming the
base of the logarithm and the normalisation each depositor applied, neither of
which is always stated, and it would convert an exact rank-preserving operation
into an inexact one resting on assumptions.

`tests/js/type-metrics.test.mjs` holds the invariance directly, checking that a
linear series and its own base-2 logarithm produce identical percentiles.

The one case where values are pooled by arithmetic mean is a signed fitness
screen, which works only because every fitness deposit shares one log2 ratio
scale. Nothing log-scaled may enter that pool, which is what the build's refusal
of a source declaring both flags prevents.

## What a reader is told

The pooled value is reported as a percentile, not an abundance, and the legend
names the rule: "pooled percentile across N datasets: mean of each dataset's
within-dataset mid-rank, 0 to 1". A single dataset's own value keeps its
deposited units and its own caveat.

# Metric convention parity between the pipeline and the browser

The pipeline writes CAI, tAI, ENC, GC3 and codon-pair score into `genes.json`. The
site recomputes the same five metrics in the browser, because a recoded value is
only meaningful against a wild-type value computed the same way. Those are two
computations of one quantity and they must agree.

When they do not, nothing crashes. The maps and the deltas are drawn from the
browser's numbers while the filters, the colour scales and the gene panel's
Translation section show the pipeline's, so one gene displays two different values
for one metric and the controls stop describing the picture.

## Symptoms

- A gene's metric appears twice on the page with different values. The wild-type
  column of "Wild type against recoded" is the browser's; the Translation section
  is the pipeline's.
- `node tools/check_live_metrics.mjs` fails one of its `browser and pipeline agree
  on <metric>` assertions.
- The page shows the red "These numbers disagree with the published dataset"
  banner above the map.

## The conventions that must match

`genes.json` publishes six decimals, so rounding alone cannot exceed 5e-7. The
tolerance is 1e-6. Anything larger is a convention the two sides do not share.

**The initiator.** Every bacterial start translates as methionine whatever the
triplet is: 2,244 genes start ATG, 356 GTG, 103 TTG, 12 something else. CAI, tAI,
ENC and codon-pair score therefore count position zero as methionine, exactly as
`feature_metrics.translated_codons` does. GC3 and the other composition metrics use
the literal triplet. Getting this backwards moves CAI by up to 1e-2 and ENC by up
to 24 units, concentrated in short genes where one codon is a large share.

**tAI weights.** Build absolute adaptiveness from the anticodon strings
`meta.tai.tRNAGeneCopies` publishes. Never derive an anticodon by reverse
complementing a codon: a modified wobble base is not a DNA base. The inosine
arginine tRNA is published as `ICG` and the lysidine isoleucine tRNA as `LAT`, and
those two species decode all four CGN codons and ATA. Reverse complementing looks
for `ACG` and `TAT`, finds nothing, and silently drops five codons to the
zero-weight substitution, which also inflates the substitution itself.
`meta.tai.sValues` keys constraints as `anticodonWobbleBase:codonThirdBase` using
the same letters, so `I` and `L` need no special case.

**tAI exclusions.** Exclude the amino acids in `meta.tai.excludedAminoAcids`
(currently methionine) from the geometric mean. Zero-weight codons are included at
the substituted weight, not skipped.

**ENC families.** A synonymous family observed fewer than twice has no unbiased
homozygosity estimate and is omitted from its degeneracy class's mean, never
assumed maximally biased. A class with no estimable family uses F = 1/k. Each F is
floored at 1/k. This is `meta.encFamilyConvention`, and `encHasSubstitutedFamilies`
is published per gene so the browser can confirm it read the same families.

**CAI weights.** Sharp and Li relative adaptiveness over the reference set, with
`meta.caiReferenceSet.zeroCountAdjustment` standing in for an absent codon. A
family absent from the reference set entirely normalizes to weight 1 throughout:
no evidence means no penalty, not exclusion. Non-degenerate amino acids are
excluded from the gene's geometric mean rather than given weight zero.

**Codon-pair score.** Expected count is the amino-acid pair count scaled by each
codon's share of its own amino acid's usage, with the same additive smoothing of
0.5 on both sides of the ratio.

## Where this lives

`site/js/core/conventions.js` resolves every convention from `meta.json` and
records which ones the data published and which are assumed. The About card renders
that split, so a convention resting on an assumption is visible rather than
implied. `site/js/core/codon-metrics.js` holds the metric functions and takes the
resolved conventions as arguments; it hardcodes no convention of its own.

Adding a convention to `meta.json` should need no JavaScript edit. Read it in
`resolveConventions` and pass it through.

## Regression checks

Run all three. The first is the one that fails loudly on real data.

```bash
node tools/check_live_metrics.mjs          # real genome, asserts agreement to 1e-6
node tests/fixtures/make_fixture.mjs       # regenerate synthetic data
node --test "tests/js/*.test.mjs"
```

The fixture generator is part of this contract: it computes its metrics under the
same conventions and publishes them in its own `meta.json`, including the modified
anticodons `ICG` and `LAT`. A fixture without those would not exercise the codons
most easily left unweighted.

The browser's own check runs at load. `dataset.provenance.agreement` carries a
verdict per metric rather than a bare magnitude, and the tAI report states whether
the recomputed zero-weight substitution and codon set reproduce the published ones.
Report a difference as a failure, never as agreement to within some number.

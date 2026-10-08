# What the comparability pilot supports, and with what uncertainty

The pilot returned by Claude Science package E on 2026-10-05 is the evidence
behind treating two datasets as comparable. It reported AUROCs with no
uncertainty and shipped no code, so this records what survives independent
rebuilding and how precise each number actually is.

## Reproduced, not trusted

The pilot names an archive `pilot_code.tar.gz` that was never delivered, so its
figures could not be regenerated from its own scripts. Every published pooled
AUROC was instead recomputed here from the returned pairs file by
`tools/pilot_bootstrap.py`. **All fifteen reproduce, worst difference 0.00007.**
The pairs file is pinned by SHA-256 and the tool refuses to run against a
different one.

One detail is worth stating because getting it wrong is silent: `spearman` is a
similarity, so a replicate pair scores high, while `ks_d` and `wasserstein` are
distances, so a replicate pair scores low and the AUROC is taken the other way
round. Reading all three forwards reproduces every distance row as exactly one
minus its published value, which looks like a reproduction failure and is not.

## The intervals, and why they resample samples

The 10,440 pairs are built from 145 samples, so one sample appears in many
pairs. A bootstrap over pairs would count the same culture as fresh evidence
dozens of times and report an interval several times too narrow. The intervals
below resample the **samples**, which are the independent unit, carrying each
pair at the multiplicity of its two endpoints. 2,000 resamples, percentile
interval, seed fixed.

| Comparison | AUROC | 95% interval | Samples behind it |
| --- | ---: | --- | --- |
| replicate against every within-study pair | 0.932 | 0.883 to 0.964 | 120 and 144 |
| replicate against time-only pairs | 0.899 | 0.840 to 0.947 | 120 and 116 |
| replicate against genotype or treatment pairs | 0.943 | 0.892 to 0.973 | 120 and 144 |
| replicate against every cross-study pair | 0.996 | 0.972 to 1.000 | 120 and 145 |
| similar controls against other cross-study pairs | 0.462 | 0.247 to 0.681 | 40 and 145 |

The full table, including the two distance statistics, is
`docs/notes/handoff/cyano_comparability_pilot_intervals_20261007.tsv`.

## What this supports

**Replicates separate from other pairs within a study, reliably.** The interval
floor is 0.88 against all within-study pairs and 0.84 against the hardest
comparison. This is the pilot's load-bearing claim and it holds.

**Replicates separate from cross-study pairs almost perfectly**, 0.996 with a
floor of 0.97. Two samples from different studies do not look like replicates.

**The statistics cannot be ranked against each other at this precision.** The
intervals for 0.899, 0.932 and 0.943 overlap heavily. The ticket that
commissioned this asked whether a reader can tell 0.94 from 0.90: they cannot.
Differences below roughly four points are not supported by this evidence, so no
threshold should be tuned to a third decimal.

## What this does not support

**The similar-controls result is indistinguishable from chance.** Its interval,
0.247 to 0.681, comfortably spans 0.5. The pilot reported 0.462 and read it as
cross-study similarity failing to recover matched controls, which may well be
true, but this evidence cannot separate that from a moderate effect in either
direction. It rests on 275 pairs drawn from 40 samples. Treat it as untested
rather than as a negative result.

**The cross-study fold-change agreement rests on two contrast pairs** from the
same two studies, and the pilot itself marks it provisional. Nothing here
changes that; it needs more matched perturbations, not a better interval.

## Carried gaps

Three gaps the pilot left are not closed by this work and are not closable from
the returned evidence alone: `pilot_code.tar.gz` is still undelivered, so the
reproduction above is of the numbers rather than of the method; GSE45762 was
dropped for self-contradicting labels and needs its submitter; and 15 of 44
method sources were read from abstracts only. Each has its own route recorded in
the tickets that remain open.

## The audit's unread files, read here

The data-use audit of 2026-10-03 covered 49 of 84 file chunks with a full
model-assisted read. It states plainly what it did instead for the other 35,
which include `app.js`, `filters.js`, `compare.js`, `panel-designer.js` and
chunk 0 of `chromosome-view.js`: targeted pattern sweeps for named hazards, and
that *"a prose defect in them that matches none of those patterns would not have
been caught"*.

That residue was read here on 2026-10-07, for the one class a pattern sweep
cannot reach: user-facing prose that claims something about a value which the
value does not support. **No defect was found**, and the reason is structural
rather than lucky. None of those five files hard-codes a quantity word. Every
label naming what a number is comes from the metric registry, so a file cannot
contradict a data type it never names. The wording that is hard-coded describes
drawing rather than measurement, and the claims it does make are accurate: the
measured-expression filter really does select on the recorded basis and states
its two counts; the radar and line charts really do draw a missing value as a
break rather than at the median; the panel designer really does say it is a
design rather than a prediction.

This closes the gap in the direction of a read that found nothing, which is not
the same as the gap being left alone. A full semantic read of those files for
every other defect class remains undone and is not claimed.

## The mockup render, kept for whoever builds the real panel

The package E mockup was never rendered by the session that produced it. It was
rendered here on 2026-10-05 at 1440, 768 and 375 px. It loads with no script
error, the three data-type tabs and the group checkboxes work, and ticking
condition sets fills the compare pane.

Three defects were seen at 375 px, and they are reproduction notes for the real
Data Selection panel rather than fixes to make in a mockup:

1. the condition strip is clipped inside its pane after the light column;
2. the spectrum code overlaps the light-regime bar;
3. the phase chips truncate.

These were taken up on 2026-10-07 as UI-MOBILE-1, 2 and 3 by the UI close-out
session. This record exists so the original observation survives the ticket that
held it.

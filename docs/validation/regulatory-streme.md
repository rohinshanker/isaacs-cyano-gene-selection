# Native Tan gTSS STREME pilot

`tools/regulatory_streme.py` produces an exploratory, non-release upstream-window
cohort and a bounded motif-discovery/evaluation bundle. It writes no browser data.
A motif or ranking is not a measured regulatory site, calibrated probability,
biological accuracy, or evidence that a promoter is absent.

## Inputs and runtime

Require the admitted Tan Table S1 extract with exactly 2,475 gTSS anchors,
`data/expression/tan2018_utex2973_tss_table_s1.tsv`, SHA-256
`d06524cf492aa8f009bf004c596a5d305ac54acbe7537ec98bbc7992ce164bff`.
Its [provenance](../../data/expression/TAN2018_TSS_PROVENANCE.md) retains the source
workbook and historical locus identifiers. No current-CDS join is implied here.
Require native assembly `GCF_000817325.1`, compressed FASTA SHA-256
`22a2b07881c1099c32454778de0e90b1c40f74f44c0f59e000507106c0deb567`,
with circular replicons `NZ_CP006471.1` (2,690,418 nt), `NZ_CP006472.1`
(46,366 nt), and `NZ_CP006473.1` (7,842 nt). Source names such as `CP006471`
map explicitly to those versioned accessions after the entire FASTA identity
is checked. Anchors with no gTSS evidence on a replicon are not invented.

The runtime is MEME Suite 5.5.9, binary SHA-256
`ae3939a2230f9a03654339b661656033eb6aad5a047700f332203cd3e67c2bd8`,
[official source archive](https://meme-suite.org/meme/meme-software/5.5.9/meme-5.5.9.tar.gz)
SHA-256 `0406fb7b1dc27f6aab3d6d3a29ecdf617bbdd946690cfa97ca2129bc210bfd12`.
The [existing build recipe](regulatory-methods.md#local-streme-build) applies;
the producer checks the exact approved binary, archive and version. Another build
needs an explicit reviewed pin update, not merely a recorded arbitrary digest.
Existing source terms remain in `COPYING`; this producer does not decide permission.

## Coordinate and split contracts

Each default 100-nt window is `[-100,-1]` relative to the published one-based TSS;
the TSS base is excluded. On `+`, genomic bases are `p-100..p-1`. On `-`, bases
are `p+1..p+100`, reverse-complemented. Modular indexing across circular origins
retains one-based inclusive physical segments, a wrap flag, and the native first
and last bases in transcription order. FASTA sequences and `cohort.json` round-trip
to this convention. These are upstream anchor windows, not experimentally
established promoter boundaries or necessarily intergenic intervals.

Before partitioning, union all anchors sharing a source locus on a replicon,
any physical window overlap on either strand (including origin segments), any
exact 30-nt tract in either orientation, or at least 80% full-window ungapped
identity in either orientation. The latter compares every equal-length pair,
using exact two-bit Hamming distance. Union is transitive. Identical and reverse
complement windows are blocked even when shorter than the tract threshold.
Divergent, gapped, or shifted homology without a shared 30-mer can remain; these
rules are a defined similarity screen, not an exhaustive homology analysis.

A group's ID hashes its sorted anchor IDs. SHA-256 of `seed:group-id` assigns
one fifth of groups to external evaluation (`digest mod 5 == 0`), the rest to
discovery. In digest order, select whole groups while respecting independent
caps (default 400 discovery, 200 evaluation windows); skip a group that exceeds
remaining capacity. Preserve all 2,475 rows with group, assigned partition and
selection status. Thus caps can omit blocks and the selected fraction need not
be 80/20. Fewer than five selected windows in either cohort fails explicitly.
This deterministic convenience sample is not a population prevalence estimate.

## Controls, discovery and external evaluation

Only `discovery.fasta` enters native STREME. With `--dna --order 2` and no `--n`,
STREME creates its own per-sequence shuffled negatives and estimates its order-2
Markov background. Search one motif of width 6–15, seed 2973, internal holdout
0.2. The repeat must have identical parsed PWMs. Raw reports and stderr are
retained; command time is bounded by a subprocess timeout. A valid report with
no motif remains an explicit empty outcome.

The [author's documentation](https://meme-suite.org/meme/doc/streme.html) says
order-2 shuffling preserves 3-mer frequencies, and final PWM frequencies include
STREME's internal holdout. Consequently that internal holdout is not the external
evaluation. Neither external positive windows nor their controls are passed to
STREME, including for background estimation or parameter selection.

For external negatives and a separate null discovery run, a seeded randomized
Euler trail through the window's 2-mer graph preserves length, all linear
1/2/3-mer counts, and first/last two bases exactly. Preservation is asserted for
every output. Record how many controls actually change; repetitive windows can
remain unchanged. Seeds derive from SHA-256 of the run seed and anchor ID, with
a separate `null:` namespace. Python/runtime versions are recorded. Pair IDs
identify the source window, not genomic coordinates of a shuffled sequence.
The null-trained motif is evaluated against the same external positive/control
pair cohort; this is one descriptive null check, not a null-distribution estimate.

External evaluation uses an explicit offline scorer, with no FIMO dependency:
for each motif, smooth each PWM probability as `(p + 1e-6)/(1 + 4e-6)`, take
`log2(p/background-base-frequency)`, and sum over each possible alignment on both
strands. Background frequencies use only discovery windows, with +1 count per
base. Keep the maximum per window; ties retain the first forward alignment.
`offset0` is the leftmost zero-based index in the forward transcription-oriented
window; hit `strand` is relative to that window, not the native genomic strand.
No native genomic motif-site layer is emitted. Report every score, mean positive
and control scores, and AUC = the fraction of positive/control pairs correctly
ordered, with half credit for ties. Both scores and AUC are exploratory window
rankings. This independent-column scorer differs from STREME's order-2 Markov
scorer. Multiple windows in a block are correlated; no confidence interval,
calibrated p-value, specificity, sensitivity, or biological false-positive rate
is inferred from this AUC. In particular, a gTSS-vs-shuffle AUC can reflect a
genome-wide repeat rather than a TSS-associated motif; it cannot establish
promoter or TSS specificity.


## Blocked genomic background arm

Schema 2 adds three bounded native genomic samples, each with the same number,
width and exact replicon/strand quotas as the selected external gTSS cohort.
All 2,475 admitted windows, including unselected discovery/evaluation rows, are
expanded by a declared 150-nt margin on both sides of each physical segment.
Circular expansions wrap and merge; retained exclusion segments and excluded
base totals make the sampling mask reproducible. A candidate touching this mask
is rejected. The margin means at least 150 intervening native bases separate a
selected background window from an admitted gTSS window.

For each replicate, a deterministic seed is SHA-256 of `genomic:seed:replicate`.
Iterate evaluation IDs in sorted order and draw a uniform circular physical start
on that row's replicon. Match its strand and width. Select without looking at a
PWM score or exact word count. Reject any overlap with an earlier selected
background window, within or across replicates. Each slot allows at most 1,000
attempts; inability to fill a quota fails explicitly instead of silently changing
the denominator. Thus the samples are disjoint sequential draws, not independent
replicates or biological replicates. No genomic input is passed to STREME or used
to estimate the scoring background, tune a threshold, or select a motif.

`genomic-cohort.json` records every candidate's slot, matched evaluation ID,
attempt, replicon, orientation, physical start, segments and selection/rejection
reason. Selected rows retain candidate indices, sequence, native coordinates and
an explicitly **synthetic window anchor**, not a claimed TSS. All three native
background FASTAs and their per-window order-2 shuffled controls are retained.
Shuffle seeds use the separate `genomic-shuffle:seed:window-id` namespace.

`genomicEvaluation` reports two comparisons separately for each replicate:
`gtssVsGenomic` uses the held-out gTSS windows as positives and native genomic
samples as the comparison population; `genomicVsShuffle` compares those genomic
samples with their own length/composition-matched shuffles. Both retain every
score and the same descriptive AUC/mean-score conventions as the original arm.
The latter is a diagnostic for genome-wide sequence structure, not evidence of
TSS specificity. The former compares these particular sampled populations;
unmatched composition, undetected transcription starts, unassayed conditions,
and correlated gTSS windows prevent biological specificity claims. Genomic windows
outside admitted gTSS neighbourhoods are not validated biological negatives.

`coreFrequency` records exact `GCGATCGC` occurrence counts on each entire native
circular replicon, per million bases, and the fraction/count of windows containing
it in all gTSS, discovery, evaluation, shuffle and genomic cohorts. Counts include
both orientations but count palindromes once. Window counts use linear starts;
genome counts include origin-spanning starts and overlapping matches.
Counting every start differs from non-overlapping string-count conventions;
record that convention before comparing counts. This word is part of the recovered
native motif; its occurrence is an exact sequence statistic and implies no
function. Pair it with genomic comparisons when interpreting the shuffled AUC.

## Planted benchmark and S1

Require the original 100-sequence, 100-nt random-DNA fixture with `ACGTCGAT`
planted in the foreground, plus its independent random control FASTA. Both small synthetic inputs ship in
`tests/fixtures/regulatory-streme/`; no ignored historical checkout is required
for their bytes. Foreground
SHA-256 `1bb39334d8eedc911948d82ef58547bd327c2d75893b233518604ee6babfc592`;
control SHA-256 `723a2cca1d3c7b96bedff0190a3a06c071a47b2ffd659f38b5d8865165bd1863`.
Use `--w 8 --nmotifs 1 --hofract 0.2 --order 2 --seed 2973 --text` with explicit
`--n`. Those historical random negatives are equal length and distribution,
not exact per-window composition matches. Native controls use the stronger
preservation contract above.

Compare every discovered PWM to the planted pattern in both orientations and
all overlapping offsets. Choose greatest matching-consensus coverage, breaking
ties by expected planted-base PWM probability and overlap length. Normalize
consensus matches and expected planted-base probability by the entire planted
length: missing columns contribute zero. Record offset, orientation, overlap,
coverage, consensus recovery, probability recovery and exact-full-consensus status.
This metric is a descriptive alignment, not a statistical similarity test.
The historical `CGTCGATC` consensus is shifted +1; it recovers seven of eight
plant positions (87.5%), with one planted base missing and one extraneous flank.
It must not be described as exact motif recovery.

A separate synthetic evaluation set uses seed `seed+1`, 100 fresh 100-nt random
sequences with a plant at offset 45, alternating strand, and 100 fresh independent
random controls. Evaluate discovery PWMs without retraining; record best-site
plant overlap, mean overlap nt and alignment/strand consistency against the
chosen PWM-to-plant alignment. The ranking AUC and localization counts measure
this artificial benchmark only. They establish neither full boundary recovery
nor native-UTEX promoter accuracy. Tan anchors lack validated negative loci and
experimentally delineated promoter extents; those scientific limits remain.

## Execute and verify

Use an existing project interpreter without installing into shared environments.
Set `NATIVE` to the canonical repository and `STREME_ROOT` to the retained ignored
`regulatory-methods-20261012/streme` directory containing the approved build and
archive. The pinned synthetic fixtures ship with this repository. From the assigned worktree:

```sh
"$NATIVE/.venv/bin/python" tools/regulatory_streme.py \
  --fasta "$NATIVE/data/raw/GCF_000817325.1_ASM81732v1_genomic.fna.gz" \
  --tss data/expression/tan2018_utex2973_tss_table_s1.tsv \
  --binary "$STREME_ROOT/meme-5.5.9/src/streme" \
  --source-archive "$STREME_ROOT/meme-5.5.9.tar.gz" \
  --benchmark-foreground tests/fixtures/regulatory-streme/foreground.fasta \
  --benchmark-control tests/fixtures/regulatory-streme/background.fasta \
  --output /tmp/cyano-regulatory-completion-20261014/streme/fresh-run

STREME_REAL_ROOT="$STREME_ROOT" STREME_NATIVE_ROOT="$NATIVE" \
  "$NATIVE/.venv/bin/python" -m pytest -q \
  tests/test_regulatory_streme.py tests/test_regulatory_transterm.py
```

The opt-in real test runs all pins, a 100-discovery/50-evaluation native pilot,
repeat, null run, three matched genomic samples and the historical planted benchmark. Unit tests cover both
strands, origin windows, union/split integrity, 80% similarity without exact
30-mers, shuffle invariants, parser rejection, hand-computed scores, shifted
and reverse motif recovery, execution failures, partial writes, interruption,
publication races, absent parents, original exception identity, cleanup denial,
real subprocess SIGINT status and OS file-size-limit write failure. Full repository gates remain with the
coordinator integrating this bounded slice.

The output parent must already exist; the producer never creates ancestors.
Inputs and the producer are hash-recorded in `result.json`; `manifest.json`
records every cohort, report and result digest. Executed argv retains the actual
staging paths for provenance; use the recipe and retained cohort FASTAs to replay.
Raw reports can contain paths and runtime fields, so deterministic recovery means
identical PWM content, not identical whole-report bytes. Output must be fresh;
existing paths, including dangling symlinks, are rejected. Work occurs in a private
staging directory, then an exclusive output-directory reservation. Any failure
or interruption removes only this invocation's staging and reserved output,
including partially written files. Cleanup denial adds a note naming retained paths and
re-raises the original exception object, preserving its type and interruption
status. CLI errors include the exception class and every cleanup note; an
interrupt remains `KeyboardInterrupt` and retains SIGINT termination status
(shell status 130). Input artifacts and another invocation's output
are never removed.

Source receipts should retain retrieval date, short quote, location, mechanical
text match and SHA-256. The version-pinned archive's `doc/streme.html` and extracted
copy match the retrieved documentation bytes (SHA-256
`0c6304ce737ff25d914443290e22bec860d08c5e5ed3848dedf7bc5cbf1415a7`);
`COPYING` has SHA-256
`ecf04a70ce5a5f5232d5e279af6f85ffca10d61b35d158ffb68b627c98bba373`.
These establish source/runtime provenance, not biological calibration or admission.

# ViennaRNA local accessibility for explicit native UTEX windows

`tools/regulatory_accessibility.py` computes ViennaRNA 2.7.2 local
unpaired-segment probabilities for native UTEX 2973 windows that the caller
lists explicitly. `tests/test_regulatory_accessibility.py` pins its behaviour.
The indexing basis is in
[regulatory-methods.md](regulatory-methods.md#local-accessibility-indexing).

This is a **non-release producer**. It admits no annotation source, publishes no
browser marker, and changes none of the selected-method boundaries.

## What a value is, and is not

- **A model probability.** Each value is ViennaRNA's probability that an
  oriented RNA segment of length `u` is unpaired, averaged over local folding
  windows (V1), under the stated model and parameters.
- **Not measured accessibility.** It is not a probing measurement, a binding
  event, an interaction, or a probability of regulatory function. The report
  says so in `interpretation`, and `recordOrigin` is `computed`.
- **Not a site call.** No threshold, peak or candidate interval is derived.
  Combine with independent family, TSS or terminator evidence before any use.
- **Parameter dependent.** Folding window, span and temperature move the values,
  and can reverse a native-versus-shuffle comparison (see the regression oracle).

## Pinned identity contract

`PINNED` holds these values; `run` and `main` cannot be given others. Synthetic
fixtures run through the private `_run` with pins computed from the fixture.

| What | Pinned value | Check |
| --- | --- | --- |
| Genome FASTA | `GCF_000817325.1_ASM81732v1_genomic.fna.gz`, compressed, as NCBI serves it | SHA-256 `22a2b07881c1099c32454778de0e90b1c40f74f44c0f59e000507106c0deb567` |
| Replicons, in order | `NZ_CP006471.1` 2,690,418; `NZ_CP006472.1` 46,366; `NZ_CP006473.1` 7,842; all circular | parsed FASTA identifiers and lengths; topology from the flat file per [regulatory-rfam.md](regulatory-rfam.md) |
| ViennaRNA | Python module `RNA.__version__` | exactly `2.7.2`; the compiled extension's SHA-256 is recorded, not pinned |
| Default model | 37 °C, dangles 2, GU and lonely pairs allowed, special hairpins, no G-quadruplexes, linear, minimum loop 3, salt 1.021 M, `betaScale` 1 | every field in `DEFAULT_MODEL` equals `RNA.md()` before the run |
| Energy parameters | Turner 2004 default set | MFE fingerprint `GGGAAAUCCCGCGCAAGCGUUCGAAAGAACGCGG` → `(((....)))......((((((....))))))..`, −13.60 kcal/mol |

A mismatch refuses the run before anything is written. The decompressed FASTA
is refused because the pin is the compressed file.

## Inputs

The window table is tab-separated with exactly this header:

```text
window_id	replicon	start	end	strand	anchor	context
```

- `start`/`end` are one-based inclusive native coordinates. `start > end` means
  the window crosses position 1 of a circular replicon; on a linear replicon it
  is refused.
- `strand` is `+` or `-`. A minus window is folded as the reverse complement.
- `anchor` is optional. When present it must lie inside the window, and the
  report gives its oriented index, which checks TSS-anchored windows mechanically.
- `context` is free text recorded unchanged. The tool does not interpret it.

Refused: a wrong header or column count, duplicate IDs or intervals, IDs outside
`[A-Za-z0-9][A-Za-z0-9_.:+-]*`, unknown replicons, non-decimal coordinates,
coordinates outside the replicon, windows as long as the replicon or longer than
10,000 nt, and more than 1,000 windows.

Parameters are required: `--segment-length u`, `--folding-window W`,
`--max-bp-span L` and `--temperature T`. ViennaRNA silently shrinks a window
larger than the sequence and a span larger than the window (V6, V7). The tool
therefore refuses `W` above any window's length and `L` above `W`. It also
refuses `u < 1`, `u > W`, `W < 5` or `L < 5` (no pair can form below
`min_loop_size + 2`). `T` must be finite and within 0–100 °C; that range is this
tool's guard, not a ViennaRNA limit. After construction, the effective window,
span and temperature are read back from the fold compound and must equal the
request.

Temperature uses `fold_compound.probs_window()` with an explicit model, because
the simplified `pfl_fold_up` wrapper takes no model (V2 documents the RNAplfold
`-T` option). At 37 °C the two agree exactly; a test asserts that.

## Coordinates, padding and undefined values

ViennaRNA reports one row per segment **end** (V3). For an oriented window of
length `n`, the segment ending at `e` covers oriented `[e-u+1, e]`.

- Plus strand: native `= start + oriented - 1`.
- Minus strand: native `= start + n - oriented`; each segment is reported as its
  native low and high ends.
- Positions reduce modulo the replicon length, so a segment crossing the origin
  is reported with `native_start > native_end` and `wraps_origin` true.

The engine passes only lengths `1..min(u, e)` for end `e` (V4). Ends `e < u`
are therefore **padding**: the Python callback leaves them `None`, while
`pfl_fold_up` fills them with zeros that look like measurements. The tool never
reports padding and counts it as `paddingEnds`. A short-molecule branch (V5)
reports longer lengths than exist at the first positions; the parameter checks
keep every sequence out of it, and a callback that differs from `min(u, e)` is
refused.

A run is refused, not repaired, when the engine reports failure, an end is
missing or duplicated, the callback shape differs, padding carries a value, or a
defined value is absent, non-finite, not a float, or outside `[0, 1]` beyond a
`1e-9` rounding tolerance.

`interior` marks segments for which every `W`-length folding window containing
them fits inside the extracted window: `e >= W` and `e - u + 1 <= n - W + 1`.
Other segments are averaged over fewer windows and lack flanking genomic
context. A window shorter than `2W - u` has no interior segment.

## Control

Each window gets `--shuffle-replicates` mononucleotide shuffles of its oriented
sequence (SHA-256-indexed Fisher–Yates, key `seed:replicate:window_id`). Shuffles
preserve length and base composition only, not dinucleotide stacking.
`comparison` reports the native interior mean, the shuffle mean and how many
shuffles reach the native value. That count is a rank, not a calibrated p-value,
and a shuffle is not a biological negative. Shuffle positions have no native
coordinates and do not enter the TSV.

## Outputs

- **TSV**: one row per defined native segment, with oriented and native
  coordinates, `interior` and the probability as Python `repr`.
- **JSON**: identities, parameters, runtime, per-window summaries, shuffles and
  the TSV SHA-256 and row count. No timestamp and no directory path appear.

All folding finishes in memory before writing. Both paths must be distinct after
case-folding, must not be an input, must not exist (not even as a dangling
symlink), and must have an existing parent directory. Each file is created
exclusively. Any failure or interrupt removes only the files this run created.
Cleanup failures are attached to the original error.

## Reproducing the pilot

```sh
RAW=/path/to/verified/data/raw     # holds the pinned FASTA
OUT=.playwright-cli/regulatory-accessibility   # ignored scratch
mkdir -p "$OUT/baseline"
git check-ignore -v "$OUT/x"       # must print a .gitignore rule
.venv/bin/python tools/regulatory_accessibility.py \
  --fasta "$RAW/GCF_000817325.1_ASM81732v1_genomic.fna.gz" \
  --windows "$OUT/windows.tsv" \
  --segment-length 10 --folding-window 150 --max-bp-span 100 --temperature 37 \
  --shuffle-replicates 20 --shuffle-seed 2973 \
  --json-out "$OUT/baseline/accessibility.json" \
  --tsv-out "$OUT/baseline/accessibility.tsv"
```

Sensitivity runs change only one setting each: `W 100 / L 70`, `W 200 / L 150`,
`T 33` and `T 45` (33 °C and 45 °C are the Tan control and heat-stress growth
temperatures; the model temperature is not a cellular one).

The pilot `windows.tsv` (contexts shortened here; any text is accepted):

```text
window_id	replicon	start	end	strand	anchor	context
rf01116-yfr1	NZ_CP006471.1	1364566	1364928	+	1364716	RF01116 hit 1364716-1364778(+) with 150-nt flanks
tss-gTSS+1138200	NZ_CP006471.1	1138000	1138400	+	1138200	Tan gTSS+1138200, oriented -200..+200
tss-gTSS+2054473	NZ_CP006471.1	2054273	2054673	+	2054473	Tan gTSS+2054473, oriented -200..+200
tss-gTSS-34832	NZ_CP006471.1	34632	35032	-	34832	Tan gTSS-34832, oriented -200..+200
tss-gTSS-1491583	NZ_CP006471.1	1491383	1491783	-	1491583	Tan gTSS-1491583, oriented -200..+200
origin-minus	NZ_CP006471.1	2690219	200	-	1	origin-crossing coordinate check only
```

- The RF01116 interval is the [Rfam pilot's](regulatory-rfam.md) single native
  hit. Its 150-nt flanks keep the hit within interior segments at `W 150`.
- The TSS windows are the two chromosome gTSS rows per strand with the highest
  summed control counts in `data/expression/tan2018_utex2973_tss_table_s1.tsv`
  (SHA-256 `d06524cf492aa8f009bf004c596a5d305ac54acbe7537ec98bbc7992ce164bff`).
  That table names the chromosome `CP006471`; the assembly report maps
  `CP006471.1` to `NZ_CP006471.1` with relationship `=` (V8). Each anchor must
  report oriented index 201.
- The origin window is a coordinate check, not a biological context.

## Regression oracle

On the runtime with extension SHA-256
`ab26afb9f8c8e91bdfbb2e709f0d057a0c719182623be3b24fb591f5e87959f4`, the baseline
writes 2,313 TSV rows, SHA-256
`d1e471381406e31da4c56061f36f29f774626d4ae1c7cbfdecbdb668915d1690`. A repeat run
produces byte-identical JSON and TSV. Anchor indices are 151 (RF01116), 201 (each
TSS) and 200 (origin). An independent extraction from the FASTA matched every
row's segment, and every probability equalled `pfl_fold_up(seq, 10, 150, 100)`.
Nine rows cross the origin.

Interior means relative to 20 shuffles changed with the folding window. At
`W 150`, `tss-gTSS-34832` exceeded 18 of 20 shuffles (native 0.077, shuffle mean
0.032). At `W 200`, only 12 interior segments remained and the native mean fell
to 0.002, below 14 of 20 shuffles. The RF01116 window has no interior segment at
`W 200`. Treat any single-setting comparison as unstable until it holds across
the sensitivity runs.

## Tests and limits

`tests/test_regulatory_accessibility.py` executes every statement of the tool;
a subprocess test runs the `__main__` guard. A `sys.settrace` line tracer
measured this; `coverage` is not installed in `.venv`. Real-engine tests cover:

- the all-A oracle, with padding as `None` against `pfl_fold_up` zeros;
- exact agreement with `pfl_fold_up` at 37 °C;
- a real temperature effect, with process defaults left unchanged.

A fake engine covers each callback, failure and clamping refusal. Fixture tests
cover:

- plus, minus and origin-crossing round trips for every oriented index and
  segment;
- every window, parameter and identity refusal;
- every output-safety rule, including interrupt and failed cleanup.

Two tests use the pinned genome and skip without it. One checks the RF01116 and
origin mappings; the other refuses the decompressed FASTA. In a fresh worktree,
symlink the canonical pinned `.fna.gz` into ignored `data/raw/`.

No test establishes that ViennaRNA's thermodynamics suit this organism, that
these windows contain functional elements, or anything about regulation. Naive
global folds of each window, averaged, do not reproduce the windowed values
exactly. The interior flag is therefore a coverage label, not a weight.

## Source receipts

Retrieved 2026-10-14 over plain HTTPS, with no account and no access challenge.
Each quotation matched the retrieved bytes after collapsing whitespace (and
stripping tags for HTML).

| Id | Source | Located quotation | SHA-256 |
| --- | --- | --- | --- |
| V1 | [RNAplfold 2.7.2 manual](https://www.tbi.univie.ac.at/RNA/ViennaRNA/doc/html/man/RNAplfold.html), Description | "Again this probability is averaged over all windows containing the region." | `b94acfbb25b2735761d3f5993cd233dd24b0ce3bc55c4d626749c093d876e140` |
| V2 | same, `-T` option | "Rescale energy parameters to a temperature of temp C. Default is 37C." | same as V1 |
| V3 | [`pf_window.c` v2.7.2](https://github.com/ViennaRNA/ViennaRNA/blob/v2.7.2/src/ViennaRNA/partfunc/pf_window.c#L1561), line 1561 | "starting at i-x+1" | `79f07a777c3bba635f26894576b27206635db77e7b9ce522058a0e7f4f34e338` |
| V4 | same file, line 1933 | "return_pU(MIN2(ulength, k), k, ulength, aux_arrays, cb, data, options);" | same as V3 |
| V5 | same file, line 735 | "/* very short molecule ? */" | same as V3 |
| V6 | [`fold_compound.c` v2.7.2](https://github.com/ViennaRNA/ViennaRNA/blob/v2.7.2/src/ViennaRNA/fold_compound.c#L591), line 591 | "else if (md->window_size > (int)fc->length)" | `78d6567470f1767179bb99b9250b3ecbfc757b913bd9af43c2f33d087b6c5cc5` |
| V7 | same file, line 601 | "md->max_bp_span = md->window_size;" | same as V6 |
| V8 | NCBI `GCF_000817325.1_ASM81732v1_assembly_report.txt` (canonical `data/raw`; MD5 matches NCBI `md5checksums.txt`), line 30 | "CP006471.1 = NZ_CP006471.1" (tab-separated) | `d20004f66641303245127964328a01edd5f9473c2b4a128eeb39571f5f24b7f8` |

V1 is the same bytes as receipt S11 in the regulatory-methods shortlist. V3 is
the same bytes as that ticket's `pf_window.c` receipt.

## Before any of this becomes a published layer

A browser layer would need the following, under the existing
[data contract](data-contract.md) and [source ledger](source-ledger.md):

- a defined window set and parameters chosen before evaluation;
- sensitivity that holds across settings;
- a stronger control, such as dinucleotide-preserving shuffles;
- independent evidence for the regions;
- the computed record origin, with its translucent, lower-precedence rendering.

A value would still be labelled a model probability, never a measured
accessibility or a regulatory site.

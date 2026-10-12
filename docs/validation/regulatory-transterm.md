# Standalone TransTermHP native-UTEX pilot

- Purpose: Reproduce and validate exploratory intrinsic-terminator predictions on the pinned native UTEX 2973 assembly, with a deterministic shuffled-background comparison.
- Scope: `tools/regulatory_transterm.py`, TransTermHP 2.09, and ignored pilot artifacts; no browser or release layer.
- Last verified: 2026-10-12

## Interpretation boundary

The output is a computed sequence proxy, labelled `exploratory intrinsic-terminator
predictions, not measured regulation`. TransTermHP searches rho-independent
terminators only. Its integer `confidence` is the tool's random-sequence-background
score from `expterm.dat`, not a calibrated probability of biological termination
in UTEX 2973. The native-versus-shuffled counts are a null comparison, not a
false-positive-rate estimate. No result is admitted to `site/` by this pilot.

The tool's `TERM` coordinates delimit the hairpin and exclude the tail. The parser
retains the directional raw coordinates, emits a normalized one-based inclusive
hairpin interval, and separately emits the adjacent 15-nt tail used by the source
scoring function. `scoredTerminatorStart` and `scoredTerminatorEnd` are the union
of those two computed spans; they are not asserted biological boundaries.

All three replicons are circular, but TransTermHP linearizes them and cannot search
across an origin. The output therefore records an excluded conservative seam span
of 74 nt at each linearized end: the default maximum 59-nt hairpin plus the 15-nt
scored tail. The pinned GFF has two origin-wrapping genes. The wrapper preserves
their physical gene coverage as two same-strand tool-only annotation segments:

| Gene | Replicon | Source virtual interval | Physical segments | Strand |
| --- | --- | --- | --- | --- |
| `M744_RS13290` | `NZ_CP006472.1` | 45877–48876 | 45877–46366; 1–2510 | − |
| `M744_RS13620` | `NZ_CP006473.1` | 7830–8123 | 7830–7842; 1–281 | + |

This split preserves gene/intergenic context away from the seam. It does not make
cross-origin terminator prediction available.

## Verified source receipts

Retrieved 2026-10-12 without an account or access workaround. Each quoted fragment
was mechanically matched to the retrieved bytes at the location shown.

| Artifact | SHA-256 | Located evidence |
| --- | --- | --- |
| [Official homepage](https://transterm.cbcb.umd.edu/) | `7fc019a884e82e183dc54fafe22c7058b9fa2f3c9c26d0a1a5670dd23737cb59` | HTML line 46: “Source code for version 2.09” |
| [Official 2.09 archive](https://transterm.cbcb.umd.edu/transterm_hp_v2.09.zip), 1,827,662 bytes | `b636db1c0fe9731cc760d8f3639209d07f7f35309d83013cc9f9e40798ce8be0` | Homepage names 2.09, updated 2011-02-28; archive `Makefile` sets `VER=2.09`. |
| Archive `USAGE.txt` | `277728b462800a2cbae32587382e360c9d72bc41ae07674001324c6343679b3d` | Lines 91–111 define fields and say “Higher is better.” Lines 182–190 define the 0–100 confidence and random background. |
| Archive `seq.h` | `f082110f14faf61de918b4a18884feb536e10fbef95691f6fcc22c145644a8a9` | Lines 56–58: “the tail 'region' is not included.” |
| Archive `gene-reader.cc` | `24f9c7c4646e46d74c8c31ddedd01930dbbf95ad05966756349e1b07b2d72561` | Line 126: “Start and end are 1-based”. |
| Archive `ermolaeva-score.cc` | `b510b6957d2b76de57b35ad78eec96143d4322ab4c8da932ce26d9ba1ac29cc1` | Lines 79–101 calculate the strand-aware score from 15 adjacent tail bases. |
| Archive `LICENSE.txt` | `204d8eff92f95aac4df6c8122bc1505f468f3a901e5a4cc08940e0ede1938994` | GNU GPL version 2 text; this receipt records the supplied terms, not a project permission decision. |
| Archive `expterm.dat` | `fce89a92ab487aaea5a54015e859e1fb5e31f4f9985c9df7831ee09a367db1fe` | Exact background file required by `-p`; the wrapper rejects any other bytes. |

The archive is 2.09, but its unchanged `transterm.cc:254` banner says `v2.08`.
The pilot records both facts rather than rewriting the banner. The official source
also has three legacy `return false` statements in a pointer-returning function;
modern clang rejects them. The scratch build changes only those returns to `0`.

## Reproduce the build

Keep all downloads and generated files under the already ignored
`.playwright-cli/regulatory-pilots/` directory. No shared install is needed.

```sh
PILOT=.playwright-cli/regulatory-pilots/transterm-2.09
mkdir -p "$PILOT"
curl --fail --location --silent --show-error \
  https://transterm.cbcb.umd.edu/transterm_hp_v2.09.zip \
  --output "$PILOT/transterm_hp_v2.09.zip"
shasum -a 256 "$PILOT/transterm_hp_v2.09.zip"
unzip -q "$PILOT/transterm_hp_v2.09.zip" -d "$PILOT/source"
cd "$PILOT/source/transterm_hp_v2.09"
sed -i.bak 's/if(i == EOF) return false;/if(i == EOF) return 0;/g' seq.cc
test "$(rg -c 'if\(i == EOF\) return 0' seq.cc)" -eq 3
```

On Linux, build with the archive Makefile:

```sh
make clean transterm
```

On the verified macOS Command Line Tools installation, libc++ headers exist only
inside the SDK, so use its explicit include path:

```sh
TRANSTERM_SDK_PATH="$(xcrun --show-sdk-path)"
make clean transterm \
  CXXFLAGS="-g -O3 -Wall -pedantic -isystem $TRANSTERM_SDK_PATH/usr/include/c++/v1"
```

The verified arm64 macOS binary SHA-256 was
`d76ce6315049411e2a48b772b41e96164fd0de94a7ee4cb3aba697fe4395c3c2`.
Binary hashes can differ with compiler, path, or build date; every JSON result pins
the binary it actually executed as well as the immutable source archive.

## Reproduce the native and control run

Acquire the configured genome if it is not already present:

```sh
./tools/fetch_genome.sh
```

The command rejects anything except these exact compressed inputs:

| Input | SHA-256 |
| --- | --- |
| `GCF_000817325.1_ASM81732v1_genomic.fna.gz` | `22a2b07881c1099c32454778de0e90b1c40f74f44c0f59e000507106c0deb567` |
| `GCF_000817325.1_ASM81732v1_genomic.gff.gz` | `7f606a08892b061667a1988cc05dee889a82f9407066dcf81010ec2e25bb215f` |

From the repository root, choose a fresh output directory because the command
refuses to overwrite any output:

```sh
PILOT=.playwright-cli/regulatory-pilots/transterm-2.09
RUN="$PILOT/run-20261012-a"
mkdir -p "$RUN"
.venv/bin/python tools/regulatory_transterm.py \
  --transterm "$PILOT/source/transterm_hp_v2.09/transterm" \
  --expterm "$PILOT/source/transterm_hp_v2.09/expterm.dat" \
  --source-archive "$PILOT/transterm_hp_v2.09.zip" \
  --fasta data/raw/GCF_000817325.1_ASM81732v1_genomic.fna.gz \
  --gff data/raw/GCF_000817325.1_ASM81732v1_genomic.gff.gz \
  --output-json "$RUN/utex-pilot.json" \
  --output-tsv "$RUN/utex-pilot.tsv" \
  --native-raw "$RUN/native.raw.tt" \
  --control-raw "$RUN/shuffled-control.raw.tt"
```

The wrapper runs both strands with `--all-context`, suppresses sequence display
with `-S`, uses the documented default minimum confidence 76, and preserves all
other printed 2.09 defaults in each raw report. The control applies a reproducible
SHA-256-indexed Fisher–Yates mononucleotide shuffle independently to each replicon
with seed 2973, preserving per-replicon length and nucleotide composition.

## Failure and edge-case contract

- FASTA records must have unique, non-empty IDs and only `A`, `C`, `G`, or `T`;
  unknown bases fail before execution.
- The GFF must be the checksum-pinned UTEX annotation, declare each replicon
  circular, contain unique gene IDs, and keep every physical segment in bounds.
- Missing files, non-executable binaries, wrong source/model/input checksums,
  invalid confidence or timeout values, and tool errors fail without publishing
  a partial result.
- Malformed reports, duplicate sequence or TERM IDs, missing sequence blocks,
  wrong sequence lengths, invalid strands/contexts/scores, and out-of-bounds
  hairpin or tail spans fail parsing.
- A valid report with zero hits produces an empty records list and a header-only
  TSV; zero is not converted to missing data or interpreted as biological absence.
- All four output paths must be distinct from one another and from every input.
  Existing output files are never replaced.

Focused verification:

```sh
.venv/bin/python -m pytest -q tests/test_regulatory_transterm.py
```

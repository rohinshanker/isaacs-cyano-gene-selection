# Bounded IntaRNA interaction-window pilot

`tools/regulatory_intarna.py` runs IntaRNA **3.4.1** on three approximate native
RF01116 query windows and three annotated CDS-start contexts. It records
computational window interactions, not established sRNA targets. No output is
admitted to the browser. See [regulatory-methods.md](regulatory-methods.md) and
the [RF01116 homology contract](regulatory-rfam.md).

## Input and coordinate contract

The producer refuses FASTA/GFF bytes other than the existing native UTEX 2973
pins for `GCF_000817325.1_ASM81732v1`:

| Input | SHA-256 |
| --- | --- |
| Compressed genomic FASTA | `22a2b07881c1099c32454778de0e90b1c40f74f44c0f59e000507106c0deb567` |
| Compressed genomic GFF | `7f606a08892b061667a1988cc05dee889a82f9407066dcf81010ec2e25bb215f` |

It checks all three replicon IDs and lengths. Inputs are extracted only from
`NZ_CP006471.1`, in the RNA's 5′-to-3′ orientation, converting DNA T to RNA U.
The [RF01116 runbook](regulatory-rfam.md) establishes the previously computed
homology interval `1364716..1364778`, plus strand. Its 63 nt are **not confirmed
full-transcript boundaries**. The alternative windows are explicit sensitivity
inputs, rather than inferred transcript ends:

| Query | Native one-based inclusive interval (+) | Length |
| --- | --- | --- |
| RF01116-flank0 | 1364716..1364778 | 63 |
| RF01116-flank20 | 1364696..1364798 | 103 |
| RF01116-flank50 | 1364666..1364828 | 163 |

Target contexts contain exactly 100 nt preceding the annotated CDS translation
start and the first 50 coding nt. They are approximate windows, not measured
full mRNAs, complete UTRs, or transcription start sites.

| Target locus | Annotated CDS | Strand | Context interval |
| --- | --- | --- | --- |
| M744_RS07005 | 1363447..1364610 | + | 1363347..1363496 |
| M744_RS07010 (trxA) | 1364916..1365239 | + | 1364816..1364965 |
| M744_RS00020 (bchI) | 3121..4215 | − | 4166..4315 |

The two loci beside the family hit provide annotation context; the third adds
a reverse-strand coordinate check. This is an explicitly chosen bounded sample,
with no target enrichment or genome-wide-ranking interpretation. Native GFF
attributes are retained verbatim, and missing/duplicate CDS identities are refused.
No donor-to-native gene or coordinate join is performed.
The ±50-nt query and trxA target context overlap by 13 genomic bases; all other
native input pairs are disjoint. Each run records `nativeInputOverlapNt`.
That overlap does not establish separate transcripts or a trans interaction.

IntaRNA sequence 1 is the target and sequence 2 is the query. Local coordinates
are one-based inclusive from each input RNA's 5′ end. For a native window `[s,e]`,
local `[a,b]` maps to `[s+a−1,s+b−1]` on `+`, or `[e−b+1,e−a+1]` on `−`.
Both interaction intervals and every emitted base pair retain these mappings.
Shuffled and mutated queries have synthetic identities and **no native genomic
coordinates**; their source-window relationship is documented separately.

## Runtime and build identity

Use the [official release distribution](https://github.com/BackofenLab/IntaRNA/releases/download/v3.4.1/intaRNA-3.4.1.tar.gz),
SHA-256 `4fd338a9a7a62f4398a27f41783120abaad9bccdecd39387c436adb0601f0ed8`.
Verify before extraction. The wrapper pins that archive and the executable's
`IntaRNA 3.4.1` banner; it records the complete banner and executable hash.
An archive hash alone is not binary-build attestation. Retain compiler,
dependencies, configuration, build logs and the library linkage inspection.

The demonstrated macOS arm64 build uses Apple Clang 21.0.0, Boost 1.85.0,
ViennaRNA 2.7.0 and scratch-local LLVM OpenMP. Its executable SHA-256 is
`4ef77a1e6b5fe655af6a79c328667d53530f6ffcf983d9304f74bbe23b4f5b58`.
Other builds may differ; the banner records linked ViennaRNA and Boost versions.
The checked-in [package identities](regulatory-intarna-dependencies-osx-arm64.json)
retain all 35 package URLs, versions, build IDs, SHA-256 and MD5. Use the
[explicit package manifest](regulatory-intarna-dependencies-osx-arm64.txt) to
reproduce this solved set. Verify every downloaded archive against those hashes
before extraction/assembly. These dependency files are build inputs, not
biological data admission.

For isolated dependencies, use a scratch-local micromamba 2.3.2 with a scratch
root prefix and `--download-only --no-rc --no-env`. This downloads/extracts without
linking an environment or registering one in the user's shared environment list:

```sh
"$scratch/bin/micromamba" create --no-rc --no-env \
  --root-prefix "$scratch/mamba" --prefix "$scratch/deps" \
  --override-channels -c conda-forge -c bioconda --platform osx-arm64 \
  --download-only -y boost-cpp=1.85 viennarna=2.7.0 llvm-openmp pkg-config
# For the exact solved package set instead of the three package constraints,
# supply --file docs/validation/regulatory-intarna-dependencies-osx-arm64.txt.
```

Assemble the downloaded package files in scratch using an existing interpreter
with conda's `update_prefix` API (on this Mac, `/opt/miniconda3/bin/python`). The
following is the complete assembly recipe; it does not install/register an
environment or alter shared packages. Use a fresh `deps` directory. Set
`INTARNA_SCRATCH` to the same absolute scratch root used above, and keep
`PYTHONDONTWRITEBYTECODE=1` when invoking the interpreter.

```python
import json
import os
from pathlib import Path
import shutil
from conda.core.portability import update_prefix
from conda.models.enums import FileMode

root = Path(os.environ["INTARNA_SCRATCH"])
prefix = root / "deps"
prefix.mkdir()  # Refuse existing output.
for package in sorted((root / "mamba/pkgs").iterdir()):
    manifest = package / "info/paths.json"
    if not manifest.is_file():
        continue
    for row in json.loads(manifest.read_text())["paths"]:
        source = package / row["_path"]
        target = prefix / row["_path"]
        target.parent.mkdir(parents=True, exist_ok=True)
        if source.is_symlink():
            if target.exists() or target.is_symlink():
                target.unlink()
            target.symlink_to(source.readlink())
        else:
            shutil.copy2(source, target)
        if row.get("prefix_placeholder"):
            update_prefix(str(target), str(prefix), row["prefix_placeholder"],
                          FileMode(row["file_mode"]), subdir="osx-arm64")
```

The scratch package cache must contain only this verified manifest's packages.
If assembly fails, retain diagnostics and remove only that new scratch `deps`
directory before a retry. Source archives, compiler and package tooling stay
outside the tracked repository. No shared environment, brew installation or
shell profile is changed.

On this Mac, explicitly include the SDK C++ headers because the compiler's
default C++ header directory lacks `ctime`. The conda RNAlib `RNAlib2.pc` passes
`-Wl,-fno-lto`, which Apple's linker rejects. Remove that one token from the
scratch copy only, retaining the original file and both hashes. IntaRNA's source
and RNA model parameters remain unchanged. Inside the extracted distribution:

```sh
./configure --prefix="$scratch/runtime" \
  --with-boost="$scratch/deps" --with-boost-libdir="$scratch/deps/lib" \
  --with-vrna="$scratch/deps" CC=clang CXX=clang++ \
  CPPFLAGS="-I$scratch/deps/include" \
  CXXFLAGS="-O2 -Xpreprocessor -fopenmp -I$scratch/deps/include -isystem $sdk/usr/include/c++/v1" \
  LDFLAGS="-L$scratch/deps/lib -Wl,-rpath,$scratch/deps/lib -lomp" \
  PKG_CONFIG="$scratch/deps/bin/pkg-config" \
  PKG_CONFIG_PATH="$scratch/deps/lib/pkgconfig"
make -j2
make install
"$scratch/runtime/bin/IntaRNA" --version
otool -L "$scratch/runtime/bin/IntaRNA"
```

Set `scratch` to an absolute, task-owned directory and `sdk` to
`xcrun --show-sdk-path`. Runtime libraries remain in scratch. The bundled old
Catch test harness declares a signed random-generator result type, which modern
libc++ rejects in C++14-and-later `std::shuffle`. Compile upstream tests in the
release's documented C++11 mode, without editing source:

```sh
make -C tests clean
make -C tests check -j2 \
  CXXFLAGS="-O2 -std=c++11 -Xpreprocessor -fopenmp -I$scratch/deps/include -isystem $sdk/usr/include/c++/v1"
```

The API suite passes 3,859 assertions in 30 cases; its CLI suite also passes.
The initial compiler/linker/test diagnostics and corrective flags are retained in
the evidence bundle. These compatibility repairs do not establish historical
version parity or biological calibration.

## Parameters, controls and output checks

The base prediction uses `--model=X --mode=H --energy=V --temperature=37`,
`--seedBP=7 --seedMaxUP=0`, computed accessibilities
`--acc=C --accW=150 --accL=100`, one reported optimum and one thread. Remaining
3.4.1 defaults are preserved; the actual `--fullhelp` output and every argument
vector accompany each run. GU pairing and default loop/seed-energy restrictions
remain enabled. The query seed is unrestricted within each window; the producer
does not claim to localize a biologically established Yfr1 seed.

`E = E_hybrid + ED1 + ED2` in **kcal/mol**, with lower energy favoring the modeled
interaction. ED values penalize accessibility. Pu values are model-derived
unpaired probabilities, recomputed by IntaRNA from rounded ED; they are not
probabilities of regulation. Each output row is checked for exact input identity,
finite energies, valid Pu/ED, component sums, in-bounds coordinates, complementary
antiparallel unique pairs, interaction endpoints and the complete contiguous seed.
Malformed/log-contaminated CSV, nonzero exits, stderr, invalid versions and
per-call timeouts refuse publication. Header-only output is retained as
`no_reported_interaction`, never a biological negative.

The official README's synthetic positive example uses target
`CCCCCCCCGGGGGGGGGGGGGG` and query `AAAACCCCCCCUUUU`. It must recover target
9..15 / query 5..11 and −10.85 kcal/mol within 0.1. Its query-shuffle and
seed-disruption controls are also run. It is a runtime control, not a donor or
UTEX benchmark.

Each native pair has a deterministic composition-preserving query shuffle
(seed 2973; Python `Random.shuffle` initialized from SHA-256 of seed and query ID).
For each default interaction, every query base in the reported best seed is
replaced by the same base as its target partner, removing that seed's original
complementarity. Exact mutated sequence and original seed positions are retained.
Pairs without a reported interaction have an explicit skipped-disruption entry.
Mutation can alter folding and move the optimal interaction; persistence of a
different interaction is retained. Neither control is a proven biological negative.

Two independent parameter sensitivities retain the native sequences: global
accessibility (`accW=accL=0`) and a six-base seed. Together the experiment contains
39..48 runs, depending on how many default native pairs support a disruption.

The observed pinned-library pilot has 44 runs: default native 5/9 interactions,
shuffled-native 8/9, disrupted-native 4/5, global-accessibility 6/9 and six-base-seed
8/9. Both official-example controls report no interaction. All three default
±50-nt-window interactions occur entirely in the added upstream flank outside
RF01116. These are sensitivity/null observations, **not target recovery, accuracy,
false-positive-rate or regulatory-function estimates**. They require retaining
the approximate-window label even when a model energy is strongly negative.

## Reproduce and validate

Use the canonical assembly files read-only, with a new output directory:

```sh
"$python" tools/regulatory_intarna.py \
  --intarna "$scratch/runtime/bin/IntaRNA" \
  --source-archive "$scratch/source/intaRNA-3.4.1.tar.gz" \
  --fasta "$native/GCF_000817325.1_ASM81732v1_genomic.fna.gz" \
  --gff "$native/GCF_000817325.1_ASM81732v1_genomic.gff.gz" \
  --output-dir "$scratch/pilot"
INTARNA_PILOT_RUNTIME="$scratch" INTARNA_PILOT_NATIVE_DIR="$native" \
  "$python" -m pytest -q tests/test_regulatory_intarna.py
```

`pilot.json` is schema version 1, with exact input sequences/hashes, coordinates,
annotation context, commands, raw hashes, parsed interactions and limitations.
Per-run CSV and FASTA files, `version.txt` and `fullhelp.txt` are preserved.
The integration test compares two complete runs byte for byte and independently
round-trips every native window and base-pair position against the genome.
The producer uses disposable execution scratch, refuses existing output paths,
and removes its own partially published directory on failure or interruption.
Cleanup failures are reported without masking the original exception. Preexisting
outputs remain untouched. Nothing enters the source tree except the tool, tests
and this runbook.

## Primary-source receipts and scientific limit

All quotations below were mechanically re-matched on **2026-10-14**, with exact
substring matching after whitespace normalization (XML uses element text).
`source-receipts.json` preserves source URLs, locations, match counts and hashes.

| Receipt | Official source and location | Short quotation | Retrieved raw SHA-256 |
| --- | --- | --- | --- |
| I1–I3 | [3.4.1 README](https://raw.githubusercontent.com/BackofenLab/IntaRNA/v3.4.1/README.md), opening / Just run / CSV indexing | “incorporating accessibility and seeding”; “interaction energy = -10.85 kcal/mol”; “Position annotations start indexing with 1” | `67ae5c17c94ccff9a68484d4b7fefb950587dc22b0f85d91afd8c3742c0c0fc8` |
| I4 | [Richter 2010](https://www.ebi.ac.uk/europepmc/webservices/rest/PMC2796815/fullTextXML), abstract Results | “in Prochlorococcus MED4” | `8a2c5cc84eb9bc2f68aa991e4ffc10b3c3a6ae40009547cd7cd3c2b35a2d81c8` |
| I5 | [Tan 2018](https://www.ebi.ac.uk/europepmc/webservices/rest/PMC6091082/fullTextXML), Results PsrR1 paragraph | “was identified as a homolog of the sRNA PsrR1” | `7063969b6577a330390269bec64df5f22c696203239257cb06fc21ef5148f7d8` |
| I6 | Official release `src/bin/CommandLineParsing.cpp:165` | `seedBP("seedBP",2,20,7)` | `c54b2a55fad4f299c5d3251a2c08c8862192fcf51860190996c2243032f916b3` |
| I7 | [3.4.1 LICENSE](https://raw.githubusercontent.com/BackofenLab/IntaRNA/v3.4.1/LICENSE), heading | “The MIT License (MIT)” | `a54b0ef3107272a60da3d39ec57ab10ab9c2d785f28c562b1d25cb947461e409` |

The release distribution's `COPYING` points to LICENSE but omits that file;
retain the official tag-addressed LICENSE separately. Its receipt is source
terms evidence, not project admission or a permission decision. Dependencies
retain their package licence files; no third-party binary or model is committed.

Richter's Yfr1 interaction evidence concerns Prochlorococcus MED4, not a native
UTEX transcript or locus join. Tan's identified PsrR1 is a different sRNA and
locus; neither its TSS nor its stated length defines the query used here.
The supplied native annotation and these retrieved sources do not establish
full UTEX Yfr1 transcript ends or these target interactions. This specific
scientific dependency limits biological interpretation while leaving the
runtime/wrapper/window experiment complete. Any later target-admission work
needs independently established RNA identities/boundaries and evaluated
interactions, under the coordinator's separate scientific admission scope.

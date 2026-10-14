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
dependencies, configuration, build logs and actual library linkage.

The macOS arm64 recipe uses Apple Clang 21.0.0, Boost 1.85.0, ViennaRNA 2.7.0,
LLVM OpenMP 23.1.3 and conda-forge **libcxx 23.1.3**. libRNA, including its energy
parameters, is statically linked. Boost, OpenMP and libc++ are dynamically loaded
through an **absolute scratch `LC_RPATH`**. Keep those libraries in place or
rebuild for another prefix; moving only the binary is not a relocatable install.
The reference executable hash is
`4ef77a1e6b5fe655af6a79c328667d53530f6ffcf983d9304f74bbe23b4f5b58`;
builds at another prefix can differ. Record the actual new binary hash.

The checked-in [JSON package identities](regulatory-intarna-dependencies-osx-arm64.json)
retain all 35 exact URLs, versions, build IDs, SHA-256 and MD5. The matching
[explicit manifest](regulatory-intarna-dependencies-osx-arm64.txt) retains the
solved set for inspection. Dependency manifests are build inputs, not biological
data admission. The steps below provide the complete reusable recipe; no
essential input or recipe is available only in temporary evidence.

### Bootstrap and verified extraction

Set `scratch` to a fresh absolute task-owned directory, `python` to an existing
Python interpreter, and `sdk` to `xcrun --show-sdk-path`. Do not change HOME,
shared configuration or user caches. Bootstrap micromamba **2.3.2** from the
[exact conda-forge osx-arm64 archive](https://conda.anaconda.org/conda-forge/osx-arm64/micromamba-2.3.2-0.tar.bz2),
SHA-256 `ae0b50b441fef93abd20711f18b074359a7f8f1f523a8046a4d6ab44aa68ff1b`:

```sh
mkdir -p "$scratch/source"
curl -fsSL https://conda.anaconda.org/conda-forge/osx-arm64/micromamba-2.3.2-0.tar.bz2 \
  -o "$scratch/source/micromamba-2.3.2-0.tar.bz2"
INTARNA_SCRATCH="$scratch" "$python" - <<'PY'
import hashlib, os
from pathlib import Path
p = Path(os.environ["INTARNA_SCRATCH"]) / "source/micromamba-2.3.2-0.tar.bz2"
if hashlib.sha256(p.read_bytes()).hexdigest() != "ae0b50b441fef93abd20711f18b074359a7f8f1f523a8046a4d6ab44aa68ff1b":
    raise ValueError("micromamba archive SHA-256 mismatch")
PY
tar -xjf "$scratch/source/micromamba-2.3.2-0.tar.bz2" -C "$scratch" bin/micromamba
```

**Do not use `micromamba create --download-only`.** It still creates prefix
metadata, registers an environment and may create a shared user cache. `--no-env`
disables reading environment variables, not environment registration.
Download each exact JSON-manifest URL, verify SHA-256 **before** extraction,
then invoke only `micromamba package extract`. Save/run this Python block from
the repository root with `INTARNA_SCRATCH="$scratch" "$python"`:

```python
import hashlib
import json
import os
import subprocess
import urllib.request
from pathlib import Path

root = Path(os.environ["INTARNA_SCRATCH"])
packages = json.loads(Path("docs/validation/regulatory-intarna-dependencies-osx-arm64.json").read_text())
archives = root / "archives"
archives.mkdir()  # Refuse existing download output.
receipts = []
for package in packages:
    archive = archives / package["url"].rsplit("/", 1)[-1]
    with urllib.request.urlopen(package["url"], timeout=60) as response, archive.open("xb") as output:
        while chunk := response.read(1024 * 1024):
            output.write(chunk)
    if hashlib.sha256(archive.read_bytes()).hexdigest() != package["sha256"]:
        raise ValueError(f"archive SHA-256 mismatch: {archive.name}")
    destination = root / "mamba/pkgs" / f"{package['name']}-{package['version']}-{package['build']}"
    subprocess.run([str(root / "bin/micromamba"), "--no-rc", "--no-env", "package", "extract",
                    str(archive), str(destination)], check=True)
    if not (destination / "info/paths.json").is_file():
        raise ValueError(f"missing paths manifest: {archive.name}")
    receipts.append({**package, "sha256VerifiedBeforeExtraction": True})
(root / "download-extraction-receipts.json").write_text(json.dumps(receipts, indent=2) + "\n")
```

No solve/create/link command is invoked. Archive and extraction paths are
task-owned scratch, and a failed hash stops before that archive is extracted.
Do not clean shared user directories.

### Assemble and adapt scratch metadata

Run the following block with an existing interpreter providing conda's
`update_prefix` API (`/opt/miniconda3/bin/python` on this Mac), setting
`INTARNA_SCRATCH="$scratch" PYTHONDONTWRITEBYTECODE=1`. It copies packages and
relocates prefixes only in a fresh scratch `deps` directory; it does not invoke
environment installation or registration:

```python
import json
import os
import shutil
from pathlib import Path
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

The scratch extraction cache must contain only this manifest's verified packages.
After a failed assembly, retain diagnostics and remove only that new scratch
`deps` directory before retrying. No shared packages, brew installation or shell
profile are edited.

The compiler's default C++ header directory on this Mac lacks `ctime`; include
the SDK's C++ headers explicitly. The conda RNAlib `RNAlib2.pc` passes
`-Wl,-fno-lto`, which Apple's linker rejects. Remove exactly that token from the
scratch metadata and record its before/after hashes. At reference prefix
`/tmp/cyano-regulatory-completion-20261014/intarna/deps`, the hashes are:

| RNAlib metadata | SHA-256 |
| --- | --- |
| Before edit | `0b42e34aa74391390d96cb35fdf58fda9104efe4f27eae21a8b6c80ee05d0c69` |
| After edit | `a42245ea51fcf70b50e80f5bf52d147d54b23a74cf81b11e1a654a7042c8e74c` |

Metadata includes the relocated prefix, so another prefix changes these hashes.
Use this block to record the actual hashes:

```python
import hashlib, json, os
from pathlib import Path
root = Path(os.environ["INTARNA_SCRATCH"])
p = root / "deps/lib/pkgconfig/RNAlib2.pc"
before = p.read_bytes()
if before.count(b"-Wl,-fno-lto ") != 1:
    raise ValueError("unexpected RNAlib metadata")
p.with_suffix(".pc.original").write_bytes(before)
p.write_bytes(before.replace(b"-Wl,-fno-lto ", b""))
(root / "rnalib-metadata-hashes.json").write_text(json.dumps({
    "prefix": str(root / "deps"), "before": hashlib.sha256(before).hexdigest(),
    "after": hashlib.sha256(p.read_bytes()).hexdigest(),
    "edit": "remove one -Wl,-fno-lto token only"}, indent=2) + "\n")
```

### Compile, inspect architecture and attest loaded libraries

Download, verify and extract the official source, retaining its tag-addressed
LICENSE alongside the archive:

```sh
curl -fsSL https://github.com/BackofenLab/IntaRNA/releases/download/v3.4.1/intaRNA-3.4.1.tar.gz \
  -o "$scratch/source/intaRNA-3.4.1.tar.gz"
INTARNA_SCRATCH="$scratch" "$python" - <<'PY'
import hashlib, os
from pathlib import Path
p = Path(os.environ["INTARNA_SCRATCH"]) / "source/intaRNA-3.4.1.tar.gz"
if hashlib.sha256(p.read_bytes()).hexdigest() != "4fd338a9a7a62f4398a27f41783120abaad9bccdecd39387c436adb0601f0ed8":
    raise ValueError("IntaRNA source SHA-256 mismatch")
PY
tar -xzf "$scratch/source/intaRNA-3.4.1.tar.gz" -C "$scratch/source"
curl -fsSL https://raw.githubusercontent.com/BackofenLab/IntaRNA/v3.4.1/LICENSE \
  -o "$scratch/source/LICENSE"
```

Inside `source/intaRNA-3.4.1`, use explicit system compiler paths and `-arch arm64`:

```sh
./configure --prefix="$scratch/runtime" \
  --with-boost="$scratch/deps" --with-boost-libdir="$scratch/deps/lib" \
  --with-vrna="$scratch/deps" CC=/usr/bin/clang CXX=/usr/bin/clang++ \
  CPPFLAGS="-I$scratch/deps/include" CFLAGS="-arch arm64" \
  CXXFLAGS="-arch arm64 -O2 -Xpreprocessor -fopenmp -I$scratch/deps/include -isystem $sdk/usr/include/c++/v1" \
  LDFLAGS="-L$scratch/deps/lib -Wl,-rpath,$scratch/deps/lib -lomp" \
  PKG_CONFIG="$scratch/deps/bin/pkg-config" \
  PKG_CONFIG_PATH="$scratch/deps/lib/pkgconfig"
make -j2
make install
"$scratch/runtime/bin/IntaRNA" --personality=IntaRNA3 --version
/usr/bin/arch -arm64 /usr/bin/clang++ --version > "$scratch/compiler-arm64.txt"
/usr/bin/file "$scratch/runtime/bin/IntaRNA" > "$scratch/binary-file.txt"
/usr/bin/lipo -archs "$scratch/runtime/bin/IntaRNA" > "$scratch/binary-architecture.txt"
/usr/bin/otool -L "$scratch/runtime/bin/IntaRNA" > "$scratch/linkage.txt"
/usr/bin/otool -l "$scratch/runtime/bin/IntaRNA" > "$scratch/load-commands.txt"
```

A compiler banner from another process architecture does not establish this
binary's target. Keep the arm64 compiler/file/lipo checks and explicit configure
flags together. Direct linkage includes five Boost libraries (`regex`,
`program_options`, `filesystem`, `system`, `iostreams`), OpenMP, libc++ and OS
libraries. Record **actual resolved loader paths** and task-local file hashes
with this block, run from the repository root:

```python
import hashlib, json, os, platform, re, subprocess
from pathlib import Path
root = Path(os.environ["INTARNA_SCRATCH"])
binary = root / "runtime/bin/IntaRNA"
trace = subprocess.run([str(binary), "--personality=IntaRNA3", "--version"],
    env={**os.environ, "DYLD_PRINT_LIBRARIES": "1"}, text=True, capture_output=True, check=True)
(root / "dyld-loaded-libraries.txt").write_text(trace.stderr)
libraries = set()
for line in trace.stderr.splitlines():
    match = re.match(r"dyld\[\d+\]: <[^>]+> (/.+)$", line)
    if match:
        path = Path(match[1]).resolve()
        if path.is_relative_to((root / "deps").resolve()) and path.is_file():
            libraries.add(path)
if not any(path.name.startswith("libc++.") for path in libraries):
    raise ValueError("loader did not identify task-local libc++")
identity = {
    "schemaVersion": 1, "binarySha256": hashlib.sha256(binary.read_bytes()).hexdigest(),
    "architecture": subprocess.check_output(["/usr/bin/lipo", "-archs", str(binary)], text=True).strip(),
    "platform": platform.platform(),
    "packageManifestSha256": hashlib.sha256(Path("docs/validation/regulatory-intarna-dependencies-osx-arm64.json").read_bytes()).hexdigest(),
    "libcxxPackageVersion": "23.1.3",
    "rnAlibMetadata": json.loads((root / "rnalib-metadata-hashes.json").read_text()),
    "dynamicLibraries": [{"path": str(path), "sha256": hashlib.sha256(path.read_bytes()).hexdigest()}
                         for path in sorted(libraries)],
    "scope": "task-local libraries loaded by the version call; OS shared-cache libraries retained in loader/linkage logs, not file-hashed"}
(root / "runtime-identity.json").write_text(json.dumps(identity, indent=2) + "\n")
```

Pass this receipt as `--runtime-identity` to retain it in `pilot.json`; the wrapper
verifies the executable and every listed dynamic library's file hash before
execution. Omission is explicit (`runtimeIdentity: null`), not library attestation.
The receipt records an observed build identity, not independent source-derivation
proof. Python's [Popen contract](https://docs.python.org/3.12/library/subprocess.html)
and [signal handler contract](https://docs.python.org/3.12/library/signal.html)
govern owned-child termination and CLI cleanup.

The bundled old Catch harness uses a signed random-generator result type which
modern libc++ rejects in C++14-and-later `std::shuffle`. Compile upstream tests
in the release's documented C++11 mode, without changing source:

```sh
make -C tests clean
make -C tests check -j2 \
  CXXFLAGS="-arch arm64 -O2 -std=c++11 -Xpreprocessor -fopenmp -I$scratch/deps/include -isystem $sdk/usr/include/c++/v1"
```

The regression oracle is 3,859 API assertions in 30 cases plus the CLI suite.
Compatibility flags preserve runtime/model source; passing tests does not
establish historical version parity or biological calibration.


## Parameters, controls and output checks

Prediction, version and fullhelp calls pin `--personality=IntaRNA3`, so a
renamed regular copy cannot silently select legacy parameters from its file name.
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

Each native query has one deterministic composition-preserving shuffle
(seed 2973; Python `Random.shuffle` initialized from SHA-256 of seed and query ID),
reused unchanged across all three targets. These are three query shuffles,
not nine independent null replicates.
For each default interaction, every query base in the reported best seed is
replaced by the same base as its target partner, removing that seed's original
complementarity. Exact mutated sequence and original seed positions are retained.
Pairs without a reported interaction have an explicit skipped-disruption entry.
Mutation can alter folding and move the optimal interaction; persistence of a
different interaction is retained. Neither control is a proven biological negative.

Two parameter sensitivities retain the native sequences: whole-input-window
folding (`accW=accL=0`, variant `whole_input_window_folding`) and a six-base seed.
ED always depends on the supplied finite input window. Setting both limits to
zero folds that input window as a whole; it does not recover missing transcript
context. At lengths 63 and 103, the default 150-nt accessibility window already
covers the full query. For 150-nt targets, this sensitivity primarily removes the
100-nt base-pair-span limit. The 163-nt query also changes sliding-window context.
Together the experiment contains
39..48 runs, depending on how many default native pairs support a disruption.

The observed pinned-library pilot has 44 runs: default native 5/9 interactions,
shuffled-native 8/9, disrupted-native 4/5, whole-input-window-folding 6/9 and six-base-seed
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
  --runtime-identity "$scratch/runtime-identity.json" \
  --source-archive "$scratch/source/intaRNA-3.4.1.tar.gz" \
  --fasta "$native/GCF_000817325.1_ASM81732v1_genomic.fna.gz" \
  --gff "$native/GCF_000817325.1_ASM81732v1_genomic.gff.gz" \
  --output-dir "$scratch/pilot"
INTARNA_PILOT_RUNTIME="$scratch" INTARNA_PILOT_NATIVE_DIR="$native" \
  "$python" -m pytest -q tests/test_regulatory_intarna.py
```

`pilot.json` is schema version 2, with exact input sequences/hashes, coordinates,
annotation context, commands, raw hashes, parsed interactions and limitations.
Per-run CSV and FASTA files, `version.txt` and `fullhelp.txt` are preserved.
The integration test compares two complete runs byte for byte, compares actual
renamed-copy numerical outputs, and independently round-trips every native window and base-pair position against the genome.
The producer uses disposable execution scratch, refuses existing output paths,
and removes its own partially published directory on Python exceptions, SIGINT
and handled SIGTERM. The CLI SIGTERM handler unwinds cleanup with exit **143**;
SIGINT keeps its existing behavior. An in-flight child is terminated and reaped
through its exact Popen handle, escalating to kill only that child if it ignores
termination. No process-name or process-group kills are used. Signal handlers
are restored for programmatic callers. Acquisition defers callable handlers
until the child, temporary directory or output directory is owned; child signal
masks are not changed.
There is **no SIGKILL cleanup guarantee** for the wrapper. Cleanup can fail if
the OS refuses deletion or child termination; such failures retain diagnostics.
Cleanup failures are reported without masking the original exception. Preexisting
outputs remain untouched. A renamed binary records its real `binaryFileName`;
only that provenance field may differ in `pilot.json` for the same build. Fullhelp
may also include the invoked file name; CSV/FASTA numerical outputs must agree.
The source tree contains the tool, tests, runbook and exact dependency manifests.

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

# Promoter Calculator compatibility evaluation

This prepares the public v1.0 model and evaluates native UTEX gTSS windows in
Python 3. It does not calibrate the model for UTEX, predict a complete
regulatory-site layer, or publish scores. The model uses E. coli calibration
constants; an unrecognized organism
name falls through to those same constants. Use its E. coli identity explicitly.

## Source and adaptation

Download these six files from the commit-addressed
[SalisLabCode Promoter_Calculator directory](https://github.com/hsalis/SalisLabCode/tree/46da9132740bce30bccd107f02808adf2215e2f0/Promoter_Calculator):
`Promoter_Calculator_v1_0.py`, `util.py`, `free_energy_coeffs.npy`,
`model_intercept.npy`, `LICENSE`, and `README.md`. Keep them outside tracked source
files, for example under `.playwright-cli/regulatory-promoter/source/`.
`tools/prepare_promoter_calculator.py` records their exact URLs and SHA-256 pins.
It reads local downloads only and rejects altered or missing files before writing.

```sh
.venv/bin/python tools/prepare_promoter_calculator.py \
  --source-dir .playwright-cli/regulatory-promoter/source \
  --output-dir .playwright-cli/regulatory-promoter/prepared
```

The output must not already exist; its parent must exist. The preparation changes
four Python 2 print statements to calls and two `OneHotEncoder(sparse=False)`
arguments to `sparse_output=False`. Both prepared source hashes are pinned too.
The two NumPy model arrays, upstream README and GPL v3-or-later licence are copied
byte-for-byte. `preparation.json` records all six before/after identities. This
repository distributes the preparation tool, not third-party model files.

The project Python environment supplies NumPy, SciPy, scikit-learn and Biopython.
Use scikit-learn with `sparse_output` support (the project requires >=1.5). Do not
change an unrelated environment to run the smoke check.

## Native-sequence runtime and coordinate smoke check

Run from the repository root after preparing the model and fetching the pinned
UTEX genome via the existing genome-input contract. This explicitly tests only
bases 1–250 of `NZ_CP006471.1`. It exercises 91 candidate start positions on each
strand, without selecting a score threshold or claiming accuracy.

```sh
.venv/bin/python - <<'PY'
import gzip
import hashlib
import json
from pathlib import Path
import sys

from Bio import SeqIO
from Bio.Seq import Seq
import math

model = Path('.playwright-cli/regulatory-promoter/prepared').resolve()
manifest = json.loads((model / 'preparation.json').read_text())
for item in manifest['files']:
    assert hashlib.sha256((model / item['name']).read_bytes()).hexdigest() == item['prepared_sha256']
sys.path.insert(0, str(model))
from Promoter_Calculator_v1_0 import Promoter_Calculator

fasta = Path('data/raw/GCF_000817325.1_ASM81732v1_genomic.fna.gz')
assert hashlib.sha256(fasta.read_bytes()).hexdigest() == '22a2b07881c1099c32454778de0e90b1c40f74f44c0f59e000507106c0deb567'
with gzip.open(fasta, 'rt') as handle:
    records = list(SeqIO.parse(handle, 'fasta'))
assert [(record.id, len(record.seq)) for record in records] == [
    ('NZ_CP006471.1', 2690418), ('NZ_CP006472.1', 46366), ('NZ_CP006473.1', 7842),
]
native = str(records[0].seq[:250])
calc = Promoter_Calculator()
counts = {}
for strand in ('+', '-'):
    oriented = native if strand == '+' else str(Seq(native).reverse_complement())
    states, _ = calc.predict(oriented, [80, 171])
    assert set(states) == set(range(80, 171))
    for index, state in states.items():
        assert state['TSS'] == index
        assert all(math.isfinite(float(state[key])) for key in ('dG_total', 'Tx_rate'))
        assert oriented[index:index + 20] == state['ITR']
        for feature in ('UP', 'hex35', 'spacer', 'hex10', 'disc'):
            start, end = state[feature + '_position']
            low, high = (start + 1, end) if strand == '+' else (251 - end, 250 - start)
            sequence = native[low - 1:high]
            if strand == '-':
                sequence = str(Seq(sequence).reverse_complement())
            assert sequence == state[feature]
        tss = index + 1 if strand == '+' else 250 - index
        base = native[tss - 1]
        if strand == '-':
            base = str(Seq(base).complement())
        assert base == state['ITR'][0]
    counts[strand] = len(states)
print(json.dumps({'native_window': [1, 250], 'states': counts, 'runtime_and_coordinates': 'pass'}))
PY
```

`predict()` takes transcription-oriented sequence and zero-based start indices;
its range end is exclusive. Component positions are zero-based half-open on that
oriented sequence. Convert a component `[a,b)` in a native window starting at
one-based `w` with length `L` to `[w+a,w+b-1]` on `+`, or
`[w+L-b,w+L-a-1]` on `-`. The corresponding start base is `w+i` or `w+L-1-i`.
Use `predict()` on each oriented strand explicitly: `run()` remaps reverse output
keys but leaves the component positions and inner `TSS` in their oriented frame.
Its reverse keys use `L-i`, while its forward keys use `i`: those keys differ
in coordinate basis by one. Mixing those fields silently mixes conventions.

Full model coverage requires `67 <= i <= L-20`. Starts below index 58 or beyond
`L-20` have no output; indices 58–66 consider fewer than all 30 spacer/discriminator
layouts. Tiled windows must overlap enough to score each retained start with all
layouts, or record partial coverage explicitly. Moving the same genomic start
near a window edge can change its score without any sequence change.

## Interpretation and further evaluation

A successful smoke check establishes executable software and checked sequence
slices. It does not establish parity with a historical Python 2 execution, a
whole-genome benchmark, complete circular-origin coverage, measured promoter
boundaries, or calibrated UTEX transcription rates. The model's reported
`Tx_rate` remains an E. coli model output, not a UTEX assay value.

Before any genome-wide layer, specify native windows, boundary handling, candidate
selection, independent Tan-TSS localization checks and matched controls. Keep
homologous/overlapping loci together when partitioning evaluation data. Do not fit
thresholds on the same sites reported as evaluation. Source and computed evidence
retain the separate origin contract in [regulatory-methods.md](regulatory-methods.md).

## Native gTSS localization pilot

`tools/regulatory_promoter.py` verifies the pinned genome, the admitted Tan gTSS
table, and all six prepared model files before execution. It selects windows
before scoring using the SHA-256 order of `seed:tss_id`, excludes repeated
loci, physically overlapping windows (on either strand, including the circular
origin), and identical/reverse-complement windows. These exclusions reduce
correlated observations; they do not prove absence of divergent homology.
There is no UTEX training, threshold fitting or model selection in this pilot.
The `locus` field retains Tan's source locus tag for grouping; it does not imply
a join to the current CDS annotation or a per-gene abundance measurement.

```sh
.venv/bin/python tools/regulatory_promoter.py \
  --fasta data/raw/GCF_000817325.1_ASM81732v1_genomic.fna.gz \
  --tss data/expression/tan2018_utex2973_tss_table_s1.tsv \
  --prepared .playwright-cli/regulatory-promoter/prepared \
  --output .playwright-cli/regulatory-promoter/native-pilot \
  --max-sites 128 --seed 2973
```

Use a fresh output directory with an existing parent. `--max-sites 2475` lets
all eligible nonoverlapping, distinct-locus windows enter; it still evaluates
only the selected measured-anchor neighborhoods, not an unbiased genome-wide
scan. The exact eligible and excluded denominators are recorded. Failed runs
remove only their newly created output directory; cleanup failures retain the
original error and name the remaining path.

Each input contains 87 bases before the TSS, the TSS base, and 40 bases after it,
in transcription orientation. Score all 41 candidate starts from −20 through
+20 relative to that anchor, each with all 30 spacer/discriminator layouts.
All component sequences and intervals are checked against their input; every
candidate has full model context. Preserve the one-based native position of
every window base, including circular wrap and minus-strand orientation.
The model host is explicitly E. coli K-12 MG1655.

Pair each window with one deterministic mononucleotide shuffle that preserves
length and base counts, but not dinucleotide/trinucleotide frequencies. Control
positions refer to the synthetic sequence; they are never native coordinates.
The output records sequences, hashes, per-start energy/rate curves, all tied
optima, and the known anchor's best/worst energy rank. The fixed ±5-nt
localization summary reports both any and all tied optima within that radius.
The optimum minimizes `dG_total` (maximizes the model rate). Best-offset sets
and both ranks use an absolute energy tolerance of `1e-12`, with zero relative
tolerance, so binary roundoff does not break decimal-parameter ties. Raw scores
remain unchanged, and the tolerance is recorded in the report. Ties are never
broken toward the known TSS. This radius is a descriptive check,
not a fitted calling threshold. Model rates retain their E. coli identity;
neither scores nor localization counts are UTEX transcription measurements,
regulatory probabilities, biological false-positive rates or whole-genome
accuracy estimates. Missing and unassayed sites are not negatives.

The native source table is SHA-256
`d06524cf492aa8f009bf004c596a5d305ac54acbe7537ec98bbc7992ce164bff`.
[LaFleur et al. 2022](https://www.ebi.ac.uk/europepmc/webservices/rest/PMC9440211/fullTextXML)
describes three in-vivo test datasets measured “inside E. coli cells” and a
fourth, in-vitro RNAP/σ70 transcription dataset (Results). The cellular phrase
and “the three in vivo datasets” were matched in retrieved XML on 2026-10-14,
SHA-256 `b0418e683a6fd23906dc3e8329ef74dd166298aab39c64b54ec1f96428b2d625`.
This supports the model-host caveat, not cross-host calibration.
The upstream constructor's `sigmaLevels` dictionary is unused by `predict()`;
this pilot does not describe it as an applied sigma weighting.

## Automated verification

Offline tests use small synthetic source files to exercise validation, adaptation
and failure cleanup. Run the opt-in integration test against the actual pinned
upstream downloads when changing the preparation or dependency environment:

```sh
PROMOTER_CALCULATOR_SOURCE_DIR="$PWD/.playwright-cli/regulatory-promoter/source" \
  .venv/bin/python -m pytest -q tests/test_prepare_promoter_calculator.py
```

Without that variable the external-artifact integration test is explicitly
skipped; the other tests run without downloads. The integration test checks the
real pins and runs both orientations of a synthetic input in a separate process.
The native-window smoke above supplies the separate native-coordinate check.

Run the pilot's synthetic failure/coordinate tests and its real eight-anchor
check with the pinned prepared model and native FASTA available:

```sh
PROMOTER_CALCULATOR_PREPARED_DIR="$PWD/.playwright-cli/regulatory-promoter/prepared" \
REGULATORY_FASTA="$PWD/data/raw/GCF_000817325.1_ASM81732v1_genomic.fna.gz" \
  .venv/bin/python -m pytest -q tests/test_regulatory_promoter.py
```

The actual-artifact check is explicitly skipped when either environment variable
is absent. Offline tests cover both strands, circular-origin windows, cohort
selection, input/model pins, full-state coverage, ties, control provenance and
failure/interruption cleanup. No upstream model files are distributed here.

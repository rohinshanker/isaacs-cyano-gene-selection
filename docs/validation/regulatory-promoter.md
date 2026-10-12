# Promoter Calculator compatibility evaluation

This prepares the public v1.0 model for local Python 3 evaluation. It does not
calibrate the model for UTEX, predict a complete regulatory-site layer, or publish
scores. The model uses E. coli calibration constants; an unrecognized organism
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

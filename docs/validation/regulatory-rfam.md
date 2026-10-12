# Rfam/Infernal regulatory-family pilot on the native UTEX assembly

A reproducible single-family covariance-model search: Rfam 15.1 `RF01116`
(`Yfr1`, "Cyanobacterial functional RNA 1") against the pinned UTEX 2973
assembly `GCF_000817325.1_ASM81732v1`, with a deterministic shuffled-background
control. `tools/regulatory_rfam.py` runs it, `tests/test_regulatory_rfam.py`
pins its behaviour.

This is a **method pilot**, not a published layer. Nothing here admits a new
annotation source, publishes a browser marker, or changes the selected-method
boundaries in [regulatory-methods.md](regulatory-methods.md). It complements
the existing Infernal context in
[trna-annotation-validation.md](trna-annotation-validation.md), which runs a
different tool over the same genome.

## What a hit from this pilot is, and is not

- **Exploratory computed evidence.** A curated covariance model matched native
  sequence above that family's Rfam gathering (GA) bit score. That is homology
  to a structured RNA family.
- **Not measured regulation.** No transcription, no RNA abundance, no
  interaction and no phenotype is observed here. A family match does not
  demonstrate regulatory action in UTEX 2973.
- **Not a calibrated probability.** The bit score and the E-value describe the
  model fit and the search space. Neither is a probability that the interval is
  a functional regulatory element in this organism.
- **Not comprehensive detection.** Exactly one family is searched. A position
  with no hit is *uncovered by this pilot*, not a negative. Elements unrelated
  to the pinned family are invisible to it by construction.
- **Searched is not discovered.** A searched region without a hit produced no
  match at or above the GA threshold under cmsearch's filter pipeline. That
  does not establish that no element of the family is there.
- **Not a donor coordinate.** Every reported interval is a native coordinate on
  the pinned assembly, computed from native sequence. No interval is transferred
  from another strain, and the tool has no mechanism to do so.
- **Record origin is `computed`.** Under
  [regulatory-methods.md](regulatory-methods.md), a fresh Infernal search using
  a library model is a computed record even though the model came from a
  library. The report states `"recordOrigin": "computed"` in its own payload.

The shuffled control estimates a null hit rate for composition-matched
sequence. Shuffled sequence is **not a proven biological negative**, so the
control bounds a null rate, never a biological false-positive rate.

## Pinned identity contract

The command line runs only on these exact inputs. `PINNED` in the tool holds
them; `run_pilot` and `main` cannot be given others. Every check below passes
**before** the work directory is created or anything is written, and a
mismatch refuses the run with every failing value listed.

| What | Pinned value | Checked as |
| --- | --- | --- |
| Covariance model | Rfam 15.1 `RF01116.cm` from `cmfetch` | SHA-256 `4abf1d7ce88d4d81bd4e680358a9b1de65999126eab03577341be231ee38e8fc`, then header `ACC RF01116`, `NAME Yfr1`, `CLEN 59`, `W 86`, `GA 38.00` |
| Genome FASTA | `GCF_000817325.1_ASM81732v1_genomic.fna.gz`, compressed, as NCBI serves it | SHA-256 `22a2b07881c1099c32454778de0e90b1c40f74f44c0f59e000507106c0deb567` and MD5 `610ceb15a9859046e143d80915d4c984` (NCBI `md5checksums.txt`) |
| Genome flat file | `GCF_000817325.1_ASM81732v1_genomic.gbff.gz`, read for topology only | SHA-256 `331ef3bd7c0e9ec2fc3140dd200d2a89109ded72babe4102d0fe4aa361401e56` and MD5 `fc86ce730ae02cc1cbad14129d50cd45` |
| Replicon set | in this order | `NZ_CP006471.1` 2,690,418 circular; `NZ_CP006472.1` 46,366 circular; `NZ_CP006473.1` 7,842 circular |
| Searched FASTA | decompressed copy the tool writes for cmsearch | SHA-256 `4716bbf61cfeb296587c94e90e6b6ce037752f9b9d4d225addd15eea02124984`, the value [trna-annotation-validation.md](trna-annotation-validation.md) records, computed in memory before it is written |
| Infernal | `cmsearch` version banner | exactly `1.1.5 (Sep 2023)`; the executable's own SHA-256 is recorded, not pinned, since conda builds differ |

The decompressed `.fna` is refused: the pin is the compressed file NCBI's
manifest describes. A one-base change to a same-named replicon, a model with
one altered coefficient, another assembly and another Infernal version are
each refused by a test.

Topology comes from the flat file rather than an assumption: the `LOCUS` line
carries `circular`/`linear` but an unversioned name, so the tool pairs it with
the same record's `VERSION` line to get the versioned accession the FASTA and
every coordinate in this repository use.

Synthetic fixtures run through the private `_run_pilot` with pins computed from
the fixture files. Those reports name the fixture in their evidence boundary,
because the boundary text is built from the pins, never from a constant.

## Source receipts

Official EBI FTP release directory and the official Rfam documentation source,
plain HTTPS, no account, no access challenge. Each quotation is matched
mechanically against the retrieved bytes after collapsing whitespace runs.

| Id | Source | Located quotation | Raw SHA-256 |
| --- | --- | --- | --- |
| R1 | [Rfam 15.1 `README`](https://ftp.ebi.ac.uk/pub/databases/Rfam/15.1/README) | §1 Introduction: "Rfam 15.1 contains 4227 families" | `3644c076ee3420a6b37bd8f7b8759dff408eea64067e4973ac5e0d54ec72a807` |
| R2 | [Rfam 15.1 `COPYING`](https://ftp.ebi.ac.uk/pub/databases/Rfam/15.1/COPYING) | "Rfam is freely available under the Creative Commons Zero ("CC0") licence." | `4366e90e0da3df45363e4c1d1bba140b3036ff3f78967f1b5f9ba23685b889d5` |
| R3 | [Rfam genome-annotation documentation source](https://raw.githubusercontent.com/Rfam/rfam-docs/master/docs/source/genome-annotation.rst) | `--cut_ga`: "specifies that the special Rfam GA (gathering) thresholds be used to determine which hits are reported." | `96c1d7ea64650381292733cff2457c289abb7c8161faa98bada76f0d601e1ee2` |
| R4 | same file as R3 | step 4: "Because we want millions of nucleotides on both strands, we multiply this by 2, and divide by 1,000,000" | `96c1d7ea64650381292733cff2457c289abb7c8161faa98bada76f0d601e1ee2` |
| R5 | `RF01116.cm`, extracted from [Rfam 15.1 `Rfam.cm.gz`](https://ftp.ebi.ac.uk/pub/databases/Rfam/15.1/Rfam.cm.gz) | header lines: "ACC RF01116", "DESC Cyanobacterial functional RNA 1", "GA 38.00", "INFERNAL1/a [1.1.5 \| Sep 2023]" | `4abf1d7ce88d4d81bd4e680358a9b1de65999126eab03577341be231ee38e8fc` |

`Rfam.cm.gz` is 45,753,387 bytes, SHA-256
`e2e636e9ce138dae506769aa74d067ce35466e94002818cfe125ea2a3cab8168`; decompressed
`Rfam.cm` is SHA-256
`1378dd5927b4991d32956920f7b7bb1906bd04428b44ec6b2d8ae7c4895fba6d`. R3 is the same
bytes as receipt S6 of the regulatory-methods shortlist.

**Terms.** R2 is the source's own statement of its terms, quoted. It is not a
licence or permission decision for this project; that stays with the
[source ledger](source-ledger.md) and the owner. No third-party model or
executable is committed either way: the runbook fetches them.

R4 is the source of the `-Z` value; R3 of `--cut_ga`. The same document states
`--rfam` runs "the same mode used for Rfam annotation and determination of GA
thresholds" and `--nohmmonly` keeps those "GA cutoffs, which were determined in
CM mode for each model" valid, so the tool pins all three flags together.

## Tool and arguments

Infernal **1.1.5 (Sep 2023)** from the user-owned read-only conda environment
already recorded for the tRNA validation:
`/opt/miniconda3/envs/trna-validate/bin/cmsearch`. Nothing is installed and no
shared state is changed.

```
cmsearch -Z 5.489252 --cut_ga --rfam --nohmmonly \
  --tblout native.tblout -o native.cmsearch \
  <absolute path>/RF01116.cm native.fna
```

- cmsearch runs **inside the work directory** and run files are named relative
  to it, so the recorded argument vector does not depend on where the work
  directory is and two runs produce byte-identical reports.
- `-Z 5.489252` — 2,744,626 residues x 2 strands / 1,000,000, per R4. Computed
  from the input, never accepted as a flag.
- `--cut_ga --rfam --nohmmonly` — per R3.
- **Both strands.** cmsearch searches both by default; the tool never passes
  `--toponly` or `--bottomonly` and a test asserts their absence.
- **No truncation suppression.** `--notrunc` is not passed, so cmsearch's
  truncation state reaches the report.

## Search coverage contract

The native search covers **every replicon of the pinned FASTA end to end, on
both strands** — the chromosome and both plasmids, not the first record. That
is checked against cmsearch's own pipeline summary in its main output, not
assumed: every search (native, junction, each control replicate) must report
exactly one query model, as many target sequences as were submitted, twice the
submitted residue count (both strands), and as many hits as its tabular file
holds. A run that covered fewer sequences or residues is refused. For the
pinned assembly the native summary must read 3 target sequences and 5,489,252
residues searched.

The report's `searchCoverage` block lists, per replicon, the searched interval
`[1, length]`, the strands, and whether its origin junction was searched or
why not. Its statement carries the searched-not-discovered boundary, and
`shuffledControl` states that the control is linear only.

## Coordinates and preserved metadata

Every reported interval is **one-based inclusive on the native pinned
assembly**, with strand. Alongside it each row keeps what cmsearch actually
emitted: `search_target`, the sequence searched, and `raw_seq_from` /
`raw_seq_to`, the endpoints on that sequence — high-to-low on the minus strand.
For a linear hit the target is the replicon and the raw endpoints are native;
for an origin-spanning hit the target is the junction sequence and the raw
endpoints are junction coordinates, never overwritten by the remapped native
ones. The parser rejects a plus-strand row whose endpoints descend and a
minus-strand row whose endpoints ascend.

Each hit also carries the model interval (`mdl_from`/`mdl_to`), `trunc`,
pipeline `pass`, `gc`, `bias`, `score`, `evalue` and cmsearch's `inc` flag.

Overlaps are computed over **all** reported hits, linear and origin-spanning,
on each replicon's native circle: a wrapped interval is unwrapped with the
replicon's length. Each overlap is an index pair with the shared native
`intervals` (a run that crosses the origin is one wrapped interval) and
`sharedBases`; strand is ignored.

**Nothing is filtered.** Every data row cmsearch emits under `--cut_ga` reaches
the report. No E-value ceiling, score floor, length window or other invented
biological threshold is applied.

### Integrity checks that refuse the run

Any failure refuses the whole report:

- the hit's query name and accession are the pinned model's;
- the target is a sequence of the pinned assembly (or, for the junction search,
  a junction sequence of it);
- the interval lies inside that sequence;
- the model interval lies inside `1..CLEN` and ascends;
- the score is at or above the family GA threshold;
- no two rows report the identical sequence, strand and endpoints.

The same checker runs over the native search, the origin-junction search
(before any coordinate is remapped) and every control replicate. A model file
holding more than one model is refused on sight.

## The circular origin boundary

All three replicons are circular, and a linear FASTA search cannot report an
element that crosses position 1. For each circular replicon the tool builds a
junction sequence from the last `W - 1` and first `W - 1` bases (85 + 85 = 170
for this model) and searches it with the identical model, flags and `-Z`. Every
origin-crossing interval up to the model's `W` is therefore **presented to the
model**; whether one is reported depends on the same filter pipeline and GA
threshold as the linear search. Zero junction hits is searched coverage, not
proof that no family element crosses an origin.

Only junction hits that actually cross position 1 are kept; the rest are what
the linear search already reported, counted as `alreadyFoundByLinearSearch`.
An origin-spanning hit is remapped to native circular coordinates and reported
with `native_start > native_end` — **the wrap is the coordinate, not an
error** — with `origin_spanning` true and `search_space` `origin_junction`. A
linear replicon, or one shorter than the junction window, is skipped with its
reason recorded.

Two real-tool tests rotate the pinned chromosome (through the private runner;
the production command refuses a rotated genome, which both assert). Rotated so
the known hit straddles position 1 at its midpoint, the linear search reports
nothing and the junction search reports the hit at junction `55..117`, remapped
to native `2690388..32` with the same 63 bases, full-length model interval and
62.1 bits. Rotated so the hit starts at the last base, the linear search
reports a 5'-truncated 55.3-bit hit at `1..62` and the junction search the
complete 62.1-bit wrap `2690418..62`; both are kept and reported as one overlap
of 62 bases.

## The control

Each replicate shuffles every replicon's bases with a fixed string seed
(`<seed>:<replicate>:<accession>`), writes them under their own ids
(`<accession>_shuffled_<replicate>`), and searches that FASTA with the identical
model, flags and `-Z`. The report records each replicate's seed keys, the id to
source-replicon map, the shuffled FASTA's SHA-256 and cmsearch's own summary.

A control hit row has **no** `replicon`, `native_start` or `native_end`: its
`shuffled_start`/`shuffled_end` are positions in a permuted sequence, its
`coordinate_basis` names the replicate and says these are not native positions,
and `source_replicon` is provenance only. A control hit naming a native
accession is refused. Control hits never enter the hit table or the TSV.

This is a **mononucleotide** shuffle: it preserves each replicon's length and
composition, not dinucleotide frequency or structural propensity, so its hit
rate is a null rate under matched composition only — not a biological
false-positive rate and not a false-discovery rate for the native hits. The
control is also **linear only**: it has no origin-junction search, so it covers
less than the native search and its count is not directly comparable. A zero
control count does not convert a native hit into measured regulation.

## Output safety contract

- **Nothing is replaced or reused.** There is no `--overwrite`. The work
  directory and both reports must not exist — not even as a dangling symlink —
  and the work directory is created fresh, so earlier raw evidence is never
  clobbered.
- **Distinct artifacts.** After resolving symlinks and case-folding (the
  default macOS filesystem ignores case), no two of the model, FASTA, flat
  file, `cmsearch`, work directory and reports may be the same path or nested
  in one another. A file where a parent directory belongs is refused.
- **Preflight writes nothing.** All of the above runs before the identity
  checks, which run before the work directory is created.
- **Exclusive creation.** Every FASTA the tool writes and both reports are
  opened with exclusive create, so a path that appears after preflight is
  refused, not replaced; cmsearch writes its own outputs only inside the fresh
  work directory. If the report pair cannot both be created, only the file this run
  created is removed; a pre-existing file is never deleted.
- **Determinism.** The report carries no timestamp and no work-directory path.
  Because cmsearch writes the date and working directory into its tabular
  trailer, the report hashes the tabular **data rows only**
  (`tbloutRowsSha256`) per search. TSV line endings are LF.

## Regression oracle

`test_real_search_finds_the_single_recorded_yfr1_locus` pins the result on the
pinned inputs with Infernal 1.1.5:

| Field | Value |
| --- | --- |
| Native hits | 1 |
| Replicon, interval, strand | `NZ_CP006471.1`, 1,364,716–1,364,778 (63 bases, one-based inclusive), `+` |
| Raw cmsearch endpoints | `seq from` 1,364,716, `seq to` 1,364,778 |
| Model interval, truncation | 1–59 of 59, `no` |
| Score / E-value | 62.1 bits (GA 38.00) / 6.7e-12 |
| Origin-spanning hits | 0 (all three junctions searched) |
| Overlapping native pairs | 0 |
| Control hits | 0 |
| cmsearch native summary | 1 model, 3 target sequences, 5,489,252 residues, 1 hit |

A changed value means the Infernal build changed (the pins refuse a changed
model or assembly). `test_real_hit_is_intergenic_in_the_pinned_annotation`
asserts that no RefSeq feature but the whole-replicon `region` overlaps the
interval — a location relative to the annotation, not evidence of
transcription, and RefSeq's silence is not a negative.

## Reproducing from official artifacts

No third-party executable or model blob is committed. Everything below is
fetched; outputs stay in ignored scratch.

```sh
# 0. Scratch. .playwright-cli/ is gitignored; verify before writing into it.
SCRATCH=.playwright-cli/regulatory-rfam
mkdir -p "$SCRATCH/source"
git check-ignore -v "$SCRATCH/source/x"      # must print a .gitignore rule

# 1. Official Rfam 15.1 release artifacts and the documentation source.
BASE=https://ftp.ebi.ac.uk/pub/databases/Rfam/15.1
curl -sSL --fail -o "$SCRATCH/source/README"  "$BASE/README"
curl -sSL --fail -o "$SCRATCH/source/COPYING" "$BASE/COPYING"
curl -sSL --fail -o "$SCRATCH/source/genome-annotation.rst" \
  https://raw.githubusercontent.com/Rfam/rfam-docs/master/docs/source/genome-annotation.rst
curl -sSL --fail -o "$SCRATCH/source/Rfam.cm.gz" "$BASE/Rfam.cm.gz"
shasum -a 256 "$SCRATCH/source/"*            # compare with the receipts above

# 2. Extract the one pinned family. cmfetch ships with Infernal.
gunzip -k "$SCRATCH/source/Rfam.cm.gz"
/opt/miniconda3/envs/trna-validate/bin/cmfetch \
  "$SCRATCH/source/Rfam.cm" RF01116 > "$SCRATCH/source/RF01116.cm"
rm "$SCRATCH/source/Rfam.cm"                 # the 314 MB library is not needed again

# 3. Pinned genome of record, verified against NCBI's own MD5 manifest.
bash tools/fetch_genome.sh data/raw

# 4. The pilot. RUN must not exist yet; the tool refuses to reuse it.
RUN="$SCRATCH/run-$(date +%Y%m%dT%H%M%S)"
.venv/bin/python tools/regulatory_rfam.py \
  --cm "$SCRATCH/source/RF01116.cm" \
  --fasta data/raw/GCF_000817325.1_ASM81732v1_genomic.fna.gz \
  --gbff data/raw/GCF_000817325.1_ASM81732v1_genomic.gbff.gz \
  --cmsearch /opt/miniconda3/envs/trna-validate/bin/cmsearch \
  --workdir "$RUN/work" \
  --json-out "$RUN/rf01116-native-utex.json" \
  --tsv-out  "$RUN/rf01116-native-utex.tsv"

# 5. Tests. The real-tool checks skip without Infernal, the fetched assembly
#    and the extracted model; everything else runs from synthetic fixtures.
.venv/bin/python -m pytest tests/test_regulatory_rfam.py -q
```

In a fresh worktree `data/raw/` holds only tracked files. Symlinking the three
pinned `GCF_000817325.1_ASM81732v1_genomic.*.gz` files from the canonical
checkout works: the pins check the bytes, not the location.

## Test coverage and its limits

`tests/test_regulatory_rfam.py` executes every line of
`tools/regulatory_rfam.py` except the `if __name__ == "__main__"` guard, which
a subprocess test runs instead (measured with a `sys.settrace` line tracer;
`coverage` is not installed in `.venv`).

A stub `cmsearch` replays canned tabular output and a pipeline summary counted
from the FASTA it is given, so the whole pipeline runs without Infernal.
Covered: both strands and their raw endpoint conventions; malformed, truncated
and no-description rows; unknown strand and truncation states; non-integral,
unparseable and non-finite `gc`/`bias`/`score`/`E-value`; wrong family
accession or name; unknown target; out-of-bounds and descending model
intervals; duplicate hits and the legitimate opposite-strand twin; zero hits;
sub-threshold hits; a multi-family library; missing tool, model, FASTA and flat
file; non-cmsearch, failing and wrong-version binaries; every pin mismatch
(model bytes and header, FASTA, flat file, replicon set and order, searched
bytes, Infernal version); a first-record-only search; junction remapping and
its skip cases; shuffle determinism; every output-safety rule above; and
byte-identical reports across work directories; preserved junction raw
endpoints; wrap/linear, wrap/wrap and two-run overlaps; and control rows that
carry no native field.

Nine real-tool tests run Infernal 1.1.5 against the pinned assembly: version
and executable hash, input pins, refusal of a one-base chromosome change and of
the decompressed FASTA, the regression oracle, the two rotated origin cases, a
reproducible two-run CLI round trip, and the annotation context. They skip
without Infernal, the fetched assembly or the extracted `RF01116.cm`.

Not established by any test: that Infernal's alignment or E-value arithmetic is
correct, that the family model suits this organism, or anything about
regulatory function. A different Infernal build can move bit scores at the
margins, as [trna-annotation-validation.md](trna-annotation-validation.md) notes
for its own run.

## Repair notes

- **Identity recorded but not enforced.** Symptom: the report claimed the pinned
  model and UTEX assembly while accepting any model, FASTA or flat file, with
  family expectations optional. Fix: `PINNED` checked at the production
  boundary before any write; synthetic data only through `_run_pilot`, whose
  reports are labelled from their own pins. Regression: the pin-mismatch tests
  and `test_production_run_pilot_refuses_synthetic_inputs`.
- **Report aliasing and overwrite.** Symptom: the JSON and TSV checks ran
  separately, so one report could replace the other, and `--overwrite` could
  replace an input or reused raw output. Fix: no overwrite option, fresh work
  directory, resolved and case-folded distinctness, exclusive creation with
  cleanup limited to this run's own files. Regression: the preflight and
  `write_report` tests.
- **Coverage claimed, not measured.** Every search is now checked against
  cmsearch's own pipeline summary, which catches first-record-only coverage.
- **Origin-spanning overlaps missed.** Overlaps were computed among linear rows
  only, so a truncated linear hit inside a wrapped junction hit reported zero
  overlaps. Fix: overlaps over all rows on the native circle. Regression:
  `test_real_truncated_linear_hit_overlaps_the_wrapped_hit`.
- **Junction raw endpoints overwritten.** Remapped native endpoints replaced
  what cmsearch emitted. Fix: `search_target` plus emitted `raw_*`, separate
  from the remapped native interval.
- **Control positions labelled native.** Control rows reused the native row
  shape and basis. Fix: own sequence ids and a control row with no native
  fields. Regression: `test_control_positions_cannot_be_read_as_native_site_calls`.

## Before any of this becomes a published layer

It is not one yet, and nothing in this document admits it. A browser layer
would need, under the existing [data contract](data-contract.md) and
[source ledger](source-ledger.md): the model version and family identity, the
native input identity, the exact parameters, the coordinate basis, the score
meaning, the computed record origin with its translucent lower-precedence
rendering, and the applicable validation. A family match would still be
labelled `exploratory prediction`, never a measured site.

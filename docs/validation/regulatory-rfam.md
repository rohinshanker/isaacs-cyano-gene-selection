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

## Source receipts

Retrieved 2026-10-12 over plain HTTPS from the official EBI FTP release
directory and the official Rfam documentation source. No account, no paywall
route and no access challenge was involved.

Rfam 15.1 is distributed under **CC0**, so redistribution is not restricted —
but no third-party model or executable blob is committed to this repository
regardless, and the runbook below fetches them instead.

| Id | Retrieved source | Located quotation | Raw SHA-256 |
| --- | --- | --- | --- |
| R1 | [Rfam 15.1 `README`](https://ftp.ebi.ac.uk/pub/databases/Rfam/15.1/README) | §1 Introduction: "Rfam 15.1 contains 4227 families" | `3644c076ee3420a6b37bd8f7b8759dff408eea64067e4973ac5e0d54ec72a807` |
| R2 | [Rfam 15.1 `COPYING`](https://ftp.ebi.ac.uk/pub/databases/Rfam/15.1/COPYING) | "Rfam is freely available under the Creative Commons Zero ("CC0") licence." | `4366e90e0da3df45363e4c1d1bba140b3036ff3f78967f1b5f9ba23685b889d5` |
| R3 | [Rfam genome-annotation documentation source](https://raw.githubusercontent.com/Rfam/rfam-docs/master/docs/source/genome-annotation.rst) | `--cut_ga`: "specifies that the special Rfam GA (gathering) thresholds be used to determine which hits are reported." | `96c1d7ea64650381292733cff2457c289abb7c8161faa98bada76f0d601e1ee2` |
| R4 | same file as R3 | step 4: "Because we want millions of nucleotides on both strands, we multiply this by 2, and divide by 1,000,000" | `96c1d7ea64650381292733cff2457c289abb7c8161faa98bada76f0d601e1ee2` |
| R5 | `RF01116.cm`, extracted from [Rfam 15.1 `Rfam.cm.gz`](https://ftp.ebi.ac.uk/pub/databases/Rfam/15.1/Rfam.cm.gz) | header lines: "ACC RF01116", "DESC Cyanobacterial functional RNA 1", "GA 38.00", "INFERNAL1/a [1.1.5 \| Sep 2023]" | `4abf1d7ce88d4d81bd4e680358a9b1de65999126eab03577341be231ee38e8fc` |

Each quotation was matched mechanically against the retrieved bytes after
collapsing runs of whitespace to single spaces; all eight matched. R3 returned
the same bytes as the hash already recorded for S6 in the regulatory-methods
shortlist, so that earlier receipt and this one agree.

R4 is the source of the `-Z` value this tool computes; R3 is the source of
`--cut_ga`. The same document states `--rfam` runs "the same mode used for Rfam
annotation and determination of GA thresholds" and `--nohmmonly` keeps those
"GA cutoffs, which were determined in CM mode for each model" valid — which is
why the tool pins all three flags together rather than `--cut_ga` alone.

### Artifact hashes

| Artifact | SHA-256 |
| --- | --- |
| `Rfam.cm.gz` (45,753,387 bytes, as downloaded) | `e2e636e9ce138dae506769aa74d067ce35466e94002818cfe125ea2a3cab8168` |
| `Rfam.cm` (decompressed library) | `1378dd5927b4991d32956920f7b7bb1906bd04428b44ec6b2d8ae7c4895fba6d` |
| `RF01116.cm` (single family, `cmfetch`) | `4abf1d7ce88d4d81bd4e680358a9b1de65999126eab03577341be231ee38e8fc` |

## Pinned inputs

| Input | Identity | Checksum |
| --- | --- | --- |
| Covariance model | Rfam 15.1 `RF01116` / `Yfr1`, `CLEN` 59, `W` 86, `GA` 38.00 | SHA-256 `4abf1d7c…38e8fc` |
| Genome FASTA | `GCF_000817325.1_ASM81732v1_genomic.fna.gz` | MD5 `610ceb15a9859046e143d80915d4c984` (NCBI manifest) |
| Genome flat file | `GCF_000817325.1_ASM81732v1_genomic.gbff.gz`, read for replicon topology only | MD5 `fc86ce730ae02cc1cbad14129d50cd45` (NCBI manifest) |
| Searched FASTA | decompressed working copy the tool writes and hashes | SHA-256 `4716bbf61cfeb296587c94e90e6b6ce037752f9b9d4d225addd15eea02124984` |

The searched copy is **byte-identical** to the official decompressed FASTA — the
same SHA-256 [trna-annotation-validation.md](trna-annotation-validation.md)
already records — because the tool rewrites it at NCBI's 80-column width with
the original headers. The assembly is the genome of record in
[genome-provenance.md](genome-provenance.md); no other assembly is accepted.

Topology comes from the flat file rather than an assumption: the `LOCUS` line
carries `circular`/`linear` but an unversioned name, so the tool pairs it with
the same record's `VERSION` line to get the versioned accession the FASTA and
every coordinate in this repository use. A sequence with no declared topology
is refused, not guessed.

| Replicon | Length | Topology |
| --- | --- | --- |
| `NZ_CP006471.1` (chromosome) | 2,690,418 | circular |
| `NZ_CP006472.1` (plasmid) | 46,366 | circular |
| `NZ_CP006473.1` (plasmid) | 7,842 | circular |

## Tool and arguments

Infernal **1.1.5 (Sep 2023)**, the user-owned read-only conda environment
already recorded for the tRNA validation:
`/opt/miniconda3/envs/trna-validate/bin/cmsearch`. Nothing was installed and no
shared state was changed. The tool reads the version banner from the executable
it is given and records it, so a swapped binary is visible in the report.

```
cmsearch -Z 5.489252 --cut_ga --rfam --nohmmonly \
  --tblout <work>/native.tblout -o <work>/native.cmsearch \
  RF01116.cm <work>/native.fna
```

- `-Z 5.489252` — 2,744,626 residues x 2 strands / 1,000,000, per R4. The tool
  computes it from the input and never accepts it as a flag, so the E-values
  always match the sequence actually searched.
- `--cut_ga --rfam --nohmmonly` — per R3: the family's own gathering threshold,
  applied in the search mode that threshold was determined in.
- **Both strands.** cmsearch searches both by default; the tool never passes
  `--toponly` or `--bottomonly` and a test asserts their absence from the
  argument vector.
- **No truncation suppression.** `--notrunc` is not passed, so cmsearch's
  truncation state reaches the report.

## Coordinates and preserved metadata

Every reported interval is **one-based inclusive on the native pinned
assembly**, with strand, plus the raw cmsearch endpoints exactly as emitted —
which run high-to-low on the minus strand. Both are kept: `native_start` /
`native_end` are the normalised ascending interval, `raw_seq_from` /
`raw_seq_to` are the raw orientation. The parser rejects a plus-strand row
whose endpoints descend and a minus-strand row whose endpoints ascend, so a
mis-oriented row cannot be silently normalised away.

Each hit also carries the model interval (`mdl_from`/`mdl_to`), `trunc`,
pipeline `pass`, `gc`, `bias`, `score`, `evalue` and cmsearch's `inc` flag.
Overlaps among native hits are computed and reported as explicit index pairs
with the shared interval; strand is deliberately ignored there, because a
plus- and a minus-strand hit on the same bases is exactly what a reader needs
to see.

**Nothing is filtered.** Every data row cmsearch emits under `--cut_ga` reaches
the report. No E-value ceiling, score floor, length window or other invented
biological threshold is applied anywhere in this tool.

### Integrity checks that refuse the run

These are not filters — any failure refuses the whole report, because it means
the run's identity or coordinates cannot be trusted:

- the hit's query name and accession are the pinned model's;
- the target is a sequence of the pinned assembly (or, for the junction search,
  a junction sequence of it);
- the interval lies inside that sequence;
- the model interval lies inside `1..CLEN` and ascends;
- the score is at or above the family GA threshold, which `--cut_ga` should
  already guarantee;
- no two rows report the identical sequence, strand and endpoints.

The same checker runs over the native search, the origin-junction search
(before any coordinate is remapped) and every control replicate.

A model file holding more than one model is refused on sight: this pilot pins
exactly one family and must not silently become a library scan.

## The circular origin boundary

All three replicons are circular, and a linear FASTA search cannot report an
element that crosses position 1. The tool covers that explicitly rather than
noting the gap: for each circular replicon it builds a junction sequence from
the last `W - 1` and first `W - 1` bases (85 + 85 = 170 bases for this model),
searches it with the identical model, flags and search space, and keeps only
hits that actually cross the junction — the rest are the hits the linear search
already reported, and their count is recorded as
`alreadyFoundByLinearSearch`.

An origin-spanning hit is remapped to native circular coordinates and reported
with `native_start > native_end`. **That wrap is the coordinate, not an
error.** `origin_spanning` is `True` on exactly those rows and the
`search_space` column reads `origin_junction`.

A replicon shorter than the junction window, or a linear one, is skipped with
its reason recorded in `skippedReplicons` — never silently dropped.

The real genome has no origin-spanning hit of this family, so a real-tool test
rotates the pinned chromosome until the recorded locus straddles position 1 and
checks the whole path end to end: the linear search then finds nothing, the
junction search finds the hit, and it remaps to the wrapped native interval
`2690388..32` with the same 63-base length, full-length model interval and 62.1
bit score.

Remaining coverage limits, stated rather than solved: one family only; a
curated-family model finds family homologues and not novel elements; and the
junction search covers intervals up to the model's own `W`, which is the
longest hit Infernal will consider for this model anyway.

## The control

Each replicate shuffles every replicon's bases with a fixed string seed
(`<seed>:<replicate>:<accession>`), writes that FASTA, and searches it with the
identical model, flags and `-Z`. The same seed always produces the same
permutation, and the report records each replicate's seed keys and the SHA-256
of the shuffled FASTA it searched.

This is a **mononucleotide** shuffle. It preserves each replicon's length and
base composition exactly, and preserves neither dinucleotide frequency nor any
structural propensity — so its hit rate is a null rate under matched
composition only. Query negatives of this kind are not proven biological
negatives, and a zero control count does not convert a native hit into measured
regulation.

## Recorded result, 2026-10-12

```
model=RF01116 (Yfr1) native_hits=1 origin_spanning=0 overlapping_pairs=0 \
  control_hits=0 over 5 replicates
```

| Field | Value |
| --- | --- |
| Replicon | `NZ_CP006471.1` (chromosome) |
| Native interval, one-based inclusive | 1,364,716–1,364,778 (63 bases) |
| Strand | `+` |
| Raw cmsearch endpoints | `seq from` 1,364,716, `seq to` 1,364,778 |
| Model interval | 1–59 of `CLEN` 59 (full-length model match) |
| Truncation | `no` |
| Score / E-value | 62.1 bits (GA 38.00) / 6.7e-12 |
| cmsearch `inc` | `!` |

- **Plasmids:** no hit on either, on either strand.
- **Origin boundary:** the 170-base junction of all three circular replicons
  returned zero hits, so no element of this family crosses an origin.
- **Overlaps:** none; the single hit overlaps no other hit.
- **Control:** 5 replicates, 15 shuffled replicon sequences, **0 hits total**.
  The native hit is 24.1 bits above the family threshold and no
  composition-matched shuffle produced any hit at all.

Annotation context, read straight from the pinned GFF and asserted by a test:
no RefSeq feature overlaps the interval except the whole-replicon `region`
record. It sits in the intergenic region between `M744_RS07005` (ends
1,364,610, `+`) and `M744_RS07010` / `trxA` (starts 1,364,916, `+`). That
locates the hit relative to the annotation. It is not evidence that the
interval is transcribed, and RefSeq's silence there is not a negative either.

## Reproducing from official artifacts

No third-party executable or model blob is committed. Everything below is
fetched; outputs stay in ignored scratch.

```sh
# 0. Scratch. .playwright-cli/ is gitignored; verify before writing into it.
SCRATCH=.playwright-cli/regulatory-rfam-20261012
mkdir -p "$SCRATCH/source" "$SCRATCH/run"
git check-ignore -v "$SCRATCH/source/x"      # must print a .gitignore rule

# 1. Official Rfam 15.1 release artifacts (CC0).
BASE=https://ftp.ebi.ac.uk/pub/databases/Rfam/15.1
curl -sSL --fail -o "$SCRATCH/source/README"  "$BASE/README"
curl -sSL --fail -o "$SCRATCH/source/COPYING" "$BASE/COPYING"
curl -sSL --fail -o "$SCRATCH/source/Rfam.cm.gz" "$BASE/Rfam.cm.gz"
shasum -a 256 "$SCRATCH/source/Rfam.cm.gz"   # e2e636e9…ab8168

# 2. Extract the one pinned family. cmfetch ships with Infernal.
gunzip -k "$SCRATCH/source/Rfam.cm.gz"
/opt/miniconda3/envs/trna-validate/bin/cmfetch \
  "$SCRATCH/source/Rfam.cm" RF01116 > "$SCRATCH/source/RF01116.cm"
shasum -a 256 "$SCRATCH/source/RF01116.cm"   # 4abf1d7c…38e8fc
rm "$SCRATCH/source/Rfam.cm"                 # the 314 MB library is not needed again

# 3. Pinned genome of record, verified against NCBI's own MD5 manifest.
bash tools/fetch_genome.sh data/raw

# 4. The pilot. Both reports land in ignored scratch.
.venv/bin/python tools/regulatory_rfam.py \
  --cm "$SCRATCH/source/RF01116.cm" \
  --expect-accession RF01116 --expect-name Yfr1 \
  --fasta data/raw/GCF_000817325.1_ASM81732v1_genomic.fna.gz \
  --gbff data/raw/GCF_000817325.1_ASM81732v1_genomic.gbff.gz \
  --workdir "$SCRATCH/run/work" \
  --cmsearch /opt/miniconda3/envs/trna-validate/bin/cmsearch \
  --json-out "$SCRATCH/run/rf01116-native-utex.json" \
  --tsv-out  "$SCRATCH/run/rf01116-native-utex.tsv"

# 5. Tests. The real-tool checks skip without Infernal, the fetched assembly
#    and the extracted model; everything else runs from synthetic fixtures.
.venv/bin/python -m pytest tests/test_regulatory_rfam.py -q
```

`--expect-accession` / `--expect-name` are optional but belong in any recorded
run: they turn a wrong `cmfetch` argument into a refusal instead of a
differently-labelled report.

### Output safety and reproducibility

- **Overwrite.** The tool refuses to replace an existing JSON or TSV report
  unless `--overwrite` is passed, and it checks this *before* running any
  search, so a refused run leaves the previous report intact and creates no
  work directory.
- **Path preflight.** A work directory or report parent blocked by a file —
  rather than a directory — is refused before anything is written.
- **Determinism.** Re-running with the same inputs and paths produces
  byte-identical JSON and TSV. The report carries no timestamp. Because
  cmsearch writes the run date, the working directory and the full option line
  into its own trailing comments, the report records a SHA-256 over the
  tabular **data rows only** (`tbloutRowsSha256`) for the native search, the
  junction search and each control replicate; the raw files themselves stay in
  the work directory.
- **TSV line endings** are LF, not `csv`'s default CRLF.

The JSON report is the full record — model identity and GA threshold, tool
version and executable, every argument vector, `-Z`, all input and output
digests, replicon lengths and topologies, junction coverage, per-replicate
control results, overlaps, counts and every hit. The TSV is the hit table
alone.

## Test coverage and its limits

`tests/test_regulatory_rfam.py` covers **every line** of
`tools/regulatory_rfam.py` (checked with `trace`; the only line not executed
in-process is the `if __name__ == "__main__"` guard, which a subprocess test
exercises instead).

A stub `cmsearch` replays canned tabular output per search, so the whole
pipeline — native search, origin junction, control replicates, report
assembly, CLI — is tested without Infernal installed. Covered cases include:
both strands and their raw endpoint conventions; malformed, truncated and
no-description rows; unknown strand and truncation states; non-integral,
unparseable and non-finite `gc`/`bias`/`score`/`E-value`; wrong family
accession, wrong family name, unknown target sequence; out-of-bounds and
descending model intervals; duplicate identical hits (and the legitimate
same-interval hit on the opposite strand); zero hits; a sub-threshold hit; a
multi-family library; missing tool, model, FASTA and flat file; a binary that
is not cmsearch and one that exits non-zero; a sequence with no declared
topology; junction remapping of a wrap, a non-crossing junction hit, a linear
replicon and a replicon shorter than the junction window; shuffle determinism
and composition preservation; blocked paths; overwrite refusal and `--overwrite`;
and byte-identical repeat runs.

Seven real-tool tests then run the actual Infernal 1.1.5 against the pinned
assembly and pin the version banner, the model header, the three circular
replicons and the `-Z` value, the recorded result above, the origin-spanning
path on a rotated copy of the chromosome, a reproducible CLI round trip, and
the intergenic annotation context recorded above. They **skip**
rather than fail when Infernal, the fetched assembly, or the extracted
`RF01116.cm` is absent — the model is a third-party blob that is deliberately
not committed, so follow step 2 above to enable them.

What the tests do **not** establish: that Infernal's own alignment or E-value
arithmetic is correct, that the family model is biologically appropriate for
this organism, or anything about regulatory function. A different Infernal
build can move bit scores at the margins, exactly as
[trna-annotation-validation.md](trna-annotation-validation.md) notes for its
own run.

## Before any of this becomes a published layer

It is not one yet, and nothing in this document admits it. A browser layer
would need, under the existing [data contract](data-contract.md) and
[source ledger](source-ledger.md): the model version and family identity, the
native input identity, the exact parameters, the coordinate basis, the score
meaning, the computed record origin with its translucent lower-precedence
rendering, and the applicable validation. A family match would still be
labelled `exploratory prediction`, never a measured site.

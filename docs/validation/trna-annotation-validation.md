# Independent tRNA annotation validation

RefSeq annotates exactly 44 tRNA genes for the pinned assembly
`GCF_000817325.1` (ASM81732v1, UTEX 2973, see
[genome-provenance.md](genome-provenance.md)). This document records an
independent rerun of tRNAscan-SE 2.0 against the same genome, the per-locus
comparison, and the result: **all 44 loci are concordant**, with one
additional low-confidence pseudogene candidate that RefSeq/PGAP did not
annotate.

Codebase already relies on these 44 loci for the tAI model
(`data/trna/anticodon_gene_copies.tsv`, `scripts/build_features.py`); see
[metric-convention-parity.md](metric-convention-parity.md) for the Ile-CAT
lysidine and inosine wobble conventions this validation also checks.

## What RefSeq's own annotation already tells you

The pinned GFF's `tRNA` features carry
`inference=COORDINATES: profile:tRNAscan-SE:2.0.12` — PGAP's tRNA calls for
this assembly **are themselves tRNAscan-SE 2.0.12 output**, just filtered and
formatted by PGAP. An independent rerun with the same tool version is
therefore not a test against an unrelated method; it is a check of whether
PGAP's coordinate/strand/isotype/anticodon transcription and pseudogene
filtering introduced any drift from a plain tRNAscan-SE 2.0 bacterial-mode
scan, and a cross-check of this repository's own GFF-parsing conventions
(`scripts/build_features.py:effective_anticodon`) against that tool's calls.
A future validation that wants a genuinely independent method should compare
against a different tool (e.g. ARAGORN) or a different tRNAscan-SE model
generation.

## Environment (pinned, reproducible)

tRNAscan-SE is not on PATH in the standard shell; it was installed into an
isolated, user-owned conda environment (no sudo, no changes to shared
Homebrew/system state):

```sh
conda create -y -n trna-validate -c bioconda -c conda-forge "trnascan-se=2.0.12"
conda activate trna-validate
tRNAscan-SE 2.0.12 (Nov 2022)   # exact version banner
```

This resolved `trnascan-se=2.0.12` (bioconda, build `pl5321hbdacb55_2`) with
`infernal=1.1.5` (bioconda, build `pl5321hd34ca47_4`) and `perl=5.32.1`. Pin
these three package/build strings when reproducing this run; a different
Infernal build can change bit scores at the margins.

## Inputs, fetched and verified against the pinned manifest

```sh
BASE="https://ftp.ncbi.nlm.nih.gov/genomes/all/GCF/000/817/325/GCF_000817325.1_ASM81732v1"
curl -sS -o data/raw/GCF_000817325.1_ASM81732v1_genomic.fna.gz "$BASE/GCF_000817325.1_ASM81732v1_genomic.fna.gz"
curl -sS -o data/raw/GCF_000817325.1_ASM81732v1_genomic.gff.gz "$BASE/GCF_000817325.1_ASM81732v1_genomic.gff.gz"
```

Both files' MD5s matched `data/manifest/annotation-release-v1.json` exactly:

| File | MD5 |
| --- | --- |
| `GCF_000817325.1_ASM81732v1_genomic.fna.gz` | `610ceb15a9859046e143d80915d4c984` |
| `GCF_000817325.1_ASM81732v1_genomic.gff.gz` | `61d1557c71a39db3f0cbf3a82ad341a5` |

SHA-256 of the decompressed genome FASTA actually scanned (tRNAscan-SE reads
plain FASTA only, so a working decompressed copy is required for this one
step — see below):

| File | SHA-256 |
| --- | --- |
| `GCF_000817325.1_ASM81732v1_genomic.fna` | `4716bbf61cfeb296587c94e90e6b6ce037752f9b9d4d225addd15eea02124984` |
| `GCF_000817325.1_ASM81732v1_genomic.gff` | `ab231b99be2617fa802227fc89f364ed368393a3d74a8b797ad4f4e8ca507ace` |

Neither the `.gz` downloads nor the decompressed copies are tracked in git
(see `data/annotation/PROVENANCE.md`: the larger core genome files stay under
the gitignored `data/raw/` and are fetched at build time); only the run
outputs and comparison below are checked in under
`data/trna/independent_run/`.

## Running tRNAscan-SE

tRNAscan-SE cannot read gzip input directly, so decompress a working copy of
the FASTA (`gunzip -k` keeps the `.gz` alongside it) before scanning:

```sh
conda activate trna-validate
gunzip -k data/raw/GCF_000817325.1_ASM81732v1_genomic.fna.gz
tRNAscan-SE -B \
  -o data/trna/independent_run/trnascan.out \
  -f data/trna/independent_run/trnascan.struct \
  -m data/trna/independent_run/trnascan.stats \
  -q --thread 4 \
  data/raw/GCF_000817325.1_ASM81732v1_genomic.fna
```

`-B` selects the bacterial covariance models (this organism is a
cyanobacterium, domain Bacteria) with isotype-specific model rescoring, the
same search mode PGAP uses for prokaryotic RefSeq annotation. This
decompression step is only needed to regenerate `trnascan.out` itself; the
comparison below, and its regression test, read the `.gz` inputs directly and
never need a decompressed copy on disk.

Result: 45 candidate tRNAs, 44 confirmed standard-decoder tRNAs and one
flagged `pseudo` (score 22.2, on a 61 bp span at `NZ_CP006471.1:2275064-2275124`,
isotype "Undet", anticodon "NNN" — no confident isotype call). No introns were
detected. `data/trna/independent_run/trnascan.out` is the checked-in tabular
result (SHA-256 `f472ae1d45e50af3ab4a6d41e4be81ef65aa425b67a24cc625bba4bc20c8e430`);
`trnascan.stats` records the full run statistics.

## Comparison

`tools/trna_validate.py` matches each of the 44 pinned RefSeq tRNA loci to a
tRNAscan-SE call by exact genomic coordinates and strand, extracts each
locus's genomic anticodon the same way `scripts/build_features.py` does, and
classifies every locus as concordant, discordant, or unresolved by comparing
isotype, anticodon, **and both sides' pseudogene flag** (a RefSeq/tRNAscan-SE
pseudogene-flag disagreement at otherwise-matching coordinates is reported as
discordant, not silently treated as a match). `--fasta`/`--gff` accept either
the `.gz` download or a decompressed copy — both parsers detect the `.gz`
suffix — so this step runs directly on what a normal fetch leaves on disk,
with no decompression required:

```sh
python3 tools/trna_validate.py \
  --fasta data/raw/GCF_000817325.1_ASM81732v1_genomic.fna.gz \
  --gff data/raw/GCF_000817325.1_ASM81732v1_genomic.gff.gz \
  --trnascan-out data/trna/independent_run/trnascan.out \
  --tsv-out data/trna/independent_run/comparison.tsv \
  --json-out data/trna/independent_run/comparison.json
```

### Result

```
concordant=44 discordant=0 unresolved=0 tRNAscan_only=1
```

All 44 RefSeq loci: same coordinates, same strand, same isotype (after
folding tRNAscan-SE's `Ile2`/`fMet` isotype-specific labels into RefSeq's
plain `Ile`/`Met` product names — a naming convention difference, not a
disagreement; see below), same raw genomic anticodon, and the pseudogene flag
agrees on both sides — RefSeq marks none of the 44 as `pseudo`, and the
independent rerun likewise confirms all 44 as non-pseudo. tRNAscan-SE's one
extra call is the `Undet`/pseudo locus above; it has no coordinate match
among the 44 RefSeq loci at all (it is a distinct, unannotated locus, not a
flag disagreement on an existing one), which is the expected outcome for a
low-score, undetermined-isotype candidate — PGAP's tRNA pipeline also filters
these. Per-locus results, including both `refseq_pseudo` and `scan_pseudo`
columns: `data/trna/independent_run/comparison.tsv`.

### Isotype-specific model naming

Bacterial-mode tRNAscan-SE reports two isotype-specific labels that RefSeq's
`product` field does not distinguish:

- `Ile2` (elongator, lysidine-modified, anticodon `CAT`) vs plain `Ile`
  (anticodons `GAT` x2). RefSeq's GFF/GenBank both say `tRNA-Ile` for all
  three; tRNAscan-SE's isotype-specific rescoring separates the lysidine
  elongator from the two standard isoleucine tRNAs. Both call three total
  `Ile`-decoding loci with anticodons `{CAT, GAT, GAT}`.
- `fMet` (initiator) vs plain `Met` (elongator), both anticodon `CAT`.
  RefSeq's product field says `tRNA-Met` for both. Both call two total
  `Met`-decoding loci with anticodon `CAT` x2.

### Ile/Met CAT and modified-base implications

- `Ile-CAT` (locus `M744_RS03080`) is lysidine-modified at wobble position 34
  and decodes `ATA`, not `ATG`. `tools/trna_validate.py` reproduces
  `effective_anticodon()`'s `("Ile", "CAT") -> "LAT"` substitution exactly and
  confirms this is the only `Ile`-isotype `CAT` anticodon in the genome, so
  the substitution cannot accidentally also catch a `Met-CAT` locus.
  Concordant with tRNAscan-SE's independent `Ile2` isotype call at the same
  coordinates.
- `Arg-ACG` (locus `M744_RS04560`) reads as inosine at wobble position 34
  (`effective_anticodon` -> `ICG`) under the same "any anticodon read A34 as
  I34" rule applied to all four-fold-degenerate ANN anticodons in this
  genome. Concordant with tRNAscan-SE.
- `Met-CAT` (initiator `M744_RS02135`, elongator `M744_RS13195`) both decode
  as plain `CAT` with no substitution; tAI excludes methionine from its
  geometric mean regardless (`meta.tai.excludedAminoAcids`), so this
  distinction does not currently affect tAI weights.

### Parity with the tracked species table

`data/trna/anticodon_gene_copies.tsv` (loaded by `verified_trna_species()` in
`scripts/build_features.py` and asserted equal to the GFF-derived table on
every pipeline build) matches the 44 RefSeq loci extracted independently by
`tools/trna_validate.py` exactly: same 40 `(amino_acid, anticodon)` species,
same per-species copy counts, totalling 44. No sensitivity recalculation of
tAI was needed because no discrepancy exists to resolve.

## Secondary structure

`trnascan.struct` (produced by the same run, `-f` output) contains a
predicted base-pairing/structure string for each of the 44 non-pseudo loci,
which is what Infernal's covariance model fit to when scoring and confirming
each candidate (the `Infernal-confirmed tRNAs: 45` / non-pseudo classification
in `trnascan.stats` already reflects that fit). **No arm-level completeness
screen was implemented or run against `.struct`**: `tools/trna_validate.py`
and its tests never parse or inspect this file, so there is no code-checked
claim here about, and no explicit criteria defined for, acceptor-stem/D-arm/
anticodon-arm/T-arm presence or an unpaired anticodon stem. What is
demonstrated is that Infernal's own covariance-model fit did not reject any
of the 44 loci as sub-threshold or pseudo; that is model-supported
plausibility, not a separate structural screen, and — per lab decision below
— not evidence of a mature, charged tRNA in vivo. A concrete arm-level screen
(with stated pass/fail criteria) is future work if the lab wants it. 3D
prediction (trRosettaRNA) was not run: ticket scope reserves it for disputed
calls, and this run produced none.

## Lab decisions applied to this validation

Settled by the lab in comments on this ticket (DEM-61); recorded here instead
of left open so this document does not re-litigate them:

- **Scope is computational plausibility only.** tRNA expression and charging
  are separate future evidence tiers; this document does not claim a
  tRNAscan-SE call or a predicted fold as mature, expressed, or charged tRNA
  evidence.
- **Published tAI is preserved unchanged**, including current genomic copy
  counts. This run found no discrepancy against `anticodon_gene_copies.tsv`
  (see Parity above), so no tAI recalculation was needed or performed.
- **Conflicting tRNA calls are reported as sensitivity scenarios pending
  review**, not auto-applied to tAI. Not triggered this run — zero discordant
  or unresolved loci — but this is the standing policy for any future rerun
  (a different tool, a different tRNAscan-SE model generation, or a revised
  assembly) that does surface a conflict.
- **3D prediction is reserved for disputed calls**, run only after secondary
  structure screening, and only if useful/feasible. Not run here: this
  validation produced no disputed calls, and no arm-level structural screen
  was performed to escalate from (see Secondary structure above).

## Reproducing this validation

```sh
conda create -y -n trna-validate -c bioconda -c conda-forge "trnascan-se=2.0.12"
conda activate trna-validate
bash tools/fetch_genome.sh data/raw   # or the curl commands above; leaves .gz files only

# Only needed to regenerate trnascan.out itself (tRNAscan-SE needs plain FASTA):
gunzip -k data/raw/GCF_000817325.1_ASM81732v1_genomic.fna.gz
tRNAscan-SE -B -o data/trna/independent_run/trnascan.out \
  -f data/trna/independent_run/trnascan.struct \
  -m data/trna/independent_run/trnascan.stats \
  -q --thread 4 data/raw/GCF_000817325.1_ASM81732v1_genomic.fna

# Comparison and tests run directly against the .gz fetch, no decompression needed:
python3 tools/trna_validate.py \
  --fasta data/raw/GCF_000817325.1_ASM81732v1_genomic.fna.gz \
  --gff data/raw/GCF_000817325.1_ASM81732v1_genomic.gff.gz \
  --trnascan-out data/trna/independent_run/trnascan.out \
  --tsv-out data/trna/independent_run/comparison.tsv \
  --json-out data/trna/independent_run/comparison.json
pytest tests/test_trna_validate.py
```

`tests/test_trna_validate.py` covers the parser/matcher logic with synthetic
fixtures (no tRNAscan-SE install required) plus one end-to-end regression
test that reruns the comparison against the checked-in
`data/trna/independent_run/trnascan.out` and the `.gz` genome/GFF, asserting
44/44 concordance (including pseudogene-flag agreement) and species-table
parity. That regression test executes after a normal `tools/fetch_genome.sh`
fetch — it only skips if `data/raw/` has not been fetched at all.

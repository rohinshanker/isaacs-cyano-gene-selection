# ISAACS Cyano Gene Selection

An interactive map of the *Synechococcus elongatus* UTEX 2973 coding genome, built to
help choose which genes to target for genome recoding.

Filter roughly 2,700 genes down to the ones worth looking at, see where each sits in
codon-usage and recoding-risk space, and build a shortlist of candidates to compare.
It is a static site, so it runs from a local file or from GitHub Pages with no server.

---

## Read this before trusting a number

Five things will bite you if you do not know them. They are here rather than buried in
the docs because each one has already caused a real error in this project.

### 1. Gene coordinates disagree with the 2017 annotation

**288 of 2,582 shared genes have different boundaries** between the annotation this
site uses and the older 2017 annotation that has circulated in the lab as `utex.gb`.

| Property | Count |
| --- | --- |
| Genes with differing coordinates | 288 of 2,582 |
| Whole-codon shifts of the start site | 284 |
| Current annotation trims the 5′ end | 214 |
| Current annotation extends the 5′ end | 72 |
| Shifts larger than 90 nt | 38 |

Both annotations describe the **same assembly** and use the **same `M744_RS#####`
locus tags**. A matching locus tag is therefore *not* evidence of a matching gene
model. The difference is nine years of NCBI annotation pipeline revisions, mostly
re-calling start codons.

**What this means for you.** If a primer, construct, guide RNA, or edit was designed
against the older annotation, check the gene's boundaries before reusing it. A changed
start codon also moves this site's 5′ folding window, its first-50-codon ramp counts,
and the CDS length, so those metrics are not comparable to numbers computed from the
old annotation.

The full comparison is in [`docs/validation/genome-provenance.md`](docs/validation/genome-provenance.md).

### 2. The expression filter is measured in a different strain

**No public per-gene expression table exists for UTEX 2973.** The threshold that hides
low-traffic genes therefore defaults to CAI and tAI, which are computed directly from
this genome.

An optional expression overlay is available, but it is measured in *S. elongatus*
**PCC 7942** in a biofilm and conditioned-media experiment with no light or CO₂
metadata recorded. It covers 2,551 of 2,715 genes. It is a rough guide, not ground
truth, and the interface labels it as such.

Eight loci are deliberately excluded from it, because four proteins are each encoded
at two loci and the identifier mapping collapses them ambiguously. Values for those
pairs differed by up to twentyfold, so assigning either would be a guess.

Genes with no measurement are **null, never zero**. Do not let a threshold silently
discard them. Full caveats: [`data/expression/PROVENANCE.md`](data/expression/PROVENANCE.md).

### 3. Never recode position zero

`codons[0]` is the initiation triplet. **471 genes start with something other than
ATG** (356 GTG, 103 TTG, 12 assorted), and every one of them translates as methionine
at position zero. A substitution there that the codon table calls synonymous is not
synonymous in effect. The site excludes index zero from target matching.

### 4. Stop codons are carried separately, and TAG is the common one

The packed codon string omits each gene's terminal stop, which is carried in its own
`terminalStop` field. Any scheme touching a stop codon must read that field.

| Terminal stop | Genes |
| --- | --- |
| TAG | 1,071 |
| TAA | 895 |
| TGA | 749 |

Amber reassignment therefore touches 1,071 of 2,715 genes, more than in many bacteria.
An earlier version of this project dropped the stop entirely, which would have reported
zero burden for every gene under an amber scheme.

### 5. Two genes behave unusually

- **`M744_RS00920` (`prfB`)** uses a programmed ribosomal frameshift. Its coding
  sequence is a join of two segments skipping one base, so its coding length is shorter
  than its genomic span. Recoding near the slippage site risks breaking translation of
  release factor 2. The site flags it.
- **tRNA-Ile with a CAT anticodon** is the lysidine-modified tRNA-Ile2 and decodes
  **ATA**, not ATG. Treated naively, ATA appears to have no tRNA support genome-wide
  and every tAI-derived metric distorts. The pipeline handles this explicitly.

---

## How a recoding scheme works here

Schemes are a **runtime input**, not baked into the data. Each gene ships with its
coding sequence packed one character per codon, and any metric that depends on which
codons are targets is computed in your browser. Changing targets is a click, not a
pipeline rerun.

A scheme is a **codon-to-codon map**, not a list of forbidden codons. Knowing that
`TCG` becomes `AGC`, rather than only that `TCG` is banned, is what lets the page
reconstruct the recoded gene and compare it against wild type. Replacements prefill
from genome-wide synonymous frequency and stay editable.

**Burden denominators.** `lengthCodons` counts sense codons and excludes the stop.
Target fraction and targets per kb use that denominator. A reassigned terminal stop
counts toward the total and the edit count, but never toward local-density windows or
cluster statistics.

RNA folding is the one exception to live computation. Folding cannot run genome-wide in
a browser, so wild-type folding energy is precomputed and recoded folding is available
on demand for shortlisted genes only.

---

## Genome of record

RefSeq **`GCF_000817325.1`** (ASM81732v1), taxid 1350461, 2,744,626 bp across one
chromosome and two plasmids.

The sequence dates from 2015; the annotation is release `GCF_000817325.1-RS_2026_05_13`
from PGAP 6.11. Applying the inclusion rule gives **2,715 analysable genes** from 2,722
CDS records, with all 7 exclusions recorded individually.

**A trap worth knowing.** `GCF_000817745.x` differs by three digits and is
*Aphanocapsa montana*, a completely different organism. Never take the accession from
memory. `tools/fetch_genome.sh` pins it, verifies every checksum, and separately checks
the organism name, because a passing checksum proves an intact download and not a
correct assembly.

---

## Layout

| Path | Contents |
| --- | --- |
| `site/` | The published static site. This is what GitHub Pages serves. |
| `site/data/` | Generated JSON the page loads. Do not hand-edit. |
| `scripts/` | Python pipeline that builds `site/data/` from the genome. |
| `tools/validate_contract.py` | Independent check that generated data honours the contract. |
| `tools/fetch_genome.sh` | Pinned, checksum-verified genome download. |
| `data/raw/` | Downloaded genome files, gitignored. |
| `data/expression/` | Expression overlay and its provenance. |
| `data/trna/` | Verified anticodon table, including the lysidine case. |
| `docs/validation/` | The data contract and the genome runbook. |

## Rebuilding

```sh
python3 -m venv .venv
./.venv/bin/python -m pip install -r requirements.txt
./tools/fetch_genome.sh data/raw
./.venv/bin/python scripts/build_features.py
./.venv/bin/python tools/validate_contract.py
```

The validator is deliberately independent of the pipeline. It re-derives the codon
decoding, the full-CDS round trip, and the gene reconciliation from the raw genome
rather than trusting the pipeline's assertions, so a bug mirrored in the pipeline's own
tests still fails here. **Treat a validator failure as blocking.**

## Deploying

Pushing to `main` publishes `site/` through `.github/workflows/pages.yml`. Deployment
is gated: the genome is fetched and checksummed, the organism is verified, the contract
validator must pass, and the test suite must pass. Enable Pages for the repository with
"GitHub Actions" as the source.

## Contract

[`docs/validation/data-contract.md`](docs/validation/data-contract.md) is the frozen
interface between the pipeline and the page. It specifies every field, the codon
packing alphabet, which metrics are precomputed versus computed live, and the gene
inclusion rule. Change it and both sides together, never one alone.

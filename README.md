# ISAACS Cyano Gene Selection

An interactive map of the *Synechococcus elongatus* UTEX 2973 coding genome, built
to help choose which genes to target for genome recoding.

The page lets you filter roughly 2,700 genes down to the ones worth looking at,
see where each sits in codon-usage and recoding-risk space, and build a shortlist
of candidates to compare side by side. It is a static site, so it works from a
local file or from GitHub Pages with no server.

## The central idea: schemes are a runtime input

Most of the interesting questions here depend on **which codons you plan to
eliminate**, and that changes often. So the site does not bake a recoding scheme
into its data.

Each gene ships with its coding sequence packed as one character per codon. Any
metric that depends on the scheme is computed in your browser by scanning that
string. Changing the target codons is a click, not a pipeline rerun.

A scheme is a **codon-to-codon map**, not a list of forbidden codons. Knowing that
`TCG` becomes `AGC`, rather than just that `TCG` is banned, is what makes it
possible to reconstruct the recoded gene and compare it against wild type. That is
where the perturbation metrics come from.

The one exception is RNA folding energy, which is too expensive to run
genome-wide in a browser. Wild-type folding is precomputed for every gene.

## Genome

RefSeq `GCF_000817325.1` (ASM81732v1), taxid 1350461, 2,744,626 bp across one
chromosome and two plasmids. Every downloaded file is verified against NCBI
checksums, and the assembly identity is checked against the organism name, not
just the accession.

Applying the inclusion rule gives **2,715 analysable genes** from 2,722 CDS
records, with the 7 exclusions recorded individually.

If you ever need to re-download or re-verify the genome, follow
[`docs/validation/genome-provenance.md`](docs/validation/genome-provenance.md).
It also documents a wrong-accession trap worth knowing about: `GCF_000817745.x`
differs by three digits and is a completely different organism.

## Read this before trusting the expression filter

The threshold that hides low-traffic genes defaults to codon-adaptation measures
computed from this genome, because **no public per-gene expression table exists
for UTEX 2973 itself**.

An optional expression overlay is included, but it is measured in *S. elongatus*
PCC 7942, a different strain, in a biofilm experiment. It covers 94 percent of
genes. It is useful as a rough guide and misleading if treated as ground truth.
The full caveats are in
[`data/expression/PROVENANCE.md`](data/expression/PROVENANCE.md).

To swap in real UTEX 2973 data, drop a three-column `locus_tag`, `abundance`,
`source_gene_id` table into `data/expression/` and rebuild. Nothing downstream is
hardcoded to the current dataset.

## Layout

| Path | Contents |
| --- | --- |
| `site/` | The published static site. This is what GitHub Pages serves. |
| `site/data/` | Generated JSON the page loads. Do not hand-edit. |
| `scripts/` | The Python pipeline that builds `site/data/` from the genome. |
| `tools/validate_contract.py` | Independent check that generated data honours the contract. |
| `data/raw/` | Downloaded genome files, gitignored. |
| `data/expression/` | Expression overlay and its provenance. |
| `docs/validation/` | The data contract and the genome runbook. |

## Rebuilding

```sh
python3 -m venv .venv
./.venv/bin/python -m pip install -r requirements.txt
./.venv/bin/python scripts/build_features.py
./.venv/bin/python tools/validate_contract.py
```

The validator is deliberately independent of the pipeline. It re-derives the codon
decoding and the gene reconciliation from the raw genome rather than trusting the
pipeline's own assertions, so a bug mirrored in the pipeline's tests still fails
here. Treat a validator failure as blocking.

## Deploying

Pushing to `main` publishes `site/` via the workflow in `.github/workflows/`.
Enable Pages for the repository with "GitHub Actions" as the source.

## Contract

[`docs/validation/data-contract.md`](docs/validation/data-contract.md) is the
frozen interface between the pipeline and the page. It specifies every field, the
codon packing alphabet, which metrics are precomputed versus computed live, and
the gene inclusion rule. Change it and both sides together, never one alone.

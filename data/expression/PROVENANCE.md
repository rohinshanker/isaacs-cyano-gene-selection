# Expression data provenance and caveats

**Read this before using the expression axis for anything that matters.**

## What this file is

`GSE205444_pcc7942_wt_bg11_day1.tsv` holds a per-gene transcript abundance value
for 2,551 of the 2,715 UTEX 2973 protein-coding genes, or 93.96 percent.

| Field | Value |
| --- | --- |
| GEO accession | GSE205444 |
| BioProject | PRJNA845529 |
| Publication | Simkovsky et al., 2022, PMID 35814646 |
| **Organism actually measured** | ***S. elongatus* PCC 7942, not UTEX 2973** |
| Assay | RNA-seq, Illumina HiSeq 2000 |
| Samples used | WT, fresh BG-11, day 1, three replicates, arithmetic mean |
| Normalization | DESeq2 normalized counts, as published |
| Retrieved | 2026-09-18 |
| Source | `https://ftp.ncbi.nlm.nih.gov/geo/series/GSE205nnn/GSE205444/suppl/GSE205444_DESeq2_Normalized_Counts.txt.gz` |
| Licence | GEO/NCBI public repository terms. No dataset-specific licence was located. |

## Why it is not the default threshold

Four independent reasons, any one of which would be enough:

1. **Wrong organism.** This is PCC 7942. UTEX 2973 is a closely related but
   distinct fast-growing strain, and the two differ in exactly the growth
   physiology that drives expression.
2. **Unusual biology.** The experiment studies biofilm formation and conditioned
   media. Even the wild-type fresh-medium samples sit inside that design.
3. **Missing metadata.** Light regime, temperature, and CO2 are not stated on the
   GEO series page. UTEX 2973 expression shifts sharply with light and CO2, so a
   threshold set here may not transfer.
4. **Incomplete coverage.** About 6 percent of protein-coding genes have no value.
   A naive threshold silently hides them.

The site therefore defaults its low-traffic threshold to CAI and tAI, which are
computed directly from this genome, and offers this dataset as an explicitly
labelled optional overlay.

## Mapping, and what was dropped

Identifiers were translated `Synpcc7942_####` → PCC current locus tag → shared
RefSeq `WP_` protein accession → UTEX `M744_RS#####`.

### Where the `Synpcc7942_####` identifiers actually come from

They are the **primary locus tags of the GenBank annotation** `GCA_000012525.1`,
not an `old_locus_tag` attribute on the RefSeq record. This was checked directly:

| Annotation | CDS locus tag form | Count | `old_locus_tag` |
| --- | --- | --- | --- |
| `GCA_000012525.1` (GenBank) | `Synpcc7942_####` | 2,661 | none |
| `GCF_000012525.1` (RefSeq) | `SYNPCC7942_RS#####` | 2,720 | none |
| `GCF_030544905.1` (RefSeq, newer) | `QY054_RS#####` | 2,730 | none |

No RefSeq PCC 7942 annotation carries the `Synpcc7942_####` tags, so the join
cannot be reproduced from a RefSeq GFF alone. Bridging GenBank to RefSeq requires
matching CDS features by genomic coordinate, since both annotate the same assembly.

### Independent verification

The coordinate-bridge route was rebuilt from scratch and compared against the
shipped table:

| Outcome | Rows |
| --- | --- |
| Independently reproduced and identical | 2,231 |
| Independently reproduced and contradictory | **0** |
| Not resolvable by the coordinate bridge | 320 |

Zero contradictions. The 320 unresolved rows are a limit of the bridge, not evidence
against them: GenBank and RefSeq disagree on exact CDS boundaries for a subset of
genes, so a strict coordinate match cannot resolve those. Every mapping that could be
checked independently held.

That route is only valid where the protein accession is unique on both sides. It
is not unique for four proteins, each encoded at two loci in UTEX 2973:

| Protein | UTEX loci |
| --- | --- |
| `WP_011243185.1` | `M744_RS07945`, `M744_RS12910` |
| `WP_011242480.1` | `M744_RS09190`, `M744_RS11690` |
| `WP_011242807.1` | `M744_RS10890`, `M744_RS10915` |
| `WP_011242808.1` | `M744_RS10895`, `M744_RS10920` |

The upstream mapping collapsed two distinct PCC genes onto one UTEX tag for each
pair, producing duplicate rows whose values disagree substantially. For
`M744_RS10915` the two candidate values were 48,468 and 2,321, a twenty-fold
difference, so the choice is not cosmetic.

All eight loci in that table are **excluded** from this file. Assigning either
value would be a guess. Genes with no expression value must be rendered as
unknown, never as zero, and must not be silently removed by a threshold.

## What could not be verified

- No public, tidy, per-gene abundance table exists for UTEX 2973 itself. The one
  genuine UTEX 2973 transcriptomic study (Tan et al. 2018, PRJNA420395, Figshare
  5712016, CC BY 4.0) publishes transcription-start-site and coverage data plus
  raw reads, not a per-gene abundance matrix. Producing one requires running an
  alignment and quantification pipeline, which is out of scope here.
- 320 of the 2,551 shipped mappings could not be independently re-derived, because
  the GenBank-to-RefSeq coordinate bridge does not resolve genes whose CDS boundaries
  differ between the two annotations. None of those 320 is contradicted; they are
  simply unverified by a second route.
- No dataset-specific redistribution licence was found for the GEO files.

## If you want a real UTEX 2973 expression axis

Quantify PRJNA420395 against `GCF_000817325.1` and drop the resulting table here
in the same three-column form. The site reads it generically, so no code changes
are needed. Prefer the control condition (33 °C, 50 µmol photons m⁻² s⁻¹, 3% CO2)
unless you specifically want the high-light or dark strata.

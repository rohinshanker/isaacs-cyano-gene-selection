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

The site therefore never uses this borrowed PCC 7942 abundance as an implicit
default. Native UTEX 2973 TSS initiation is offered first where measured;
genome-derived CAI and tAI remain labelled fallback proxies, not expression
measurements. This PCC 7942 dataset is an explicitly labelled optional overlay.

## Mapping, and what was dropped

Identifiers were translated `Synpcc7942_####` → PCC current locus tag → shared
RefSeq `WP_` protein accession → UTEX `M744_RS#####`.

### Where the `Synpcc7942_####` identifiers come from

The RefSeq PCC 7942 annotation `GCF_000012525.1` carries them directly as
`old_locus_tag`, on **2,670 gene features and 4 pseudogene features**. The attribute
appears on gene-level features, never on CDS features, which is the detail that makes
this easy to get wrong: a parser that filters to `CDS` rows finds zero and concludes
the attribute is absent. It is not.

The newer RefSeq annotation `GCF_030544905.1` also carries `old_locus_tag`, but under
a different scheme (`QY054_*`), so it does not serve this mapping.

### The verified route

```
Synpcc7942_####                  old_locus_tag on the PCC gene feature
  -> SYNPCC7942_RS#####          locus_tag on the same feature
  -> WP_#########.#              protein_id on that gene's CDS feature
  -> M744_RS#####                UTEX locus tag whose CDS carries the same protein
```

### Independent verification

This route was rebuilt from scratch and compared row by row against the shipped table:

| Outcome | Rows |
| --- | --- |
| Independently reproduced and identical | **2,551** |
| Independently reproduced and contradictory | **0** |
| Unreproduced | **0** |

Every shipped mapping holds.

One subtlety worth recording, because it produces a false ambiguity. Deciding whether
a protein maps to a single UTEX locus requires deduplicating locus tags first.
`M744_RS00920` (`prfB`) has a joined CDS, so the GFF emits two CDS rows carrying the
same `protein_id` and the same `locus_tag`. Counting rows rather than distinct tags
makes that protein look ambiguous and silently drops the gene. After deduplication,
exactly four proteins are genuinely ambiguous, and they are the four listed below.

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

- This release does not include a verified, tidy, per-gene abundance table for
  UTEX 2973 itself. Tan et al. 2018 (PRJNA420395, Figshare 5712016, CC BY 4.0)
  publishes transcription-start-site and coverage data plus raw reads, not a
  ready-to-use per-gene abundance matrix. Its condition libraries enrich primary
  5′ ends, while its transcript-coverage reference pools all 16 RNA samples into
  one library. Neither should be relabelled as replicated gene-body abundance.
  Its processed Table S1 start-site counts and TSS-level DESeq2 comparisons are
  included separately as native UTEX evidence; see
  `TAN2018_TSS_PROVENANCE.md`. Those fields are not whole-gene RNA abundance.
- Ungerer et al. 2018 (DOI 10.1073/pnas.1814912115) reports a native UTEX 2973
  wild-type per-gene TPM table in supplementary Dataset S1, but explicitly notes
  that its transcriptome survey lacks biological replicates. The PNAS record does
  not provide a clear dataset redistribution licence or raw-read accession. Do
  not admit it as the site's quantitative expression prior without resolving
  those issues and verifying locus-level joins.
- Hassanien et al. 2025 (DOI 10.1007/s10123-025-00715-x) profiles native UTEX
  2973 under control, iron, and produced-water conditions. The accessible ESM4
  table has 122 selected gene rows and no per-replicate expression matrix; the
  article does not identify a reusable raw-read accession. That subset cannot
  stand in for a genome-wide baseline.
- The identifier mapping is fully verified, but that says nothing about whether PCC
  7942 abundance is a good proxy for UTEX 2973 abundance. It is not, for the four
  reasons listed above. Verified provenance and biological applicability are separate
  questions, and only the first one is settled here.
- No dataset-specific redistribution licence was found for the GEO files.

## If you want a real UTEX 2973 expression axis

Find a publicly downloadable, replicated *gene-body* RNA-seq matrix for wild-type
UTEX 2973, with its sample conditions, accession, licence, units, and exact
`M744_RS` joins verified. Preserve the assay and condition identity in the source
manifest instead of blending it with TSS initiation or the PCC 7942 proxy. If
reprocessing PRJNA420395, first establish whether its one pooled, rRNA-depleted
reference library can support the intended use; the two-culture primary-library
design does not itself make replicated whole-gene abundance.

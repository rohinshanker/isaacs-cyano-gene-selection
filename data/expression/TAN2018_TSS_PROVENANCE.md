# Tan 2018 TSS initiation score: provenance and caveats

**This is not transcript abundance. Read the next section before using it.**

`tan2018_utex2973_tss_initiation.tsv` gives a transcription-start-site initiation
score for 1,727 of the 2,715 UTEX 2973 protein-coding genes, or 63.6 percent.

| Field | Value |
| --- | --- |
| Publication | Tan et al., 2018, doi:10.1186/s13068-018-1215-8 |
| BioProject | PRJNA420395 |
| Processed data | Figshare 5712016, CC BY 4.0 |
| **Organism measured** | ***S. elongatus* UTEX 2973 — the target strain** |
| Assay | dRNA-seq, transcription start site mapping |
| Conditions | Control 33 °C, 50 µmol photons m⁻² s⁻¹ continuous light, 3% CO2; plus high light 1,000 µmol for 30 min; high temperature 45 °C for 30 min; dark for 2 h |
| Derivation | Per locus, the sum over its TSS features of the arithmetic mean of the eight per-TSS sample count fields |
| Retrieved | 2026-09-18 |

## What it measures, and what it does not

A TSS initiation score reflects **how much transcription initiates at a gene's start
sites**. It is not the amount of transcript present, which is what RNA-seq abundance
measures. The two differ whenever transcript stability, elongation, or processing
differ between genes.

The size of that difference is measurable here. Against the PCC 7942 abundance table we
also ship, across 1,666 genes present in both:

| Comparison | Spearman |
| --- | --- |
| Tan TSS initiation vs PCC 7942 abundance | **0.313** |

That is weak. These are different quantities, and substituting one for the other will
change which genes look highly expressed. Do not average them, and do not present them
in one column.

## Why gene-body abundance is not available

The study's raw reads are in PRJNA420395, but the processed coverage published on
Figshare is a 77 MB PDF visualisation, not a machine-readable track. Deriving true
per-gene abundance therefore requires downloading the raw reads and running an
alignment and quantification pipeline. That work has not been done.

## Coverage and what is missing

- 1,727 of 2,715 target genes carry a score. All locus tags validate against the
  current annotation, with no duplicates, no zeros, and no negative values.
- **988 target genes have no TSS association at all** and must render as unknown, never
  as zero. A gene with no mapped start site is not a gene with no transcription.
- The published annotation carries 2,670 protein-coding loci; 51 are absent from the
  current target set and 77 TSS locus mentions do not resolve, reflecting nine years of
  annotation revision between the 2017 model and the current one.

## How it should be presented

As its own labelled axis, named for what it is, alongside rather than merged with the
PCC 7942 abundance overlay and the codon-adaptation proxy. `expressionBasis` per gene
tells the reader which of these they are looking at. The strain is right and the
conditions are documented, which the PCC data cannot claim; the quantity is indirect,
which the PCC data can.

## Other evidence in this release

This release does not include a verified UTEX 2973 Ribo-seq dataset. A 2025 UTEX
2973 RNA-seq paper, doi:10.1007/s10123-025-00715-x, states that no datasets were
generated or analysed and provides no usable accession. That bounded release
statement should not be read as proof that no relevant dataset can exist.

# E. coli cross-strain crosswalk feasibility, 2026-10-07

Ticket: `O_ecoli-multiomics-datasets__20261006`, follow-on to package P-ECOLI-OMICS.
Claude Science session, 2026-10-07. Repository read only; nothing in the working tree was
modified.

## Owner decision this answers

On 2026-10-07, after reading the P-ECOLI-OMICS return, the owner said: "go with the best
sources for each. a cross-strain crosswalk is fine if it is feasible." This file establishes
whether the crosswalk is feasible and what it reaches. It is evidence for intake, not an
admitted join: the in-repository build remains the release crosswalk, and the tables beside
this file are a reference to compare it against (see "How intake should use this").

## Verdict

**Feasible.** Only one selected source needs a real ortholog crosswalk: the AG3C
transcriptome and proteome, measured in *E. coli* B str. REL606. The other selected sources
are K-12 strains (NCM3722, BW25113) and already carry MG1655 identifiers, either as a
b-number column or as coordinates on NC_000913.3. For those, the cross-strain question is the
biology, not the identifier.

| Layer | Selected source | Strain | Route to an MG1655 b-number | Reached |
| --- | --- | --- | --- | --- |
| Transcript abundance | AG3C, Caglar 2017 Supplementary Dataset 2 (GEO GSE94117) | E. coli B REL606 | `ECB_` tag -> current REL606 locus (`old_locus_tag`) -> protein crosswalk below | 3,709 of 4,196 matrix rows (88.4%) |
| Protein abundance, same cultures as above | AG3C, Supplementary Dataset 3 (PRIDE PXD005721) | REL606 | `YP_` accession -> `ECB_` tag (NCBI protein record) -> same route | 1,948 of the 2,007 rows that carry signal |
| Protein abundance, condition breadth | Schmidt 2016 Table S6 (PRIDE PXD000498) | K-12 BW25113 | direct b-number column | 2,285 distinct b-numbers (repository dossier row L6-01) |
| Protein abundance, replicate-level | Mori 2021 corrected Dataset EV8 (PXD014948) | K-12 NCM3722 and derivatives | direct `Gene locus` column | 4,324 distinct b-numbers (dossier row L6-03a) |
| Ribosome occupancy, with its own RNA-seq | Zhang 2022, GEO GSE182100 | K-12 NCM3722 | coordinate join on NC_000913.3 under one fixed offset rule | 4,128 of 4,497 count regions (91.8%) |
| On-strain transcript reference | PRECISE-1K `log_tpm_qc.csv` | K-12 MG1655 (582 samples) | row index is the b-number | 4,257 genes (dossier row L1-01) |

Two of the selections carry a caveat the owner should see before the repo agents build on them:

- **Schmidt Table S6 holds one value per condition, not one per replicate.** The dossier records
  its headers as "Protein copies/cell", "Protein Mass (fg) / Cell", "Coefficient of Variance" and
  22 condition columns. The paper's biological triplicates are summarised, not published per
  culture. If replicate-level protein values are required, Mori's corrected EV8 has per-sample
  columns (Lib-01 to Lib-30), at the cost of strain NCM3722 and a narrower condition set.
- **No selected pair of layers shares cultures except AG3C mRNA with AG3C protein.** Zhang's
  Ribo-seq and RNA-seq share a study and condition set but not proven cultures. Every other
  combination is cross-study and cross-strain. A ratio across them, for example Zhang
  footprints over AG3C mRNA, is a derived cross-study quantity, not a measured translation
  efficiency.

## REL606 to MG1655 protein crosswalk

Inputs, all retrieved 2026-10-07 and checksummed (full table at the end):

- REL606: RefSeq `GCF_000017985.1` (ASM1798v1), annotation `GCF_000017985.1-RS_2025_06_13`,
  4,204 protein-coding loci. The GFF, protein FASTA and feature table each matched the MD5 in
  the assembly directory's `md5checksums.txt`.
- MG1655: the repository's own pinned `GCF_000005845.2` GFF and protein FASTA under
  `data/raw/ecoli-k12-mg1655/`, 4,290 protein-coding loci. The protein FASTA SHA-256 matches
  the file in the working tree.

Why not the repository's existing rule. The UTEX/PCC 7942 crosswalk joins on an identical
RefSeq `WP_` accession. That cannot work here: MG1655's curated RefSeq record uses `NP_`
accessions, so no protein accession is ever shared with REL606. Tier 1 below applies the same
criterion at the sequence level, because a `WP_` accession is by definition one identical
protein sequence.

Method, one protein per locus:

1. **T1, exact sequence.** Identical protein sequence, unique on both sides. 2,162 pairs.
   Sequences shared by more than one locus on either side are not resolved: 3 sequences give
   21 `ambiguous_exact_sequence` rows (cold shock protein YdfK, 2 REL606 x 1 MG1655; an IS421
   transposase, 5 x 3; YnaM/YnfT family, 2 x 2).
2. **T2, near-identical reciprocal best hit.** DIAMOND 2.2.8 `blastp --ultra-sensitive`,
   e <= 1e-10, run both ways on the loci T1 left over. Reciprocal best hits with identity
   >= 90%, both coverages >= 0.8 and no equal-bitscore alternative: 1,619 pairs.
3. **T3, divergent but syntenic.** Reciprocal best hits below T2 thresholds but with identity
   >= 50%, coverage >= 0.6 and at least one conserved neighbour within 3 loci: 36 pairs.
4. Not a transfer route: 6 `ambiguous_rbh_tie`, 20 `excluded_weak_rbh`, 352 REL606 loci with
   no reciprocal best hit (`no_partner`).

Result: **3,817 REL606 loci (90.8%) map one-to-one to 3,817 MG1655 loci (89.0%).**

Gene order is used as an independent check, not as a mapping criterion for T1 and T2. A pair
counts as syntenic when at least one of its six neighbours maps within six loci of the
partner. That holds for every T1 pair but one, for 99.8% of T2 pairs, for 16.7% of tied hits
and for 55% of the excluded weak hits. The separation supports the thresholds.

## How far each AG3C matrix gets

The two AG3C matrices share their rows. All 4,196 protein accessions (`YP_003043230.1` and
onward, from the 2009 REL606 RefSeq annotation) were fetched from NCBI protein on 2026-10-07.
Every one resolved to an `ECB_` locus tag, and in all 4,196 rows that tag equals the gene id in
the same row of the mRNA matrix.

| Route status, mRNA matrix rows | Rows |
| --- | --- |
| T1 exact sequence | 2,069 |
| T2 near-identical RBH | 1,607 |
| T3 divergent syntenic RBH | 33 |
| **Reaches a distinct b-number** | **3,709** |
| No MG1655 partner | 289 |
| `ECB_` tag absent from the current REL606 annotation | 106 |
| Current REL606 locus is a pseudogene | 66 |
| Excluded weak RBH | 15 |
| Ambiguous, identical paralogs | 7 |
| Ambiguous, tied RBH | 4 |

The protein matrix is mostly fill. 2,189 rows sit at the matrix's global minimum, 0.968, in at
least half of the 105 cultures, and 6 rows are constant. That leaves 2,007 rows that carry
signal, of which 1,948 reach a b-number. The 0.968 floor is read here as a non-detection value;
the paper text read does not define it.

One more caveat for intake. The 2009 `YP_` protein differs from the current REL606 protein at
the same locus for 304 loci (3,720 identical, 172 not comparable), most plausibly through
re-annotated start codons. The mass-spectrometry search used the 2009 sequences. The
crosswalk is keyed at the locus, so this does not change a mapping, but a peptide-level
reanalysis would need the old sequences.

## GSE182100 coordinate route

The 72 per-sample count files in `GSE182100_RAW.tar` (9,134,080 bytes) have no locus tag or
gene symbol. Each row is an anonymous `geneN` with a region string on `chr` and a header naming
`escherichia_coli_k12_nc_000913_3.gtf` and `--add_three`. All 72 files share the same 4,497
regions. Against the pinned MG1655 CDS spans:

- plus strand: region start + 1 and end - 3 equals the CDS span, 2,007 regions;
- minus strand: region start + 4 and end equals the CDS span, 2,121 regions;
- so 4,128 regions (91.8%) match exactly under one rule per strand, which is a 3-nt extension
  past the 3' end, consistent with `--add_three`. No region matched two loci.

Of the 369 unmatched regions, 45 have a same-strand CDS within 60 nt at both ends (annotation
drift between the 2018 GTF and the 2026 release), and 10 are multi-segment regions. They are
left unmatched, not rescued.

## How intake should use this

1. Build the release crosswalk in the repository from the pinned inputs, under the
   identifier-crosswalk contract, **before** opening the three crosswalk tables here. Then
   compare. Agreement on T1 is expected to be exact; T2 and T3 depend on the aligner and should
   agree on most pairs and name the rest.
2. Recompute every checksum below on files the repository retrieves itself.
3. Treat T3 as a separate, visibly weaker class. Whether T3 pairs carry values onto MG1655 at
   all is the lab's decision, not this return's.
4. Every value that crosses a strain carries the `transferred` basis and names its strain
   (REL606, NCM3722 or BW25113). The data contract's basis table is written around UTEX 2973
   loci. How it applies to an MG1655-native view is an open point for the repository, and this
   return does not settle it.

## Files and checksums

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| `GCF_000017985.1_ASM1798v1_genomic.gff.gz` | 433,859 | `27c302a37ac517de79999cc8438c744367e5c12ad4ac60b34f55bfd753214f25` |
| `GCF_000017985.1_ASM1798v1_protein.faa.gz` | 899,363 | `66e0668d4af9a285914ede9bf3e2ee804109a0d57ac8da227335bc90cbe832b4` |
| `GCF_000017985.1_ASM1798v1_feature_table.txt.gz` | 232,176 | `7623765172ae8f938b451d960096bcb753b1d1a8215a89b7921adfec6c1bb8aa` |
| `GCF_000005845.2_ASM584v2_genomic.gff.gz` (repository copy) | 387,627 | `afdf03dc1d06e423d874ee29d9e0df14f5d32baf893f4da9f93aa721eb5f495e` |
| `GCF_000005845.2_ASM584v2_protein.faa.gz` (repository copy) | 902,395 | `283c91ff66d0597f2488fd1c00ad40f8d0a0b37a92f981b6148d75fa4a934896` |
| `GSE182100_RAW.tar` | 9,134,080 | `75f1581fac48bf1e65860a673eafef49a5fa4b427103ea624f25da55d1be9467` |
| `ecoli_crosswalk_REL606_to_MG1655__20261007.tsv` (4,216 rows) | 846,204 | `f00d4aa268a1ac74c0596e752527dc6f3fcc76f1906ef180b9fe0925d0435b6d` |
| `ecoli_crosswalk_AG3C_matrix_rows__20261007.tsv` (4,196 rows) | 296,848 | `e36ef1837865673305b47595f18c6fe6a34e1236d65770b0063faaea2e8f28c9` |
| `ecoli_crosswalk_GSE182100_regions__20261007.tsv` (4,497 rows) | 260,185 | `9a0e8d9bebd5220fda3e268bb53d4172be72989b2acbc62029868f4fe3e51b75` |

REL606 URLs:
`https://ftp.ncbi.nlm.nih.gov/genomes/all/GCF/000/017/985/GCF_000017985.1_ASM1798v1/`.
GSE182100: `https://ftp.ncbi.nlm.nih.gov/geo/series/GSE182nnn/GSE182100/suppl/GSE182100_RAW.tar`.
The AG3C matrices are members of the Caglar 2017 supplement bundle recorded in
`ecoli_multiomics_files__20261007.tsv` rows F02 to F05.

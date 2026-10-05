# Pilot: within- versus between-dataset agreement on licence-permitted PCC 7942 per-gene tables

Claude Science pilot, run 2026-10-05 in the session sandbox only. Nothing was written to, admitted into, or joined in the
repository `isaacs-cyano-gene-selection` (HEAD `70bc59004337b5f0db7811dd829474efda4e98a4` at read time). This is evidence
for the architecture of the data-driven comparability feature; it is not an admission, a licence decision, a locus join,
or a lab decision (`docs/validation/claude-science-handoff.md`, section "Hard boundaries", lines 224-245).

## Question

The owner's instruction of 2026-10-04 allows datasets to be grouped when their distributions are "similar enough".
Which data-driven statistic separates like from unlike conditions on these tables, and which does not?

## Data

Series used are those `docs/validation/source-ledger.md` marks "permitted" for a derived per-gene table
(lines 99, 107, 113, 115, 117, 125, 126) and that have a processed per-gene supplementary file on GEO. Every file was
listed from its GEO `suppl/` directory, fetched over HTTPS from `ftp.ncbi.nlm.nih.gov`, and hashed on receipt; all are
under 5 MB and none is a RAW tar.

| Series | File | Bytes | SHA-256 | Retrieved (UTC) |
| --- | --- | --- | --- | --- |
| GSE104203 | `GSE104203_Natural_light_RNAseq_processed.xlsx` | 4,871,460 | `f087b345f019b4b88e187e673829a79255cf71046c42cce200516bde654a22ce` | 2026-10-05T00:07:20Z |
| GSE222067 | `GSE222067_counts.xlsx` | 531,493 | `5ac738c5b833e2ce1847f358256c165a16dc9d4e581291d274517c129a09d21d` | 2026-10-05T00:07:23Z |
| GSE288532 | `GSE288532_rna_seq_counts.csv.gz` | 187,447 | `1a05cb6032c39c37d515ff22148e82ed1c6e8018733d60e56ee198a11ccb66d8` | 2026-10-05T00:07:24Z |
| GSE327989 | `GSE327989_TPM_values_260414.csv.gz` | 260,278 | `276e18547ea8827d4404299e8a47fca463ca0b2a64d041a7fbc0905c6a662f28` | 2026-10-05T00:07:26Z |
| GSE45762 | `GSE45762_Processed_Counts.xlsx.gz` | 390,770 | `38f4c6fdab6497dd004c190355fe1bd6a4377e81e14ad5a7a92d56f468370fc3` | 2026-10-05T00:07:27Z |
| GSE79726 | `GSE79726_Se7942-N-starv2016.txt.gz` | 33,154 | `c40b47f4797106e1296d29a5afc962c3a0215d55976e8daf16e88aab90350f4d` | 2026-10-05T00:07:28Z |
| GSE89999 | `GSE89999_Expression_timecourse.xls.gz` | 707,239 | `2b7185ce24fe24c4fedb8b8ee5ba7149372e8e513ccd4fb8bf2ff7a7b5fef3e4` | 2026-10-05T00:07:28Z |

GEO SOFT sample records (`acc.cgi?acc=...&targ=all&form=text&view=brief`) were fetched for each series and used to map
columns to GSM samples; their hashes are in `cyano_comparability_pilot_files_20261005.tsv`. The repository's
`data/expression/GSE205444_pcc7942_wt_bg11_day1.tsv` (SHA-256 `d8a44d3f...7fe57`) was read in place: WT, fresh BG-11,
day 1, arithmetic mean of three DESeq2-normalised replicates (`data/expression/PROVENANCE.md` lines 17-18), so it contributes
no replicate pairs. Condition labels come from package B (`docs/notes/handoff/cyano_package_B_conditions_20261003.tsv`,
rows 9-12, 29-30, 38, 40, 45, 56, 57); package D verdicts (`docs/notes/handoff/cyano_package_D_pairs_20261004.tsv`) were
joined to cross-study pairs by package B row.

Permitted series not used: GSE104204, GSE122841, GSE140121, GSE205445 and GSE227397 have no processed per-gene file
(package B column `per_gene_table`: "none found" or raw only). GSE205443 has `GSE205443_Counts.txt.gz`, but package B
escalates it because the assay is RB-TnSeq (library_strategy OTHER), not RNA-seq, so it is not an expression table.

### Exclusion: GSE45762

The gene identifiers of GSE45762 could be harmonised (NCBI GeneID to `Synpcc7942_` tag through NCBI Gene
`otheraliases`; 0 disagreements against the 2,392 rows whose `gene_name` is itself a tag). The sample columns could not.
The `Counts` sheet labels its columns `7942_100h_rep1, 7942_100h_rep2, ...` over sample numbers 1-17, while the same
workbook's `Sample Info` sheet assigns sample 2 to strain 7942, 240 h, replicate 1 (and all even numbers 2-12 to 240 h).
Strain is consistent between the two sheets; time point is not, and the rank-correlation structure does not decide it
(mean within-group Spearman for WT 100 h / 240 h: 0.961 / 0.970 under the header labels, 0.970 / 0.975 under `Sample Info`). Because the
replicate-versus-condition label is the quantity being calibrated, the series is excluded from every pair class. This is
a finding for intake: any future derived table from GSE45762 needs the column-to-sample assignment confirmed with the
submitter or the article.

## Identifier harmonisation

All tables were reduced to PCC 7942 old locus tags (`Synpcc7942_xxxx`) using the repository's PCC 7942 RefSeq GFF
`data/annotation/source/GCF_000012525.1_ASM1252v1_genomic.gff.gz` (read-only; `old_locus_tag` sits on gene features,
`data/expression/PROVENANCE.md` lines 50-54). `SYNPCC7942_RS` tags (GSE288532) were converted through the
`locus_tag`/`old_locus_tag` pair on the same gene feature. No UTEX 2973 identifier was used; GSE205444 was keyed on its
`source_gene_id` column, not on `locus_tag` (M744). Tags absent from the GFF (41 per table, retired in the RefSeq
re-annotation) and one non-standard tag in the GSE205444 table (`Synpcc7942_1912a`) were dropped rather than guessed.

| Series | Identifier route | Rows | Not in GFF (dropped) | Genes harmonised | Samples | Conditions |
| --- | --- | --- | --- | --- | --- | --- |
| GSE104203 | Gene ID column = Synpcc7942_ old tag (whitespace stripped) | 2661 | 41 | 2620 | 60 | 30 |
| GSE222067 | locus_tag column = Synpcc7942_ old tag | 2661 | 41 | 2620 | 12 | 4 |
| GSE288532 | SYNPCC7942_RS locus_tag -> old_locus_tag on same GFF gene feature | 2665 | 0 | 2665 | 30 | 10 |
| GSE327989 | Name column = Synpcc7942_ old tag | 2611 | 39 | 2572 | 12 | 4 |
| GSE45762 | NCBI GeneID -> NCBI Gene esummary otheraliases Synpcc7942_ tag (unique) | 2662 | 41 | 2619 |  |  |
| GSE79726 | ID_REF = Synpcc7942_ old tag | 2661 | 41 | 2620 | 6 | 3 |
| GSE89999 | Gene name column = Synpcc7942_ old tag | 2661 | 41 | 2620 | 24 | 24 |
| GSE205444 | source_gene_id = Synpcc7942_ old tag (repo table) | 2550 | 0 | 2550 | 1 | 1 |

GSE288532 lists 2,761 `SYNPCC7942_RS` rows, of which 2,665 carry an old tag. The intersection over the seven retained
tables is **2498 protein-coding genes**; every statistic is computed on this one universe, so `n_shared_genes` is
2498 for every pair. Pairwise table overlaps (2,505-2,665 genes) are in `cyano_comparability_pilot_harmonisation_20261005.tsv`.

## Method

*Within-sample normalisation.* Count tables (GSE222067 `_Count` columns, GSE288532) and the GSE205444 DESeq2 mean were
divided by gene length (GFF gene-feature span) to give a per-base rate. Tables already length-normalised as deposited
(GSE104203 median- and length-normalised values, GSE327989 TPM, GSE79726 RPKM, GSE89999 RPKM) were used as given. Every
sample was then rescaled to sum to 10^6 over the 2498-gene universe (TPM over shared genes) and transformed as
log2(TPM + 1).

*Pair classes.* (i) replicate pairs: same study, same condition (genotype, treatment and sampling time all equal).
(ii) different conditions within one study, split into `ii_time_only` (same genotype and treatment, different sampling
time or phase) and `ii_genotype_or_treatment`. (iii) cross-study pairs, split into `iii_similar_controls` when both
samples are an unperturbed WT/control in BG-11 at about 30 C by package B (GSE104203 Low Light and Clear Day; GSE327989
WT; GSE79726 N-replete Control 24 h and N-plus 48 h; GSE89999 clock-rescue dusk ZT12) and `iii_other` otherwise.
GSE222067 (37 C), GSE288532 (engineered cscB-sps strain) and GSE205444 (no package B row) are never in the similar set.
The sample-to-class assignment is in `cyano_comparability_pilot_samples_20261005.tsv`.

*Statistics per pair.* Spearman correlation of per-gene TPM; two-sample Kolmogorov-Smirnov D on log2(TPM + 1);
1-Wasserstein distance between the per-sample z-scored log2(TPM + 1) vectors (shape only, location and scale removed).
*Discrimination.* AUROC (Mann-Whitney U / n_pos n_neg) for separating class i from class ii, oriented so that 1 means the
statistic always calls replicates more similar; computed per study and pooled. For class iii: AUROC of similar controls
against other cross-study pairs, pooled and within each study pair; share of class iii variance explained by study-pair
identity (eta squared); share of class iii pairs inside the replicate range (at or beyond the 5th percentile of
class i Spearman, or the 95th percentile of class i KS D and Wasserstein).
*Response agreement.* For nine control/perturbation contrasts (table below), log2 fold change =
log2(mean TPM_treatment + 1) - log2(mean TPM_control + 1), and Spearman of fold changes between contrasts. Positive control:
the same contrast recomputed from replicate r of treatment and replicate r of control, compared across r.

## Results

### Statistic medians by pair class

| Pair subclass | Pairs | Spearman | KS D | Wasserstein |
| --- | --- | --- | --- | --- |
| i_replicate | 87 | 0.970 | 0.030 | 0.020 |
| ii_time_only | 647 | 0.901 | 0.060 | 0.035 |
| ii_genotype_or_treatment | 1894 | 0.879 | 0.064 | 0.040 |
| iii_similar_controls | 275 | 0.716 | 0.086 | 0.078 |
| iii_other | 7537 | 0.736 | 0.158 | 0.072 |

### Does each statistic separate replicates (i) from different conditions (ii)?

| Study | Negative class | n i | n ii | AUROC Spearman | AUROC KS D | AUROC Wasserstein |
| --- | --- | --- | --- | --- | --- | --- |
| GSE104203 | ii_all | 30 | 1740 | 0.942 | 0.806 | 0.577 |
| GSE104203 | ii_time_only | 30 | 392 | 0.893 | 0.805 | 0.540 |
| GSE104203 | ii_genotype_or_treatment | 30 | 1348 | 0.957 | 0.807 | 0.588 |
| GSE222067 | ii_all | 12 | 54 | 0.955 | 0.977 | 0.894 |
| GSE222067 | ii_genotype_or_treatment | 12 | 54 | 0.955 | 0.977 | 0.894 |
| GSE288532 | ii_all | 30 | 405 | 0.975 | 0.825 | 0.941 |
| GSE288532 | ii_time_only | 30 | 189 | 0.969 | 0.830 | 0.947 |
| GSE288532 | ii_genotype_or_treatment | 30 | 216 | 0.980 | 0.821 | 0.935 |
| GSE327989 | ii_all | 12 | 54 | 0.767 | 0.677 | 0.525 |
| GSE327989 | ii_genotype_or_treatment | 12 | 54 | 0.767 | 0.677 | 0.525 |
| GSE79726 | ii_all | 3 | 12 | 0.667 | 0.861 | 0.722 |
| GSE79726 | ii_time_only | 3 | 4 | 0.667 | 0.917 | 0.833 |
| GSE79726 | ii_genotype_or_treatment | 3 | 8 | 0.667 | 0.833 | 0.667 |
| pooled | i_replicate vs ii_all | 87 | 2541 | 0.932 | 0.812 | 0.776 |
| pooled | i_replicate vs ii_time_only | 87 | 647 | 0.899 | 0.797 | 0.735 |
| pooled | i_replicate vs ii_genotype_or_treatment | 87 | 1894 | 0.943 | 0.817 | 0.790 |
| pooled | i_replicate vs iii_all | 87 | 7812 | 0.996 | 0.956 | 0.947 |
| pooled | iii_similar_controls vs iii_other | 275 | 7537 | 0.462 | 0.695 | 0.447 |

Gene-wise Spearman separates replicates from different conditions best within a study: AUROC 0.942-0.975 in the three
studies with at least 12 replicate pairs and 30 or more different-condition pairs (GSE104203, GSE222067, GSE288532),
0.767 in GSE327989 and 0.667 in GSE79726 (3 replicate pairs). It also separates replicates from time-only differences
(0.893 in GSE104203, 0.969 in GSE288532). KS D is intermediate (per-study median 0.825).
The shape-only Wasserstein distance is the weakest and least stable (0.525-0.941; 0.577 in GSE104203, the largest study),
so whole-distribution shape on standardised log values carries little condition information within one platform.

### Where cross-study pairs (iii) fall

No cross-study pair reaches the within-study replicate range for Spearman (bound 0.939;
0.0% of 7812 class iii pairs, 0.0% of the
275 similar-control pairs). Cross-study Spearman medians by study pair span
0.640-0.856, below the class ii
median of 0.879-0.901. For KS D, 13.9% of class iii pairs (and 36.7% of similar-control pairs)
fall inside the replicate bound of 0.060; for Wasserstein 23.1%
(18.9%) inside 0.052.

Pooled across study pairs, similar-control pairs are **not** more concordant than other cross-study pairs by Spearman
(AUROC 0.462) or by Wasserstein (0.447); KS D gives
0.695. Study-pair identity alone explains 34% of the class iii variance in Spearman,
22% in KS D and 31% in Wasserstein. Holding the study pair fixed:

| Study pair | n similar | n other | AUROC Spearman | AUROC KS D | AUROC Wasserstein |
| --- | --- | --- | --- | --- | --- |
| GSE104203 / GSE327989 | 96 | 624 | 0.482 | 0.557 | 0.590 |
| GSE104203 / GSE79726 | 128 | 232 | 0.432 | 0.327 | 0.416 |
| GSE104203 / GSE89999 | 32 | 1408 | 0.825 | 0.894 | 0.801 |
| GSE327989 / GSE79726 | 12 | 60 | 0.546 | 0.378 | 0.553 |
| GSE327989 / GSE89999 | 3 | 285 | 0.858 | 0.928 | 0.712 |
| GSE79726 / GSE89999 | 4 | 140 | 0.486 | 0.718 | 0.730 |

The two study pairs with AUROC above 0.8 (GSE104203 / GSE89999 and GSE327989 / GSE89999) both involve GSE89999, whose "other"
samples are darkness time points; there the statistic is detecting light versus dark, not the similarity of two growth
conditions. In the other four study pairs, Spearman AUROC is 0.432-0.546 and no statistic exceeds 0.730.

Package D's axis count does not track the data either. After GSE45762 is excluded, every package D condition pair among
these studies is "not comparable" (7,668 sample pairs; 0-4 of 6 axes passed). Spearman correlates with axes passed
across study pairs (0.311) but not within a study pair (0.016); KS D -0.191 / -0.001;
Wasserstein -0.083 / 0.023.

### Response agreement (Spearman of log2 fold changes)

| Contrast | Series | Treatment vs control | Perturbation family |
| --- | --- | --- | --- |
| C01 | GSE222067 | WT_300mM_NaCl vs WT_0mM_NaCl | salt |
| C02 | GSE222067 | dsps-ect_300mM_NaCl vs dsps-ect_0mM_NaCl | salt |
| C03 | GSE79726 | N-minus 48h vs N-plus 48h | nitrogen_starvation |
| C04 | GSE104203 | HighLightPulse_9.0h vs HighLightPulse_8.0h | light_increase |
| C05 | GSE104203 | ShadePulse_9.0h vs ShadePulse_8.0h | light_decrease |
| C06 | GSE89999 | control_darkness_1h vs control_duskZT12 | light_decrease |
| C07 | GSE89999 | deltaR_darkness_1h vs deltaR_duskZT12 | light_decrease |
| C08 | GSE327989 | PEBAB1_day4 vs WT_day4 | genotype_overexpression |
| C09 | GSE288532 | subjDay_T8h vs subjDay_T0h | sucrose_induction_time |

| Response class | Pairs | Median | Min | Max |
| --- | --- | --- | --- | --- |
| replicate_split_same_contrast | 15 | 0.781 | 0.391 | 0.894 |
| same_perturbation_same_study | 2 | 0.723 | 0.687 | 0.758 |
| same_perturbation_cross_study | 2 | 0.651 | 0.613 | 0.688 |
| different_perturbation | 29 | -0.053 | -0.600 | 0.392 |
| opposite_perturbation | 3 | -0.489 | -0.713 | -0.470 |

| Contrast pair | Class | Spearman of log2 fold change |
| --- | --- | --- |
| C01 vs C02 | same_perturbation_same_study | 0.758 |
| C04 vs C05 | opposite_perturbation | -0.713 |
| C04 vs C06 | opposite_perturbation | -0.470 |
| C04 vs C07 | opposite_perturbation | -0.489 |
| C05 vs C06 | same_perturbation_cross_study | 0.688 |
| C05 vs C07 | same_perturbation_cross_study | 0.613 |
| C06 vs C07 | same_perturbation_same_study | 0.687 |

Fold-change agreement is the only statistic here that recovers a biological match across studies: the GSE104203
60-minute shade pulse and the GSE89999 one-hour darkness (two laboratories' light-decrease responses) agree at 0.613
and 0.688, inside the replicate-split range (0.391-0.894, median 0.781). The high-light pulse correlates negatively with
both light-decrease responses (-0.470 to -0.713). Unrelated perturbations span -0.600 to 0.392 (median -0.053), so a
moderate absolute value is not by itself evidence of the same perturbation: salt stress (C01) and shade or darkness
(C05, C07) anticorrelate at -0.56 to -0.60. The cross-study evidence rests on two contrast pairs from the same two studies
and is **provisional**.

## Answer for the architecture

1. **Whole-distribution similarity does not separate like from unlike conditions and should not decide grouping.** The
   shape statistic (Wasserstein on standardised log values) is near chance within the largest study, and across studies
   it reflects the study pair (platform, pipeline, normalisation), not the conditions. KS D on log values discriminates
   within a study better than shape, but across studies it ranks similar controls above other pairs only weakly (pooled
   AUROC 0.695), inconsistently by study pair, and largely by detecting light against dark. Use distribution
   statistics as a quality-control flag for normalisation or platform mismatch, not as a comparability score.
2. **Gene-wise Spearman of levels discriminates within a study but not across studies.** Its useful form is
   replicate-referenced: show a cross-study value against each study's own replicate band (here pooled 5th percentile 0.939;
   per-study replicate medians 0.918-0.989), never as an absolute threshold. On these data every cross-study pair falls below the replicate band, including standard
   BG-11 ~30 C controls, so no pair would be grouped by a level-concordance cut.
3. **Response agreement (Spearman of log2 fold changes) is the statistic that discriminates across studies**, where
   both datasets have a control and a perturbation. Each study's own control absorbs the platform offset. Show it with
   its sign and next to the replicate-split value of each contrast; the lab decides alignment from it together with
   the listed conditions, as the 2026-10-04 instruction asks.

## Limitations

- Few studies: seven tables (six with replicates); one series excluded; all PCC 7942, so nothing here transfers to
  UTEX 2973 without evidence. Class i has 87 pairs, 60 of them from GSE104203 and GSE288532; GSE79726 contributes 3.
- Pairs are not independent (each sample enters many pairs), so AUROCs are descriptive and carry no confidence
  intervals; per-study values with fewer than 12 replicate pairs are unstable.
- Platform and normalisation differ by series (median-normalised values, TPM, RPKM, raw counts; Bowtie, CLC, Rsubread,
  edgeR, DESeq2 pipelines). Length normalisation of count tables used gene-feature spans, not the effective lengths each
  pipeline used. The TPM-over-shared-genes rescale removes library size, not composition effects such as rRNA depletion.
- The log2(TPM + 1) pseudocount compresses low-expression genes, and fold changes were not filtered by expression level
  or shrunk.
- GSE205444 is a mean of three replicates, so its pairs have less noise than single-sample pairs; GSE89999 has one
  sample per condition and contributes no replicate pairs.
- Class ii is defined by labels, so it includes biologically near-identical pairs (e.g. 15 minutes apart within a pulse);
  this lowers every AUROC and is why the time-only split is reported.
- The "similar controls" flag uses package B fields as extracted; its axes (diel versus continuous light, CO2 1-2%,
  40-100 umol photons m-2 s-1) are only broadly similar, and no pair among them is "comparable" under package D.
- Response agreement rests on nine contrasts; only two cross-study same-perturbation pairs exist, both between GSE104203
  and GSE89999. Replicate-split pairs match replicate numbers arbitrarily within a condition.

## Artifacts

- `cyano_comparability_pilot_files_20261005.tsv`: file provenance (URL, bytes, SHA-256, retrieval date) for GEO tables, SOFT records, the NCBI Gene
  summaries, and the four repository files read.
- `cyano_comparability_pilot_pairs_20261005.tsv.gz`: 10,440 sample pairs (study_a, sample_a, study_b, sample_b, pair_class, n_shared_genes, spearman,
  ks_d, wasserstein, notes, plus conditions, subclass and package D verdict).
- `cyano_comparability_pilot_auroc_20261005.tsv`, `cyano_comparability_pilot_response_20261005.tsv`, `cyano_comparability_pilot_samples_20261005.tsv`, `cyano_comparability_pilot_harmonisation_20261005.tsv`: effect sizes,
  fold-change agreement, sample-to-condition map, and identifier harmonisation.
- `cyano_comparability_pilot_20261005.png`: figure (a-c statistic by pair class; d per-study AUROC; e fold-change agreement).
- `pilot_code.tar.gz`: the four scripts (load, universe, pairs, analysis) and the figure script.

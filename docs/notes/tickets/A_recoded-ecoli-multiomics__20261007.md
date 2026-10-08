# A_recoded-ecoli-multiomics__20261007 — Active

- **Scope:** Admit the measured datasets from Nyerges et al., *Nature
  Communications* 2026 (PMID 42331836), which profile partially recoded
  *Escherichia coli* strains built against a 57-codon genetic code. Decide how a
  genome whose codon composition was deliberately changed enters a viewer whose
  maps are fitted on native codon usage, generate the codon projection the
  recoded sequences need, and carry each sample's recoding scheme beside every
  value it produces.
- **Status:** active
- **Opened:** 2026-10-07
- **Updated:** 2026-10-08

Opened at the owner's request on 2026-10-07, with a Claude Science handoff asked
for. **The handoff was not needed and the owner withdrew it the same day.** Every
dataset the request named is public and was retrieved in full; see
"Accessibility, settled" below. The scheme derivation it would have confirmed was
done here instead, twice and independently; see "Derived 2026-10-07".

This is the first source in the repository whose organisms are recoded rather
than native, so it is also the first that tests whether the viewer's codon
metrics and projections mean anything when the codon table they describe is a
design input.

All six owner questions were answered on 2026-10-07 and are recorded under
"Decided 2026-10-07". Work has begun; the ticket is active.

## Current State

Implementation owner: **cyano-ticket-closing**, resumed at the owner's request
on 2026-10-07 in `work/recoded-multiomics-20261007`, baseline `be5b3b3`.

Implemented and under final independent review:

- Exact Syn61∆3(ev5) CP116771.1 / GCA_028355435.1: 3,549 plotted CDSs,
  141 excluded; recoded scheme panel and 148 residual target codons.
- Public MDS42 AP012306.1 and DH10B CP000948.1 reference records, explicitly
  distinguished from the study stocks, with no study omics attached to them.
- Syn61 native PCA plus a separate child-local fixed public-MDS42 projection;
  complete transforms, identities, gene order and source digests are validated.
- Sixteen typed Syn61 omics columns: 50,513 source values over 3,192 exact,
  unique gene-name joins. Read counts, RPKM, two LFC estimators, P-values and
  TE are distinct; derived quantities never pool or qualify as low traffic.
- Separate whole-strain fitness: 69 growth records over 48 growth strains,
  17 categorical no-growth results, and 5,280 signed Biolog well differences.
  Biolog identities remain separate from growth/evolution-stage identities.
- Original Syn61 prescription and an explicitly labelled Ec_Syn57 aggregate
  simulation preset, with every destination/share checked against pinned data.

**Remaining evidence gates:** D5-isolates (final sequence and structural/mutation
history for the three partial isolates) and D4-debug-identity (which debugged
clone corresponds to each assay replicate). The design's overlapping/gapped
segment features do not establish exact isolate genomes. Those organism records
and their per-gene omics joins remain unshipped. Source normalization and
Biolog wavelength/Seg80-0 identity limitations remain explicit, not imputed.
The ticket stays active until that remaining scope is resolved.

Multica work: DEM-309 source dossier, DEM-310 projection engine, DEM-312 fitness
view, DEM-314 recoded UI, DEM-315 quantity contract, DEM-316 parent references.
DEM-318 independently recomputed all admitted source values, gene joins and
residual counts; DEM-319 reviews quantity/fitness integration. DEM-309's initial
Claude run failed before execution under a provider biology filter; its terminal
failure was confirmed before Codex took the evidence assignment.

### Review findings retained until recheck

DEM-318 reviewed the earlier `cfc99f2` snapshot. Every finding is accounted for;
fixes below await the reviewer's confirmation on the final patch.

| Finding | State / repair |
| --- | --- |
| DEM-318-F1: missing manifest entries | Fixed `8c489d6`, final typed manifest `d939b8e`; real fitness/citations render and manifest/release gates pass |
| DEM-318-F2: unregistered typed source tables | Fixed `d939b8e` with quantity framework `274f665` / `c952f4d`; all 16 headers counted and full Python gate passes |
| DEM-318-F3: inherited cyanobacterial citation claims | Fixed `b74d128`; explicit method-ID allowlist and Syn61 contributions. ViennaRNA and UMAP remain because this build actually uses both (`build_features.py`), with genome-specific descriptions |
| DEM-318-F4: whole strain label in segment field | Fixed `b74d128`; literal source-row/sheet segment maps separate condition and stage, and Biolog mapping is independent of sheet order |
| DEM-318-F5: 69 strains instead of 48 | Fixed `8c489d6`; explicit 21-pair M9/rich-medium identity crosswalk, 48 growth strains |
| DEM-318-F6: stale child PCA artifact | Fixed `d939b8e`; child schema 2 regenerated; `283e686` supplies parent schema 2 and real validated child-local projection |
| DEM-318-F7: blanket replicate/score claims | Fixed `b74d128`; 52 numeric / 17 no-growth distinction and Seg80-0 −10.286431 vs Table 1 −10.26 exception explicit |
| DEM-318-F8: SD lowercased | Fixed `b74d128`; source acronym display preserved and tested |
| DEM319-F1: indistinguishable replicate choices | Fixed `30b13d5`; source/sample labels in ordinary rows, accessible labels and axis menus; actual 16-source Syn61 regression test |
| DEM319-F2: false compendium pooling disclosure | Fixed `30b13d5`; declared quantities stay individually visible outside the compound/dose compendium, while explicit abundance pooling and legacy fitness compendia remain available |
| DEM319-F3: invalid fitness replicate values admitted | Fixed `30b13d5`; doubling-time replicates positive and absent for no-growth, OD replicates nonnegative; negative/boundary tests |


Read-only evidence comes from pinned source files and the located-quote/hash
manifest in [the dossier](../handoff/recoded_ecoli_evidence__20261007.md), under
[the handoff contract](../../validation/claude-science-handoff.md).

### The paper

Nyerges A, Chiappino-Pepe A, Budnik B, Baas-Thomas M, Rhuby E, Flynn R, Yan S,
Ostrov N, Liu M, Wang M, Zheng Q, Hu F, Chen K, Rudolph A, Chen D, Ahn J,
Spencer O, Ayalavarapu V, Tarver A, Harmon-Smith M, Hamilton M, Blaby I,
Yoshikuni Y, Hajian B, Jin A, Kintses B, Szamel M, Seregi V, Shen Y, Li Z,
Church GM. "Probing the limits of genetic recoding using multi-omics-guided
evolution." *Nat Commun* 2026 Jun 22; 17(1):5311.

| Field | Value |
| --- | --- |
| DOI | `10.1038/s41467-026-74300-9` |
| PMID | `42331836` |
| PMCID | `PMC13287592` |
| Open access | yes, per the Europe PMC `isOpenAccess` field |
| Licence field | `cc by-nc-nd` as returned by the Europe PMC core search record |
| Full text | retrieved 2026-10-07 from `https://www.ebi.ac.uk/europepmc/webservices/rest/PMC13287592/fullTextXML`, 318,246 bytes, read in full |

The licence is recorded because the ledger records one for every source, not
because it gates anything: the owner withdrew the licence-permission rule on
2026-10-06 and every source is permitted with citation. The non-commercial and
no-derivatives terms are noted for the citation entry's wording and because this
source is more restrictive than the CC BY ones already carried.

### What the study measured

Partially recoded strains were built, each carrying a different set of
synthesized ~50 kbp chromosomal segments from the Ec_Syn57 design, up to 45.8%
of the genome in the most complete strain. The design removes all annotated
instances of seven codons together with the corresponding tRNA genes and release
factor I (`prfA`), leaving a 57-codon code. Syn61∆3, from the Chin lab's
separate 61-codon design, and the unmodified parents MDS42 and DH10B are the
controls. These are distinct recoding schemes, not one scheme at different
depths.

Measured layers: transcriptome (RNA-seq), translatome (ribosome profiling),
proteome (LC-MS/MS, including an untargeted search for cryptic ORF-derived
peptides), transcription start sites (Cappable-seq), whole-genome sequencing of
each constructed strain, growth-rate and maximum-OD measurements, and strain
fitness across 480 Biolog Phenotype MicroArray environments.

### Accessibility, settled

The owner asked what could be done if the data were not accessible. Checked on
2026-10-07: **nothing in this source is paywalled, metered, account-gated or
otherwise blocked, and no owner errand is needed.** No item is added to
[AAA-next-steps.md](../../validation/AAA-next-steps.md).

The one route that refused this session was the publisher host
`static-content.springer.com`, HTTP 403 on a direct supplement address. It is
also unnecessary: the Europe PMC bundle carries the same publisher-deposited
files. Retrieved 2026-10-07 and verified by hand:

```sh
curl -o suppl.zip \
  "https://www.ebi.ac.uk/europepmc/webservices/rest/PMC13287592/supplementaryFiles"
```

HTTP 200, `application/zip`, 21,528,360 bytes, 16 members. The download takes
several minutes and returns no progress, which is normal rather than a failure.

| Member | Bytes | SHA-256 | What it is |
| --- | ---: | --- | --- |
| `41467_2026_74300_MOESM1_ESM.pdf` | 8,304,144 | `a08e5fcb4f4f4672017f362acdeba4dcf5aa24ebcf7607735ae3389079642986` | Supplementary Information, including the supplementary notes and figures |
| `41467_2026_74300_MOESM3_ESM.zip` | 7,186,052 | `cde46b0711b55c420d06e51e817201737b7df01f4a84ec08f56f379670b2c4b1` | the Source Data archive: `Ec_Syn57.gb` plus Supplementary Data 1–7 |
| `41467_2026_74300_MOESM6_ESM.xlsx` | 2,456,033 | `7358d6e35afaac0b09ab5975f735c55759672a630ccb2ada2c5534e4e6f98ef4` | not yet inspected |

The remaining members are `MOESM2`, `MOESM4` and `MOESM5` PDFs and the figure
images. Checksums for those are not recorded here because nothing yet depends on
them; recompute at pinning time.

### What is inside the Source Data archive

`MOESM3_ESM.zip` holds eight files, and they answer most of this ticket's data
questions directly.

**`Ec_Syn57.gb`** — 16,757,528 bytes, SHA-256
`8c61aeebfb8fef71a9d01ceba2a2acdb8babdf96ac0aa01aae36b10d08f77f96`. A GenBank
record, `LOCUS Ec_Syn57 3973902 bp DNA circular SYN 09-MAR-2026`, organism
`synthetic Escherichia coli Ec_Syn57`, carrying 3,640 `CDS` and 3,821 `gene`
features. This is the complete 57-codon design, not any one of the partially
recoded strains. **It is the recoded sequence a new codon projection needs**, and
it removes any need to reconstruct a genome from reads.

**`Supplementary_Data_3.xlsx`** — 3,809,265 bytes, SHA-256
`4b14ee8c867394ca67ce44e8d07b3a99e8a88770355a134ba76977830e7d04f0`. Per-gene,
per-replicate RNA-seq and Ribo-seq values, which the Data availability statement
does not mention and which no GEO record carries. Its own legend reads "Source
data for RNA-seq and Ribo-seq experiments". Sheets: `Legend`,
`Seg9-18_36-44_46-49_51-59`, `Seg30-35`, `Seg30-35_debugged`, `Seg70-81`,
`Syn61_delta3_ev5`. Each strain sheet is about 3,641 gene rows and carries gene
name, description, three RNA RPKM replicate columns, three Ribo RPKM replicate
columns, and then `RNA_LFC`, `RNA_LFC_EdgeR`, `RNA_P-value`, `RIBO_LFC`,
`RIBO_LFC_EdgeR`, `RIBO_P-value` and `Delta_LFC`, the last defined in the legend
as log2 fold change in translation efficiency. Replicate-level RPKM plus a
derived fold change and a translation-efficiency term is more than the viewer's
expression layers currently carry from any source.

**`Supplementary_Data_2.xlsx`** — fitness. `Fitness_Source_data` contains 69 populated strain–condition rows (48 growth strains), with doubling time, maximum OD600, their standard deviations and the individual
replicate columns behind each. `Biolog_Source_data` holds only the plate
catalogue: PM1 and PM2 carbon utilisation, PM4 phosphorus and sulfur, PM6
nitrogen, PM9 osmotic and ionic response, 96 wells each, which is where the 480
environments come from. The per-environment values are in eleven further
per-strain sheets, each 96 well rows with `Plate`, `Well`, `Substrate` and
`Max Height` repeated in side-by-side plate blocks, compared against MDS42.

**`Supplementary_Data_1.xlsx`** — ten sheets of constructs, oligonucleotides,
primers, crRNAs, promoter transcriptomics, and strains and plasmids. The sheet
`Selected Genes for recoding` gives 73 genes with the **full DNA sequence of the
recoded variant**, which makes native-to-recoded codon changes directly
computable for those genes without parsing the whole design.

**`Supplementary_Data_4.xlsx`** identified DNA synthesis errors.
**`Supplementary_Data_5.xlsx`** eight per-strain sheets of evolved and
whole-genome-sequencing mutations. **`Supplementary_Data_6.xlsx`** cryptic ORFs
for MDS42 and Syn61 with the MS/MS peptide, the ORF protein and DNA sequence, and
a category by ORF start position. **`Supplementary_Data_7.xlsx`** the Ec_Syn57
troubleshooting record.

### Archive deposits

| Deposit | Status on 2026-10-07 |
| --- | --- |
| SRA `PRJNA1088510` | 74 runs, read from the `runinfo` endpoint. Raw reads only. |
| SRA `PRJNA481586` | the earlier PacBio SMRT-Cappable-seq data reanalysed here; not inspected. |
| MassIVE `MSV000094380` | resolves through the PROXI API, `https://massive.ucsd.edu/ProteoSAFe/proxi/v0.1/datasets?filter=MSV000094380`, HTTP 200. Its own record gives the **ProteomeXchange accession `PXD050905`**, which the article's Data availability statement omits, an FTP location `ftp://massive.ucsd.edu/v07/MSV000094380`, instrument "Q Excative Orbitrap" as spelled in the record, and submitter Bogdan Budnik. The file tree was not listed. |
| GEO / ArrayExpress | **no record.** A GEO DataSets query for `PRJNA1088510` returns 0. Processed per-gene values are in Supplementary Data 3 instead, so this absence costs nothing. |
| Zenodo `10.5281/zenodo.19682030` | genome design scripts for the initial Ec_Syn57 design; not inspected. |
| Addgene | physical DNA for the Ec_Syn57 regions. Material, not data; nothing here depends on it. |

### Assay inventory from SRA

Read from `https://trace.ncbi.nlm.nih.gov/Traces/sra-db-be/runinfo?acc=PRJNA1088510`.
74 runs, 67 Illumina and 7 Oxford Nanopore.

| `LibraryStrategy` | Runs |
| --- | ---: |
| `AMPLICON` | 20 |
| `Ribo-seq` | 18 |
| `ssRNA-seq` | 18 |
| `WGS` | 14 |
| `OTHER` (Cappable-seq) | 4 |

The RNA-seq and Ribo-seq runs are six sample groups at three biological
replicates each, one RNA library and one ribosome-profiling library per
replicate, paired at replicate level by their own sample names:

| Sample group in SRA | What it is |
| --- | --- |
| `MDS` | MDS42, the unmodified parent |
| `Escherichia_coli_DH10B` | DH10B, the unmodified parent of one segment series |
| `E_coli_DH10B_Seg_70-81` | partially recoded, Ec_Syn57 segments 70–81 |
| `MDS42_d_recA_Seg_30-35` | partially recoded, segments 30–35 |
| `MDS42_d_recA_Seg9-18_36-44_46-49_51-59` | partially recoded, the largest segment set profiled |
| `Ec_Syn61d3_ev5` | Syn61∆3, the separate 61-codon scheme, evolved variant 5 |

The 14 WGS runs are Illumina and Nanopore pairs for seven constructed strains,
including four segment sets the omics layers do not cover (`Seg_1-8`,
`Seg_19-29`, `Seg_82-0`, `Seg_9-18_36-59`). Cappable-seq covers MDS42 and the
`Seg_9-18_36-44_46-49_51-59` strain at two samples each. Supplementary Data 2
and 5 name further strains again, including `Seg36-37`, `Seg36-44_46-49` and
`Seg_60-69`, so the strain roster differs between the deposit and the
supplements and has to be reconciled rather than assumed.

Because Supplementary Data 3 carries per-gene values, **no read reprocessing is
required** to display this source. Reprocessing stays available as an
independent check or to add strains the supplement omits, and it would be the
first admitted source to want it.

## Decided 2026-10-07

The owner answered all six questions. Each answer is recorded with what it
commits the build to.

| Id | Decision | What it commits |
| --- | --- | --- |
| Q1 | **One organism record per profiled genome.** Six records: `MDS42`, `DH10B`, the three profiled recoded segment-set strains and `Syn61∆3 ev5`. | The isolation contract is unchanged. Each record gets its own data directory, genome of record, fixed projection and storage keys. No strain dimension is added inside a record, and no map mixes two strains. |
| Q2 | **A design file is admissible as a genome of record, pinned by checksum, and so is a per-strain genome derived from it by segment substitution.** | `Ec_Syn57.gb` is admitted pinned by SHA-256. A derived per-strain genome must be reproducible from pinned inputs and carry its own checksum. This is the first derived genome of record here, so the admission contract needs the rule written into it. |
| Q3 | **Publish both projections, each labelled.** A refit over recoded genes alone, and a projection of recoded genes onto the parent's fixed axes. | Two maps, two validation documents' worth of statements. The shared-axis map must carry, in the interface and not only in a document, that the separation it shows follows from the removed-codon loadings. |
| Q4 | **Admit the fitness data as a new per-strain data type.** Doubling time, maximum OD600 and the 480 Biolog environments. | The first admitted layer whose row unit is not a gene. It needs its own tab or panel and its own absence semantics; it colours no gene and must not appear able to. |
| Q5 | **Admit all three Supplementary Data 3 quantities, separately labelled.** Replicate RPKM, log2 fold change, and the translation-efficiency term. | Three distinct bases, never on a shared scale. A fold change cannot ship until its reference strain is evidenced from the methods, which is dependency D4. |
| Q7 | **Waive the cross-strain coordinate rule for these recoded strains**, since the shared-axis map is for comparison and a recomputed-axes view is always offered. Scoped to these strains and to projection coordinates only. | The shared-axis map is authorised. It must be labelled as the parent's frame, and the recomputed map must stay reachable beside it. The *S. elongatus* sister-strain limit is untouched. |
| Q6 | **Skip the Claude Science second check.** | The queue row is removed from [INDEX.md](INDEX.md). The replacement map gets two independent in-repository derivations instead, which is what "Derived 2026-10-07" reports. |

## Derived 2026-10-07

The paper says seven codons were removed. Which seven, and what replaced them,
is now established from sequence rather than from prose, by
`tools/recoded_scheme.py`. The article was not an input to either derivation; it
is the cross-check.

Both derivations pair a recoded coding sequence against its native counterpart
in the pinned MG1655 assembly `GCF_000005845.2` by gene symbol, and accept the
pair only when the two have equal length and translate to the same protein. That
refusal matters: without it a different allele or gene model would be reported as
recoding. Pairing against MG1655 rather than MDS42 is defensible because MDS42 is
a reduced-genome derivative of MG1655 and the retained genes are the ones that
pair, and the design's 3,973,902 bp length is consistent with an MDS42 parent
rather than the 4,641,652 bp MG1655. The identical-protein requirement is what
makes the pairing safe rather than the strain label.

**Derivation 1, genome-wide.** 3,490 of the design's 3,640 CDS paired. A codon is
a scheme target when its *retention* — its count in the design over its count in
the native pair set — collapses. The observed separation is not marginal:

| Codon | Amino acid | Native | Design | Retention |
| --- | --- | ---: | ---: | ---: |
| AGC | Ser | 17,764 | 50 | 0.0028 |
| AGT | Ser | 9,198 | 36 | 0.0039 |
| TTA | Leu | 15,193 | 82 | 0.0054 |
| TTG | Leu | 15,404 | 110 | 0.0071 |
| AGA | Arg | 1,618 | 27 | 0.0167 |
| AGG | Arg | 890 | 15 | 0.0169 |
| *GTC* | *Val* | *17,189* | *16,389* | *0.9535* |

The seventh target is the amber stop TAG, and it is **derived, not asserted**. A
stop cannot be judged on body-codon retention, so it is judged on terminal-stop
share instead: the design's CDS end in TAA 2,476 times and TGA 1,145 times, and
TAG only 14 times, a 0.39% share, and TAG occurs zero times as an internal
codon. The derived table carries all seven targets with a `basis` column naming
which of the two tests each one passed, so a reader never has to reconcile a
six-row target set against a seven-codon scheme.

GTC is the next codon after the six, at retention 0.9535. The gap between the
highest target and the lowest non-target is a factor of **57**, so the 0.05
threshold in the tool is a calibration rather than a guess, and any threshold
between 0.017 and 0.95 returns the same set. Substitutions below GTC — GTC itself
at 913, CAG at 495, GAG at 384 — are the design's incidental refactoring, not the
scheme.

**Derivation 2, the supplied variants.** 45 of the 73 individually recoded gene
sequences in Supplementary Data 1 paired; the other 28 differ from MG1655 in
protein or length, which is expected for an MDS42-derived design. Over those 45,
505 of 552 substitutions (91.5%) fall on the same six sense codons, in the same
destination order, and **zero target codons remain** inside them. The two
derivations agree on the target set.

### Three findings that change the design

1. **The scheme is not a codon-to-codon map.** Every target has several
   destinations: AGC goes to TCA 54.2% of the time, TCT 22.4%, TCC 11.9% and TCG
   11.6%; TTA and TTG both go mostly to CTT and CTA. `validateSchemeMap` in
   `site/js/core/scheme.js` models a scheme as one codon mapped to one codon, so
   **the Ec_Syn57 scheme cannot be expressed as a preset in the current model**.
   Either the model gains a distribution, or the preset declares target codons
   with a stated representative replacement and says that is what it is. This is
   a property of the published design, not a gap in the derivation.
2. **The design is not finished recoding itself.** 165 genes still carry 659
   target codons, and 14 CDS still end in TAG. Any sentence saying a strain is
   free of a codon is false as stated and must be replaced by the measured
   residual count. The article makes the same point in prose; this is the
   per-gene list behind it.
3. **Ec_Syn57 and Syn61 are in direct conflict.** TCA and TCG, the two serine
   codons Syn61 removes, are the *destinations* Ec_Syn57 prefers: the design
   contains 23,021 TCA and 13,547 TCG internal codons. A gene recoded for
   Ec_Syn57 is therefore *more* forbidden under Syn61, not less. Any interface
   offering both schemes has to make that visible rather than presenting them as
   points on one scale.

Reproduce with:

```sh
tools/fetch_recoded_ecoli.py --verify-only   # confirm the pinned inputs
tools/recoded_scheme.py                      # write the four derived tables
```

The derived tables land in `data/recoded/`: per-codon retention, the substitution
distributions from both derivations, the residual target codons per gene, and
every gene that could not be paired with its reason.

## The problem this ticket had to decide first, and how it was decided

The viewer's published native map is a PCA of 59 relative synonymous codon use
values per CDS, fitted and standardized across that organism's own genes and
held fixed so coordinates stay comparable, per
[pca-length-sensitivity.md](../../validation/pca-length-sensitivity.md). A
recoded CDS has zero occurrences of each removed codon by construction. Fitting
or projecting recoded genes alongside native ones will therefore separate them
along the removed-codon loadings with near-certainty, and that separation would
be a restatement of the design file, not a measurement.

The owner asked for a new PCA map where the codon composition differs. It does
differ, and `Ec_Syn57.gb` supplies the recoded sequence to build it from.

**Decided (Q3): both maps ship, each labelled.** A refit over recoded genes
alone, and a projection of recoded genes onto the parent's fixed axes. The
shared-axis map states in the interface, not only in a validation document, that
its separation follows from the removed-codon loadings. The derivation above
makes that concrete rather than theoretical: six sense codons fall to between
0.3% and 1.7% retention, so the loadings on those six carry the split. A map that
silently recovered the recoding scheme and was then read as a biological result
was the failure mode to avoid, and the label is what avoids it.

Three further structural facts constrain the answer.

1. **Recodedness is per gene and per strain, not per organism.** Each strain
   carries a different segment set, so a given gene is recoded in some profiled
   strains and native in others. Any per-gene mark, colour or projection has to
   name the strain it belongs to.
2. **`Ec_Syn57.gb` is the complete design, and no strain is it.** The profiled
   strains carry between a few segments and 45.8% of it. A projection fitted on
   the full design describes an organism that does not exist yet; a projection
   describing a measured strain needs that strain's own sequence, which is the
   parent genome with its segments swapped in.
3. **None of these strains is the organism already in the viewer.** The E. coli
   record is K-12 MG1655, assembly `GCF_000005845.2`. These strains derive from
   MDS42 and DH10B. The `requireGenomeOfRecord` check in
   `site/js/core/dataset.js` refuses a data directory holding another assembly,
   so this cannot be added as a layer on the MG1655 record. See
   [organism-selector.md](../../validation/organism-selector.md).

The repository already models recoding as a codon-to-codon map in
`site/js/core/scheme.js`, with a `syn61` preset for the three codons removed in
Syn61. The seven-codon Ec_Syn57 scheme is a natural second preset, and it is the
first for which measured data from the actual recoded organism exists rather
than a simulation over native sequence. That connection is the main reason this
source is worth the work: it is the only chance so far to check a simulated
recoding against a real one.

## Owner questions

All six were answered on 2026-10-07; the answers and what each commits are in
"Decided 2026-10-07" above. No owner question is outstanding. The remaining
blockers are evidence and build work, listed under "Dependencies".

## Claude Science claims

**None, and none pending.** No falsifiable scientific claim is asserted here.
The package drafted on 2026-10-07 as P-RECODED-CHECK was withdrawn the same day
by owner decision Q6, and its row is removed from the Pending Claude Science
queue in [INDEX.md](INDEX.md). The id is retired and is not reused.

The reasoning is recorded because the handoff contract makes Claude Science a
last resort: every source this ticket needs was reached from this repository, and
the one derivation a second opinion would have covered — the codon replacement
map — was instead derived twice here from independent inputs, with the two
results agreeing. See "Derived 2026-10-07".

If a later step comes to rest on a specific scientific assumption that cannot be
checked from a source reachable here, add a ticket-local falsifiable claim row
and queue it.

## If the owner wants to spend one email

Not an access blocker, and not needed for anything in this ticket. The one thing
the record does not contain is the per-codon replacement map as a table; it may
have to be derived by diffing the design against the parent. If the owner wants
it from the source instead, the corresponding authors are Akos Nyerges
(`akos_nyerges@hms.harvard.edu`) and George Church
(`gchurch@genetics.med.harvard.edu`), both addresses as printed in the article,
and the proteomics submitter is Bogdan Budnik
(`Bogdan.Budnik@wyss.harvard.edu`) per the MassIVE record. A draft is not
written here because the diff is likely to answer it without anyone's help. If
that derivation fails, this ticket gains the draft and
`AAA-next-steps.md` gains the item.

## Owner-specified interface work, 2026-10-07

Four further requests, recorded with what each depends on. Three of them display
a property of a recoded organism, so they cannot be rendered until at least one
recoded organism record exists. The fourth is the scheme model they display and
is buildable now, so it goes first.

### U1. Distribution schemes in the recoding editor — **shipped 2026-10-07**

Built, tested and rendered. This closes dependency D6 and unblocks U2 and U3.

**The model.** `site/js/core/scheme.js` now accepts a target whose replacement is
a distribution over several synonymous codons with whole-percent shares that must
total 100. A distribution resolves **per occurrence**, counted from the start of
each gene and skipping the start triplet, through a fixed 100-slot rotation that
spreads the shares rather than blocking them. So the same scheme always gives the
same sequence, a gene never depends on another gene, and a gene holding three
occurrences still sees more than one destination. Every destination stays
synonymous, so `verifyProteinsUnchanged` passes and the protein guarantee is
unchanged; it now walks the rotation, so it checks every destination rather than
only the dominant one.

**Backward compatibility.** A single replacement still serializes as `TCG-AGC`,
so every link written before this keeps its meaning. A distribution serializes as
`TCG-AGC:60/AGT:40`, ordered by descending share. A malformed entry is skipped
and a distribution with bad shares is reported by the validator rather than
silently repaired into a different scheme.

**The consumers.** Three places turn a scheme into recoded codons: the live
metric scan, the sequence export and the gene sequence close-up. All three now
resolve per occurrence, and
`tests/js/scheme-distribution-consistency.test.mjs` holds them to agreeing with
each other. Before this they read one lookup table and could not disagree; now
they each walk a rotation, so agreement is tested rather than assumed. A drift
would show a recoded row that is not the sequence its own numbers describe.

**The editor.** Each target row gains a "Spread over several codons" checkbox.
Switching on splits the current replacement with the next synonym the scheme
keeps; switching off keeps the largest share. Neither direction invents or
discards a destination. A spread target opens one row per destination with its
codon and its share, a running total, an add control, and a compact remove that
collapses a two-way spread back to a single replacement.

**A defect found and fixed in rendered testing.** The first build rejected an
out-of-balance share, so typing 20 into a field that had to total 100 showed an
error while the controls still displayed the old numbers. Shares are a
constrained set and an editor should keep them valid rather than scold the user
for a state they were passing through. `rebalanceShares` now absorbs every edit
into the other destinations, clamped so each keeps at least one percent, by
largest remainder so the total is exact. Every control in the panel now produces
a scheme the validator accepts, which is what the editor tests assert.

Two further defects were found in the same pass and fixed: an existing CSS rule
matched every descendant icon button and pulled the share rows' remove control
into the wrong grid column, and the destination dropdowns were clipped by
repeating occurrence counts the panel already showed.

**Implemented 2026-10-08.** Ec_Syn57 aggregate is a simulation preset whose
whole-percentage shares reproduce the observed matched-CDS distribution after
largest-remainder rounding. TAG terminal changes are independently counted
(118 to TAA, 108 to TGA). The visible note disclaims reconstruction of a
published genome and names its conflict with Syn61 serine targets. The Syn61
original-design preset now uses the depositor prescription TCG→AGC, TCA→AGT,
TAG→TAA rather than current-genome frequency prefills.

When editing a scheme, each target codon offers a single replacement codon today.
The editor gains a per-codon choice to make that target a **distribution** rather
than one replacement, which opens advanced settings for the share each
replacement takes. The derivation above is why: the published Ec_Syn57 design
replaces one serine codon with four different synonyms at different loci, so a
one-to-one map cannot express it and `validateSchemeMap` cannot represent it.

Requirements:

- A distribution's shares are explicit and must sum to one. Every destination
  stays synonymous with the target and stays outside the target set, which are
  the two rules `validateSchemeMap` already enforces per entry and must now
  enforce per destination.
- A single-replacement target stays exactly as it is today. The distribution is
  opt-in per codon, never a migration of existing schemes, and the serialized
  form stays backward compatible so every existing link keeps its meaning.
- `verifyProteinsUnchanged` must still pass on a distribution, which it will,
  because every destination is synonymous. The protein guarantee does not weaken.
- A distribution needs a deterministic assignment rule to be applied to real
  sequence at all, since "54% of the time" is not a per-locus instruction. The
  rule must be stated in the interface and be reproducible from the URL, so the
  same scheme always produces the same recoded sequence.

### U2. A "Recoded Genome Scheme" panel at the top of the left column

**Blocked on a recoded organism record existing.**

A new left-column panel, appearing above every existing panel and only for a
recoded organism, which says plainly that the selected dataset comes from a
recoded organism and names its scheme. For a scheme whose replacement is a
distribution, the panel says so rather than implying a one-to-one map, which is
the specific thing the owner asked for.

It carries, per the derivation above: the target codons, the replacement
distribution per target, the residual count of target codons still present, and
the strain's segment set. It must not appear for a native organism, and the two
sweep tests in `organism-isolation.test.mjs` must keep passing, so no sentence in
it may name another organism.

### U3. Colour by residual target codons

**Blocked on a recoded organism record existing.**

A colour source counting, per gene, how many codons the scheme was supposed to
remove are still present. The derivation already produces exactly this as
`data/recoded/ec_syn57_residual_targets.tsv`: 659 codons across 165 genes for the
full design. Most genes score zero, so the ramp has to make a count of one
visible rather than losing it against a mass of zeros, and zero must read as
"recoded as designed" and not as missing data.

It is available only where the organism declares a scheme, and must declare
itself unavailable rather than showing an empty ramp elsewhere.

### U4. Axes for recoded organisms: recalculated, with a second map that is not

Answered from the pipeline, 2026-10-07. **Every organism's axes are already
recalculated and nothing is shared.** `scripts/build_features.py` fits the
`StandardScaler` and the `PCA` on that organism's own RSCU matrix and writes its
own `codon_pca.json`; the two shipping organisms have entirely different
loadings for the same codon. So a recoded organism gets its own refitted axes by
default, which is Q3's first map and needs no new capability.

**Owner decision, 2026-10-07: the cross-strain coordinate rule is explicitly
waived for the recoded *E. coli* strains.** The shared-axis map exists for
comparison, and each recoded organism also offers its own recomputed axes, so a
reader is never confined to the borrowed frame. The waiver is scoped to these
strains and to projection coordinates. It does not touch genomic positional
features and does not extend to the *S. elongatus* sister strains, where
[data-contract.md](../../validation/data-contract.md) limit 1 stands unchanged.

A side agent raised this as a blocker on 2026-10-07. Recorded for accuracy: the
contract text it cited does not in fact bar this map. Limit 1 reads "a positional
feature (TSS, TTS, TIS) transfers as a gene-relative offset against a named
locus, never as an absolute genomic position", which binds genomic coordinates
and not a projection coordinate, and its stated reason is the UTEX/PCC
chromosomal inversion. The owner's waiver settles the question under either
reading, which is why it is recorded rather than argued.

Q3's second map therefore needs new capability, and the obstacles are mechanical
rather than contractual:

1. `codon_pca.json` publishes `explainedVariance`, `loadings` and `nComponents`
   only. It does **not** publish the scaler mean and scale, so the parent's
   standardization cannot be reproduced from what ships. Projecting foreign genes
   onto those axes requires publishing those 59 means and 59 scales.
2. The isolation contract reads data only from the organism's own directory, so a
   recoded organism cannot read its parent's files. The parent's standardization
   and loadings must therefore be shipped *into* the recoded organism's own
   directory as a declared, pinned reference projection, labelled as the parent's
   and never as the recoded organism's own fit.

Until that lands, the honest position is one refitted map per recoded organism.
The shared-axis map ships when D8 does, labelled as the parent's frame, with the
recomputed map always reachable beside it.

## Dependencies

| Id | Prerequisite | Dependent step | Status |
| --- | --- | --- | --- |
| D1 | Owner answers Q1 and Q2 | Create the six organism records and pin their genomes | **met 2026-10-07.** One record per profiled genome; design and derived genomes admissible, pinned by checksum |
| D2 | Owner answers Q3 | Build the two codon projections | **met 2026-10-07.** Refit and shared-axis projection, both labelled |
| D3 | The Ec_Syn57 target set and replacement distribution | The scheme preset and every per-gene recoded mark | **met 2026-10-07** by `tools/recoded_scheme.py`, two independent derivations in agreement. See "Derived 2026-10-07" |
| D4 | The reference strain, units, normalisation and identifier namespace of every Supplementary Data 3 column, read from the methods | Any ingestion of a fold-change or translation-efficiency value | **met with explicit source caveats 2026-10-08.** All five references and distinct quantities verified in the evidence dossier. Exact normalization details remain unspecified; values stay as deposited. Debugged Seg30–35 versus unedited Seg30–35 is not versus MDS42. |
| D5 | A segment-to-coordinate table per strain, from Supplementary Data 2, 3 and 5 reconciled against the SRA roster | Per-strain derived genomes, and marking which genes are recoded in which strain | **open for partial isolates.** Exact Syn61 ev5 accession and 88 design segment features are verified. D5-isolates requires final structural/mutation history and stock sequences; D4-debug-identity requires assay replicate-to-clone mapping. Design intervals contain overlaps and gaps, so no synthetic concatenation is admitted. |
| D6 | A distribution representation in `site/js/core/scheme.js` and its editor | Adding Ec_Syn57 as a selectable scheme preset, and U2's honest description of it | **met 2026-10-07** as U1, shipped with 44 new tests and rendered validation |
| D7 | At least one recoded organism record, which needs D5 for a per-strain genome or the design genome admitted under Q2 | U2's panel and U3's colour source, and any rendered validation of either | **met 2026-10-08.** Exact Syn61∆3(ev5), GCA_028355435.1; U2/U3 have unit tests and four-width rendered validation in DEM-314. |
| D8 | Publishing the scaler mean and scale in `codon_pca.json`, and shipping a parent reference projection into the recoded organism's own directory | Q3's second map, recoded genes on the parent's fixed axes | **implemented; final review pending.** Schema 2 transforms and projector, real MDS42 parent-reference payload and separate browser view shipped in the integration branch. Public MDS42 is explicitly not the exact experimental stock. |

## Work plan

Step 2 is done. Nothing here waits on Claude Science.

1. Pin the Source Data archive and the sheets to be used, recording byte length
   and SHA-256 for each, and establish from the methods the reference strain,
   units, normalisation, annotation and identifier namespace of every column
   intended for display. Record the source location for each. Do not ingest a
   fold change whose reference strain is not evidenced.
2. **Done 2026-10-07.** Derive the replacement map by diffing the design's CDS
   features against the native annotation, and check it against the 73 recoded
   variant sequences, which are an independent witness. Both derivations agree
   on the seven targets; the replacement is a distribution, not a rule, and is
   reported as one. `tools/recoded_scheme.py` with 43 tests.
3. Check the derived Syn61 scheme against the existing `syn61` preset in
   `site/js/core/scheme.js`. Correct the preset or record agreement. Add the
   Ec_Syn57 scheme as a preset only once its map is verified entry by entry,
   since `validateSchemeMap` rejects a map that would change a protein and a
   wrong entry surfaces there rather than silently.
4. Apply the [source ledger](../../validation/source-ledger.md), the
   [admission contract](../../validation/future-data-roadmap.md#admission-contract)
   and the
   [identifier-crosswalk contract](../../validation/annotation-release-readiness.md#identifier-crosswalk-contract).
   Preserve strain, segment, condition and replicate provenance so two strains
   cannot appear as replicates of one another and a recoded value cannot appear
   as a native one.
5. Build the projection Q3 fixes, with its own validation document covering the
   fit basis, the removed-codon loadings, what the separation does and does not
   show, and a reproducible audit in the manner of
   [pca-length-sensitivity.md](../../validation/pca-length-sensitivity.md).
6. Carry the recoding scheme beside the data: every sample, layer, legend, axis,
   export and accessible description that shows a value from this source names
   the strain's scheme and its segment set. Treat a view that shows a recoded
   value without its scheme as a defect, not a polish item.
7. Ship tests with every pipeline and module change, and run the repository
   gates. Any resulting UI work also needs rendered validation at the three
   widths under the `ui-render-inspect-repair` skill; source inspection does not
   close it.

## Verification

Integrated code/data at `d939b8e`: `npm test` **1,327 passed**;
`.venv/bin/python -m pytest -q` **888 passed, 1 skipped, 36 subtests**;
default contract **117 passed / 1 declared spliced-CDS skip**;
Syn61 **92 / 1**, MDS42 **86 / 1**, DH10B **86 / 1**. Follow-on label/citation
repairs `b74d128`: 8 source-ingestion and 13 fitness-panel tests passed.
After `b74d128`, full gates pass: JavaScript **1,328**, Python **890 passed /
1 skipped / 36 subtests**, default contract **117 / 1**, Syn61 **92 / 1**.
`30b13d5` then passes 72 focused JS tests. Final JS rerun: **1,330 passed**. DEM-319 confirms F1/F2/F3 resolved at
`30b13d5` with 93 focused tests and a real-data Chrome recheck. DEM-318 final
confirmation remains pending. `3f9fddd` scopes the scheme panel’s axes sentence
to Native codon space (4 focused tests), avoiding a contradictory description
when the parent-reference tab is selected.

Real app rendered at 375×812, 768×1024, 1280×800 and 1440×900: native/refit,
parent-fixed P-value colouring, LFC-vs-TE axes, aggregate preset and whole-strain
fitness states. Zero page overflow or browser errors. MDS42/DH10B expose no
study omics or child-reference panel. Growth and Biolog downloads retain 69 and
5,280 rows; no-growth numeric fields remain absent. Final corrections were rendered at all four widths: explicit segment fields,
replicate source/axis choices, P-value informing source, revised metadata and
Syn61-only citations; zero page overflow or page errors. Reusable contracts are in `docs/validation/recoded-multiomics.md`,
`recoded-reference-projection.md`, `recoded-parent-reference-records.md`,
`measured-quantity-contract.md` and `strain-fitness.md`.

The Downloads intake prompt was compared with the retained repository handoff;
it added no new evidence and contained the stale ten-file count. The duplicate
Downloads file was deleted at the owner's request; the corrected repository
handoff remains.


**Sources.** Every source fact in "Current State" was read from the named
endpoint on 2026-10-07. The Europe PMC bundle and the Source Data archive were
downloaded and opened, their byte lengths and SHA-256 values computed from the
retrieved files, and the sheet names, dimensions and column headers read from
the workbooks. `Ec_Syn57.gb`'s length, topology and feature counts were counted
from the record. Three bundle members (`MOESM2`, `MOESM4`, `MOESM5`),
`MOESM6_ESM.xlsx`, the MassIVE file tree, the Zenodo deposit and `PRJNA481586`
were **not** inspected, and the tables say so rather than implying otherwise.

**Pinned inputs.** `tools/fetch_recoded_ecoli.py --verify-only` passes: four
members verified against pinned byte length and SHA-256 in
`data/raw/recoded-ecoli`, which is gitignored as a large publisher input in the
manner of the other genome inputs. A changed digest is a hard failure, not a
warning.

**Derivation.** `tools/recoded_scheme.py` ships with
`tests/test_recoded_scheme.py`, 43 tests over synthetic fixtures covering every
function and every branch, including each pairing-rejection reason, the
threshold and ordering behaviour of target detection, both empty branches of the
retention gap, and the command line writing and not writing. A flaw found while
testing is fixed rather than worked around: `main` bound its input paths as
default arguments, so it could not be pointed at other inputs and was therefore
untestable; it now takes them as options. A second flaw is also fixed: the design
reader silently dropped CDS features carrying neither `gene` nor `locus_tag`,
which undercounted the design by two features and the residual TAG stops by one.

**Repository gates**, run on the working tree at 2026-10-07 after these changes.
The counts include concurrent ingestion work by another session in the same
checkout, so they are higher than this ticket's own contribution.

| Gate | Result |
| --- | --- |
| `.venv/bin/python -m pytest -q` | 559 passed, 1 skipped, 36 subtests passed |
| `npm test` | 1,198 passed, 0 failed |
| `.venv/bin/python tools/validate_contract.py` | 116 passed, 0 failed, 1 skipped |
| `npm run check:live-metrics` | every parity and budget check passed; the scan stayed within budget at 19.1 ms for 807,118 codons |

The browser-versus-pipeline parity checks still pass for GC3, CAI, tAI, ENC and
the codon-pair score, which is what shows the rotation did not disturb the
single-replacement path every shipped scheme uses.

**Rendered validation for U1**, against the real application served from `site/`
on a task-scoped port, session `recoded-scheme-u1`:

- A three-way spread driven from the address bar renders its rows, shares,
  running total and note, with no console message of any kind.
- Every interaction exercised in the browser: toggle on, toggle off, add a
  replacement, remove one, and share edits at 1, 20, 99, 500 and -3. Every one
  produced a valid scheme and no error state.
- Widths 375, 768, 1280 and 1440, plus 560 and 561 around the breakpoint that
  was later removed as unnecessary. No document overflow and no element escaping
  the controls column at any width.
- The screenshots are what caught the clipped dropdowns and the hijacked remove
  button; both are fixed and re-captured.

**Boundary.** No dataset is admitted, no ledger row is written, no citation entry
exists and no value from this source is displayed. The derived tables in
`data/recoded/` are evidence for the decisions above, not a published layer.

## Cleanup

Keep this ticket open through the owner answers, the scheme derivation,
admission, the projection build and the scheme labelling. On completion rename
the file and the H1 to `R_...`, set `Status: resolved`, record the final
validation, distill only the reusable guidance into `docs/validation/` — the
recoded-genome admission rule, the projection contract, the scheme-labelling
requirement and the Europe PMC Source Data retrieval route are the reusable
parts — update `validation/INDEX.md`, then delete the resolved ticket and remove
its queue rows. No permanent task history.

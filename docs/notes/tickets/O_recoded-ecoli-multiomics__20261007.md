# O_recoded-ecoli-multiomics__20261007 — Open

- **Scope:** Admit the measured datasets from Nyerges et al., *Nature
  Communications* 2026 (PMID 42331836), which profile partially recoded
  *Escherichia coli* strains built against a 57-codon genetic code. Decide how a
  genome whose codon composition was deliberately changed enters a viewer whose
  maps are fitted on native codon usage, generate the codon projection the
  recoded sequences need, and carry each sample's recoding scheme beside every
  value it produces.
- **Status:** open
- **Opened:** 2026-10-07
- **Updated:** 2026-10-07

Opened at the owner's request on 2026-10-07, with a Claude Science handoff asked
for. **The handoff turned out not to be needed for access.** Every dataset the
request named is public and was retrieved in full by this session; see
"Accessibility, settled" below. The package in this ticket was therefore
rewritten as an independent second check of what the in-repository read already
established, which is the other case the handoff contract allows. The owner may
reasonably decline it.

This is the first source in the repository whose organisms are recoded rather
than native, so it is also the first that tests whether the viewer's codon
metrics and projections mean anything when the codon table they describe is a
design input.

## Current State

Nothing is admitted. No file is pinned in the repository, no ledger row is
written and no code is changed. What follows was read directly from Europe PMC,
NCBI and MassIVE on 2026-10-07 by this repository's agents, under the
last-resort rule in the
[handoff contract](../../validation/claude-science-handoff.md), and is recorded
as retrieval evidence rather than as a dataset decision.

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

**`Supplementary_Data_2.xlsx`** — fitness. `Fitness_Source_data` is 73 strains
by doubling time, maximum OD600, their standard deviations and the individual
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

## The problem this ticket has to decide first

The viewer's published native map is a PCA of 59 relative synonymous codon use
values per CDS, fitted and standardized across that organism's own genes and
held fixed so coordinates stay comparable, per
[pca-length-sensitivity.md](../../validation/pca-length-sensitivity.md). A
recoded CDS has zero occurrences of each removed codon by construction. Fitting
or projecting recoded genes alongside native ones will therefore separate them
along the removed-codon loadings with near-certainty, and that separation would
be a restatement of the design file, not a measurement.

The owner asked for a new PCA map where the codon composition differs. It does
differ, and `Ec_Syn57.gb` supplies the recoded sequence to build it from. The
open question is what the map is fitted on and what it is allowed to claim,
which is Q3. Fix that before building: a map that silently recovers the recoding
scheme and is then read as a biological result is the failure mode to avoid.

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

Answers here, not research, gate the build.

| Id | Question | Why it cannot be decided by an agent |
| --- | --- | --- |
| Q1 | Does each profiled strain become its own organism record with its own `?org=` address, data directory and fixed projection, or does one record carry the strains as selectable variants? | The isolation contract gives one assembly and one projection per record; carrying several strains in one record changes that contract. |
| Q2 | Is `Ec_Syn57.gb` admissible as a genome of record, given it is a publisher-deposited design file and not a RefSeq release? And is a per-strain genome derived from it by segment substitution admissible? | Every genome of record so far is a pinned RefSeq release. The admission contract does not cover a design file or a derived one. |
| Q3 | For the new projection: refit the RSCU PCA on recoded genes alone, project recoded genes onto the parent's fixed axes, or publish both? What sentence does the map carry about the fact that it recovers the recoding scheme? | This decides what the map asserts. No evidence settles it. |
| Q4 | Are the fitness results admissible when their row unit is one strain, or one strain and one environment, with no per-gene value? | Every admitted layer to date is per gene. A per-strain layer is a new data type and a new tab question, as the fitness screens were in [O_fitness-screen-data-type__20261005](O_fitness-screen-data-type__20261005.md). |
| Q5 | Do RPKM values, log2 fold changes against MDS42 and a translation-efficiency term enter as expression layers, and under which basis labels? | Changing what a displayed value means is reserved; these are three different quantities and the viewer's expression layers were not built for fold changes against another strain. |
| Q6 | Is the Claude Science second check below worth sending, now that access is settled and the package would only re-derive what the agents here already read? | The handoff contract allows a second check at the owner's request; whether this one earns the round trip is the owner's call. |

## Claude Science claims

No falsifiable scientific claim is asserted here. P-RECODED-CHECK below is an
independent second check, not a discovery errand, because the sources it covers
were all reached from this repository on 2026-10-07. It is **queued but
explicitly optional**, pending Q6. Its return would confirm or contradict the
inventory above; it admits nothing, settles none of Q1 to Q6 and authorises no
coordinate join. Add a ticket-local claim row if a later step comes to rest on a
specific scientific assumption, and queue it in [INDEX.md](INDEX.md).

## P-RECODED-CHECK: paste-ready Claude Science handoff

Coordinator: interactive Claude session `cyano-contract-audit`; the owner
operates Claude Science and returns the artifacts for intake.
Task: `O_recoded-ecoli-multiomics__20261007`, package P-RECODED-CHECK.
Canonical repository:
`/Users/Rohin/Desktop/coding_stuff/ISAACS-LAB/isaacs-cyano-gene-selection`.
Baseline: `main` at `f590c5b3004d17cda74d46c000ca20f7d59e9794`; ticket and index
additions and unrelated local work may be present. Read-only repository access
is sufficient. Return the files below to the owner. Do not edit code, release
data, tickets or other working-tree files. No child delegation.

**This is a second check.** The agents in this repository already retrieved the
article, the Europe PMC supplementary bundle, the Source Data archive, the SRA
run table and the MassIVE record on 2026-10-07, and their findings are in this
ticket's "Current State". Do not read that section before fetching. Fetch the
sources yourself, derive the answers independently, and only then compare.
Report agreement or name the specific disagreement with your evidence. A
confirmation is a useful result here; so is a contradiction.

### 1. Re-derive the inventory independently

- Retrieve the Europe PMC supplementary bundle for `PMC13287592` and the Source
  Data archive inside it. Report every member with its exact name, byte length
  and SHA-256, and report `Ec_Syn57.gb`'s sequence length, topology, and `CDS`
  and `gene` feature counts.
- For each of Supplementary Data 1 to 7, report its sheet names, the row and
  column counts per sheet, and the column headers. State for each sheet what its
  row unit is and what the values are, in the source's own words where it gives
  them.
- Confirm or contradict that per-gene replicate-level RNA-seq and Ribo-seq values
  are deposited, and that no GEO or ArrayExpress record exists for this study.
  Bound any negative finding to your recorded search.
- Report the MassIVE project's file tree: whether processed protein or peptide
  quantification tables are deposited or only raw and search outputs, the search
  engine and reference database used, and the per-file terms. Confirm the
  ProteomeXchange accession.

### 2. The recoding schemes, exactly

This is the part the viewer needs most and the part the supplements may only
imply.

- For Ec_Syn57, return the **codon-to-codon replacement map**: each removed
  codon, the codon that replaced it, and the amino acid both encode. State
  whether the map is a single global map or context-dependent, and if
  replacement varied by locus, return the rule and the exceptions. Name the
  seven removed codons explicitly and the tRNA genes and release factor removed
  with them. If the map is only recoverable by diffing `Ec_Syn57.gb` against the
  parent annotation, say so and report the observed replacement frequencies
  instead of inventing a rule.
- Do the same for Syn61∆3's three removed codons, so the repository's existing
  `syn61` preset can be checked against the source.
- Return the **segment set per strain**: which Ec_Syn57 segments each strain
  carries, their coordinates on the parent genome, the parent strain, and the
  recoded genome fraction. Reconcile the strain rosters in SRA, Supplementary
  Data 2 and Supplementary Data 5, and map the article's "Strain 1" to
  "Strain 6" labels onto the SRA sample names and the supplement sheet names.
- Return the article's counts of **unassigned or forbidden codons remaining** in
  Syn61 and Syn57, the genes they sit in, and the annotation errors the
  reannotation corrected, including the `tadA` start-codon case. These bound any
  claim that a strain is fully recoded for a codon.

### 3. Samples, replicates and conditions

- For every run in `PRJNA1088510`, return one row: run and experiment
  accessions, BioSample, sample name, strain and segment set, library strategy,
  selection and layout, platform and model, spots, bases, size and release date.
  Group RNA-seq and Ribo-seq rows into replicate-matched pairs and prove the
  pairing from sample identifiers and methods text, not from a shared study.
- Count independent biological replicates per strain and per layer, and state
  which strains have all of transcriptome, translatome and proteome.
- Return the growth and harvest condition per profiled sample: medium recipe,
  carbon source, temperature, aeration, vessel, phase or OD at harvest, harvest
  method, and for Ribo-seq the inhibitor treatment and library protocol. Give the
  source location for each value. Use `not reported` only after reading the
  methods, and distinguish it from `not retrieved`.
- State what each Supplementary Data 3 value is measured against: which strain is
  the reference for every fold change, how RPKM was computed, which annotation
  and assembly the counts are keyed to, and whether the gene identifiers are the
  parent's or the recoded design's. **The repository cannot display a fold change
  without knowing its reference strain**, so this is the highest-value item in
  the package.
- For the proteome, separate protein abundance from synthesis rate, and keep the
  cryptic-ORF peptide search distinct from the quantified proteome.
- For the fitness data, state the readout and units of the Biolog `Max Height`
  column, what the comparison against MDS42 does to the value, how many
  replicates stand behind each well, and the units of the article's per-strain
  fitness scores.

### 4. Return artifacts

UTF-8 TSV with stable IDs plus a Markdown summary, named
`recoded_ecoli_<artifact>__YYYYMMDD`, for owner intake into
`docs/notes/handoff/`:

| Artifact | Row unit and required fields |
| --- | --- |
| `review.md` | Search bounds; your independent inventory; then an explicit agreement-or-disagreement verdict against this ticket's "Current State", item by item; every limitation that bears on displaying these values |
| `schemes.tsv` | One codon per scheme: scheme id, removed codon, replacement codon, amino acid, global or context-dependent, exceptions, source location and quotation |
| `strains.tsv` | One strain: article label, SRA sample name, supplement sheet name, parent strain, segment set, recoded genome fraction, remaining forbidden codons, doubling time and fitness score where reported, layers measured, source location |
| `runs.tsv` | One SRA run: the fields in section 3, plus replicate id and the RNA/Ribo pairing group with its evidence |
| `conditions.tsv` | One condition: the growth and harvest fields above, source location per value, missingness status |
| `files.tsv` | One artifact: deposit, exact URL or accession, filename or member or sheet, version, raw/processed/metadata type, byte length, retrieval date, SHA-256, retrieval status, quoted artifact-level terms and their location, access restrictions |
| `values.tsv` | One column of each Supplementary Data sheet the viewer might display: sheet, header, quantity, units, reference strain, normalisation, annotation and identifier namespace, and the source sentence that establishes it |
| `search.tsv` | One query or screening batch: date, database, exact query, hits returned and screened, inclusion and exclusion reasons, limits |

Attach the retrieved members, or give exact retrieval instructions if
attachments are unavailable. Cite each important count, scheme entry and
condition value with a short quotation, its source location, the retrieval date
and a checksum.

**Acceptance:** the seven-codon replacement map is returned entry by entry with
its source, or its absence from the record is demonstrated; every strain's
segment set and parent are named and the three rosters reconciled; replicate
counts and RNA/Ribo pairing are evidenced per strain; the reference strain,
units and identifier namespace of every displayable column are established; and
the verdict against this ticket's inventory is explicit rather than implied.

Public or owner-provided access only. Before any step needing a credential this
session does not hold, an administrator password, a security or privacy
approval, or an application permission, tell the owner the exact action, the
resource and the reason, then wait for their decision. Do not work around a
denied or pending approval. Evidence is not licence permission, not admission,
not a locus join and not a lab decision.

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

## Dependencies

| Id | Prerequisite | Dependent step | Completion condition |
| --- | --- | --- | --- |
| D1 | Owner answers Q1 and Q2 | Decide where the recoded strains live and what pins their genome | Owner fixes the record shape and the genome-of-record rule |
| D2 | Owner answers Q3 | Build the new codon projection | Owner approves the fit basis and the sentence the map carries |
| D3 | Owner answers Q5 | Ingest the Supplementary Data 3 columns as layers | Owner fixes which quantities enter and under which basis labels |
| D4 | The reference strain, units and namespace of every displayable column are established, by in-repo reading or by P-RECODED-CHECK | Any ingestion of a fold-change or translation-efficiency value | Recorded here with source location and date |

## Work after return, or straight away if the package is declined

Steps 1 to 6 do not wait on Claude Science. Only the second-check verdict does.

1. Pin the Source Data archive and the sheets to be used, recording byte length
   and SHA-256 for each, and establish from the methods the reference strain,
   units, normalisation, annotation and identifier namespace of every column
   intended for display. Record the source location for each. Do not ingest a
   fold change whose reference strain is not evidenced.
2. Derive the Ec_Syn57 codon-to-codon replacement map by diffing the design's
   CDS features against the parent annotation, and check it against the 73
   recoded variant sequences in Supplementary Data 1, which are an independent
   witness to the same map. Report the replacement frequencies and every
   exception rather than asserting a single rule.
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
7. Intake any returned second check: resolve every accession, recompute
   checksums, mechanically re-match quotations, and record the verdict, the
   sources, the date and the checker here. Update the queue row in
   [INDEX.md](INDEX.md).
8. Ship tests with every pipeline and module change, and run the repository
   gates. Any resulting UI work also needs rendered validation at the three
   widths under the `ui-render-inspect-repair` skill; source inspection does not
   close it.

## Verification

Ticket creation verified 2026-10-07 by the interactive Claude session
`cyano-contract-audit`: filename and H1 identifiers match, the status fields are
present, every relative link resolves to an existing file or anchor, and the two
queue entries in [INDEX.md](INDEX.md) were added.

Every source fact above was read from the named endpoint on 2026-10-07. The
Europe PMC bundle and the Source Data archive were downloaded and opened, their
byte lengths and SHA-256 values computed from the retrieved files, and the sheet
names, dimensions and column headers read from the workbooks themselves. The
`Ec_Syn57.gb` length, topology and feature counts were counted from the record.
Three bundle members (`MOESM2`, `MOESM4`, `MOESM5`), `MOESM6_ESM.xlsx`, the
MassIVE file tree, the Zenodo deposit and `PRJNA481586` were **not** inspected,
and the tables say so rather than implying otherwise. The retrieved copies live
in a session scratchpad outside the repository and are not committed; the `curl`
command and the checksums above are what makes the read reproducible.

This change touches documentation only. No code, release data or `site/data`
file is modified, so no repository gate's result changes; the gates were not
re-run for a docs-only addition. No scientific finding, dataset, locus join or
licence permission is admitted by opening this ticket.

## Cleanup

Keep this ticket open through the owner answers, the scheme derivation,
admission, the projection build and the scheme labelling. On completion rename
the file and the H1 to `R_...`, set `Status: resolved`, record the final
validation, distill only the reusable guidance into `docs/validation/` — the
recoded-genome admission rule, the projection contract, the scheme-labelling
requirement and the Europe PMC Source Data retrieval route are the reusable
parts — update `validation/INDEX.md`, then delete the resolved ticket and remove
its queue rows. No permanent task history.

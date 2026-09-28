# Future external-evidence roadmap

This roadmap ranks downloadable evidence that could make the UTEX 2973 gene
selection site more useful. Source identities, accessions, and licences below
were checked against the linked primary records on 2026-09-19. The ranking and
projected product value are architectural judgments; coverage after joining is
unknown until each source passes the admission checks.

Tan et al. 2018 Table S1 gTSS counts and differential-transcription results are
already included. Reprocessing its raw reads for genuine gene-body abundance
would be a separate pipeline and must first verify that the library design
supports that quantity; it is not an unclaimed processed-data download.

The search is no longer gated on finding UTEX 2973-only data. Native data remain
the strongest match, but the project should actively admit useful annotations and
rough quantitative estimates from other *S. elongatus* strains, other
cyanobacteria, and—for sufficiently conserved biology—organisms such as *E. coli*
or explicit ancestral reconstructions. Coverage is valuable when provenance,
mapping, biological distance, and uncertainty remain visible. See the
[cross-organism evidence contract](data-contract.md#evidence-coverage-and-cross-organism-transfer).

PCC 6301, PCC 6311, PCC 7942, PCC 7943, and UTEX 3055 are now admitted sister
strains for annotations, transcriptomics, proteomics, ribosome occupancy, TIS, TSS,
and TTS, under
[the sister-strain rules](data-contract.md#sister-strains-admitted-for-utex-2973-data).
A source in one of those strains and data types is a first-class candidate for this
roadmap rather than a deferred cross-strain overlay. Coordinates still do not
transfer, and each pair of datasets must pass the
[condition-comparability thresholds](data-contract.md#condition-comparability)
before sharing a layer. PCC 6311 and PCC 7943 additionally need the approved RefSeq
crosswalk before a source keyed by their own locus tags can join, and UTEX 3055 has
real gene-content differences that a missing value must not hide.

## Native transcriptomics priority, not gate

Native, replicated, genome-wide *gene-body* expression is the highest-value
missing assay, but it is not a prerequisite for adding a best-available expression
layer. No native source checked on 2026-09-21 meets the direct-measurement admission
contract:

- [Ungerer et al. 2018](https://doi.org/10.1073/pnas.1814912115) includes
  wild-type UTEX 2973 per-gene TPM in PNAS Dataset S1. The authors explicitly
  describe their transcriptome survey as lacking replicates. Its supplement is
  processed-only in the indexed article, a raw-read accession was not identified,
  and dataset redistribution permission needs confirmation. It is an exploratory
  comparison, not a quantitative default.
- [Hassanien et al. 2025](https://doi.org/10.1007/s10123-025-00715-x) assays
  native UTEX 2973 in control, iron, and produced-water conditions, but its
  downloadable ESM4 workbook contains 122 selected gene rows, without a
  genome-wide per-sample matrix or identified raw-read accession. Do not infer
  genome-wide expression from this selected subset.
- [Tan et al. 2018](https://doi.org/10.1186/s13068-018-1215-8) remains the
  priority-1 native TSS source already shipped. It has two biological cultures
  per condition, and its TSS initiation counts must not be relabelled as
  gene-body abundance. The one pooled transcript-coverage library is not a
  replicated expression baseline.

If the Ungerer raw reads and reuse permission or a complete Hassanien sample
matrix become available, verify their sample design and exact UTEX locus joins
before reconsidering. Continue searching for a newly deposited replicated
wild-type UTEX 2973 RNA-seq matrix while also evaluating transferable expression
datasets in progressively broader taxa. Preserve every raw assay as a separate UI
layer; publish any cross-source estimate separately on a documented common scale.

## Admission contract

Every new source needs a manifest entry with organism and strain, assay,
conditions, units, licence, retrieval date, immutable artifact identifier,
checksum, mapping method, orthology relationship, sequence identity/coverage when
applicable, ambiguity, and missingness. Exact accessions, sequence hashes,
coordinates, and cardinality stay deterministic. Cross-organism evidence must
remain visibly transferred; an ancestral reconstruction remains visibly inferred.
A model may help review bounded descriptions or produce a calibrated estimate, but
must not decide licence permission, invent joins, or turn a prediction into a
measurement.

Before publishing a source, report matched, unmatched, and ambiguous rows; inspect
representative joins; preserve one-to-many relationships; add contract and UI
tests; and verify that direct-source nulls remain null. A separate inferred layer
may reduce unknown coverage only when it records its inputs, normalization,
confidence or interval, conflicts, and fallback behavior. Prefer a versioned
offline download over a live request from the static site.

## Ranked candidates

### 1. Native global proteome

- **Value:** add direct protein-detection and, where the deposited tables support
  it, abundance evidence for the target strain. This would separate proteins
  actually observed from RNA-initiation and codon-adaptation proxies.
- **Artifact:** the UTEX 2973/PCC 7942 global proteomics deposit
  [PeptideAtlas PASS00399](http://www.peptideatlas.org/PASS/PASS00399), described
  in the [primary UTEX 2973 study](https://pmc.ncbi.nlm.nih.gov/articles/PMC5389031/).
  The paper reports 1,754 detected UTEX proteins.
- **Join:** deposited accessions and the original search FASTA to exact current
  RefSeq protein accessions or sequence hashes. Preserve shared peptides and
  ambiguous proteins rather than assigning them to one locus.
- **Mode and pin:** download the deposit once; record every selected filename,
  checksum, search database, and processing version. Verify the deposit's
  artifact-level reuse terms before redistributing a derived table.

### 2. Remaining *S. elongatus* pangenome and conservation metadata

- **Value:** expose whether a target is core or variable across close strains
  and add sequence-conservation context. The PCC 7942 essentiality column is
  already admitted separately as borrowed, condition-specific evidence under
  the [PCC essentiality policy](pcc-essentiality.md).
- **Artifact:** Adomako et al. 2022
  [Data Set S1](https://pmc.ncbi.nlm.nih.gov/articles/PMC9239245/), a 1.3 MB XLSX
  covering a 3,079-gene pangenome with 2,632 core genes. The article and
  supplemental datasets are CC BY 4.0.
- **Join:** supplied pangenome/legacy IDs and ortholog groups, confirmed with exact
  sequence or the current ambiguity-preserving protein crosswalk. Never join on
  product text alone.
- **Mode and pin:** reuse the pinned supplemental workbook and its recorded DOI,
  filename, checksum, and sheet schema. Publish conservation separately from
  the already admitted, strain-labelled essentiality calls.

### 3. PCC 7942 iModulons and condition activities

- **Value:** add interpretable co-regulated modules and condition activity instead
  of hundreds of opaque expression columns. Module membership would support
  panels diversified across transcriptional programs.
- **Artifact:** ELPRECISE300, derived from 300 high-quality RNA-seq profiles over
  158 conditions and yielding 57 iModulons. Data and code are in the
  [S.elongatus-iModulons repository](https://github.com/AnnieYuan21/S.elongatus-iModulons)
  and described in the
  [primary paper](https://pmc.ncbi.nlm.nih.gov/articles/PMC11420160/). The
  repository carries an MIT licence; the paper is CC BY-NC-ND 4.0, so a future
  build must use only repository artifacts covered by the MIT grant unless
  separate terms are recorded for a paper supplement.
- **Join:** PCC 7942 locus/accession to the existing exact protein crosswalk, with
  ambiguous and unmapped rows retained. Module activity is PCC 7942 evidence,
  even when the protein sequence matches UTEX 2973.
- **Mode and pin:** download a commit-addressed repository archive and publish
  module weights, memberships, and a curated condition table. Record the commit,
  source-study accessions, thresholds, and transformation used by the authors.

### 4. Protein families, domains, and sequence features

- **Value:** provide a controlled feature-diversity axis and flag conserved sites,
  transmembrane regions, signals, repeats, and disordered segments that a recoding
  plan may need to protect. This avoids guessing broad functions from product
  names.
- **Artifact:** run
  [InterProScan](https://www.ebi.ac.uk/interpro/download/InterProScan/) locally on
  the exact pinned RefSeq protein FASTA. Versioned releases and older archives
  are available; individual member databases can have distinct terms.
- **Join:** exact FASTA identifier plus sequence SHA-256. Keep method, accession,
  coordinates, score, and one-to-many matches.
- **Mode and pin:** download one InterProScan/database release, record all member
  versions and licences, run once offline, and retain the raw result checksum.
  Label the output as computational annotation, not experimental function.

### 5. UTEX 2973 metabolic models and measured fluxes

- **Value:** add enzyme/reaction membership, metabolic subsystem coverage, and
  explicitly model-based reaction criticality. The 13C flux data can distinguish
  reactions carrying measured growth-condition flux from reactions merely
  present in the reconstruction.
- **Artifact:** the native iSyu683 model and supplementary SBML/XLS files from
  [Mueller et al. 2017](https://pmc.ncbi.nlm.nih.gov/articles/PMC5282492/), plus
  the imSyu593 network and supplemental flux tables from the
  [UTEX 2973 fluxome study](https://pmc.ncbi.nlm.nih.gov/articles/PMC6367904/).
  Mueller et al. is CC BY 4.0. The fluxome article is openly readable under
  ASPB journal terms, not a Creative Commons licence; do not redistribute its
  supplemental tables without a recorded rights determination.
- **Join:** model gene-product rules to historical UTEX identifiers, then exact
  protein accession or sequence to the current release. Preserve Boolean AND/OR
  rules and do not flatten protein complexes.
- **Mode and pin:** download the exact supplements with checksums and parse them
  offline only after the applicable reuse terms are recorded. Record model
  version, medium, constraints, objective, solver, and flux units. Keep measured
  flux, model membership, and simulated knockout effects as distinct evidence
  types.

### 6. PCC 7942 transcription units and RNA 3′ ends

- **Value:** replace the site's proximity-only view with evidence for operon
  boundaries and termination architecture, which is directly relevant when
  recoding genes near transcript ends.
- **Artifact:** GEO
  [GSE309256](https://www.ncbi.nlm.nih.gov/geo/query/acc.cgi?acc=GSE309256), a
  Rend-seq study of wild-type and `mfd`-knockout PCC 7942 with processed WIG files
  and raw SRA data; public since 2026-02-23.
- **Join:** PCC genomic coordinates and genes to the pinned PCC annotation, then
  the exact-protein crosswalk to UTEX. Coordinate liftover requires explicit
  synteny and cannot be inferred from same-strand distance.
- **Mode and pin:** download the processed series and metadata, recording GEO/SRA
  accessions and checksums. Verify dataset-specific redistribution terms before
  shipping derived transcription units. Label every mapped boundary as
  cross-strain evidence.

### 7. UTEX 2973 nitrogen-response proteoforms

- **Value:** add native condition-specific protein response and proteoform
  evidence, particularly for nitrogen starvation/recovery and phycobilisome
  biology. This is narrower than the global proteome, but biologically useful for
  stress-diverse panels.
- **Artifact:** PRIDE
  [PXD014590](https://www.ebi.ac.uk/pride/archive/projects/PXD014590), a UTEX 2973
  top-down proteomics deposit whose project metadata declares CC0. It is a
  partial submission, so a ready-to-join quantitative matrix is not assumed.
- **Join:** reported protein accessions or validated full proteoform sequences to
  exact current proteins. Preserve shared-protein ambiguity and proteoform
  identity.
- **Mode and pin:** download only the selected raw/search artifacts after an
  inventory pilot; record filenames, checksums, search FASTA, condition,
  timepoint, and processing version. Start with a small attributable presence
  overlay before considering a new quantitative pipeline.

### Package A candidate register, 2026-09-28

The 57 candidates below passed intake from the Claude Science package A sweep
across the six admitted strains and seven admitted data types (intake recorded in
the offload ticket while it is open; source table
`docs/notes/handoff/cyano_package_A_candidates_20260928.tsv`, SHA-256
`d6f456174fd10cb4cd265a342134de5e5de0d6580ebc0c93fc1d8b149073001f`). They are
candidates, not admitted sources: none has a licence decision, a checksum, or
paper-level condition metadata yet. Those arrive through offload packages B and C,
and a candidate is promoted to a numbered ranked entry above only after both, under
the admission contract. Conditions are quoted from repository metadata only; a
value not stated there is not estimated.

What the sweep established, and the register cannot show: ribosome occupancy,
TIS, TSS, and TTS returned zero new candidates across all six strains (the one TTS
hit, GSE309256, is entry 6 above). PCC 6311, PCC 7943, and UTEX 3055 have no
functional-genomics deposits at all and contribute annotation only. UTEX 2973 has
exactly one public deposit, Tan 2018, already shipped.

| # | Strain | Assay | Artifact | Per-gene table | Mapping route | Conditions as recorded in repository metadata |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | PCC 7942 | transcriptomics (array) | GEO GSE102914; PMID 31161548 | none found (raw only: GSE102914_RAW.tar) | PCC 7942 RefSeq locus tags -> existing exact sh… | incubation medium=EPA Very Soft Water (pH 6.4± 0.3)/EPA Very Soft Water (pH 6.4± 0.3) + 5 mg/L Z-COTE/EPA Very Soft Wat… |
| 2 | PCC 7942 | transcriptomics (RNA-seq) | GEO GSE103462; PMID 29241543 | GSE103462_Expression.xls.gz | PCC 7942 RefSeq locus tags -> existing exact sh… | genotype=rel-/wild type; time point=subjective dawn (CT=0)/subjective dusk (CT=12h) |
| 3 | PCC 7942 | transcriptomics (RNA-seq) | GEO GSE103463; PMID 29241543 | GSE103463_Expression.xls.gz | PCC 7942 RefSeq locus tags -> existing exact sh… | genotype=rel- + relA+/rel- + relAE335Q; time point=subjective dawn (CT=0)/subjective dusk (CT=12h) |
| 4 | PCC 7942 | transcriptomics (RNA-seq) | GEO GSE103606; PMID 29241543 | none found | PCC 7942 RefSeq locus tags -> existing exact sh… | genotype=rel-/rel- + relA+/rel- + relAE335Q/rel- relA+; time point=0 (pre-induction)/1 h/30 min/combined; strain=PCC 79… |
| 5 | PCC 7942 | transcriptomics (RNA-seq) | GEO GSE103644; PMID 29241543 | GSE103644_Expression.xls.gz | PCC 7942 RefSeq locus tags -> existing exact sh… | strain=PCC 7942; genotype=wild type + relA+/wild type + relAE335Q; time point=0 (pre-induction)/1 h/30 min |
| 6 | PCC 7942 | transcriptomics (RNA-seq) | GEO GSE103704; PMID 29241543 | GSE103704_Expression.xls.gz | PCC 7942 RefSeq locus tags -> existing exact sh… | genotype=rel- replicate 1/rel- replicate 2/wild type replicate 1/wild type replicate 2; time point=darkness, 1 h/darkne… |
| 7 | PCC 7942 | transcriptomics (RNA-seq) | GEO GSE104203; PMID 29239721 | none found (raw only: GSE104203_Natural_light_RNAseq_proces… | PCC 7942 RefSeq locus tags -> existing exact sh… | hours since light onset (dawn)=0.5/10/12/2; perturbation=15 minutes in High Light pulse/15 minutes in Shade pulse/15 mi… |
| 8 | PCC 7942 | transcriptomics (RNA-seq) | GEO GSE104204; PMID 29239721 | none found | PCC 7942 RefSeq locus tags -> existing exact sh… | hours since light onset (dawn)=0.5/10/12/2; perturbation=15 minutes in High Light pulse/15 minutes in Shade pulse/15 mi… |
| 9 | PCC 7942 | transcriptomics (RNA-seq) | GEO GSE105774; PMID 29241543 | GSE105774_Expression.xls.gz | PCC 7942 RefSeq locus tags -> existing exact sh… | genotype=rel- relA+/rel- relAE335Q; time point=darkness, 1 h/darkness, 12 h/darkness, 15 min/darkness, 2 h |
| 10 | PCC 7942 | transcriptomics (RNA-seq) | GEO GSE122841; PMID 30619416 | none found (raw only: GSE122841_RAW.tar) | PCC 7942 RefSeq locus tags -> existing exact sh… | strain=PCC 7942; sample type=Cyanobacterial cell; genotype/variation=OsTPX-expressing/wild type; growth condition=norma… |
| 11 | PCC 7942 | transcriptomics (RNA-seq) | GEO GSE140121 | none found (raw only: GSE140121_RAW.tar) | PCC 7942 RefSeq locus tags -> existing exact sh… | strain=PCC 7942; genotype/variation=transgenic microalgae (TA)/wild type; treatment=normal/stressed; 2.5 mM H2O2 at 7 d… |
| 12 | PCC 7942 | transcriptomics (array) | GEO GSE18902; PMID 20018699 | none found (raw only: GSE18902_RAW.tar) | PCC 7942 RefSeq locus tags -> existing exact sh… | experiment=1/2; strain=AMC 408; reference=average of samples in experiment 1/average of samples in experiment 2 |
| 13 | PCC 7942 | transcriptomics (RNA-seq) | GEO GSE205443; PMID 35814646 | GSE205443_Counts.txt.gz | PCC 7942 RefSeq locus tags -> existing exact sh… | cell type=Cyanobacterial cell; strain=PCC 7942; genotype=RB-TnSeq Library 1.0/RB-TnSeq Library 2.0; growth vessel=bubbl… |
| 14 | PCC 7942 | transcriptomics (RNA-seq) | GEO GSE205445; PMID 35814646 | none found (raw only: GSE205445_RAW.tar) | PCC 7942 RefSeq locus tags -> existing exact sh… | cell type=Cyanobacterial cell; strain=PCC 7942; genotype=RB-TnSeq Library 1.0/RB-TnSeq Library 2.0/Wild Type/pilB::Tn5;… |
| 15 | PCC 7942 | transcriptomics (RNA-seq) | GEO GSE222067; PMID 36819058 | GSE222067_counts.xlsx | PCC 7942 RefSeq locus tags -> existing exact sh… | cell type=bacterial cell; genotype=Synpcc7942_0808 locus knocked into ectABC/WT; treatment=0 mM NaCl/300 mM NaCl |
| 16 | PCC 7942 | transcriptomics (RNA-seq) | GEO GSE225426 | none found (raw only: GSE225426_Processed_data_A.xlsx, GSE2… | PCC 7942 RefSeq locus tags -> existing exact sh… | cell type=bacterial cell; genotype=WT; stress=0.4 M NaCl stress for 1 day/0.4 M NaCl stress for 3 day/50 mg/L streptomy… |
| 17 | PCC 7942 | transcriptomics (RNA-seq) | GEO GSE237858; PMID 38739791 | GSE237858_transcript_count_matrix.csv.gz | PCC 7942 RefSeq locus tags -> existing exact sh… | cell type=cyanobacteria; time=collected after 12h in LL (with one 12h dark pulse before); genotype=kaiA over-expression… |
| 18 | PCC 7942 | transcriptomics (RNA-seq) | GEO GSE252562; PMID 39236161 | GSE252562_transcript_count_matrix.csv.gz | PCC 7942 RefSeq locus tags -> existing exact sh… | cell type=bacterial cells; time=collected 1h before midday of their respective photoperiod; genotype=kaiABC knock-out/w… |
| 19 | PCC 7942 | transcriptomics (RNA-seq) | GEO GSE254350; PMID 39188729 | GSE254350_normalized_counts.xlsx | PCC 7942 RefSeq locus tags -> existing exact sh… | cell type=bacterial cell; genotype=pilB-mutant/sigF1-mutant/sigF2-mutant/wild-type |
| 20 | PCC 7942 | transcriptomics (RNA-seq) | GEO GSE311172 | GSE311172_rna_seq_counts.csv.gz | PCC 7942 RefSeq locus tags -> existing exact sh… | cell type=axenic; genotype=cscB-sps; treatment=AD1 biofilm high light 445% O2 air saturation/AD1 high light 0% O2 air s… |
| 21 | PCC 7942 | transcriptomics (RNA-seq) | GEO GSE327989 | GSE327989_TPM_values_260414.csv.gz | PCC 7942 RefSeq locus tags -> existing exact sh… | cell type=PcyX over expression/PebA-PebB over expression/PebS over expression/WT (control) |
| 22 | PCC 7942 | transcriptomics (RNA-seq) | GEO GSE335065; PMID 39455633 | GSE335065_rna_seq_counts_092726.csv.gz | PCC 7942 RefSeq locus tags -> existing exact sh… | cell type=axenic/co-culture; genotype=cscB+ delta-sps/cscB+ delta-sps, WT; treatment=S.e + R.t co-culture day 4/S.e + R… |
| 23 | PCC 7942 | transcriptomics (RNA-seq) | GEO GSE45762; PMID 23919451 | GSE45762_Processed_Counts.xlsx.gz | PCC 7942 RefSeq locus tags -> existing exact sh… | strain=7942/SE01/SE02; genotype=delta-aas/delta-aas, 'tesA/wild type; ffa production=No/Yes |
| 24 | PCC 7942 | transcriptomics (array) | GEO GSE50908; PMID 24315105 | none found (raw only: GSE50908_RAW.tar) | PCC 7942 RefSeq locus tags -> existing exact sh… | strain=rpaA::KmR (EOC 66); time in ll=24 h/28 h/32 h/36 h; reference pool composition=pool of samples 24 h through 72 h… |
| 25 | PCC 7942 | transcriptomics (array) | GEO GSE50919; PMID 24315105 | none found (raw only: GSE50919_RAW.tar, GSE50919_log2_rpaA-… | PCC 7942 RefSeq locus tags -> existing exact sh… | strain=AMC408/rpaA::KmR (EOC 66); time=20-h pool (T = 24, 28, 32, 36, 40, 44 h) |
| 26 | PCC 7942 | transcriptomics (array) | GEO GSE50920; PMID 24315105 | none found (raw only: GSE50920_RAW.tar) | PCC 7942 RefSeq locus tags -> existing exact sh… | strain=kaiBC::CmR Ptrc::kaiBC (EOC72)/rpaA::CmR kaiBC::GmR Ptrc::kaiBC (EOC101); time=24 h/28 h/32 h/36 h |
| 27 | PCC 7942 | transcriptomics (RNA-seq) | GEO GSE50922; PMID 24315105 | none found (raw only: GSE50922_RAW.tar) | PCC 7942 RefSeq locus tags -> existing exact sh… | strain=AMC408/EOC113/EOC339/EOC346; time in ll=24 h/28 h/32 h/36 h; reference pool composition=pool of samples 24 h thr… |
| 28 | PCC 7942 | transcriptomics (RNA-seq) | GEO GSE51112; PMID 24315105 | none found (raw only: GSE51112_RNAseq_ProcessedData.txt.gz) | PCC 7942 RefSeq locus tags -> existing exact sh… | strain=EOC113/EOC339/EOC346; time in ll (zt)=24 hours/28 hours/32 hours/36 hours; time since iptg addition=0 hours/0.5 … |
| 29 | PCC 7942 | transcriptomics (array) | GEO GSE52486; PMID 24315105 | none found (raw only: GSE52486_RAW.tar) | PCC 7942 RefSeq locus tags -> existing exact sh… | strain=wild-type (AMC 408); time in ll=36 h/40 h/44 h/48 h; time=pool of samples 36 h through 64 h; pool construction=E… |
| 30 | PCC 7942 | transcriptomics (array) | GEO GSE59112; PMID 25127221 | none found (raw only: GSE59112_RAW.tar) | PCC 7942 RefSeq locus tags -> existing exact sh… | genotype/variation=WT/cikA null; time point=12h Light/16h Light/20h Light/24h Light |
| 31 | PCC 7942 | transcriptomics (RNA-seq) | GEO GSE79726; PMID 27488818 | none found (raw only: GSE79726_Se7942-N-starv2016.txt.gz) | PCC 7942 RefSeq locus tags -> existing exact sh… | strain=PCC 7942; treatment=Control/N-minus/N-plus; time=24h/48h |
| 32 | PCC 7942 | transcriptomics (RNA-seq) | GEO GSE89999; PMID 28430105 | GSE89999_Expression_timecourse.xls.gz | PCC 7942 RefSeq locus tags -> existing exact sh… | genotype="clock rescue"/rpaA- "clock rescue"; time point=darknes 11 h 50 min/darkness 1 h/darkness 15 min/darkness 2h |
| 33 | Synechococcus elongatus | transcriptomics (RNA-seq) | GEO GSE227397; PMID 37349485 | none found (raw only: GSE227397_RAW.tar) | none | strain=PCC 7942; genotype=WT/del(xpk); treatment=Dark 12hr/Dark 1hr/Light 12 hr/Light 1hr |
| 34 | Synechococcus elongatus | transcriptomics (RNA-seq) | GEO GSE288532; PMID 40055679 | GSE288532_rna_seq_counts.csv.gz | none | cell line=strain PCC 7942 (FACHB-805); genotype=cscB-sps; treatment=day induced sucrose production 0h circadian time 4h… |
| 35 | PCC 7942 | proteomics (LC-MS/MS); | PRIDE PXD000510 | not determined - PRIDE per-project protein listing is not s… | UniProt accession -> exact shared-protein cross… | not reported in PRIDE project metadata; requires paper-level extraction (package B) |
| 36 | PCC 7942 | proteomics (LC-MS/MS); | PRIDE PXD005105 | not determined - PRIDE per-project protein listing is not s… | UniProt accession -> exact shared-protein cross… | not reported in PRIDE project metadata; requires paper-level extraction (package B) |
| 37 | PCC 7942 | proteomics (LC-MS/MS); | PRIDE PXD005851 | not determined - PRIDE per-project protein listing is not s… | UniProt accession -> exact shared-protein cross… | not reported in PRIDE project metadata; requires paper-level extraction (package B) |
| 38 | PCC 7942 | proteomics (LC-MS/MS); | PRIDE PXD010000 | not determined - PRIDE per-project protein listing is not s… | UniProt accession -> exact shared-protein cross… | not reported in PRIDE project metadata; requires paper-level extraction (package B) |
| 39 | PCC 7942 | proteomics (LC-MS/MS); | PRIDE PXD019731 | not determined - PRIDE per-project protein listing is not s… | UniProt accession -> exact shared-protein cross… | not reported in PRIDE project metadata; requires paper-level extraction (package B) |
| 40 | PCC 7942 | proteomics (LC-MS/MS); | PRIDE PXD023591 | not determined - PRIDE per-project protein listing is not s… | UniProt accession -> exact shared-protein cross… | not reported in PRIDE project metadata; requires paper-level extraction (package B) |
| 41 | PCC 7942 | proteomics (LC-MS/MS); | PRIDE PXD027430 | not determined - PRIDE per-project protein listing is not s… | UniProt accession -> exact shared-protein cross… | not reported in PRIDE project metadata; requires paper-level extraction (package B) |
| 42 | PCC 7942 | proteomics (LC-MS/MS); | PRIDE PXD030282 | not determined - PRIDE per-project protein listing is not s… | UniProt accession -> exact shared-protein cross… | not reported in PRIDE project metadata; requires paper-level extraction (package B) |
| 43 | PCC 7942 | proteomics (LC-MS/MS); | PRIDE PXD036717 | not determined - PRIDE per-project protein listing is not s… | UniProt accession -> exact shared-protein cross… | not reported in PRIDE project metadata; requires paper-level extraction (package B) |
| 44 | PCC 7942 | proteomics (LC-MS/MS); | PRIDE PXD044412 | not determined - PRIDE per-project protein listing is not s… | UniProt accession -> exact shared-protein cross… | not reported in PRIDE project metadata; requires paper-level extraction (package B) |
| 45 | PCC 7942 | proteomics (LC-MS/MS); | PRIDE PXD062851 | not determined - PRIDE per-project protein listing is not s… | UniProt accession -> exact shared-protein cross… | not reported in PRIDE project metadata; requires paper-level extraction (package B) |
| 46 | PCC 7942 | proteomics (LC-MS/MS); | PRIDE PXD074299 | not determined - PRIDE per-project protein listing is not s… | UniProt accession -> exact shared-protein cross… | not reported in PRIDE project metadata; requires paper-level extraction (package B) |
| 47 | Synechococcus elongatus | proteomics (LC-MS/MS); | PRIDE PXD011485 | not determined - PRIDE per-project protein listing is not s… | UniProt accession -> exact shared-protein cross… | not reported in PRIDE project metadata; requires paper-level extraction (package B) |
| 48 | Synechococcus elongatus | proteomics (LC-MS/MS); | PRIDE PXD014590 | not determined - PRIDE per-project protein listing is not s… | UniProt accession -> exact shared-protein cross… | not reported in PRIDE project metadata; requires paper-level extraction (package B) |
| 49 | PCC 6301 | annotation (RefSeq PGAP) | RefSeq GCF_000010065.1 | yes - RefSeq feature table / GFF per assembly | own RefSeq locus tags; crosswalk target | not applicable |
| 50 | PCC 6301 | annotation (RefSeq PGAP) | RefSeq GCF_000817325.1 | yes - RefSeq feature table / GFF per assembly | own RefSeq locus tags; crosswalk target | not applicable |
| 51 | PCC 6301 | annotation (RefSeq PGAP) | RefSeq GCF_022984195.1 | yes - RefSeq feature table / GFF per assembly | own RefSeq locus tags; crosswalk target | not applicable |
| 52 | PCC 6311 | annotation (RefSeq PGAP) | RefSeq GCF_022984265.1 | yes - RefSeq feature table / GFF per assembly | own RefSeq locus tags; crosswalk target | not applicable |
| 53 | PCC 7942 | annotation (RefSeq PGAP) | RefSeq GCF_000012525.1 | yes - RefSeq feature table / GFF per assembly | own RefSeq locus tags; crosswalk target | not applicable |
| 54 | PCC 7942 | annotation (RefSeq PGAP) | RefSeq GCF_014698905.1 | yes - RefSeq feature table / GFF per assembly | own RefSeq locus tags; crosswalk target | not applicable |
| 55 | PCC 7942 | annotation (RefSeq PGAP) | RefSeq GCF_030544905.1 | yes - RefSeq feature table / GFF per assembly | own RefSeq locus tags; crosswalk target | not applicable |
| 56 | PCC 7943 | annotation (RefSeq PGAP) | RefSeq GCF_022984345.1 | yes - RefSeq feature table / GFF per assembly | own RefSeq locus tags; crosswalk target | not applicable |
| 57 | UTEX 3055 | annotation (RefSeq PGAP) | RefSeq GCF_003957805.1 | yes - RefSeq feature table / GFF per assembly | own RefSeq locus tags; crosswalk target | not applicable |

## Deferred source families

Rubin PCC 7942 Dataset S3 stays link-only because its redistribution terms
remain unverified; Adomako Data Set S1 now supplies the attributable CC BY 4.0
route to the per-locus calls. KEGG and
CyanoOmicsDB remain excluded until a pinned artifact and applicable redistribution
terms are verified. Rhea's CC BY 4.0 release archives are a useful later option
for deterministic EC-to-reaction candidates, but those mappings would still not
prove pathway activity or flux.

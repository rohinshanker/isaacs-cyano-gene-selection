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

## Native transcriptomics search gate

Native, replicated, genome-wide *gene-body* expression is the highest-value
missing assay, but no source checked on 2026-09-21 meets the admission contract:

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
before reconsidering. Otherwise search for a newly deposited replicated
wild-type UTEX 2973 RNA-seq matrix. Keep all assays separate in the UI.

## Admission contract

Every new source needs a manifest entry with organism and strain, assay,
conditions, units, licence, retrieval date, immutable artifact identifier,
checksum, mapping method, ambiguity, and missingness. Exact accessions, sequence
hashes, coordinates, and cardinality stay deterministic. Cross-strain evidence
must remain visibly borrowed. A model may help review bounded descriptions, but
must not decide licence permission, invent joins, or turn a prediction into a
measurement.

Before publishing a source, report matched, unmatched, and ambiguous rows; inspect
representative joins; preserve one-to-many relationships; add contract and UI
tests; and verify that unknown values remain unknown. Prefer a versioned offline
download over a live request from the static site.

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

### 2. *S. elongatus* pangenome, conservation, and curated metadata

- **Value:** expose whether a target is core or variable across close strains,
  add sequence-conservation context, and reuse the published gene metadata and
  PCC 7942 essentiality annotations without pretending they are native UTEX
  measurements.
- **Artifact:** Adomako et al. 2022
  [Data Set S1](https://pmc.ncbi.nlm.nih.gov/articles/PMC9239245/), a 1.3 MB XLSX
  covering a 3,079-gene pangenome with 2,632 core genes. The article and
  supplemental datasets are CC BY 4.0.
- **Join:** supplied pangenome/legacy IDs and ortholog groups, confirmed with exact
  sequence or the current ambiguity-preserving protein crosswalk. Never join on
  product text alone.
- **Mode and pin:** download the supplemental workbook, record DOI, filename,
  checksum, and sheet schema. Publish conservation and source-specific
  essentiality as separate evidence fields with strain and condition caveats.

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

## Deferred source families

Rubin PCC 7942 Dataset S3 remains valuable, but should stay link-only until the
rights for a redistributed derivative are recorded; the CC BY pangenome workbook
above may supply a safer attributable route to its curated calls. KEGG and
CyanoOmicsDB remain excluded until a pinned artifact and applicable redistribution
terms are verified. Rhea's CC BY 4.0 release archives are a useful later option
for deterministic EC-to-reaction candidates, but those mappings would still not
prove pathway activity or flux.

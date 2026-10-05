# E. coli K-12 MG1655 source evidence dossier, 2026-10-05

Ticket `A_add-ecoli-organism__20261005`, stream 1. Issue DEM-225, corrected under DEM-237 after the independent re-check DEM-231 (section 10 lists every change), with a final follow-up under DEM-244 after the confirmation DEM-241 (section 11). Companion files: `ecoli_source_dossier_20261005.tsv`, one row per candidate, 74 rows; `ecoli_source_dossier_search_manifest_20261005.tsv`, one record per request of the search in section 9.

This dossier is evidence. It admits nothing, grants no licence permission, performs no join and settles no lab question. Those stay with the repository's admission contract, the source ledger and the owner.

## 1. Question and the decision it informs

Quoted from the handoff: "For each evidence layer the UTEX view has or the roadmap wants, find the best candidate sources for MG1655 (or state plainly that a candidate measures another K-12 substrain such as BW25113 or W3110, which matters for essentiality and is a cross-strain transfer here)." And: "Your dossier decides nothing; it gives the owner the evidence to choose which further sources to admit."

Genome of record: RefSeq `GCF_000005845.2` (ASM584v2), sequence `NC_000913.3`, taxid 511145, `b`-number locus tags.

## 2. Method and boundaries

- **How the candidate list was made.** The nine layers come from the handoff. The candidates under each were proposed from the investigator's knowledge of the E. coli literature and then resolved and read: every identifier was resolved by a Europe PMC title search or read from an archive record, and every statement in a row was read from a retrieved file. Nothing in a row rests on memory. Six rows (L5-14 to L5-16, L6-03b, L6-10 and the split-off L6-03a) come from the correction pass: two from the re-check and three from the bounded search recorded in section 9.
- **This is not a systematic archive sweep.** On 2026-10-05 GEO listed 431 series under taxon 511145 (202 of them high-throughput expression profiling) and 731 under taxon 83333; 19 series records were read. The correction pass added a bounded keyword search for layers 5 and 6 only (section 9). A source absent from this dossier was not assessed, which is different from rejected.
- **Retrieval.** A plain `curl` client with its default User-Agent, no account, no API key, no challenge solved, no mirror. Routes: Europe PMC `fullTextXML` and `supplementaryFiles`; NCBI `efetch db=pmc` for the permissions block of records outside the open-access subset; the PMC article page; GEO text records; PRIDE REST v3; the ENA browser and portal APIs; the GitHub and Zenodo APIs; a publisher's static file host; the sources' own public pages.
- **Verification.** 295 quotations were extracted by start and end anchors from the retrieved files and then matched again by a second routine before either deliverable was written (289 by normalised-text, 6 by raw). Each carries a location, and section 6 gives the address, UTC retrieval time and SHA-256 of every file quoted.
- **"Not retrieved" and "not reported".** "Not retrieved" means the source could not be read. "Not reported" means it was read and is silent. They are never merged. "Not extracted" and "not inspected" mean the file was retrieved and that passage or table was not examined in this pass.
- **Counts.** A count of rows is a count of data records: rows after the title and header rows. Where a sheet's physical extent differs, the heading rows are stated. A count of identifiers is of distinct values in the named column, and a cell that lists several identifiers is split first. A table row is not a detection: where a table lists every gene and writes zero for an unquantified one, the row says so.
- **Inspection of tables.** Under the owner's calibration-download decision, tables were downloaded to a scratch directory outside the repository and inspected only: sheet names, row counts, header cells, and how many distinct cells match an identifier pattern (`b####`, `JW####`, `ECK####`, EcoCyc gene id, UniProt accession). No table was joined to the annotation and nothing entered `data/` or `site/`. An `xlrd` reader was installed into that scratch directory to open `.xls` supplements; no repository file or environment was changed.
- **Vocabulary.** Strain match is exact, partial or none. Each row ends with a recommendation to the owner in the evidence-dossier terms: recommend admit, recommend admit with caveat, recommend reject, or insufficient evidence. "Licence standing" applies the source ledger's existing rules as a characterisation only. No source here is admitted: each is a candidate, and where a grant over a file is inferred from an article licence, the row says "inferred".
- **One action to disclose.** To learn what BioCyc serves without an account, one gene page and one web-service call were requested. The BioCyc data licence says that using the web services API signifies assent to its terms. One call was made and none after; see row L7-01. No BioCyc or EcoCyc web-service or API call was made in the correction pass.


## 3. Candidate sources by layer

One block per candidate; the same rows, with every checksum inline, are in the TSV. A row that serves several layers sits under its first layer and is listed again in the others' tables. Back-ticked names after a quotation are retrieved-file keys; section 6 gives each key's address, retrieval time and SHA-256.

### Layer 1: Transcript abundance

The best-supported candidate is PRECISE-1K: a quality-controlled, `b`-number keyed table under an MIT repository licence, with strain and condition recorded per sample. It mixes K-12 substrains, so a displayed layer needs a recorded sample filter. No source was found that is a single, replicated, wild-type MG1655 reference condition published as its own per-gene table under a clear grant, other than as a subset of PRECISE (rows L1-01, L1-02).

| Row | Source | Strain match | Route to b-number | Licence standing | Recommendation |
| --- | --- | --- | --- | --- | --- |
| L1-01 | PRECISE-1K RNA-seq compendium (Lamoureux et al. 2023) | partial (exact for the MG1655 subset; the table mixes K-12 substrains and engineered derivatives) | Direct: the row index is the b-number | Affirmative grant over the repository files (MIT, with the copyright and permission notice retained), following the roadmap … | bring first |
| L1-02 | PRECISE 1.0 source series: MG1655 reference-condition RNA-seq (Sastry et al. 2019) | partial (MG1655 samples are separable by the GEO `strain` field) | Not established for the GEO files in this pass; the PRECISE-1K table (row L1-01) already carries these … | Affirmative grant by the ledger's GEO rule: the article is CC BY 4.0, taken as the grant over its deposited data; derived … | bring second |
| L1-03 | iModulonDB (modules and activities computed from PRECISE) | partial | Not established; the matrices sit beside the b-number keyed expression table in SBRG/precise1k | The articles are CC BY 4.0; the module matrices in SBRG/precise1k fall under that repository's MIT licence | supporting |
| L1-04 | Li et al. 2014 mRNA-seq and ribosome profiling (see row L6-02) | exact | None for mRNA: a per-gene value would have to be computed from the WIG tracks, which is reprocessing, not a … | No grant: the article is "All rights reserved" with a text-mining notice, so by the ledger rule the GEO files stay link-only | link-only |
| L1-05 | Tjaden 2023 transcriptome assembly from an RNA-seq compendium | none established | not established | Article CC BY 4.0; repository GPL-3.0 (copyleft over the repository files) | supporting |
| L1-06 | Balakrishnan et al. 2022 absolute mRNA and protein (NCM3722) | none (a different K-12 strain: a cross-strain transfer here) | not established | No grant (text-mining notice only): link-only by the ledger rule | link-only |

#### L1-01: PRECISE-1K RNA-seq compendium (Lamoureux et al. 2023)

- **Identifiers:** PMID 37713610; PMCID PMC10602906; DOI 10.1093/nar/gkad750; GitHub SBRG/precise1k commit 4829b83ace51ee7980de6950077f1cf8f3746f88; Zenodo DOI 10.5281/zenodo.8284223 (v1.0); files data/precise1k/log_tpm_qc.csv and data/precise1k/metadata_qc.csv
- **Measures:** Gene-body transcript abundance by RNA-seq, 1,035 samples by 4,257 genes. **Units:** log2[TPM], as the article and the repository README label it (see Inspected for the zeros in the file).
- **Strain:** K-12; metadata_qc.csv `Strain` column: MG1655 582, GMOS 241, BW25113 160, DGF-298 26, W3110 26 samples; 166 samples carry the description "Escherichia coli K-12 MG1655". **Match to MG1655:** partial (exact for the MG1655 subset; the table mixes K-12 substrains and engineered derivatives).
- **Conditions:** Per-sample metadata columns (Base Media, Temperature, Carbon Source, Supplement, Growth Rate, and others); Base Media M9 825, Medium C 122, LB 36; reference condition is log-phase growth in M9 glucose (samples p1k_00001, p1k_00002). **Replicates:** Replicate id per sample (`rep_id`, `Biological Replicates` columns); replicate Pearson correlation of at least 0.95 required for inclusion; reference condition n=2.
- **Identifier namespace:** b-number locus tags (all 4,257 row ids match b####). **Route to b-number:** Direct: the row index is the b-number. gene_info.csv states it is assembled from RefSeq NC_000913.3; genes dropped by the authors (short or very low expression) are absent, not zero.
- **Terms, verbatim:**
  - "MIT License Copyright (c) 2022 Systems Biology Research Group" (LICENSE file at the pinned commit (governs the repository files); `p1k_LICENSE.txt`)
  - "This is an Open Access article distributed under the terms of the Creative Commons Attribution-NonCommercial License ( https://creativecommons.org/licenses/by-nc/4.0/ ), which permits non-commercial re-use, distribution, and reproduction in any medium, provided the original work is properly cited. For commercial re-use, please contact journals.permissions@oup.com" (PMC10602906 Europe PMC fullTextXML, &lt;permissions>/&lt;license>; `epmc_ft_precise1k.xml`)
- **Strain, condition and identity evidence, verbatim:**
  - "Following this processing and QC workflow, 1035 high-quality RNA-seq samples (each with 4257 gene expression measurements) remained. These samples and their metadata define PRECISE-1K." (PMC10602906 full text, Materials and Methods; `epmc_ft_precise1k.xml`)
  - "was centered to the control condition (log-phase growth in M9 minimal media with glucose; sample IDs ‘p1k_00001’ and ‘p1k_00002’)" (PMC10602906 full text, iModulon computation; `epmc_ft_precise1k.xml`)
  - "This repository contains data and code necessary for assembling the PRECISE-1K _E. coli_ K-12 MG1655 expression and transcriptional regulation knowledgebase" (README.md line 3 at the pinned commit; `p1k_README.md`)
- **Inspected:** log_tpm_qc.csv (60,884,226 B): one header row; 1,035 sample columns, 4,257 gene rows, 4,257 ids match b####. Its minimum value is 0.0 and 104,514 of its 4,405,995 values are exactly 0, which a logarithm of TPM without a pseudocount would not give for an unexpressed gene; the passages read call the unit log2[TPM] and do not state a pseudocount (not reported). metadata_qc.csv: one header row, 1,035 sample records, 43 columns. Rows p1k_00001 and p1k_00002: condition wt_glc, Escherichia coli K-12 MG1655, M9, glucose(2), 37 °C. File checksums: section 6.2.
- **Without an account:** Yes (GitHub raw at a commit; Zenodo record public)
- **Limitations:** Mixed substrains and many mutants and evolved isolates in one table, so a per-condition layer needs a sample filter recorded in the manifest. Values are log2[TPM] from the authors' pipeline, not counts, and whether 1 was added before the logarithm is not stated in the passages read. 4,257 gene rows against 4,290 protein-coding genes in the annotation; which genes are absent was not determined here (no join performed). The 1,675-sample "Public K-12" log-TPM table is not in the repository.
- **Licence standing (a characterisation, not a decision):** Affirmative grant over the repository files (MIT, with the copyright and permission notice retained), following the roadmap precedent of using only repository artifacts covered by an MIT grant. The article itself is CC BY-NC 4.0, which does not govern the repository files.
- **Recommendation:** bring first; recommend admit with caveat. Largest quality-controlled per-gene table for this strain, b-number keyed, MIT over the files, commit- and DOI-pinned, per-sample condition metadata and replicates.

#### L1-02: PRECISE 1.0 source series: MG1655 reference-condition RNA-seq (Sastry et al. 2019)

- **Identifiers:** PMID 31797920; PMCID PMC6892915; DOI 10.1038/s41467-019-13483-w; GEO GSE122211 (file GSE122211_all_tpm.csv.gz), GSE122295 (GSE122295_all_tpm.csv.gz), GSE122296 (GSE122296_merged_tpm.csv.gz); GitHub SBRG/precise-db
- **Measures:** Gene-body transcript abundance by RNA-seq; 278 profiles in the compendium. **Units:** TPM in the GEO supplementary tables (file names `*_tpm.csv.gz`; not downloaded). The article's Methods define the final compendium as log2(TPM + 1), "referred to as log-TPM". The copy of PRECISE 1.0 kept in SBRG/precise1k (`data/precise/log_tpm.csv`) is labelled "log2[TPM]" by that repository's README and was not opened, so the pseudocount is established for the article's compendium, not for that file.
- **Strain:** MG1655 and BW25113 (GSE122211: MG1655 5, BW25113 7 samples; GSE122295: MG1655 28, BW25113 2; GSE122296: seven E. coli strains, 2 each). **Match to MG1655:** partial (MG1655 samples are separable by the GEO `strain` field).
- **Conditions:** M9 minimal medium with 0.2% or 2 g/L glucose as the base condition, plus alternative carbon sources, anaerobic and supplemented variants (GEO `media` field). **Replicates:** Not stated per condition in the series records read; the article reports median R2 = 0.98 between biological replicates.
- **Identifier namespace:** Not inspected in the GEO tables (not downloaded); the same data in SBRG/precise1k data/precise/log_tpm.csv. **Route to b-number:** Not established for the GEO files in this pass; the PRECISE-1K table (row L1-01) already carries these samples under b-numbers.
- **Terms, verbatim:**
  - "https://creativecommons.org/licenses/by/4.0/ Open Access This article is licensed under a Creative Commons Attribution 4.0 International License, which permits use, sharing, adaptation, distribution and reproduction in any medium or format, as long as you give appropriate credit to the original author(s) and the source, provide a link to the Creative Commons license, and indicate if changes were made." (PMC6892915 Europe PMC fullTextXML, &lt;permissions>/&lt;license>; `epmc_ft_precise1.xml`)
  - "Therefore, NCBI itself places no restrictions on the use or distribution of the data contained therein. Nor do we accept data when the submitter has requested restrictions on reuse or redistribution." (NCBI Policies and Disclaimers page, section "Molecular Data Usage"; `ncbi_policies.html`)
- **Strain, condition and identity evidence, verbatim:**
  - "comprises 278 RNA-seq expression profiles across 154 unique experimental conditions for E. coli K-12 MG1655 and BW25" (PMC6892915 full text, Results; `epmc_ft_precise1.xml`)
  - "!Sample_characteristics_ch1 = strain: MG1655" (GEO GSE122211 sample records; `geo_GSE122211_gsm.txt`)
  - "!Sample_characteristics_ch1 = media: M9 minimal media w/ 0.2% glucose" (GEO GSE122211 sample records; `geo_GSE122211_gsm.txt`)
  - "The final expression compendium was log-transformed log 2 (TPM + 1) before analysis, referred to as log-TPM." (PMC6892915 full text, Methods, RNA-seq processing; `epmc_ft_precise1.xml`)
- **Inspected:** GEO series and sample records only; supplementary tables not downloaded.
- **Without an account:** Yes (GEO FTP)
- **Limitations:** Superseded in scope by PRECISE-1K, which includes it. Useful as the CC BY, GEO-deposited route to the same reference condition.
- **Licence standing (a characterisation, not a decision):** Affirmative grant by the ledger's GEO rule: the article is CC BY 4.0, taken as the grant over its deposited data; derived per-gene table with attribution, GEO file fetched at build under a checksum pin.
- **Recommendation:** bring second; recommend admit with caveat. A small, well-described MG1655 M9-glucose reference condition under a CC BY article, if the owner prefers one named condition to a compendium.

#### L1-03: iModulonDB (modules and activities computed from PRECISE)

- **Identifiers:** PMID 33045728 (PMCID PMC7778901, DOI 10.1093/nar/gkaa810); PMID 39494532 (PMCID PMC11701608, DOI 10.1093/nar/gkae1009); site https://imodulondb.org
- **Measures:** Independent-component modules (gene weights) and per-sample activities derived from the PRECISE tables; a model output, not a measurement. **Units:** unitless ICA weights and activities.
- **Strain:** As PRECISE (MG1655 and BW25113). **Match to MG1655:** partial.
- **Conditions:** As the underlying compendium. **Replicates:** not applicable (derived).
- **Identifier namespace:** not inspected (data/precise1k/M.csv is listed in the repository tree and was not opened). **Route to b-number:** Not established; the matrices sit beside the b-number keyed expression table in SBRG/precise1k.
- **Terms, verbatim:**
  - "This is an Open Access article distributed under the terms of the Creative Commons Attribution License ( https://creativecommons.org/licenses/by/4.0/ ), which permits unrestricted reuse, distribution, and reproduction in any medium, provided the original work is properly cited." (PMC11701608 Europe PMC fullTextXML, &lt;permissions>/&lt;license>; `epmc_ft_imodulondb2.xml`)
- **Strain, condition and identity evidence, verbatim:**
  - "`M.csv`: the iModulon M (modulon) matrix computed for the Public K-12 dataset" (README.md at the pinned commit; `p1k_README.md`)
- **Inspected:** https://imodulondb.org/about.html returned a 915-byte script shell; no terms text is present in the retrieved HTML (site terms: not retrieved).
- **Without an account:** Site is script-rendered; repository files need no account
- **Limitations:** Inferred layer: must be labelled `inferred`, never a measurement. Site terms not retrieved.
- **Licence standing (a characterisation, not a decision):** The articles are CC BY 4.0; the module matrices in SBRG/precise1k fall under that repository's MIT licence. Site terms undetermined.
- **Recommendation:** supporting; insufficient evidence. Corresponds to roadmap item 3 for the cyanobacterial view; worth a later row of its own, after the expression table is admitted.

#### L1-04: Li et al. 2014 mRNA-seq and ribosome profiling (see row L6-02)

- **Identifiers:** PMID 24766808; PMCID PMC4006352; DOI 10.1016/j.cell.2014.02.033; GEO GSE53767 (files GSE53767_mrna-rdm-pooled_f.wig.gz, _r.wig.gz and four ribosome-footprint WIG files)
- **Measures:** mRNA-seq read density (one sample) alongside ribosome footprints (three samples). **Units:** WIG read density per position; no per-gene mRNA table deposited in GEO.
- **Strain:** MG1655 (GEO `strain` field, 4 of 4 samples). **Match to MG1655:** exact.
- **Conditions:** Fully supplemented MOPS glucose medium (2 samples) and minimal MOPS glucose medium (2 samples), per GEO `media` field. **Replicates:** One RNA-seq library in the series (library strategy RNA-Seq 1, OTHER 3); pooled tracks.
- **Identifier namespace:** Genomic coordinates (reference version not stated in the passages read). **Route to b-number:** None for mRNA: a per-gene value would have to be computed from the WIG tracks, which is reprocessing, not a join.
- **Terms, verbatim:**
  - "This file is available for text mining. It may also be used consistent with the principles of fair use under the copyright law." (PMC4006352 NCBI efetch db=pmc, &lt;permissions>/&lt;license>; `ncbi_pmc_li2014.xml`)
  - "Therefore, NCBI itself places no restrictions on the use or distribution of the data contained therein. Nor do we accept data when the submitter has requested restrictions on reuse or redistribution." (NCBI Policies and Disclaimers page, section "Molecular Data Usage"; `ncbi_policies.html`)
- **Strain, condition and identity evidence, verbatim:**
  - "!Sample_characteristics_ch1 = strain: MG1655" (GEO GSE53767 sample records; `geo_GSE53767_gsm.txt`)
  - "!Sample_characteristics_ch1 = media: fully supplemented MOPS glucose media" (GEO GSE53767 sample records; `geo_GSE53767_gsm.txt`)
- **Inspected:** GEO series and sample records only.
- **Without an account:** Yes (GEO FTP)
- **Limitations:** Single unreplicated mRNA library; processed files are coverage tracks, not a per-gene table.
- **Licence standing (a characterisation, not a decision):** No grant: the article is "All rights reserved" with a text-mining notice, so by the ledger rule the GEO files stay link-only.
- **Recommendation:** link-only; recommend reject. Unreplicated, no per-gene mRNA table, no grant. Listed because it is the classic MG1655 reference condition.

#### L1-05: Tjaden 2023 transcriptome assembly from an RNA-seq compendium

- **Identifiers:** PMID 36920168; PMCID PMC10392735; DOI 10.1080/15476286.2023.2189331; GitHub btjaden/Compendium (GPL-3.0 per the GitHub API; last push 2022-11-30)
- **Measures:** Transcript and operon structures assembled computationally from public RNA-seq; not opened beyond the licence and repository record. **Units:** not read.
- **Strain:** not reported in the passages read. **Match to MG1655:** none established.
- **Conditions:** not read. **Replicates:** not read.
- **Identifier namespace:** not read. **Route to b-number:** not established
- **Terms, verbatim:**
  - "This is an Open Access article distributed under the terms of the Creative Commons Attribution License ( http://creativecommons.org/licenses/by/4.0/ ), which permits unrestricted use, distribution, and reproduction in any medium, provided the original work is properly cited. The terms on which this article has been published allow the posting of the Accepted Manuscript in a repository by the author(s) or with their consent." (PMC10392735 Europe PMC fullTextXML, &lt;permissions>/&lt;license>; `epmc_ft_tjaden2023.xml`)
- **Inspected:** Article XML retrieved; only the permissions block and the repository URL were read. Repository licence from https://api.github.com/repos/btjaden/Compendium.
- **Without an account:** Yes
- **Limitations:** A computational assembly; would be an `inferred` layer. Body not assessed in this pass.
- **Licence standing (a characterisation, not a decision):** Article CC BY 4.0; repository GPL-3.0 (copyleft over the repository files).
- **Recommendation:** supporting; insufficient evidence. Recorded so the reviewer can see it was met and not assessed.

#### L1-06: Balakrishnan et al. 2022 absolute mRNA and protein (NCM3722)

- **Identifiers:** PMID 36480614; PMCID PMC9804519; DOI 10.1126/science.abk2066; GEO GSE205717 (file GSE205717_Processed_data_Table_S3.xlsx)
- **Measures:** RNA-seq transcript abundance; the article also names accessions PXD014948 and PASS01421. **Units:** not inspected.
- **Strain:** NCM3722 and derivatives (GEO `strain` field: NCM3722 21, NQ1390 12, NQ393 8, NQ1243 4); not MG1655. **Match to MG1655:** none (a different K-12 strain: a cross-strain transfer here).
- **Conditions:** Includes rifampicin time courses (GEO field `time after_rifampicin_addition_(minutes)`); not extracted further. **Replicates:** not extracted.
- **Identifier namespace:** not inspected. **Route to b-number:** not established
- **Terms, verbatim:**
  - "This file is available for text mining. It may also be used consistent with the principles of fair use under the copyright law." (PMC9804519 NCBI efetch db=pmc, &lt;permissions>/&lt;license>; `ncbi_pmc_balakrishnan2022.xml`)
  - "Therefore, NCBI itself places no restrictions on the use or distribution of the data contained therein. Nor do we accept data when the submitter has requested restrictions on reuse or redistribution." (NCBI Policies and Disclaimers page, section "Molecular Data Usage"; `ncbi_policies.html`)
- **Strain, condition and identity evidence, verbatim:**
  - "!Sample_characteristics_ch1 = strain: NCM3722" (GEO GSE205717 sample records; `geo_GSE205717_gsm.txt`)
- **Inspected:** GEO series and sample records only.
- **Without an account:** Yes (GEO FTP)
- **Limitations:** Measured in NCM3722. Article carries only a text-mining notice.
- **Licence standing (a characterisation, not a decision):** No grant (text-mining notice only): link-only by the ledger rule.
- **Recommendation:** link-only; recommend reject. Wrong substrain and no grant.

### Layer 2: Transcription start sites and promoters

Two measured MG1655 TSS tables sit in CC BY articles and have a retrievable per-site file (rows L2-02, L2-03); the first article also carries an explicit CC0 data clause, and for the second the grant over the file is inferred from the article licence (section 4.5); the three-condition dRNA-seq set is all rights reserved (L2-01). The curated promoter set is RegulonDB's, whose terms forbid redistribution (L2-05), and EcoCyc's, which is redistributable once its licence is executed (L7-01). Every measured table except Yan 2018 is on a superseded sequence version or does not state its version.

| Row | Source | Strain match | Route to b-number | Licence standing | Recommendation |
| --- | --- | --- | --- | --- | --- |
| L2-01 | Thomason et al. 2015 dRNA-seq transcription start sites | exact | Positional: coordinates are on NC_000913.2 and the genome of record is NC_000913.3, so a version conversion … | No grant: article all rights reserved, so the GEO files stay link-only by the ledger rule | link-only |
| L2-02 | Ettwiller et al. 2016 Cappable-seq transcription start sites | exact | Positional: U00096.2 coordinates need conversion to NC_000913.3 before a TSS can be assigned to a b-number by … | Article CC BY 4.0 with an explicit CC0 data clause | bring first |
| L2-03 | Kim et al. 2012 genome-wide TSS profiling | exact | Direct for the gene assignment the authors made (b-number column) | Inferred from the article licence (CC BY; the XML licence link is CC BY 4.0); no file-level grant shown | bring second |
| L2-04 | Yan et al. 2018 SMRT-Cappable-seq full-length primary transcripts | exact | Direct: operon rows list member genes as b-numbers, and coordinates are already on the genome of record | Inferred from the article licence (CC BY 4.0); no file-level grant shown | bring first (layer 3); bring second (layer 2) |
| L2-05 | RegulonDB PromoterSet (curated promoters and TSS) | partial | Gene name to b-number through RegulonDB's own `GeneProductSet` file (columns geneName and bnumber; 4,829 … | No affirmative grant to redistribute: the EULA quoted here forbids distribution, derivative works and integration into another … | link-only pending written consent |
| L3-02 | Conway et al. 2014 operon architecture by RNA-seq | partial (a K-12 derivative; its relation to MG1655 was not read in the article) | Gene name to b-number (name-based, ambiguity must be reported) or positional after conversion from U00096.2 | Article CC BY-NC-SA 3.0 (non-commercial, share-alike); a grant over the supplementary tables is inferred from it | supporting |
| L4-02 | Cho et al. 2014 sigma-factor network by ChIP-chip | exact | Direct where the authors assigned genes (b-number column); positional otherwise, after the reference version … | Article CC BY 2.0 with an explicit CC0 data clause | bring first (layer 4, measured) |
| L7-01 | EcoCyc (BioCyc Tier 1 curated database for E. coli K-12 MG1655) | exact | EcoCyc gene id to b-number through the pinned RefSeq GFF: all 4,651 gene and pseudogene features carry … | Affirmative grant with conditions for EcoCyc specifically: the BioCyc limited-use licence defines "Open Databases" as the EcoCyc … | bring first |

#### L2-01: Thomason et al. 2015 dRNA-seq transcription start sites

- **Identifiers:** PMID 25266388; PMCID PMC4288677; DOI 10.1128/JB.02096-14; GEO GSE55199 (22 samples; GSE55199_RAW.tar); SRA SRP038698
- **Measures:** Primary 5' ends by differential RNA-seq (dRNA-seq); 14,868 TSS candidates predicted. **Units:** TSS positions; GEO holds GSE55199_RAW.tar, contents not opened.
- **Strain:** MG1655 (GEO `strain` field, 22 of 22 samples). **Match to MG1655:** exact.
- **Conditions:** 37 °C; LB to OD600 about 0.4 and 2.0, M63 minimal glucose to OD600 about 0.4. **Replicates:** Two independent biological replicates per condition.
- **Identifier namespace:** Genomic coordinates on NC_000913.2; no per-TSS table was found in the retrieved article text, and the supplement was not retrieved. **Route to b-number:** Positional: coordinates are on NC_000913.2 and the genome of record is NC_000913.3, so a version conversion is required before any b-number assignment. Adams et al. 2021 (row L3-03) documents a sequence-anchored conversion to NC_000913.3; no ready conversion table was found.
- **Terms, verbatim:**
  - "Copyright © 2015, American Society for Microbiology. All Rights Reserved." (PMC article page PMC4288677, copyright line under the author block; `pmc_page_thomason2015.html`)
  - "Therefore, NCBI itself places no restrictions on the use or distribution of the data contained therein. Nor do we accept data when the submitter has requested restrictions on reuse or redistribution." (NCBI Policies and Disclaimers page, section "Molecular Data Usage"; `ncbi_policies.html`)
- **Strain, condition and identity evidence, verbatim:**
  - "we collected two independent biological replicates (B1 and B2 samples) from MG1655 wild-type cells" (PMC4288677 article page, Results; `pmc_page_thomason2015.html`)
  - "Cells were grown at 37°C in LB (10 g of tryptone, 5 g of yeast extract, 10 g of NaCl per liter) or M63 minimal glucose medium (supplemented with final concentrations of 0.001% vitamin B 1 and 0.2% glucose) to an optical density at 600 nm (OD 600 ) of ∼0.4 and 2.0 for LB and an OD 600 of ∼0.4 for M63." (PMC4288677 article page, Materials and Methods, Growth conditions; `pmc_page_thomason2015.html`)
  - "were mapped to the E. coli MG1655 genome (NCBI accession no. NC_000913.2 [24 June 2004])" (PMC4288677 article page, Materials and Methods, Read mapping; `pmc_page_thomason2015.html`)
  - "we predicted 14,868 TSS candidates, including 5,574 internal to annotated genes (iTSS) and 5,495 TSS corresponding to potential antisense RNAs (asRNAs)." (PMC4288677 article page, Abstract; `pmc_page_thomason2015.html`)
- **Inspected:** GEO records read. Supplementary TSS tables not retrieved: Europe PMC supplementaryFiles refuses a non-open-access record, and journals.asm.org is left alone per the handoff contract.
- **Without an account:** GEO files yes; supplementary tables not retrieved
- **Limitations:** All rights reserved. Coordinates on the superseded sequence version. Many internal and antisense candidates; the authors' classes must be kept.
- **Licence standing (a characterisation, not a decision):** No grant: article all rights reserved, so the GEO files stay link-only by the ledger rule.
- **Recommendation:** link-only; recommend reject. Best-described three-condition, replicated MG1655 TSS set, but no grant; cite and link.

#### L2-02: Ettwiller et al. 2016 Cappable-seq transcription start sites

- **Identifiers:** PMID 26951544; PMCID PMC4782308; DOI 10.1186/s12864-016-2539-z; Additional file 1 `12864_2016_2539_MOESM1_ESM.gtf` (2,057,154 B, SHA-256 prefix c17fdf501add8e8e); ENA PRJEB9717
- **Measures:** Primary 5' ends by enzymatic capping and streptavidin capture (Cappable-seq), single-base resolution. **Units:** TSS position, relative read score and enrichment score per site.
- **Strain:** MG1655. **Match to MG1655:** exact.
- **Conditions:** 37 °C, M9 minimal medium with 0.2% glucose, mid-log phase. **Replicates:** Two replicates (relative read score correlation 0.983 reported).
- **Identifier namespace:** Genomic coordinates on GenBank U00096.2 (sequence name `gi|48994873|gb|U00096.2|` in the GTF). **Route to b-number:** Positional: U00096.2 coordinates need conversion to NC_000913.3 before a TSS can be assigned to a b-number by position. No join by name exists in the file.
- **Terms, verbatim:**
  - "Open Access This article is distributed under the terms of the Creative Commons Attribution 4.0 International License ( http://creativecommons.org/licenses/by/4.0/ ), which permits unrestricted use, distribution, and reproduction in any medium, provided you give appropriate credit to the original author(s) and the source, provide a link to the Creative Commons license, and indicate if changes were made." (PMC4782308 Europe PMC fullTextXML, &lt;permissions>/&lt;license>; `epmc_ft_ettwiller2016.xml`)
  - "The Creative Commons Public Domain Dedication waiver ( http://creativecommons.org/publicdomain/zero/1.0/ ) applies to the data made available in this article, unless otherwise stated." (PMC4782308 Europe PMC fullTextXML, &lt;permissions>/&lt;license>, final sentence; `epmc_ft_ettwiller2016.xml`)
- **Strain, condition and identity evidence, verbatim:**
  - "E. coli MG1655 cells were grown at 37 °C in M9 minimal media with 0.2 % glucose." (PMC4782308 full text, Methods, Growth of E. coli and isolation of total RNA; `epmc_ft_ettwiller2016.xml`)
  - "The genome used is the K-12 MG1655 E. coli genome (U00096.2)." (PMC4782308 full text, Methods, E. coli Annotation; `epmc_ft_ettwiller2016.xml`)
  - "The correlation coefficient between replicate 1 and replicate 2 RRS is 0.983." (PMC4782308 full text, Fig. 1 legend; `epmc_ft_ettwiller2016.xml`)
  - "a remarkable number of 16359 TSS at single base resolution were found" (PMC4782308 full text, Background; `epmc_ft_ettwiller2016.xml`)
  - "identifying an unprecedented 16539 transcription start sites" (PMC4782308 full text, Abstract; `epmc_ft_ettwiller2016.xml`)
- **Inspected:** MOESM1 GTF from the Europe PMC supplementaryFiles bundle: 16,359 feature rows, source `CAPPABLE_SEQ`, feature `TSS`, sequence U00096.2. The article gives the count as 16539 in the abstract and 16359 in the background section; the file agrees with 16359. File checksums: section 6.2.
- **Without an account:** Yes (Europe PMC supplementaryFiles)
- **Limitations:** One condition. Coordinates on the superseded sequence version. The file gives positions and scores, no gene assignment.
- **Licence standing (a characterisation, not a decision):** Article CC BY 4.0 with an explicit CC0 data clause. Explicit data clause, stronger than an article licence alone: the licence block states that the Creative Commons Public Domain Dedication waiver (CC0 1.0) "applies to the data made available in this article, unless otherwise stated". No per-file legend is present, so that each additional file is "data made available in this article" is read from the clause itself. The TSS table is Additional file 1 of the article. Under the ledger an affirmative grant is what redistribution of a derived table needs; whether this clause is one for this file is the owner's reading to make.
- **Recommendation:** bring first; recommend admit with caveat. The only replicated MG1655 genome-wide TSS table found with a directly retrievable per-site file, in a CC BY article whose licence also carries a CC0 data clause.

#### L2-03: Kim et al. 2012 genome-wide TSS profiling

- **Identifiers:** PMID 22912590; PMCID PMC3415461; DOI 10.1371/journal.pgen.1002867; Dataset `pgen.1002867.s007.xlsx` (798,145 B, SHA-256 prefix 564baba1c635641d); GEO GSE35822
- **Measures:** TSS positions and read counts, with the assigned downstream gene. **Units:** TSS position and TSS read count.
- **Strain:** K-12 MG1655 (GEO: MG1655 2 of 6 samples; the rest are Klebsiella pneumoniae). **Match to MG1655:** exact.
- **Conditions:** Glucose (2 g/L) minimal M9 medium, 37 °C; exponential growth. **Replicates:** not extracted.
- **Identifier namespace:** b-number in the `Gene ID` column of sheet "E. coli TSS" (3,733 of 3,746 data records carry a b-number, 2,644 distinct; 13 carry an EcoCyc `G0-` id) plus genomic coordinates. **Route to b-number:** Direct for the gene assignment the authors made (b-number column). Coordinates are on NC_000913 with the version not stated, so positions need the version established first.
- **Terms, verbatim:**
  - "https://creativecommons.org/licenses/by/4.0/ This is an open-access article distributed under the terms of the Creative Commons Attribution License, which permits unrestricted use, distribution, and reproduction in any medium, provided the original author and source are properly credited." (PMC3415461 Europe PMC fullTextXML, &lt;permissions>/&lt;license>; `epmc_ft_kim2012.xml`)
- **Strain, condition and identity evidence, verbatim:**
  - "we performed a genome-wide profiling of transcription start sites (TSSs) in two species, E. coli K-12 MG1655 and K. pneumoniae MGH78578." (PMC3415461 full text, Abstract; `epmc_ft_kim2012.xml`)
  - "Escherichia coli K-12 MG1655 and Klebsiella pneumoniae subsp. pneumoniae MGH78578 were grown in glucose (2 g/L) minimal M9 medium" (PMC3415461 full text, Materials and Methods; `epmc_ft_kim2012.xml`)
  - "were aligned onto the E. coli K-12 MG1655 genome ( NC_000913 )" (PMC3415461 full text, Materials and Methods; `epmc_ft_kim2012.xml`)
- **Inspected:** pgen.1002867.s007.xlsx sheet "E. coli TSS": four note rows, a blank row and one header row, then 3,746 data records (the sheet has 3,752 physical rows). Columns Chromosome, TSS position, TSS reads, Strand, Gene ID, Gene name, and six more. The Chromosome column reads NC_000913 on every record. File checksums: section 6.2.
- **Without an account:** Yes (Europe PMC supplementaryFiles)
- **Limitations:** Reference sequence version not stated; one condition; replicates not extracted here.
- **Licence standing (a characterisation, not a decision):** Inferred from the article licence (CC BY; the XML licence link is CC BY 4.0); no file-level grant shown. No per-file legend and no publisher statement extending the article licence to this supplementary file was found in the retrieved XML, so a grant over the file is inferred from the article licence, not shown. The source ledger has no rule for a publisher-hosted supplementary file without its own legend: its article-licence rule is written for a GEO deposit ("the article's licence is taken as the grant over the article's deposited data"), and its two file-level precedents (Adomako 2022 Data Set S1; PXD005851 Table S1) each rest on a legend. Applying the article licence here would extend the GEO-deposit rule by analogy, which is an owner ledger decision; the owner's 2026-10-05 redistribution decision is a separate basis and is not evidence of a file-level grant.
- **Recommendation:** bring second; recommend admit with caveat. A CC BY article and a table already keyed to b-numbers, so a per-gene TSS list would not have to wait for the coordinate conversion. The grant over the file is inferred.

#### L2-04: Yan et al. 2018 SMRT-Cappable-seq full-length primary transcripts

- **Identifiers:** PMID 30201986; PMCID PMC6131387; DOI 10.1038/s41467-018-05997-6; GEO GSE117273; Supplementary Data `41467_2018_5997_MOESM5_ESM.xlsx` (operons, SHA-256 prefix 6e861b6cb85bf99b), `MOESM4_ESM.xlsx` (termination sites, cd37432e014d4098), `MOESM6_ESM.xlsx`, `MOESM7_ESM.xlsx`
- **Measures:** Full-length primary transcripts by long-read sequencing of capped RNA: TSS, termination site and operon membership per transcript. **Units:** Operon definitions with TSS coordinate; read counts for termination sites.
- **Strain:** K-12 MG1655, wild type (GEO fields, 6 of 6 samples). **Match to MG1655:** exact.
- **Conditions:** 37 °C; M9 minimal medium with 0.2% glucose (4 samples) and rich medium (2 samples); log phase. **Replicates:** Not stated in the passages read; 4 M9 and 2 rich samples in GEO.
- **Identifier namespace:** b-numbers in the operon and transcriptional-context tables; coordinates on NC_000913.3. In the operon table a cell lists member genes separated by `|`. **Route to b-number:** Direct: operon rows list member genes as b-numbers, and coordinates are already on the genome of record.
- **Terms, verbatim:**
  - "https://creativecommons.org/licenses/by/4.0/ Open Access This article is licensed under a Creative Commons Attribution 4.0 International License, which permits use, sharing, adaptation, distribution and reproduction in any medium or format, as long as you give appropriate credit to the original author(s) and the source, provide a link to the Creative Commons license, and indicate if changes were made." (PMC6131387 Europe PMC fullTextXML, &lt;permissions>/&lt;license>; `epmc_ft_yan2018.xml`)
- **Strain, condition and identity evidence, verbatim:**
  - "E. coli k-12 strain MG1655 was grown at 37°C in M9 minimal medium with 0.2% glucose and Rich medium (per liter 10 g Tryptone, 5 g Yeast Extract, 5 g sodium chloride, pH 7.2), respectively." (PMC6131387 full text, Methods; `epmc_ft_yan2018.xml`)
  - "on the reference genome ( NC_000913.3 )" (PMC6131387 full text, figure legend; `epmc_ft_yan2018.xml`)
  - "!Sample_characteristics_ch1 = strain: MG1655" (GEO GSE117273 sample records; `geo_GSE117273_gsm.txt`)
- **Inspected:** MOESM5 sheet "SMRT-Cappable-seq Operon": a title row and a header row, then 3,070 operon records. The member-gene column holds 2,665 distinct b-numbers once compound cells are split on `|`; 1,375 of its cells are a single b-number (1,069 distinct). MOESM4 sheets "M9_TTS" 408 and "Rich_TTS" 455 termination-site records (two heading rows each). MOESM7 "Transcriptional Context": 1,981 records keyed by gene ID, 1,981 distinct b-numbers. File checksums: section 6.2.
- **Without an account:** Yes (Europe PMC supplementaryFiles)
- **Limitations:** Long-read depth limits coverage to expressed operons in two conditions; replicate structure not established here.
- **Licence standing (a characterisation, not a decision):** Inferred from the article licence (CC BY 4.0); no file-level grant shown. The licence block adds that "images or other third party material in this article are included in the article's Creative Commons license, unless indicated otherwise", which speaks to third-party material and does not name supplementary files. No per-file legend and no publisher statement extending the article licence to this supplementary file was found in the retrieved XML, so a grant over the file is inferred from the article licence, not shown. The source ledger has no rule for a publisher-hosted supplementary file without its own legend: its article-licence rule is written for a GEO deposit ("the article's licence is taken as the grant over the article's deposited data"), and its two file-level precedents (Adomako 2022 Data Set S1; PXD005851 Table S1) each rest on a legend. Applying the article licence here would extend the GEO-deposit rule by analogy, which is an owner ledger decision; the owner's 2026-10-05 redistribution decision is a separate basis and is not evidence of a file-level grant.
- **Recommendation:** bring first (layer 3); bring second (layer 2); recommend admit with caveat. Measured operons on NC_000913.3 with b-number members in a CC BY article: the cleanest replacement for a proximity-only operon view. The grant over the files is inferred.

#### L2-05: RegulonDB PromoterSet (curated promoters and TSS)

- **Identifiers:** RegulonDB release 14.5, file `PromoterSet` (format rif-version 1, file version 1.0, creation date 06-09-2026), via POST https://regulondb.ccg.unam.mx/graphql `getDataOfFile(fileName:"PromoterSet")`; cited as DOI 10.1093/nar/gkad1072 (PMID 37971353)
- **Measures:** Curated promoters: TSS position, sigma factor, -10 and -35 boxes, first gene, evidence codes and confidence level. **Units:** Genomic position of TSS; categorical confidence (Confirmed, Strong, Weak).
- **Strain:** E. coli K-12 (the database describes K-12; substrain per record not stated in the file). **Match to MG1655:** partial.
- **Conditions:** not applicable (literature curation across conditions). **Replicates:** not applicable.
- **Identifier namespace:** RegulonDB promoter ids (RDBECOLIPMC…) and gene names; no b-number column in this file. **Route to b-number:** Gene name to b-number through RegulonDB's own `GeneProductSet` file (columns geneName and bnumber; 4,829 distinct b-numbers). The reference sequence version is not stated in the file header (not reported).
- **Terms, verbatim:**
  - "3.1 distribute or install in a computer server or network the licensed RegulonDB, nor permit any third party to access it;" (RegulonDB manual, "Terms and conditions" (EULA version 2.0, April 2006), clause 3.1; `regulondb_terms.md`)
  - "3.2 modify or create derivative works based upon the licensed Database; or" (same file, clause 3.2; `regulondb_terms.md`)
  - "Furthermore, the AEU is not entitled to expand RegulonDB or to integrate RegulonDB partly or as a whole into other databank systems without prior written consent from CCG-UNAM." (same file, clause 4; `regulondb_terms.md`)
  - "# RegulonDB is free for academic/noncommercial use" (per-file `license` field returned by the public GraphQL `getDataOfFile` (identical header on the other RegulonDB files retrieved); `regulondb_file_PromoterSet.json`)
- **Strain, condition and identity evidence, verbatim:**
  - "RegulonDB is the primary database on transcriptional regulation in Escherichia coli K-12" (site front page, &lt;meta name="description"> attribute; `regulondb_front.html`)
  - "# RegulonDB Release: 14.5" (per-file `citation` field; `regulondb_file_PromoterSet.json`)
  - "(4) posTSS. Genome map position of Transcription Start Site (+1)" (per-file `columnsDetails` field; `regulondb_file_PromoterSet.json`)
- **Inspected:** 4,057 promoter rows. Sigma assignment: sigma70 2,001, none 716, sigma24 523, sigma32 326, sigma38 242, sigma28 147, sigma54 101, sigma19 1. Confidence: Weak 2,670, Strong 1,271, Confirmed 77, None 39.
- **Without an account:** Yes. The public GraphQL endpoint https://regulondb.ccg.unam.mx/graphql returned every file listed by `listAllDownloadableFiles` (24 files) without an account or key.
- **Limitations:** Two thirds of rows are Weak confidence, many from computational or high-throughput evidence: evidence codes must travel with each row. Genome version not stated in the file.
- **Licence standing (a characterisation, not a decision):** No affirmative grant to redistribute: the EULA quoted here forbids distribution, derivative works and integration into another databank without written consent from CCG-UNAM, and limits the licence to academic/noncommercial internal use for one year. Ledger reading: link-only unless UNAM consents in writing. The manual also carries a page titled "Licence of RegulonDB" whose text is the MIT licence over "this software and associated documentation files" (regulondb_licence.md); it does not name the data, so it is not read as a grant over the datasets.
- **Recommendation:** link-only pending written consent; recommend admit with caveat. The reference curated promoter set with sigma assignments; scientifically first choice, blocked only by its terms.

### Layer 3: Operons, transcription units and terminators

Measured operons on the genome of record with `b`-number members exist in a CC BY article (L2-04), and replicated 3' ends in the exact strain in a CC0 article (L3-03); in both, the grant over the supplementary file is inferred from the article (section 4.5). The curated sets have the same terms split as layer 2.

| Row | Source | Strain match | Route to b-number | Licence standing | Recommendation |
| --- | --- | --- | --- | --- | --- |
| L3-01 | RegulonDB TUSet, OperonSet and TerminatorSet | partial | Gene name to b-number through RegulonDB `GeneProductSet` (see L2-05) | No affirmative grant to redistribute: the EULA quoted here forbids distribution, derivative works and integration into another … | link-only pending written consent |
| L3-02 | Conway et al. 2014 operon architecture by RNA-seq | partial (a K-12 derivative; its relation to MG1655 was not read in the article) | Gene name to b-number (name-based, ambiguity must be reported) or positional after conversion from U00096.2 | Article CC BY-NC-SA 3.0 (non-commercial, share-alike); a grant over the supplementary tables is inferred from it | supporting |
| L3-03 | Adams et al. 2021 Term-seq RNA 3' ends | exact | Positional on the genome of record: no version conversion needed | Inferred from the article's CC0 public-domain dedication; no file-level statement shown | bring second (layer 3) |
| L3-04 | Ju et al. 2019 SEnd-seq full-length transcript ends | exact | Positional on the genome of record | No grant: the deposit carries the publisher's author-manuscript terms (view, print, copy, download and text and data-mine for … | link-only |
| L3-05 | Dar and Sorek 2018 Term-seq of Rho-dependent 3' ends | partial (K-12 BW25113: a cross-substrain transfer here) | BW25113 locus tag or gene name to b-number: a cross-strain, name-based route whose ambiguity must be reported | CC BY-NC 4.0: a grant conditional on non-commercial use; no evidence-based ledger rule yet for NC, covered only by the owner's … | supporting |
| L3-06 | Lalanne et al. 2018 Rend-seq transcript ends | exact | Positional (sequences taken from NC_000913.3) | No grant: link-only by the ledger rule | link-only |
| L1-05 | Tjaden 2023 transcriptome assembly from an RNA-seq compendium | none established | not established | Article CC BY 4.0; repository GPL-3.0 (copyleft over the repository files) | supporting |
| L2-04 | Yan et al. 2018 SMRT-Cappable-seq full-length primary transcripts | exact | Direct: operon rows list member genes as b-numbers, and coordinates are already on the genome of record | Inferred from the article licence (CC BY 4.0); no file-level grant shown | bring first (layer 3); bring second (layer 2) |
| L7-01 | EcoCyc (BioCyc Tier 1 curated database for E. coli K-12 MG1655) | exact | EcoCyc gene id to b-number through the pinned RefSeq GFF: all 4,651 gene and pseudogene features carry … | Affirmative grant with conditions for EcoCyc specifically: the BioCyc limited-use licence defines "Open Databases" as the EcoCyc … | bring first |

#### L3-01: RegulonDB TUSet, OperonSet and TerminatorSet

- **Identifiers:** RegulonDB release 14.5, files `TUSet`, `OperonSet`, `TerminatorSet` (creation date 06-09-2026) via the same GraphQL call as row L2-05
- **Measures:** Curated transcription units (promoter, genes, terminators), operons, and terminators with type. **Units:** Gene lists per unit; terminator coordinates and class.
- **Strain:** E. coli K-12. **Match to MG1655:** partial.
- **Conditions:** not applicable (curation). **Replicates:** not applicable.
- **Identifier namespace:** RegulonDB ids and gene names. **Route to b-number:** Gene name to b-number through RegulonDB `GeneProductSet` (see L2-05).
- **Terms, verbatim:**
  - "3.1 distribute or install in a computer server or network the licensed RegulonDB, nor permit any third party to access it;" (RegulonDB manual, "Terms and conditions" (EULA version 2.0, April 2006), clause 3.1; `regulondb_terms.md`)
  - "3.2 modify or create derivative works based upon the licensed Database; or" (same file, clause 3.2; `regulondb_terms.md`)
  - "Furthermore, the AEU is not entitled to expand RegulonDB or to integrate RegulonDB partly or as a whole into other databank systems without prior written consent from CCG-UNAM." (same file, clause 4; `regulondb_terms.md`)
  - "# RegulonDB is free for academic/noncommercial use" (per-file `license` field returned by the public GraphQL `getDataOfFile` (identical header on the other RegulonDB files retrieved); `regulondb_file_PromoterSet.json`)
- **Strain, condition and identity evidence, verbatim:**
  - "1)id\t2)name\t3)operonId\t4)operonName\t5)tuGenes" (TUSet header row (tab characters appear as \t in the JSON string); `regulondb_file_TUSet.json`)
- **Inspected:** TUSet 3,767 rows; OperonSet 2,605 rows; TerminatorSet 375 rows (types include rho-independent). Counts exclude the header row.
- **Without an account:** Yes. The public GraphQL endpoint https://regulondb.ccg.unam.mx/graphql returned every file listed by `listAllDownloadableFiles` (24 files) without an account or key.
- **Limitations:** Only 375 curated terminators. Units inferred from single-direction adjacency are marked Weak (evidence COMP-AINF-SINGLE-DIRECTON).
- **Licence standing (a characterisation, not a decision):** No affirmative grant to redistribute: the EULA quoted here forbids distribution, derivative works and integration into another databank without written consent from CCG-UNAM, and limits the licence to academic/noncommercial internal use for one year. Ledger reading: link-only unless UNAM consents in writing. The manual also carries a page titled "Licence of RegulonDB" whose text is the MIT licence over "this software and associated documentation files" (regulondb_licence.md); it does not name the data, so it is not read as a grant over the datasets.
- **Recommendation:** link-only pending written consent; recommend admit with caveat. Reference curated operon and TU set; same terms block as L2-05.

#### L3-02: Conway et al. 2014 operon architecture by RNA-seq

- **Identifiers:** PMID 25006232; PMCID PMC4161252; DOI 10.1128/mBio.01442-14; GEO GSE52059 (GSE52059_Transcriptome_annotation.txt.gz); supplementary tables mbo004141900st2.xlsx (promoters), st3.xlsx (terminators), st4.xlsx (transcription units)
- **Measures:** Promoters, terminators and transcription units called from RNA-seq time series. **Units:** Feature tables per promoter, terminator and transcription unit (columns not inspected beyond sheet names and row counts).
- **Strain:** K-12 BW38028 and its rpoS mutant BW39452 (GEO `sub strain` field: BW38028 17, BW39452 9); not MG1655. **Match to MG1655:** partial (a K-12 derivative; its relation to MG1655 was not read in the article).
- **Conditions:** Glucose-limited minimal medium, logarithmic to stationary phase time series. **Replicates:** Duplicate cultures.
- **Identifier namespace:** Gene names and coordinates on U00096.2. **Route to b-number:** Gene name to b-number (name-based, ambiguity must be reported) or positional after conversion from U00096.2.
- **Terms, verbatim:**
  - "This is an open-access article distributed under the terms of the Creative Commons Attribution-Noncommercial-ShareAlike 3.0 Unported license , which permits unrestricted noncommercial use, distribution, and reproduction in any medium, provided the original author and source are credited." (PMC4161252 Europe PMC fullTextXML, &lt;permissions>/&lt;license>; `epmc_ft_conway2014.xml`)
- **Strain, condition and identity evidence, verbatim:**
  - "We acquired time series of RNA samples from duplicate cultures of E. coli K-12 BW38028 and its isogenic rpoS mutant BW39452 during logarithmic- and stationary-phase growth on glucose-limited minimal medium" (PMC4161252 full text, Results; `epmc_ft_conway2014.xml`)
  - "Sequence reads were aligned to the E. coli MG1655 reference genome ( U00096.2 )" (PMC4161252 full text, Materials and Methods; `epmc_ft_conway2014.xml`)
- **Inspected:** st4 "table S4 TUs": two heading rows, then 2,566 records. st2 "table s2 Promoters": three heading rows, then 2,122 records. st3 "table S3 Terminators": two heading rows, then 1,774 records (its title cell reads "1774 TESs"). File checksums: section 6.2.
- **Without an account:** Yes (Europe PMC supplementaryFiles)
- **Limitations:** Not MG1655. Licence is non-commercial share-alike. Coordinates on the superseded sequence.
- **Licence standing (a characterisation, not a decision):** Article CC BY-NC-SA 3.0 (non-commercial, share-alike); a grant over the supplementary tables is inferred from it. No per-file legend was found on the supplementary tables, so the same inference from article to file applies as in row L2-03. The ledger has no evidence-based rule for NC-SA; the owner's 2026-10-05 note covers attribution and non-commercial use, and share-alike on a derived table is an added condition for the owner to accept or not.
- **Recommendation:** supporting; recommend admit with caveat. Large measured terminator and TU set, but substrain and share-alike make it second to Yan 2018.

#### L3-03: Adams et al. 2021 Term-seq RNA 3' ends

- **Identifiers:** PMID 33460557; PMCID PMC7815308; DOI 10.7554/eLife.62438; Supplementary file 1 `elife-62438-supp1.xlsx` (267,993 B, SHA-256 prefix 191a488103cd73da); BioProject PRJNA640168
- **Measures:** RNA 3' ends by Term-seq, per condition. **Units:** 3' end position, strand, average Term-seq read count, the authors' classification, and a 3' end region sequence, per condition.
- **Strain:** MG1655 (strain GSO988). **Match to MG1655:** exact.
- **Conditions:** LB to OD600 about 0.4 and 2.0; M63 glucose to OD600 about 0.4. **Replicates:** Two biological replicates.
- **Identifier namespace:** Genomic coordinates; reads were mapped to NC_000913.3. **Route to b-number:** Positional on the genome of record: no version conversion needed.
- **Terms, verbatim:**
  - "This is an open-access article, free of all copyright, and may be freely reproduced, distributed, transmitted, modified, built upon, or otherwise used by anyone for any lawful purpose. The work is made available under the Creative Commons CC0 public domain dedication ." (PMC7815308 Europe PMC fullTextXML, &lt;permissions>/&lt;license>; `epmc_ft_adams2021.xml`)
- **Strain, condition and identity evidence, verbatim:**
  - "Two biological replicates of E. coli MG1655 (GSO988) were diluted 1:500 from an LB overnight culture in either LB or M63 glucose media." (PMC7815308 full text, Materials and methods, Term-seq; `epmc_ft_adams2021.xml`)
  - "Trimmed reads were mapped to the E. coli reference genome (MG1655 NC_000913.3 ) using BWA-MEM." (PMC7815308 full text, Materials and methods; `epmc_ft_adams2021.xml`)
  - "all datasets were converted to the corresponding E. coli MG1655 ( NC_000913.3 ) positions." (PMC7815308 full text, Materials and methods: how earlier datasets on older coordinates were converted; `epmc_ft_adams2021.xml`)
- **Inspected:** supp1 sheets "LB 0.4" 1,175, "LB 2.0" 882 and "M63 0.4" 1,053 data records, each after a title row and a header row (columns 3´ end position, strand, Term-seq AVG reads, classification, details, 3′ end region). The "details" column names genes by EcoCyc id. File checksums: section 6.2.
- **Without an account:** Yes (Europe PMC supplementaryFiles)
- **Limitations:** 3' ends include processing sites as well as termination sites; the authors' classes must be kept, and a 3' end is not by itself a terminator.
- **Licence standing (a characterisation, not a decision):** Inferred from the article's CC0 public-domain dedication; no file-level statement shown. No per-file legend and no publisher statement extending the article's dedication to this supplementary file was found in the retrieved XML, so a grant over the file is inferred from the article's dedication, not shown. The source ledger has no rule for a publisher-hosted supplementary file without its own legend: its article-licence rule is written for a GEO deposit ("the article's licence is taken as the grant over the article's deposited data"), and its two file-level precedents (Adomako 2022 Data Set S1; PXD005851 Table S1) each rest on a legend. Applying the article's dedication here would extend the GEO-deposit rule by analogy, which is an owner ledger decision; the owner's 2026-10-05 redistribution decision is a separate basis and is not evidence of a file-level grant.
- **Recommendation:** bring second (layer 3); recommend admit with caveat. Exact strain, replicated, three conditions, NC_000913.3 coordinates and a CC0 article: the strongest terminator-side source on identifiers. The dedication of the supplementary file is inferred from the article.

#### L3-04: Ju et al. 2019 SEnd-seq full-length transcript ends

- **Identifiers:** PMID 31308523; PMCID PMC6814526; DOI 10.1038/s41564-019-0500-z; GEO GSE117737 (47 samples; GSE117737_RAW.tar)
- **Measures:** Simultaneous 5' and 3' end mapping of transcripts; bidirectional terminators. **Units:** Transcript end coordinates on NC_000913.3.
- **Strain:** K-12 MG1655 (and SIJ_488 for mutant construction). **Match to MG1655:** exact.
- **Conditions:** LB, aerobic, 37 °C; log and stationary phase; heat and bicyclomycin treatments. **Replicates:** not extracted.
- **Identifier namespace:** Genomic coordinates on NC_000913.3. **Route to b-number:** Positional on the genome of record.
- **Terms, verbatim:**
  - "Users may view, print, copy, and download text and data-mine the content in such documents, for the purposes of academic research, subject always to the full Conditions of use: http://www.nature.com/authors/editorial_policies/license.html#terms" (PMC6814526 NCBI efetch db=pmc, &lt;permissions>/&lt;license>; `ncbi_pmc_ju2019.xml`)
  - "Therefore, NCBI itself places no restrictions on the use or distribution of the data contained therein. Nor do we accept data when the submitter has requested restrictions on reuse or redistribution." (NCBI Policies and Disclaimers page, section "Molecular Data Usage"; `ncbi_policies.html`)
- **Strain, condition and identity evidence, verbatim:**
  - "E. coli K-12 MG1655 and K-12 SIJ_488 (Addgene #68246; a gift from Alex Nielsen) were cultured in LB media (10 g/l tryptone, 5 g/l yeast extract, 10 g/l NaCl, pH 7.4) under aerobic conditions at 37 °C." (PMC6814526 author manuscript, Methods; `ncbi_pmc_ju2019.xml`)
  - "by mapping to the reference E. coli genome NC_000913.3" (PMC6814526 author manuscript, Methods; `ncbi_pmc_ju2019.xml`)
- **Inspected:** GEO records only; Europe PMC bundle held one figure file.
- **Without an account:** Yes (GEO FTP)
- **Limitations:** Author-manuscript terms; processed tables are inside a RAW tar and were not opened.
- **Licence standing (a characterisation, not a decision):** No grant: the deposit carries the publisher's author-manuscript terms (view, print, copy, download and text and data-mine for academic research), which is not a redistribution grant. Link-only by the ledger rule.
- **Recommendation:** link-only; recommend reject. Good assay and exact strain, no grant.

#### L3-05: Dar and Sorek 2018 Term-seq of Rho-dependent 3' ends

- **Identifiers:** PMID 29669055; PMCID PMC6061677; DOI 10.1093/nar/gky274; GEO GSE109766 (GSE109766_ecoli_termseq_rep1-3.counts_per_position.txt.gz); `gky274_supplemental_files.xlsx`
- **Measures:** RNA 3' ends by Term-seq, with Rho-dependence. **Units:** Read counts per 3' position; site tables.
- **Strain:** BW25113 (GEO `strain` field, 3 of 3 samples); not MG1655. **Match to MG1655:** partial (K-12 BW25113: a cross-substrain transfer here).
- **Conditions:** LB, aerobic, 37 °C. **Replicates:** Three (file name rep1-3).
- **Identifier namespace:** `BW25113_####` locus tags and gene names. **Route to b-number:** BW25113 locus tag or gene name to b-number: a cross-strain, name-based route whose ambiguity must be reported. Not performed.
- **Terms, verbatim:**
  - "https://creativecommons.org/licenses/by-nc/4.0/ This is an Open Access article distributed under the terms of the Creative Commons Attribution Non-Commercial License ( http://creativecommons.org/licenses/by-nc/4.0/ ), which permits non-commercial re-use, distribution, and reproduction in any medium, provided the original work is properly cited. For commercial re-use, please contact journals.permissions@oup.com" (PMC6061677 Europe PMC fullTextXML, &lt;permissions>/&lt;license>; `epmc_ft_dar2018.xml`)
  - "Therefore, NCBI itself places no restrictions on the use or distribution of the data contained therein. Nor do we accept data when the submitter has requested restrictions on reuse or redistribution." (NCBI Policies and Disclaimers page, section "Molecular Data Usage"; `ncbi_policies.html`)
- **Strain, condition and identity evidence, verbatim:**
  - "Escherichia coli BW25113 and the pnp, rnb and rnr single deletion strains from the keio collection ( 18 ) were cultured in LB media (10 g/l tryptone, 5 g/l yeast extract 5 g/l NaCl) under aerobic conditions at 37°C with shaking." (PMC6061677 full text, Materials and Methods; `epmc_ft_dar2018.xml`)
- **Inspected:** Supplement sheets "Table S1" 1,098, "Tabls S2" 462 and "Table S3" 277 data records, each after a block of column definitions and a header row. File checksums: section 6.2.
- **Without an account:** Yes
- **Limitations:** Not MG1655; non-commercial licence.
- **Licence standing (a characterisation, not a decision):** CC BY-NC 4.0: a grant conditional on non-commercial use; no evidence-based ledger rule yet for NC, covered only by the owner's 2026-10-05 note. The table is a supplementary file without a legend of its own, so the article-to-file inference described in row L2-03 applies here too.
- **Recommendation:** supporting; recommend admit with caveat. Adds Rho-dependence, which Adams 2021 also addresses in the exact strain.

#### L3-06: Lalanne et al. 2018 Rend-seq transcript ends

- **Identifiers:** PMID 29606352; PMCID PMC5978003; DOI 10.1016/j.cell.2018.03.007; GEO GSE95211
- **Measures:** End-enriched RNA-seq (Rend-seq) for transcript boundaries; synthesis rates reused from Li et al. 2014. **Units:** read density per position.
- **Strain:** K-12 MG1655 (GEO: 4 E. coli samples among 21). **Match to MG1655:** exact.
- **Conditions:** MOPS complete medium. **Replicates:** not extracted.
- **Identifier namespace:** Genomic coordinates. **Route to b-number:** Positional (sequences taken from NC_000913.3).
- **Terms, verbatim:**
  - "This file is available for text mining. It may also be used consistent with the principles of fair use under the copyright law." (PMC5978003 NCBI efetch db=pmc, &lt;permissions>/&lt;license>; `ncbi_pmc_lalanne2018.xml`)
  - "Therefore, NCBI itself places no restrictions on the use or distribution of the data contained therein. Nor do we accept data when the submitter has requested restrictions on reuse or redistribution." (NCBI Policies and Disclaimers page, section "Molecular Data Usage"; `ncbi_policies.html`)
- **Strain, condition and identity evidence, verbatim:**
  - "For Rend-seq experiments, E. coli (K-12, MG1655 wild-type as well as pnp and rnb knockouts) was grown in MOPS complete medium ( Neidhardt et al., 1974 ) (Teknova)." (PMC5978003 author manuscript, Methods; `ncbi_pmc_lalanne2018.xml`)
- **Inspected:** GEO records only.
- **Without an account:** Yes (GEO FTP)
- **Limitations:** Text-mining notice only; no per-feature table inspected.
- **Licence standing (a characterisation, not a decision):** No grant: link-only by the ledger rule.
- **Recommendation:** link-only; recommend reject. No grant.

### Layer 4: Regulatory sites

The reference source is RegulonDB, blocked by its terms. EcoCyc carries curated regulation and is the candidate curated route; it is not admitted, and its files need the executed licence. Directly retrievable measured sets are the sigma-factor ChIP-chip maps (L4-02, whose article carries an explicit CC0 data clause), proChIPdb (L4-03, now read at inventory level at its corrected address: 62 MG1655 entries on `NC_000913.3` under a CC BY 4.0 Zenodo deposit) and, for sRNA targets, CLASH (L4-06), whose tables were not inspected.

| Row | Source | Strain match | Route to b-number | Licence standing | Recommendation |
| --- | --- | --- | --- | --- | --- |
| L4-01 | RegulonDB regulatory interactions and sigma network (TF-RISet, RISet, NetworkSigmaGene) | partial | Gene name to b-number through RegulonDB `GeneProductSet` (see L2-05) | No affirmative grant to redistribute: the EULA quoted here forbids distribution, derivative works and integration into another … | link-only pending written consent |
| L4-02 | Cho et al. 2014 sigma-factor network by ChIP-chip | exact | Direct where the authors assigned genes (b-number column); positional otherwise, after the reference version … | Article CC BY 2.0 with an explicit CC0 data clause | bring first (layer 4, measured) |
| L4-03 | proChIPdb transcription-factor ChIP-exo compendium | exact for 62 of 65 entries | Positional on NC_000913.3 for the MG1655 entries; target-gene columns were not inspected | Affirmative grant over each Zenodo archive (CC BY 4.0 in the record metadata); the article and its correction are CC BY-NC 4.0, … | supporting |
| L4-04 | Melamed et al. 2016 RIL-seq sRNA to target interactions | partial (tagged derivative of MG1655) | EcoCyc gene id to b-number through the RefSeq annotation itself: every gene feature in the pinned GFF carries … | Not permitted for a derived table by the ledger rule: the article is CC BY-NC-ND 4.0. Link-only | link-only |
| L4-05 | Melamed et al. 2020 RIL-seq of Hfq and ProQ | exact | not established | No grant: link-only by the ledger rule | link-only |
| L4-06 | Iosub et al. 2020 Hfq CLASH sRNA to target interactions | partial | not established | Article CC BY 4.0; a grant over its unread tables would be inferred from it | bring second (layer 4, sRNA targets) |
| L1-03 | iModulonDB (modules and activities computed from PRECISE) | partial | Not established; the matrices sit beside the b-number keyed expression table in SBRG/precise1k | The articles are CC BY 4.0; the module matrices in SBRG/precise1k fall under that repository's MIT licence | supporting |
| L7-01 | EcoCyc (BioCyc Tier 1 curated database for E. coli K-12 MG1655) | exact | EcoCyc gene id to b-number through the pinned RefSeq GFF: all 4,651 gene and pseudogene features carry … | Affirmative grant with conditions for EcoCyc specifically: the BioCyc limited-use licence defines "Open Databases" as the EcoCyc … | bring first |

#### L4-01: RegulonDB regulatory interactions and sigma network (TF-RISet, RISet, NetworkSigmaGene)

- **Identifiers:** RegulonDB release 14.5, files `TF-RISet`, `RISet`, `NetworkSigmaGene` (creation date 06-09-2026), via the GraphQL call of row L2-05
- **Measures:** Curated transcription-factor binding sites with coordinates, sequence, function and evidence; regulator to gene and to TU interactions including sRNA regulators; sigma factor to gene assignments. **Units:** Site coordinates and sequence; categorical function (activator, repressor) and confidence.
- **Strain:** E. coli K-12. **Match to MG1655:** partial.
- **Conditions:** not applicable (curation). **Replicates:** not applicable.
- **Identifier namespace:** RegulonDB ids and gene names. **Route to b-number:** Gene name to b-number through RegulonDB `GeneProductSet` (see L2-05).
- **Terms, verbatim:**
  - "3.1 distribute or install in a computer server or network the licensed RegulonDB, nor permit any third party to access it;" (RegulonDB manual, "Terms and conditions" (EULA version 2.0, April 2006), clause 3.1; `regulondb_terms.md`)
  - "3.2 modify or create derivative works based upon the licensed Database; or" (same file, clause 3.2; `regulondb_terms.md`)
  - "Furthermore, the AEU is not entitled to expand RegulonDB or to integrate RegulonDB partly or as a whole into other databank systems without prior written consent from CCG-UNAM." (same file, clause 4; `regulondb_terms.md`)
  - "# RegulonDB is free for academic/noncommercial use" (per-file `license` field returned by the public GraphQL `getDataOfFile` (identical header on the other RegulonDB files retrieved); `regulondb_file_PromoterSet.json`)
- **Strain, condition and identity evidence, verbatim:**
  - "1)id\t2)type\t3)regulatorId\t4)regulatorName" (RISet header row; `regulondb_file_RISet.json`)
- **Inspected:** RISet 6,460 rows by type: TF-promoter 4,028, TF-gene 1,484, TF-TU 328, sRNA-TU 189, sRNA-gene 116, compound-TU 114, compound-promoter 90, regulator-TU 48, regulator-gene 35, regulator-promoter 28. TF-RISet 5,785 rows. NetworkSigmaGene 2,597 rows.
- **Without an account:** Yes. The public GraphQL endpoint https://regulondb.ccg.unam.mx/graphql returned every file listed by `listAllDownloadableFiles` (24 files) without an account or key.
- **Limitations:** Confidence varies by row and must be shown. sRNA rows are regulator to target pairs, mostly without a base-pairing site.
- **Licence standing (a characterisation, not a decision):** No affirmative grant to redistribute: the EULA quoted here forbids distribution, derivative works and integration into another databank without written consent from CCG-UNAM, and limits the licence to academic/noncommercial internal use for one year. Ledger reading: link-only unless UNAM consents in writing. The manual also carries a page titled "Licence of RegulonDB" whose text is the MIT licence over "this software and associated documentation files" (regulondb_licence.md); it does not name the data, so it is not read as a grant over the datasets.
- **Recommendation:** link-only pending written consent; recommend admit with caveat. The reference source for this layer and the only one covering TF sites, sigma assignments and sRNA targets together.

#### L4-02: Cho et al. 2014 sigma-factor network by ChIP-chip

- **Identifiers:** PMID 24461193; PMCID PMC3923258; DOI 10.1186/1741-7007-12-4; GEO GSE46740 (SuperSeries, 54 samples); Additional files `1741-7007-12-4-S4.xlsx` (binding regions per sigma factor), `-S6.xlsx`, `-S7.xlsx` (TSS and TU tables), `-S8.xlsx`
- **Measures:** Genome-wide binding regions of RNA polymerase and sigma factors by ChIP-chip (binding sheets for RpoD, RpoS, RpoN, RpoH and FliA), with TSS and TU tables. **Units:** Binding region coordinates; TSS positions.
- **Strain:** K-12 MG1655 and isogenic knock-outs (GEO organism field: 54 of 54 samples MG1655). **Match to MG1655:** exact.
- **Conditions:** Stationary phase, glutamine and heat shock appear in the GEO `treatment` field; base medium for the ChIP samples not extracted. **Replicates:** Replicate columns are visible in Additional file 4: for example RNAP has exponential 1 to 3, stationary 1 to 3 and glutamine 1 and 2; the design per sample was not extracted from the article.
- **Identifier namespace:** b-numbers in Additional file 8 (4,282 distinct); binding tables by coordinate on NC_000913 (version not stated). **Route to b-number:** Direct where the authors assigned genes (b-number column); positional otherwise, after the reference version is established.
- **Terms, verbatim:**
  - "https://creativecommons.org/licenses/by/2.0/ This is an Open Access article distributed under the terms of the Creative Commons Attribution License ( http://creativecommons.org/licenses/by/2.0 ), which permits unrestricted use, distribution, and reproduction in any medium, provided the original work is properly cited." (PMC3923258 Europe PMC fullTextXML, &lt;permissions>/&lt;license>; `epmc_ft_cho2014.xml`)
  - "The Creative Commons Public Domain Dedication waiver ( http://creativecommons.org/publicdomain/zero/1.0/ ) applies to the data made available in this article, unless otherwise stated." (PMC3923258 Europe PMC fullTextXML, &lt;permissions>/&lt;license>, final sentence; `epmc_ft_cho2014.xml`)
- **Strain, condition and identity evidence, verbatim:**
  - "E. coli K-12 MG1655 and its isogenic knock-out strains were used in this study." (PMC3923258 full text, Methods; `epmc_ft_cho2014.xml`)
  - "were aligned to the E. coli K-12 MG1655 genome ( NC_000913 )" (PMC3923258 full text, Methods; `epmc_ft_cho2014.xml`)
  - "chromatin immunoprecipitation and microarray (ChIP-chip) data" (PMC3923258 full text; `epmc_ft_cho2014.xml`)
- **Inspected:** S4 sheets, one header row each: RNAP_Binding 2,129 records, RpoD_Binding 1,643, RpoS_Binding 903, RpoH_Binding 312, RpoN_Binding 180, FliA_Binding 51, and an untitled "Sheet7" with 7 FecI records. S6 "table.tss" 4,724 TSS records. S8 "Table S6" 4,301 gene records, 4,282 distinct b-numbers. File checksums: section 6.2.
- **Without an account:** Yes (Europe PMC supplementaryFiles)
- **Limitations:** ChIP-chip resolution is a region, not a site. Reference version not stated.
- **Licence standing (a characterisation, not a decision):** Article CC BY 2.0 with an explicit CC0 data clause. Explicit data clause, stronger than an article licence alone: the licence block states that the Creative Commons Public Domain Dedication waiver (CC0 1.0) "applies to the data made available in this article, unless otherwise stated". No per-file legend is present, so that each additional file is "data made available in this article" is read from the clause itself.
- **Recommendation:** bring first (layer 4, measured); recommend admit with caveat. Measured sigma-factor assignment in the exact strain, in a CC BY article with a CC0 data clause: a candidate substitute for RegulonDB sigma columns.

#### L4-03: proChIPdb transcription-factor ChIP-exo compendium

- **Identifiers:** PMID 34791440; PMCID PMC8728212; DOI 10.1093/nar/gkab1043; Correction PMID 40737097, PMCID PMC12309368, DOI 10.1093/nar/gkaf769 (the address changed from https://prochipdb.org to https://prochipdb.com/). Site: proChIPdb v1.0.0, release date 06.22.2021. Zenodo DOI 10.5281/zenodo.5168081 (all_ChIP-pro_data.tar.gz, 4,856,311,019 B, md5 52292132c16651cab0439f0b2e8959ed, record licence cc-by-4.0) and DOI 10.5281/zenodo.5545676 (proChIPdb_20211001.tar.gz, 5,539,978,388 B, the record the site's download link points to, licence cc-by-4.0); GitHub SBRG/ChIPdb (MIT per the GitHub API)
- **Measures:** Transcription-factor binding by ChIP-exo and ChIP-seq, with curated binding-site tables per factor: 65 E. coli entries covering 62 factors. **Units:** binding-site tables with peak intensity ("MACE S/N" for 61 entries); bigWig tracks.
- **Strain:** Per entry in the site's E. coli list: K-12 MG1655 for 62 of 65 entries; O157:H7 EDL933, SMS-3-5 and UMN026 one each. **Match to MG1655:** exact for 62 of 65 entries.
- **Conditions:** Per entry: M9 for 53 entries (0.2% glucose listed for 49), LB 4, and others; supplements such as iron, ethanol or acid stress are recorded per entry. **Replicates:** Per entry: the list names replicate tracks (for example "bio-rep1 – R1"); 37 entries have 2 samples and 21 have 4.
- **Identifier namespace:** Not inspected at site level (binding tables are JSON files named per factor and condition; none was opened). The list gives `genome_id` NC_000913.3 for 62 entries. **Route to b-number:** Positional on NC_000913.3 for the MG1655 entries; target-gene columns were not inspected.
- **Terms, verbatim:**
  - "This is an Open Access article distributed under the terms of the Creative Commons Attribution-NonCommercial License ( https://creativecommons.org/licenses/by-nc/4.0/ ), which permits non-commercial re-use, distribution, and reproduction in any medium, provided the original work is properly cited. For commercial re-use, please contact journals.permissions@oup.com" (PMC8728212 Europe PMC fullTextXML, &lt;permissions>/&lt;license>; `epmc_ft_prochipdb.xml`)
- **Strain, condition and identity evidence, verbatim:**
  - "The URL for proChIPdb, https://prochipdb.org , has changed to https://prochipdb.com/ ." (PMC12309368 (Correction) full text; `epmc_ft_prochipdb_correction.xml`)
  - "Organisms 14 Samples 271 Release Date 06.22.2021" (https://prochipdb.com/ home page; `prochipdb_com_home.html`)
  - "Escherichia coli,K-12 MG1655,LB (Lysogeny Broth),5% EtOH,NC_000913.3" (https://prochipdb.com/data/e_coli/TF_list.csv, first data record (BaeR); `prochipdb_com_ecoli_TF_list.csv`)
- **Inspected:** https://prochipdb.com/ answered HTTP 200 on 2026-10-05; the superseded https://prochipdb.org still does not resolve (curl exit 6). The E. coli dataset page loads `/data/e_coli/TF_list.csv`, retrieved as the page itself requests it: one header row and 65 records with 41 columns (TF, Organism, Strain, Media, Supplement, genome_id, num_samples, binding tables, accession, doi, Method, PMID and replicate track names). Strain: K-12 MG1655 62. genome_id: NC_000913.3 62. Method: ChIP-exo 59, ChIP-seq 6. 17 distinct GEO accessions; 31 entries have no PMID. The About page was read and carries no licence, terms or copyright text (site terms: not reported). Neither Zenodo archive was downloaded (4.9 GB and 5.5 GB); binding tables were not opened. Retrieval record (added under DEM-244): what this row says about the site rests on this run's own retrievals, made with a plain `curl` client: https://prochipdb.com/ (retrieved 2026-10-05T18:05:07Z, 10,198 B, SHA-256 7504c82fe97734aa438017740d33cec0fed38ef237de0b03283a0b4faefd2df0); https://prochipdb.com/dataset_page.html?organism=e_coli (retrieved 2026-10-05T18:13:46Z, 12,196 B, SHA-256 80fcace89fbd0d63862c806d5a0ce4d71a78fc2eaf42d98c81ead85d5d21de12); https://prochipdb.com/about.html (retrieved 2026-10-05T18:13:47Z, 56,845 B, SHA-256 ff49a04176b8acf95e1113921ab5a323605781fd15594df74ecc552027430dc5); https://prochipdb.com/data/e_coli/TF_list.csv (retrieved 2026-10-05T18:14:06Z, 34,667 B, SHA-256 96a7d6435af55ba3622b2082448cb0e1fcb665fd2913af62b6a2cc253f6e2f83); https://zenodo.org/api/records/5168081 (retrieved 2026-10-05T16:46:30Z, 3,829 B, SHA-256 192dd0dc1799e5f56df7697545785d83e6d0fc33eca7258b4eeea6d800fc3976); https://zenodo.org/api/records/5545676 (retrieved 2026-10-05T18:13:47Z, 3,887 B, SHA-256 6f43c1f3a6e5027c8c66015e934c02bb99f7cc1f4032d71fbf59c6a7ed98fcbe); https://api.github.com/repos/SBRG/ChIPdb (retrieved 2026-10-05T16:32:09Z, 6,469 B, SHA-256 41ab2518309e06185ebc4076a0e90d10dfb56abb6ac2a6d1039f410d939b121e). Requested again under DEM-244, https://prochipdb.com/ at 2026-10-05T19:17:37Z and https://prochipdb.com/data/e_coli/TF_list.csv at 2026-10-05T19:17:40Z each returned HTTP 200 with the same SHA-256. The independent confirmation DEM-241 reports HTTP 403 for the home page and for the list file at 18:46:25 UTC on 2026-10-05, with no response body kept, so the 65-entry and 62-entry counts have been read by this run only and are not confirmed by a second reader. File checksums: section 6.2.
- **Without an account:** Yes: site pages, the list file and both Zenodo records are served without an account
- **Limitations:** Inventory only: no binding table was opened, so per-site columns and identifiers are not established. 31 of 65 entries cite no publication. The site states no terms; the grant read is the Zenodo record licence.
- **Licence standing (a characterisation, not a decision):** Affirmative grant over each Zenodo archive (CC BY 4.0 in the record metadata); the article and its correction are CC BY-NC 4.0, which governs the articles. The site itself states no terms (not reported).
- **Recommendation:** supporting; insufficient evidence. The largest measured transcription-factor binding set found for MG1655 on NC_000913.3, under a CC BY 4.0 deposit; its address is corrected and its inventory is now read. It needs one binding table opened before it can be ranked against Cho 2014.

#### L4-04: Melamed et al. 2016 RIL-seq sRNA to target interactions

- **Identifiers:** PMID 27588604; PMCID PMC5145812; DOI 10.1016/j.molcel.2016.07.026; ArrayExpress E-MTAB-3910; Table S2 `mmc3.xlsx` (SHA-256 prefix 5b78029333c4488a)
- **Measures:** Hfq-bound RNA pairs by ligation and sequencing (RIL-seq). **Units:** Per-pair interaction tables (columns not inspected beyond identifiers).
- **Strain:** MG1655 carrying hfq-Flag (strain HM34). **Match to MG1655:** partial (tagged derivative of MG1655).
- **Conditions:** Log phase, stationary phase and iron limitation (sheet names). **Replicates:** not extracted.
- **Identifier namespace:** EcoCyc gene ids (EG…/G…) and gene symbols. **Route to b-number:** EcoCyc gene id to b-number through the RefSeq annotation itself: every gene feature in the pinned GFF carries `Dbxref=ECOCYC:<id>` beside `locus_tag` (4,651 of 4,651 genes).
- **Terms, verbatim:**
  - "This is an open access article under the CC BY-NC-ND license (http://creativecommons.org/licenses/by-nc-nd/4.0/)." (PMC5145812 Europe PMC fullTextXML, &lt;permissions>/&lt;license>; `epmc_ft_melamed2016.xml`)
- **Strain, condition and identity evidence, verbatim:**
  - "An E. coli MG1655 strain carrying hfq-Flag (HM34) was used in the RIL-seq protocol." (PMC5145812 full text, Experimental Procedures; `epmc_ft_melamed2016.xml`)
- **Inspected:** mmc3.xlsx sheets "Log_phase" 1,027, "Stationary_phase" 1,844 and "Iron_limitation" 1,947 interaction records, each after a title row and a header row. File checksums: section 6.2.
- **Without an account:** Yes (Europe PMC supplementaryFiles)
- **Limitations:** No-derivatives licence.
- **Licence standing (a characterisation, not a decision):** Not permitted for a derived table by the ledger rule: the article is CC BY-NC-ND 4.0. Link-only.
- **Recommendation:** link-only; recommend reject. ND term excludes a derived table.

#### L4-05: Melamed et al. 2020 RIL-seq of Hfq and ProQ

- **Identifiers:** PMID 31761494; PMCID PMC6980735; DOI 10.1016/j.molcel.2019.10.022; GEO GSE131520 (56 samples)
- **Measures:** Hfq- and ProQ-bound RNA pairs by RIL-seq. **Units:** chimera counts.
- **Strain:** MG1655 and derivatives. **Match to MG1655:** exact.
- **Conditions:** LB to OD600 about 1.0; M63 (GEO `growth` field). **Replicates:** not extracted.
- **Identifier namespace:** not inspected. **Route to b-number:** not established
- **Terms, verbatim:**
  - "This file is available for text mining. It may also be used consistent with the principles of fair use under the copyright law." (PMC6980735 NCBI efetch db=pmc, &lt;permissions>/&lt;license>; `ncbi_pmc_melamed2020.xml`)
  - "Therefore, NCBI itself places no restrictions on the use or distribution of the data contained therein. Nor do we accept data when the submitter has requested restrictions on reuse or redistribution." (NCBI Policies and Disclaimers page, section "Molecular Data Usage"; `ncbi_policies.html`)
- **Strain, condition and identity evidence, verbatim:**
  - "MG1655, Δ hfq ::cat-sacB (GSO954), or Δ proQ::kan (GSO956) cells were grown to OD 600 ~ 1.0 in LB medium." (PMC6980735 author manuscript, Methods; `ncbi_pmc_melamed2020.xml`)
- **Inspected:** GEO records only.
- **Without an account:** Yes (GEO FTP)
- **Limitations:** Text-mining notice only.
- **Licence standing (a characterisation, not a decision):** No grant: link-only by the ledger rule.
- **Recommendation:** link-only; recommend reject. No grant.

#### L4-06: Iosub et al. 2020 Hfq CLASH sRNA to target interactions

- **Identifiers:** PMID 32356726; PMCID PMC7213987; DOI 10.7554/eLife.54655; GEO GSE123050 (accession as stated in the article's data availability section; the GEO record itself was not fetched)
- **Measures:** Hfq-bound RNA duplexes by UV cross-linking, ligation and sequencing of hybrids (CLASH). **Units:** hybrid read counts.
- **Strain:** MG1655 hfq::HTF (tagged derivative). **Match to MG1655:** partial.
- **Conditions:** Growth-phase series; not extracted. **Replicates:** not extracted.
- **Identifier namespace:** not inspected (bundle download timed out). **Route to b-number:** not established
- **Terms, verbatim:**
  - "https://creativecommons.org/licenses/by/4.0/ This article is distributed under the terms of the Creative Commons Attribution License , which permits unrestricted use and redistribution provided that the original author and source are credited." (PMC7213987 Europe PMC fullTextXML, &lt;permissions>/&lt;license>; `epmc_ft_iosub2020.xml`)
- **Strain, condition and identity evidence, verbatim:**
  - "The E. coli K12 strain used for CLASH experiments, MG1655 hfq ::HTF was previously reported ( Tree et al., 2014 )." (PMC7213987 full text, Materials and methods; `epmc_ft_iosub2020.xml`)
- **Inspected:** Supplement bundle not retrieved in full: the Europe PMC download stopped at the 280 s limit (curl exit 28).
- **Without an account:** Yes
- **Limitations:** Tables not inspected.
- **Licence standing (a characterisation, not a decision):** Article CC BY 4.0; a grant over its unread tables would be inferred from it. The tables were not retrieved, so no per-file legend could be looked for; a grant over them would be inferred from the article licence under the same reasoning as row L2-03.
- **Recommendation:** bring second (layer 4, sRNA targets); insufficient evidence. The CC BY measured sRNA-target source in an MG1655 background; needs the tables read before ranking against RegulonDB sRNA rows.

### Layer 5: Gene essentiality and fitness

**A genome-wide essentiality call measured in MG1655 itself exists with a file-level grant: Choe et al. 2022 (row L5-14).** Its Table S1 is keyed by `b`-number on `NC_000913.3`, carries its own CC BY 4.0 legend, and gives a call for 4,498 genes on LB (523 essential) and on M9 glucose (654). The first pass missed it and said no such source had been found; that statement is withdrawn. The paper is itself a study of the false calls this method makes (68 PEC-essential genes called non-essential, 290 genes with viable deletions called essential), and it does not report replication of its libraries, so the row is a candidate with stated caveats and not ground truth. The earlier MG1655 screen (Gerdes 2003, L5-04) still has no licence statement and no retrieved table of its own. The knockout-based calls (L5-01, L5-02) and the TraDIS call with an "unclear" class (L5-03) are BW25113, a cross-substrain transfer here. CRISPRi fitness in MG1655 derivatives exists in CC BY articles (L5-05, L5-06), keyed by gene symbol. Two further MG1655-background transposon studies from the bounded search are recorded as supporting rows (L5-15, L5-16); section 9 lists the leads that were not verified.

| Row | Source | Strain match | Route to b-number | Licence standing | Recommendation |
| --- | --- | --- | --- | --- | --- |
| L5-01 | Keio single-gene deletion collection (Baba et al. 2006) | partial (K-12 BW25113: a cross-substrain transfer here) | Direct: Supplementary Table 6 carries a b-number per essential candidate (300 distinct b-numbers in 303 … | No licence text was found: the &lt;permissions> block of the retrieved XML holds only the copyright statement quoted here | link-only until the licence is read; superseded for redistribution by L5-02 and L5-03 |
| L5-02 | Keio collection update (Yamamoto et al. 2009) | partial (cross-substrain) | Direct: Supplementary Table V carries a b-number per record (3,864 distinct) | Conditional grant: the licence text quoted here permits distribution and derivative works under the same or a similar licence and … | supporting |
| L5-03 | TraDIS essential genome of K-12 (Goodall et al. 2018) | partial (cross-substrain) | Not established without the file | Affirmative grant at file level: the Table S1 legend itself states CC BY 4.0, the same pattern as the Adomako 2022 Data Set S1 … | bring as the cross-substrain comparator to L5-14 |
| L5-04 | Genetic footprinting of essential genes in MG1655 (Gerdes et al. 2003) | exact | Not established | No grant: publisher copyright with no licence statement. Link-only by the ledger rule | link-only |
| L5-05 | Genome-wide CRISPRi screen (Rousset et al. 2018) | partial (engineered MG1655 derivative) | Gene symbol to b-number (name-based: ambiguity and synonym drift must be reported); guide positions are on … | Inferred from the article licence (CC BY); no file-level grant shown | bring second (as a fitness measure, beside L5-14) |
| L5-06 | Pooled CRISPRi functional genomics (Wang et al. 2018) | partial (engineered MG1655 derivative) | Not established | Article CC BY 4.0; a grant over its uninspected tables would be inferred from it | supporting |
| L5-07 | Fitness Browser RB-TnSeq, E. coli BW25113 (Price et al. 2018; Wetmore et al. 2015) | partial (cross-substrain) | Not established | Undetermined: site terms not retrieved; Price 2018 not readable by deposit. Wetmore 2015 (the method paper) is CC BY-NC-SA 3.0 | not retrieved |
| L5-08 | Chemical-genomic phenotypic landscape of the Keio collection (Nichols et al. 2011) | partial (cross-substrain) | Not established | No grant: "All rights reserved" with a text-mining notice. Link-only by the ledger rule | link-only |
| L5-09 | PEC: Profiling of the E. coli Chromosome database | not established | Not established | Undetermined: link-only until terms are read | link-only |
| L5-10 | DEG: Database of Essential Genes (aggregator) | not established | Not established | No grant read: copyright footer only. Link-only | not recommended |
| L5-11 | Gene essentiality across the E. coli species (Rousset et al. 2021) | not established | Not established | Undetermined: not read | not retrieved |
| L5-12 | Conditionally essential genes (Joyce et al. 2006) | not established | Not established | No grant: copyright statement only | not retrieved |
| L5-13 | Mismatch-CRISPRi expression-fitness relationships (Hawkins et al. 2020) | not established | Not established | No usable grant either way: a text-mining notice in the deposit, and CC BY-NC-ND per the Europe PMC label would exclude a derived … | link-only |
| L5-14 | Hypersaturated Tn-seq gene essentiality in MG1655 (Choe et al. 2022) | exact | Direct: the `Locus Tag` column is the b-number and the sequence is that of the genome of record | Affirmative grant at file level: the Table S1 legend itself carries the CC BY 4.0 statement, the pattern of the ledger's Adomako … | bring first |
| L5-15 | TraDIS essential-gene list from MG1655 resistance-plasmid libraries (Wellner et al. 2024) | partial (engineered MG1655 derivatives) | Direct for the listed genes | Inferred from the article licence (CC BY 4.0); no file-level grant shown | supporting |
| L5-16 | TraDIS fitness under a model honey in MG1655 (Masoura et al. 2021) | exact | Gene name to b-number (name-based: ambiguity and synonym drift must be reported) | Inferred from the article licence (CC BY); no file-level grant shown | supporting |
| L7-01 | EcoCyc (BioCyc Tier 1 curated database for E. coli K-12 MG1655) | exact | EcoCyc gene id to b-number through the pinned RefSeq GFF: all 4,651 gene and pseudogene features carry … | Affirmative grant with conditions for EcoCyc specifically: the BioCyc limited-use licence defines "Open Databases" as the EcoCyc … | bring first |

#### L5-01: Keio single-gene deletion collection (Baba et al. 2006)

- **Identifiers:** PMID 16738554; PMCID PMC1681482; DOI 10.1038/msb4100050; Supplementary Table 6 `msb4100050-s8.xls` (107,008 B, SHA-256 prefix ded72d1f890d47b0); Supplementary Table 3 `msb4100050-s5.xls` (a1a9c30b6cd703ff)
- **Measures:** Whether an in-frame single-gene deletion could be obtained; 303 genes could not be disrupted and are essential candidates; growth of each mutant in rich and minimal medium. **Units:** Categorical (deletion obtained or not); OD600 growth in two media.
- **Strain:** K-12 BW25113; not MG1655. **Match to MG1655:** partial (K-12 BW25113: a cross-substrain transfer here).
- **Conditions:** Yamamoto 2009 describes the Keio host as assessed during aerobic growth at 37 °C on LB agar; Baba 2006 also tested each mutant in LB and in 0.4% glucose MOPS medium. **Replicates:** Supplementary Table 3 has columns `colonies tested` and `percent` per gene; not a replicated quantitative assay.
- **Identifier namespace:** ECK number, gene name, JW id and b-number columns. **Route to b-number:** Direct: Supplementary Table 6 carries a b-number per essential candidate (300 distinct b-numbers in 303 records).
- **Terms, verbatim:**
  - "Copyright © 2006, EMBO and Nature Publishing Group" (PMC1681482 Europe PMC fullTextXML, &lt;permissions> (no &lt;license> element; copyright statement only); `epmc_ft_baba2006.xml`)
- **Strain, condition and identity evidence, verbatim:**
  - "We were unable to disrupt 303 genes, including 37 of unknown function, which are candidates for essential genes." (PMC1681482 full text, Abstract; `epmc_ft_baba2006.xml`)
  - "Mutants were directly selected as kanamycin-resistant (Km R ) colonies after electroporation of BW25113 carrying the λ Red expression plasmid pKD46" (PMC1681482 full text, Results; `epmc_ft_baba2006.xml`)
  - "at least not in the genetic background of our host E . coli K-12 BW25113 during aerobic growth at 37°C on LB agar." (PMC2824493 (Yamamoto 2009) full text, on the conditions of the Keio essentiality call; `epmc_ft_yamamoto2009.xml`)
- **Inspected:** s8.xls sheet "Sup Table 6": four heading rows, then 303 records (301 distinct ECK numbers), matching the article's 303; columns ECK number, gene, W3110 information, MG1655 information, genetic, PEC, MG_Tn5, Score, and others. s5.xls "Sup Table 3": four heading rows, then 4,378 records. File checksums: section 6.2.
- **Without an account:** Yes (Europe PMC supplementaryFiles)
- **Limitations:** Measured in BW25113. "Essential" here means no deletion was recovered on LB, which later work revised gene by gene (Yamamoto 2009, Goodall 2018). The retrieved XML carries a copyright line and no licence element.
- **Licence standing (a characterisation, not a decision):** No licence text was found: the &lt;permissions> block of the retrieved XML holds only the copyright statement quoted here. Under the ledger rule that leaves no affirmative grant: link-only until a licence statement for this article is read on the publisher page (not attempted).
- **Recommendation:** link-only until the licence is read; superseded for redistribution by L5-02 and L5-03; insufficient evidence. The canonical knockout essentiality call; the licence gap, not the science, keeps it from first place.

#### L5-02: Keio collection update (Yamamoto et al. 2009)

- **Identifiers:** PMID 20029369; PMCID PMC2824493; DOI 10.1038/msb.2009.92; Supplementary Table V `msb200992-s5.xls` (734,208 B, SHA-256 prefix 8b7225b7357d4a3a)
- **Measures:** Re-verification of each Keio deletion mutant; corrected status per gene. **Units:** Categorical per-mutant status.
- **Strain:** K-12 BW25113; not MG1655. **Match to MG1655:** partial (cross-substrain).
- **Conditions:** Aerobic growth at 37 °C on LB agar. **Replicates:** not extracted.
- **Identifier namespace:** gene id (b-number), JW id and ECK number columns. **Route to b-number:** Direct: Supplementary Table V carries a b-number per record (3,864 distinct).
- **Terms, verbatim:**
  - "This is an open-access article distributed under the terms of the Creative Commons Attribution Licence, which permits distribution and reproduction in any medium, provided the original author and source are credited. Creation of derivative works is permitted but the resulting work may be distributed only under the same or similar licence to this one. This licence does not permit commercial exploitation without specific permission." (PMC2824493 Europe PMC fullTextXML, &lt;permissions>/&lt;license>; `epmc_ft_yamamoto2009.xml`)
- **Strain, condition and identity evidence, verbatim:**
  - "Thus, some ORFs reported as essential in the PEC database are nonessential, at least not in the genetic background of our host E . coli K-12 BW25113 during aerobic growth at 37°C on LB agar." (PMC2824493 full text; `epmc_ft_yamamoto2009.xml`)
- **Inspected:** s5.xls sheet "report_export2.tab": a block of notes and two header rows, then 3,864 records, each with a distinct b-number. File checksums: section 6.2.
- **Without an account:** Yes (Europe PMC supplementaryFiles)
- **Limitations:** Measured in BW25113. An update to L5-01 rather than an independent screen.
- **Licence standing (a characterisation, not a decision):** Conditional grant: the licence text quoted here permits distribution and derivative works under the same or a similar licence and excludes commercial exploitation (Europe PMC labels it cc by-nc-sa). No evidence-based ledger rule yet for NC-SA. The table is a supplementary file without a legend of its own, so the article-to-file inference described in row L2-03 applies here too.
- **Recommendation:** supporting; recommend admit with caveat. Carries the corrected Keio status under a readable licence.

#### L5-03: TraDIS essential genome of K-12 (Goodall et al. 2018)

- **Identifiers:** PMID 29463657; PMCID PMC5821084; DOI 10.1128/mBio.02096-17; Table S1 `mbo001183726st1.xlsx`; Table S4 `mbo001183726st4.xlsx`; ENA PRJEB24436
- **Measures:** Transposon-insertion density per gene (insertion index) with essential, non-essential and unclear calls: 358 essential, 162 unclear, 3,793 non-essential. **Units:** Insertion index per coding sequence and a categorical call.
- **Strain:** K-12 BW25113; not MG1655. **Match to MG1655:** partial (cross-substrain).
- **Conditions:** LB (Table S4 gives calls after outgrowth in LB); library selection medium not extracted. **Replicates:** not extracted.
- **Identifier namespace:** not inspected: Table S1 was not retrieved (the Europe PMC bundle held Table S2 as PDF and figures only; the europepmc.org file link answered HTTP 403 with a script challenge). **Route to b-number:** Not established without the file.
- **Terms, verbatim:**
  - "This is an open-access article distributed under the terms of the Creative Commons Attribution 4.0 International license ." (PMC5821084 Europe PMC fullTextXML, &lt;permissions>/&lt;license>; `epmc_ft_goodall2018.xml`)
  - "TABLE S1 Essential genes identified by TraDIS as essential. Download TABLE S1, XLSX file, 0.2 MB . Copyright © 2018 Goodall et al. This content is distributed under the terms of the Creative Commons Attribution 4.0 International license ." (PMC5821084 full text XML, &lt;supplementary-material> legend for mbo001183726st1.xlsx; `epmc_ft_goodall2018.xml`)
- **Strain, condition and identity evidence, verbatim:**
  - "E. coli K-12 strain BW25113, the parent strain of the Keio library, was used for construction of a transposon library." (PMC5821084 full text, Materials and Methods; `epmc_ft_goodall2018.xml`)
  - "sufficient insertions were found in 3,793 genes for them to be classed as nonessential, 162 genes were situated between the two modes and classed as unclear, and 358 genes in the mutant library were identified as essential ( Table S1 )." (PMC5821084 full text, Results; `epmc_ft_goodall2018.xml`)
- **Inspected:** Per-file legend read; the workbook itself not retrieved.
- **Without an account:** Table S1 not retrieved without a browser; article and legend yes
- **Limitations:** Measured in BW25113. An insertion-density call is a statistical classification with an "unclear" band (162 genes).
- **Licence standing (a characterisation, not a decision):** Affirmative grant at file level: the Table S1 legend itself states CC BY 4.0, the same pattern as the Adomako 2022 Data Set S1 already shipped. Article CC BY 4.0.
- **Recommendation:** bring as the cross-substrain comparator to L5-14; recommend admit with caveat. Per-file CC BY 4.0, quantitative, with an explicit "unclear" class. The caveat is the substrain, which the owner must rule on; row L5-14 now offers a call measured in MG1655 itself, so this row is the cross-substrain comparator rather than the only choice.

#### L5-04: Genetic footprinting of essential genes in MG1655 (Gerdes et al. 2003)

- **Identifiers:** PMID 13129938; PMCID PMC193955; DOI 10.1128/JB.185.19.5673-5684.2003
- **Measures:** Transposon-insertion footprinting across the genome: 620 genes essential and 3,126 dispensable. **Units:** Categorical call per gene.
- **Strain:** MG1655 (F- lambda- ilvG rfb-50 rph-1). **Match to MG1655:** exact.
- **Conditions:** Logarithmic aerobic growth in enriched LB medium. **Replicates:** not extracted.
- **Identifier namespace:** not inspected (supplement not retrieved). **Route to b-number:** Not established.
- **Terms, verbatim:**
  - "American Society for Microbiology PMC Copyright notice" (PMC article page PMC193955: the only rights text under the author block is the publisher name followed by the PMC copyright-notice link; `pmc_page_gerdes2003.html`)
  - "American Society for Microbiology 2003" (PMC193955 NCBI efetch db=pmc, &lt;permissions> (no &lt;license> element; copyright statement only); `ncbi_pmc_gerdes2003.xml`)
- **Strain, condition and identity evidence, verbatim:**
  - "A genetic footprinting technique was used to assess gene essentiality in E. coli K-12 across the entire genome under uniform growth conditions (logarithmic aerobic growth of strain MG1655 in enriched LB medium)." (PMC193955 article page, Discussion; `pmc_page_gerdes2003.html`)
  - "We identified 620 genes as essential and 3,126 genes as dispensable for growth under these conditions." (PMC193955 article page, Abstract; `pmc_page_gerdes2003.html`)
  - "E. coli strain MG1655 (F − λ − ilvG rfb-50 rph-1 ) ( 16 ) was used throughout this work." (PMC193955 article page, Materials and Methods; `pmc_page_gerdes2003.html`)
- **Inspected:** Article page read. Supplementary gene list not retrieved: Europe PMC supplementaryFiles answers that the record is not open access.
- **Without an account:** Article page yes; per-gene table not retrieved
- **Limitations:** No licence statement, no retrieved per-gene table. The 620 count is about twice the 303 (Keio) and 358 (TraDIS) counts in rows L5-01 and L5-03; the reason was not examined here. A per-gene call attributed to this study is republished as the `Gerdes` column of Choe 2022 Table S1 (row L5-14: E 613, NE 3,885), under that table's CC BY 4.0 legend; it was not compared with the original.
- **Licence standing (a characterisation, not a decision):** No grant: publisher copyright with no licence statement. Link-only by the ledger rule.
- **Recommendation:** link-only; recommend reject. The first genome-wide screen run in MG1655 itself; no grant and no table of its own. Cite it beside row L5-14, which carries a copy of its calls.

#### L5-05: Genome-wide CRISPRi screen (Rousset et al. 2018)

- **Identifiers:** PMID 30403660; PMCID PMC6242692; DOI 10.1371/journal.pgen.1007749; S tables `pgen.1007749.s011.csv` (guide-level log2FC, SHA-256 prefix 015ebda56925fee9) and `pgen.1007749.s012.csv` (gene-level, 89c170375718d983); ENA PRJEB28256
- **Measures:** Depletion of dCas9 guide RNAs after 17 generations: guide-level log2 fold change and gene-level medians. **Units:** log2 fold change per guide; median per gene; an `essential` flag column.
- **Strain:** LC-E75, an MG1655 derivative carrying chromosomal dCas9. **Match to MG1655:** partial (engineered MG1655 derivative).
- **Conditions:** 17 generations; the group's earlier screen is described as rich medium, and the medium of this screen was not extracted. **Replicates:** Triplicates from three independent transformations.
- **Identifier namespace:** Gene symbols (4,213 gene records, all distinct, in the gene-level table); guides designed on NC_000913.2. **Route to b-number:** Gene symbol to b-number (name-based: ambiguity and synonym drift must be reported); guide positions are on NC_000913.2.
- **Terms, verbatim:**
  - "This is an open access article distributed under the terms of the Creative Commons Attribution License , which permits unrestricted use, distribution, and reproduction in any medium, provided the original author and source are credited." (PMC6242692 Europe PMC fullTextXML, &lt;permissions>/&lt;license>; `epmc_ft_rousset2018.xml`)
- **Strain, condition and identity evidence, verbatim:**
  - "We constructed to this end strain LC-E75, a derivative of E . coli MG1655 carrying dCas9 on its chromosome under the control of an aTc-inducible promoter" (PMC6242692 full text, Results; `epmc_ft_rousset2018.xml`)
  - "This screen was performed over 17 generations in triplicates from independent aliquots of the library generated from 3 independent transformations into strain LC-E75." (PMC6242692 full text, Results; `epmc_ft_rousset2018.xml`)
  - "These sgRNAs target 20-nt regions adjacent to NGG sites in E . coli K-12 MG1655 ( NC_000913.2 )" (PMC6242692 full text, Methods; `epmc_ft_rousset2018.xml`)
- **Inspected:** s012.csv: one header row and 4,213 gene records; columns gene, essential (TRUE 295, FALSE 3,918), gene_ori, gene_left, gene_right, median_coding, median_template, mad_coding, mad_template, coding, template, operon. s011.csv: one header row and 59,246 guide records (columns target, position, ori, coding, gene, essential, gene_left, gene_right, gene_ori, log2FC, padj, gamma). File checksums: section 6.2.
- **Without an account:** Yes (Europe PMC supplementaryFiles)
- **Limitations:** Knock-down acts on transcription units, so an effect can extend to co-transcribed genes (the gene tables carry an `operon` column); this is a fitness measure, not a deletion phenotype. Symbol-keyed.
- **Licence standing (a characterisation, not a decision):** Inferred from the article licence (CC BY); no file-level grant shown. No per-file legend and no publisher statement extending the article licence to this supplementary file was found in the retrieved XML, so a grant over the file is inferred from the article licence, not shown. The source ledger has no rule for a publisher-hosted supplementary file without its own legend: its article-licence rule is written for a GEO deposit ("the article's licence is taken as the grant over the article's deposited data"), and its two file-level precedents (Adomako 2022 Data Set S1; PXD005851 Table S1) each rest on a legend. Applying the article licence here would extend the GEO-deposit rule by analogy, which is an owner ledger decision; the owner's 2026-10-05 redistribution decision is a separate basis and is not evidence of a file-level grant.
- **Recommendation:** bring second (as a fitness measure, beside L5-14); recommend admit with caveat. A quantitative fitness measure in an MG1655 background in a CC BY article; it complements the insertion-frequency call of L5-14.

#### L5-06: Pooled CRISPRi functional genomics (Wang et al. 2018)

- **Identifiers:** PMID 29946130; PMCID PMC6018678; DOI 10.1038/s41467-018-04899-x; SRA PRJNA450392; GitHub zhangchonglab/CRISPRi-functional-genomics-in-prokaryotes
- **Measures:** Pooled dCas9 guide depletion screens for gene fitness. **Units:** guide and gene fitness scores (tables not inspected).
- **Strain:** MCm, a K-12 MG1655 derivative with a chloramphenicol-resistance cassette. **Match to MG1655:** partial (engineered MG1655 derivative).
- **Conditions:** not extracted. **Replicates:** Two biological replicates per library transformation.
- **Identifier namespace:** not inspected; library designed on NC_000913.3. **Route to b-number:** Not established.
- **Terms, verbatim:**
  - "Open Access This article is licensed under a Creative Commons Attribution 4.0 International License, which permits use, sharing, adaptation, distribution and reproduction in any medium or format, as long as you give appropriate credit to the original author(s) and the source, provide a link to the Creative Commons license, and indicate if changes were made." (PMC6018678 Europe PMC fullTextXML, &lt;permissions>/&lt;license>; `epmc_ft_wang2018.xml`)
- **Strain, condition and identity evidence, verbatim:**
  - "We transformed the sgRNA library by electroporation into E. coli strain MCm (a K12 MG1655 derivative with an integrated chloramphenicol-resistance cassette) carrying pdCas9-J23111." (PMC6018678 full text; `epmc_ft_wang2018.xml`)
  - "The library was independently transformed twice into either MCm/pdCas9-J23111 or MCm/pKanaNC, providing two biological replicates for each." (PMC6018678 full text; `epmc_ft_wang2018.xml`)
  - "gene annotation of NC_000913.3 was used for the sgRNA library (20-mer) design." (PMC6018678 full text, Methods; `epmc_ft_wang2018.xml`)
- **Inspected:** Supplement bundle not retrieved in full: the Europe PMC download stopped at the 280 s limit (curl exit 28).
- **Without an account:** Yes
- **Limitations:** Tables not inspected; conditions not extracted.
- **Licence standing (a characterisation, not a decision):** Article CC BY 4.0; a grant over its uninspected tables would be inferred from it. The tables were not inspected; a grant over them would be inferred from the article licence under the same reasoning as row L5-05.
- **Recommendation:** supporting; insufficient evidence. Same kind of evidence as L5-05 on the current sequence version; needs its tables read.

#### L5-07: Fitness Browser RB-TnSeq, E. coli BW25113 (Price et al. 2018; Wetmore et al. 2015)

- **Identifiers:** Price 2018: PMID 29769716, DOI 10.1038/s41586-018-0124-0 (no PMC deposit). Wetmore 2015: PMID 25968644, PMCID PMC4436071, DOI 10.1128/mBio.00306-15. Site https://fit.genomics.lbl.gov (organism id `Keio` requested)
- **Measures:** Condition-resolved gene fitness from randomly bar-coded transposon libraries. **Units:** not retrieved.
- **Strain:** BW25113 (per Wetmore 2015); not MG1655. **Match to MG1655:** partial (cross-substrain).
- **Conditions:** not retrieved. **Replicates:** not retrieved.
- **Identifier namespace:** not retrieved. **Route to b-number:** Not established.
- **Terms, verbatim:**
  - "https://creativecommons.org/licenses/by-nc-sa/3.0/ This is an open-access article distributed under the terms of the Creative Commons Attribution-Noncommercial-ShareAlike 3.0 Unported license , which permits unrestricted noncommercial use, distribution, and reproduction in any medium, provided the original author and source are credited." (PMC4436071 Europe PMC fullTextXML, &lt;permissions>/&lt;license>; `epmc_ft_wetmore2015.xml`)
- **Strain, condition and identity evidence, verbatim:**
  - "the model bacterium Escherichia coli BW25113 (a K-12 strain; parent strain of the Keio deletion collection" (PMC4436071 full text, Introduction; `epmc_ft_wetmore2015.xml`)
- **Inspected:** https://fit.genomics.lbl.gov/cgi-bin/org.cgi?orgId=Keio and help.cgi both answered HTTP 403 with a "Just a moment..." script challenge to a plain client; not solved. Price 2018 is in neither Europe PMC full text nor PMC (NCBI ID converter: "Identifier not found in PMC").
- **Without an account:** Not retrieved (script challenge); no account was tested
- **Limitations:** The data source itself was not read: strain per library, conditions, units, terms and file names are all not retrieved.
- **Licence standing (a characterisation, not a decision):** Undetermined: site terms not retrieved; Price 2018 not readable by deposit. Wetmore 2015 (the method paper) is CC BY-NC-SA 3.0.
- **Recommendation:** not retrieved; insufficient evidence. This is the E. coli counterpart of the fitness-screen data type admitted for the cyanobacterial view on 2026-10-05; a browser read by a person would settle its terms.

#### L5-08: Chemical-genomic phenotypic landscape of the Keio collection (Nichols et al. 2011)

- **Identifiers:** PMID 21185072; PMCID PMC3060659; DOI 10.1016/j.cell.2010.11.052
- **Measures:** Colony-size growth scores for 3,979 mutants across 324 conditions (114 unique stresses). **Units:** quantitative growth scores.
- **Strain:** Keio single-gene deletion library (BW25113 background per L5-01) plus essential-gene hypomorphs; not MG1655. **Match to MG1655:** partial (cross-substrain).
- **Conditions:** 324 conditions on agar plates. **Replicates:** not extracted.
- **Identifier namespace:** not inspected. **Route to b-number:** Not established.
- **Terms, verbatim:**
  - "This file is available for text mining. It may also be used consistent with the principles of fair use under the copyright law." (PMC3060659 NCBI efetch db=pmc, &lt;permissions>/&lt;license>; `ncbi_pmc_nichols2011.xml`)
- **Strain, condition and identity evidence, verbatim:**
  - "We determined quantitative growth scores for the Keio single-gene deletion library ( Baba et al., 2006 )" (PMC3060659 author manuscript, Results; `ncbi_pmc_nichols2011.xml`)
  - "were grown in 324 conditions covering 114 unique stresses" (PMC3060659 author manuscript, Results; `ncbi_pmc_nichols2011.xml`)
- **Inspected:** Author manuscript read via NCBI efetch; supplementary tables not retrieved (record not open access).
- **Without an account:** Tables not retrieved
- **Limitations:** All rights reserved; BW25113; data tables not retrieved.
- **Licence standing (a characterisation, not a decision):** No grant: "All rights reserved" with a text-mining notice. Link-only by the ledger rule.
- **Recommendation:** link-only; recommend reject. No grant.

#### L5-09: PEC: Profiling of the E. coli Chromosome database

- **Identifiers:** https://shigen.nig.ac.jp/ecoli/pec/ ; Version 4.10.10, last update April 23, 2025 (as shown on the front page)
- **Measures:** Curated essential, non-essential and unknown classification per gene: 302 essential, 4,439 non-essential, 5 unknown of 4,746. **Units:** categorical.
- **Strain:** not reported on the page read (the page cites GenBank U00096.2 and U00096.3 gene data updates). **Match to MG1655:** not established.
- **Conditions:** not reported on the page read. **Replicates:** not applicable (curation).
- **Identifier namespace:** not inspected. **Route to b-number:** Not established.
- **Terms, verbatim:** none read; see "Inspected".
- **Strain, condition and identity evidence, verbatim:**
  - "Last Update: April 23, 2025 Version: 4.10.10" (PEC front page; `pec_front.html`)
  - "essential 302 302 nonessential 4,439 3,146 unknown 5 5" (PEC front page, Statistical Table (columns Whole and Minimal); `pec_front.html`)
- **Inspected:** Front page only. No licence, terms or copyright statement appears in the retrieved front page text (terms: not reported on the page read; other pages not fetched).
- **Without an account:** Front page yes; download pages not tried
- **Limitations:** Terms and strain basis not established.
- **Licence standing (a characterisation, not a decision):** Undetermined: link-only until terms are read.
- **Recommendation:** link-only; insufficient evidence. Used as a comparator by Keio and TraDIS papers; not itself needed if those are admitted.

#### L5-10: DEG: Database of Essential Genes (aggregator)

- **Identifiers:** https://tubic.org/deg/ ; front page states "Last Update, Sep. 1, 2020"
- **Measures:** Aggregated essential-gene lists from published screens across organisms. **Units:** categorical.
- **Strain:** multiple; per-dataset. **Match to MG1655:** not established.
- **Conditions:** per source study. **Replicates:** not applicable.
- **Identifier namespace:** not inspected. **Route to b-number:** Not established.
- **Terms, verbatim:**
  - "Copyright © TUBIC, Tianjin University, Tianjin, China" (DEG front page footer; `deg_front.html`)
- **Strain, condition and identity evidence, verbatim:**
  - "Last Update, Sep. 1, 2020" (DEG front page; `deg_front.html`)
- **Inspected:** Front page only; no licence text beyond the copyright footer.
- **Without an account:** Front page yes
- **Limitations:** Secondary aggregation of the primary screens listed above; not updated since 2020.
- **Licence standing (a characterisation, not a decision):** No grant read: copyright footer only. Link-only.
- **Recommendation:** not recommended; recommend reject. Adds nothing over the primary sources and carries no licence.

#### L5-11: Gene essentiality across the E. coli species (Rousset et al. 2021)

- **Identifiers:** PMID 33462433; DOI 10.1038/s41564-020-00839-y (author and publisher corrections PMID 33723410, 33833431)
- **Measures:** Gene essentiality compared across E. coli strains (title only); would show how far a call transfers between strains. **Units:** not retrieved.
- **Strain:** not retrieved. **Match to MG1655:** not established.
- **Conditions:** not retrieved. **Replicates:** not retrieved.
- **Identifier namespace:** not retrieved. **Route to b-number:** Not established.
- **Terms, verbatim:** none read; see "Inspected".
- **Strain, condition and identity evidence, verbatim:**
  - ""pmid":"33462433"" (Europe PMC REST search response for the article title (identifier resolution only); `epmc_search_rousset2021.json`)
- **Inspected:** Not in PMC and not in Europe PMC full text.
- **Without an account:** Not retrieved
- **Limitations:** Not read.
- **Licence standing (a characterisation, not a decision):** Undetermined: not read.
- **Recommendation:** not retrieved; insufficient evidence. Listed so the gap is visible; a person with library access can supply it.

#### L5-12: Conditionally essential genes (Joyce et al. 2006)

- **Identifiers:** PMID 17012394; PMCID PMC1698209; DOI 10.1128/JB.00740-06
- **Measures:** Assessment of conditionally essential genes (title); Nichols 2011 cites it as a study of Keio Collection auxotrophs; body not read. **Units:** not retrieved.
- **Strain:** not retrieved. **Match to MG1655:** not established.
- **Conditions:** not retrieved. **Replicates:** not retrieved.
- **Identifier namespace:** not retrieved. **Route to b-number:** Not established.
- **Terms, verbatim:**
  - "Copyright © 2006, American Society for Microbiology 2006" (PMC1698209 NCBI efetch db=pmc, &lt;permissions> (no &lt;license> element; copyright statement only); `ncbi_pmc_joyce2006.xml`)
- **Inspected:** NCBI efetch returned front matter and the permissions block without a body; the PMC article page answered with a reCAPTCHA page on the one attempt and was not retried.
- **Without an account:** Body not retrieved
- **Limitations:** Not read.
- **Licence standing (a characterisation, not a decision):** No grant: copyright statement only.
- **Recommendation:** not retrieved; insufficient evidence. Cited by Nichols 2011 as the Keio auxotroph study; a candidate for condition-dependent essentiality.

#### L5-13: Mismatch-CRISPRi expression-fitness relationships (Hawkins et al. 2020)

- **Identifiers:** PMID 33080209; PMCID PMC7704046; DOI 10.1016/j.cels.2020.09.009; SRA PRJNA574461
- **Measures:** Titrated knock-down of essential genes and the resulting fitness. **Units:** not extracted.
- **Strain:** not established from the passages read (BW25113 appears in strain construction). **Match to MG1655:** not established.
- **Conditions:** not extracted. **Replicates:** not extracted.
- **Identifier namespace:** not inspected. **Route to b-number:** Not established.
- **Terms, verbatim:**
  - "This file is available for text mining. It may also be used consistent with the principles of fair use under the copyright law." (PMC7704046 NCBI efetch db=pmc, &lt;permissions>/&lt;license>; `ncbi_pmc_hawkins2020.xml`)
- **Strain, condition and identity evidence, verbatim:**
  - "cassettes into BW25113, selecting for chloramphenicol resistance." (PMC7704046 author manuscript, Methods (strain construction; not a statement of the screening strain); `ncbi_pmc_hawkins2020.xml`)
- **Inspected:** Author manuscript read via NCBI efetch; the screening strain was not located in the sentences examined. Europe PMC labels the record cc by-nc-nd while the deposited XML carries only a text-mining notice.
- **Without an account:** Yes
- **Limitations:** Strain not established; licence label and deposited notice disagree.
- **Licence standing (a characterisation, not a decision):** No usable grant either way: a text-mining notice in the deposit, and CC BY-NC-ND per the Europe PMC label would exclude a derived table.
- **Recommendation:** link-only; recommend reject. Covers essential genes only and carries no grant for a derived table.

#### L5-14: Hypersaturated Tn-seq gene essentiality in MG1655 (Choe et al. 2022)

- **Identifiers:** PMID 36507678; PMCID PMC9948719; DOI 10.1128/msystems.00896-22 (mSystems 8(1):e00896-22; no correction listed in the Europe PMC record on 2026-10-05); Table S1 `msystems.00896-22-s0002.xlsx` (758,879 B, SHA-256 b1b27667bb9671e0cf031c46bb91e99077e759f4ccd5f75642c809e4d8b9595e); Text S1 `msystems.00896-22-s0001.docx`; ENA PRJEB22130 (runs ERR2093970 Tn-Seq_MG1655_LB and ERR2093971 Tn-Seq_MG1655_M9)
- **Measures:** Tn5 transposon-insertion frequency per gene (insertions per kilobase per million insertions, IPKM, and its end-curated form ecIPKM) with an essential or non-essential call, in two media: 523 essential and 3,975 non-essential on LB; 654 essential and 3,844 non-essential on M9 glucose (counted in Table S1). **Units:** insertion count, IPKM and ecIPKM per gene; categorical call E or NE at the cutoff ecIPKM 2.2.
- **Strain:** E. coli K-12 MG1655, not an engineered background (a Δhns ΔstpA strain was used for a separate comparison). **Match to MG1655:** exact.
- **Conditions:** Aerobic, 37 °C; mutants selected on solid LB or M9 glucose (2 g/L) agar with kanamycin 50 µg/mL; about 1 × 10^6 mutants; 400,096 unique insertion sites from 2.4 × 10^6 mapped reads on LB. **Replicates:** not reported: the article and Text S1 state no replicate number for the transposon libraries (the words replicate, duplicate and triplicate do not occur in the article, and occur in Text S1 only for read duplication), and ENA lists one Tn-Seq run per condition, whereas the ChIP-exo samples of the same project are labelled Rep1 and Rep2.
- **Identifier namespace:** b-number in the `Locus Tag` column (4,498 data records, 4,498 distinct b-numbers), gene name, and Start and End coordinates; reads were mapped to NC_000913.3. **Route to b-number:** Direct: the `Locus Tag` column is the b-number and the sequence is that of the genome of record. The table has 4,498 genes against 4,651 gene features in the annotation of record; which are absent was not determined (no join performed).
- **Terms, verbatim:**
  - "https://creativecommons.org/licenses/by/4.0/ This is an open-access article distributed under the terms of the Creative Commons Attribution 4.0 International license ." (PMC9948719 Europe PMC fullTextXML, &lt;permissions>/&lt;license>; `epmc_ft_choe2022.xml`)
  - "TABLE S1 Gene essentiality determined by Tn-Seq (PEC, gene essentiality categorization according to the Profiling of E. coli Chromosome [PEC] database; NE, nonessential gene; E, essential gene; Gerdes, gene essentiality determined by previous Tn-Seq [Gerdes et al., 2003]; IPKM, insertion per kilobase per million mapped reads; ec, calculation after end-curation). Download Table S1, XLSX file, 0.7 MB . Copyright © 2022 Choe et al. 2022 Choe et al. https://creativecommons.org/licenses/by/4.0/ This content is distributed under the terms of the Creative Commons Attribution 4.0 International license ." (PMC9948719 full text XML, &lt;supplementary-material> legend for Table S1 (msystems.00896-22-s0002.xlsx); `epmc_ft_choe2022.xml`)
- **Strain, condition and identity evidence, verbatim:**
  - "We constructed 1 million transposon insertion mutants of E. coli K-12 MG1655 capable of growing on solid LB medium (see Text S1 in the supplemental material)." (PMC9948719 full text, Observation; `epmc_ft_choe2022.xml`)
  - "From 2.4 × 10 6 mapped reads, a high-resolution transposon insertion landscape consisting of 400,096 unique TISs was obtained" (PMC9948719 full text, Observation; `epmc_ft_choe2022.xml`)
  - "We defined ecIPKM of 2.2 as a cutoff where accuracy was maximized ( Text S1 , Fig. 1G , and Fig. S2F and G ). Using this criterion, 523 genes were determined as essential, of which 233 were PEC essential genes" (PMC9948719 full text, Observation; `epmc_ft_choe2022.xml`)
  - "Tn-Seq with the ecIPKM metric failed to detect 68 PEC essential genes" (PMC9948719 full text, section "Tn-Seq failed to detect 68 essential genes"; `epmc_ft_choe2022.xml`)
  - "Overall, most of the false positives (238/290; 82.1%) contained NAP-binding regions covering more than 80% of the genic region, although the two data sets were collected from cells grown in different media." (PMC9948719 full text, section "DNA-binding proteins interfered with transposon insertion"; `epmc_ft_choe2022.xml`)
  - "E. coli K-12 MG1655 was used in this study, unless otherwise described. The cells were grown aerobically at 37 ºC on Luria-Bertani or M9 minimal medium (56.4 g/L M9 minimal salt, 2 mM MgSO4, 0.1 mM CaCl2, and 2 g/L glucose)." (Text S1 (msystems.00896-22-s0001.docx), Bacterial strains and culture conditions; `choe2022_TextS1.docx`)
  - "The trimmed reads were mapped to E. coli K-12 MG1655 genome sequence (NC_000913.3)" (Text S1, Sequencing data processing; `choe2022_TextS1.docx`)
  - "there will be no precise number of ecIPKM that perfectly determines gene essentiality. There will be a certain level of arbitrariness near the cutoff because it is hard to distinguish genes whose disruption induces extreme growth retardation or complete lethality." (Text S1, Determination of ecIPKM cutoff; `choe2022_TextS1.docx`)
  - "Tn-Seq_MG1655_LB" (ENA file report for PRJEB22130, sample title of run ERR2093970; `ena_PRJEB22130_runs.tsv`)
  - "Tn-Seq_MG1655_M9" (ENA file report for PRJEB22130, sample title of run ERR2093971; `ena_PRJEB22130_runs.tsv`)
- **Inspected:** Table S1, sheet "Table S1": two header rows, then 4,498 data records, each with a distinct b-number. Columns: Gene, Start, End, Length (nt), Strand, Locus Tag, CDS (Y 4,319, N 179), Pseudo (Y 184, N 4,314), PEC (E 301, NE 4,197), Gerdes (E 613, NE 3,885), then for "LB medium" and for "M9 glucose (0.2%) medium": Insertion, IPKM, ec Insertion, ecIPKM, Essentiality. LB: E 523, NE 3,975. M9 glucose: E 654, NE 3,844. The bundle downloaded completely (14 members; archive test passed). ENA lists 16 runs: 4 Tn-Seq (MG1655 LB, MG1655 M9, MG1655 M9+Arg, DKO M9) and 12 ChIP-exo. File checksums: section 6.2.
- **Without an account:** Yes (Europe PMC supplementaryFiles; ENA public)
- **Limitations:** The paper's subject is the error of exactly this kind of call. Against the PEC list, 68 PEC-essential genes were called non-essential (insertions tolerated in non-essential subgenic domains, polar effects, and other causes) and 290 genes with available deletion mutants were called essential, 238 of them covered by nucleoid-associated-protein binding regions that hinder insertion. A call here is an insertion-frequency classification at one cutoff (ecIPKM 2.2, chosen to maximise agreement with PEC), not a deletion phenotype and not ground truth. Replication of the libraries is not reported. Mutants were selected on solid medium. The 523 and the error analysis are stated for LB; the M9 glucose calls are in the table without a separate error analysis. Six phantom genes were excluded by the authors. 4,498 genes, not the current 4,651.
- **Licence standing (a characterisation, not a decision):** Affirmative grant at file level: the Table S1 legend itself carries the CC BY 4.0 statement, the pattern of the ledger's Adomako 2022 Data Set S1 and PXD005851 Table S1 precedents. The article is CC BY 4.0.
- **Recommendation:** bring first; recommend admit with caveat. The one genome-wide essentiality call found that is measured in MG1655 itself, keyed by b-number on the sequence of record, with a per-file CC BY 4.0 legend and the table in hand. Its own false-positive and false-negative analysis has to travel with it, and replication is not reported.

#### L5-15: TraDIS essential-gene list from MG1655 resistance-plasmid libraries (Wellner et al. 2024)

- **Identifiers:** PMID 38378700; PMCID PMC10879529; DOI 10.1038/s41598-024-54169-8 (Sci Rep 14:4163; no correction listed in the Europe PMC record on 2026-10-05); Supplementary Table S3 `41598_2024_54169_MOESM2_ESM.xlsx` (46,344 B, SHA-256 88164d776a1564ccb88c67d9644a68d905435126f8dd2eba55ea32ff527fbe55); ENA PRJEB70315
- **Measures:** Transposon-directed insertion-site sequencing: a list of 371 genes classified essential on LB agar across three input libraries, with read count and insertion index per gene; conditional fitness under three aminoglycosides in further tables (not inspected). **Units:** read_count and ins_index (insertion index) per gene; membership of the essential list.
- **Strain:** MG1655 carrying aminoglycoside-resistance genes (streptomycin, gentamicin or neomycin); one strain is named MG1655_pACYC_aac(3)-IV. Not wild-type MG1655. **Match to MG1655:** partial (engineered MG1655 derivatives).
- **Conditions:** LB agar plates; the workbook title says "LB agar plate supplemented with trimethoprim (TRI)"; three libraries of more than 230,000 mutants each. **Replicates:** not extracted (the list is stated "across the three aminoglycoside-resistant libraries"; no replicate statement for library sequencing was found in the passages read).
- **Identifier namespace:** b-number in the `locus_tag` column (371 data records, 368 distinct cells matching b####), gene_name, start, end and strand; reads were mapped to U00096.3. **Route to b-number:** Direct for the listed genes. The file lists only genes called essential, so a gene absent from it is either non-essential or not assessed, which the file does not distinguish.
- **Terms, verbatim:**
  - "Open Access This article is licensed under a Creative Commons Attribution 4.0 International License, which permits use, sharing, adaptation, distribution and reproduction in any medium or format, as long as you give appropriate credit to the original author(s) and the source, provide a link to the Creative Commons licence, and indicate if changes were made." (PMC10879529 Europe PMC fullTextXML, &lt;permissions>/&lt;license>; `epmc_ft_wellner2024.xml`)
- **Strain, condition and identity evidence, verbatim:**
  - "We constructed three transposon mutant libraries each containing > 230.000 mutants in E. coli MG1655 strains harboring streptomycin ( aph(3″)-Ib/aph(6)-Id ), gentamicin ( aac(3)-IV ), or neomycin ( aph(3″)-Ia ) resistance gene(s)." (PMC10879529 full text, Abstract; `epmc_ft_wellner2024.xml`)
  - "371 genes were classified as ‘essential’ for growth on LB agar plates across the three aminoglycoside-resistant libraries" (PMC10879529 full text, Results; `epmc_ft_wellner2024.xml`)
  - "mapped against the MG1655 U00096.3 reference genome" (PMC10879529 full text, Methods; `epmc_ft_wellner2024.xml`)
  - "Essential-genes for growth on LB agar (with TRI) predicted in MG1655 (371 genes)" (Supplementary Table S3, sheet "Table S3", cell B2; `wellner2024_TableS3.xlsx`)
- **Inspected:** Workbook sheets "Table S3" (title) and "A.Essential genes MG1655": one header row and 371 data records; columns locus_tag, gene_name, ncrna, start, end, strand, read_count, ins_index, gene_length and others. The bundle downloaded completely (archive test passed). Tables S4 to S14 were not opened. File checksums: section 6.2.
- **Without an account:** Yes (Europe PMC supplementaryFiles)
- **Limitations:** An essential-only list, so it cannot by itself fill a genome-wide layer. The libraries are in resistance-gene-carrying derivatives and were selected with antibiotic. Same class of insertion-density call as L5-14, with the same kinds of error.
- **Licence standing (a characterisation, not a decision):** Inferred from the article licence (CC BY 4.0); no file-level grant shown. The licence block is the Springer Nature text, with its clause on third-party material. No per-file legend and no publisher statement extending the article licence to this supplementary file was found in the retrieved XML, so a grant over the file is inferred from the article licence, not shown. The source ledger has no rule for a publisher-hosted supplementary file without its own legend: its article-licence rule is written for a GEO deposit ("the article's licence is taken as the grant over the article's deposited data"), and its two file-level precedents (Adomako 2022 Data Set S1; PXD005851 Table S1) each rest on a legend. Applying the article licence here would extend the GEO-deposit rule by analogy, which is an owner ledger decision; the owner's 2026-10-05 redistribution decision is a separate basis and is not evidence of a file-level grant.
- **Recommendation:** supporting; insufficient evidence. Found in the further search. A second b-number-keyed essential set in an MG1655 background on the current sequence: a cross-check on L5-14, not a layer.

#### L5-16: TraDIS fitness under a model honey in MG1655 (Masoura et al. 2021)

- **Identifiers:** PMID 35111142; PMCID PMC8803141; DOI 10.3389/fmicb.2021.803307 (Front Microbiol 12:803307; no correction listed in the Europe PMC record on 2026-10-05); `Table_1.XLSX` (533,084 B, SHA-256 79412a1f8c4b02268d3e7d4032251e75038dcd37677d996870992b97e75d8ce5)
- **Measures:** Change in transposon-mutant abundance per gene after exposure to a model honey (log2 fold change with P values), at two exposure times; 450,581 unique insertion sites in the library. **Units:** log2 fold change of treated over control; P value; Bonferroni-adjusted P value.
- **Strain:** E. coli K-12 MG1655 (the transposon library was built in it). **Match to MG1655:** exact.
- **Conditions:** Model honey of sugars, hydrogen peroxide and gluconic acid for 30 or 90 min, then 2 h outgrowth in LB; untreated control. **Replicates:** Two biological replicates per condition (TL0_1, TL0_2; TL30_1, TL30_2; TL90_1, TL90_2).
- **Identifier namespace:** Gene names only (sheets "30min" and "90min", 4,479 data records each); no b-number column. **Route to b-number:** Gene name to b-number (name-based: ambiguity and synonym drift must be reported). First settle the reference: a figure legend gives accession CP009273 for "the MG1655 genome", and NCBI lists CP009273.1 as Escherichia coli BW25113.
- **Terms, verbatim:**
  - "https://creativecommons.org/licenses/by/4.0/ This is an open-access article distributed under the terms of the Creative Commons Attribution License (CC BY). The use, distribution or reproduction in other forums is permitted, provided the original author(s) and the copyright owner(s) are credited and that the original publication in this journal is cited, in accordance with accepted academic practice." (PMC8803141 Europe PMC fullTextXML, &lt;permissions>/&lt;license>; `epmc_ft_masoura2021.xml`)
- **Strain, condition and identity evidence, verbatim:**
  - "E. coli K-12 strain MG1655 was used for the construction of a transposon library." (PMC8803141 full text, Materials and Methods, Construction of Transposon Library; `epmc_ft_masoura2021.xml`)
  - "a total of 450,581 unique insertion sites were identified" (PMC8803141 full text, Results; `epmc_ft_masoura2021.xml`)
  - "The biological replicate samples are referred in the text as TL30 (TL30_1, TL30_2), TL90 (TL90_1, TL90_2), and TL0 (TL0_1, TL0_2)." (PMC8803141 full text, Materials and Methods; `epmc_ft_masoura2021.xml`)
  - "transposon library in strain MG1655, mapped to the MG1655 genome ( CP009273" (PMC8803141 full text, figure legend; `epmc_ft_masoura2021.xml`)
  - ""title":"Escherichia coli BW25113, complete genome"" (NCBI esummary db=nuccore for CP009273; `ncbi_nuccore_CP009273.json`)
- **Inspected:** Table_1.XLSX: sheet "KEY" (column definitions) and sheets "30min" and "90min", each one header row and 4,479 data records with columns log fold change, P.Value, adj.P.Val, Gene, Product. The KEY sheet says a missing value means no reads for the gene. The bundle downloaded completely. File checksums: section 6.2.
- **Without an account:** Yes (Europe PMC supplementaryFiles)
- **Limitations:** A fitness measure under one stress, not an essentiality call. Symbol-keyed. The reference accession the article cites belongs to BW25113.
- **Licence standing (a characterisation, not a decision):** Inferred from the article licence (CC BY); no file-level grant shown. No per-file legend and no publisher statement extending the article licence to this supplementary file was found in the retrieved XML, so a grant over the file is inferred from the article licence, not shown. The source ledger has no rule for a publisher-hosted supplementary file without its own legend: its article-licence rule is written for a GEO deposit ("the article's licence is taken as the grant over the article's deposited data"), and its two file-level precedents (Adomako 2022 Data Set S1; PXD005851 Table S1) each rest on a legend. Applying the article licence here would extend the GEO-deposit rule by analogy, which is an owner ledger decision; the owner's 2026-10-05 redistribution decision is a separate basis and is not evidence of a file-level grant.
- **Recommendation:** supporting; insufficient evidence. Found in the further search: condition-resolved transposon fitness measured in wild-type MG1655 exists under a CC BY article, for one stress.

### Layer 6: Protein abundance and translation

**Per-gene protein tables measured in MG1655 exist; none was found with a licence statement on the file itself.** Three were verified. The seven calibration runs of Mori 2021 (L6-03b): MG1655 sub-strain EQ353, three biological cultures in MOPS glucose, `b`-number keyed, corrected files pinned. Zhao 2019 (L6-10): MG1655 in M9 glucose, two biological replicates, `b`-number keyed against the assembly of record. Schmidt 2016 Table S9 (L6-01): MG1655 in LB and in glucose, biological triplicates, keyed by UniProt accession. The first two sit in CC BY articles whose supplementary files carry no legend of their own, so a grant over the file is an inference (section 4.5); the third has no grant. The first pass said that no source combined MG1655, a grant and a per-gene table, and described Mori 2021 as an NCM3722 dataset with one MG1655 sample. Both statements were wrong about the strain and are withdrawn: the one MG1655 sample it cited is a ribosome-profiling sample in GEO, and the proteomics has seven MG1655 runs. The NCM3722 condition series is now its own row (L6-03a). Ribosome occupancy in the exact strain exists under CC BY as coverage tracks, not a per-gene table (L6-05).

| Row | Source | Strain match | Route to b-number | Licence standing | Recommendation |
| --- | --- | --- | --- | --- | --- |
| L6-01 | Quantitative condition-dependent proteome (Schmidt et al. 2016) | partial (BW25113 for the condition series; exact for two MG1655 conditions) | For the MG1655 values in Table S9: UniProt accession to b-number through the UniProtKB ordered locus name … | No grant: the author-manuscript terms quoted here allow viewing, copying, downloading and text and data-mining for academic … | link-only; owner decision needed |
| L6-02 | Absolute protein synthesis rates by ribosome profiling (Li et al. 2014) | exact | Not established | No grant: "All rights reserved" with a text-mining notice. Link-only by the ledger rule | link-only |
| L6-03a | Absolute proteome across growth conditions, NCM3722 condition series (Mori et al. 2021) | none for the condition series (K-12 NCM3722: a cross-strain transfer here) | Direct for the identifier (b-number column). The strain is the obstacle, not the key | Inferred from the article licence (CC BY 4.0 on the article and on its Author Correction); no file-level grant shown | supporting (cross-strain) |
| L6-03b | Absolute proteome, MG1655 EQ353 calibration samples (Mori et al. 2021) | exact at strain level (MG1655); sub-strain EQ353 | Direct: the `Gene locus` column is the b-number | Inferred from the article licence (CC BY 4.0 on the article and on its Author Correction); no file-level grant shown | bring first |
| L6-04 | PaxDb 5.0 integrated protein abundance | not established | Not established | Article CC BY 4.0; the licence over the database files is undetermined (not retrieved) | not recommended before the primaries |
| L6-05 | Revised bacterial ribosome profiling (Mohammad, Green and Buskirk 2019) | exact | Positional on NC_000913.2; a per-gene occupancy value would be a computation from tracks | Affirmative grant by the ledger's GEO rule: article CC BY, taken as the grant over its deposited data | bring second |
| L6-06 | Initiation-site profiling with Onc112 and small proteins (Weaver et al. 2019) | exact | EcoCyc gene id to b-number through the `Dbxref=ECOCYC:` attribute of the pinned RefSeq GFF; positions are … | US-Government work per the article; applying that to the supplementary tables is an inference | supporting (layer 6); bring second (layer 9, small proteins) |
| L6-07 | Retapamulin-assisted initiation-site profiling (Meydan et al. 2019) | partial for BW25113; none for BL21 | Not established | No grant: link-only by the ledger rule | link-only |
| L6-08 | Proteome during growth and ethanol stress (Soufi et al. 2015) | partial (cross-substrain) | Not established | Split: article CC BY 4.0 (a grant over its unopened tables would be inferred); PRIDE files carry no grant | supporting |
| L6-09 | Single-cell protein and mRNA counts from a YFP fusion library (Taniguchi et al. 2010) | not established | Not established | No grant (text-mining notice only): link-only | link-only |
| L6-10 | Deep proteome quantification in MG1655 and BW25113 (Zhao et al. 2019) | exact for the MG1655 sheet | Direct: the `Synonym` column is the b-number, and the search database was the protein set of the assembly of … | Inferred from the article licence (CC BY); no file-level grant shown | bring second |
| L1-04 | Li et al. 2014 mRNA-seq and ribosome profiling (see row L6-02) | exact | None for mRNA: a per-gene value would have to be computed from the WIG tracks, which is reprocessing, not a … | No grant: the article is "All rights reserved" with a text-mining notice, so by the ledger rule the GEO files stay link-only | link-only |
| L1-06 | Balakrishnan et al. 2022 absolute mRNA and protein (NCM3722) | none (a different K-12 strain: a cross-strain transfer here) | not established | No grant (text-mining notice only): link-only by the ledger rule | link-only |
| L3-06 | Lalanne et al. 2018 Rend-seq transcript ends | exact | Positional (sequences taken from NC_000913.3) | No grant: link-only by the ledger rule | link-only |

#### L6-01: Quantitative condition-dependent proteome (Schmidt et al. 2016)

- **Identifiers:** PMID 26641532; PMCID PMC4888949; DOI 10.1038/nbt.3418; `NIHMS65833-supplement-Supplementary_tables.xlsx` (17,128,596 B, SHA-256 prefix 3280a13ff67a73f2), sheet "Table S6"; PRIDE PXD000498
- **Measures:** Absolute protein copies per cell by mass spectrometry for more than 2,300 proteins across 22 growth conditions. **Units:** protein copies per cell; protein mass per cell (fg).
- **Strain:** K-12 BW25113 for all 22 conditions (Tables S4 to S8); MG1655 and NCM3722 additionally in glucose and in LB, reported in a separate sheet (Table S9). **Match to MG1655:** partial (BW25113 for the condition series; exact for two MG1655 conditions).
- **Conditions:** 22 conditions including glucose, 50 mM NaCl, pH 6, 42 °C, anaerobic, stationary phase and other carbon sources (column headers of Table S4). **Replicates:** Biological triplicates for the strain comparison: Table S25 lists three files each for MG1655 in LB (A14-07016 to 07018) and in glucose (A14-07024 to 07026); Table S9 gives a coefficient of variation per strain and medium. Not extracted for the 22-condition series.
- **Identifier namespace:** Table S6 (BW25113, 22 conditions): UniProt accession, gene name and b-number columns (2,285 distinct b-numbers). Table S9 (the MG1655 values): UniProt accession and gene name only, no b-number column. **Route to b-number:** For the MG1655 values in Table S9: UniProt accession to b-number through the UniProtKB ordered locus name (row L7-02); not direct. The b-number column is in Table S6, which holds BW25113 values.
- **Terms, verbatim:**
  - "Users may view, print, copy, and download text and data-mine the content in such documents, for the purposes of academic research, subject always to the full Conditions of use: http://www.nature.com/authors/editorial_policies/license.html#terms" (PMC4888949 Europe PMC fullTextXML, &lt;permissions>/&lt;license>; `epmc_ft_schmidt2016.xml`)
  - ""license" : "EBI terms of use"" (PRIDE REST v3 project record PXD000498, field `license`; `pride_PXD000498.json`)
  - "Where EMBL-EBI presents scientific data generated by others, EMBL-EBI imposes no additional restriction on the use of the contributed data than those provided by the data owner, unless otherwise specified in these Terms of Use." (EMBL-EBI Terms of Use, general section; `ebi_terms.html`)
- **Strain, condition and identity evidence, verbatim:**
  - "The Escherichia coli K-12 strain BW25113 (genotype: F-, Δ(araD-araB)567 , ΔlacZ4787 (∷rrnB-3), λ - , rph-1 , Δ(rhaD-rhaB)568 , hsdR514 ) 19 was used to generate the proteome map for all 22 conditions." (PMC4888949 author manuscript, Online methods, Strains and plasmids; `epmc_ft_schmidt2016.xml`)
  - "Additionally, the proteome for the glucose and LB condition was also determined for the strains MG1655 (genotype: F-, λ - , rph-1 ) 20 and NCM3722 (genotype: F+)" (PMC4888949 author manuscript, Online methods; `epmc_ft_schmidt2016.xml`)
  - "we determined absolute copy numbers for >2300 proteins mapped across 22 growth conditions and covering the full dynamic range from ~1 to more than 100 000 copies per cells." (PMC4888949 author manuscript, Discussion; `epmc_ft_schmidt2016.xml`)
- **Inspected:** Workbook sheets (three heading rows each): Table S4 2,039 protein records by 101 columns; Table S6 2,359 records by 79 columns with headers "Protein copies/cell", "Protein Mass (fg) / Cell", "Coefficient of Variance", 22 condition columns from Glucose to Fructose. Table S9 "Global relative and absolute quantification of all proteins identified in the different E. coli strains": 2,038 records; columns include Copies/Cell_MG1655.LB, Copies/Cell_MG1655.Glucose, the matching NCM3722 and BW25113 columns, cv columns and ratios to BW25113 in glucose. File checksums: section 6.2.
- **Without an account:** Yes (Europe PMC supplementaryFiles serves the author-manuscript supplement)
- **Limitations:** The 22-condition series is BW25113. The MG1655 measurements are two conditions (LB, glucose) in a different sheet keyed by UniProt accession. The PMC deposit is an author manuscript under publisher terms, and the PRIDE deposit predates PRIDE's CC0 default.
- **Licence standing (a characterisation, not a decision):** No grant: the author-manuscript terms quoted here allow viewing, copying, downloading and text and data-mining for academic research, not redistribution; the PRIDE licence field reads "EBI terms of use", which the ledger treats as a disclaimer of EBI's own claims, not a grant. Link-only by the ledger rule.
- **Recommendation:** link-only; owner decision needed; recommend admit with caveat. The reference absolute-abundance dataset. Its MG1655 part is two conditions in biological triplicate (Table S9, copies per cell, UniProt-keyed). It reaches the site only under the owner's 2026-10-05 redistribution decision recorded against a "no grant" row, or with the publisher's permission.

#### L6-02: Absolute protein synthesis rates by ribosome profiling (Li et al. 2014)

- **Identifiers:** PMID 24766808; PMCID PMC4006352; DOI 10.1016/j.cell.2014.02.033; GEO GSE53767; supplement `NIHMS570024-supplement-02.xlsx` (named in the XML, not retrieved)
- **Measures:** Ribosome-footprint density converted to protein synthesis rates per gene. **Units:** protein synthesis rate per gene in the article (unit not extracted); WIG read density in GEO.
- **Strain:** MG1655 (GEO `strain` field, 4 of 4 samples). **Match to MG1655:** exact.
- **Conditions:** Fully supplemented MOPS glucose medium and minimal MOPS glucose medium. **Replicates:** Pooled footprint tracks; replicate structure not extracted.
- **Identifier namespace:** not inspected (supplement not retrieved). **Route to b-number:** Not established.
- **Terms, verbatim:**
  - "This file is available for text mining. It may also be used consistent with the principles of fair use under the copyright law." (PMC4006352 NCBI efetch db=pmc, &lt;permissions>/&lt;license>; `ncbi_pmc_li2014.xml`)
  - "Therefore, NCBI itself places no restrictions on the use or distribution of the data contained therein. Nor do we accept data when the submitter has requested restrictions on reuse or redistribution." (NCBI Policies and Disclaimers page, section "Molecular Data Usage"; `ncbi_policies.html`)
- **Strain, condition and identity evidence, verbatim:**
  - "!Sample_characteristics_ch1 = strain: MG1655" (GEO GSE53767 sample records; `geo_GSE53767_gsm.txt`)
  - "!Sample_characteristics_ch1 = media: minimal MOPS glucose media" (GEO GSE53767 sample records; `geo_GSE53767_gsm.txt`)
  - "For growth in a rich defined medium ( Neidhardt et al., 1974 ), we evaluated 3,041 genes" (PMC4006352 author manuscript, Results; `ncbi_pmc_li2014.xml`)
- **Inspected:** Europe PMC supplementaryFiles answered "Article with id PMC4006352 is not open access one". The PMC file path was not tried because pmc.ncbi.nlm.nih.gov was serving a reCAPTCHA page to this client at the time.
- **Without an account:** Per-gene table not retrieved
- **Limitations:** All rights reserved; per-gene table not retrieved.
- **Licence standing (a characterisation, not a decision):** No grant: "All rights reserved" with a text-mining notice. Link-only by the ledger rule.
- **Recommendation:** link-only; recommend reject. Exact strain and the standard translation-rate reference, but no grant and no table in hand.

#### L6-03a: Absolute proteome across growth conditions, NCM3722 condition series (Mori et al. 2021)

- **Identifiers:** PMID 34032011; PMCID PMC8144880; DOI 10.15252/msb.20209536. Author Correction: PMID 39354190, PMCID PMC11535196, DOI 10.1038/s44320-024-00062-5 (Mol Syst Biol 20:1257, 2024: datasets EV6, EV7, EV8, EV9 and EV11 withdrawn and replaced). Corrected per-gene files: `44320_2024_62_MOESM3_ESM.xlsx` (EV8, samples of Dataset EV2; SHA-256 ddbd7acb9997097cfa8794886886954da1ef89ce7642e25134de323b5100e1d3), `44320_2024_62_MOESM4_ESM.xlsx` (EV9, samples of Dataset EV3; 78a8c11e329807e550c7f9fc7c6279da66fdcb090160e92e5ec8078bb7353071), `44320_2024_62_MOESM5_ESM.xlsx` (EV11, protein sectors). Sample tables (original, not among the corrected): Dataset EV2 `MSB-17-e9536-s014.xlsx`, Dataset EV3 `MSB-17-e9536-s011.xlsx`. PRIDE PXD014948 (raw files and three archives; see the licence standing); spectral library PeptideAtlas PASS01421; ribosome profiling GEO GSE139983
- **Measures:** Absolute protein mass fractions by DIA/SWATH mass spectrometry (xTop protein intensities scaled per protein to ribosome-profiling synthesis rates); the article reports 2,335 proteins detected from 66 samples. **Units:** protein mass fraction (each sample column sums to 1).
- **Strain:** NCM3722 and NCM3722-derived strains (NQ1243, NQ1390, NQ393, EQ59, NQ1431, NQ1527) for the growth-limitation and condition series; not MG1655. Dataset EV8 also holds two single samples of MG1655 CGSC#6300 and one of Nissle 1917. **Match to MG1655:** none for the condition series (K-12 NCM3722: a cross-strain transfer here).
- **Conditions:** EV9: 29 NCM3722-background samples in three growth-limitation series in glucose minimal medium (titrated glucose uptake, titrated ammonia assimilation, chloramphenicol), growth rates 0.22 to 0.98 per hour. EV8: 30 samples (Lib-01 to Lib-30) over carbon sources, stresses and non-planktonic states. **Replicates:** Marked per sample in Dataset EV3 (for example C8 "biological replicate of C4"; H1 and H5 replicates of A2); not tabulated here.
- **Identifier namespace:** b-number in the `Gene locus` column, with gene name and UniProt accession; 4,342 data records per sheet. **Route to b-number:** Direct for the identifier (b-number column). The strain is the obstacle, not the key.
- **Terms, verbatim:**
  - "This is an open access article under the terms of the http://creativecommons.org/licenses/by/4.0/ License, which permits use, distribution and reproduction in any medium, provided the original work is properly cited." (PMC8144880 Europe PMC fullTextXML, &lt;permissions>/&lt;license>; `epmc_ft_mori2021.xml`)
  - "https://creativecommons.org/licenses/by/4.0/ Open Access This article is licensed under a Creative Commons Attribution 4.0 International License, which permits use, sharing, adaptation, distribution and reproduction in any medium or format, as long as you give appropriate credit to the original author(s) and the source, provide a link to the Creative Commons licence, and indicate if changes were made." (PMC11535196 Europe PMC fullTextXML, &lt;permissions>/&lt;license>; `epmc_ft_mori_correction.xml`)
  - ""license" : "Creative Commons Public Domain (CC0)"" (PRIDE REST v3 project record PXD014948, field `license`; `pride_PXD014948.json`)
- **Strain, condition and identity evidence, verbatim:**
  - "The resulting versatile workflow was used to quantify the absolute abundance of 2,335 proteins for various E . coli strains grown across 66 conditions, including stress conditions and non‐planktonic states never characterized previously." (PMC8144880 full text, Abstract; `epmc_ft_mori2021.xml`)
  - "Table with informations on the 7 "calibration" samples for E. coli MG1655 (EQ353), plus the three growth limitation series (C-, A- and R-limitation), obtained with either E. coli NCM3722 or NCM3722-derived strains." (Dataset EV3 (MSB-17-e9536-s011.xlsx), sheet Description, cell A4; `mori2021_EV3_samples2.xlsx`)
  - "raw mass spectrometry files (DDA and DIA/SWATH), ProteomeXchange Consortium via the PRIDE partner repository: http://www.ebi.ac.uk/pride/archive/projects/PXD014948" (PMC8144880 full text, Data Availability Statement; `epmc_ft_mori2021.xml`)
  - "!Series_overall_design = Three ribosome profiling datasets in E. coli (various strains: NCM3722, NQ1390, MG1655)." (GEO GSE139983 series record; `geo_GSE139983_self.txt`)
  - "Datasets EV6, EV7, EV8, EV9 and EV11 are corrected." (PMC11535196 (Author Correction) full text; `epmc_ft_mori_correction.xml`)
  - "We found that these were mistakenly inflated by about 20% due to a bioinformatic error. We corrected the molecular weights and recalculated the protein mass fractions in datasets EV6, EV7, EV8 and EV9, as well as the slopes in dataset EV11. The maximum change in the protein mass fractions compared to the ones reported in the retracted datasets is less than 1%, and the classification of proteins into protein sectors is not affected." (PMC11535196 full text, author statement on the datasets; `epmc_ft_mori_correction.xml`)
- **Inspected:** Corrected EV8, sheet "EV8-AbsoluteMassFractions-1": one header row and 4,342 data records, 4,324 with a distinct b-number (18 locus cells empty); 30 sample columns Lib-01 to Lib-30. Corrected EV9, sheet "EV9-AbsoluteMassFractions-2": one header row and 4,342 data records, 4,312 with a distinct b-number (30 empty); 36 sample columns, 29 of them NCM3722-background and 7 the EQ353 runs of row L6-03b. A data record is a table row, not a detected protein: 2,235 records are non-zero in at least one EV9 column. Each corrected file's MD5 equals the value PMC records for it in the correction XML. Dataset EV2 (53 sample rows) gives strain NCM3722 for 23, NQ1243 6, EQ59 5, MG1655 (CGSC#6300) 2 (Lib-12 and Lib-23), and NQ393, NQ1431, Nissle1917 and NQ1527 one each; 13 rows have no strain value. GEO GSE139983 holds three ribosome-profiling samples (NCM3722, NQ1390, K-12 MG1655), not proteomics; the first pass misread its one MG1655 sample as the study's only MG1655 measurement. File checksums: section 6.2.
- **Without an account:** Yes: the corrected files are served by the publisher's static host; the original bundle by Europe PMC (the download stopped at the 280 s limit, and the sample tables were read from complete, CRC-verified members of the partial archive)
- **Limitations:** Measured in NCM3722 and derivatives, which the article itself contrasts with MG1655 (growth rate, motility, glyoxylate shunt, porins). "Absolute" rests on a per-protein scaling to ribosome-profiling data from MG1655 EQ353 (row L6-03b), applied to every sample. Use the corrected files only.
- **Licence standing (a characterisation, not a decision):** Inferred from the article licence (CC BY 4.0 on the article and on its Author Correction); no file-level grant shown. The per-gene tables this row rests on are publisher supplementary files. Corrected under DEM-244: the earlier wording here, that they are "not PRIDE files" and that the project's CC0 is "evidence about the raw files", went beyond what was read. It was drawn from the article's data statement, which names only "raw mass spectrometry files (DDA and DIA/SWATH)" for PRIDE PXD014948; the project's file listing shows more. It lists 241 files: 238 RAW and 3 archives (`Ecoli_DDA_search_results.zip` (SEARCH, 254,396,208 B); `Ecoli_PQP_library_formats.zip` (OTHER, 139,053,117 B); `Ecoli_SWATH_quant_results.zip` (SEARCH, 10,623,870 B)). `Ecoli_SWATH_quant_results.zip` (SHA-256 50e30371eb54a2bf0eee0b3e4e2aca38700af15facbbcf0aea3cc6d180457a73, submitted 2019-12-09) was opened and holds `Supp Table S1 - Samples and conditions.xlsx` (19,686 B); `Supp Table S3 - Peptide-level Intensities.xlsx` (10,349,671 B); `Supp Table S5 - Absolute protein mass fractions.xlsx` (1,487,601 B). The last is a per-gene table keyed by gene name and b-number (SHA-256 c3c03c2315383452411e1debdd42879b802528b3a3b5d7fa5269c532be75f8ac): 4,342 records and 4,312 distinct b-numbers on each of two sheets, with the 30 sample columns of Dataset EV8 and the 36 of Dataset EV9. It is not the data of this row and, by its submission date, predates both publisher versions: over the seven EQ353 runs, of 12,898 cells that are nonzero both there and in Dataset EV9, 2 agree with the original EV9 and 0 with the corrected EV9 (relative tolerance 1e-6), and run A1-1 has 1,833 nonzero entries against 1,901 in the corrected EV9. The project's `license` field reads CC0. That is evidence about the files deposited in PRIDE, the earlier workbook among them, and not about the corrected workbooks, which are supplementary files of the 2024 Author Correction; the Author Correction is CC BY 4.0 at article level (its licence block adds the publisher's clause on "images or other third party material in this article"). Whether the deposited workbook is usable is not assessed, and the two larger archives were not opened. No per-file legend and no publisher statement extending the article licence to this supplementary file was found in the retrieved XML, so a grant over the file is inferred from the article licence, not shown. The source ledger has no rule for a publisher-hosted supplementary file without its own legend: its article-licence rule is written for a GEO deposit ("the article's licence is taken as the grant over the article's deposited data"), and its two file-level precedents (Adomako 2022 Data Set S1; PXD005851 Table S1) each rest on a legend. Applying the article licence here would extend the GEO-deposit rule by analogy, which is an owner ledger decision; the owner's 2026-10-05 redistribution decision is a separate basis and is not evidence of a file-level grant.
- **Recommendation:** supporting (cross-strain); recommend admit with caveat. A large, b-number-keyed proteome under an open article licence, but in NCM3722: usable on MG1655 genes only under an owner ruling on cross-strain transfer. Its MG1655 subset is row L6-03b.

#### L6-03b: Absolute proteome, MG1655 EQ353 calibration samples (Mori et al. 2021)

- **Identifiers:** PMID 34032011; PMCID PMC8144880; DOI 10.15252/msb.20209536. Author Correction: PMID 39354190, PMCID PMC11535196, DOI 10.1038/s44320-024-00062-5 (Mol Syst Biol 20:1257, 2024: datasets EV6, EV7, EV8, EV9 and EV11 withdrawn and replaced). Corrected files: Dataset EV6 `44320_2024_62_MOESM1_ESM.xlsx` (1,229,542 B, SHA-256 9663fde01f2d292333417951593bfdae167abc6b6ec4341e621d4d0a256ec465, sheet `EV6-CalibrationSamplesProteins`); Dataset EV9 `44320_2024_62_MOESM4_ESM.xlsx` (1,332,556 B, SHA-256 78a8c11e329807e550c7f9fc7c6279da66fdcb090160e92e5ec8078bb7353071, sheet `EV9-AbsoluteMassFractions-2`, columns D to J); Dataset EV7 `44320_2024_62_MOESM2_ESM.xlsx` (AQUA peptides, SHA-256 9504646b7d5f7edf48ec7718ec3e74eb5982df01e15fed3e7366cdaf7f73541c). Originals read for strain and sample facts: Dataset EV1 `MSB-17-e9536-s001.xlsx`, Dataset EV3 `MSB-17-e9536-s011.xlsx`, Appendix `MSB-17-e9536-s013.docx`. PRIDE PXD014948 (raw files and three archives; see the licence standing)
- **Measures:** Protein mass fractions of E. coli MG1655 sub-strain EQ353 by DIA/SWATH mass spectrometry: three biological cultures, seven MS runs. EV6 gives the values from four protein-inference methods (xTop, TopPep1, TopPep3, iBAQ) beside ribosome-profiling mass fractions from Li et al. 2014; EV9 gives the xTop values after per-protein scaling to those ribosome-profiling values. **Units:** protein mass fraction, unitless: each sample column sums to 1.000000 in EV6 (xTop) and in EV9. EV6 also gives molecular weight in kDa; EV7 gives fmol per µg protein extract for 29 proteins.
- **Strain:** MG1655 sub-strain EQ353. As the paper states it: a wild-type strain, "same strain used in Li et al. (2014)", obtained from the Carol Gross laboratory (Dataset EV1), with "a wild-type flhDC promoter" (Results). No genotype string is given for EQ353 in the article, Dataset EV1 or the Appendix passages read (not reported). A different MG1655 isolate, CGSC#6300, appears in two single samples of Dataset EV8 (Lib-12: LB at 25 °C into stationary phase; Lib-23: low-osmolarity medium with maltose and pyruvate) and is not part of this subset. **Match to MG1655:** exact at strain level (MG1655); sub-strain EQ353.
- **Conditions:** MOPS minimal medium (Neidhardt) with 0.2% glucose and 9.5 mM NH4Cl, exponential growth; growth rates 0.69 (A1), 0.73 (C1) and 0.71 (F1) per hour (Dataset EV3). **Replicates:** Biological: three cultures (A1, C1, F1). Technical: A1 and F1 were each injected three times (A1-1 to A1-3, F1-1 to F1-3) and C1 once. Seven columns, three independent cultures.
- **Identifier namespace:** b-number in the `Gene locus` column, with gene name and UniProt accession (`Protein ID`). EV6: 4,342 data records, 4,324 with a distinct b-number (18 locus cells empty). EV9: 4,342 data records, 4,312 with a distinct b-number (30 empty). **Route to b-number:** Direct: the `Gene locus` column is the b-number. Records with an empty locus cell carry a UniProt accession only and would go through the UniProtKB ordered locus name (row L7-02). No join was performed.
- **Terms, verbatim:**
  - "This is an open access article under the terms of the http://creativecommons.org/licenses/by/4.0/ License, which permits use, distribution and reproduction in any medium, provided the original work is properly cited." (PMC8144880 Europe PMC fullTextXML, &lt;permissions>/&lt;license>; `epmc_ft_mori2021.xml`)
  - "https://creativecommons.org/licenses/by/4.0/ Open Access This article is licensed under a Creative Commons Attribution 4.0 International License, which permits use, sharing, adaptation, distribution and reproduction in any medium or format, as long as you give appropriate credit to the original author(s) and the source, provide a link to the Creative Commons licence, and indicate if changes were made." (PMC11535196 Europe PMC fullTextXML, &lt;permissions>/&lt;license>; `epmc_ft_mori_correction.xml`)
  - ""license" : "Creative Commons Public Domain (CC0)"" (PRIDE REST v3 project record PXD014948, field `license`; `pride_PXD014948.json`)
- **Strain, condition and identity evidence, verbatim:**
  - "we grew three replicate cultures of E . coli K‐12 MG1655 (sub‐strain EQ353) cells in minimal medium (MOPS + glucose) in exponential growth (Fig 2B ). These “calibration samples” (A1, C1, F1) were measured by DIA/SWATH mass spectrometry using a 64 variable SWATH window acquisition method (Collins et al, 2017 ). For two out of the three calibration samples (A1 and F1), we additionally performed three technical MS injection replicate measurements." (PMC8144880 full text, Results, Assessment of xTop performance; `epmc_ft_mori2021.xml`)
  - "We collected 3 biological samples of E . coli K‐12 MG1655 (EQ353) in glucose minimal media, matching strain, and condition from Li et al ( 2014 ). Two of the three biological replicates were injected 3 times, for a total of 7 proteomics “calibration” datasets." (PMC8144880 full text, Fig 2B legend; `epmc_ft_mori2021.xml`)
  - "For the calibration samples A1, C1 and F1, we used strain EQ353, which is the specific MG1655 strain used in Li et al. (Li et al, 2014) 2014." (Appendix (MSB-17-e9536-s013.docx), Extended experimental methods, Strains; `mori2021_appendix.docx`)
  - "Wild type E. coli strain - same strain used in Li et al. (2014)" (Dataset EV1 (MSB-17-e9536-s001.xlsx), sheet EV1-Strains, row "MG1655 (EQ353)", column Description; `mori2021_EV1_strains.xlsx`)
  - "Originarily obtained from Carol Gross Lab" (Dataset EV1, sheet EV1-Strains, row "MG1655 (EQ353)", column Source; `mori2021_EV1_strains.xlsx`)
  - "This particular sub‐strain of MG1655 has a wild‐type flhDC promoter" (PMC8144880 full text, Results, MG1655 vs NCM3722; `epmc_ft_mori2021.xml`)
  - "EQ353 cells grow at a substantially slower rate compared to NCM3722 (0.69/h vs 0.98/h)" (PMC8144880 full text, Results, MG1655 vs NCM3722; `epmc_ft_mori2021.xml`)
  - "we observed a strong reduction in the expression of motility genes, which are mostly undetected in EQ353" (PMC8144880 full text, Results, MG1655 vs NCM3722; `epmc_ft_mori2021.xml`)
  - "Same strain and growth condition as Li et al. 2014 (technical replicate #1)" (Dataset EV3 (MSB-17-e9536-s011.xlsx), sheet EV3-Samples-2, row A1-1, column Description; `mori2021_EV3_samples2.xlsx`)
  - "Biological replicate of A1 and C1 (technical replicate #1)" (Dataset EV3, sheet EV3-Samples-2, row F1-1, column Description; `mori2021_EV3_samples2.xlsx`)
  - "Protein mass fractions computed with xTop, TopPep1, TopPep3 and iBAQ for the seven "calibration" samples obtained with E. coli MG1655 (EQ353) growing in MOPS glucose minimal medium. We also show the corresponding protein synthesis mass fractions computed from ribosome profiling data (GW Li et al., 2014) and the protein mass used to perform the conversion." (corrected Dataset EV6 (44320_2024_62_MOESM1_ESM.xlsx), sheet Description, cell A4; `mori_corr_MOESM1_ESM.xlsx`)
  - "Since protein degradation is negligible for the vast majority of proteins in exponentially growing E . coli cells (Koch & Levy, 1955 ; Mandelstam, 1958 ; Pine, 1970 ; Goldberg & St John, 1976 ; Erickson et al, 2017 ), synthesis rates are proportional to absolute protein copy numbers." (PMC8144880 full text, Results; `epmc_ft_mori2021.xml`)
  - "we multiplied the corresponding intensities by the known molecular weight of each protein and normalized the corresponding intensities to 1." (PMC8144880 full text, Materials and Methods; `epmc_ft_mori2021.xml`)
  - "The final scaling of xTop protein intensities with the ribosome profiling data was performed as described in Appendix Note S1 ; a scaling factor 1 was assigned to proteins for which no proteomics data were available in the calibration samples." (PMC8144880 full text, Materials and Methods; `epmc_ft_mori2021.xml`)
  - "In the case of ribosome profiling calibration described in the Main Text, the scaling factors ck are the ratio of ribosome profiling-derived and mass spectrometry (xTop) derived protein mass fractions in the calibration samples" (Appendix, Note S3; `mori2021_appendix.docx`)
  - "raw mass spectrometry files (DDA and DIA/SWATH), ProteomeXchange Consortium via the PRIDE partner repository: http://www.ebi.ac.uk/pride/archive/projects/PXD014948" (PMC8144880 full text, Data Availability Statement; `epmc_ft_mori2021.xml`)
  - "Datasets EV6, EV7, EV8, EV9 and EV11 are corrected." (PMC11535196 (Author Correction) full text; `epmc_ft_mori_correction.xml`)
  - "We found that these were mistakenly inflated by about 20% due to a bioinformatic error. We corrected the molecular weights and recalculated the protein mass fractions in datasets EV6, EV7, EV8 and EV9, as well as the slopes in dataset EV11. The maximum change in the protein mass fractions compared to the ones reported in the retracted datasets is less than 1%, and the classification of proteins into protein sectors is not affected." (PMC11535196 full text, author statement on the datasets; `epmc_ft_mori_correction.xml`)
- **Inspected:** Corrected EV6, sheet "EV6-CalibrationSamplesProteins": two header rows, then 4,342 data records. Columns: Gene name, Gene locus, Protein ID, Molecular weight (kDa), Ribosome profiling mass fractions (Li et al., 2014), then seven columns (A1-1, A1-2, A1-3, C1, F1-1, F1-2, F1-3) under each of xTop, TopPep1, TopPep3 and iBAQ. Non-zero xTop values per column: 1,901, 1,883, 1,915, 1,934, 1,900, 1,935, 1,918; 1,723 records are non-zero in all seven columns and 2,077 in at least one; 3,871 records have a non-zero ribosome-profiling value. Corrected EV9, columns D to J: the same seven labels and the same non-zero counts. The tables list every gene and write 0 where nothing was quantified, so 4,324 and 4,312 are table coverage, not detected proteins, and a zero means "not quantified", not "absent". MD5 of each corrected file equals the value PMC records in the correction XML (EV6 b8b79db4a299c3ccdb5f6dc76c5b0897, EV9 acfdd32a7c72a278e2ae2c04a78b9c7a, EV7 b80713cf0110995722b0cd9361f9cee2). Dataset EV3 has 36 sample rows: 7 EQ353 and 29 NCM3722-background. File checksums: section 6.2.
- **Without an account:** Yes (publisher static host for the corrected files; Europe PMC for the original bundle, read from complete CRC-verified members of a partial download)
- **Limitations:** What the values assume, in the paper's terms. (1) Mass fractions are MS intensities multiplied by molecular weight and normalised to 1: fractions of the quantified proteome, not copies per cell. (2) The EV9 values are scaled per protein by the ratio of ribosome-profiling to xTop mass fractions measured in these same calibration samples (factor 1 where no proteomics data existed). For this subset the scaled values are therefore anchored to the Li et al. 2014 ribosome-profiling data and are not independent of it, and that anchoring rests on the stated assumption that protein degradation is negligible in exponential growth. EV6 holds the unscaled values. (3) One condition. (4) Three independent cultures, not seven. (5) EQ353 is a named sub-strain; the article reports motility proteins "mostly undetected" in it. Whether an EQ353 value may stand for MG1655 as defined by the genome of record is a lab judgement and is left to the owner. (6) The original EV6 to EV9 are withdrawn; pin the corrected files.
- **Licence standing (a characterisation, not a decision):** Inferred from the article licence (CC BY 4.0 on the article and on its Author Correction); no file-level grant shown. The per-gene tables this row rests on are publisher supplementary files. Corrected under DEM-244: the earlier wording here, that they are "not PRIDE files" and that the project's CC0 is "evidence about the raw files", went beyond what was read. It was drawn from the article's data statement, which names only "raw mass spectrometry files (DDA and DIA/SWATH)" for PRIDE PXD014948; the project's file listing shows more. It lists 241 files: 238 RAW and 3 archives (`Ecoli_DDA_search_results.zip` (SEARCH, 254,396,208 B); `Ecoli_PQP_library_formats.zip` (OTHER, 139,053,117 B); `Ecoli_SWATH_quant_results.zip` (SEARCH, 10,623,870 B)). `Ecoli_SWATH_quant_results.zip` (SHA-256 50e30371eb54a2bf0eee0b3e4e2aca38700af15facbbcf0aea3cc6d180457a73, submitted 2019-12-09) was opened and holds `Supp Table S1 - Samples and conditions.xlsx` (19,686 B); `Supp Table S3 - Peptide-level Intensities.xlsx` (10,349,671 B); `Supp Table S5 - Absolute protein mass fractions.xlsx` (1,487,601 B). The last is a per-gene table keyed by gene name and b-number (SHA-256 c3c03c2315383452411e1debdd42879b802528b3a3b5d7fa5269c532be75f8ac): 4,342 records and 4,312 distinct b-numbers on each of two sheets, with the 30 sample columns of Dataset EV8 and the 36 of Dataset EV9. It is not the data of this row and, by its submission date, predates both publisher versions: over the seven EQ353 runs, of 12,898 cells that are nonzero both there and in Dataset EV9, 2 agree with the original EV9 and 0 with the corrected EV9 (relative tolerance 1e-6), and run A1-1 has 1,833 nonzero entries against 1,901 in the corrected EV9. The project's `license` field reads CC0. That is evidence about the files deposited in PRIDE, the earlier workbook among them, and not about the corrected workbooks, which are supplementary files of the 2024 Author Correction; the Author Correction is CC BY 4.0 at article level (its licence block adds the publisher's clause on "images or other third party material in this article"). Whether the deposited workbook is usable is not assessed, and the two larger archives were not opened. No per-file legend and no publisher statement extending the article licence to this supplementary file was found in the retrieved XML, so a grant over the file is inferred from the article licence, not shown. The source ledger has no rule for a publisher-hosted supplementary file without its own legend: its article-licence rule is written for a GEO deposit ("the article's licence is taken as the grant over the article's deposited data"), and its two file-level precedents (Adomako 2022 Data Set S1; PXD005851 Table S1) each rest on a legend. Applying the article licence here would extend the GEO-deposit rule by analogy, which is an owner ledger decision; the owner's 2026-10-05 redistribution decision is a separate basis and is not evidence of a file-level grant.
- **Recommendation:** bring first; recommend admit with caveat. A replicated, b-number-keyed, per-gene protein table measured in MG1655, with the corrected files in hand and checksummed. The open points are the file-level licence (CC BY at article level only), the sub-strain, and the calibration to ribosome profiling.

#### L6-04: PaxDb 5.0 integrated protein abundance

- **Identifiers:** PMID 37659604; PMCID PMC10551891; DOI 10.1016/j.mcpro.2023.100640; site https://pax-db.org
- **Measures:** Integrated protein abundance across organisms (database article; E. coli datasets not read). **Units:** not extracted.
- **Strain:** not read for the E. coli datasets. **Match to MG1655:** not established.
- **Conditions:** per source dataset. **Replicates:** not applicable.
- **Identifier namespace:** not retrieved. **Route to b-number:** Not established.
- **Terms, verbatim:**
  - "This is an open access article under the CC BY license (http://creativecommons.org/licenses/by/4.0/)." (PMC10551891 Europe PMC fullTextXML, &lt;permissions>/&lt;license>; `epmc_ft_paxdb5.xml`)
- **Inspected:** https://pax-db.org/downloads did not answer within 180 s on the first attempt; https://pax-db.org/ later returned a 7,486-byte script shell whose text is only the page title. Site terms and download files: not retrieved.
- **Without an account:** Not retrieved
- **Limitations:** A re-scaled aggregate of the primary studies above; site not read.
- **Licence standing (a characterisation, not a decision):** Article CC BY 4.0; the licence over the database files is undetermined (not retrieved).
- **Recommendation:** not recommended before the primaries; insufficient evidence. Secondary to L6-01 and L6-03.

#### L6-05: Revised bacterial ribosome profiling (Mohammad, Green and Buskirk 2019)

- **Identifiers:** PMID 30724162; PMCID PMC6377232; DOI 10.7554/eLife.42591; GEO GSE119104 (10 samples; GSE119104_RAW.tar)
- **Measures:** Ribosome-footprint density under several harvesting and lysis protocols. **Units:** read density per position (processed files in a RAW tar, not opened).
- **Strain:** MG1655 (CGSC #6300); GEO organism field MG1655 for 10 of 10 samples. **Match to MG1655:** exact.
- **Conditions:** MOPS EZ Rich Defined medium with 0.2% glucose, 37 °C; protocol variants (filtration or direct freezing; chloramphenicol, mupirocin). **Replicates:** not extracted.
- **Identifier namespace:** Genomic coordinates on NC_000913.2. **Route to b-number:** Positional on NC_000913.2; a per-gene occupancy value would be a computation from tracks.
- **Terms, verbatim:**
  - "This article is distributed under the terms of the Creative Commons Attribution License , which permits unrestricted use and redistribution provided that the original author and source are credited." (PMC6377232 Europe PMC fullTextXML, &lt;permissions>/&lt;license>; `epmc_ft_mohammad2019.xml`)
  - "Therefore, NCBI itself places no restrictions on the use or distribution of the data contained therein. Nor do we accept data when the submitter has requested restrictions on reuse or redistribution." (NCBI Policies and Disclaimers page, section "Molecular Data Usage"; `ncbi_policies.html`)
- **Strain, condition and identity evidence, verbatim:**
  - "E. coli MG1655 cells were grown overnight at 37°C in MOPS EZ Rich Defined media (Teknova)" (PMC6377232 full text, Materials and methods; `epmc_ft_mohammad2019.xml`)
  - "to map reads uniquely to genome build NC_000913.2" (PMC6377232 full text, Materials and methods; `epmc_ft_mohammad2019.xml`)
- **Inspected:** GEO records read; the bundle held no per-gene table.
- **Without an account:** Yes (GEO FTP)
- **Limitations:** A methods comparison: samples differ by protocol, not biology. No per-gene table.
- **Licence standing (a characterisation, not a decision):** Affirmative grant by the ledger's GEO rule: article CC BY, taken as the grant over its deposited data.
- **Recommendation:** bring second; recommend admit with caveat. The CC BY ribosome-occupancy source in the exact strain, if the owner wants a translation layer that needs a tracks-to-gene computation.

#### L6-06: Initiation-site profiling with Onc112 and small proteins (Weaver et al. 2019)

- **Identifiers:** PMID 30837344; PMCID PMC6401488; DOI 10.1128/mBio.02819-18; GEO GSE123675 (2 samples); tables `mBio.02819-18-st001.xlsx` (known small ORFs, SHA-256 prefix eb4c64c87ed4ff45) and `-st003.xlsx`
- **Measures:** Ribosome profiling with stalled initiation complexes to map translation initiation sites; small open reading frames. **Units:** initiation-site peaks; tables of small ORFs with coordinates on NC_000913.3.
- **Strain:** MG1655 (GEO organism field, 2 of 2 samples). **Match to MG1655:** exact.
- **Conditions:** MOPS EZ Rich Defined medium with 0.2% glucose, 37 °C, OD600 0.3; untreated and 50 uM Onc112 for 10 min. **Replicates:** One sample per treatment in GEO.
- **Identifier namespace:** Coordinates on NC_000913.3; EcoCyc gene ids and symbols in the small-ORF table. **Route to b-number:** EcoCyc gene id to b-number through the `Dbxref=ECOCYC:` attribute of the pinned RefSeq GFF; positions are already on the genome of record.
- **Terms, verbatim:**
  - "This is a work of the U.S. Government and is not subject to copyright protection in the United States. Foreign copyrights may apply." (PMC6401488 Europe PMC fullTextXML, &lt;permissions>/&lt;license>; `epmc_ft_weaver2019.xml`)
  - "Therefore, NCBI itself places no restrictions on the use or distribution of the data contained therein. Nor do we accept data when the submitter has requested restrictions on reuse or redistribution." (NCBI Policies and Disclaimers page, section "Molecular Data Usage"; `ncbi_policies.html`)
- **Strain, condition and identity evidence, verbatim:**
  - "A culture of E. coli MG1655 was grown overnight at 37˚C in MOPS EZ Rich Defined media (Teknova) with 0.2% glucose, diluted 1:100 into 150 ml of fresh medium, and grown to an optical density at 600 nm (OD 600 ) of 0.3." (PMC6401488 full text, Materials and Methods; `epmc_ft_weaver2019.xml`)
  - "in E . coli MG1655 genome NC_000913.3 )" (PMC6401488 full text, table legend; `epmc_ft_weaver2019.xml`)
- **Inspected:** st001.xlsx sheet "known small ORFs": one header row and 80 records. st003.xlsx sheets "selected" 68 and "rejected" 103 records, one header row each. File checksums: section 6.2.
- **Without an account:** Yes (Europe PMC supplementaryFiles; GEO FTP)
- **Limitations:** Single unreplicated library per treatment; initiation peaks are not abundance.
- **Licence standing (a characterisation, not a decision):** US-Government work per the article; applying that to the supplementary tables is an inference. The article states it is a work of the U.S. Government and not subject to copyright protection in the United States (foreign copyrights may apply), quoted. No per-file legend was found on the supplementary tables in the retrieved XML, so applying that statement to them is an inference; the ledger has no rule for US-Government works (section 4.5).
- **Recommendation:** supporting (layer 6); bring second (layer 9, small proteins); recommend admit with caveat. Exact strain, current coordinates, public-domain status in the US; the measured basis for small-protein gene models.

#### L6-07: Retapamulin-assisted initiation-site profiling (Meydan et al. 2019)

- **Identifiers:** PMID 30904393; PMCID PMC7115971; DOI 10.1016/j.molcel.2019.02.017; GEO GSE122129 (4 samples)
- **Measures:** Translation initiation sites by ribosome profiling after retapamulin treatment. **Units:** initiation-site peaks.
- **Strain:** BW25113 and BL21 per the article; GEO `strain` field: BWK 2, BL21 2; not MG1655. **Match to MG1655:** partial for BW25113; none for BL21.
- **Conditions:** untreated and retapamulin. **Replicates:** one per treatment and strain.
- **Identifier namespace:** not inspected. **Route to b-number:** Not established.
- **Terms, verbatim:**
  - "This file is available to download for the purposes of text mining, consistent with the principles of UK copyright law." (PMC7115971 NCBI efetch db=pmc, &lt;permissions>/&lt;license>; `ncbi_pmc_meydan2019.xml`)
  - "Therefore, NCBI itself places no restrictions on the use or distribution of the data contained therein. Nor do we accept data when the submitter has requested restrictions on reuse or redistribution." (NCBI Policies and Disclaimers page, section "Molecular Data Usage"; `ncbi_policies.html`)
- **Strain, condition and identity evidence, verbatim:**
  - "!Sample_characteristics_ch1 = strain: BWK" (GEO GSE122129 sample records; `geo_GSE122129_gsm.txt`)
  - "We have detected 6 upstream in-frame TISs (uTISs) in the E. coli strain BW25113 and 36 uTISs in the BL21 strain" (PMC7115971 author manuscript, Results; `ncbi_pmc_meydan2019.xml`)
- **Inspected:** GEO records only.
- **Without an account:** Yes (GEO FTP)
- **Limitations:** Not MG1655; text-mining notice only.
- **Licence standing (a characterisation, not a decision):** No grant: link-only by the ledger rule.
- **Recommendation:** link-only; recommend reject. Wrong strain and no grant; L6-06 covers the assay in MG1655.

#### L6-08: Proteome during growth and ethanol stress (Soufi et al. 2015)

- **Identifiers:** PMID 25741329; PMCID PMC4332353; DOI 10.3389/fmicb.2015.00103; PRIDE PXD001648
- **Measures:** Protein abundance and modifications by mass spectrometry across growth phases and ethanol stress. **Units:** not inspected.
- **Strain:** BW25113; not MG1655. **Match to MG1655:** partial (cross-substrain).
- **Conditions:** growth-phase series and ethanol stress (not extracted). **Replicates:** not extracted.
- **Identifier namespace:** not inspected. **Route to b-number:** Not established.
- **Terms, verbatim:**
  - "https://creativecommons.org/licenses/by/4.0/ This is an open-access article distributed under the terms of the Creative Commons Attribution License (CC BY). The use, distribution or reproduction in other forums is permitted, provided the original author(s) or licensor are credited and that the original publication in this journal is cited, in accordance with accepted academic practice." (PMC4332353 Europe PMC fullTextXML, &lt;permissions>/&lt;license>; `epmc_ft_soufi2015.xml`)
  - ""license" : "EBI terms of use"" (PRIDE REST v3 project record PXD001648, field `license`; `pride_PXD001648.json`)
- **Strain, condition and identity evidence, verbatim:**
  - "The E. coli BW25113 strain was employed in all experiments conducted in this study." (PMC4332353 full text, Materials and methods; `epmc_ft_soufi2015.xml`)
- **Inspected:** Supplement bundle retrieved (14,286,388 B) and not opened.
- **Without an account:** Yes
- **Limitations:** BW25113; tables not inspected.
- **Licence standing (a characterisation, not a decision):** Split: article CC BY 4.0 (a grant over its unopened tables would be inferred); PRIDE files carry no grant. The article licence is quoted; its supplementary tables were not opened and carry no per-file legend in the retrieved XML, so a grant over them would be inferred from the article licence under the same reasoning as row L2-03. The PRIDE files read "EBI terms of use", which the ledger treats as no grant.
- **Recommendation:** supporting; insufficient evidence. A CC BY proteome in BW25113; second to Mori 2021 on coverage and to Schmidt 2016 on conditions.

#### L6-09: Single-cell protein and mRNA counts from a YFP fusion library (Taniguchi et al. 2010)

- **Identifiers:** PMID 20671182; PMCID PMC2922915; DOI 10.1126/science.1188308
- **Measures:** Protein and mRNA quantification in single cells from a chromosomal YFP fusion library. **Units:** not extracted.
- **Strain:** not established from the passages read. **Match to MG1655:** not established.
- **Conditions:** not extracted. **Replicates:** not extracted.
- **Identifier namespace:** not inspected. **Route to b-number:** Not established.
- **Terms, verbatim:**
  - "This file is available for text mining. It may also be used consistent with the principles of fair use under the copyright law." (PMC2922915 NCBI efetch db=pmc, &lt;permissions>/&lt;license>; `ncbi_pmc_taniguchi2010.xml`)
- **Strain, condition and identity evidence, verbatim:**
  - "We created a chromosomal YFP fusion library ( Fig. 1A ), in which each strain has a particular gene tagged with the YFP coding sequence." (PMC2922915 author manuscript; `ncbi_pmc_taniguchi2010.xml`)
- **Inspected:** Author manuscript read via NCBI efetch; the parental strain was not located in the sentences examined.
- **Without an account:** Yes
- **Limitations:** Strain not established; tagged proteins.
- **Licence standing (a characterisation, not a decision):** No grant (text-mining notice only): link-only.
- **Recommendation:** link-only; recommend reject. No grant; superseded for abundance by the mass-spectrometry sets.

#### L6-10: Deep proteome quantification in MG1655 and BW25113 (Zhao et al. 2019)

- **Identifiers:** PMID 31178895; PMCID PMC6544118; DOI 10.3389/fgene.2019.00473 (Front Genet 10:473; no correction listed in the Europe PMC record on 2026-10-05); Table S3 `Supplementary table S3 Protein abundances and properties used in this work.xlsx` (611,597 B, SHA-256 3b9b1a1e8c724fcf46047a2b5ca97ee141192a17197dbeaa2b8ea1bf82d6d95a) inside `Data_Sheet_1.zip` of the supplement bundle; PRIDE PXD010126
- **Measures:** Protein abundance by data-independent acquisition mass spectrometry (HRM-MS) in two K-12 strains, with estimated protein copies per cell. **Units:** MS abundance per replicate under relaxed and under stringent criteria; protein copy number per replicate; average protein copy number per cell.
- **Strain:** E. coli K-12 MG1655 and BW25113, each on its own sheet. **Match to MG1655:** exact for the MG1655 sheet.
- **Conditions:** Glucose M9 minimal medium, 37 °C, flasks, mid-exponential phase (OD600 0.6). **Replicates:** Two biological replicates per strain (columns MG1655_1 and MG1655_2).
- **Identifier namespace:** b-number in the `Synonym` column of sheet "MG1655" (1,571 data records, 1,571 distinct b-numbers), with gene symbol, GI and coordinates. **Route to b-number:** Direct: the `Synonym` column is the b-number, and the search database was the protein set of the assembly of record, GCF_000005845.2_ASM584v2 (4,140 entries in 2019).
- **Terms, verbatim:**
  - "https://creativecommons.org/licenses/by/4.0/ This is an open-access article distributed under the terms of the Creative Commons Attribution License (CC BY). The use, distribution or reproduction in other forums is permitted, provided the original author(s) and the copyright owner(s) are credited and that the original publication in this journal is cited, in accordance with accepted academic practice." (PMC6544118 Europe PMC fullTextXML, &lt;permissions>/&lt;license>; `epmc_ft_zhao2019.xml`)
  - ""license" : "EBI terms of use"" (PRIDE REST v3 project record PXD010126, field `license`; `pride_PXD010126.json`)
  - "Where EMBL-EBI presents scientific data generated by others, EMBL-EBI imposes no additional restriction on the use of the contributed data than those provided by the data owner, unless otherwise specified in these Terms of Use." (EMBL-EBI Terms of Use, general section; `ebi_terms.html`)
- **Strain, condition and identity evidence, verbatim:**
  - "Escherichia coli K-12 sub-strains BW25113 and MG1655 were cultivated on glucose M9 minimal medium at 37°C in flasks to mid-exponential phase (OD 600 = 0.6)" (PMC6544118 full text, Materials and Methods, MS Sample Preparation; `epmc_ft_zhao2019.xml`)
  - "two biological replicates of BW25113 and MG1655 each were cultured in M9 minimal medium to mid-exponential phase and were harvest, then processed to HRM-MS analysis independently." (PMC6544118 full text, Experimental Design and Statistical Rationale; `epmc_ft_zhao2019.xml`)
  - "searched against a combined database of the NCBI database of Escherichia coli str. K-12 (GCF_000005845.2_ASM584v2, 4140 entries)" (PMC6544118 full text, Materials and Methods; `epmc_ft_zhao2019.xml`)
  - "Concentration of HRM-MS protein copies per cell was calculated based on the means of 500 most abundant protein quantities computed by other three label-free methods (APEX, iBAQ, PAI) downloaded from Arike et al. (2012)" (PMC6544118 full text, Materials and Methods; `epmc_ft_zhao2019.xml`)
- **Inspected:** Table S3 workbook: sheet "MG1655" one header row and 1,571 data records; sheet "BW25113" one header row and 1,951 data records. MG1655 columns: Symbols, GI, OperonID, Synonym, Start, End, Strand, Length, COG_number, Complex/Pathway, Product, two peptide-count columns, MG1655_1 and MG1655_2 abundance under relaxed and under stringent criteria, MG1655_1 and MG1655_2 protein copy number, Average protein copy number per cell. The bundle downloaded completely (64,175,120 B; archive test passed); the table sits one level down, inside Data_Sheet_1.zip. File checksums: section 6.2.
- **Without an account:** Yes (Europe PMC supplementaryFiles)
- **Limitations:** Coverage is 1,571 proteins, fewer than the BW25113 sheet and than Mori or Schmidt. Copies per cell are not measured directly: intensity is converted by a coefficient fitted to the 500 most abundant proteins of a published label-free dataset (Arike et al. 2012), so the scale is borrowed from another study. Two biological replicates, one condition. The table was built for an analysis of operon stoichiometry. The article's data statement names two GEO samples; the PRIDE project was found by its title.
- **Licence standing (a characterisation, not a decision):** Inferred from the article licence (CC BY); no file-level grant shown. No per-file legend and no publisher statement extending the article licence to this supplementary file was found in the retrieved XML, so a grant over the file is inferred from the article licence, not shown. The source ledger has no rule for a publisher-hosted supplementary file without its own legend: its article-licence rule is written for a GEO deposit ("the article's licence is taken as the grant over the article's deposited data"), and its two file-level precedents (Adomako 2022 Data Set S1; PXD005851 Table S1) each rest on a legend. Applying the article licence here would extend the GEO-deposit rule by analogy, which is an owner ledger decision; the owner's 2026-10-05 redistribution decision is a separate basis and is not evidence of a file-level grant. The PRIDE project's `license` field reads "EBI terms of use", which the ledger treats as no grant.
- **Recommendation:** bring second; recommend admit with caveat. Found in the further search: a b-number-keyed per-gene protein table measured in MG1655 itself against the assembly of record, under a CC BY article, with the file in hand. Smaller and more model-dependent than L6-03b; it covers the same strain in a different minimal medium and can check it.

### Layer 7: Curated function, pathways and GO

The RefSeq annotation of this genome already derives from EcoCyc, so a curated source adds summaries, pathways, regulation, essentiality and evidence codes rather than gene names or products. EcoCyc is redistributable under stated conditions once the owner executes its licence; UniProtKB is CC BY 4.0, retrievable now and carries the `b`-number.

| Row | Source | Strain match | Route to b-number | Licence standing | Recommendation |
| --- | --- | --- | --- | --- | --- |
| L7-01 | EcoCyc (BioCyc Tier 1 curated database for E. coli K-12 MG1655) | exact | EcoCyc gene id to b-number through the pinned RefSeq GFF: all 4,651 gene and pseudogene features carry … | Affirmative grant with conditions for EcoCyc specifically: the BioCyc limited-use licence defines "Open Databases" as the EcoCyc … | bring first |
| L7-02 | UniProtKB reference proteome for E. coli K-12 | exact (assembly) | Direct: the `Gene Names (ordered locus)` field carries the b-number (for example P52097: `b0188 JW0183`); the … | Affirmative grant: CC BY 4.0 over the copyrightable parts of the databases, with UniProt's disclaimer that some data may be … | bring first |
| L7-03 | Gene Ontology annotations for E. coli (GO Consortium `ecocyc.gaf`) | exact (taxon level) | Not direct | Affirmative grant: CC BY 4.0, with the attribution and release-date citation the policy asks for | bring second |
| L7-04 | KEGG (organism `eco`, T00007) | exact | KEGG gene id to b-number is by construction (`eco:b4079` in the UniProtKB cross-reference read). Not used | No grant: copyright Kanehisa Laboratories; academic users may use the website; bulk data and service provision require the paid … | not recommended |
| L7-05 | COG database, 2024 update | exact (assembly) | Direct by locus_tag within assembly GCF_000005845.2 (the readme warns that gene ids are not guaranteed unique … | The article is a US Government work in the public domain in the US; the data sit on NCBI FTP, where NCBI places no restrictions … | bring second |
| L7-06 | iML1515 genome-scale metabolic model (BiGG Models) | exact | Not established | Conditional statement, not a formal licence: "freely available for non-commercial use" | supporting |
| L7-07 | The y-ome: genes lacking experimental evidence of function (Ghatak et al. 2019) | not established | Not established | Article CC BY 4.0; repository MIT | supporting |

#### L7-01: EcoCyc (BioCyc Tier 1 curated database for E. coli K-12 MG1655)

- **Identifiers:** EcoCyc PGDB `ECOLI` version 30.0 (Pathway Tools 30.0) as reported by the BioCyc web service on 2026-10-05; described in PMID 37220074, PMCID PMC10729931, DOI 10.1128/ecosalplus.esp-0002-2023
- **Measures:** Literature-curated gene function summaries, enzymes, pathways, transporters, protein complexes, transcription units, promoters, terminators, regulatory interactions, per-medium gene essentiality tables, pseudogenes and phantom genes. **Units:** categorical and textual curation.
- **Strain:** K-12 substr. MG1655 (GenBank U00096.3). **Match to MG1655:** exact.
- **Conditions:** not applicable (curation); essentiality is recorded per growth medium. **Replicates:** not applicable.
- **Identifier namespace:** EcoCyc frame ids (EG…, G…, G0-…) for genes and separate frame ids for proteins. **Route to b-number:** EcoCyc gene id to b-number through the pinned RefSeq GFF: all 4,651 gene and pseudogene features carry `Dbxref=ECOCYC:<id>` beside `locus_tag`. Protein frame ids route through UniProtKB (cross-reference `EcoCyc:<frame>` beside the ordered locus name, row L7-02).
- **Terms, verbatim:**
  - ""Open Databases" means the EcoCyc Pathway/Genome Database (PGDB) and the PGDB for Faecalibacterium prausnitzii A2-165 ." (SRI "BioCyc Flat-File Downloads" licence form page, TERMS AND CONDITIONS OF BIOCYC DATABASES LIMITED USE LICENSE, definitions; `sri_all_reg.html`)
  - "you may use, modify and redistribute the OPEN DATABASES on a worldwide, royalty-free basis, and for any purpose; provided that:" (same page, grant paragraph; `sri_all_reg.html`)
  - "If you distribute any OPEN DATABASES, whether in their original form, in a modified form, or embedded in a product you create, you must: Notify SRI that you are making BIOCYC DATABASES available in this manner; Provide a hyperlink from your distribution to the BioCyc website www.biocyc.org ; Include this statement on the distribution and any marketing collateral: "Includes BioCyc TM pathway/genome databases under license from SRI International." Along with a copy of the BioCyc logo." (same page, distribution conditions; `sri_all_reg.html`)
  - "Access to BioCyc data files requires (1) a license (see bottom of page), and (2) a paid BioCyc subscription costing at least $5,000 (exceptions: access to data files for EcoCyc and for Faecalibacterium prausnitzii A2-165 are free, although a license is required)." (https://biocyc.org/download.shtml, section "Download BioCyc Data Files"; `biocyc_download.html`)
  - "Crawling or scraping the Licensed Materials in any form, for any purpose without SRI's prior written consent is expressly prohibited." (https://biocyc.org/subscription-terms.txt (BioCyc Individual Subscription License Terms, Rev 10/16/2023), clause 3.3; `biocyc_subscription_terms.txt`)
  - "you may use and modify the LIMITED DATABASES on a worldwide, royalty-free basis, and for any purpose, provided, however, you shall not redistribute the LIMITED DATABASES." (same page, paragraph on the Limited Databases; `sri_all_reg.html`)
- **Strain, condition and identity evidence, verbatim:**
  - "EcoCyc contains the complete genome sequence of E. coli K-12 substrain MG1655 (GenBank record version U00096.3 ) and describes the nucleotide position and function of all known protein-coding and RNA-coding E. coli genes and pseudogenes." (PMC10729931 article page; `pmc_page_ecocyc2023.html`)
  - "EcoCyc is involved in a collaboration to update the genome annotation of the GenBank ( U00096.3 ) and RefSeq ( NC_000913.3 ) entries for E. coli K-12 MG1655 on an ongoing basis." (PMC10729931 article page; `pmc_page_ecocyc2023.html`)
  - "When essentiality data are available for a given gene, the EcoCyc gene page includes a table within the Essentiality tab of the growth media under which that gene has been found to be either essential or not essential for growth." (PMC10729931 article page, Essential Gene Information; `pmc_page_ecocyc2023.html`)
  - "&lt;PGDB orgid='ECOLI' version='30.0'>" (BioCyc web service getxml response, PGDB element; `biocyc_websvc_probe.xml`)
- **Inspected:** Access probe on 2026-10-05, no account: the gene page https://ecocyc.org/gene?orgid=ECOLI&id=EG10001 was served (HTTP 200, final URL on biocyc.org, no redirect to account-required.shtml) and one web-service call (https://websvc.biocyc.org/getxml?id=ECOLI:EG10001&detail=low) was served. The licence page says that using the web services API signifies assent to its terms; one probe call was made and none after. Flat files were not obtained: they are released by email after a licence form (name, organisation, address, email, phone) is submitted and reviewed by SRI staff. The form was read, not submitted.
- **Without an account:** Web pages metered without an account; flat files only after the licence form is executed (an owner action)
- **Limitations:** The EcoCyc 2023 article is all rights reserved (ASM), so only the database licence grants anything. Page views are metered, and crawling or scraping is prohibited by the subscription terms, so bulk use must go through the licensed flat files. The RefSeq annotation is already derived from EcoCyc, so gene names, products and coordinates add nothing; the added value is curated summaries, pathways, regulation, essentiality and evidence codes.
- **Licence standing (a characterisation, not a decision):** Affirmative grant with conditions for EcoCyc specifically: the BioCyc limited-use licence defines "Open Databases" as the EcoCyc PGDB and the PGDB for Faecalibacterium prausnitzii A2-165, which may be used, modified and redistributed for any purpose, provided modified copies identify the source, keep copyright notices and author lists and summarise modifications, and any distribution notifies SRI, links to biocyc.org and carries the stated attribution sentence with the BioCyc logo. Every other BioCyc database is a "Limited Database", which may be used and modified but not redistributed. Obtaining the files requires the owner to execute the licence.
- **Recommendation:** bring first; recommend admit with caveat. The single richest curated source and, unlike BioCyc's Limited Databases, redistributable under stated conditions. One owner action (the licence form) unlocks layers 2, 3, 4, 5, 7 and 9 at once.

#### L7-02: UniProtKB reference proteome for E. coli K-12

- **Identifiers:** UniProt release 2026_03 (02-September-2026); proteome UP000000625 (taxon 83333, genome assembly GCA_000005845.2, 4,403 proteins, modified 2026-04-22); REST https://rest.uniprot.org
- **Measures:** Reviewed protein records; fields read here: function text, GO ids, and cross-references to RefSeq, GeneID, KEGG, BioCyc and eggNOG. **Units:** textual and categorical curation.
- **Strain:** "Escherichia coli (strain K12)", built on the MG1655 assembly GCA_000005845.2. **Match to MG1655:** exact (assembly).
- **Conditions:** not applicable (curation). **Replicates:** not applicable.
- **Identifier namespace:** UniProt accession with ordered locus names (b-number and JW id), RefSeq protein ids, GeneID, KEGG (`eco:b####`), EcoCyc protein frame ids. **Route to b-number:** Direct: the `Gene Names (ordered locus)` field carries the b-number (for example P52097: `b0188 JW0183`); the RefSeq protein accession is a second, independent key.
- **Terms, verbatim:**
  - "We have chosen to apply the [Creative Commons Attribution 4.0 International (CC BY 4.0) License](https://creativecommons.org/licenses/by/4.0/) to all copyrightable parts of our databases." (https://rest.uniprot.org/help/license, `content` field (page last modified 2024-12-18); `uniprot_help_license.json`)
- **Strain, condition and identity evidence, verbatim:**
  - ""assemblyId":"GCA_000005845.2"" (UniProt proteome record UP000000625, genomeAssembly; `uniprot_proteome_UP000000625.json`)
  - "b0188 JW0183" (UniProtKB search result, entry P52097, column Gene Names (ordered locus); `uniprot_sample_tils_tada.tsv`)
- **Inspected:** Search `proteome:UP000000625 AND reviewed:true` returned X-Total-Results 4403 under release header 2026_03. Four entries were read (P07658, P07012, P68398, P52097).
- **Without an account:** Yes (REST API, no key)
- **Limitations:** Protein-centric: RNA genes and pseudogenes are out of scope. A proteome-wide count of entries carrying a b-number was not made.
- **Licence standing (a characterisation, not a decision):** Affirmative grant: CC BY 4.0 over the copyrightable parts of the databases, with UniProt's disclaimer that some data may be covered by patents or other rights.
- **Recommendation:** bring first; recommend admit with caveat. Clean licence, versioned releases, a b-number field, and it is also the documented bridge from EcoCyc protein ids, KEGG ids and GO annotations to locus tags.

#### L7-03: Gene Ontology annotations for E. coli (GO Consortium `ecocyc.gaf`)

- **Identifiers:** GO release 2026-08-05 (current.geneontology.org/metadata/release-date.json); file https://current.geneontology.org/annotations/ecocyc.gaf.gz (GAF 2.2, 1,097,004 B compressed, header date-generated 2026-05-21T07:40)
- **Measures:** GO term assignments with evidence codes and references: 55,158 annotation rows over 7,168 objects. **Units:** GO term with evidence code (IDA 12,044; IEA 20,144; IBA 7,325; IPI 5,410; IMP 3,699; EXP 1,778; others).
- **Strain:** taxon 83333 (E. coli K-12). **Match to MG1655:** exact (taxon level).
- **Conditions:** not applicable. **Replicates:** not applicable.
- **Identifier namespace:** EcoCyc protein frame ids (46,471 rows), UniProtKB accessions (7,325 rows), ComplexPortal ids (1,362 rows); no b-number appears in the synonym column. **Route to b-number:** Not direct. EcoCyc protein frame id to UniProtKB (cross-reference `EcoCyc:<frame>`) to ordered locus name; or take GO terms from UniProtKB directly (row L7-02). No route was performed.
- **Terms, verbatim:**
  - "Gene Ontology Consortium data and data products are licensed under the Creative Commons Attribution 4.0 Unported License" (https://geneontology.org/docs/go-citation-policy/, section License; `go_license.html`)
- **Strain, condition and identity evidence, verbatim:**
  - "taxon:83333" (ecocyc.gaf.gz, taxon column of the first data rows; `go_ecocyc.gaf.gz`)
  - "2026-08-05" (GO release-date metadata; `go_release_date.json`)
- **Inspected:** Evidence-code and identifier-namespace counts computed from the file; 0 rows carry a b#### pattern in column 11. File checksums: section 6.2.
- **Without an account:** Yes
- **Limitations:** Mixed evidence: 20,144 rows are IEA and 7,325 are phylogenetic inference (IBA), so the evidence code has to travel with each term, as the site already does for the cyanobacterial IEA layer.
- **Licence standing (a characterisation, not a decision):** Affirmative grant: CC BY 4.0, with the attribution and release-date citation the policy asks for.
- **Recommendation:** bring second; recommend admit with caveat. Adds experimental GO evidence (IDA, IMP, EXP) that the RefSeq GO terms do not distinguish; needs the UniProt bridge.

#### L7-04: KEGG (organism `eco`, T00007)

- **Identifiers:** KEGG organism eco / genome T00007 "Escherichia coli K-12 MG1655": 4,288 proteins (3,243 with KO), 2,979 RNAs, per https://rest.kegg.jp/info/eco read 2026-10-05; terms page "Last updated: October 1, 2024"
- **Measures:** Pathway, module, orthology (KO) and BRITE assignments per gene. **Units:** categorical.
- **Strain:** K-12 MG1655. **Match to MG1655:** exact.
- **Conditions:** not applicable. **Replicates:** not applicable.
- **Identifier namespace:** KEGG gene ids; UniProtKB lists them as `eco:b####`. **Route to b-number:** KEGG gene id to b-number is by construction (`eco:b4079` in the UniProtKB cross-reference read). Not used.
- **Terms, verbatim:**
  - "Academic users may freely use the KEGG website at https://www.kegg.jp/ or its mirror site at GenomeNet https://www.genome.jp/kegg/ . Academic users who utilize KEGG for providing services are requested to obtain an academic service provider license, which is included in the KEGG FTP academic subscription ." (https://www.genome.jp/kegg/legal.html, "Academic use of KEGG"; `kegg_legal.html`)
  - "Restriction: KEGG API at rest.kegg.jp is made available only for academic use by academic users." (https://www.kegg.jp/kegg/rest/; `kegg_rest.html`)
  - "The KEGG FTP Academic Subscription is a paid service managed by Pathway Solutions for those academic users who wish to bulk-download KEGG data and/or to provide outside services using KEGG data" (https://www.pathway.jp/en/academic.html; `pathway_academic.html`)
- **Strain, condition and identity evidence, verbatim:**
  - "Escherichia coli K-12 MG1655" (https://rest.kegg.jp/info/eco, first line; `kegg_info_eco.txt`)
- **Inspected:** Terms pages and one `info` call only; no gene, pathway or link data were pulled.
- **Without an account:** Website and API readable without an account for academic use; bulk download only by paid FTP subscription
- **Limitations:** No redistribution grant; providing a service from KEGG data requires an academic service-provider licence.
- **Licence standing (a characterisation, not a decision):** No grant: copyright Kanehisa Laboratories; academic users may use the website; bulk data and service provision require the paid FTP subscription. Consistent with the roadmap's standing exclusion of KEGG.
- **Recommendation:** not recommended; recommend reject. Terms exclude shipping KEGG-derived data from a public static site.

#### L7-05: COG database, 2024 update

- **Identifiers:** PMID 39494517; PMCID PMC11701660; DOI 10.1093/nar/gkae983; https://ftp.ncbi.nlm.nih.gov/pub/COG/COG2024/data/ (files cog-24.cog.csv, cog-24.def.tab, cog-24.fun.tab, COGorg24.gene.tab.gz, Readme.COG2024.txt, checksums.md5)
- **Measures:** Orthologous-group membership and functional category per protein-coding gene. **Units:** categorical (COG id, functional category letters).
- **Strain:** GCF_000005845.2 is one of the 2,296 genomes (cog-24.org.csv). **Match to MG1655:** exact (assembly).
- **Conditions:** not applicable. **Replicates:** not applicable.
- **Identifier namespace:** Gene ID given as the NCBI locus_tag in COGorg24.gene.tab.gz, with assembly id and protein id. **Route to b-number:** Direct by locus_tag within assembly GCF_000005845.2 (the readme warns that gene ids are not guaranteed unique across genomes, so the assembly id must be part of the key).
- **Terms, verbatim:**
  - "This work is written by (a) US Government employee(s) and is in the public domain in the US." (PMC11701660 NCBI efetch db=pmc, &lt;permissions>/&lt;license>; `ncbi_pmc_cog2024.xml`)
  - "Therefore, NCBI itself places no restrictions on the use or distribution of the data contained therein. Nor do we accept data when the submitter has requested restrictions on reuse or redistribution." (NCBI Policies and Disclaimers page, section "Molecular Data Usage"; `ncbi_policies.html`)
- **Strain, condition and identity evidence, verbatim:**
  - "GCF_000005845.2,Escherichia_coli_K-12_sub_MG1655,511145" (cog-24.org.csv line 1840; `cog2024_org.csv`)
  - "1. Gene ID (NCBI locus_tag; not guaranteed to be unique)" (Readme.COG2024.txt, section COGorg24.gene.tab.gz; `cog2024_readme.txt`)
- **Inspected:** Readme, directory listing and organism table read; the 608 MB membership file was not downloaded.
- **Without an account:** Yes (NCBI FTP)
- **Limitations:** Computational orthology with curated category names: label as computational annotation. Large files for one genome's rows.
- **Licence standing (a characterisation, not a decision):** The article is a US Government work in the public domain in the US; the data sit on NCBI FTP, where NCBI places no restrictions of its own. Read as usable with attribution, pending the ledger entry.
- **Recommendation:** bring second; recommend admit with caveat. A free functional-category axis keyed by locus tag, comparable to the category layer the cyanobacterial view derives from its sources.

#### L7-06: iML1515 genome-scale metabolic model (BiGG Models)

- **Identifiers:** PMID 29020004; PMCID PMC6521705; DOI 10.1038/nbt.3956; http://bigg.ucsd.edu/api/v2/models/iML1515 (last_updated "Oct 31, 2019"; genome NC_000913.3; 1,516 genes, 2,712 reactions, 1,877 metabolites)
- **Measures:** Gene to reaction associations, subsystems and model-based predictions; a reconstruction, not a measurement. **Units:** gene-protein-reaction rules.
- **Strain:** K-12 substr. MG1655 (NC_000913.3). **Match to MG1655:** exact.
- **Conditions:** not applicable. **Replicates:** not applicable.
- **Identifier namespace:** not inspected (gene list not pulled). **Route to b-number:** Not established.
- **Terms, verbatim:**
  - "BiGG is freely available for non-commercial use." (http://bigg.ucsd.edu/license (legacy site; a banner says data have not been updated since October 2019 and points to bigg.bio); `bigg_license.html`)
  - "This file is available for text mining. It may also be used consistent with the principles of fair use under the copyright law." (PMC6521705 NCBI efetch db=pmc, &lt;permissions>/&lt;license>; `ncbi_pmc_iml1515.xml`)
- **Strain, condition and identity evidence, verbatim:**
  - "ML1515 accounts for 1,515 open reading frames and 2,719 metabolic reactions involving 1,192 unique metabolites." (PMC6521705 author manuscript, Abstract; `ncbi_pmc_iml1515.xml`)
- **Inspected:** API model record and licence page read. The article counts 1,515 ORFs and 2,719 reactions; the BiGG record counts 1,516 genes and 2,712 reactions (the difference was not investigated). GitHub SBRG/iML1515_GP carries no licence per the GitHub API.
- **Without an account:** Yes
- **Limitations:** Model membership and simulated essentiality must stay distinct from measurements, as roadmap item 5 already requires.
- **Licence standing (a characterisation, not a decision):** Conditional statement, not a formal licence: "freely available for non-commercial use". The article carries only a text-mining notice. Undetermined for redistribution.
- **Recommendation:** supporting; insufficient evidence. Roadmap item 5 analogue; terms need a proper licence text before ranking.

#### L7-07: The y-ome: genes lacking experimental evidence of function (Ghatak et al. 2019)

- **Identifiers:** PMID 30698741; PMCID PMC6412132; DOI 10.1093/nar/gkz030; GitHub zakandrewking/y-ome (MIT per the GitHub API); Zenodo DOI 10.5281/zenodo.1906044 (v1.1.0, record licence "other-open")
- **Measures:** Classification of each gene by strength of experimental evidence of function: 1,600 of 4,623 unique genes in the y-ome. **Units:** categorical annotation level.
- **Strain:** not extracted from the passages read. **Match to MG1655:** not established.
- **Conditions:** not applicable. **Replicates:** not applicable.
- **Identifier namespace:** not inspected. **Route to b-number:** Not established.
- **Terms, verbatim:**
  - "This is an Open Access article distributed under the terms of the Creative Commons Attribution License ( http://creativecommons.org/licenses/by/4.0/ ), which permits unrestricted reuse, distribution, and reproduction in any medium, provided the original work is properly cited." (PMC6412132 Europe PMC fullTextXML, &lt;permissions>/&lt;license>; `epmc_ft_yome2019.xml`)
- **Strain, condition and identity evidence, verbatim:**
  - "We identified the genes that lack experimental evidence of function (the ‘y-ome’) which include 1600 of 4623 unique genes (34.6%), of which 111 have absolutely no evidence of function." (PMC6412132 full text, Abstract; `epmc_ft_yome2019.xml`)
- **Inspected:** Bundle retrieved (4,318,851 B) and not opened.
- **Without an account:** Yes
- **Limitations:** A 2018 snapshot built partly from sources with their own terms (EcoCyc, RegulonDB).
- **Licence standing (a characterisation, not a decision):** Article CC BY 4.0; repository MIT.
- **Recommendation:** supporting; recommend admit with caveat. A ready "how well characterised is this gene" axis, useful for choosing recoding targets.

### Layer 8: tRNA genes and modifications relevant to tAI

The annotation of the genome of record already supplies what the tAI computation needs: 86 tRNA genes by anticodon, with the two lysidine tRNA-Ile genes, the initiator tRNAs and the selenocysteine tRNA labelled. The anticodon is in a free-text field, not a structured one. GtRNAdb's predictions on the paired GenBank assembly differ from it by one gene, an extra Thr(CGT) (L8-02). The licence basis for retaining this EcoCyc-derived annotation is not settled (L8-01, section 4.6). The primary papers on lysidine and on tRNA abundance could not be read; a UniProtKB statement stands in for the first.

| Row | Source | Strain match | Route to b-number | Licence standing | Recommendation |
| --- | --- | --- | --- | --- | --- |
| L8-01 | tRNA genes in the RefSeq annotation of the genome of record | exact | Direct | Candidate reproducibility input; the retention basis for this genome is an owner ledger decision still to be made | bring first |
| L8-02 | GtRNAdb: tRNAscan-SE predictions for E. coli K-12 MG1655 | exact (strain and paired assembly) | Positional on the linked assembly. No locus-level or sequence-level matching to the annotation was performed | Undetermined: the database publishes no terms; the 2016 article is CC BY-NC 4.0, which governs the article, not the database files | link-only; use as a cross-check |
| L8-03 | MODOMICS: RNA modification database | not established | Not established (tRNA species to gene is many-to-one and needs a sequence match) | Articles CC BY 4.0; the licence over database content is not reported on the page read. Undetermined | supporting |
| L8-04 | UniProtKB statements on lysidine (TilS) and wobble inosine (TadA) | exact | Direct (ordered locus name) | Affirmative grant: CC BY 4.0 | bring first (as the citable basis for the two special cases) |
| L8-05 | tadA, the tRNA-specific adenosine deaminase (Wolf, Gerber and Keller 2002) | not established | Gene name (tadA, b2559 per UniProtKB) | No grant: copyright statement only. Citation only | citation only |
| L8-06 | tRNA adaptation index definition (dos Reis, Savva and Wernisch 2004) | not applicable | not applicable | No grant needed for a method citation; copyright statement only | citation only |
| L8-07 | Species-specific tAI wobble weights (Sabi and Tuller 2014) | not applicable | not applicable | Article CC BY 4.0 | supporting |
| L8-08 | Isoleucine tRNA specificity enzyme (Soma et al. 2003) | not established | Not established | Undetermined: not read | not retrieved |
| L8-09 | tRNA abundance and codon usage at different growth rates (Dong, Nilsson and Kurland 1996) | not established | Not established | Undetermined: not read | not retrieved |
| L8-10 | Transfer RNA modification review (Björk and Hagervall 2014, EcoSal Plus) | not established | Not established | Undetermined: not read | not retrieved |
| L7-02 | UniProtKB reference proteome for E. coli K-12 | exact (assembly) | Direct: the `Gene Names (ordered locus)` field carries the b-number (for example P52097: `b0188 JW0183`); the … | Affirmative grant: CC BY 4.0 over the copyrightable parts of the databases, with UniProt's disclaimer that some data may be … | bring first |

#### L8-01: tRNA genes in the RefSeq annotation of the genome of record

- **Identifiers:** RefSeq GCF_000005845.2 (ASM584v2), sequence NC_000913.3, GBFF LOCUS date 02-SEP-2026; annotation_hashes.txt: features hash E21EDCE767A1C96746CC24D4C54DD401, last changed 2026-09-04 17:13:00; files GCF_000005845.2_ASM584v2_genomic.gff.gz (MD5 0f52ffc94af5ddf544ff89cc6f546b0c, matching NCBI md5checksums.txt), _genomic.gbff.gz, _cds_from_genomic.fna.gz
- **Measures:** Annotated tRNA genes with amino acid and anticodon: 86 tRNA genes in 42 amino-acid/anticodon classes. **Units:** gene copy count per anticodon.
- **Strain:** K-12 substr. MG1655. **Match to MG1655:** exact.
- **Conditions:** not applicable (annotation). **Replicates:** not applicable.
- **Identifier namespace:** b-number locus tags on every tRNA gene. **Route to b-number:** Direct. The anticodon is not in a structured `anticodon` attribute (0 occurrences in the GFF or GBFF); it is in the free-text `Note`, for example `Note=tRNA-Ile(CAU)`, so a parser must read the Note and must fail closed on an unparsed one.
- **Terms, verbatim:**
  - "Therefore, NCBI itself places no restrictions on the use or distribution of the data contained therein. Nor do we accept data when the submitter has requested restrictions on reuse or redistribution." (NCBI Policies and Disclaimers page, section "Molecular Data Usage"; `ncbi_policies.html`)
  - "Information that is created by or for the US government on this site is within the public domain." (NCBI Policies and Disclaimers page, section "Copyright Status of Webpages"; `ncbi_policies.html`)
  - "NOTE: This site contains resources which incorporate material contributed or licensed by individuals, companies, or organizations that may be protected by U.S. and foreign copyright laws." (same page, same section; `ncbi_policies.html`)
  - "NCBI is not in a position to assess the validity of such claims and since there is no transfer of rights from submitters to NCBI, NCBI has no rights to transfer to a third party." (same page, section "Molecular Data Usage"; `ncbi_policies.html`)
- **Strain, condition and identity evidence, verbatim:**
  - "Note=tRNA-Ile(CAU)" (GFF tRNA features of ileX (b3069) and ileY (b2652); `GCF_000005845.2_ASM584v2_genomic.gff.gz`)
  - "Note=tRNA-Sec(UCA)" (GFF tRNA feature of selC (b3658); `GCF_000005845.2_ASM584v2_genomic.gff.gz`)
  - "Note=tRNA-Arg(ACG)" (GFF tRNA features of the four Arg(ACG) genes; `GCF_000005845.2_ASM584v2_genomic.gff.gz`)
  - "Note=tRNA-initiator Met(CAU)" (GFF tRNA features of the four initiator tRNA genes; `GCF_000005845.2_ASM584v2_genomic.gff.gz`)
- **Inspected:** Copies by class, from the Note field: Ala(GGC) 2, Ala(UGC) 3, Arg(ACG) 4, Arg(CCG) 1, Arg(CCU) 1, Arg(UCU) 1, Asn(GUU) 4, Asp(GUC) 3, Cys(GCA) 1, Gln(CUG) 2, Gln(UUG) 2, Glu(UUC) 4, Gly(CCC) 1, Gly(GCC) 4, Gly(UCC) 1, His(GUG) 1, Ile(CAU) 2, Ile(GAU) 3, Leu(CAA) 1, Leu(CAG) 4, Leu(GAG) 1, Leu(UAA) 1, Leu(UAG) 1, Lys(UUU) 6, Met(CAU) 2, initiator Met(CAU) 4, Phe(GAA) 2, Pro(CGG) 1, Pro(GGG) 1, Pro(UGG) 1, Sec(UCA) 1, Ser(CGA) 1, Ser(GCU) 1, Ser(GGA) 2, Ser(UGA) 1, Thr(CGU) 1, Thr(GGU) 2, Thr(UGU) 1, Trp(CCA) 1, Tyr(GUA) 3, Val(GAC) 2, Val(UAC) 5. Total 86. File checksums: section 6.2.
- **Without an account:** Yes (NCBI FTP)
- **Limitations:** Gene copies are a proxy for tRNA abundance, as the source ledger already says for the cyanobacterial view. Three CAU classes must be kept apart: elongator Met, initiator Met and the two lysidine tRNA-Ile genes (ileX, ileY) that read AUA. Sec(UCA) is not a standard decoder. Arg(ACG) is the only class with A at the first anticodon position, the position TadA deaminates in tRNA-Arg2 (rows L8-04, L8-05). Modifications are not in the annotation.
- **Licence standing (a characterisation, not a decision):** Candidate reproducibility input; the retention basis for this genome is an owner ledger decision still to be made. The ledger's RefSeq rule has two layers: a PGAP annotation "created by or for the US government" (public domain), and submitted assembly bytes under NCBI's data usage policies. Neither covers this annotation as written. The record's COMMENT says "annotation updates are derived from EcoCyc" and its latest direct submission is from the EcoCyc project; that it is not PGAP output is an inference from the record, not a quoted statement. NCBI's policy page separates information "created by or for the US government" from "material contributed or licensed by individuals, companies, or organizations", and says that with no transfer of rights from submitters "NCBI has no rights to transfer to a third party". The only grant text read that names EcoCyc content is EcoCyc's own licence (row L7-01); whether it reaches the copy inside the RefSeq record was not established. Public retrieval, an accession and a checksum are not permission. The existing practice (retain as a reproducibility input under a checksum pin, never offer as a product download) is what stream 2 currently follows; this row does not validate or invalidate it.
- **Recommendation:** bring first; recommend admit with caveat. Already inside the pinned input, keyed by b-number, and it labels the lysidine tRNA-Ile, initiator tRNA and selenocysteine tRNA explicitly, which is what the tAI special cases need. The caveat is the licence basis, not the content.

#### L8-02: GtRNAdb: tRNAscan-SE predictions for E. coli K-12 MG1655

- **Identifiers:** GtRNAdb Data Release 22 (Sept 2024); https://gtrnadb.ucsc.edu/genomes/bacteria/Esch_coli_K_12_MG1655/ ; bundle eschColi_K_12_MG1655-tRNAs.tar.gz (linked, not downloaded); cited as PMID 26673694, DOI 10.1093/nar/gkv1309
- **Measures:** Computationally predicted tRNA genes with scores: 86 decoding the standard 20 amino acids, 1 selenocysteine, 1 of undetermined isotype, 1 predicted pseudogene; 89 in total. **Units:** gene counts by anticodon; covariance-model scores.
- **Strain:** K-12 substr. MG1655; the genome page links NCBI assembly GCA_000005845.2 and the FTP path GCA_000005845.2_ASM584v2, the GenBank assembly that NCBI Datasets pairs with the genome of record GCF_000005845.2. **Match to MG1655:** exact (strain and paired assembly).
- **Conditions:** not applicable (prediction). **Replicates:** not applicable.
- **Identifier namespace:** GtRNAdb gene symbols and coordinates. **Route to b-number:** Positional on the linked assembly. No locus-level or sequence-level matching to the annotation was performed.
- **Terms, verbatim:**
  - "This is an Open Access article distributed under the terms of the Creative Commons Attribution License ( http://creativecommons.org/licenses/by-nc/4.0/ ), which permits non-commercial re-use, distribution, and reproduction in any medium, provided the original work is properly cited. For commercial re-use, please contact journals.permissions@oup.com" (PMC4702915 Europe PMC fullTextXML, &lt;permissions>/&lt;license>; `epmc_ft_gtrnadb2016.xml`)
- **Strain, condition and identity evidence, verbatim:**
  - "tRNAs decoding standard 20 AA 86 Selenocysteine tRNAs (TCA) 1 Possible suppressor tRNAs (CTA,TTA,TCA) 0 tRNAs with undetermined or unknown isotypes 1 Predicted pseudogenes 1 Total tRNAs 89" (GtRNAdb genome page, tRNA Gene Summary; `gtrnadb_ecoli.html`)
  - "Data Release 22 (Sept 2024)" (GtRNAdb front page; `gtrnadb_front.html`)
  - "http://www.ncbi.nlm.nih.gov/assembly/GCA_000005845.2" (GtRNAdb genome page, address of the NCBI assembly link (an href attribute); `gtrnadb_ecoli.html`)
  - "ftp://ftp.ncbi.nlm.nih.gov/genomes/all/GCA/000/005/845/GCA_000005845.2_ASM584v2" (GtRNAdb genome page, address of the FTP link (an href attribute); `gtrnadb_ecoli.html`)
  - "Thr AGT GGT 2 CGT 2 TGT 1 5" (GtRNAdb genome page, anticodon table, Thr row (AGT none, GGT 2, CGT 2, TGT 1, total 5); `gtrnadb_ecoli.html`)
  - ""paired_accession":"GCA_000005845.2"" (NCBI Datasets v2 genome dataset report for GCF_000005845.2 (the record's `accession` is GCF_000005845.2); `ncbi_datasets_assembly.json`)
- **Inspected:** Front page, genome page, FAQ and citation page read: none contains a licence, terms-of-use or copyright statement for the database (terms: not reported). The assembly is named in two link addresses on the genome page, not in its visible text. Class by class, the page's anticodon table and the Note-field counts of row L8-01 agree for every standard class except one: GtRNAdb lists Thr(CGT) 2 where the annotation has Thr(CGU) 1. That accounts for 86 against 85 standard tRNA genes (87 against 86 with selenocysteine). Which predicted locus is the extra Thr(CGT), and what the undetermined and pseudogene predictions are, was not examined: the difference is located by class, not reconciled by locus. Retrieval record (added under DEM-244): what this row says about the site rests on this run's own retrievals, made with a plain `curl` client: https://gtrnadb.ucsc.edu/ (retrieved 2026-10-05T16:26:22Z, 12,922 B, SHA-256 2fa961c30b91eda2d9a17027b72d1354e8e662c7b7127e51d1e3debaf4821f5e); https://gtrnadb.ucsc.edu/genomes/bacteria/Esch_coli_K_12_MG1655/ (retrieved 2026-10-05T16:26:22Z, 12,607 B, SHA-256 d845f62e9b5817021fff818a9bf9a2794691d7645e252f621251bb5be90ea117); https://gtrnadb.ucsc.edu/faq.html (retrieved 2026-10-05T16:46:28Z, 8,404 B, SHA-256 bc2742f4d98b2821699b8b7f6fa265d4a6d6f3a07c36ee8039f490cdac9f7d9d); https://gtrnadb.ucsc.edu/citation.html (retrieved 2026-10-05T16:46:28Z, 7,305 B, SHA-256 b2afc7d940ec7c71525b93094e0d81aba6d06dc80dfe9361a8fae6d3d3a2d87e); https://api.ncbi.nlm.nih.gov/datasets/v2/genome/accession/GCF_000005845.2/dataset_report (retrieved 2026-10-05T18:05:10Z, 2,926 B, SHA-256 d3ae26c9d6ac9f8d21e8c0d0b7ad787b79c71e82be306fa4997e8985de6249a1). Requested again under DEM-244, https://gtrnadb.ucsc.edu/genomes/bacteria/Esch_coli_K_12_MG1655/ at 2026-10-05T19:17:42Z and https://gtrnadb.ucsc.edu/ at 2026-10-05T19:17:45Z each returned HTTP 200 with the same SHA-256. The independent confirmation DEM-241 reports HTTP 403 for the genome page at 18:46:24 UTC on 2026-10-05, with no response body kept, so the two link addresses and the tRNA counts of the genome page have been read by this run only; DEM-241 confirmed the GCA and GCF pairing from NCBI Datasets.
- **Without an account:** Yes
- **Limitations:** A prediction on the same sequence, not independent evidence, and not to be merged with the annotation: the two remain separate evidence types. Database terms are silent, as the cyanobacterial tRNA ticket already found.
- **Licence standing (a characterisation, not a decision):** Undetermined: the database publishes no terms; the 2016 article is CC BY-NC 4.0, which governs the article, not the database files. Link-only.
- **Recommendation:** link-only; use as a cross-check; insufficient evidence. Useful only as a cross-check: it flags one extra predicted Thr(CGT) gene against the annotation for a person to look at.

#### L8-03: MODOMICS: RNA modification database

- **Identifiers:** PMID 41277531; PMCID PMC12807697; DOI 10.1093/nar/gkaf1284 (2025 update); PMID 38015436, PMCID PMC10767930 (2023 update); site https://genesilico.pl/modomics/
- **Measures:** Curated modified residues in RNA sequences, modification pathways and modifying enzymes (E. coli entries not checked). **Units:** modified-nucleoside positions per tRNA sequence.
- **Strain:** per sequence entry; not read. **Match to MG1655:** not established.
- **Conditions:** not applicable. **Replicates:** not applicable.
- **Identifier namespace:** MODOMICS sequence ids; tRNA isoacceptor names. **Route to b-number:** Not established (tRNA species to gene is many-to-one and needs a sequence match).
- **Terms, verbatim:**
  - "This is an Open Access article distributed under the terms of the Creative Commons Attribution License ( https://creativecommons.org/licenses/by/4.0/ ), which permits unrestricted reuse, distribution, and reproduction in any medium, provided the original work is properly cited." (PMC12807697 Europe PMC fullTextXML, &lt;permissions>/&lt;license>; `epmc_ft_modomics2025.xml`)
- **Strain, condition and identity evidence, verbatim:**
  - "When using MODOMICS, please cite: MODOMICS: a database of RNA modifications and related information. 2025 update and 20th anniversary." (MODOMICS front page, Citation; `modomics_front.html`)
- **Inspected:** Front page read: it carries a citation request and no licence or terms text (database terms: not reported on the page read). The E. coli tRNA sequence entries were not pulled.
- **Without an account:** Front page yes; data not pulled
- **Limitations:** Needed only if the tAI wobble rules are to be justified per modification (for example lysidine and inosine).
- **Licence standing (a characterisation, not a decision):** Articles CC BY 4.0; the licence over database content is not reported on the page read. Undetermined.
- **Recommendation:** supporting; insufficient evidence. The curated source for which tRNAs carry which wobble modification.

#### L8-04: UniProtKB statements on lysidine (TilS) and wobble inosine (TadA)

- **Identifiers:** UniProtKB release 2026_03: P52097 (tilS, b0188), P68398 (tadA, b2559); retrieved by REST search on proteome UP000000625
- **Measures:** Curated function statements: TilS converts C34 of the CAU-anticodon tRNA-Ile to lysidine, making it read AUA as isoleucine; TadA deaminates A34 of tRNA-Arg2 to inosine. **Units:** textual.
- **Strain:** E. coli K-12. **Match to MG1655:** exact.
- **Conditions:** not applicable (curation). **Replicates:** not applicable.
- **Identifier namespace:** UniProt accession with b-number. **Route to b-number:** Direct (ordered locus name).
- **Terms, verbatim:**
  - "We have chosen to apply the [Creative Commons Attribution 4.0 International (CC BY 4.0) License](https://creativecommons.org/licenses/by/4.0/) to all copyrightable parts of our databases." (https://rest.uniprot.org/help/license, `content` field; `uniprot_help_license.json`)
- **Strain, condition and identity evidence, verbatim:**
  - "Ligates lysine onto the cytidine present at position 34 of the AUA codon-specific tRNA(Ile) that contains the anticodon CAU, in an ATP-dependent manner. Cytidine is converted to lysidine, thus changing the amino acid specificity of the tRNA from methionine to isoleucine." (UniProtKB P52097, Function [CC]; `uniprot_sample_tils_tada.tsv`)
  - "Catalyzes the deamination of adenosine to inosine at the wobble position 34 of tRNA(Arg2)." (UniProtKB P68398, Function [CC]; `uniprot_sample_tils_tada.tsv`)
- **Inspected:** Two entries read. The P68398 statement cites PubMed 12110595 (row L8-05).
- **Without an account:** Yes
- **Limitations:** A curated summary, not the primary experiment; it names the tRNA species, and the link to gene copies (Arg(ACG), Ile(CAU)) is by anticodon.
- **Licence standing (a characterisation, not a decision):** Affirmative grant: CC BY 4.0.
- **Recommendation:** bring first (as the citable basis for the two special cases); recommend admit. Gives a licensed, versioned, quotable statement for the lysidine and inosine rules the tAI code special-cases.

#### L8-05: tadA, the tRNA-specific adenosine deaminase (Wolf, Gerber and Keller 2002)

- **Identifiers:** PMID 12110595; PMCID PMC126108; DOI 10.1093/emboj/cdf362
- **Measures:** Biochemical characterisation: inosine formation at position 34 of tRNA-Arg2. **Units:** not applicable.
- **Strain:** E. coli (strain not extracted). **Match to MG1655:** not established.
- **Conditions:** in vitro and genetic characterisation. **Replicates:** not applicable.
- **Identifier namespace:** gene name. **Route to b-number:** Gene name (tadA, b2559 per UniProtKB).
- **Terms, verbatim:**
  - "Copyright © 2002 European Molecular Biology Organization" (PMC article page PMC126108, copyright line; `pmc_page_wolf2002.html`)
- **Strain, condition and identity evidence, verbatim:**
  - "is sufficient for site-specific inosine formation at the wobble position (position 34) of tRNA Arg2 , the only tRNA having this modification in prokaryotes." (PMC126108 article page, Abstract; `pmc_page_wolf2002.html`)
- **Inspected:** Article page read.
- **Without an account:** Yes (PMC article page)
- **Limitations:** Citation only.
- **Licence standing (a characterisation, not a decision):** No grant: copyright statement only. Citation only.
- **Recommendation:** citation only; recommend admit with caveat (as a citation, not as data). Primary evidence that tRNA-Arg2 is the single inosine case, which fixes how Arg(ACG) is treated in the wobble rules.

#### L8-06: tRNA adaptation index definition (dos Reis, Savva and Wernisch 2004)

- **Identifiers:** PMID 15448185; PMCID PMC521650; DOI 10.1093/nar/gkh834
- **Measures:** Method definition: tAI as the geometric mean of the relative adaptiveness values of a gene's codons (how the weights derive from tRNA gene copies was not re-read here). **Units:** index between 0 and 1.
- **Strain:** not applicable (method; organisms not extracted). **Match to MG1655:** not applicable.
- **Conditions:** not applicable. **Replicates:** not applicable.
- **Identifier namespace:** not applicable. **Route to b-number:** not applicable
- **Terms, verbatim:**
  - "Copyright © 2004 Oxford University Press" (PMC article page PMC521650, copyright line; `pmc_page_dosreis2004.html`)
- **Strain, condition and identity evidence, verbatim:**
  - "The tRNA adaptation index tAI g of a gene g is defined as the geometric mean of the relative adaptiveness values of its codons" (PMC521650 article page, Materials and Methods; `pmc_page_dosreis2004.html`)
- **Inspected:** Article page read; which organism the published wobble weights were fitted on was not extracted.
- **Without an account:** Yes (PMC article page)
- **Limitations:** Which organism the published s-values were optimised on decides whether they suit E. coli; not extracted here.
- **Licence standing (a characterisation, not a decision):** No grant needed for a method citation; copyright statement only.
- **Recommendation:** citation only; recommend admit with caveat (as a citation, not as data). The method the pipeline implements; the open question is the choice of wobble weights for E. coli.

#### L8-07: Species-specific tAI wobble weights (Sabi and Tuller 2014)

- **Identifiers:** PMID 24906480; PMCID PMC4195497; DOI 10.1093/dnares/dsu017
- **Measures:** Method: wobble interaction weights (Sij) inferred per species by optimising against codon usage bias. **Units:** index.
- **Strain:** not applicable (method). **Match to MG1655:** not applicable.
- **Conditions:** not applicable. **Replicates:** not applicable.
- **Identifier namespace:** not applicable. **Route to b-number:** not applicable
- **Terms, verbatim:**
  - "https://creativecommons.org/licenses/by/4.0/ This is an Open Access article distributed under the terms of the Creative Commons Attribution License ( http://creativecommons.org/licenses/by/4.0/ ), which permits unrestricted reuse, distribution, and reproduction in any medium, provided the original work is properly cited." (PMC4195497 Europe PMC fullTextXML, &lt;permissions>/&lt;license>; `epmc_ft_sabi2014.xml`)
- **Strain, condition and identity evidence, verbatim:**
  - "the species-specific inference of the S ij tends to predict PA better than the traditional tAI." (PMC4195497 full text, Results; `epmc_ft_sabi2014.xml`)
- **Inspected:** Article XML read for the method statement only.
- **Without an account:** Yes
- **Limitations:** Whether an E. coli weight set is tabulated was not checked.
- **Licence standing (a characterisation, not a decision):** Article CC BY 4.0.
- **Recommendation:** supporting; insufficient evidence. The readable source for an E. coli-specific alternative to the original weights.

#### L8-08: Isoleucine tRNA specificity enzyme (Soma et al. 2003)

- **Identifiers:** PMID 14527414; DOI 10.1016/s1097-2765(03)00346-0
- **Measures:** Primary report on the enzyme governing the codon and amino-acid specificity of isoleucine tRNA (title only). **Units:** not retrieved.
- **Strain:** not retrieved. **Match to MG1655:** not established.
- **Conditions:** not retrieved. **Replicates:** not retrieved.
- **Identifier namespace:** not retrieved. **Route to b-number:** Not established.
- **Terms, verbatim:** none read; see "Inspected".
- **Strain, condition and identity evidence, verbatim:**
  - ""pmid":"14527414"" (Europe PMC REST search response for the article title (identifier resolution only); `epmc_search_soma2003.json`)
- **Inspected:** Not in PMC (NCBI ID converter: "Identifier not found in PMC") and not in Europe PMC full text. The UniProtKB statement in row L8-04 stands in as the readable source.
- **Without an account:** Not retrieved
- **Limitations:** Not read.
- **Licence standing (a characterisation, not a decision):** Undetermined: not read.
- **Recommendation:** not retrieved; insufficient evidence. Listed so the gap is visible; a person with library access can supply it.

#### L8-09: tRNA abundance and codon usage at different growth rates (Dong, Nilsson and Kurland 1996)

- **Identifiers:** PMID 8709146; DOI 10.1006/jmbi.1996.0428
- **Measures:** tRNA abundance against codon usage at different growth rates (title only); would test how well gene copies stand in for tRNA levels. **Units:** not retrieved.
- **Strain:** not retrieved. **Match to MG1655:** not established.
- **Conditions:** not retrieved. **Replicates:** not retrieved.
- **Identifier namespace:** not retrieved. **Route to b-number:** Not established.
- **Terms, verbatim:** none read; see "Inspected".
- **Strain, condition and identity evidence, verbatim:**
  - ""pmid":"8709146"" (Europe PMC REST search response for the article title (identifier resolution only); `epmc_search_dong1996.json`)
- **Inspected:** Not in PMC and not in Europe PMC full text. Without it the copy-number proxy rests on the general caveat already in the source ledger.
- **Without an account:** Not retrieved
- **Limitations:** Not read.
- **Licence standing (a characterisation, not a decision):** Undetermined: not read.
- **Recommendation:** not retrieved; insufficient evidence. Listed so the gap is visible; a person with library access can supply it.

#### L8-10: Transfer RNA modification review (Björk and Hagervall 2014, EcoSal Plus)

- **Identifiers:** PMID 26442937; DOI 10.1128/ecosalplus.esp-0007-2013
- **Measures:** Reference review of E. coli tRNA modifications and their decoding effects. **Units:** not retrieved.
- **Strain:** not retrieved. **Match to MG1655:** not established.
- **Conditions:** not retrieved. **Replicates:** not retrieved.
- **Identifier namespace:** not retrieved. **Route to b-number:** Not established.
- **Terms, verbatim:** none read; see "Inspected".
- **Strain, condition and identity evidence, verbatim:**
  - ""pmid":"26442937"" (Europe PMC REST search response for the article title (identifier resolution only); `epmc_search_bjork2014.json`)
- **Inspected:** Not in PMC and not in Europe PMC full text; journals.asm.org is left alone per the handoff contract.
- **Without an account:** Not retrieved
- **Limitations:** Not read.
- **Licence standing (a characterisation, not a decision):** Undetermined: not read.
- **Recommendation:** not retrieved; insufficient evidence. Listed so the gap is visible; a person with library access can supply it.

### Layer 9: Gene-model peculiarities

Every peculiarity the handoff names is encoded per `b`-number in the annotation of record and was enumerated mechanically (L9-01); the licence basis for retaining the annotation is an open owner decision, stated in that row. Row L6-06 (small proteins), row L7-07 (poorly characterised genes) and row L7-01 (EcoCyc pseudogenes and phantom genes) also bear on this layer.

| Row | Source | Strain match | Route to b-number | Licence standing | Recommendation |
| --- | --- | --- | --- | --- | --- |
| L9-01 | Gene-model exceptions encoded in the RefSeq annotation of the genome of record | exact | Direct | Candidate reproducibility input; the retention basis for this genome is an owner ledger decision still to be made | bring first |
| L9-02 | Recode-2 database of programmed recoding events | not established | Not established | Article CC BY-NC (2.0 UK); legacy database file terms not reported | not recommended |
| L9-03 | Programmed frameshift in copA (Meydan et al. 2017) | not established | Gene name; encoded at b0484 in the annotation (row L9-01) | No grant (text-mining notice only). Citation only | citation only |
| L9-04 | prfB programmed frameshift (Craigen et al. 1985) | not established | Gene name; the exception itself is already encoded at the b-number in the RefSeq annotation (row L9-01) | Not reported: the record carries no rights statement. Citation only | citation only |
| L9-05 | dnaX programmed frameshift (Tsuchihashi and Kornberg 1990) | not established | Gene name; the exception itself is already encoded at the b-number in the RefSeq annotation (row L9-01) | Not reported: the record carries no rights statement. Citation only | citation only |
| L9-06 | Selenocysteine at UGA in formate dehydrogenase (Zinoni et al. 1987) | not established | Gene name; the exception itself is already encoded at the b-number in the RefSeq annotation (row L9-01) | Not reported: the record carries no rights statement. Citation only | citation only |
| L9-07 | ISfinder insertion-sequence reference | not established | IS name, matching the `mobile_element_type` labels in the annotation | Undetermined for the database; the 2006 article allows non-commercial use with attribution | not retrieved |
| L6-06 | Initiation-site profiling with Onc112 and small proteins (Weaver et al. 2019) | exact | EcoCyc gene id to b-number through the `Dbxref=ECOCYC:` attribute of the pinned RefSeq GFF; positions are … | US-Government work per the article; applying that to the supplementary tables is an inference | supporting (layer 6); bring second (layer 9, small proteins) |
| L7-01 | EcoCyc (BioCyc Tier 1 curated database for E. coli K-12 MG1655) | exact | EcoCyc gene id to b-number through the pinned RefSeq GFF: all 4,651 gene and pseudogene features carry … | Affirmative grant with conditions for EcoCyc specifically: the BioCyc limited-use licence defines "Open Databases" as the EcoCyc … | bring first |
| L7-07 | The y-ome: genes lacking experimental evidence of function (Ghatak et al. 2019) | not established | Not established | Article CC BY 4.0; repository MIT | supporting |

#### L9-01: Gene-model exceptions encoded in the RefSeq annotation of the genome of record

- **Identifiers:** RefSeq GCF_000005845.2 (ASM584v2), sequence NC_000913.3, GBFF LOCUS date 02-SEP-2026; annotation_hashes.txt: features hash E21EDCE767A1C96746CC24D4C54DD401, last changed 2026-09-04 17:13:00; files GCF_000005845.2_ASM584v2_genomic.gff.gz (MD5 0f52ffc94af5ddf544ff89cc6f546b0c, matching NCBI md5checksums.txt), _genomic.gbff.gz, _cds_from_genomic.fna.gz
- **Measures:** Annotated exceptions, enumerated mechanically from the GFF and CDS FASTA: programmed frameshifts, selenocysteine codons, pseudogenes, insertion sequences, multi-product loci, non-canonical starts. **Units:** feature counts and per-locus flags.
- **Strain:** K-12 substr. MG1655. **Match to MG1655:** exact.
- **Conditions:** not applicable (annotation). **Replicates:** not applicable.
- **Identifier namespace:** b-number locus tags. **Route to b-number:** Direct.
- **Terms, verbatim:**
  - "Therefore, NCBI itself places no restrictions on the use or distribution of the data contained therein. Nor do we accept data when the submitter has requested restrictions on reuse or redistribution." (NCBI Policies and Disclaimers page, section "Molecular Data Usage"; `ncbi_policies.html`)
  - "Information that is created by or for the US government on this site is within the public domain." (NCBI Policies and Disclaimers page, section "Copyright Status of Webpages"; `ncbi_policies.html`)
  - "NOTE: This site contains resources which incorporate material contributed or licensed by individuals, companies, or organizations that may be protected by U.S. and foreign copyright laws." (same page, same section; `ncbi_policies.html`)
  - "NCBI is not in a position to assess the validity of such claims and since there is no transfer of rights from submitters to NCBI, NCBI has no rights to transfer to a third party." (same page, section "Molecular Data Usage"; `ncbi_policies.html`)
- **Strain, condition and identity evidence, verbatim:**
  - "REVIEWED REFSEQ: This record has been curated by NCBI staff. The reference sequence is identical to U00096. On Nov 3, 2013 this sequence version replaced NC_000913.2. Protein update by submitter; annotation updates are derived from EcoCyc https://ecocyc.org/." (GBFF COMMENT block of NC_000913.3; `GCF_000005845.2_ASM584v2_genomic.gbff.gz`)
  - "exception=ribosomal slippage" (GFF CDS features of dnaX (b0470), copA (b0484) and prfB (b2891); `GCF_000005845.2_ASM584v2_genomic.gff.gz`)
  - "aa:Sec)" (GFF `transl_except` attribute on fdnG (b1474), fdoG (b3894) and fdhF (b4079); `GCF_000005845.2_ASM584v2_genomic.gff.gz`)
  - "2026-09-04 17:13:00" (annotation_hashes.txt, features last changed; `refseq_annotation_hashes.txt`)
  - "&lt;CommonInputData>eRefseqGenbank&lt;/CommonInputData>" (NCBI BioProject record PRJNA57779, Link/PeerProject (member PRJNA225); `bioproject_PRJNA57779.xml`)
  - "&lt;CommonInputData>eRefseqGenbank&lt;/CommonInputData>" (NCBI BioProject record PRJNA225, Link/PeerProject (project reference PRJNA57779); `bioproject_PRJNA225.xml`)
  - ""bioproject_accession":"PRJNA225"" (NCBI Datasets v2 genome dataset report for GCF_000005845.2; `ncbi_datasets_assembly.json`)
- **Inspected:** Gene-level features 4,651, every one with a b-number, an ECOCYC cross-reference and an ECK synonym: protein_coding 4,290, pseudogene 145, ncRNA 107, tRNA 86, rRNA 22, other 1 (ssrA, the tmRNA). Programmed frameshifts (`exception=ribosomal slippage`) at 3 loci: dnaX b0470 (gamma subunit, YP_009518751.1), copA b0484 (soluble Cu(+) chaperone, YP_009518752.1), prfB b2891 (NP_417367.1). Selenocysteine (`transl_except ... aa:Sec`) at 3 loci, each with one in-frame TGA: fdnG b1474 and fdoG b3894 at codon 196, fdhF b4079 at codon 140 (1-based, from the CDS FASTA). No other CDS has an in-frame stop. 9 loci carry more than one CDS product under one b-number: mrcB b0149, dnaX b0470, copA b0484, cobB b1120, cheA b1888, clpB b2592, infB b3168 (three products), mcrB b4346, yibX b4795. 20 CDS are split across intervals (3 by slippage, 17 pseudogene fragments); 37 CDS rows are flagged pseudo; 18 CDS records have no protein. Start codons of the 4,300 translated CDS: ATG 3,876, GTG 338, TTG 80, ATT 4 (pcnB b0143, infC b1718, ymcF b4723, ynfQ b4724), CTG 2 (hda b2496, yfjD b4461). Stop codons: TAA 2,753, TGA 1,242, TAG 305. 50 insertion-sequence features (`mobile_genetic_element`) and 48 `sequence_feature` rows: 12 cryptic prophages and 36 gene fragments. File checksums: section 6.2.
- **Without an account:** Yes (NCBI FTP)
- **Limitations:** These are the flags the annotation encodes; a recoding tool also needs what it does not encode: overlapping genes, small proteins outside the annotation, and regulatory sequence inside coding regions (layers 2 to 4). BioProject, settled: the GBFF DBLINK names PRJNA57779 and NCBI Datasets reports PRJNA225 for the assembly. Each BioProject record links the other as a peer project with common input data `eRefseqGenbank`: PRJNA57779 ("Escherichia coli str. K-12 substr. MG1655 RefSeq Genome") is the RefSeq project and PRJNA225 ("Model organism for genetics, physiology, biochemistry") the GenBank project of the same assembly. They are two provenance records, not competing identities.
- **Licence standing (a characterisation, not a decision):** Candidate reproducibility input; the retention basis for this genome is an owner ledger decision still to be made. The ledger's RefSeq rule has two layers: a PGAP annotation "created by or for the US government" (public domain), and submitted assembly bytes under NCBI's data usage policies. Neither covers this annotation as written. The record's COMMENT says "annotation updates are derived from EcoCyc" and its latest direct submission is from the EcoCyc project; that it is not PGAP output is an inference from the record, not a quoted statement. NCBI's policy page separates information "created by or for the US government" from "material contributed or licensed by individuals, companies, or organizations", and says that with no transfer of rights from submitters "NCBI has no rights to transfer to a third party". The only grant text read that names EcoCyc content is EcoCyc's own licence (row L7-01); whether it reaches the copy inside the RefSeq record was not established. Public retrieval, an accession and a checksum are not permission. The existing practice (retain as a reproducibility input under a checksum pin, never offer as a product download) is what stream 2 currently follows; this row does not validate or invalidate it.
- **Recommendation:** bring first; recommend admit with caveat. Every exception the handoff names is already present, per b-number, in the pinned input. The pipeline can derive the flags and the contract validator can re-derive them independently. The caveat is the licence basis, not the content.

#### L9-02: Recode-2 database of programmed recoding events

- **Identifiers:** PMID 19783826; PMCID PMC2808893; DOI 10.1093/nar/gkp788; site https://recode.ucc.ie
- **Measures:** Curated programmed frameshifting, readthrough and bypassing events; about 1,500 genes at publication. **Units:** categorical.
- **Strain:** multi-organism. **Match to MG1655:** not established.
- **Conditions:** not applicable. **Replicates:** not applicable.
- **Identifier namespace:** not inspected. **Route to b-number:** Not established.
- **Terms, verbatim:**
  - "This is an Open Access article distributed under the terms of the Creative Commons Attribution Non-Commercial License ( http://creativecommons.org/licenses/by-nc/2.0/uk/ ) which permits unrestricted non-commercial use, distribution, and reproduction in any medium, provided the original work is properly cited." (PMC2808893 Europe PMC fullTextXML, &lt;permissions>/&lt;license>; `epmc_ft_recode2.xml`)
- **Strain, condition and identity evidence, verbatim:**
  - "At present, the Recode-2 database stores information on approximately 1500 genes that are known to utilize recoding in their expression" (PMC2808893 full text; `epmc_ft_recode2.xml`)
  - "The recode.ucc.ie website is no longer hosted here." (https://recode.ucc.ie front page notice; `recode_front.html`)
- **Inspected:** The site now shows a notice that it is no longer hosted and offers a legacy database download; the download was not taken and no terms accompany it on the page.
- **Without an account:** Legacy download offered without an account; not taken
- **Limitations:** Retired service; 2009 content.
- **Licence standing (a characterisation, not a decision):** Article CC BY-NC (2.0 UK); legacy database file terms not reported.
- **Recommendation:** not recommended; recommend reject. Retired, and the three E. coli K-12 frameshifts it would supply are already in the annotation.

#### L9-03: Programmed frameshift in copA (Meydan et al. 2017)

- **Identifiers:** PMID 28107647; PMCID PMC5270581; DOI 10.1016/j.molcel.2016.12.008
- **Measures:** Experimental demonstration that ribosomal frameshifting in copA yields a short copper chaperone as well as the transporter. **Units:** not applicable.
- **Strain:** not extracted. **Match to MG1655:** not established.
- **Conditions:** not extracted. **Replicates:** not applicable.
- **Identifier namespace:** gene name. **Route to b-number:** Gene name; encoded at b0484 in the annotation (row L9-01).
- **Terms, verbatim:**
  - "This file is available for text mining. It may also be used consistent with the principles of fair use under the copyright law." (PMC5270581 NCBI efetch db=pmc, &lt;permissions>/&lt;license>; `ncbi_pmc_meydan2017.xml`)
- **Strain, condition and identity evidence, verbatim:**
  - "The high efficiency of frameshifting is achieved by the combined stimulatory action of a ‘slippery’ sequence, an mRNA pseudoknot, and the CopA nascent chain." (PMC5270581 author manuscript, Summary; `ncbi_pmc_meydan2017.xml`)
- **Inspected:** Author manuscript read via NCBI efetch.
- **Without an account:** Yes
- **Limitations:** Citation only.
- **Licence standing (a characterisation, not a decision):** No grant (text-mining notice only). Citation only.
- **Recommendation:** citation only; recommend admit with caveat (as a citation, not as data). Names the sequence features (slippery sequence, mRNA pseudoknot, nascent chain) that a recoding of copA would have to preserve.

#### L9-04: prfB programmed frameshift (Craigen et al. 1985)

- **Identifiers:** PMID 3889910; PMCID PMC397836; DOI 10.1073/pnas.82.11.3616
- **Measures:** Primary report behind the prfB gene-model exception. **Units:** not applicable.
- **Strain:** not retrieved (scanned article). **Match to MG1655:** not established.
- **Conditions:** not retrieved. **Replicates:** not retrieved.
- **Identifier namespace:** gene name. **Route to b-number:** Gene name; the exception itself is already encoded at the b-number in the RefSeq annotation (row L9-01).
- **Terms, verbatim:**
  - (no rights text in the record: not reported) (PMC397836: no &lt;permissions> element in the retrieved XML (read and silent: not reported); `ncbi_pmc_craigen1985.xml`)
- **Strain, condition and identity evidence, verbatim:**
  - "Bacterial peptide chain release factors: conserved primary structure and possible frameshift regulation of release factor 2" (PMC397836 NCBI efetch record, article title; `ncbi_pmc_craigen1985.xml`)
- **Inspected:** Only front matter is available as text (the PMC deposit is a page scan); no &lt;permissions> element in the record.
- **Without an account:** Front matter yes; body not retrieved as text
- **Limitations:** Background citation only; nothing to ingest.
- **Licence standing (a characterisation, not a decision):** Not reported: the record carries no rights statement. Citation only.
- **Recommendation:** citation only; insufficient evidence. Names the primary evidence for a flag the annotation already carries.

#### L9-05: dnaX programmed frameshift (Tsuchihashi and Kornberg 1990)

- **Identifiers:** PMID 2181440; PMCID PMC53720; DOI 10.1073/pnas.87.7.2516
- **Measures:** Primary report behind the dnaX gene-model exception. **Units:** not applicable.
- **Strain:** not retrieved (scanned article). **Match to MG1655:** not established.
- **Conditions:** not retrieved. **Replicates:** not retrieved.
- **Identifier namespace:** gene name. **Route to b-number:** Gene name; the exception itself is already encoded at the b-number in the RefSeq annotation (row L9-01).
- **Terms, verbatim:**
  - (no rights text in the record: not reported) (PMC53720: no &lt;permissions> element in the retrieved XML (read and silent: not reported); `ncbi_pmc_tsuchihashi1990.xml`)
- **Strain, condition and identity evidence, verbatim:**
  - "Translational frameshifting generates the gamma subunit of DNA polymerase III holoenzyme" (PMC53720 NCBI efetch record, article title; `ncbi_pmc_tsuchihashi1990.xml`)
- **Inspected:** Only front matter is available as text (the PMC deposit is a page scan); no &lt;permissions> element in the record.
- **Without an account:** Front matter yes; body not retrieved as text
- **Limitations:** Background citation only; nothing to ingest.
- **Licence standing (a characterisation, not a decision):** Not reported: the record carries no rights statement. Citation only.
- **Recommendation:** citation only; insufficient evidence. Names the primary evidence for a flag the annotation already carries.

#### L9-06: Selenocysteine at UGA in formate dehydrogenase (Zinoni et al. 1987)

- **Identifiers:** PMID 3033637; PMCID PMC304827; DOI 10.1073/pnas.84.10.3156
- **Measures:** Primary report behind the fdhF gene-model exception. **Units:** not applicable.
- **Strain:** not retrieved (scanned article). **Match to MG1655:** not established.
- **Conditions:** not retrieved. **Replicates:** not retrieved.
- **Identifier namespace:** gene name. **Route to b-number:** Gene name; the exception itself is already encoded at the b-number in the RefSeq annotation (row L9-01).
- **Terms, verbatim:**
  - (no rights text in the record: not reported) (PMC304827: no &lt;permissions> element in the retrieved XML (read and silent: not reported); `ncbi_pmc_zinoni1987.xml`)
- **Strain, condition and identity evidence, verbatim:**
  - "Cotranslational insertion of selenocysteine into formate dehydrogenase from Escherichia coli directed by a UGA codon" (PMC304827 NCBI efetch record, article title; `ncbi_pmc_zinoni1987.xml`)
- **Inspected:** Only front matter is available as text (the PMC deposit is a page scan); no &lt;permissions> element in the record.
- **Without an account:** Front matter yes; body not retrieved as text
- **Limitations:** Background citation only; nothing to ingest.
- **Licence standing (a characterisation, not a decision):** Not reported: the record carries no rights statement. Citation only.
- **Recommendation:** citation only; insufficient evidence. Names the primary evidence for a flag the annotation already carries.

#### L9-07: ISfinder insertion-sequence reference

- **Identifiers:** PMID 16381877; PMCID PMC1347377; DOI 10.1093/nar/gkj014; site https://isfinder.biotoul.fr
- **Measures:** Reference nomenclature and sequences for bacterial insertion sequences. **Units:** not applicable.
- **Strain:** multi-organism. **Match to MG1655:** not established.
- **Conditions:** not applicable. **Replicates:** not applicable.
- **Identifier namespace:** IS names. **Route to b-number:** IS name, matching the `mobile_element_type` labels in the annotation.
- **Terms, verbatim:**
  - "The online version of this article has been published under an open access model. Users are entitled to use, reproduce, disseminate, or display the open access version of this article for non-commercial purposes provided that: the original authorship is properly and fully attributed; the Journal and Oxford University Press are attributed as the original place of publication with the correct citation details given; if an articl" (PMC1347377 Europe PMC fullTextXML, &lt;permissions>/&lt;license>; `epmc_ft_isfinder.xml`)
- **Inspected:** https://isfinder.biotoul.fr did not resolve from this host on two attempts (curl exit 6): site and its terms not retrieved.
- **Without an account:** Not retrieved
- **Limitations:** Site not read.
- **Licence standing (a characterisation, not a decision):** Undetermined for the database; the 2006 article allows non-commercial use with attribution.
- **Recommendation:** not retrieved; insufficient evidence. Only needed if IS boundaries are to be checked beyond the 50 annotated elements.

## 4. Cross-cutting findings

### 4.1 Strain of measurement

Much of the richest E. coli data was not measured in MG1655. The 22-condition series of the reference proteome (Schmidt 2016), both knockout-based essentiality sets, the TraDIS call of Goodall 2018, RB-TnSeq and the chemical-genomic screen are BW25113; the condition series of Mori 2021 is NCM3722; one operon study is BW38028. MG1655 itself is measured in Choe 2022 (essentiality, L5-14), in the Mori 2021 calibration samples (sub-strain EQ353, L6-03b), in Zhao 2019 (L6-10) and in Schmidt 2016 Table S9 (L6-01). The data contract's sister-strain rule names cyanobacterial strains only, so there is no recorded rule yet for carrying a BW25113 or NCM3722 value onto an MG1655 gene.

"Measured in MG1655" names a strain, not one isolate. Genotype statements read: BW25113 is "F-, Δ(araD-araB)567, ΔlacZ4787(∷rrnB-3), λ-, rph-1, Δ(rhaD-rhaB)568, hsdR514" (Schmidt 2016, quoted in row L6-01); the MG1655 isolate used by Gerdes 2003 is "F − λ − ilvG rfb-50 rph-1" (row L5-04); Mori 2021 uses two MG1655 stocks, EQ353 (described as wild type with a wild-type flhDC promoter, no genotype string given) and CGSC#6300, and treats them as different sub-strains (row L6-03b). Whether a sub-strain or substrain difference matters for a given layer is a lab judgement and is not made here.

### 4.2 Reference sequence versions

Positional sources were mapped to different versions of the MG1655 sequence. A coordinate on `NC_000913.2` or `U00096.2` is not a coordinate on the genome of record, and no conversion table was found; Adams 2021 describes converting earlier datasets by anchoring on 60 nt of upstream sequence (row L3-03).

| Version stated | Sources |
| --- | --- |
| `NC_000913.3` or `U00096.3` | Yan 2018 (L2-04), Adams 2021 (L3-03), Ju 2019 (L3-04), Lalanne 2018 (L3-06), Weaver 2019 (L6-06), Wang 2018 library design (L5-06), Choe 2022 (L5-14), Wellner 2024 (L5-15), proChIPdb MG1655 entries (L4-03), iML1515 (L7-06); Zhao 2019 searched the protein set of `GCF_000005845.2` (L6-10) |
| `NC_000913.2` or `U00096.2` | Thomason 2015 (L2-01), Ettwiller 2016 (L2-02), Conway 2014 (L3-02), Mohammad 2019 (L6-05), Rousset 2018 guide design (L5-05) |
| `NC_000913`, version not stated | Kim 2012 (L2-03), Cho 2014 (L4-02) |
| Not stated in the file | RegulonDB files (L2-05, L3-01, L4-01) |
| Stated inconsistently | Masoura 2021 (L5-16): cites `CP009273` for "the MG1655 genome"; NCBI lists that accession as BW25113 |

### 4.3 Routes to `b`-number locus tags

Named, not performed.

| From | Documented route |
| --- | --- |
| `b`-number column present | PRECISE-1K, Kim 2012, Yan 2018, Cho 2014 file S8, Baba 2006, Yamamoto 2009, Choe 2022 Table S1, Wellner 2024 Table S3, Mori 2021 EV6, EV8 and EV9, Zhao 2019 Table S3, Schmidt 2016 Table S6 (BW25113 values), COG 2024 (locus_tag with assembly id), UniProtKB ordered locus name |
| UniProt accession only | Schmidt 2016 Table S9 (the MG1655 values); Mori 2021 records with an empty locus cell: through the UniProtKB ordered locus name |
| EcoCyc gene id (`EG…`, `G…`) | `Dbxref=ECOCYC:<id>` on all 4,651 gene and pseudogene features of the pinned RefSeq GFF |
| EcoCyc protein frame id (GO `ecocyc.gaf`) | UniProtKB cross-reference `EcoCyc:<frame>` beside the ordered locus name |
| RegulonDB gene name | RegulonDB `GeneProductSet` (columns `geneName`, `bnumber`) |
| KEGG gene id | `eco:b####` by construction, as listed in UniProtKB |
| Gene symbol only | Rousset 2018, Conway 2014, Masoura 2021: a name join whose ambiguous and unmatched rows must be reported. Dar 2018 uses `BW25113_####` locus tags and names |
| Coordinates only | Ettwiller 2016, Thomason 2015, Adams 2021, ChIP regions: positional assignment after the sequence version is settled |

### 4.4 Sources whose terms restrict reuse

- **EcoCyc and BioCyc.** The BioCyc data licence names EcoCyc an "Open Database" that may be used, modified and redistributed for any purpose under attribution and notification conditions. The licence names one other Open Database, the PGDB for Faecalibacterium prausnitzii A2-165; every remaining BioCyc database is a "Limited Database" that may be used and modified but not redistributed. The BioCyc site itself states that a subscription is required for ongoing access, and this repository's 2026-10-02 probe found that it meters anonymous page views. Without an account on 2026-10-05: the terms pages, the download and licence pages, one EcoCyc gene page and one web-service response were served. Not reachable without an owner action: the EcoCyc flat files, which SRI releases by email after its licence form is submitted and reviewed. No account was created and the form was not submitted.
- **RegulonDB.** Every dataset file is served without an account by a public GraphQL endpoint, each with a licence header pointing to an end-user licence that forbids distribution, derivative works and integration into another databank without written consent from CCG-UNAM, and that lasts one year. Readable and downloadable for calibration; not redistributable as it stands. The Zenodo record cited by the RegulonDB 11.0 article (`10.5281/zenodo.6376425`, licence cc-by-4.0) holds one file, a software descriptor, and is not a grant over the datasets.
- **KEGG.** Copyright Kanehisa Laboratories. Academic users may use the website and the REST API; bulk download and any service built on KEGG data need the paid FTP subscription. No redistribution grant.
- **Others met.** GtRNAdb and PEC publish no terms on the pages read. BiGG states it is "freely available for non-commercial use". DEG shows a copyright footer only. proChIPdb states no terms on its site; its Zenodo deposits are CC BY 4.0. The Fitness Browser, pax-db.org downloads and isfinder.biotoul.fr could not be read (section 9).

### 4.5 Licence situations the ledger's rules do not yet cover

The ledger's evidence-based rules name CC BY, CC BY-NC-ND, all rights reserved, text-mining notices, PRIDE CC0 and "EBI terms of use". These further situations arose and need a ledger rule before any of their rows can be decided:

- **An article licence relied on for a publisher-hosted supplementary file that has no legend of its own.** This is the commonest situation in the dossier: Kim 2012, Yan 2018, Rousset 2018, Adams 2021, Conway 2014, Mori 2021 and its correction, Zhao 2019, Wellner 2024, Masoura 2021, and the unread tables of Soufi 2015, Iosub 2020 and Wang 2018. The ledger's article-licence rule is written for a GEO deposit, and its two file-level precedents (Adomako 2022 Data Set S1; PXD005851 Table S1) rest on a legend. The first pass wrote these rows as affirmative grants; they are now marked "inferred". No publisher policy page was fetched to look for a statement on supplementary files (section 9), and nothing here says reuse is prohibited.
- An explicit CC0 data clause inside the article licence (Cho 2014, Ettwiller 2016): "The Creative Commons Public Domain Dedication waiver … applies to the data made available in this article, unless otherwise stated." Stronger evidence than an article licence alone.

- CC BY-NC and CC BY-NC-SA articles (PRECISE-1K's article, Conway 2014, Dar 2018, Yamamoto 2009, Wetmore 2015, the RegulonDB v12.0 article). The owner's 2026-10-05 note covers attribution and non-commercial use; share-alike on a derived table is an extra condition.
- A repository licence over data files (MIT on SBRG/precise1k), which the roadmap already used once for the cyanobacterial iModulon repository.
- A per-file CC BY legend on a supplementary table (Goodall 2018 Table S1; Choe 2022 Table S1), the Adomako 2022 pattern.
- Works of the US Government (Weaver 2019, the COG 2024 article) and a CC0 article (Adams 2021).
- Publisher author-manuscript terms in PMC (Schmidt 2016, Ju 2019): academic viewing, copying, downloading and text and data-mining; not a redistribution grant.
- A database licence with conditions (EcoCyc): attribution sentence, BioCyc logo, a link, and notifying SRI of the distribution.
- A record with no rights text at all (three PNAS scans, Baba 2006's XML): read and silent.

### 4.6 Observations for the coordinator

- **RefSeq annotation provenance.** The record says "annotation updates are derived from EcoCyc" and lists a 2024 direct submission from the EcoCyc project; that it is not PGAP output is an inference from that record. The ledger's RefSeq rule rests on PGAP being a US-government work and on NCBI's data usage policy for submitted bytes; NCBI's policy page separates government-created information from contributed material and says NCBI has no rights to transfer over submitter data. The retention basis for this genome is an owner ledger decision still to be made (rows L8-01, L9-01).
- **BioProjects, settled.** PRJNA57779 (in the GBFF) and PRJNA225 (in the ticket and NCBI Datasets) are the RefSeq and GenBank peer projects of the same assembly: each BioProject record links the other with common input data `eRefseqGenbank` (row L9-01).
- **tRNA count, located not reconciled.** GtRNAdb predicts 89 tRNAs on the paired GenBank assembly (86 standard, 1 selenocysteine, 1 undetermined, 1 pseudogene) against 86 annotated tRNA genes (85 standard, 1 selenocysteine). Class by class the only standard difference is Thr(CGT): 2 in GtRNAdb, 1 in the annotation. No locus or sequence matching was done (row L8-02).
- Ettwiller 2016 gives its TSS count as 16539 in the abstract and 16359 in the text; the deposited file has 16,359 rows.
- Europe PMC's licence label and the deposited XML disagree for Hawkins 2020 (label cc by-nc-nd; deposit carries a text-mining notice only). The label alone should not be taken as the licence.
- Europe PMC `supplementaryFiles` returned an incomplete bundle for Goodall 2018 (no Table S1) and stalled past 280 s for three large bundles. A stalled bundle can still hold complete members: twelve of the Mori 2021 supplementary files are complete in the partial archive (length and CRC-32 checked per member), and four were read from it.
- Mori 2021's per-gene tables were corrected in 2024. PMC records an MD5 for each supplementary file in the correction's XML, which gave an independent check on the files downloaded from the publisher.
- Masoura 2021 cites accession `CP009273` for "the MG1655 genome"; NCBI lists `CP009273.1` as Escherichia coli BW25113 (row L5-16).

## 5. Key extracted values

Each value is located in the named row, with its quotation or inspection note.

| Value | Row |
| --- | --- |
| PRECISE-1K: 1,035 samples by 4,257 genes, log2[TPM] as labelled; 582 samples labelled MG1655 | L1-01 |
| PRECISE 1.0: final compendium log2(TPM + 1) per the article's Methods | L1-02 |
| Ettwiller 2016: 16,359 TSS records, M9 glucose, two replicates, `U00096.2` | L2-02 |
| Thomason 2015: 14,868 TSS candidates, three conditions, two replicates, `NC_000913.2` | L2-01 |
| Kim 2012: 3,746 TSS records, 2,644 distinct `b`-numbers | L2-03 |
| Yan 2018: 3,070 operon records naming 2,665 distinct member genes; 408 and 455 termination-site records | L2-04 |
| RegulonDB 14.5: 4,057 promoters (77 Confirmed, 1,271 Strong, 2,670 Weak, 39 unset); 3,767 transcription units; 2,605 operons; 375 terminators; 6,460 regulatory interactions; 2,597 sigma-gene pairs | L2-05, L3-01, L4-01 |
| Adams 2021: 1,175, 882 and 1,053 records of 3' ends in three conditions | L3-03 |
| Cho 2014: binding records RNAP 2,129, RpoD 1,643, RpoS 903, RpoH 312, RpoN 180, FliA 51; 4,724 TSS records | L4-02 |
| proChIPdb: 65 E. coli entries, 62 in K-12 MG1655 on `NC_000913.3` | L4-03 |
| Choe 2022 (MG1655): 4,498 genes; LB 523 essential, 3,975 non-essential; M9 glucose 654 and 3,844 | L5-14 |
| Keio: 303 essential candidates. TraDIS (BW25113): 358 essential, 162 unclear, 3,793 non-essential. Gerdes 2003: 620 essential, 3,126 dispensable. PEC: 302 essential | L5-01, L5-03, L5-04, L5-09 |
| Rousset 2018: 4,213 gene records, 59,246 guide records | L5-05 |
| Mori 2021, MG1655 EQ353: 3 biological cultures, 7 MS runs; 4,342 table records, 2,077 non-zero in at least one run, 1,723 in all seven | L6-03b |
| Mori 2021, NCM3722 series: 2,335 proteins from 66 samples per the article | L6-03a |
| Zhao 2019 (MG1655): 1,571 protein records, two biological replicates | L6-10 |
| Schmidt 2016: more than 2,300 proteins, 22 conditions in BW25113 (2,359 records, 2,285 `b`-numbers in Table S6); MG1655 in LB and glucose in Table S9 (2,038 records) | L6-01 |
| UniProtKB release 2026_03: 4,403 reviewed entries in proteome UP000000625 | L7-02 |
| GO `ecocyc.gaf`: 55,158 records, of which IEA 20,144, IDA 12,044, IBA 7,325 | L7-03 |
| Annotation of record: 4,290 protein-coding, 145 pseudogenes, 107 ncRNA, 86 tRNA, 22 rRNA; 3 programmed frameshifts; 3 selenocysteine genes; 9 multi-product loci; 6 non-NTG starts; 50 insertion sequences | L8-01, L9-01 |

## 6. Retrieval manifest

### 6.1 Files quoted

Every file quoted above. Times are UTC on the retrieval date; the SHA-256 is of the bytes received. Files were held in a scratch directory outside the repository and are not part of this deliverable. A quotation was accepted only after a script found it again in the retrieved file: against the text with tags replaced by a space, entities unescaped and whitespace collapsed for HTML and XML, or against the raw bytes for JSON, TSV and GFF records. A `.docx` supplement is matched through the text of its `word/document.xml` (field-code elements dropped, tags stripped) and an `.xlsx` through its text cells; the location names the sheet and cell. A file taken out of a supplement bundle is listed as a member of that bundle, with the member's own SHA-256 and the bundle's retrieval time. RegulonDB files come from a POST request, shown in full; the response body is JSON, in which tabs and newlines of the data file appear as `\t` and `\n`. In this Markdown file a `<` inside a quotation or location is written as `&lt;` so that it renders; the TSV carries the plain character.

| File key | Address | Retrieved (UTC) | Bytes | SHA-256 |
| --- | --- | --- | --- | --- |
| `GCF_000005845.2_ASM584v2_genomic.gbff.gz` | https://ftp.ncbi.nlm.nih.gov/genomes/all/GCF/000/005/845/GCF_000005845.2_ASM584v2/GCF_000005845.2_ASM584v2_genomic.gbff.gz | 2026-10-05T16:21:59Z | 3401424 | `cbcc40a9859312cbcdbeb3df484ee471dfe354c5cd8f28056b48431353b28384` |
| `GCF_000005845.2_ASM584v2_genomic.gff.gz` | https://ftp.ncbi.nlm.nih.gov/genomes/all/GCF/000/005/845/GCF_000005845.2_ASM584v2/GCF_000005845.2_ASM584v2_genomic.gff.gz | 2026-10-05T16:21:59Z | 387627 | `afdf03dc1d06e423d874ee29d9e0df14f5d32baf893f4da9f93aa721eb5f495e` |
| `bigg_license.html` | https://bigg.ucsd.edu/license | 2026-10-05T16:32:04Z | 15254 | `9b8969e8f0bc35734f90d815fcb34c107dfa89462214ee228b91ad87e5df3f8b` |
| `biocyc_download.html` | https://biocyc.org/download.shtml | 2026-10-05T16:12:36Z | 60868 | `f2095f407ec0bef8c0bbb3073c09ea9af7ed9c46d390e64ef6bd2cc52be79b47` |
| `biocyc_subscription_terms.txt` | https://biocyc.org/subscription-terms.txt | 2026-10-05T16:12:50Z | 16517 | `a8c452ef7a2cf9af8bde9c0261942429d643a70fb2c62a81c74ab95e37782250` |
| `biocyc_websvc_probe.xml` | https://websvc.biocyc.org/getxml?id=ECOLI:EG10001&detail=low | 2026-10-05T16:46:58Z | 935 | `615fdc364cd0f19c6ddca5ee9403986b382f302a6b3560251cdb0bbdc2aa3b96` |
| `bioproject_PRJNA225.xml` | https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=bioproject&id=225&retmode=xml | 2026-10-05T18:05:07Z | 20037 | `c83eaa529dd8b67f6cfb6511f863bcdae0de4cb10a2355da059aecb3863d85f9` |
| `bioproject_PRJNA57779.xml` | https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=bioproject&id=57779&retmode=xml | 2026-10-05T18:05:08Z | 20278 | `619ca87686b18260124a24c61a60b1bbfaab4fe620ea347d6dafc26849839706` |
| `choe2022_TextS1.docx` | member msystems.00896-22-s0001.docx of the bundle https://www.ebi.ac.uk/europepmc/webservices/rest/PMC9948719/supplementaryFiles | 2026-10-05T18:09:30Z | 74492 | `ec48d356af729c99bc7b994d6e0996520eb299e22ff6e866da8018ad54675120` |
| `cog2024_org.csv` | https://ftp.ncbi.nlm.nih.gov/pub/COG/COG2024/data/cog-24.org.csv | 2026-10-05T16:46:58Z | 163215 | `6b0ba840c276a73c82a6abd0ef48b818c6301fad60c3b43dc6947646391f9080` |
| `cog2024_readme.txt` | https://ftp.ncbi.nlm.nih.gov/pub/COG/COG2024/data/Readme.COG2024.txt | 2026-10-05T16:46:58Z | 6443 | `0de9f45b80dfa84338dfd5e07d34292f1bf463d328519432f9bddbb913ccb86e` |
| `deg_front.html` | https://tubic.org/deg/public/index.php | 2026-10-05T16:32:03Z | 45297 | `3ae8f9da0fde4f282da5bf7e795f4adee6eadde7987d68f10e802874803a7185` |
| `ebi_terms.html` | https://www.ebi.ac.uk/about/terms-of-use/ | 2026-10-05T16:32:03Z | 30152 | `f3c148e6b91501af2a516e24edf0be61c21e2ce1b4e9f40bd834c606f1f23ae9` |
| `ena_PRJEB22130_runs.tsv` | https://www.ebi.ac.uk/ena/portal/api/filereport?accession=PRJEB22130&result=read_run&fields=run_accession,sample_accession,sample_title,library_strategy,library_source,scientific_name,read_count,base_count,first_public | 2026-10-05T18:08:45Z | 2240 | `c2877adbe7edb429f43eed491ce3659c0c5a299d6f0f8d192dc3a9618f734baf` |
| `epmc_ft_adams2021.xml` | https://www.ebi.ac.uk/europepmc/webservices/rest/PMC7815308/fullTextXML | 2026-10-05T16:18:07Z | 327728 | `4c52440e0946d9507391a5f327b2af43858ccdba77009b2b7c97f8203d8ba639` |
| `epmc_ft_baba2006.xml` | https://www.ebi.ac.uk/europepmc/webservices/rest/PMC1681482/fullTextXML | 2026-10-05T16:18:40Z | 146503 | `1a28ad71f0a5457ea9492895c2476ff1308b1059f0232085bbedc1d41f880d26` |
| `epmc_ft_cho2014.xml` | https://www.ebi.ac.uk/europepmc/webservices/rest/PMC3923258/fullTextXML | 2026-10-05T16:18:19Z | 91630 | `bab0090e90fb28e20fb106d584e84d2a1114060cf968dfdd8a4852a7e177c54a` |
| `epmc_ft_choe2022.xml` | https://www.ebi.ac.uk/europepmc/webservices/rest/PMC9948719/fullTextXML | 2026-10-05T18:05:10Z | 85500 | `4bce9d2044f327f1a6de60164917cf23839b6ada4faa1949ebe193a3c5253676` |
| `epmc_ft_conway2014.xml` | https://www.ebi.ac.uk/europepmc/webservices/rest/PMC4161252/fullTextXML | 2026-10-05T16:18:04Z | 172829 | `c93bf37d57239fc65bce458fc23aaadca0e450136208dade8b91ca83ec239b98` |
| `epmc_ft_dar2018.xml` | https://www.ebi.ac.uk/europepmc/webservices/rest/PMC6061677/fullTextXML | 2026-10-05T16:18:08Z | 79813 | `d5585152cd135ed28525ccdaad35a51128674aeb27ef82a97b7cb364376e66b3` |
| `epmc_ft_ettwiller2016.xml` | https://www.ebi.ac.uk/europepmc/webservices/rest/PMC4782308/fullTextXML | 2026-10-05T16:17:50Z | 101229 | `4219b4608fa3082b8f9070419497463c680c32bcda9b2232f133642a49e97668` |
| `epmc_ft_goodall2018.xml` | https://www.ebi.ac.uk/europepmc/webservices/rest/PMC5821084/fullTextXML | 2026-10-05T16:18:43Z | 189926 | `2c3bcdcb32856048e5f738c2304c7264223f951bfe2fb92c77befdc6698628de` |
| `epmc_ft_gtrnadb2016.xml` | https://www.ebi.ac.uk/europepmc/webservices/rest/PMC4702915/fullTextXML | 2026-10-05T16:20:31Z | 51559 | `4ee5ee1d1b497e3057d8fecb8ee9bb9d87e1bb1c41d28cc2a530fec2cb8fe1ab` |
| `epmc_ft_imodulondb2.xml` | https://www.ebi.ac.uk/europepmc/webservices/rest/PMC11701608/fullTextXML | 2026-10-05T16:17:27Z | 77188 | `a62d13d363bc8420507acf09fbecbc3fb2bac2b722ed9074b1016772260996d4` |
| `epmc_ft_iosub2020.xml` | https://www.ebi.ac.uk/europepmc/webservices/rest/PMC7213987/fullTextXML | 2026-10-05T16:18:35Z | 368976 | `0e305633ff0b76a596784989b4c50c1135771c76d62b1a028ad0ed754531aa7b` |
| `epmc_ft_isfinder.xml` | https://www.ebi.ac.uk/europepmc/webservices/rest/PMC1347377/fullTextXML | 2026-10-05T16:21:15Z | 29843 | `0365133b257147bf26021284a75acdee5527000bcc0f0f2a690fedbc37814803` |
| `epmc_ft_kim2012.xml` | https://www.ebi.ac.uk/europepmc/webservices/rest/PMC3415461/fullTextXML | 2026-10-05T16:17:51Z | 186803 | `37aabbd33b2d4179d9bb1d7b65955e44c817a20ade9ea49fff08e72d2345f48b` |
| `epmc_ft_masoura2021.xml` | https://www.ebi.ac.uk/europepmc/webservices/rest/PMC8803141/fullTextXML | 2026-10-05T18:17:06Z | 178196 | `eb7e670396b001ea99bf1c09b41328a48327f86445a48b321fe594a749db925b` |
| `epmc_ft_melamed2016.xml` | https://www.ebi.ac.uk/europepmc/webservices/rest/PMC5145812/fullTextXML | 2026-10-05T16:18:24Z | 148840 | `926400683af402c682e70e8037674cc01192b36ed8f99e013ac8c3b70a461ed6` |
| `epmc_ft_modomics2025.xml` | https://www.ebi.ac.uk/europepmc/webservices/rest/PMC12807697/fullTextXML | 2026-10-05T16:20:33Z | 72396 | `1e631fcf446fee746826ef625784081eae34d704d9dfbf35c21963671c04b8b5` |
| `epmc_ft_mohammad2019.xml` | https://www.ebi.ac.uk/europepmc/webservices/rest/PMC6377232/fullTextXML | 2026-10-05T16:19:30Z | 214835 | `ffc8582aaf5e22daa80f4fb60ea5973497195c5414933af7dcc61c8857cbd629` |
| `epmc_ft_mori2021.xml` | https://www.ebi.ac.uk/europepmc/webservices/rest/PMC8144880/fullTextXML | 2026-10-05T16:19:27Z | 269226 | `cf14e8df4b70c92b288e1731e36841b37d37a5b7e59d79d1363ea72eb1db625a` |
| `epmc_ft_mori_correction.xml` | https://www.ebi.ac.uk/europepmc/webservices/rest/PMC11535196/fullTextXML | 2026-10-05T18:05:07Z | 24161 | `7cce4ffae01685cf846f4e8c6c5728a8b0ba8d5d1d79d4decf9fd2b8d40d9214` |
| `epmc_ft_paxdb5.xml` | https://www.ebi.ac.uk/europepmc/webservices/rest/PMC10551891/fullTextXML | 2026-10-05T16:19:29Z | 130028 | `2adbce3474cea113b02f7365565b9681eb2217dee860058a8153b1e81b839b5d` |
| `epmc_ft_precise1.xml` | https://www.ebi.ac.uk/europepmc/webservices/rest/PMC6892915/fullTextXML | 2026-10-05T16:17:25Z | 188979 | `e9ba5778a2a7aa5200322f5c604f040a1e9cb0e59bc9e3c67680675a897aa734` |
| `epmc_ft_precise1k.xml` | https://www.ebi.ac.uk/europepmc/webservices/rest/PMC10602906/fullTextXML | 2026-10-05T16:17:23Z | 181849 | `3840943edcf504d67cfe2a2c49b9706892523c634de946007f45d1944cc40d65` |
| `epmc_ft_prochipdb.xml` | https://www.ebi.ac.uk/europepmc/webservices/rest/PMC8728212/fullTextXML | 2026-10-05T16:18:22Z | 99076 | `875f31948974c6164a09cdf3bea58e621f08b496f5bf91243e0092e26d777e2b` |
| `epmc_ft_prochipdb_correction.xml` | https://www.ebi.ac.uk/europepmc/webservices/rest/PMC12309368/fullTextXML | 2026-10-05T18:05:12Z | 4657 | `d389f132ece964290365e6ee27f94539bd936828c13039291f2aac8aaed049e0` |
| `epmc_ft_recode2.xml` | https://www.ebi.ac.uk/europepmc/webservices/rest/PMC2808893/fullTextXML | 2026-10-05T16:20:54Z | 81509 | `37b54d0743966fa131e606af64cedc7013c70c96aa33d7f881ce98028c468885` |
| `epmc_ft_rousset2018.xml` | https://www.ebi.ac.uk/europepmc/webservices/rest/PMC6242692/fullTextXML | 2026-10-05T16:18:54Z | 244572 | `9056cd19960c1703c85c04c89b4d59c8d70551366934a9dbfda8e387cd966e61` |
| `epmc_ft_sabi2014.xml` | https://www.ebi.ac.uk/europepmc/webservices/rest/PMC4195497/fullTextXML | 2026-10-05T16:20:52Z | 149191 | `32eab7a2e2f4f13ce56b5920fcb7782f502b769deb6957e4863c4ec1fe9f78d0` |
| `epmc_ft_schmidt2016.xml` | https://www.ebi.ac.uk/europepmc/webservices/rest/PMC4888949/fullTextXML | 2026-10-05T16:19:25Z | 137235 | `1e6ba597bcc45356d2e000b4a2483b4a25983e95e991ddb87ce399a6017f0297` |
| `epmc_ft_soufi2015.xml` | https://www.ebi.ac.uk/europepmc/webservices/rest/PMC4332353/fullTextXML | 2026-10-05T16:19:44Z | 109524 | `de9ed959eb94090e785e1c784b89a1490694d18b5cc9ab0e7684393afd0e2c51` |
| `epmc_ft_tjaden2023.xml` | https://www.ebi.ac.uk/europepmc/webservices/rest/PMC10392735/fullTextXML | 2026-10-05T16:17:29Z | 91154 | `b45ecab23116c9fe6c2fd7d9dbb1c4be1d9092c5d93a8a1c75b1db94839cbbbe` |
| `epmc_ft_wang2018.xml` | https://www.ebi.ac.uk/europepmc/webservices/rest/PMC6018678/fullTextXML | 2026-10-05T16:18:56Z | 228896 | `daea34ac6a93d29da89c405aa31d479fae6f026df13713a9c6260dbd3a20e971` |
| `epmc_ft_weaver2019.xml` | https://www.ebi.ac.uk/europepmc/webservices/rest/PMC6401488/fullTextXML | 2026-10-05T16:19:42Z | 212977 | `d9767062b90321687e42365f66ed8b27db1c2c671238f92c1e01f9e11640ef05` |
| `epmc_ft_wellner2024.xml` | https://www.ebi.ac.uk/europepmc/webservices/rest/PMC10879529/fullTextXML | 2026-10-05T18:17:02Z | 177775 | `8451cccab434b7a59cfd8d4323f38d05fb129a880bf9a4b18c3e0294e489ff46` |
| `epmc_ft_wetmore2015.xml` | https://www.ebi.ac.uk/europepmc/webservices/rest/PMC4436071/fullTextXML | 2026-10-05T16:18:57Z | 183652 | `eeb1cc3db251d14014e26fb31a1bc438fde88716f8804b76a5bc6064a3d38933` |
| `epmc_ft_yamamoto2009.xml` | https://www.ebi.ac.uk/europepmc/webservices/rest/PMC2824493/fullTextXML | 2026-10-05T16:18:42Z | 44335 | `d5a2171b5ffd82ffa059542b61e03aa8b17c17a0436d4ed3c34366390fc17e8f` |
| `epmc_ft_yan2018.xml` | https://www.ebi.ac.uk/europepmc/webservices/rest/PMC6131387/fullTextXML | 2026-10-05T16:17:53Z | 108584 | `4f6c5879881a2ba14c4d197aceccb3ca4a157389b2c45d76a6a9e523b1744a4b` |
| `epmc_ft_yome2019.xml` | https://www.ebi.ac.uk/europepmc/webservices/rest/PMC6412132/fullTextXML | 2026-10-05T16:20:10Z | 110668 | `2aa813556161dbb6b27ede226e2288c9e9215b7df417b0218f0a9ffbae2d31e0` |
| `epmc_ft_zhao2019.xml` | https://www.ebi.ac.uk/europepmc/webservices/rest/PMC6544118/fullTextXML | 2026-10-05T18:20:45Z | 176569 | `f741002caed5c8d5430ca0ca208cb35fe1b082c8bdacd3836550088777d05dd5` |
| `epmc_search_bjork2014.json` | Europe PMC REST search, resultType=core, TITLE query for the article title (tag bjork2014) | 2026-10-05T16:16:55Z | 3870 | `a1f21590916d0a18e9d92ef5cfdc95498248ac9b54f67331377957ea0ebf773f` |
| `epmc_search_dong1996.json` | Europe PMC REST search, resultType=core, TITLE query for the article title (tag dong1996) | 2026-10-05T16:16:46Z | 5756 | `1c469c69c12cba0e4eee94650665548a5e8e31adbb414e5080853acab372da4d` |
| `epmc_search_rousset2021.json` | Europe PMC REST search, resultType=core, TITLE query for the article title (tag rousset2021) | 2026-10-05T16:16:30Z | 17360 | `94da97b3463e3cae4697f13e391232e539940b03cf29aac5eab762acd9e89d4d` |
| `epmc_search_soma2003.json` | Europe PMC REST search, resultType=core, TITLE query for the article title (tag soma2003) | 2026-10-05T16:16:45Z | 8535 | `72e11e18a6a8d47a6c3bd46b0b937df0007c9de1c715ea037b563497eaa03aae` |
| `geo_GSE117273_gsm.txt` | https://www.ncbi.nlm.nih.gov/geo/query/acc.cgi?acc=GSE117273&targ=gsm&form=text&view=brief | 2026-10-05T16:24:12Z | 15330 | `1667cac2509e52e1c834776b42b4c6ba047e745464723a03fe9aaf7f292dffd1` |
| `geo_GSE122129_gsm.txt` | https://www.ncbi.nlm.nih.gov/geo/query/acc.cgi?acc=GSE122129&targ=gsm&form=text&view=brief | 2026-10-05T16:24:27Z | 9462 | `6368c5e56679eb6930a9be4e11c070496de58868f00ea7fa926bc72ceb546e84` |
| `geo_GSE122211_gsm.txt` | https://www.ncbi.nlm.nih.gov/geo/query/acc.cgi?acc=GSE122211&targ=gsm&form=text&view=brief | 2026-10-05T16:24:06Z | 45939 | `271c15908c5e7f36a0be964ff4dd5743c085c3b37be2053daec4be168b087dc9` |
| `geo_GSE139983_self.txt` | https://www.ncbi.nlm.nih.gov/geo/query/acc.cgi?acc=GSE139983&targ=self&form=text&view=brief | 2026-10-05T16:23:50Z | 3483 | `42c85a8a1b9de993fc0ef291a8df9168f2cb8079a2fd9ca70ae18364d58a290f` |
| `geo_GSE205717_gsm.txt` | https://www.ncbi.nlm.nih.gov/geo/query/acc.cgi?acc=GSE205717&targ=gsm&form=text&view=brief | 2026-10-05T16:24:30Z | 104703 | `3669e29f32cb8d25329ff7ae618531874ba2fbfee069549f0b6a302b8be14354` |
| `geo_GSE53767_gsm.txt` | https://www.ncbi.nlm.nih.gov/geo/query/acc.cgi?acc=GSE53767&targ=gsm&form=text&view=brief | 2026-10-05T16:24:11Z | 15960 | `a56c27cb1fa475da022f60c33dd1b1f98e8bbd6914bbfb6a515a9b9a85e81fc1` |
| `go_ecocyc.gaf.gz` | https://current.geneontology.org/annotations/ecocyc.gaf.gz | 2026-10-05T16:46:08Z | 1097004 | `edd882f3c9c538119b93c040522f6bc3b84f199566dc1236387fc953350c8f01` |
| `go_license.html` | https://geneontology.org/docs/go-citation-policy/ | 2026-10-05T16:12:35Z | 24216 | `55c7367f6325116753e644828d70bb68d246637cc48e1c3b9ec1b4c06eb0b356` |
| `go_release_date.json` | https://current.geneontology.org/metadata/release-date.json | 2026-10-05T16:26:22Z | 19 | `858f641a1e2999ed521cb7ee1a167305ae669e148172720041210235b6ebc2b8` |
| `gtrnadb_ecoli.html` | https://gtrnadb.ucsc.edu/genomes/bacteria/Esch_coli_K_12_MG1655/ | 2026-10-05T16:26:22Z | 12607 | `d845f62e9b5817021fff818a9bf9a2794691d7645e252f621251bb5be90ea117` |
| `gtrnadb_front.html` | https://gtrnadb.ucsc.edu/ | 2026-10-05T16:26:22Z | 12922 | `2fa961c30b91eda2d9a17027b72d1354e8e662c7b7127e51d1e3debaf4821f5e` |
| `kegg_info_eco.txt` | https://rest.kegg.jp/info/eco | 2026-10-05T16:32:04Z | 223 | `cc53cb8eefaac80a9f2fac81095beaf7c950fe2bd54e31fe2ca621cd77d6faa2` |
| `kegg_legal.html` | https://www.genome.jp/kegg/legal.html | 2026-10-05T16:12:36Z | 2129 | `b87105e6251b08a2cd0f0208ee4615d021fe448f4ad46983eb7b576358ddd8e7` |
| `kegg_rest.html` | https://www.kegg.jp/kegg/rest/ | 2026-10-05T16:32:04Z | 9713 | `abd6ea94f118d25d01e40daa222b6e344b86c1c4ea08f46fe7e716d86f6ae635` |
| `modomics_front.html` | https://genesilico.pl/modomics/ | 2026-10-05T16:26:22Z | 11619 | `abee1f41df21a50971d1db9062bd73f302244c6abdf4fbeb7daecbbad70285ec` |
| `mori2021_EV1_strains.xlsx` | member MSB-17-e9536-s001.xlsx of the bundle https://www.ebi.ac.uk/europepmc/webservices/rest/PMC8144880/supplementaryFiles | 2026-10-05T16:45:18Z | 13639 | `78b8629a8e13229d9ac6fd4c12b54c059a115779215731ef938368d5bb739e8c` |
| `mori2021_EV3_samples2.xlsx` | member MSB-17-e9536-s011.xlsx of the bundle https://www.ebi.ac.uk/europepmc/webservices/rest/PMC8144880/supplementaryFiles | 2026-10-05T16:45:18Z | 17652 | `3c13d83bc11996c042f8856ac40ca3b0f312d826ef5118b3f13e060c357c7b46` |
| `mori2021_appendix.docx` | member MSB-17-e9536-s013.docx of the bundle https://www.ebi.ac.uk/europepmc/webservices/rest/PMC8144880/supplementaryFiles | 2026-10-05T16:45:18Z | 18407364 | `3c9490d042c152bd478aa82e9f37759dbc9f8beba521ff717a01aee2dd89aed5` |
| `mori_corr_MOESM1_ESM.xlsx` | https://static-content.springer.com/esm/art%3A10.1038%2Fs44320-024-00062-5/MediaObjects/44320_2024_62_MOESM1_ESM.xlsx | 2026-10-05T18:05:07Z | 1229542 | `9663fde01f2d292333417951593bfdae167abc6b6ec4341e621d4d0a256ec465` |
| `ncbi_datasets_assembly.json` | https://api.ncbi.nlm.nih.gov/datasets/v2/genome/accession/GCF_000005845.2/dataset_report | 2026-10-05T18:05:10Z | 2926 | `d3ae26c9d6ac9f8d21e8c0d0b7ad787b79c71e82be306fa4997e8985de6249a1` |
| `ncbi_nuccore_CP009273.json` | https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=nuccore&id=CP009273&retmode=json | 2026-10-05T18:26:28Z | 945 | `2a77768b117c428ea2c73c77d86b16d0d886652fdfa7d28eb9a7af580bcf6f3a` |
| `ncbi_pmc_balakrishnan2022.xml` | https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pmc&id=9804519&retmode=xml | 2026-10-05T16:20:00Z | 218433 | `799e483ae45599d6eee23f9e963a39c1ee29c48dfa5b86250c7cc9f779b640b1` |
| `ncbi_pmc_cog2024.xml` | https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pmc&id=11701660&retmode=xml | 2026-10-05T16:20:28Z | 11429 | `c9ae64bdc55c5291fec5830ca0383ca59bfbea5b73d8c3fba6d89123255ae62d` |
| `ncbi_pmc_craigen1985.xml` | https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pmc&id=397836&retmode=xml | 2026-10-05T16:21:24Z | 6934 | `e9725c6b92dedefc2f66255214dd1720f6da7bee5c9f8600ce784be7d63eb460` |
| `ncbi_pmc_gerdes2003.xml` | https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pmc&id=193955&retmode=xml | 2026-10-05T16:18:52Z | 10324 | `bea48f9c96c6cd359d1be6708fb8a4900c6fd9438a718839852c5209ece683ca` |
| `ncbi_pmc_hawkins2020.xml` | https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pmc&id=7704046&retmode=xml | 2026-10-05T16:19:14Z | 235514 | `8366308f27709970cb34f094c7939abee036e5f417346bba048d936cb90071ed` |
| `ncbi_pmc_iml1515.xml` | https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pmc&id=6521705&retmode=xml | 2026-10-05T16:20:19Z | 63657 | `ee26041fd07e801f327cdc48412240290bd20db18ee244cfb28bedd3642f06ab` |
| `ncbi_pmc_joyce2006.xml` | https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pmc&id=1698209&retmode=xml | 2026-10-05T16:19:24Z | 10222 | `4c1fb1a5c0f12eaef4e946bc93f01aafc212415ddafde9210ab11c287ae3466f` |
| `ncbi_pmc_ju2019.xml` | https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pmc&id=6814526&retmode=xml | 2026-10-05T16:18:02Z | 119833 | `abe741c1b2fb3cb3dfbda454be7b19fcb3fe50baf0156b4dd36142537ab229d9` |
| `ncbi_pmc_lalanne2018.xml` | https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pmc&id=5978003&retmode=xml | 2026-10-05T16:18:18Z | 456722 | `05a6a1708e91afab945c78d464c333e09d1042bc6ffc35ef9d7e401bd3ae5424` |
| `ncbi_pmc_li2014.xml` | https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pmc&id=4006352&retmode=xml | 2026-10-05T16:17:37Z | 126421 | `0ea642bd4672b49017da155d918a2359dea86fe808146d15b20c008cd81ecbb3` |
| `ncbi_pmc_melamed2020.xml` | https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pmc&id=6980735&retmode=xml | 2026-10-05T16:18:33Z | 213950 | `9c5e4ded67e0e1948a6917071df80e3df7634d91ff5fa740e1412f6c4e67a3b3` |
| `ncbi_pmc_meydan2017.xml` | https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pmc&id=5270581&retmode=xml | 2026-10-05T16:21:03Z | 147501 | `ebfd819465dc1d40c9bec19d8c59532d200f94a55e53900c6c5e7661678e559a` |
| `ncbi_pmc_meydan2019.xml` | https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pmc&id=7115971&retmode=xml | 2026-10-05T16:19:40Z | 158775 | `1096d53fe3c75869e8e68cd14c1adfdb1a6897a29679525a50279ea1b9a863b7` |
| `ncbi_pmc_nichols2011.xml` | https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pmc&id=3060659&retmode=xml | 2026-10-05T16:19:06Z | 148223 | `aa4f4e41371cdea10b0ab2834c17170141c179940e91a5f13bed52b5a57094e8` |
| `ncbi_pmc_taniguchi2010.xml` | https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pmc&id=2922915&retmode=xml | 2026-10-05T16:19:52Z | 86575 | `16217392abca862f6eaa655e84bc08e7f3c4b5060fc45238f90150b3794d4fd1` |
| `ncbi_pmc_tsuchihashi1990.xml` | https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pmc&id=53720&retmode=xml | 2026-10-05T16:21:32Z | 6726 | `bb2b0fdb58002c6b78e7c14076261978dda00c3824fbd5e152fcb81b7ad42675` |
| `ncbi_pmc_zinoni1987.xml` | https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pmc&id=304827&retmode=xml | 2026-10-05T16:21:42Z | 6769 | `44f38f595dfd78b2a18e36346ce0cefb5b7afcec0ee389244b0b0960772d5c88` |
| `ncbi_policies.html` | https://www.ncbi.nlm.nih.gov/home/about/policies/ | 2026-10-05T16:12:35Z | 38936 | `8ad8f6f186ca51ec73a5fb8935ecfa17b8cbaad300b7025b381898ab72621869` |
| `p1k_LICENSE.txt` | https://raw.githubusercontent.com/SBRG/precise1k/4829b83ace51ee7980de6950077f1cf8f3746f88/LICENSE | 2026-10-05T16:25:00Z | 1087 | `b974c4b7ee69ee9d26e0148b38b4766f3e149c4ec12fc1be3ce1e4e0f8f83014` |
| `p1k_README.md` | https://raw.githubusercontent.com/SBRG/precise1k/4829b83ace51ee7980de6950077f1cf8f3746f88/README.md | 2026-10-05T16:25:00Z | 10457 | `1685cb4c1044b5fe6385d384ce3af023798655e1357a5e0af50014c543c84509` |
| `pathway_academic.html` | https://www.pathway.jp/en/academic.html | 2026-10-05T16:32:04Z | 5063 | `b788f500537ffd052015ddf2100f70969f8621cd2d5a89893e0c7cc9d6d30071` |
| `pec_front.html` | https://shigen.nig.ac.jp/ecoli/pec/ | 2026-10-05T16:26:23Z | 15700 | `e3ec9a691411542484c0b8ba4825dfe9bda65359fbefb907a5abdb1045f9734b` |
| `pmc_page_dosreis2004.html` | https://pmc.ncbi.nlm.nih.gov/articles/PMC521650/ | 2026-10-05T16:25:50Z | 188873 | `603dd9ebf41ba650f11468b2f99e5b115e17558334aea37be1bb09131da5db4f` |
| `pmc_page_ecocyc2023.html` | https://pmc.ncbi.nlm.nih.gov/articles/PMC10729931/ | 2026-10-05T16:49:04Z | 324266 | `8bacd05bdf2b07e2b1af9771e905e444b8930cc8d4966d757a74c13cb0353b1d` |
| `pmc_page_gerdes2003.html` | https://pmc.ncbi.nlm.nih.gov/articles/PMC193955/ | 2026-10-05T16:25:44Z | 213148 | `c81b839558735aae10ea8fdfa7eaa50c2cd0bb18c5fa486dd61a68f21d3daf90` |
| `pmc_page_thomason2015.html` | https://pmc.ncbi.nlm.nih.gov/articles/PMC4288677/ | 2026-10-05T16:25:42Z | 230534 | `4bbc52674c8b8915fb93f84eb54d5f9f8a78fdf8ba78d4f0e8c2f6df18b5a221` |
| `pmc_page_wolf2002.html` | https://pmc.ncbi.nlm.nih.gov/articles/PMC126108/ | 2026-10-05T16:25:49Z | 195078 | `13e156ac97b67cff421ae12b1c5d4c997557079a8f719efd1d5e8a2651d59fe9` |
| `pride_PXD000498.json` | https://www.ebi.ac.uk/pride/ws/archive/v3/projects/PXD000498 | 2026-10-05T16:32:09Z | 6066 | `208718f1e564aea9f1b5e6daf9eb5760d66c05182b4f9cda23dd41018e125f8c` |
| `pride_PXD001648.json` | https://www.ebi.ac.uk/pride/ws/archive/v3/projects/PXD001648 | 2026-10-05T16:32:09Z | 9988 | `97ed56e0f2f5acc5b0f29dd7b72ea2b684c20074b4e209a5b5b8eebd58bab1b0` |
| `pride_PXD010126.json` | https://www.ebi.ac.uk/pride/ws/archive/v3/projects/PXD010126 | 2026-10-05T18:21:13Z | 9140 | `fd8bfd9a5629e1ee1767c72d74b836ab6286fb8129bf604c635aeadd3d3ca84d` |
| `pride_PXD014948.json` | https://www.ebi.ac.uk/pride/ws/archive/v3/projects/PXD014948 | 2026-10-05T16:32:09Z | 8665 | `9893f3517e0e218f5424101ddf24b4947d32c31fdd3ecaf15baaef5fc960c58f` |
| `prochipdb_com_ecoli_TF_list.csv` | https://prochipdb.com/data/e_coli/TF_list.csv | 2026-10-05T18:14:06Z | 34667 | `96a7d6435af55ba3622b2082448cb0e1fcb665fd2913af62b6a2cc253f6e2f83` |
| `prochipdb_com_home.html` | https://prochipdb.com/ | 2026-10-05T18:05:07Z | 10198 | `7504c82fe97734aa438017740d33cec0fed38ef237de0b03283a0b4faefd2df0` |
| `recode_front.html` | https://recode.ucc.ie/ | 2026-10-05T16:32:03Z | 1189 | `235c640ef68f9aaa31a6f70e2a5af17ea3993f655d237dc226fff3cca62f6d87` |
| `refseq_annotation_hashes.txt` | https://ftp.ncbi.nlm.nih.gov/genomes/all/GCF/000/005/845/GCF_000005845.2_ASM584v2/annotation_hashes.txt | 2026-10-05T16:22:28Z | 410 | `f4bf0e53a7b4ea673c0bad04a677893648b297764c74feed2c0e9521861e5f3e` |
| `regulondb_file_PromoterSet.json` | POST https://regulondb.ccg.unam.mx/graphql with JSON body {"query":"{ getDataOfFile(fileName: \"PromoterSet\") { _id fileName fileFormat license citation version creationDate columnsDetails content } }"} | 2026-10-05T16:14:08Z | 1007539 | `af28d228a23767b6421e6ea507a0fa40a808e78f5fdf3cba4df788271f6a9fa5` |
| `regulondb_file_RISet.json` | POST https://regulondb.ccg.unam.mx/graphql with JSON body {"query":"{ getDataOfFile(fileName: \"RISet\") { _id fileName fileFormat license citation version creationDate columnsDetails content } }"} | 2026-10-05T16:14:09Z | 3781908 | `dabdf7a01b548e6d05036acac97190b88685ad5ee36f9951a68489f320f0535f` |
| `regulondb_file_TUSet.json` | POST https://regulondb.ccg.unam.mx/graphql with JSON body {"query":"{ getDataOfFile(fileName: \"TUSet\") { _id fileName fileFormat license citation version creationDate columnsDetails content } }"} | 2026-10-05T16:14:08Z | 493211 | `ccf2697773b5a09d2df5b34aad7ea9577c309ca5ff359f9c73eee7639ba8fffe` |
| `regulondb_front.html` | https://regulondb.ccg.unam.mx/ | 2026-10-05T16:12:35Z | 1653 | `dffe340c9aff1951c7d5172899bf945c33f52b6cc6db073ed4fad11c078c4ae9` |
| `regulondb_terms.md` | https://raw.githubusercontent.com/regulondbunam/RegulonDBManual/master/manual/AboutUs/terms-and-conditions.md | 2026-10-05T16:14:07Z | 7341 | `b3b477e40fd8e64bc478b89a6ca5bc33beeb342fe326cc2df88e16bbc3e0b6ab` |
| `sri_all_reg.html` | https://bioinformatics.ai.sri.com/ptools/licensing/all-reg.shtml | 2026-10-05T16:13:13Z | 28938 | `d51a429cde69e5e3f5d274ddcddb9686d03dd41dbe8a434d3faa723dd6b6e309` |
| `uniprot_help_license.json` | https://rest.uniprot.org/help/license | 2026-10-05T16:26:22Z | 914 | `5960c22bf17f22286504b927dbb3ca41713c571ed91a10fe7a88ddd964b416ce` |
| `uniprot_proteome_UP000000625.json` | https://rest.uniprot.org/proteomes/UP000000625 | 2026-10-05T16:45:52Z | 4644 | `3fc53e7dbcc0fb73fcd4d4680b7cc6317d5466e85909032d0fcb2a219d7487c6` |
| `uniprot_sample_tils_tada.tsv` | https://rest.uniprot.org/uniprotkb/search?query=proteome:UP000000625+AND+(gene_exact:tilS+OR+gene_exact:tadA+OR+gene_exact:prfB+OR+gene_exact:fdhF)&fields=accession,reviewed,gene_primary,gene_oln,gene_orf,xref_refseq,xref_geneid,cc_function&format=tsv&size=10 | 2026-10-05T16:46:06Z | 2211 | `a120a08e52c1ba84f7c55e617a7ae675e22cf6b7ce1c054562b70c55556b9576` |
| `wellner2024_TableS3.xlsx` | member 41598_2024_54169_MOESM2_ESM.xlsx of the bundle https://www.ebi.ac.uk/europepmc/webservices/rest/PMC10879529/supplementaryFiles | 2026-10-05T18:18:21Z | 46344 | `88164d776a1564ccb88c67d9644a68d905435126f8dd2eba55ea32ff527fbe55` |

### 6.2 Data files inspected

Every data file whose contents a row reports (counts, headers, identifier columns), with the SHA-256 of the file itself. For a member of a supplement bundle the source is the bundle's address and the time is the bundle's retrieval time. The first pass printed 16-character prefixes for these files and claimed checksums it had not written down; the full values are given here and in the TSV column `mechanical_inspection`. Files retrieved in the first pass keep their first-pass retrieval times: they were re-opened in the correction pass, not downloaded again.

| Row | File | Bytes | SHA-256 | Source | Retrieved (UTC) |
| --- | --- | --- | --- | --- | --- |
| L1-01 | `log_tpm_qc.csv` | 60884226 | `8bdb286aecd305a38323ad5a5c18eb264702739824dfcb708c5c5b595abb84d6` | https://raw.githubusercontent.com/SBRG/precise1k/4829b83ace51ee7980de6950077f1cf8f3746f88/data/precise1k/log_tpm_qc.csv | 2026-10-05T16:25:02Z |
| L1-01 | `metadata_qc.csv` | 621002 | `a1358525a0431ac68b44f85f56169b7e8af4efb9186be6b43ba2cacb7b56e1cf` | https://raw.githubusercontent.com/SBRG/precise1k/4829b83ace51ee7980de6950077f1cf8f3746f88/data/precise1k/metadata_qc.csv | 2026-10-05T16:25:00Z |
| L1-01 | `gene_info.csv` | 1063339 | `355de1157a4837180cb0c3d625a7a4f26903ba0d50f2bf3ca769949e90dbcb90` | https://raw.githubusercontent.com/SBRG/precise1k/4829b83ace51ee7980de6950077f1cf8f3746f88/data/annotation/gene_info.csv | 2026-10-05T16:25:00Z |
| L2-02 | `12864_2016_2539_MOESM1_ESM.gtf` | 2057154 | `c17fdf501add8e8ea5727ced3b5fd266bcf1c75a44736215c87bd701d985f786` | member of the bundle https://www.ebi.ac.uk/europepmc/webservices/rest/PMC4782308/supplementaryFiles | 2026-10-05T16:36:10Z |
| L2-03 | `pgen.1002867.s007.xlsx` | 798145 | `564baba1c635641d51e76aaaa7b818e5cc476b7009a85e44d0a334e64799d8b4` | member of the bundle https://www.ebi.ac.uk/europepmc/webservices/rest/PMC3415461/supplementaryFiles | 2026-10-05T16:36:58Z |
| L2-04 | `41467_2018_5997_MOESM5_ESM.xlsx` | 154217 | `6e861b6cb85bf99b72668504ece4e902fe00890dbdfd8849056192abab0a85b8` | member of the bundle https://www.ebi.ac.uk/europepmc/webservices/rest/PMC6131387/supplementaryFiles | 2026-10-05T16:36:32Z |
| L2-04 | `41467_2018_5997_MOESM4_ESM.xlsx` | 158697 | `cd37432e014d4098b2c853bf7718384cfa4cb5d43513006c7b60e11d8970594b` | member of the bundle https://www.ebi.ac.uk/europepmc/webservices/rest/PMC6131387/supplementaryFiles | 2026-10-05T16:36:32Z |
| L2-04 | `41467_2018_5997_MOESM7_ESM.xlsx` | 74170 | `3d4132f04be00c5c00518f81b032661cca4daff61d517d9f2bfd07c10bb2ac88` | member of the bundle https://www.ebi.ac.uk/europepmc/webservices/rest/PMC6131387/supplementaryFiles | 2026-10-05T16:36:32Z |
| L3-02 | `mbo004141900st2.xlsx` | 646535 | `7cb002e60d80ea90e5ece38da814400dc7da4defa92d0d45dcfcaa5461e083fc` | member of the bundle https://www.ebi.ac.uk/europepmc/webservices/rest/PMC4161252/supplementaryFiles | 2026-10-05T16:37:35Z |
| L3-02 | `mbo004141900st3.xlsx` | 212291 | `09081b861f33cf8b4a04a08e065aa86e14383f3df002a0a4d0919f67e519dfef` | member of the bundle https://www.ebi.ac.uk/europepmc/webservices/rest/PMC4161252/supplementaryFiles | 2026-10-05T16:37:35Z |
| L3-02 | `mbo004141900st4.xlsx` | 293161 | `f2ecf4fd57d0b8b2dcae5ddae5da1148afcedffc406a293bac233bc2405dccfd` | member of the bundle https://www.ebi.ac.uk/europepmc/webservices/rest/PMC4161252/supplementaryFiles | 2026-10-05T16:37:35Z |
| L3-03 | `elife-62438-supp1.xlsx` | 267993 | `191a488103cd73da1338fe823f7340fc08229aa59a50109d89b9640edc84ee72` | member of the bundle https://www.ebi.ac.uk/europepmc/webservices/rest/PMC7815308/supplementaryFiles | 2026-10-05T16:40:25Z |
| L3-05 | `gky274_supplemental_files.xlsx` | 231614 | `8a276c749249a1fb40e89709be1f69c702d159e128ef0b785fe5c518c7187027` | member of the bundle https://www.ebi.ac.uk/europepmc/webservices/rest/PMC6061677/supplementaryFiles | 2026-10-05T16:37:39Z |
| L4-02 | `1741-7007-12-4-S4.xlsx` | 623778 | `2d824642c607c2434125ef0280470bafd6410580dc3e770fc01a8498303fb616` | member of the bundle https://www.ebi.ac.uk/europepmc/webservices/rest/PMC3923258/supplementaryFiles | 2026-10-05T16:38:08Z |
| L4-02 | `1741-7007-12-4-S6.xlsx` | 278321 | `7e94943a3d1e83bb88f53beb53b228ab2cfd74b9b995d80d8a14fa5d250f44c5` | member of the bundle https://www.ebi.ac.uk/europepmc/webservices/rest/PMC3923258/supplementaryFiles | 2026-10-05T16:38:08Z |
| L4-02 | `1741-7007-12-4-S8.xlsx` | 495162 | `23ca051af83077cc1d8fa3c4b2459049b4df3bc51d3e47860d6b387368e39904` | member of the bundle https://www.ebi.ac.uk/europepmc/webservices/rest/PMC3923258/supplementaryFiles | 2026-10-05T16:38:08Z |
| L4-03 | `TF_list.csv` | 34667 | `96a7d6435af55ba3622b2082448cb0e1fcb665fd2913af62b6a2cc253f6e2f83` | https://prochipdb.com/data/e_coli/TF_list.csv | 2026-10-05T18:14:06Z |
| L4-04 | `mmc3.xlsx` | 1853715 | `5b78029333c4488a46a9d007cd951306fb634929cdbbf8ac7068f2aa588e732e` | member of the bundle https://www.ebi.ac.uk/europepmc/webservices/rest/PMC5145812/supplementaryFiles | 2026-10-05T16:39:22Z |
| L5-01 | `msb4100050-s8.xls` | 107008 | `ded72d1f890d47b0544fa52edcb491b187a010fa6b938437fc04418e08e31638` | member of the bundle https://www.ebi.ac.uk/europepmc/webservices/rest/PMC1681482/supplementaryFiles | 2026-10-05T16:40:38Z |
| L5-01 | `msb4100050-s5.xls` | 1677312 | `a1a9c30b6cd703ff835f2809b420afe38b1c139865c9af87566a410669a30d2e` | member of the bundle https://www.ebi.ac.uk/europepmc/webservices/rest/PMC1681482/supplementaryFiles | 2026-10-05T16:40:38Z |
| L5-02 | `msb200992-s5.xls` | 734208 | `8b7225b7357d4a3a119acf9dc0c59a2e628c56a86b0a9d1a2cf419a6296ff95e` | member of the bundle https://www.ebi.ac.uk/europepmc/webservices/rest/PMC2824493/supplementaryFiles | 2026-10-05T16:39:02Z |
| L5-05 | `pgen.1007749.s012.csv` | 470001 | `89c170375718d983b5ba623507ce0cd727a39ce490ea4e8aa9f259195c5c6b15` | member of the bundle https://www.ebi.ac.uk/europepmc/webservices/rest/PMC6242692/supplementaryFiles | 2026-10-05T16:42:33Z |
| L5-05 | `pgen.1007749.s011.csv` | 7092023 | `015ebda56925fee97cd2c44557b146799299f883b2255ed22836ebab61875ebb` | member of the bundle https://www.ebi.ac.uk/europepmc/webservices/rest/PMC6242692/supplementaryFiles | 2026-10-05T16:42:33Z |
| L5-14 | `msystems.00896-22-s0002.xlsx` | 758879 | `b1b27667bb9671e0cf031c46bb91e99077e759f4ccd5f75642c809e4d8b9595e` | member `msystems.00896-22-s0002.xlsx` of the bundle https://www.ebi.ac.uk/europepmc/webservices/rest/PMC9948719/supplementaryFiles | 2026-10-05T18:09:30Z |
| L5-15 | `41598_2024_54169_MOESM2_ESM.xlsx` | 46344 | `88164d776a1564ccb88c67d9644a68d905435126f8dd2eba55ea32ff527fbe55` | member `41598_2024_54169_MOESM2_ESM.xlsx` of the bundle https://www.ebi.ac.uk/europepmc/webservices/rest/PMC10879529/supplementaryFiles | 2026-10-05T18:18:21Z |
| L5-16 | `Table_1.XLSX` | 533084 | `79412a1f8c4b02268d3e7d4032251e75038dcd37677d996870992b97e75d8ce5` | member `Table_1.XLSX` of the bundle https://www.ebi.ac.uk/europepmc/webservices/rest/PMC8803141/supplementaryFiles | 2026-10-05T18:18:19Z |
| L6-01 | `NIHMS65833-supplement-Supplementary_tables.xlsx` | 17128596 | `3280a13ff67a73f25440cff6ee73fb99b5ce3ef57854213dbbf6272be241912f` | member of the bundle https://www.ebi.ac.uk/europepmc/webservices/rest/PMC4888949/supplementaryFiles | 2026-10-05T16:43:09Z |
| L6-03a | `44320_2024_62_MOESM3_ESM.xlsx` | 1174847 | `ddbd7acb9997097cfa8794886886954da1ef89ce7642e25134de323b5100e1d3` | https://static-content.springer.com/esm/art%3A10.1038%2Fs44320-024-00062-5/MediaObjects/44320_2024_62_MOESM3_ESM.xlsx | 2026-10-05T18:05:09Z |
| L6-03a | `44320_2024_62_MOESM4_ESM.xlsx` | 1332556 | `78a8c11e329807e550c7f9fc7c6279da66fdcb090160e92e5ec8078bb7353071` | https://static-content.springer.com/esm/art%3A10.1038%2Fs44320-024-00062-5/MediaObjects/44320_2024_62_MOESM4_ESM.xlsx | 2026-10-05T18:05:10Z |
| L6-03a | `44320_2024_62_MOESM5_ESM.xlsx` | 364498 | `ddf5e150cf698e73b9549901431d33385ea322232f9beb90a748f68b01aec312` | https://static-content.springer.com/esm/art%3A10.1038%2Fs44320-024-00062-5/MediaObjects/44320_2024_62_MOESM5_ESM.xlsx | 2026-10-05T18:05:11Z |
| L6-03a | `MSB-17-e9536-s014.xlsx` | 19326 | `2bb6c8c3b647740c6fe371fc39bf1bb9e69484d0fff264b67e05f61b86062eb9` | member `MSB-17-e9536-s014.xlsx` of the bundle https://www.ebi.ac.uk/europepmc/webservices/rest/PMC8144880/supplementaryFiles (archive download stopped at the 280 s limit; this member is complete (deflate stream ended, length and CRC-32 match its header)) | 2026-10-05T16:45:18Z |
| L6-03a | `MSB-17-e9536-s011.xlsx` | 17652 | `3c13d83bc11996c042f8856ac40ca3b0f312d826ef5118b3f13e060c357c7b46` | member `MSB-17-e9536-s011.xlsx` of the bundle https://www.ebi.ac.uk/europepmc/webservices/rest/PMC8144880/supplementaryFiles (archive download stopped at the 280 s limit; this member is complete (deflate stream ended, length and CRC-32 match its header)) | 2026-10-05T16:45:18Z |
| L6-03b | `44320_2024_62_MOESM1_ESM.xlsx` | 1229542 | `9663fde01f2d292333417951593bfdae167abc6b6ec4341e621d4d0a256ec465` | https://static-content.springer.com/esm/art%3A10.1038%2Fs44320-024-00062-5/MediaObjects/44320_2024_62_MOESM1_ESM.xlsx | 2026-10-05T18:05:07Z |
| L6-03b | `44320_2024_62_MOESM4_ESM.xlsx` | 1332556 | `78a8c11e329807e550c7f9fc7c6279da66fdcb090160e92e5ec8078bb7353071` | https://static-content.springer.com/esm/art%3A10.1038%2Fs44320-024-00062-5/MediaObjects/44320_2024_62_MOESM4_ESM.xlsx | 2026-10-05T18:05:10Z |
| L6-03b | `44320_2024_62_MOESM2_ESM.xlsx` | 12929 | `9504646b7d5f7edf48ec7718ec3e74eb5982df01e15fed3e7366cdaf7f73541c` | https://static-content.springer.com/esm/art%3A10.1038%2Fs44320-024-00062-5/MediaObjects/44320_2024_62_MOESM2_ESM.xlsx | 2026-10-05T18:05:08Z |
| L6-03b | `MSB-17-e9536-s011.xlsx` | 17652 | `3c13d83bc11996c042f8856ac40ca3b0f312d826ef5118b3f13e060c357c7b46` | member `MSB-17-e9536-s011.xlsx` of the bundle https://www.ebi.ac.uk/europepmc/webservices/rest/PMC8144880/supplementaryFiles (archive download stopped at the 280 s limit; this member is complete (deflate stream ended, length and CRC-32 match its header)) | 2026-10-05T16:45:18Z |
| L6-03b | `MSB-17-e9536-s001.xlsx` | 13639 | `78b8629a8e13229d9ac6fd4c12b54c059a115779215731ef938368d5bb739e8c` | member `MSB-17-e9536-s001.xlsx` of the bundle https://www.ebi.ac.uk/europepmc/webservices/rest/PMC8144880/supplementaryFiles (archive download stopped at the 280 s limit; this member is complete (deflate stream ended, length and CRC-32 match its header)) | 2026-10-05T16:45:18Z |
| L6-06 | `mBio.02819-18-st001.xlsx` | 22406 | `eb4c64c87ed4ff45c0a5bc6ea194a3196898a784e2275d10eef963a2a5ae0426` | member of the bundle https://www.ebi.ac.uk/europepmc/webservices/rest/PMC6401488/supplementaryFiles | 2026-10-05T16:43:55Z |
| L6-06 | `mBio.02819-18-st003.xlsx` | 45164 | `14871c9487aedd9119ea9e3d49568ba8f07385ca1b6aacf4b3174860db56dc66` | member of the bundle https://www.ebi.ac.uk/europepmc/webservices/rest/PMC6401488/supplementaryFiles | 2026-10-05T16:43:55Z |
| L6-10 | `Supplementary table S3 Protein abundances and properties used in this work.xlsx` | 611597 | `3b9b1a1e8c724fcf46047a2b5ca97ee141192a17197dbeaa2b8ea1bf82d6d95a` | member `Data_Sheet_1.zip > Supplementary table S3 Protein abundances and properties used in this work.xlsx` of the bundle https://www.ebi.ac.uk/europepmc/webservices/rest/PMC6544118/supplementaryFiles | 2026-10-05T18:22:38Z |
| L7-03 | `ecocyc.gaf.gz` | 1097004 | `edd882f3c9c538119b93c040522f6bc3b84f199566dc1236387fc953350c8f01` | https://current.geneontology.org/annotations/ecocyc.gaf.gz | 2026-10-05T16:46:08Z |
| L8-01 | `GCF_000005845.2_ASM584v2_genomic.gff.gz` | 387627 | `afdf03dc1d06e423d874ee29d9e0df14f5d32baf893f4da9f93aa721eb5f495e` | https://ftp.ncbi.nlm.nih.gov/genomes/all/GCF/000/005/845/GCF_000005845.2_ASM584v2/GCF_000005845.2_ASM584v2_genomic.gff.gz | 2026-10-05T16:21:59Z |
| L9-01 | `GCF_000005845.2_ASM584v2_genomic.gff.gz` | 387627 | `afdf03dc1d06e423d874ee29d9e0df14f5d32baf893f4da9f93aa721eb5f495e` | https://ftp.ncbi.nlm.nih.gov/genomes/all/GCF/000/005/845/GCF_000005845.2_ASM584v2/GCF_000005845.2_ASM584v2_genomic.gff.gz | 2026-10-05T16:21:59Z |
| L9-01 | `GCF_000005845.2_ASM584v2_genomic.gbff.gz` | 3401424 | `cbcc40a9859312cbcdbeb3df484ee471dfe354c5cd8f28056b48431353b28384` | https://ftp.ncbi.nlm.nih.gov/genomes/all/GCF/000/005/845/GCF_000005845.2_ASM584v2/GCF_000005845.2_ASM584v2_genomic.gbff.gz | 2026-10-05T16:21:59Z |
| L9-01 | `GCF_000005845.2_ASM584v2_cds_from_genomic.fna.gz` | 1479753 | `8b7b48b7b905313082141db4b77807b7aafebca7a5c40bbd42832baacd1cfd9b` | https://ftp.ncbi.nlm.nih.gov/genomes/all/GCF/000/005/845/GCF_000005845.2_ASM584v2/GCF_000005845.2_ASM584v2_cds_from_genomic.fna.gz | 2026-10-05T16:22:27Z |

### 6.3 Files read under DEM-244 that no row quotes

Files behind the deposit observations of section 9, the corrected licence standing of rows L6-03a and L6-03b, and the retrieval records of rows L4-03 and L8-02. The search responses are in the companion search manifest. A first-retrieval file keeps its first retrieval time.

| File | Address | Retrieved (UTC) | Bytes | SHA-256 |
| --- | --- | --- | --- | --- |
| PXD062881 project record | https://www.ebi.ac.uk/pride/ws/archive/v3/projects/PXD062881 | 2026-10-05T19:11:37Z | 10162 | `eba6e5bbef99278d97911e1e00b61be2edbd003aa08b5041863df1faac2ebf6e` |
| PXD062881 file listing | https://www.ebi.ac.uk/pride/ws/archive/v3/projects/PXD062881/files | 2026-10-05T19:11:39Z | 8397 | `84333e5d715e3884396cc6570c305540b38b216d8ad882b8783a678bb1fec0c0` |
| PXD062881 result file `Elliot_20210701_1ug_OTE_Aurora-3hr_TMT-15-RTS-MS3.mzTab` | https://ftp.pride.ebi.ac.uk/pride/data/archive/2026/02/PXD062881/Elliot_20210701_1ug_OTE_Aurora-3hr_TMT-15-RTS-MS3.mzTab | 2026-10-05T19:11:59Z | 7750228 | `f50eec9e945657c144db93feb2dd7dbc32f723cc75c8e6e125b94a3b514ddba8` |
| PXD062881 result file `Elliot_20201015_1ug_OTE_Aurora-FAIMS-3hr_TMTpro-Deg.mzTab` | https://ftp.pride.ebi.ac.uk/pride/data/archive/2026/02/PXD062881/Elliot_20201015_1ug_OTE_Aurora-FAIMS-3hr_TMTpro-Deg.mzTab | 2026-10-05T19:12:10Z | 12900335 | `c15a2da4e08a4d3a4dba56053f592208ead1c96d51b2f96f6d63d6982a40bb26` |
| PXD062881 sample table `PXD062881_community_annotated.sdrf.tsv` | https://ftp.pride.ebi.ac.uk/pride/data/archive/2026/02/PXD062881/PXD062881_community_annotated.sdrf.tsv | 2026-10-05T19:12:11Z | 1522 | `073671f0e2d8bb43f7d9d53fe4010814fb0b85476a088dbdff7a964bc11d1f12` |
| PXD014948 file listing, page 0 | https://www.ebi.ac.uk/pride/ws/archive/v3/projects/PXD014948/files?pageSize=100&page=0 | 2026-10-05T19:13:16Z | 118455 | `97124d789854cd28408c46ea349894d3100bab169f4b7b6a4573793837eee98f` |
| PXD014948 file listing, page 1 | https://www.ebi.ac.uk/pride/ws/archive/v3/projects/PXD014948/files?pageSize=100&page=1 | 2026-10-05T19:13:27Z | 118641 | `ec57d416c8e0b8897a90edbe71ce2c9fb50d1153e77f89f676b8ac1266229a5b` |
| PXD014948 file listing, page 2 | https://www.ebi.ac.uk/pride/ws/archive/v3/projects/PXD014948/files?pageSize=100&page=2 | 2026-10-05T19:13:29Z | 48566 | `8b223ef8f890040222d09689e4ab8e22ba1a667fdad267297ab1831664f279c2` |
| PXD014948 file listing, page 3 (empty) | https://www.ebi.ac.uk/pride/ws/archive/v3/projects/PXD014948/files?pageSize=100&page=3 | 2026-10-05T19:13:30Z | 2 | `4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945` |
| PXD014948 archive `Ecoli_SWATH_quant_results.zip` | https://ftp.pride.ebi.ac.uk/pride/data/archive/2021/03/PXD014948/Ecoli_SWATH_quant_results.zip | 2026-10-05T19:14:25Z | 10623870 | `50e30371eb54a2bf0eee0b3e4e2aca38700af15facbbcf0aea3cc6d180457a73` |
| member `Supp Table S1 - Samples and conditions.xlsx` of that archive | member of the archive above | 2026-10-05T19:14:25Z | 19686 | `fbb1b94091132bb6481e6ba37c64021069932d414b44ae84dd2561ce361a20b6` |
| member `Supp Table S3 - Peptide-level Intensities.xlsx` of that archive | member of the archive above | 2026-10-05T19:14:25Z | 10349671 | `52c850a328bc3ed9146977db291255165097f54b9c5f638d3c2d8d12412df0e5` |
| member `Supp Table S5 - Absolute protein mass fractions.xlsx` of that archive | member of the archive above | 2026-10-05T19:14:25Z | 1487601 | `c3c03c2315383452411e1debdd42879b802528b3a3b5d7fa5269c532be75f8ac` |
| PXD010126 file listing (one page) | https://www.ebi.ac.uk/pride/ws/archive/v3/projects/PXD010126/files?pageSize=100&page=0 | 2026-10-05T19:13:17Z | 18658 | `8d909b5c759c267ff215c1c21d695f6d696599d00c031b9bf76b6ad19a2bae6a` |
| proChIPdb E. coli dataset page (L4-03; first retrieval, not quoted) | https://prochipdb.com/dataset_page.html?organism=e_coli | 2026-10-05T18:13:46Z | 12196 | `80fcace89fbd0d63862c806d5a0ce4d71a78fc2eaf42d98c81ead85d5d21de12` |
| proChIPdb About page (L4-03; first retrieval, not quoted) | https://prochipdb.com/about.html | 2026-10-05T18:13:47Z | 56845 | `ff49a04176b8acf95e1113921ab5a323605781fd15594df74ecc552027430dc5` |
| Zenodo record 5168081 (L4-03; first retrieval, not quoted) | https://zenodo.org/api/records/5168081 | 2026-10-05T16:46:30Z | 3829 | `192dd0dc1799e5f56df7697545785d83e6d0fc33eca7258b4eeea6d800fc3976` |
| Zenodo record 5545676 (L4-03; first retrieval, not quoted) | https://zenodo.org/api/records/5545676 | 2026-10-05T18:13:47Z | 3887 | `6f43c1f3a6e5027c8c66015e934c02bb99f7cc1f4032d71fbf59c6a7ed98fcbe` |
| GitHub API record of SBRG/ChIPdb (L4-03; first retrieval, not quoted) | https://api.github.com/repos/SBRG/ChIPdb | 2026-10-05T16:32:09Z | 6469 | `41ab2518309e06185ebc4076a0e90d10dfb56abb6ac2a6d1039f410d939b121e` |
| GtRNAdb FAQ page (L8-02; first retrieval, not quoted) | https://gtrnadb.ucsc.edu/faq.html | 2026-10-05T16:46:28Z | 8404 | `bc2742f4d98b2821699b8b7f6fa265d4a6d6f3a07c36ee8039f490cdac9f7d9d` |
| GtRNAdb citation page (L8-02; first retrieval, not quoted) | https://gtrnadb.ucsc.edu/citation.html | 2026-10-05T16:46:28Z | 7305 | `b2afc7d940ec7c71525b93094e0d81aba6d06dc80dfe9361a8fae6d3d3a2d87e` |
| proChIPdb home page, requested again (L4-03) | https://prochipdb.com/ | 2026-10-05T19:17:37Z | 10198 | `7504c82fe97734aa438017740d33cec0fed38ef237de0b03283a0b4faefd2df0` |
| proChIPdb E. coli list file, requested again (L4-03) | https://prochipdb.com/data/e_coli/TF_list.csv | 2026-10-05T19:17:40Z | 34667 | `96a7d6435af55ba3622b2082448cb0e1fcb665fd2913af62b6a2cc253f6e2f83` |
| GtRNAdb genome page, requested again (L8-02) | https://gtrnadb.ucsc.edu/genomes/bacteria/Esch_coli_K_12_MG1655/ | 2026-10-05T19:17:42Z | 12607 | `d845f62e9b5817021fff818a9bf9a2794691d7645e252f621251bb5be90ea117` |
| GtRNAdb front page, requested again (L8-02) | https://gtrnadb.ucsc.edu/ | 2026-10-05T19:17:45Z | 12922 | `2fa961c30b91eda2d9a17027b72d1354e8e662c7b7127e51d1e3debaf4821f5e` |
| original (withdrawn) Dataset EV9, `MSB-17-e9536-s007.xlsx`: a complete member of the partial Mori 2021 bundle, read for one comparison | member of the bundle https://www.ebi.ac.uk/europepmc/webservices/rest/PMC8144880/supplementaryFiles | 2026-10-05T16:45:18Z | 1284400 | `50efbf4a3c7f9c1bb4cb6525053d5f599bd13f1b25b296819315ca5d7d244e74` |

## 7. Ranked shortlist

For each layer: the one or two sources to bring to the owner first, why, and where each stands against the admission contract (organism and strain, assay, conditions, units, licence, retrieval date, immutable artifact identifier, checksum, mapping method, ambiguity, missingness). "Satisfied" means the evidence for that field is in this dossier; the manifest entry and the checks are still the repository's to make. Every source named is a candidate; none is admitted.

| Layer | First | Second | Why | Already satisfied | Still missing |
| --- | --- | --- | --- | --- | --- |
| 1 Transcript abundance | L1-01 PRECISE-1K | L1-02 GSE122211 and GSE122295 | `b`-number keyed, replicated, per-sample conditions, MIT over the files, commit and DOI pinned | strain per sample, assay, units as labelled, conditions, licence text, identifiers, direct mapping; the full SHA-256 of both tables is now recorded (section 6.2) | which samples form a layer (for example the two wild-type M9 glucose reference samples) and the recorded filter; replicate aggregation; whether a pseudocount was applied before the logarithm (not stated; the file contains exact zeros); matched, unmatched and ambiguous counts against the annotation; a rule that an absent gene is unknown, not zero |
| 2 TSS and promoters | L2-02 Ettwiller 2016 | L2-03 Kim 2012; L2-04 Yan 2018 for a set already on `NC_000913.3` | Exact strain, replicated, per-site file in hand; CC BY article with an explicit CC0 data clause | strain, assay, condition, replicates, licence text, file and SHA-256 | conversion from `U00096.2` to `NC_000913.3`; rule for assigning a TSS to a gene and for ambiguous sites; meaning of the score columns. For Kim and Yan: the article-to-supplement licence question (section 4.5). For the curated set: UNAM's written consent (RegulonDB) or the executed EcoCyc licence |
| 3 Operons and terminators | L2-04 Yan 2018 (operons) | L3-03 Adams 2021 (3' ends) | Both exact strain, on `NC_000913.3`; articles CC BY and CC0 | strain, conditions, licence text of the articles, files and SHA-256, version; `b`-numbers for Yan 2018 | a ledger rule or owner reading for the supplementary files, which have no legend; replicate structure for Yan 2018; a rule that a 3' end is not by itself a terminator; coverage is limited to expressed operons, so missing means unknown |
| 4 Regulatory sites | L7-01 EcoCyc regulation, once licensed | L4-02 Cho 2014 (sigma factors); L4-03 proChIPdb (transcription factors); L4-06 Iosub 2020 (sRNA targets) | EcoCyc is the candidate curated source; Cho 2014 is measured, exact strain, with a CC0 data clause; proChIPdb is MG1655 on `NC_000913.3` under a CC BY 4.0 deposit | Cho 2014: strain, licence text, files and SHA-256. EcoCyc: terms and identifier route. proChIPdb: address, inventory, deposit licence | EcoCyc flat files (licence form); Cho 2014 conditions per sample and sequence version; one proChIPdb binding table opened and its archive pinned; Iosub 2020 tables unread. RegulonDB (L4-01) stays link-only without consent |
| 5 Essentiality and fitness | L5-14 Choe 2022 (MG1655), with L5-03 Goodall 2018 (BW25113) as the cross-substrain comparator | L5-05 Rousset 2018 CRISPRi | Choe: measured in MG1655, `b`-number keyed on `NC_000913.3`, per-file CC BY 4.0, two media, table in hand. Goodall: per-file CC BY 4.0 and an explicit "unclear" class. Rousset: quantitative fitness in an MG1655 background | Choe: strain, assay, conditions, units, licence at file level, identifiers, sequence version, file and SHA-256. Goodall: strain, licence at file level, counts. Rousset: strain, replicates, licence text of the article, files and SHA-256 | Choe: replication (not reported); a display rule that carries the paper's own false-positive and false-negative classes and says a call is not a deletion phenotype; which medium's call to show; matched and unmatched counts against the annotation (4,498 genes against 4,651). Goodall: the workbook itself, and an owner ruling on BW25113 to MG1655 transfer if it is to be shown on MG1655 genes. Rousset: a symbol-to-`b`-number join with ambiguity; a label that CRISPRi fitness is not a deletion phenotype |
| 6 Protein abundance and translation | L6-03b Mori 2021, MG1655 EQ353 calibration samples | L6-10 Zhao 2019 (MG1655, M9 glucose); L6-01 Schmidt 2016 Table S9 on content; L6-05 Mohammad 2019 for ribosome occupancy | L6-03b: measured in MG1655, three biological cultures, `b`-number keyed, corrected files checksummed. L6-10: MG1655 on the assembly of record, `b`-number keyed. Schmidt: MG1655 in two media in triplicate, copies per cell | L6-03b: strain and sub-strain as stated, assay, condition, replication, units, identifiers, corrected files with SHA-256 and matching PMC MD5, correction read. L6-10: strain, condition, replicates, identifiers, file and SHA-256. Schmidt: strain, units, replicates, file and SHA-256 | L6-03b and L6-10: a ledger rule or owner reading on article licence to supplementary file (no legend on either). L6-03b: a lab judgement on whether sub-strain EQ353 stands for MG1655; a choice between the unscaled values (EV6) and those scaled to ribosome profiling (EV9), with that calibration labelled; a rule that zero means not quantified; how technical injections are aggregated. L6-10: a label that copies per cell are scaled from another study. Schmidt: a grant, or the owner's decision to ship against a "no grant" row; the UniProt-to-`b`-number route. Mohammad: a tracks-to-gene computation, which is a new pipeline |
| 7 Curated function | L7-01 EcoCyc | L7-02 UniProtKB; then L7-03 GO and L7-05 COG | EcoCyc is the richest and is redistributable under conditions; UniProtKB is CC BY 4.0, versioned, `b`-number keyed and retrievable now | EcoCyc: terms quoted, version, identifier route. UniProtKB: licence, release, proteome id, route | EcoCyc: the executed licence, the files and their checksums, and acceptance of the attribution conditions. UniProtKB: a pinned release download and matched and unmatched counts |
| 8 tRNA and tAI | L8-01 RefSeq tRNA genes | L8-04 UniProtKB statements for lysidine and inosine | Already in the pinned input and labels the special cases | strain, identifiers, checksum, direct mapping, copy counts | **the owner's ledger decision on the retention basis for this EcoCyc-derived annotation** (the PGAP rationale does not carry over as written); a parser for the free-text `Note` that fails closed; a recorded choice of wobble weights (L8-06, L8-07); a person's look at the extra Thr(CGT) prediction in GtRNAdb (L8-02); the tRNA-abundance paper (L8-09) could not be read |
| 9 Gene-model peculiarities | L9-01 RefSeq annotation flags | L6-06 Weaver 2019 small proteins; L7-01 EcoCyc pseudogenes and phantom genes | Every named exception is encoded per `b`-number in the pinned input | strain, identifiers, checksums, direct mapping and counts for the encoded flags. The licence basis is not among the satisfied fields | the same ledger decision on the annotation's retention basis; a decision on which flags block recoding and which only warn; small proteins and overlaps outside the annotation |

What changed in the two layers the re-check reopened. In layer 5 the first place moves from a BW25113 call to one measured in MG1655, so an owner ruling on BW25113 to MG1655 transfer is no longer a precondition for having an essentiality layer; it is needed only if a BW25113 source is to be shown on MG1655 genes. In layer 6 the "owner ruling on NCM3722 to MG1655 transfer" asked for by the first pass is likewise no longer a precondition: it applies only to row L6-03a, should the owner want the condition series. What layer 6 now needs is narrower: a licence reading for a supplementary file without a legend, and a lab judgement on a named MG1655 sub-strain.

Five owner actions would unlock the most: executing the EcoCyc data licence; asking CCG-UNAM for written consent to redistribute RegulonDB-derived tables; deciding the ledger basis for retaining this EcoCyc-derived RefSeq annotation; adding ledger rules for the licence situations in section 4.5, above all an article licence relied on for a supplementary file; and the lab judgements on strain (EQ353 for MG1655; and BW25113 or NCM3722 for MG1655 only if those sources are wanted).

## 8. Confidence, the likeliest error, and what would change this

- **Confidence in the facts quoted:** high. Each is a mechanical match against a retrieved file with a checksum. Counts from inspected tables are of the copy retrieved on 2026-10-05 and were recounted in the correction pass as data records.
- **Confidence in the ranking:** moderate, and lower than the first pass claimed. The first pass named a missed MG1655 dataset as its likeliest error, and the re-check found two: one inside a source already ranked. A bounded search then found three more candidates in about ten minutes of queries. The ranking in layers 5 and 6 should be read as "best of what has been read", and section 9 lists leads that have not been.
- **Likeliest way this is still wrong:** a better MG1655 source that no query here returned, most plausibly a quantitative proteome deposited in PRIDE whose per-gene table sits in an article supplement or among the deposit's own result files, or a transposon or CRISPRi screen whose abstract does not name the strain. Layers 1 to 4 and 7 to 9 received no such search in either pass.
- **Second likeliest:** a licence characterisation that a fuller reading would change. Most rows that rely on an article licence for a supplementary file are inferences; a publisher statement covering supplementary files, if one exists, was not looked for. The Baba 2006 publisher page was not read.
- **What would change the recommendations:** written consent from CCG-UNAM (RegulonDB moves to first in layers 2 to 4); the executed EcoCyc licence; a ledger rule on supplementary files (it decides whether L6-03b, L6-10 and several layer 2 and 3 rows are redistributable or link-only); a lab judgement that EQ353 does not stand for MG1655 (L6-10 and Schmidt Table S9 move up); a replication statement for Choe 2022 from its authors; a retrieved per-gene table for Gerdes 2003 or Li 2014 under a grant; or a taxon-wide sweep of GEO, PRIDE and SRA.

## 9. Not retrieved, read but silent, and searches

### Not retrieved

| Item | Reason |
| --- | --- |
| Fitness Browser pages, `fit.genomics.lbl.gov` (L5-07) | HTTP 403 with a script challenge ("Just a moment...") to a plain client, twice. Not solved |
| Price et al. 2018, Nature (L5-07) | No PMC deposit (NCBI ID converter: "Identifier not found in PMC"); not in Europe PMC full text |
| Rousset et al. 2021 (L5-11); Soma et al. 2003 (L8-08); Dong et al. 1996 (L8-09); Björk and Hagervall 2014 (L8-10) | Same: no PMC deposit and no Europe PMC full text |
| Goodall 2018 Table S1 workbook (L5-03) | Absent from the Europe PMC bundle; the `europepmc.org/articles/PMC5821084/bin/` link answered HTTP 403 with a script challenge. Its legend and licence were read |
| Thomason 2015 supplementary TSS tables (L2-01); Gerdes 2003 gene list (L5-04); Li 2014 Table S (L6-02); Nichols 2011 tables (L5-08); Lalanne 2018 tables (L3-06) | Europe PMC `supplementaryFiles` answers "Article with id … is not open access one"; publisher sites were not approached (`journals.asm.org` is left alone per the handoff contract, and the PMC file path sat behind a reCAPTCHA page at the time) |
| Mori 2021 original supplement bundle as a whole (L6-03a, L6-03b) | The Europe PMC download stopped at the 280 s limit (curl exit 28) and was not retried. Twelve members are complete in the partial file and four were read (Datasets EV1, EV2, EV3 and the Appendix); under DEM-244 a fifth, the original Dataset EV9, was read for one comparison (section 6.3). Dataset EV10 and the review-process file are not among the complete members. The five corrected datasets were retrieved whole from the publisher's static host |
| Supplement bundles for Wang 2018 (L5-06), Iosub 2020 (L4-06) | The Europe PMC download stopped at the 280 s limit (curl exit 28) with a partial file. Not retried; members not examined |
| Bodies of Joyce 2006 (L5-12) and of the COG 2024 article (L7-05) | NCBI `efetch` returned front matter and permissions only; the PMC article page answered with a reCAPTCHA page, which was not solved. The EcoCyc 2023 article was served on a later single retry |
| Full text of Craigen 1985, Tsuchihashi and Kornberg 1990, Zinoni 1987 (L9-04 to L9-06) | PMC deposits are page scans with no text body |
| `isfinder.biotoul.fr` (L9-07) | Host did not resolve from this machine on two attempts (curl exit 6) |
| `prochipdb.org` (L4-03) | Superseded address; still does not resolve (curl exit 6, retried 2026-10-05). The corrected address `prochipdb.com` was read. proChIPdb binding tables and both Zenodo archives (4.9 GB and 5.5 GB): reachable, not downloaded |
| `pax-db.org` downloads and terms (L6-04) | No response in 180 s on the first attempt; the front page later returned a script shell with no content |
| `imodulondb.org` terms (L1-03) | The page is a script shell; no rendered read was made |
| EcoCyc flat files (L7-01) | Released only after the licence form is submitted and reviewed; the form was read, not submitted |
| KEGG gene, pathway and link data (L7-04) | Deliberately not pulled: the API is restricted to academic use and nothing would be redistributable |
| BioCyc pages beyond the two probes of the first pass (L7-01) | Deliberately not requested: page views are metered and scraping is prohibited. No BioCyc or EcoCyc web-service call was made in the correction pass |
| Publisher policy pages on the licence of supplementary files (PLOS, eLife, Springer Nature, Frontiers, ASM) | Not requested in either pass. The rows say only that no per-file legend or publisher statement was found in the retrieved article XML |
| PRECISE GEO supplementary tables (L1-02), COG membership file (L7-05), GtRNAdb bundle (L8-02), Recode legacy download (L9-02); Wellner 2024 Tables S4 to S14 (L5-15) | Reachable, not downloaded or not opened in this pass |
| Full texts and tables behind the unverified leads listed below | Read at abstract or project-record level only, except PXD062881: its record, file listing, two result files and sample table were read under DEM-244. Its article (PMID 41774798) was not retrieved |
| The search and raw files of PXD062881; `Ecoli_DDA_search_results.zip`, `Ecoli_PQP_library_formats.zip` and the raw files of PXD014948; every file of PXD010126 | Reachable, not downloaded (DEM-244): only the file listings were read. Whether a per-gene table sits inside an unopened archive or search file is not known |
| File listings of the other seven PRIDE leads | Not requested |

### Read and silent ("not reported")

| Item | What is absent |
| --- | --- |
| GtRNAdb front, genome, FAQ and citation pages (L8-02) | Any licence, terms or copyright statement |
| PEC front page (L5-09) | Any terms; the strain basis of the classification |
| MODOMICS front page (L8-03) | Any licence over database content |
| proChIPdb home and About pages (L4-03) | Any licence, terms or copyright statement |
| RegulonDB dataset files (L2-05, L3-01, L4-01) | The reference sequence version of the coordinates |
| Baba 2006 XML (L5-01) | A licence element; only a copyright statement |
| Three PNAS records (L9-04 to L9-06) | Any rights statement |
| Kim 2012 and Cho 2014 (L2-03, L4-02) | The version of `NC_000913` used |
| Choe 2022 article and Text S1 (L5-14) | The number of replicate transposon libraries |
| Mori 2021 article, Dataset EV1 and the Appendix strains section (L6-03b) | A genotype string for sub-strain EQ353 |
| PRECISE-1K article and README (L1-01) | Whether a pseudocount was added before the logarithm |
| Every article XML except Goodall 2018 and Choe 2022 | A licence legend on an individual supplementary file |
| PXD062881 project record, both mzTab files and the sample table (a lead, not a row) | The strain cultured, the growth medium, and what each of the fifteen channels is. The record names the K-12 MG1655 reference proteome only as the search database |

### Queries used in the first pass

Europe PMC REST search, `TITLE:"<article title>"`, `resultType=core`, one query per article named in the rows. NCBI E-utilities `esearch db=gds` for `txid511145[Organism:exp] AND gse[ETYP]`, the same with `"expression profiling by high throughput sequencing"[DataSet Type]`, and `txid83333[Organism:exp] AND gse[ETYP]`. NCBI ID converter for the six PMIDs without a Europe PMC full text. RegulonDB GraphQL `listAllDownloadableFiles` and `getDataOfFile`. UniProt REST `proteome:UP000000625` searches. No keyword sweep of PubMed, GEO, SRA or PRIDE was run in the first pass.

### Bounded counter-example search for layers 5 and 6 (correction pass)

Asked for by the correction handoff with a bound of about forty-five minutes. It ran on 2026-10-05 from 18:15 to 18:24 UTC: about ten minutes of queries and retrieval, plus reading. It stopped when both rounds' result lists had been read in full and the strongest leads checked, not because the space was exhausted, and it is not a systematic review.

**Search record.** The companion file `ecoli_source_dossier_search_manifest_20261005.tsv` holds one record per request: the endpoint, every parameter, the exact address sent, and for each of two retrievals the UTC time, the hit count, the number of records returned and the SHA-256 of the response, with the identifiers returned. The sentence that stood here pointed to a scratch manifest that was not delivered; the companion file replaces it. The twelve queries are fourteen requests, because the PRIDE query is three pages. The manifest also records the six lookups made beside them (the GEO records of the fifteen series and five identifier lookups for leads), 20 requests in all. All are GET requests: Europe PMC at `https://www.ebi.ac.uk/europepmc/webservices/rest/search`, PRIDE at `https://www.ebi.ac.uk/pride/ws/archive/v3/search/projects`, GEO at `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi`. Each Europe PMC and GEO request is a single page whose size is not less than the hit count. The PRIDE response body carries no total, so its count is the sum over the pages up to the empty page 2; a `total_records: 133` response header was read on a further request of page 0.

**Re-issue under DEM-244.** Every request was sent again unchanged on 2026-10-05 between 19:10:07 and 19:18:51 UTC. No count differs from the one first reported, and every request returned the same identifiers in the same order, so the re-issue surfaced no record absent from the first reading. Four of the 20 responses have a different SHA-256 at the same length (`cx_epmc_tnseq_mg1655`, `cx_epmc_proteome_mg1655`, `cx_epmc_proteome_ecoli_absolute`, `cx_pride_mg1655_p0`): their parsed JSON is equal and only the order of object keys differs. The manifest gives both hashes for every request.

| Key | Request parameters, decoded (the manifest gives the encoded address) | First run (UTC), count | Re-issue (UTC), count | Identifiers |
| --- | --- | --- | --- | --- |
| `cx_epmc_tnseq_mg1655` | `resultType=core & pageSize=200 & format=json & query=(TITLE:"MG1655" OR ABSTRACT:"MG1655") AND (ABSTRACT:"Tn-seq" OR ABSTRACT:"TnSeq" OR ABSTRACT:"TraDIS" OR ABSTRACT:"transposon sequencing" OR ABSTRACT:"transposon insertion sequencing" OR ABSTRACT:"transposon-directed insertion" OR ABSTRACT:"RB-TnSeq" OR ABSTRACT:"INSeq")` | 18:15:24Z, 8 | 19:10:07Z, 8 | same list, same order |
| `cx_epmc_tnseq_ecoli_essential` | `resultType=core & pageSize=200 & format=json & query=(TITLE:"Escherichia coli" OR ABSTRACT:"Escherichia coli K-12") AND (ABSTRACT:"essential genes" OR ABSTRACT:"gene essentiality") AND (ABSTRACT:"Tn-seq" OR ABSTRACT:"TraDIS" OR ABSTRACT:"transposon sequencing" OR ABSTRACT:"transposon insertion sequencing" OR ABSTRACT:"transposon mutagenesis")` | 18:15:27Z, 17 | 19:10:09Z, 17 | same list, same order |
| `cx_epmc_crispri_mg1655` | `resultType=core & pageSize=200 & format=json & query=(TITLE:"MG1655" OR ABSTRACT:"MG1655" OR ABSTRACT:"Escherichia coli K-12") AND (ABSTRACT:"CRISPRi" OR ABSTRACT:"CRISPR interference") AND (ABSTRACT:"genome-wide" OR ABSTRACT:"genome-scale" OR ABSTRACT:"pooled" OR ABSTRACT:"library")` | 18:15:29Z, 5 | 19:10:11Z, 5 | same list, same order |
| `cx_epmc_crispri_ecoli_essential` | `resultType=core & pageSize=200 & format=json & query=TITLE:"Escherichia coli" AND (ABSTRACT:"CRISPRi" OR ABSTRACT:"CRISPR interference") AND (ABSTRACT:"essential genes" OR ABSTRACT:"gene essentiality" OR ABSTRACT:"fitness")` | 18:15:31Z, 9 | 19:10:13Z, 9 | same list, same order |
| `cx_epmc_proteome_mg1655` | `resultType=core & pageSize=200 & format=json & query=(TITLE:"MG1655" OR ABSTRACT:"MG1655") AND (ABSTRACT:"proteome" OR ABSTRACT:"proteomics" OR ABSTRACT:"proteomic") AND (ABSTRACT:"quantitative" OR ABSTRACT:"absolute" OR ABSTRACT:"quantification" OR ABSTRACT:"abundance")` | 18:15:33Z, 15 | 19:10:16Z, 15 | same list, same order |
| `cx_epmc_proteome_ecoli_absolute` | `resultType=core & pageSize=200 & format=json & query=TITLE:"Escherichia coli" AND (TITLE:"proteome" OR TITLE:"proteomics" OR TITLE:"proteomic") AND (ABSTRACT:"absolute" OR ABSTRACT:"copies per cell" OR ABSTRACT:"copy numbers" OR ABSTRACT:"mass fraction")` | 18:15:36Z, 24 | 19:10:18Z, 24 | same list, same order |
| `cx2_epmc_ft_tnseq` | `resultType=lite & pageSize=100 & format=json & query=TITLE:(transposon OR "Tn-seq" OR TraDIS OR essential OR essentiality) AND "MG1655" AND ("essential genes" OR "gene essentiality") AND ("Tn-seq" OR TraDIS OR "transposon sequencing" OR "transposon insertion sequencing") AND OPEN_ACCESS:y` | 18:20:14Z, 24 | 19:10:20Z, 24 | same list, same order |
| `cx2_epmc_ft_crispri` | `resultType=lite & pageSize=100 & format=json & query=TITLE:(CRISPRi OR "CRISPR interference" OR dCas9) AND "MG1655" AND ("genome-wide" OR "genome-scale") AND (fitness OR essential) AND OPEN_ACCESS:y` | 18:20:16Z, 19 | 19:10:22Z, 19 | same list, same order |
| `cx2_epmc_ft_proteome` | `resultType=lite & pageSize=100 & format=json & query=TITLE:(proteome OR proteomic OR proteomics) AND "MG1655" AND ("copies per cell" OR "absolute quantification" OR "mass fraction" OR iBAQ OR "absolute protein") AND OPEN_ACCESS:y` | 18:20:17Z, 21 | 19:10:25Z, 21 | same list, same order |
| `cx_pride_mg1655_p0` | `keyword=MG1655 & pageSize=100 & page=0` | 18:19:01Z, 100 on this page (133 over the three pages) | 19:10:29Z, 100 on this page (133 over the three pages) | same list, same order |
| `cx_pride_mg1655_p1` | `keyword=MG1655 & pageSize=100 & page=1` | 18:19:07Z, 33 on this page (133 over the three pages) | 19:10:32Z, 33 on this page (133 over the three pages) | same list, same order |
| `cx_pride_mg1655_p2` | `keyword=MG1655 & pageSize=100 & page=2` | 18:19:09Z, 0 on this page (133 over the three pages) | 19:10:34Z, 0 on this page (133 over the three pages) | same list, same order |
| `cx_geo_tnseq` | `db=gds & retmode=json & retmax=200 & term=txid511145[Organism:exp] AND gse[ETYP] AND (Tn-seq OR TnSeq OR TraDIS OR transposon)` | 18:19:14Z, 12 | 19:10:35Z, 12 | same list, same order |
| `cx_geo_crispri` | `db=gds & retmode=json & retmax=200 & term=txid511145[Organism:exp] AND gse[ETYP] AND (CRISPRi OR "CRISPR interference" OR dCas9)` | 18:19:15Z, 3 | 19:10:37Z, 3 | same list, same order |

The first six queries gave 75 distinct records (75 again on the re-issue; the nine Europe PMC queries together gave 131); every title was read, with year, licence label and the strains named in the abstract. The full text of 17 open-access articles was then fetched and read for the strain actually used, and five supplement bundles were opened. A language model was not used to triage: the lists were short enough to read, and the deciding fact (the strain) sits in the methods, not the abstract.

Verified and added as rows: Choe 2022 (L5-14, from the re-check), Wellner 2024 (L5-15), Masoura 2021 (L5-16), Zhao 2019 (L6-10). The Mori 2021 subset (L6-03b) came from the re-check.

Read and not a counter-example, because the measurement is not in MG1655: Champie 2026, mSystems (PMC13185578; transposon fitness in BW25113 in three media at several time points, CC BY: a new BW25113 condition-resolved source, not assessed further); Silvis 2021 (PMC8510551; arrayed CRISPRi library in BW25113); Roberts 2022 (PMC9598634; TraDIS library in BW25113); Schink 2022 (PMC9728487; NCM3722); Wiśniewski and Rakus 2014 (PMC4459560; ATCC 25922, from the abstract); the genome-scale CRISPRi screen of PMID 40157940 (an MG1655(DE3) ΔfadE production strain, CC BY-NC-ND).

Leads not verified (a row was not written; the strain or the table was read only as far as stated):

- Layer 5, transposon sequencing in MG1655 backgrounds, all CC BY articles: Ma 2024 (PMC11304742; TraDIS in K-12 MG1655 and an ETEC strain under tilmicosin; its Data Set S1 lists 47 resistance genes, not a genome-wide call); Nisar 2026 (PMC13532273; MG1655 carrying pACYC184 with sul2 or dfrA1); Alobaidallah 2023 (PMC10295648; MG1655 carrying a bla CTX-M-1 plasmid, 315,925 insertions); Milner 2026 (PMC12956098; TraDIS in MG1655 in LB at pH 4.5); a recG interaction screen (PMC10870727; MG1655 derivatives). Each is condition-specific fitness; none was checked for a baseline essential-gene table.
- Layer 5, CRISPRi in MG1655 backgrounds: Cui 2018 (PMC5954155, CC BY; about 92,000 guides, MG1655); Calvo-Villamañán 2020 (PMC7293049, CC BY-NC; genome-wide library EcoWG1 in LC-E75, the strain of row L5-05); Mathis 2021 (PMC7797047, CC BY; 88 genes, not genome-wide); Rishi 2020 (bioRxiv preprint, Europe PMC PPR116170, DOI 10.1101/2020.03.04.975888, CC BY-ND; about 13,000 genomic features in MG1655; abstract only); Maire 2026 (Nature Microbiology, PMID 42754710, DOI 10.1038/s41564-026-02471-8; no open full text; in vivo screens).
- Layer 6, PRIDE projects returned for MG1655, read at project-record level only unless stated: PXD000283 (Arike 2012 label-free absolute quantification; the record names an MG1655 protein database; the article is not open); PXD003863 (Treitz 2016, relative TMT quantification, acetate against glucose; article not open); PXD035278 (Wu 2023; strain not confirmed); PXD007647, PXD045656, PXD060434 and PXD018153 (titles only); PXD062881 (deposit contents read under DEM-244 and described below; still unverified). Where a per-gene table sits was observed for three projects, and it differs among them, so no general statement about PRIDE deposits is made:
  - Mori 2021 (rows L6-03a and L6-03b): the tables read are publisher supplementary files. The PRIDE project PXD014948 holds 238 raw files and 3 archives, and one archive contains an earlier per-gene workbook whose values match neither version of Dataset EV9 (the rows' licence standing gives the counts).
  - Zhao 2019 (row L6-10): the table read is a publisher supplementary file. The listing of PXD010126 has 16 files (1 EXPERIMENTAL DESIGN, 1 FASTA, 6 OTHER, 4 RAW, 4 SEARCH), none in the RESULT category; its SEARCH files were not opened.
  - PXD062881 (a lead, not a row): the deposit itself holds processed protein-level results. Its listing has 7 files (1 EXPERIMENTAL DESIGN, 2 RAW, 2 RESULT, 2 SEARCH); both RESULT files are mzTab and were read. `Elliot_20210701_1ug_OTE_Aurora-3hr_TMT-15-RTS-MS3.mzTab` has 1,662 protein (`PRT`) records, each with its own UniProt accession and a gene name in its description, and fifteen `protein_abundance_assay` columns that hold numbers for 1,355 records and `null` for 307; the first record is P63284 (clpB). `Elliot_20201015_1ug_OTE_Aurora-FAIMS-3hr_TMTpro-Deg.mzTab` has 1,959 records, 1,818 with numbers and 141 `null`. The project record gives the licence field as "Creative Commons Public Domain (CC0)", the organism as Escherichia coli with no strain, and the reference as MacKrell et al. 2026 (PMID 41774798, DOI 10.1073/pnas.2515265123); it names the K-12 MG1655 reference proteome UP000000625 as the search database. Its suitability is unverified. The strain cultured and the growth medium are not in the record, which speaks only of "exponential and stationary phase Escherichia coli cultures"; what each of the fifteen channels is appears in neither mzTab nor the sample table; the record describes "time-resolved chemoproteomics" of protein degradation, so what the abundance columns measure was not established; and the article was not retrieved. No gene join was made and no row is written.
  - The file listings of the other seven projects were not read, so whether they deposit processed result files, and whether any is suitable, remains to be checked.

## 10. Corrections made under DEM-237

The re-check DEM-231 reviewed commit `a49f18d` and returned ten findings. Each was checked against the source before the dossier was changed; all ten were upheld.

| Finding | What the source shows | What changed |
| --- | --- | --- |
| 1. Mori 2021 holds measured MG1655 proteomics (blocking) | Three biological cultures of MG1655 sub-strain EQ353, seven MS runs, in corrected datasets EV6 and EV9; the first pass's "one MG1655 sample" is a ribosome-profiling sample in GEO | L6-03 split into L6-03a (NCM3722 series) and L6-03b (EQ353); corrected files pinned with SHA-256; layer 6 negative, shortlist and the transfer requirement rewritten. Also found: two single MG1655 CGSC#6300 samples in EV8, and that the per-gene tables are publisher supplements, not PRIDE files (narrowed under DEM-244: section 11) |
| 2. A native-MG1655 Tn-seq study was omitted | Choe 2022 Table S1: 4,498 genes, `b`-number keyed, per-file CC BY 4.0, LB and M9 glucose calls | Row L5-14 added; layer 5 reranked and its negative withdrawn; a bounded search added L5-15, L5-16 and L6-10 |
| 3. Article licence used for supplementary files | Per-file legends exist only in Goodall 2018 and Choe 2022; Cho 2014 and Ettwiller 2016 carry an explicit CC0 data clause | Standing rewritten as "inferred", with the ledger rule it would rest on, in L2-03, L2-04, L3-02, L3-03, L3-05, L4-06, L5-02, L5-05, L5-06, L6-06, L6-08 and the new rows; the CC0 data clause quoted in L2-02 and L4-02; section 4.5 extended |
| 4. RefSeq provenance caveat not carried into the licence evidence | The record says annotation updates derive from EcoCyc; NCBI policy separates government-created from contributed material | Standing of L8-01 and L9-01 rewritten with three more policy quotations; both rows move to "admit with caveat"; shortlist rows 8 and 9 and section 4.6 changed; "admissible" removed from the layer 4 text and shortlist |
| 5. Counts included header and title rows | Every count the re-check listed reproduces | Counts restated as data records in L2-03, L2-04, L3-03, L4-02, L5-05, L6-01 and L6-06, and, for the same defect not listed by the re-check, in L3-02, L3-05, L4-04, L5-01 and L5-02 and Cho 2014 file S8. Yan 2018's member genes counted after splitting compound cells (2,665) |
| 6. Checksum completeness overstated | The PRECISE-1K table hashes were in the scratch manifest but not in the dossier | Section 6.2 and the TSV now carry the full SHA-256, source and retrieval time of the 42 data files inspected; shortlist row 1 reworded |
| 7. PRECISE 1.0 unit drops the pseudocount | Sastry 2019 Methods: log2(TPM + 1) for the final compendium | L1-02 units corrected and quoted. L1-01 checked separately: its sources say log2[TPM] and the file contains exact zeros |
| 8. Superseded proChIPdb address | The 2025 correction moves the site to `prochipdb.com`, which is served | L4-03 rewritten from the corrected address: 65 E. coli entries read, 62 in MG1655 on `NC_000913.3` |
| 9. GtRNAdb page links its assembly | Two link addresses name `GCA_000005845.2` and ASM584v2 | L8-02 corrected; the Thr(CGT) difference recorded |
| 10. BioCyc's other Open Database | The licence names EcoCyc and the F. prausnitzii A2-165 PGDB as Open Databases | L7-01 and section 4.4 corrected, with the Limited Databases clause quoted |

Also corrected without a finding: Schmidt 2016 (L6-01) placed its MG1655 values in Table S6; they are in Table S9, keyed by UniProt accession, in biological triplicate. Dar 2018 (L3-05) is keyed by `BW25113_####` locus tags, not gene symbols alone.

A retrieval slip to record: one batch of the correction pass sent 20 malformed requests (10 to Europe PMC, answered 404, and 10 to NCBI `efetch` with an empty id) because of a shell quoting error. The responses were discarded and the batch was rerun correctly.

## 11. Follow-up under DEM-244

The confirmation DEM-241 reviewed commit `d6c8a9c`, found the ten DEM-231 findings resolved or confirmed as far as the sources could be reached, and left two should-fix findings in section 9. This pass closes them and tightens the two partly confirmed rows. No recommendation, assessment or shortlist position changes.

| Item | What was checked | What changed |
| --- | --- | --- |
| DEM-241 finding 1: the closing sentence of section 9 generalised from Mori 2021 to every PRIDE deposit | The record, file listing, both mzTab result files and the sample table of PXD062881 were read: 1,662 and 1,959 protein records with fifteen abundance columns, as the finding reported for the first file | The sentence is replaced by what was observed for Mori 2021, Zhao 2019 and PXD062881, and says the other seven listings were not read. PXD062881 stays an unverified lead. Section 8's likeliest-error sentence no longer assumes a supplement |
| The same check on the two proteomics rows the sentence was drawn from | The file listings of PXD014948 and PXD010126 were read. PXD014948 holds, inside `Ecoli_SWATH_quant_results.zip`, an earlier per-gene mass-fraction workbook that matches neither version of Dataset EV9 | **A stated fact was wrong.** Rows L6-03a and L6-03b said the per-gene tables are "not PRIDE files" and that the project's CC0 is "evidence about the raw files". Their licence standing is rewritten and their identifier line now names the archives. The tables the rows rest on, their counts, their recommendation and the shortlist are unchanged; whether the CC0 workbook matters is an owner question |
| DEM-241 finding 2: the search could not be rerun from the delivered files | All 20 requests were re-issued unchanged | New companion file `ecoli_source_dossier_search_manifest_20261005.tsv`; the section 9 table now gives the exact parameters and both counts for each request; resolvable identifiers added for the Rishi and Maire leads. No count and no identifier list changed |
| Rows L4-03 and L8-02, partly confirmed by DEM-241, which received HTTP 403 from both sites | Every file behind the two rows was traced to its manifest entry; the home page and list file of proChIPdb and the genome and front pages of GtRNAdb were requested again and returned HTTP 200 with the same bytes | Each row's "Inspected" text now ends with a retrieval record: the address, time, size and SHA-256 of every file read, and a statement that the site-side facts rest on this run's retrieval. Files read and not quoted are listed in section 6.3 |
| Mechanical quotation check | Re-run over the final TSV by a routine that reads only the TSV and the retrieved files | 295 quotations in 74 rows (117 licence, 178 strain, condition and identity) were each found again in the retrieved file named beside them, and all 298 recorded SHA-256 values equal the files on disk; no failure. Not reported: 3 further licence entries are records that were read and carry no rights text (L9-04, L9-05, L9-06). Not retrieved: 5 rows (L5-11, L8-08, L8-09, L8-10, L9-07), and 8 partly retrieved (L1-03, L4-03, L5-07, L5-12, L6-04, L9-04, L9-05, L9-06); what could not be read is in section 9, and the check covers only quotations from files that were retrieved |

This pass made 37 requests with the same plain client; 36 were answered HTTP 200 and one was not. That one is a retrieval slip to record: the address of the PXD014948 archive was first typed with the wrong month directory (`2021/05`, answered HTTP 404) and then taken from the file listing (`2021/03`). No request was refused, and no BioCyc or EcoCyc web-service or API call was made.

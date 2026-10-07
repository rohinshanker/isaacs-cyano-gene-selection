# E. coli multi-omics source review — package P-ECOLI-OMICS

Ticket: `O_ecoli-multiomics-datasets__20261006`. Claude Science session, 2026-10-07.
Repository read-only; nothing in the working tree was modified. No child delegation was used.

All seven return artifacts are named `ecoli_multiomics_<artifact>__20261007`.
This file is the recommendation; the tables carry the evidence.

## 1. What was searched, and what was not

Databases queried on 2026-10-07, with exact query strings, hit counts and screening
outcomes in `ecoli_multiomics_search__20261007.tsv` (21 query rows):

- **PubMed** via NCBI E-utilities — 9 queries, 297 hits, all retrieved, 253 unique records
  screened by title.
- **GEO DataSets (db=gds)** — 5 queries, 650 hits, 544 records retrieved (one query exceeded the
  300-record retmax), 450 unique GSE series screened by title, sample count and GDS type.
- **Europe PMC REST search** (full-text indexed) — 7 queries, 1,676 hits, 438 records retrieved,
  421 unique, screened by title.
- **PRIDE Archive REST v3** — per-accession records for five projects, plus complete file
  listings for four of them (816 and 107 files paged to exhaustion for the two AG3C deposits).
- **GEO FTP supplement directories and `filelist.txt`** for six series, to establish what is
  actually inside each `_RAW.tar` without downloading it.
- **Zenodo API** (record 8284223) and the pinned **GitHub** commit for PRECISE-1K.

Endpoint reachability was re-probed at the start of the session: PubMed/E-utilities, GEO
supplement FTP over HTTPS, ENA portal, BioStudies/ArrayExpress, PRIDE, Europe PMC,
ProteomeXchange, MassIVE, PeptideAtlas, Zenodo, Figshare, Springer static content, UniProt
and NCBI datasets all answered 200.

Not searched or not completed, and therefore not claimed on:

- **ArrayExpress/BioStudies and MassIVE were reachable but not queried.** The GEO and PRIDE
  sweeps were judged to cover the E. coli space; a deposit held only in BioStudies or MassIVE
  would have been missed.
- **Three candidate papers could not be read**: Li et al. 2014 (PMC4006352), Balakrishnan et al.
  2022 (PMC9804519) and Lalanne et al. 2018 (PMC5978003) all return HTTP 500 from Europe PMC
  `fullTextXML`, the documented answer for a record outside the open-access subset. The NCBI
  `efetch db=pmc` fallback did not yield the methods body for Li 2014. Everything stated about
  those three comes from their GEO records, their archive deposits, or the repository's own
  dossier — never from their methods text.
- **Metabolomics and tRNA abundance** were not swept as layers of their own. One measured
  metabolic-flux layer is reported because it belongs to the leading bundle (dataset D05).
- Negative statements below are bounded by this search. "No MG1655 Ribo-seq series with three
  replicates per growth condition" means none appeared in the 45 series returned by query
  Q-GEO-05 and the 71 returned by Q-GEO-01, not that none exists anywhere.

## 2. Was a strong matched bundle found?

**Partly. There is no E. coli dataset — in this search — that measures transcript abundance,
protein abundance and ribosome occupancy on the same biological replicates with meaningful
replication.** The field splits into two kinds of study, and the tradeoff the ticket asks about
is real and unavoidable:

- **Same-culture, well replicated, two layers.** The AG3C series (Houser 2015 / Caglar 2017)
  measured mRNA and protein from aliquots of the same flasks, in biological triplicate, across
  57 conditions — but in *E. coli B str. REL606*, and with no ribosome profiling.
- **Three layers, one strain background, different studies.** The NCM3722 work (Zhang 2022 for
  Ribo-seq + RNA-seq at n=3 across 12 conditions; Mori 2021 for the absolute proteome) covers
  all three layers in one genetic background, but the proteome comes from different cultures in
  a different study.
- **The viewer's own strain (K-12 MG1655) is the worst served of the three.** Its best
  ribosome-profiling deposit (Li 2014, GSE53767) contains four libraries in total and publishes
  replicate-pooled tracks; its best mass-spec proteome at the matching medium (Mori's EQ353
  calibration samples) is scaled against that very Ribo-seq dataset, which destroys the
  independence of any comparison between them.

## 3. Ranked shortlist

Ranks are for *this* purpose: supplying replicate-level measurements of the three core layers
under conditions that can be matched. Full evidence per row in
`ecoli_multiomics_datasets__20261007.tsv`.

**Rank 1 — AG3C: Caglar 2017 + Houser 2015 (bundle B1).** D01/D03 (RNA-seq, GEO GSE94117 and
GSE67402) with D02/D04 (proteomics, PRIDE PXD005721 and PXD002140).
Computed from the published sample table (Supplementary Dataset 1, `srep45303-s2.csv`, SHA-256
`1486290b…`): 171 cultures listed, 152 with RNA data, 105 with protein data, **102 with both**;
across 57 conditions, **25 conditions have three complete mRNA+protein cultures and 2 have
four**. Independently, the culture ids appearing in both archives (GEO sample titles
`MURI_0NN` vs PRIDE file names `MURI_NN_*`) intersect in **109** cultures — seven more than the
published matrices use, a discrepancy the sources read do not explain.
Pairing evidence, Caglar 2017 Materials and Methods > Cell Growth, retrieved 2026-10-07 from
Europe PMC PMC5394689: *"Samples for each type of cell composition measurement were taken from
the same batch of flasks, except for those used for flux analysis"*, and *"Each of the three
biological replicates was performed on a separate day."* Houser 2015 Results states the same
design: *"Each biological replicate was performed on separate days."*
Cost: strain REL606, gene ids `ECB_*`, protein ids `YP_*`. No ribosome profiling.

**Rank 2 — NCM3722 translation bundle (B2).** D06/D07 (Zhang 2022, GEO GSE182100) plus D11
(Mori 2021, PRIDE PXD014948 with the 2024 corrected EV tables).
Zhang 2022 Results, PMC9624429: *"Three biological replicates were performed for all the 12
conditions."* Confirmed sample-side: the GEO characteristics group into exactly 24 condition ×
layer cells of 3 samples each (12 conditions × {RNA-seq, Ribo-seq} × 3). Reads are mapped to
`escherichia_coli_k12_nc_000913_3` — the viewer's own assembly — and `GSE182100_RAW.tar` holds
per-sample `gene_counts.txt.gz` for all 72 libraries, so replicate-level matrices exist for both
layers without reprocessing.
Cost: NCM3722, not MG1655; chemostat-heavy conditions; the proteome layer is cross-study; and
the retrieved text does not say whether each RNA-seq and Ribo-seq pair came from one culture.

**Rank 3 — Schmidt 2016 absolute proteome (D10, PXD000498 + article tables).** Results >
Experimental design, PMC4888949: *"We grew E. coli BW25113 under 22 different growth conditions
in biological triplicates."* Widest condition coverage of any proteome found, in absolute copies
per cell. Cost: BW25113 for all 22 conditions (MG1655 only in glucose and LB), no same-culture
RNA or Ribo-seq, and the per-condition recipes were not retrieved this session.

**Rank 4 — PRECISE-1K (D14).** 1,035 RNA-seq samples, 582 of them MG1655, b-number namespace,
one QC'd matrix. Computed from `metadata_qc.csv` (SHA-256 `a1358525…`): the 582 MG1655 samples
fall into 309 project × condition groups, of which **254 have 2 samples, 47 have 1, 7 have 3 and
1 has 6**; the unperturbed reference set (M9 + glucose 2 g/L + NH4Cl + O2 + 37 °C + pH 7 + batch,
not evolved, no supplement) pools to **33 samples across 12 condition labels**. Cost: pairs, not
triplicates, within any one project; no protein or translation layer anywhere in it.

**Rank 5 — Zhao 2019 (D13, PXD010126)** for an MG1655 proteome in M9 glucose at n=2, and
**Mohammad 2019 (D17, GSE119104)** as the MG1655 ribosome-profiling *protocol* reference with no
replicated condition. Both are useful anchors, neither is a measurement set to build on.

Screened and rejected as primary sources: Lalanne 2018 (GSE95211, n=1 per E. coli condition),
Mori's own Ribo-seq (GSE139983, three single samples), Tomuro 2024 (GSE233555 — 8 E. coli
samples, all method arms), Balakrishnan 2022 (GSE205717 — 19 of 31 metadata groups are single
samples and most of the series is a rifampicin decay time course).

## 4. Best source for each core layer

| Layer | On the viewer's strain (MG1655) | Best overall |
| --- | --- | --- |
| Transcript abundance | **D14 PRECISE-1K** — 582 MG1655 samples, b-numbers, QC'd matrix, mostly n=2 | D01 (AG3C, n=3 × 57 conditions) if REL606 is acceptable |
| Protein abundance | **D13 Zhao 2019** (M9 glucose, n=2) or Mori's EQ353 samples (MOPS minimal, 3 cultures) | **D10 Schmidt 2016** — 22 conditions in biological triplicate, absolute units (BW25113) |
| Ribosome occupancy | **D08 Li 2014** — 2 minimal-medium libraries, pooled tracks | **D06 Zhang 2022** — 12 conditions × n=3, counts per replicate, NC_000913.3 |
| Measured extra layer | — | D05 AG3C 13C flux ratios (triplicate, separate cultures by design) |

## 5. Fallback and the gaps that remain

The fallback, if the lab will not accept a non-K-12 strain, is **B6: no bundle at all** — take
PRECISE-1K for mRNA, Schmidt 2016 for protein, Zhang 2022 for translation, and make no
cross-layer inference. Each is defensible on its own; together they span three strains and three
media families, so any ratio computed across them is a cross-strain, cross-study quantity.

Gaps, stated as gaps rather than as absences in the world:

1. **No ribosome profiling exists for any same-culture multi-omics series found here.** The AG3C
   cultures are long gone; the layer cannot be added retrospectively.
2. **No MG1655 RNA-seq in MOPS minimal glucose** turned up, which is what blocks bundle B3 —
   the only MG1655 combination where a Ribo-seq and a proteome share a medium.
3. **Independence hazard, flagged as the ticket asks:** Mori 2021 Dataset EV9 reports xTop
   protein mass fractions *scaled per protein to Li 2014 ribosome-profiling synthesis rates*. A
   comparison of EV9 against GSE53767 is circular. Use the unscaled EV6 values instead.
4. **Schmidt's 22 condition recipes** were not retrieved, so B5's condition alignment is
   unfinished.
5. **Namespace work is unavoidable for the leading bundle.** AG3C is keyed by `ECB_*` and `YP_*`;
   placing it beside a b-number viewer requires a documented crosswalk and, under this
   repository's contract, a cross-strain claim. This return does not perform or propose a join.

## 6. Acquisition order

1. `GSE182100_RAW.tar` (9,134,080 bytes) — per-replicate gene counts for RNA-seq **and**
   Ribo-seq, already on NC_000913.3. Lowest effort per unit of usable signal of anything in this
   review.
2. The three AG3C supplement members already retrieved and checksummed here (F03/F04/F05):
   sample table, 4,196 × 152 mRNA matrix, 4,196 × 105 protein matrix.
3. `GSE94117_RAW.tar` and `GSE67402_counts.csv.gz` (the latter already retrieved, SHA-256
   `4d8e8e4b…`) for raw AG3C counts, if the normalised supplement matrices are not enough.
4. Schmidt Table S6 from the PMC4888949 supplement, then its per-condition recipes, to decide
   whether B5 can be closed.
5. Mori's corrected Dataset EV6 (`44320_2024_62_MOESM1_ESM.xlsx`) — unscaled values only.
6. PRECISE-1K `log_tpm_qc.csv` from the pinned commit, not the 278 MB Zenodo archive.

## 7. Boundaries and label discipline

This return is evidence and recommendation. It admits nothing, grants no licence permission,
performs no identifier join and makes no lab decision. Licence text is quoted with its location
in `ecoli_multiomics_files__20261007.tsv`; note that the two AG3C PRIDE deposits and Schmidt's
carry PRIDE's `EBI terms of use` rather than an affirmative open licence, while PXD014948 carries
`Creative Commons Public Domain (CC0)` — all four read from the REST v3 `license` field on
2026-10-07.

Cell labels follow the repository's convention: **not reported** means the source was read and is
silent; **not retrieved** means the source could not be read this session; **not inspected** means
the file was fetched but its contents were not opened.

Declared deviations from the package's stated return shape:

- `datasets.tsv` has one row per dataset × **condition set** × layer (19 rows), not one row per
  dataset × condition × layer. Per-condition detail lives in `conditions.tsv`.
- `conditions.tsv` covers the 57 AG3C conditions, the 12 Zhang conditions and five
  single-condition or summary rows (74 total). Schmidt's 22 conditions are one summary row, not
  22 rows, because the recipes were not retrieved.
- `samples.tsv` has 477 rows covering the twelve datasets with per-sample archive records. Zhao
  2019, Schmidt 2016 and the Mori proteome have no per-sample rows: their deposits expose MS run
  files, not sample records that could be mapped to cultures without reading tables not retrieved
  this session.
- Shortlisted matrices were retrieved and checksummed where they are small enough to fetch inside
  a session (7 data files, rows F01-F07); the rest are listed with exact URLs, member names and
  the processing each needs.
- Rows F23-F31 of `files.tsv` are the quotation sources themselves — the four Europe PMC
  full-text XML documents, three GEO SOFT records and two PRIDE REST records every quotation and
  replicate count in this return was read from — each with its URL, byte size and SHA-256 as
  served on 2026-10-07, so intake can re-match the quotations mechanically against the same bytes.

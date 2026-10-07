# Source-ledger integrity

The reader-facing Citations & sources tab is driven by
`site/data/citations.json`. Keep **primary data** before
**methods, design, validation & software**. Each entry needs a traceable source
URL, an accurate citation, and a sentence saying exactly what this release used.
Do not list a paper merely considered for future integration as current data.

For each repository file offered as a download, set `filename` to the exact
basename of `repoPath` and `url` to the corresponding GitHub raw URL. The browser
fetches the bytes and saves a Blob under that name because cross-origin links to
raw TSV files may open inline. Keep the View source fallback for offline/CORS
failures. Label original NCBI files and project-derived tables differently; do
not call an extracted or normalized table the publisher's unmodified file. The
large gitignored genome inputs are retrieved at build time and cannot be
offered as downloads from this repository.

When a source or a retained file changes, update the ledger in the same patch.
`tests/test_citations_manifest.py` checks that every retained annotation input,
declared expression table, and key derived evidence table is represented by a
tracked file with an exact filename and URL. The site module tests cover
manifest loading, URL safety, and download-response handling:

```sh
.venv/bin/python -m pytest -q tests/test_citations_manifest.py
node --test tests/js/citations.test.mjs
```

For a release, also open the actual site at mobile, tablet, and desktop widths;
verify source ordering, no horizontal overflow, keyboard tab navigation, map
restoration, and one successful browser download with its exact suggested
filename. Check browser console errors. Preserve source-specific limitations:
Tan et al. 2018 has two biological cultures per condition and measures TSS
initiation, not gene-body abundance; GSE205444 measures PCC 7942, not UTEX
2973; tRNA genomic copy counts and CAI/tAI are proxies, not abundance assays.
The Adomako 2022 article's Data Set S1 legend specifies CC BY 4.0 for the
workbook; the spreadsheet does not repeat the notice. The data set
republishes Rubin 2015 PCC 7942 essentiality calls; cite both studies and label
the exact-join UTEX presentation as a cross-strain assumption. The original
Rubin Dataset S3 is not redistributed. The cited similar-growth observation in
Ungerer et al. 2018 applies at PCC-compatible light, not at the strains' differing
optima or at Rubin's assay conditions.
Retain the GO release/date, CC BY attribution and disclaimer, and ViennaRNA's
custom license and bundled component notices.

The trRosettaRNA hand-off cites the 2026 Nature Protocols server protocol and the
2023 Nature Communications method paper with complete authorship and DOI metadata.
The public server and official standalone package document the submission and custom
secondary-structure formats. This repository prepares inputs only: no submitted
sequence or returned model becomes project provenance automatically. Keep the
external server terms and privacy setting separate from the standalone Apache-2.0
code and the separate PyRosetta licence.

## Licence decisions for the package A candidates, 2026-10-04

Recorded at intake of Claude Science package C
(`docs/notes/handoff/cyano_package_C_licences_20261003.tsv`, SHA-256
`5d8b1a99a72708c02946879accf9ea553edee3150a61407fb23475ef9697241c`), whose rows
quote the governing text for each artifact; the quotations were re-matched at
their stated locations on 2026-10-04 and the two terms pages re-fetched with
matching checksums. The decisions are this repository's, not the return's. They
are permission decisions only: a permitted artifact still needs the
[admission contract](future-data-roadmap.md#admission-contract), a manifest entry,
and a checksum before anything is shown, and nothing has been placed in this
repository under them yet.

**Owner decisions, 2026-10-05.** The repository owner decided two things that sit
above the table below.

- *Calibration downloads.* Agents may download any candidate table for calibration
  and analysis, whatever its row below says, provided nothing from it enters
  `data/` or `site/` without the admission contract. This replaces "is not
  fetched". A Claude Science pilot had already fetched seven permitted GEO tables
  into its session sandbox on 2026-10-05 on this ledger's strength; that is now
  covered.
- *Redistribution.* The owner accepts redistribution of derived tables with proper
  attribution, on the basis that this is publicly funded, non-commercial research
  and nothing is sold. The same decision covers tracking the 2026-09-30 return and
  its ortholog table in this repository. Recorded with one caveat from the agent
  that made the table: attribution and non-commercial use satisfy a CC BY or CC
  BY-NC licence, but not the no-derivatives term of the three CC BY-NC-ND rows, an
  all-rights-reserved article, or BioCyc's and KEGG's own terms, which funding
  does not change. The rows below keep their evidence-based reading so that the
  difference stays visible; an artifact shipped under the owner's decision against
  a "not permitted" or "undetermined" row says so in its manifest entry.

**Owner decision, 2026-10-06: the distribution rule is withdrawn.** Every
dataset the project uses is cited by source, deposit and article, and that
citation is the whole condition: no artifact is held link-only, not fetched, or
kept from a derived table or a download on account of its licence, and the
no-derivatives and all-rights-reserved readings below no longer gate anything.
The licence facts stay recorded in the package C table and in each row's note so
that the attribution is right and the history is visible; the admission contract
(manifest entry, checksum pin, documented join, condition record) still governs
what is shown. Everything the earlier rules kept back is queued for ingestion in
[O_licence-unblocked-sources__20261006](../notes/tickets/O_licence-unblocked-sources__20261006.md).
Two matters are access terms, not distribution, and are unchanged: BioCyc's and
KEGG's own terms govern how their pages and APIs are read (the owner signs in to
BioCyc in person), and SRI's open-database terms ask for the attribution
statement and notification recorded in the E. coli ticket.

The rules the evidence-based decisions followed until 2026-10-06, kept for the
record:

- An affirmative grant over the files was required to redistribute them or a
  table derived from them; among the 57 artifacts the only such grant was the
  PRIDE per-project `license` field reading `Creative Commons Public Domain
  (CC0)`.
- NCBI asserts no licence over GEO or RefSeq submitter data and disclaims the
  ability to grant permission; for a GEO series whose article is CC BY, the
  article's licence was taken as the grant, following the shipped GSE205444
  table (PMID 35814646, CC BY 4.0). A CC BY-NC-ND article excluded a derived
  table; an all-rights-reserved article, a PMC text-mining notice, an unreadable
  article, or no article left no grant and the artifact stayed link-only.
- A RefSeq accession has two layers: the PGAP annotation is a US-government
  work and public domain; the submitted assembly bytes fall under NCBI's data
  usage policies. Annotation files were retained as reproducibility inputs and
  never offered as a product download. For `GCF_000005845.2` (E. coli K-12
  MG1655, annotation derived from EcoCyc, no PGAP provider block) the
  public-domain premise does not hold, and the record is cited to both NCBI
  RefSeq and the named curator; the owner's decision of 2026-10-06 on
  curator-submitted RefSeq annotation (publish with attribution to both layers,
  cite NCBI RefSeq, EcoCyc with the BioCyc attribution statement and link, and
  Blattner et al. 1997) stands as the citation rule.
- "Undetermined" was a decision: link-only until the governing text was read.
  Seven such rows were read on 2026-10-06 from the owner-supplied papers through the
  package B and C addendum (`docs/notes/handoff/cyano_package_BC_addendum_20261006.md`).

| Artifact | Strain | Decision |
| --- | --- | --- |
| GSE102914 | PCC 7942 | permitted: cite the deposit and the article (owner decision 2026-10-06; was not permitted: the article is publisher copyright with no open licence (read 2026-10-06 from the supplied PDF)) |
| GSE103462 | PCC 7942 | permitted: cite the deposit and the article (owner decision 2026-10-06; was not permitted: the article is CC BY-NC-ND (read 2026-10-06 from the supplied PDF), which excludes a derived table) |
| GSE103463 | PCC 7942 | permitted: cite the deposit and the article (owner decision 2026-10-06; was not permitted: the article is CC BY-NC-ND (read 2026-10-06 from the supplied PDF), which excludes a derived table) |
| GSE103606 | PCC 7942 | permitted: cite the deposit and the article (owner decision 2026-10-06; was undetermined: no grant over the files and the article terms were not readable by deposit) |
| GSE103644 | PCC 7942 | permitted: cite the deposit and the article (owner decision 2026-10-06; was not permitted: the article is CC BY-NC-ND (read 2026-10-06 from the supplied PDF), which excludes a derived table) |
| GSE103704 | PCC 7942 | permitted: cite the deposit and the article (owner decision 2026-10-06; was not permitted: the article is CC BY-NC-ND (read 2026-10-06 from the supplied PDF), which excludes a derived table) |
| GSE104203 | PCC 7942 | permitted: derived per-gene table with attribution under the article's CC BY licence; GEO file fetched at build, checksum-pinned, not committed |
| GSE104204 | PCC 7942 | permitted: derived per-gene table with attribution under the article's CC BY licence; GEO file fetched at build, checksum-pinned, not committed; the row is escalated in B and not admissible as returned |
| GSE105774 | PCC 7942 | permitted: cite the deposit and the article (owner decision 2026-10-06; was not permitted: the article is CC BY-NC-ND (read 2026-10-06 from the supplied PDF), which excludes a derived table) |
| GSE122841 | PCC 7942 | permitted: derived per-gene table with attribution under the article's CC BY licence; GEO file fetched at build, checksum-pinned, not committed |
| GSE140121 | PCC 7942 | permitted: derived per-gene table with attribution under the article's CC BY licence; GEO file fetched at build, checksum-pinned, not committed; conditional on the indirect article association B reports |
| GSE18902 | PCC 7942 | permitted: cite the deposit and the article (owner decision 2026-10-06; was not permitted: the PMC article page shows no open licence, only the PMC copyright notice (read 2026-10-06)) |
| GSE205443 | PCC 7942 | permitted: derived per-gene table with attribution under the article's CC BY licence; GEO file fetched at build, checksum-pinned, not committed; the row is escalated in B and not admissible as returned |
| GSE205445 | PCC 7942 | permitted: derived per-gene table with attribution under the article's CC BY licence; GEO file fetched at build, checksum-pinned, not committed; the row is escalated in B and not admissible as returned |
| GSE222067 | PCC 7942 | permitted: derived per-gene table with attribution under the article's CC BY licence; GEO file fetched at build, checksum-pinned, not committed |
| GSE225426 | PCC 7942 | permitted: cite the deposit and the article (owner decision 2026-10-06; was undetermined: no grant over the files and no article) |
| GSE227397 | Synechococcus elongatus | permitted: derived per-gene table with attribution under the article's CC BY licence; GEO file fetched at build, checksum-pinned, not committed |
| GSE237858 | PCC 7942 | permitted: cite the deposit and the article (owner decision 2026-10-06; was not permitted: the article is CC BY-NC-ND, which excludes a derived table) |
| GSE252562 | PCC 7942 | permitted: cite the deposit and the article (owner decision 2026-10-06; was not permitted: no grant over the files and the article is all rights reserved or text-mining only) |
| GSE254350 | PCC 7942 | permitted: cite the deposit and the article (owner decision 2026-10-06; was not permitted: the article is CC BY-NC-ND, which excludes a derived table) |
| GSE288532 | Synechococcus elongatus | permitted: derived per-gene table with attribution under the article's CC BY licence; GEO file fetched at build, checksum-pinned, not committed |
| GSE311172 | PCC 7942 | permitted: cite the deposit and the article (owner decision 2026-10-06; was undetermined: no grant over the files and no article) |
| GSE327989 | PCC 7942 | permitted: derived per-gene table with attribution under the article's CC BY licence; GEO file fetched at build, checksum-pinned, not committed; conditional on the indirect article association B reports |
| GSE335065 | PCC 7942 | permitted: cite the deposit and the article (owner decision 2026-10-06; was not permitted: the article is CC BY-NC-ND, which excludes a derived table) |
| GSE45762 | PCC 7942 | permitted: derived per-gene table with attribution under the article's CC BY licence; GEO file fetched at build, checksum-pinned, not committed |
| GSE50908 | PCC 7942 | permitted: cite the deposit and the article (owner decision 2026-10-06; was not permitted: no grant over the files and the article is all rights reserved or text-mining only) |
| GSE50919 | PCC 7942 | permitted: cite the deposit and the article (owner decision 2026-10-06; was not permitted: no grant over the files and the article is all rights reserved or text-mining only) |
| GSE50920 | PCC 7942 | permitted: cite the deposit and the article (owner decision 2026-10-06; was not permitted: no grant over the files and the article is all rights reserved or text-mining only) |
| GSE50922 | PCC 7942 | permitted: cite the deposit and the article (owner decision 2026-10-06; was not permitted: no grant over the files and the article is all rights reserved or text-mining only) |
| GSE51112 | PCC 7942 | permitted: cite the deposit and the article (owner decision 2026-10-06; was not permitted: no grant over the files and the article is all rights reserved or text-mining only) |
| GSE52486 | PCC 7942 | permitted: cite the deposit and the article (owner decision 2026-10-06; was not permitted: no grant over the files and the article is all rights reserved or text-mining only) |
| GSE59112 | PCC 7942 | permitted: cite the deposit and the article (owner decision 2026-10-06; was not permitted: no grant over the files and the article is all rights reserved or text-mining only) |
| GSE79726 | PCC 7942 | permitted: derived per-gene table with attribution under the article's CC BY licence; GEO file fetched at build, checksum-pinned, not committed |
| GSE89999 | PCC 7942 | permitted: derived per-gene table with attribution under the article's CC BY licence; GEO file fetched at build, checksum-pinned, not committed |
| GCF_022984195.1 | PCC 6301 | permitted: cite NCBI RefSeq, and the named curator source where NCBI names one (owner decision 2026-10-06; was a reproducibility input only) |
| GCF_000010065.1 | PCC 6301 | permitted: cite NCBI RefSeq, and the named curator source where NCBI names one (owner decision 2026-10-06; was a reproducibility input only) |
| GCF_000817325.1 | PCC 6301 | rejected: duplicate of the genome of record; no decision |
| UniProtKB UP000000625 | E. coli K-12 MG1655 | permitted: cite UniProtKB (CC BY 4.0); curated function and GO join for the E. coli annotation layer, admitted 2026-10-06 |
| UniProt-GOA 18.E_coli_MG1655.goa | E. coli K-12 MG1655 | permitted: cite the Gene Ontology Consortium (CC BY 4.0); evidence-coded GO relationships for the E. coli annotation layer, admitted 2026-10-06 |
| GCF_022984265.1 | PCC 6311 | permitted: cite NCBI RefSeq, and the named curator source where NCBI names one (owner decision 2026-10-06; was a reproducibility input only) |
| GCF_030544905.1 | PCC 7942 | permitted: cite NCBI RefSeq, and the named curator source where NCBI names one (owner decision 2026-10-06; was a reproducibility input only) |
| GCF_000012525.1 | PCC 7942 | permitted: cite NCBI RefSeq, and the named curator source where NCBI names one (owner decision 2026-10-06; was a reproducibility input only) |
| GCF_014698905.1 | PCC 7942 | permitted: cite NCBI RefSeq, and the named curator source where NCBI names one (owner decision 2026-10-06; was a reproducibility input only) |
| GCF_022984345.1 | PCC 7943 | permitted: cite NCBI RefSeq, and the named curator source where NCBI names one (owner decision 2026-10-06; was a reproducibility input only) |
| GCF_003957805.1 | UTEX 3055 | permitted: cite NCBI RefSeq, and the named curator source where NCBI names one (owner decision 2026-10-06; was a reproducibility input only) |
| PXD000510 | PCC 7942 | permitted: cite the deposit and the article (owner decision 2026-10-06; was not permitted: no grant over the files (EBI terms of use) and the article is all rights reserved) |
| PXD005105 | PCC 7942 | permitted: cite the deposit and the article (owner decision 2026-10-06; was undetermined: no grant over the files and the article terms were not readable by deposit) |
| PXD005851 | PCC 7942 | permitted: cite the deposit and the article (owner decision 2026-10-06; was split: PRIDE files carry no grant (link-only); the article and its Table S1 legend are CC BY 4.0, so that table may be redistributed with attribution) |
| PXD010000 | PCC 7942 | rejected by package B; no grant over the files; no decision needed |
| PXD011485 | Synechococcus elongatus | files CC0, but the strain is PCC 11801, outside the admitted strains: no admission route; recorded for completeness |
| PXD014590 | Synechococcus elongatus | permitted: CC0 over the deposited files; attribute the deposit and the article |
| PXD019731 | PCC 7942 | permitted: CC0 over the deposited files; attribute the deposit and the article |
| PXD023591 | PCC 7942 | permitted: CC0 over the deposited files; attribute the deposit and the article |
| PXD027430 | PCC 7942 | permitted: CC0 over the deposited files; attribute the deposit and the article |
| PXD030282 | PCC 7942 | permitted: CC0 over the deposited files; attribute the deposit and the article |
| PXD036717 | PCC 7942 | permitted: CC0 over the deposited files; attribute the deposit and the article |
| PXD044412 | PCC 7942 | permitted: CC0 over the deposited files; attribute the deposit and the article |
| PXD062851 | PCC 7942 | permitted: CC0 over the deposited files; attribute the deposit and the article |
| PXD074299 | PCC 7942 | permitted: CC0 over the deposited files; attribute the deposit and the article |

Counts after the owner decision of 2026-10-06: 54 permitted with citation (the
23 earlier permitted rows, the 8 RefSeq annotations, and the 23 rows that were
not permitted, undetermined or split), PXD011485 recorded without an
admission route, and 2 rejected (the duplicate genome-of-record row and
PXD010000). A permitted decision on an artifact that package B escalated
(GSE104204, GSE205443, GSE205445) does not make that artifact admissible as
returned.

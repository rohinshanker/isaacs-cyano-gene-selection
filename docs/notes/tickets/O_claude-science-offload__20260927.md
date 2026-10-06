# O_claude-science-offload__20260927 — Open

- **Scope:** Decide which parts of the cross-strain data programme in
  [O_cross-strain-data-scan__20260927](O_cross-strain-data-scan__20260927.md) are
  handed to Claude Science, Anthropic's scientific research agent, rather than done
  in this session; fix what every handoff must specify and what it must return; and
  fix the boundary between its output and admission. Covers `docs/` only until a
  returned package is accepted, after which the scan ticket owns the data work.
- **Status:** open
- **Opened:** 2026-09-27
- **Updated:** 2026-10-04

## Current state

This ticket is the outward-looking half. Its counterpart, the data-use audit of
what is already shipped here, is resolved; its reusable walk is
[data-use-audit-checklist.md](../../validation/data-use-audit-checklist.md).
Keep them separate: this one returns candidate sources, that one returns
findings about existing use.

The scan ticket's steps 2 and 3 are a wide literature and repository sweep across six
strains and seven data types, followed by condition-metadata extraction and pairwise
comparability scoring. That is bounded research with a fixed return shape, which is
the part worth offloading. The crosswalk build, the gene viewer, the chromosome
visualizer, the selectors, and every admission decision stay in this repository.

Package A returned 2026-09-28 and passed intake with one row sent back; its
correction returned 2026-10-03 and passed intake 2026-10-04. Packages B and C were
dispatched 2026-10-02, returned 2026-10-03, and passed intake 2026-10-04, B with
two rows returned for relabelling, under "Package B intake, 2026-10-04" and
"Package C intake, 2026-10-04" below. Package D was sent by the owner, returned
2026-10-04 and passed intake 2026-10-06 under "Package D intake, 2026-10-06"
below: no pair comparable, 32 escalated (all judged by the owner on 2026-10-05),
178 undecidable, 731 not comparable. The licence decisions C's evidence supports are recorded in
[source-ledger.md](../../validation/source-ledger.md#licence-decisions-for-the-package-a-candidates-2026-10-04);
nothing is admitted and nothing has been downloaded. The capability questions that
gated dispatch were confirmed empirically on 2026-09-28 and are recorded under
"Before dispatch" below, with the probe behind each answer.

## Work

### Before dispatch

Confirm, and record here with the date, the exact Claude Science interface used, what
literature it can read beyond open access, whether it can retrieve supplementary
files and repository deposits (GEO, SRA, ArrayExpress, ENA, PRIDE, PeptideAtlas,
MassIVE), and in what format it returns tables. A package whose acceptance criteria
depend on a capability that has not been confirmed is not sent until it has been.
Where a capability is absent, the package is narrowed to what it can do and the
remainder stays in this session.

#### Confirmed 2026-09-28

Every answer below was produced by running the call named beside it from a Claude
Science session with this repository mounted, not from documentation. Counts are the
values those calls returned on that date and will drift as the archives grow.

**Interface, and what "dispatch" means.** Claude Science is an agent session, not an
API endpoint. It cannot be called from an external orchestrator, and no base URL or
key is issued for one, so a work package is dispatched by opening a Claude Science
session and giving it the package text plus, optionally, read or read-write access to
a local path. Confirmed by mounting this branch read-write and recomputing both
`data/expression/sources.json` checksums in place: `GSE205444` and `TAN2018_TSS` both
matched their manifest SHA-256. A package that needs the repository can therefore be
given the repository.

**Return format.** Tables come back as saved artifacts with stable version
identifiers — CSV, TSV, JSON, or Markdown — and can be written directly into a
mounted working tree. The one-row-per-candidate table specified below is satisfiable
as a committed TSV plus a Markdown rendering; no format in the return contract
needs changing.

**Literature beyond open access.** Retrieval is by deposit, not by subscription.
`fetch_article_fulltext` tries Unpaywall, then Semantic Scholar, then PMC, then a
publisher route. Probed on `10.1073/pnas.1814912115` — the subscription PNAS 2018
comparative-genomics paper — Unpaywall reported no OA location and the full text came
back from the PMC deposit (`oa_status: green`). So a paywalled article **with** a PMC
or repository deposit is readable, and one **without** a deposit is not. This is not
paywall circumvention and no package should be written as though it were.

PubMed is reachable as a connector: E-utilities-syntax search, metadata with
PMID/PMCID/DOI, identifier conversion, related-article links, PMC full text, and
copyright status. Probes: `"UTEX 2973"` returned 68 records;
`"UTEX 2973" AND (transcriptome OR "transcription start")` returned 4, including
Tan 2018 at PMID 30127850 / PMC6091082 / `10.1186/s13068-018-1215-8`.

**Licence evidence is article-level, and that matters for package C.**
`get_copyright_status` returns the licence type, its URL, an open-access flag, and
which source the determination came from. Probed: PMID 30127850 → CC BY 4.0, sourced
from PMC; PMID 30409802 → no licence metadata at all, source `not_available`. It does
**not** read a supplement legend or a per-file notice. The Adomako 2022 Data Set S1
case that package C is built around is therefore not answered by this tool; see
"The ASM refusal does not block package C" below, which answers it via Europe PMC
instead.

**Repository deposits and supplementary files.** Reachable and probed:

| Archive | Route | Probe result |
| --- | --- | --- |
| GEO | connector series search + per-series metadata | `"Synechococcus elongatus"[Organism] AND gse[ETYP]` → 49 series; `GSE205444` → 21 samples with characteristics as tag/value pairs, library strategy, instrument, and 5 series supplementary file URLs |
| GEO supplement files | direct HTTPS from `ftp.ncbi.nlm.nih.gov` | 4 of 5 series tables downloaded and SHA-256 computed, e.g. `GSE205444_DESeq2_Normalized_Counts.txt.gz`, 319,795 bytes, `0ec1f4ea…`. The `checksum` column is satisfiable for anything in GEO |
| SRA | NCBI E-utilities | reachable |
| ENA | portal API | reachable |
| ArrayExpress / BioStudies | connector + BioStudies API | reachable; organism facet `Synechococcus elongatus` returned 0 experiments. Whether that is genuine absence or a facet-string mismatch is **not** confirmed, so the scan must re-check by free text before recording "none found" |
| PRIDE | connector project search + v3 web service + `ftp.ebi.ac.uk` | keyword `Synechococcus elongatus` → 14 projects |

**bioRxiv has no keyword search.** The connector filters by date range, recent-days,
category, and server, and rejects a free-text query parameter outright. Preprint
discovery in package A must run through OpenAlex or PubMed, not through the bioRxiv
connector. An OpenAlex key is present in the session.

**Network grants, requested and resolved 2026-09-28.** A Claude Science session runs
behind a host allowlist; seven hosts needed for these packages were initially refused
at the proxy and were granted on request. Re-probed after the grant:

| Host | Needed for | After grant |
| --- | --- | --- |
| `proteomecentral.proteomexchange.org` | ProteomeXchange sweep | HTTP 200, PROXI API serves JSON |
| `massive.ucsd.edu` | MassIVE sweep | HTTP 200 |
| `peptideatlas.org` | PeptideAtlas sweep | HTTP 200 |
| `static-content.springer.com` | BMC/Springer supplements | HTTP 200, `octet-stream` (Tan 2018 ESM fetched) |
| `zenodo.org` | dataset deposits | HTTP 200, API serves JSON |
| `api.figshare.com` | dataset deposits | HTTP 200, API serves JSON |
| `journals.asm.org` | Adomako 2022 legend | **HTTP 403 from ASM itself** — server-side bot refusal, not the allowlist. Not circumvented; no User-Agent spoofing |

**The ASM refusal does not block package C, because the legend is in Europe PMC.**
Probed and confirmed on the exact case the package is built around. For `PMC9239245`
(Adomako 2022, `10.1128/mbio.00862-22`):

- `…/europepmc/webservices/rest/PMC9239245/supplementaryFiles` returned an 8.7 MB zip
  of 25 publisher-deposited files. `mbio.00862-22-s0001.xlsx` is 1,359,396 bytes with
  SHA-256 `b988b744c4c939ce6f47232eacfc30338907a9b911830999eb23414cbe6c331b` —
  **byte-identical** to the copy this release already pins at
  `data/essentiality/source/mbio.00862-22-s0001.xlsx`, and obtained by the same route
  [pcc-essentiality.md](../../validation/pcc-essentiality.md) already documents.
- `…/rest/PMC9239245/fullTextXML` carries the per-file legend in its
  `<supplementary-material>` blocks, 20 of them, including for Data Set S1 the
  statement that copyright is held by Adomako et al. 2022 and the content is
  distributed under the Creative Commons Attribution 4.0 International license —
  which is exactly the article-legend-versus-workbook split package C cites, quotable
  with its location.

So the per-artifact licence evidence package C requires is obtainable for any article
with a PMC deposit, through `www.ebi.ac.uk`, with no publisher host involved. Note the
PMC OA service (`oa.fcgi`) returned 404 for this record — Europe PMC is the working
route, not the NCBI OA packager.

**Consequently.** All four packages are dispatchable. A, B, and D run against GEO,
SRA, ENA, BioStudies, ArrayExpress, PubMed, PRIDE, ProteomeXchange, PeptideAtlas, and
MassIVE. C runs on the Europe PMC route for PMC-deposited articles and on the
repository record for deposits; its one genuine gap is an article that is **neither**
PMC-deposited **nor** repository-hosted, where the governing per-file text is
unreadable and the row must return that fact rather than a guess. Nothing above
changes the hard boundaries below: licence terms still come back as quotation plus
recommendation, never as permission.

### Work packages

Each package is dispatched separately, names the coordinator, this ticket, its
scope, its acceptance criteria, and the return format below, and permits no child
work outside that scope. The six strains are UTEX 2973 and the admitted sister strains
PCC 6301, PCC 6311, PCC 7942, PCC 7943, and UTEX 3055, under
[the sister-strain rules](../../validation/data-contract.md#sister-strains-admitted-for-utex-2973-data).

**A. Systematic sweep per data type.** One package per data type: transcriptomics,
proteomics, ribosome occupancy, TIS, TSS, TTS, and annotations, across the six
strains, following the "Where to look" table in the scan ticket. Acceptance: every
candidate found is a row in the return table, rejected ones included with their
reason; every row carries an immutable identifier resolvable by this session; the
sources already ranked in
[future-data-roadmap.md](../../validation/future-data-roadmap.md#ranked-candidates)
and the sources already shipped (Tan 2018 TSS, the PCC 7942 abundance table, the
Adomako 2022 workbook) are recognised and marked as such rather than returned as
new; and no row asserts a per-gene table exists without naming the file that holds
it.

**B. Condition metadata per study.** For every candidate from A, extract the values
needed to score each axis of
[condition comparability](../../validation/data-contract.md#condition-comparability):
temperature, light intensity as photon flux, light regime including spectrum class,
continuous versus diel and the photoperiod, CO₂ regime, medium with nitrogen source
and any organic carbon, culture format, growth phase with OD₇₅₀ where reported, and
replicate count. Acceptance: each value quotes or cites the sentence, table, or
metadata field it came from; a value the study does not report is returned as not
reported, never estimated from a similar study; a value reported in different units
is returned as reported, with the conversion shown separately.

**C. Licence and redistribution terms per artifact.** For every artifact from A,
locate the terms that govern the specific file, not only the article: journal
licence, supplement or dataset legend, repository record metadata, and any
per-file notice. Acceptance: the return quotes the governing text and its location;
where the article and the artifact differ, both are quoted, as with the Adomako 2022
Data Set S1 legend that specifies CC BY 4.0 while the workbook does not repeat it,
and the ELPRECISE300 repository under MIT beside a CC BY-NC-ND 4.0 paper; the
recommendation is labelled as a recommendation. This session records the permission
decision under [source-ledger.md](../../validation/source-ledger.md).

**D. Candidate pair comparability.** For candidate pairs within one data type,
score every axis against the documented thresholds using the values from B.
Acceptance: each pair returns pass or fail per axis, the overall verdict, and the
failing axis where one fails; a pair that passes on paper but leaves genuine doubt,
or fails one axis narrowly, is returned as escalate with the marginal axis and both
condition sets, not as a verdict; a pair with a not-reported value on any axis the
assay responds to is returned as undecidable, not as a pass.

### Required return format

One row per candidate, for every package, with these columns:

| Column | Content |
| --- | --- |
| `strain` | One of the six admitted strains, as the study names it, plus the culture-collection identifier if the study gives one. |
| `assay` | Data type from the admitted list and the method (for example dRNA-seq, Rend-seq, Term-seq, ribo-seq, LC-MS/MS). |
| `conditions` | One value per comparability axis, each with its source location, or "not reported". |
| `replicates` | Biological replicate count per condition, with the source location; "not stated" where the study does not say. |
| `build` | Genome assembly and annotation release the study used, as the study states it. |
| `licence` | The governing licence for the artifact and the quoted evidence with its location; a recommendation, never a permission. |
| `artifact` | Immutable artifact identifier and accession: DOI, GEO/SRA/PRIDE accession, supplement filename and version, or commit-addressed repository path. |
| `checksum` | SHA-256 of any file actually retrieved, with the retrieval date; empty when nothing was retrieved. |
| `per_gene_table` | Whether a per-gene table exists and which file holds it; "none found" otherwise. |
| `mapping_route` | The identifier namespace the table is keyed by and which documented route could join it: the existing exact shared-protein crosswalk, the approved PCC 6311 and PCC 7943 crosswalk once pinned, or the pangenome row. Never a per-locus mapping. |
| `status` | `candidate`, `rejected`, or `escalate`, with the reason. |
| `source` | A checkable citation for every claim in the row. |

Rejected candidates are returned in the same table with the reason, so that the
scan ticket's record of every candidate, including rejected ones, is complete.

### Hard boundaries

Claude Science output is evidence and recommendation, not admission. Nothing enters a
release without passing the
[admission contract](../../validation/future-data-roadmap.md#admission-contract),
and the intake below runs in this repository. Under that contract a model may help
review bounded descriptions or produce a calibrated estimate but must not decide
licence permission, invent joins, or turn a prediction into a measurement, and the
same applies here. In particular, a returned package must not:

- decide licence permission; it returns the quoted terms and a recommendation;
- invent or infer a locus join; it names the identifier namespace and the candidate
  route, and this repository performs the join under the
  [identifier-crosswalk contract](../../validation/annotation-release-readiness.md#identifier-crosswalk-contract);
- turn a prediction into a measurement, for example a predicted TSS or terminator
  returned as an observed one, or TSS initiation counts returned as gene-body
  abundance;
- resolve a comparability judgment that rows 13 to 15 of
  [AAA-biological-decisions-to-review.md](../../validation/AAA-biological-decisions-to-review.md)
  reserve for the lab: the thresholds themselves, case-by-case pair comparability,
  and UTEX 3055's closeness per data type; or
- return a claim without a checkable source.

A row that violates any of these is returned to the package for correction, not
repaired in this session by guessing.

### Intake

When a package returns, this session checks it under "Verification" below, then
appends accepted candidates to the ranked table in
[future-data-roadmap.md](../../validation/future-data-roadmap.md#ranked-candidates)
in its existing form, records rejected candidates and rejected pairs with their
failing axis in the scan ticket, adds escalated pairs to rows 13 to 15 of the
biological-decisions list with assay, both condition sets, and the marginal axis, and
records licence decisions in the source ledger. Downloads happen only after the
licence decision, following the roadmap's mode-and-pin rules.

## Verification

For each returned package, before anything is appended:

- every `artifact` identifier resolves to the named record, checked directly;
- every `checksum` is recomputed on the file retrieved by this session and matches;
- every `licence` quotation is found at the stated location;
- a sample of `conditions` values, at least one per study, is read against the
  cited sentence, table, or metadata field;
- every row has a `status`, a `source`, and a `mapping_route` that names a
  documented route or "none";
- the table contains rejected rows, and the already-shipped and already-ranked
  sources are marked as such; and
- no row asserts a per-locus mapping, a licence permission, or a comparability
  verdict on an escalated or undecidable pair.

A package failing any check is returned with the failing rows named. The "Before
dispatch" confirmations are recorded in this ticket with their date before the
first package is sent.

### Package A intake, 2026-09-28

Checked in this repository against
[`cyano_package_A_candidates_20260928.tsv`](../handoff/cyano_package_A_candidates_20260928.tsv),
SHA-256 `d6f456174fd10cb4cd265a342134de5e5de0d6580ebc0c93fc1d8b149073001f`, 74 rows.

| Check | Result |
| --- | --- |
| Identifiers resolve | All 74 distinct accessions resolved directly: 49 GSE via GEO's text endpoint, 15 PXD via the PRIDE v2 API, 9 GCF via NCBI Datasets, PRJNA420395 and SRP125902 via the ENA portal. None missing. |
| Checksums | No row carries one; the package retrieved no files, which is inside its scope. Nothing to recompute. |
| Quotations and conditions | Six candidate series sampled: GSE254350, GSE106824, GSE45762, GSE103606, GSE103463, GSE50908. Every claimed condition key and sample count matches the GEO sample characteristics; GSE50908's reference-pool keys come from its second array channel, which is consistent. |
| Required cells | `status`, `source`, `mapping_route`, and `artifact` present on every row. `mapping_route` names the exact shared-protein crosswalk, the PCC 6311/7943 crosswalk target, native UTEX tags, or `none`; no per-locus mapping asserted. |
| Rejected and already-known rows | 16 rejected rows with reasons: 12 ChIP-seq, GSE205444 and PRJNA420395 marked as shipped, GSE309256 as already ranked, GCF_000817325.1 as the genome of record. |
| Boundaries | No licence permission, no join, no comparability verdict; every `licence` cell is labelled a recommendation. |

**Returned for correction, one row.** GSE106824 is listed as a `transcriptomics
(RNA-seq)` candidate, but all 12 of its samples carry `library_strategy =
ChIP-Seq`. It belongs with the twelve rejected ChIP-seq rows. Until the package
corrects it, it is treated as rejected here and is not appended to the roadmap.

**Note for package B.** GSE103606 is a mixed series: 94 RNA-seq samples and 12
ChIP-seq samples. Condition extraction must cover the RNA-seq samples only.

Accepted for the next step: the remaining 57 candidate rows, to be appended to the
ranked table in [future-data-roadmap.md](../../validation/future-data-roadmap.md#ranked-candidates)
with the 16 rejected rows and their reasons recorded in the scan ticket.

### Package A correction intake, 2026-10-04

Sent 2026-10-02, returned 2026-10-03. Checked against
[`cyano_package_A_candidates_20261003.tsv`](../handoff/cyano_package_A_candidates_20261003.tsv),
SHA-256 `b93b079861f18d7daf72391e49b8eb12db3fe581dbd08dbb5a4550f6291916ea`, 74 rows,
manifest section A.1 of
[`RET_claude-science-session__20261003.md`](../handoff/RET_claude-science-session__20261003.md)
(SHA-256 `878295503a853eb98b0762280010da9e2794b589a2c85dbbd2976efc0ca95e5b`, recomputed).

| Check | Result |
| --- | --- |
| Cell-by-cell comparison | Exactly one cell differs from the 2026-09-28 file (SHA-256 `d6f45617…`, recomputed): data row 11, `status`, `candidate` → `rejected: ChIP-seq is not an admitted data type`. The byte diff is a single line. |
| Record re-read | GSE106824 re-fetched 2026-10-04: 12 samples, `!Sample_library_strategy = ChIP-Seq` on all 12, GPL16957, `SubSeries of: GSE103606`. GSE103606: 106 samples, 94 `RNA-Seq` and 12 `ChIP-Seq`, `SuperSeries of:` GSE103462, GSE103463, GSE103644, GSE103704, GSE105774, GSE106824. Both as the return states. |
| Boundaries | Evidence only; no other row changed. |

**Passed.** Two follow-ups the return reported and left to intake, decided here:

- **The `assay` cell of the corrected row** still reads `transcriptomics (RNA-seq)`
  while the twelve sibling rejections read `ChIP-seq (not an admitted data type)`.
  No further correction is requested: the row is rejected, and the scan ticket's
  rejected register records its assay as ChIP-seq with the note.
- **GSE103606 is a SuperSeries whose RNA-seq samples are exactly the union of the
  five SubSeries** GSE103462, GSE103463, GSE103644, GSE103704 and GSE105774. The
  six rows describe 94 samples, not 188. Decision: the five SubSeries are the
  candidate datasets; GSE103606 is kept as a container record and is not counted
  as a dataset, not scored as a pair member in package D, and not promoted on its
  own. Recorded in the roadmap register and the scan ticket.

### Package B intake, 2026-10-04

Sent 2026-10-02, returned 2026-10-03. Checked against
[`cyano_package_B_conditions_20261003.tsv`](../handoff/cyano_package_B_conditions_20261003.tsv),
SHA-256 `fa65266cd402ae974c072e9ad587bd990773d2df002eb08ed856ba4bca0c750e`, 88 data
rows (79 condition-set rows over 48 assay records, 9 annotation rows marked "not
applicable" as the dispatch required), manifest section B of
`RET_claude-science-session__20261003.md`. Row numbers below are data rows, header
excluded.

| Check | Result |
| --- | --- |
| Identifiers resolve | All 57 distinct artifacts resolved directly on 2026-10-04 and each record names itself: 34 GSE via the GEO SOFT text endpoint (`targ=all`), 14 PXD via PRIDE REST v3, 9 GCF via NCBI Datasets v2. |
| Checksums | The `checksum` column is empty on every row; the package retrieved nothing into it. The one file the manifest checksums (B.3.5), `mbo006173609st1.xls` from the Europe PMC `supplementaryFiles` zip for PMC5705920, was re-fetched: 49,152 bytes, SHA-256 `c0bea2222143063edb39ed79b993d7afa9fdc1506cc3c1f7b1ac3f1cdf8ef258`, matches. |
| Quotations | Every `[location; quote: "…"]` segment was re-matched mechanically after Unicode normalisation (514 segments by this parse; the return counts 513). 319 archive-cited quotes are all present in the fetched GEO SOFT or PRIDE records; 20 of them are composites of several GEO fields joined with `\|`, every piece of which is verbatim. 195 paper- or supplement-cited quotes are all present in Europe PMC `fullTextXML` (19 PMCIDs), NCBI `efetch db=pmc` (PMC11473183, PMC4477845), the PMC article page for PMC5167140, or the Table S1 workbook bytes. None missing. |
| Conditions sampled | At least one archive-cited value per study was read against its GEO or PRIDE field for the 39 studies that cite one; the studies whose values come only from a paper (PXD005105, PXD011485, PXD014590, PXD030282, PXD044412, PXD062851, PXD074299 and others) were read against the PMC text. |
| Input corrections, checked | GSE104204: 37 ChIP-Seq and 60 RNA-Seq on GPL17750. GSE50922: 108 samples, 71 on GPL9534, 19 ChIP-Seq, 18 RNA-Seq, SuperSeries of six. GSE205443: 25 × `OTHER`. GSE205445: 25 `OTHER` + 21 RNA-Seq. GSE335065: 9 samples list *Rhodotorula toruloides*. PXD011485: PRIDE title names PCC 11801. PXD014590: PRIDE title names UTEX 2973. GSE252562: six samples titled `LD8:16` with characteristics `LD16:8`. GSE122841: 4 GSMs against "in triplicate". All as the return states. PRIDE lists 47 organisms for PXD005851 and 50 for PXD010000 where the return quotes the papers' 48 and 51; both are the deposits' own descriptions, not an error. |
| Required cells | `status`, `source` and `mapping_route` present on all 88 rows. `mapping_route` names the existing exact shared-protein crosswalk, the PCC 6311/7943 crosswalk target, `none`, or says the carried-over route does not apply while preserving the input value (PXD011485, PXD014590). No per-locus mapping. |
| Boundaries | `licence` carried over unchanged, still "Recommendation only". No join. No comparability verdict: the only "comparable" wording quotes the contract's conditioned-medium rule, and every out-of-band value is routed to package D or the lab, not judged. |
| Not reported versus not retrieved | Held to the return's own definition (B.1 and B.3.4). 15 of the 17 artifacts carrying a `not retrieved` cell are in B.3's unreadable list. Two are not; see below. |

**Returned for correction, two rows.** Data row 31 (GSE225426: `co2`,
`culture_format`, `growth_phase`) and data row 70 (PXD023591: seven axes) are
labelled `not retrieved`. Both deposits have no publication (B.3.4), the deposit
record was read, and B.3.4 itself says that for such records the axes the deposit
omits are returned as `not reported`. The label fails the return's own
distinction. Package D treats those ten cells as not reported either way, so the
relabel does not gate paste 6.

**Treated as rejected here, one row, from package A.** Data row 81 carries strain
`PCC 6301` with artifact `RefSeq GCF_000817325.1`. NCBI Datasets resolves that
accession to *Synechococcus elongatus* UTEX 2973 (taxid 1350461), the genome of
record, which the same table already rejects as data row 51. Package A data row
54 was wrong and the 2026-09-28 intake missed it; B and C carried it unchanged as
their format required. It is recorded as rejected (duplicate of the genome of
record) in the roadmap register and the scan ticket. It needs no condition or
licence work. Whether to send a one-row package A correction for it is the
owner's call; it is listed with the B relabel in the queue so one paste covers
both.

**Observation, not a failure.** GSE50908 and GSE52486, whose paper is unreadable
per B.3.1, give replicates as `not stated; 1 sample per timepoint in GEO sample
list` rather than `not retrieved`. That is consistent with B.3.1's statement that
only replicate structure is left open for the Markson series.

**Accepted:** `docs/notes/handoff/cyano_package_B_conditions_20261003.tsv`,
SHA-256 `fa65266cd402ae974c072e9ad587bd990773d2df002eb08ed856ba4bca0c750e`, as
returned, with rows 31 and 70 pending relabel and row 81 rejected. That file is
what paste 6 names as `<PACKAGE_B_TABLE>`. Downstream: the 29 `escalate` rows and
the one `rejected` row (PXD010000) are recorded in the scan ticket; B.5's
out-of-band values are added as evidence to rows 13 and 14 of the
biological-decisions list; B.6's capability notes are folded into
[claude-science-handoff.md](../../validation/claude-science-handoff.md).

### Package C intake, 2026-10-04

Sent 2026-10-02, returned 2026-10-03. Checked against
[`cyano_package_C_licences_20261003.tsv`](../handoff/cyano_package_C_licences_20261003.tsv),
SHA-256 `5d8b1a99a72708c02946879accf9ea553edee3150a61407fb23475ef9697241c`, 57 data
rows, manifest section C of `RET_claude-science-session__20261003.md`.

| Check | Result |
| --- | --- |
| Identifiers resolve | The same 57 artifacts as package B; all resolved 2026-10-04. |
| Checksums | The `checksum` column is empty on every row, by the package's own boundary (no data file was downloaded). The two governing-text pages the return checksums were re-fetched 2026-10-04 and match byte for byte: NCBI *Policies and Disclaimers*, 38,936 bytes, SHA-256 `8ad8f6f186ca51ec73a5fb8935ecfa17b8cbaad300b7025b381898ab72621869`; EMBL-EBI *Terms of Use*, 30,152 bytes, SHA-256 `f3c148e6b91501af2a516e24edf0be61c21e2ce1b4e9f40bd834c606f1f23ae9`. |
| Quotations | 157 quoted passages re-matched at their stated locations: the Molecular Data Usage and Copyright Status passages on the NCBI policies page; the two EMBL-EBI passages on the terms page; the PRIDE `license` field on each of the 14 PXD rows (10 `Creative Commons Public Domain (CC0)`, 4 `EBI terms of use`, matching the live REST v3 records); and the `<permissions>` text of all 29 PMC records via `efetch db=pmc` or Europe PMC `fullTextXML`. None missing. |
| Required cells | Every `licence` cell carries `REPOSITORY TERMS`, `PER-FILE NOTICE`, `ARTICLE TERMS`, `DIVERGENCE` and a `RECOMMENDATION` segment labelled "not a permission". `status` 37 candidate, 20 escalate; `source` and `mapping_route` present throughout. |
| Boundaries | No permission decided. "permitted" appears only inside quoted CC BY licence text. `conditions` and `replicates` are package A's, carried over as the format required, and are superseded by B; nothing was taken from them. |
| Article classes | As C.3: 24 openly licensed, 10 non-open, 10 unreadable, 13 not applicable. Four of the 24 are CC BY-NC-ND (GSE237858, GSE254350, GSE335065, PXD074299); C's "open licence" label does not separate ND from BY, and the ledger decisions do. |
| Row 37 | `GCF_000817325.1` labelled PCC 6301: the package A duplicate described under package B; treated as rejected. |

**Passed.** The licence decisions are recorded, one per artifact, in
[source-ledger.md](../../validation/source-ledger.md#licence-decisions-for-the-package-a-candidates-2026-10-04).
No file has been downloaded; every download still waits on that ledger entry and
the roadmap's mode-and-pin rules, and no decision there is an admission.

### Package D intake, 2026-10-06

Sent by the owner after 2026-10-04, returned 2026-10-04. Checked against
[`cyano_package_D_pairs_20261004.tsv`](../handoff/cyano_package_D_pairs_20261004.tsv),
SHA-256 `9a45d8384a23ecbf2ea2619043d5610a11d096912020878bd95df59f91ff799c`,
4,279,541 bytes, 941 data rows, manifest
[`RET_claude-science-session__20261004.md`](../handoff/RET_claude-science-session__20261004.md).

| Check | Result |
| --- | --- |
| Checksums | Recomputed 2026-10-06 on the file in `docs/notes/handoff/`: matches the manifest. The input the return names, `cyano_package_B_conditions_20261003.tsv`, recomputed as `fa65266cd402ae974c072e9ad587bd990773d2df002eb08ed856ba4bca0c750e`, the table accepted at Package B intake: matches. |
| Identifiers resolve | 42 distinct accessions across `artifact_a`/`artifact_b` (29 GEO, 13 PRIDE), every one an artifact of the accepted Package B table. Every condition set names its Package B row (`row N [name]`); all 1,882 references (941 pairs × 2) resolve to that row's artifact and condition-set name, none mismatched. 60 distinct condition sets appear in pairs; the manifest's 63 scored units include GSE205443's three fitness sets, which share one accession and so form no pair, as D.5 says. |
| Verdict counts | comparable 0, escalate 32, undecidable 178, not comparable 731; axes passed 0/1/2/3/4/5 of 6 = 127/292/366/134/15/7: all as the manifest's D.2 tables. No duplicate pair. Every escalate and not-comparable row names its marginal or failing axis. GSE122841 is in 55 of the 178 undecidable pairs, as D.3 states. |
| Quotations | The table quotes no source text of its own; its condition values are Package B's cells carried by row reference, which the row check above covers. The seven nearest misses in D.3 are the six turbidostat array pairs (GSE18902/50908/50919/52486, light regime) and GSE50920–GSE51112 (temperature), present in the table with those axes. |
| Boundaries | No pair admitted, no threshold set, no escalation resolved by the return. D.6 reports three input observations without altering a cell: the two `not retrieved` rows intake had already caught (treated as not reported, as the queue row directed), row 81's genome-of-record mislabel (an annotation row, excluded from pairing), and mixed OD wavelengths returned as undecidable rather than converted. |
| Consumption to date | The 32 escalated pairs were already rendered by `tools/pair_review_sheet.py` into `cyano_escalated_pairs_review_20261005.md` and judged by the owner on 2026-10-05 (J10; share/separate/conditional per pair, recorded in AAAA-new-bio-decisions-to-review.md). The OD wavelength point is settled by the owner's J3 (OD₇₃₀ ≈ OD₇₅₀), and the turbidostat light-regime misses by J1 (pass), both decided 2026-10-05, so those undecidable and escalated verdicts are read under the owner's rules, not the return's. |

**Passed.** Nothing in the return is an admission; the pair verdicts are evidence
for the scan ticket's step 3 and for the Data Sources comparable sets, which
already read the owner's judgements over them. The 178 undecidable pairs are the
metadata gap that [O_condition-metadata-gaps__20261005](O_condition-metadata-gaps__20261005.md)
chases. Package D was the last package; nothing further waits to be sent.

## Cleanup

On resolution, fold the return-format table and any capability answer that changed
into [claude-science-handoff.md](../../validation/claude-science-handoff.md), which
already holds the interface confirmations, the boundary list, and the claim and
package workflow; update `validation/INDEX.md` if its row changes; remove this
ticket's rows from the Pending Claude Science queue; then delete this ticket and its
index row. Accepted candidate
rows live on in the roadmap and the source ledger, not here.

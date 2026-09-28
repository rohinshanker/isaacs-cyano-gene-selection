# O_claude-science-offload__20260927 — Open

- **Scope:** Decide which parts of the cross-strain data programme in
  [O_cross-strain-data-scan__20260927](O_cross-strain-data-scan__20260927.md) are
  handed to Claude Science, Anthropic's scientific research agent, rather than done
  in this session; fix what every handoff must specify and what it must return; and
  fix the boundary between its output and admission. Covers `docs/` only until a
  returned package is accepted, after which the scan ticket owns the data work.
- **Status:** open
- **Opened:** 2026-09-27
- **Updated:** 2026-09-28

## Current state

This ticket is the outward-looking half. Its counterpart,
[O_claude-science-data-use-audit__20260928](O_claude-science-data-use-audit__20260928.md),
audits the data already shipped here. Keep them separate: this one returns
candidate sources, that one returns findings about existing use.

The scan ticket's steps 2 and 3 are a wide literature and repository sweep across six
strains and seven data types, followed by condition-metadata extraction and pairwise
comparability scoring. That is bounded research with a fixed return shape, which is
the part worth offloading. The crosswalk build, the gene viewer, the chromosome
visualizer, the selectors, and every admission decision stay in this repository.

Nothing has been dispatched. The capability questions that gated dispatch were
confirmed empirically on 2026-09-28 and are recorded under "Before dispatch" below,
with the probe behind each answer. The work packages and return contract were
written to hold whatever the answers turned out to be, and they do, with two
narrowings: publisher-hosted supplement legends and three proteomics archives are
unreachable without a per-domain network grant, so package C is narrowed and the
proteomics half of package A covers PRIDE only until those grants exist.

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
case that package C is built around therefore cannot be answered by this tool, and
the publisher host that serves that legend is blocked — see the grant list below.

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

## Cleanup

On resolution, fold the return-format table and any capability answer that changed
into [claude-science-handoff.md](../../validation/claude-science-handoff.md), which
already holds the interface confirmations, the boundary list, and the claim and
package workflow; update `validation/INDEX.md` if its row changes; remove this
ticket's rows from the Pending Claude Science queue; then delete this ticket and its
index row. Accepted candidate
rows live on in the roadmap and the source ledger, not here.

# O_claude-science-offload__20260927 — Open

- **Scope:** Decide which parts of the cross-strain data programme in
  [O_cross-strain-data-scan__20260927](O_cross-strain-data-scan__20260927.md) are
  handed to Claude Science, Anthropic's scientific research agent, rather than done
  in this session; fix what every handoff must specify and what it must return; and
  fix the boundary between its output and admission. Covers `docs/` only until a
  returned package is accepted, after which the scan ticket owns the data work.
- **Status:** open
- **Opened:** 2026-09-27
- **Updated:** 2026-09-27

## Current state

The scan ticket's steps 2 and 3 are a wide literature and repository sweep across six
strains and seven data types, followed by condition-metadata extraction and pairwise
comparability scoring. That is bounded research with a fixed return shape, which is
the part worth offloading. The crosswalk build, the gene viewer, the chromosome
visualizer, the selectors, and every admission decision stay in this repository.

Nothing has been dispatched. This session has no verified knowledge of Claude
Science's current interface, its access to paywalled literature, whether it can
retrieve supplementary files or repository deposits, or the formats it returns. The
work packages and return contract below are written so that they hold whatever the
answers turn out to be, and the open item in "Before dispatch" records what must be
confirmed first.

## Work

### Before dispatch

Confirm, and record here with the date, the exact Claude Science interface used, what
literature it can read beyond open access, whether it can retrieve supplementary
files and repository deposits (GEO, SRA, ArrayExpress, ENA, PRIDE, PeptideAtlas,
MassIVE), and in what format it returns tables. A package whose acceptance criteria
depend on a capability that has not been confirmed is not sent until it has been.
Where a capability is absent, the package is narrowed to what it can do and the
remainder stays in this session.

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

On resolution, distil the handoff specification, the return-format table, and the
boundary list into a research-agent handoff contract in `docs/validation/`, update
`validation/INDEX.md`, then delete this ticket and its index row. Accepted candidate
rows live on in the roadmap and the source ledger, not here.

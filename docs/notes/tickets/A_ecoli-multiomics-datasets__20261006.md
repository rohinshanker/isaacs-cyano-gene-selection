# A_ecoli-multiomics-datasets__20261006 — Active

Scope: Find and retrieve experimental E. coli transcriptomics, proteomics,
ribosome-profiling and supporting omics data, prioritising many biological
replicates and matching growth conditions across layers.
Status: active
Opened: 2026-10-06
Updated: 2026-10-07

## Current State

The owner requested a Claude Science literature review on 2026-10-06. Package
P-ECOLI-OMICS was sent and **returned on 2026-10-07; intake passed the same day**
and is recorded below. The ticket is active: the evidence is in, the source
selection and acquisition are not. This explicit request applies to this review and does not change the
repository's default of reading accessible sources locally.

The ideal result is RNA-seq, quantitative proteomics and Ribo-seq measured from
the same biological replicates under the same conditions. If that is unavailable,
use partial multi-omics studies and strong sources for each missing layer from
other experiments, preferably under similar conditions. Report the tradeoff
between more replicates and better matching rather than assuming either always
wins. Dataset suitability is still to be established.

Pre-grounding: the existing [E. coli source dossier](../handoff/ecoli_source_dossier_20261005.md)
and its [TSV](../handoff/ecoli_source_dossier_20261005.tsv) identify leads, but do
not establish the best matched multi-omics bundle. This review extends that work
with a documented search and sample-level checks. Coordinate later ingestion with
[A_add-ecoli-organism__20261005](A_add-ecoli-organism__20261005.md) and
[O_data-sources-selection__20261005](O_data-sources-selection__20261005.md).

## Verification

Ticket creation verified 2026-10-06 by the coordinating Codex session: filename,
H1, status, local file links and both queue entries checked; `git diff --check`
passed. Required gates passed on the current working tree: `npm test` (1,053
passed), `.venv/bin/python -m pytest -q` (464 passed, 1 skipped, 36 subtests
passed), and `.venv/bin/python tools/validate_contract.py` (110 passed, 0 failed,
1 skipped). Research validation and data-source intake remain pending. No
scientific finding or new dataset is admitted by opening this ticket.

## Cleanup

Keep this ticket open through review, intake and acquisition of the selected
sources. On completion, rename it and its H1 to `R_...`, record final validation,
distill only reusable acquisition/condition-matching guidance into
`docs/validation/`, update `validation/INDEX.md`, then delete the resolved ticket
and remove its queue rows. No permanent task history.

## Claude Science claims

This is a bounded research work package, P-ECOLI-OMICS, rather than an asserted
scientific claim. Status: **returned 2026-10-07, intake passed** (below). Its return informs source selection
and acquisition; it does not gate preparation or unrelated organism/UI work.
Any later scientific dependency must become a separate falsifiable claim with
its own evidence and intake under the [handoff contract](../../validation/claude-science-handoff.md).

## P-ECOLI-OMICS: paste-ready Claude Science handoff

Coordinator: interactive Codex session `cyano-ticket-opening`; owner operates
Claude Science and returns the artifacts for intake.
Task: `O_ecoli-multiomics-datasets__20261006`, package P-ECOLI-OMICS. The
package text is kept exactly as it was sent, so it still names the ticket by the
filename it had on 2026-10-06; the ticket became `A_...` when intake passed.
Canonical repository: `/Users/Rohin/Desktop/coding_stuff/ISAACS-LAB/isaacs-cyano-gene-selection`.
Baseline: `main` at `ffcb172cfe97c965ee25424febc628ebfdf17cdb`; ticket/queue
additions and unrelated local work may be present. Read-only repository access
is sufficient. Return the files specified below to the owner; do not edit code,
release data, tickets, or other working-tree files. No child delegation.

### Research question and search

Find public experimental E. coli datasets that can supply transcript abundance,
protein abundance and ribosome occupancy/translation measurements with high
biological replication per condition. Prefer matched multi-omics; independently
measured layers from different studies are acceptable when their conditions are
similar and their differences are explicit. Include metabolomics, tRNA abundance,
or other measured layers when they strengthen a promising bundle; these must not
delay coverage of the three core layers.

- Start with K-12 MG1655, the viewer's reference (`GCF_000005845.2`,
  `NC_000913.3`, `b`-number loci). Expand to other E. coli strains when useful;
  label substrain, genotype and mutations explicitly, and keep their measurements
  distinct from MG1655. Do not discard a strong alternative solely for its strain.
- Search primary papers, supplements and repository records: PubMed/Europe PMC,
  GEO/SRA/ENA, BioStudies/ArrayExpress, PRIDE/ProteomeXchange/MassIVE, and author
  repositories or Zenodo/Figshare as applicable. Record exact queries, dates,
  databases, hits screened and stopping criteria. Search beyond the existing
  dossier; follow data-accession links and relevant citations.
- Seed leads from dossier rows L1-01/L1-02 (PRECISE), L1-06 (Balakrishnan),
  L6-01 (Schmidt), L6-02 (Li), L6-03a/L6-03b (Mori), L6-05 (Mohammad) and
  L6-10 (Zhao). Recheck sample design, corrections and current file versions;
  these are leads, not an approved shortlist or proof of cross-layer pairing.
- Prefer accessible processed per-gene/per-protein matrices retaining individual
  replicates. Retrieve and inspect shortlisted matrices and sample metadata when
  feasible. If only raw reads/MS files or pooled summaries exist, give the exact
  files and required processing rather than implying a ready matrix exists.

### Replicates, matching and quality

Count independent biological replicates **per exact condition and per layer**;
also report technical replicates, total samples, number of conditions and the
number of complete biological replicates paired across layers. Multiple runs,
fractions, multiplex channels, treatments, time points, reused samples and
compendium entries do not automatically add biological replicates. Deduplicate
overlapping publications and deposits. Do not invent a minimum acceptable count:
rank the actual available replication and retain useful lower-count fallbacks.

Distinguish: (1) same biological replicate/culture with matched harvest or split
aliquots; (2) separate cultures within the same study under documented matching
conditions; (3) different studies with similar documented conditions; and
(4) matching unknown. Prove pairing with sample IDs and methods evidence, not
just a shared paper, strain name or nominal medium.

For each condition record strain/genotype, medium recipe, carbon source and
concentration, supplements, temperature, oxygen/aeration, vessel/culture format,
batch versus chemostat, growth rate, phase/OD, harvest time and perturbations.
For Ribo-seq also record harvesting, inhibitor treatment and library protocol.
Missing metadata makes matching uncertain; it is not evidence of equivalence.
Prefer a well-described unperturbed reference condition, while retaining useful
condition series. Explain every mismatch in a fallback bundle.

Report detected gene/protein coverage, replicate-level availability, units,
normalisation, reference assembly and identifier namespace, QC evidence and
missingness. Separate protein abundance, synthesis rate, ribosome occupancy,
translation efficiency and initiation-site profiling. Flag derived values,
pooled-only data and proteomics calibrated against the proposed Ribo-seq source,
which can compromise independence of a cross-layer comparison.

### Return artifacts

Use UTF-8 TSV tables with stable IDs and a Markdown recommendation, named
`ecoli_multiomics_<artifact>__YYYYMMDD`, for owner intake into `docs/notes/handoff/`:

| Artifact | Row unit and required fields |
| --- | --- |
| `review.md` | Search bounds; whether a strong matched bundle was found; ranked shortlist with replicate/matching tradeoffs; best source for each core layer; fallback bundle, gaps and acquisition order |
| `datasets.tsv` | One dataset × condition × layer: stable ID, citation/DOI/PMID, accession, strain/genotype, condition ID, assay, biological/technical n, total samples/conditions, coverage, units/normalisation, assembly/namespace, QC, overlap with other deposits, limitations and rank rationale |
| `samples.tsv` | One biological sample × layer: dataset/condition IDs, biological replicate/culture ID, archive sample/run IDs, technical replicate IDs, time point, pairing group, pairing class and cited evidence; explicitly unknown if no mapping can be recovered |
| `conditions.tsv` | One condition: the growth/harvest fields above, source location for each value, and missingness status |
| `bundles.tsv` | One proposed bundle: condition and dataset IDs for each layer, paired biological n, matching class, observed differences, unknowns and recommendation; include partial and cross-study fallback bundles |
| `files.tsv` | One artifact: dataset ID, exact URL/accession and filename/member/sheet, version/correction, raw/processed/metadata type, size, retrieval date, SHA-256 when retrieved, retrieval status, quoted artifact-level terms and location, access restrictions and processing needed |
| `search.tsv` | One query/screening batch: date, database, exact query, hits returned/screened, inclusion/exclusion reasons and search limits |

Attach retrieved shortlisted processed matrices and metadata separately, or give
exact retrieval instructions if attachments are unavailable. Cite each important
replicate count and pairing/condition assertion with a short quotation, source
location, retrieval date and checksum. Use `not reported` only after reading a
source; distinguish it from `not retrieved` and `not inspected`.

Acceptance: every core layer has a ranked usable candidate or a documented gap;
the shortlist reports real per-condition biological n and complete cross-layer n;
sample pairing and condition similarities are evidenced; file access and processing
needs are clear; and a fallback recommendation is returned even if no full matched
bundle was found. Bound negative findings to the recorded search rather than
claiming that no suitable dataset exists anywhere.

Public or owner-provided access only. Before any step requiring a missing
credential, administrator password, security/privacy approval or app permission,
tell the owner the exact action, resource and reason; wait for their decision.
Do not bypass denied/pending approvals. Follow the handoff contract: evidence is
not licence permission, admission, a locus join or a lab decision.

## P-ECOLI-OMICS result, returned 2026-10-07

**Verdict: supported.** Everything checked in intake reproduced. Two apparent
failures during checking were mistakes of mine, not of the return, and are
recorded below so nobody repeats them.

**Returned text:** the twelve artifacts in `docs/notes/handoff/`, named
`ecoli_multiomics_<artifact>__20261007` and `ecoli_crosswalk_*__20261007`,
unedited. `ecoli_multiomics_review__20261007.md` is the recommendation; the six
TSVs carry the evidence (19 datasets, 477 samples, 74 conditions, 6 bundles, 31
files, 21 search batches), and three further crosswalk tables were returned
beyond the specified set.

**Intake check:** performed 2026-10-07 by the interactive Claude session
`cyano-contract-audit`, against the live archives rather than against the
return's own tables.

| Check | Result |
| --- | --- |
| Accessions resolve | **13 of 13** GEO series resolve in `db=gds`; **5 of 5** PRIDE projects answer HTTP 200 with titles matching the studies named |
| Citations resolve | **13 of 13** PMIDs resolve, and every returned title matches the study the review attributes to it |
| File checksums | **12 of 16** re-downloaded and re-hashed byte-for-byte identical, with declared byte lengths also exact. The other four are blocked, not wrong; see below |
| Quotations | **5 of 5** re-matched after normalising whitespace and case |
| Replicate and pairing counts | every count re-derived independently reproduced exactly; see below |

### Counts re-derived from the sources, not from the return

- **Zhang 2022, GSE182100.** The series matrix holds 72 samples, 36 `RNA-Seq`
  and 36 `OTHER`, all strain NCM3722. Dropping the one characteristic that
  encodes the assay, `molecule subtype`, leaves **12 biological conditions of 6
  samples each**, which is 12 conditions by two layers by three replicates. The
  review's claim is exact. My first pass reported no condition carrying both
  layers; that was my error, from treating the assay label as biology.
- **PRECISE-1K, `metadata_qc.csv`.** SHA-256 recomputed and identical. Filtering
  the `Strain` column to MG1655 gives **582 samples in 309 project-by-condition
  groups, distributed 47 ones, 254 twos, 7 threes and 1 six** — every figure the
  review states. My first pass gave 418 and 211 because I filtered the
  `Strain Description` column instead, which is the wrong column.
- **AG3C culture overlap.** Recomputed from the archives: GSE94117 and GSE67402
  carry 152 and 36 samples, and the `MURI` culture numbers in the two GEO series
  intersect those in the PRIDE file listings of PXD005721 (816 files) and
  PXD002140 (107 files) in exactly **109** cultures. This reproduces the
  review's number, including the discrepancy it flags against the 102 cultures
  the published matrices use, which the sources it read do not explain.

### Quotations, each re-matched against the retrieved source

| Source | Result |
| --- | --- |
| Caglar 2017, PMC5394689, same batch of flasks | exact |
| Caglar 2017, PMC5394689, three replicates on separate days | exact |
| Zhang 2022, PMC9624429, three replicates for all 12 conditions | exact |
| Houser 2015, **PMC4537216**, each replicate on separate days | exact. My first attempt used PMC4529991, which is a different article; the return does not give a wrong id, I guessed one |
| Schmidt 2016, PMC4888949, 22 conditions in biological triplicates | exact apart from an inline citation marker inside the sentence, which the published text renders as a superscript and a plain-text extraction pulls inline |

### The one checksum that does not reproduce, and why it is not an error

`F02` is the Europe PMC supplementary bundle for PMC5394689. On re-download its
byte length is exactly the declared 23,122,877, but its SHA-256 differs.

The cause is the endpoint, not the return. The archive's entries carry the
timestamp of the request rather than of the files, so Europe PMC assembles the
ZIP afresh each time and its digest changes while its contents do not. A
container checksum from that endpoint is therefore **not reproducible by
anyone**, including the session that recorded it. The three members are what
carry the data, and all three match byte-for-byte:

| Member | Bytes | Result |
| --- | ---: | --- |
| `srep45303-s2.csv`, the sample table | 33,095 | exact |
| `srep45303-s3.csv`, the mRNA matrix | 11,074,929 | exact |
| `srep45303-s4.csv`, the protein matrix | 7,732,680 | exact |

Final checksum tally: **15 of 16 exact, and the sixteenth explained.** A future
pin of this source should checksum the members and record the container by byte
length only.

### The AG3C counts, re-derived from the sample table

With `F03` in hand the leading bundle's own numbers reproduce:

| Claim | Re-derived |
| --- | --- |
| 171 cultures listed | 171 |
| 152 with RNA data | 152 |
| 105 with protein data | 105 |
| **102 with both** | **102** |
| 25 conditions with three complete mRNA and protein cultures, 2 with four | 25 and 2, grouping by time point, carbon source, magnesium and sodium |

The separate figure of 57 conditions is not that grouping and does not come from
this table; it is the GEO condition set, which the return states plainly in its
own datasets row and carries as 57 rows in `ecoli_multiomics_conditions__20261007.tsv`.
Grouping the sample table by the key that yields 25 and 2 gives 61, not 57, which
is why the two numbers must not be read as counting the same thing. A third
attempt at a grouping key of mine reproduced 57 but not the replication split;
the return's distinction between the two is correct and mine was the confusion.

Nothing else in the return was refused or unreachable.

### What the return does not do, and must not be read as doing

Evidence, not admission. No dataset is admitted, no licence is granted, no locus
join is authorised and no lab decision is settled by this result. The review
states this itself for the leading bundle: placing AG3C beside a b-number viewer
needs a documented crosswalk and, under this repository's contract, a cross-strain
claim, and the return neither performs nor proposes that join. The three
`ecoli_crosswalk_*` tables are feasibility evidence for it, not the join.

## Work after return

1. Intake the return: resolve citations/accessions, retrieve and recompute file
   checksums, mechanically rematch quotations and verify replicate/pairing counts.
   Record verdict, sources, date and checker here; update the pending queue row.
2. Select the best matched bundle and/or strongest per-layer fallbacks from the
   evidence. Record material tradeoffs and unresolved condition gaps.
3. Fetch selected processed matrices and metadata under pinned versions and
   checksums; inspect per-replicate columns and units. If reprocessing is needed,
   specify and validate that acquisition path before treating it as available data.
4. Apply the [source ledger](../../validation/source-ledger.md),
   [admission contract](../../validation/future-data-roadmap.md#admission-contract)
   and [identifier-crosswalk contract](../../validation/annotation-release-readiness.md#identifier-crosswalk-contract)
   before integration. Preserve strain, condition, replicate and provenance
   records so independent studies cannot appear as paired measurements.
5. Validate any ingestion code with tests shipped alongside it and the repository
   gates. Any resulting UI work also requires rendered validation under the UI skill.

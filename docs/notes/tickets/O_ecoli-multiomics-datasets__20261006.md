# O_ecoli-multiomics-datasets__20261006 — Open

Scope: Find and retrieve experimental E. coli transcriptomics, proteomics,
ribosome-profiling and supporting omics data, prioritising many biological
replicates and matching growth conditions across layers.
Status: open
Opened: 2026-10-06
Updated: 2026-10-06

## Current State

The owner requested a Claude Science literature review on 2026-10-06. Package
P-ECOLI-OMICS below is prepared and queued for the owner's manual session; it has not
been sent. This explicit request applies to this review and does not change the
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
scientific claim. Status: pending, not sent. Its return informs source selection
and acquisition; it does not gate preparation or unrelated organism/UI work.
Any later scientific dependency must become a separate falsifiable claim with
its own evidence and intake under the [handoff contract](../../validation/claude-science-handoff.md).

## P-ECOLI-OMICS: paste-ready Claude Science handoff

Coordinator: interactive Codex session `cyano-ticket-opening`; owner operates
Claude Science and returns the artifacts for intake.
Task: `O_ecoli-multiomics-datasets__20261006`, package P-ECOLI-OMICS.
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

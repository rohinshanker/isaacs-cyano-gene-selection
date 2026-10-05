# SEND_claude-science-session__20261002 — packages ready to paste

Six requests for the owner's next Claude Science session, taken from the
**Pending Claude Science** queue in [the ticket index](../tickets/INDEX.md) under
[claude-science-handoff.md](../../validation/claude-science-handoff.md). Each fenced
block is one complete paste. No agent can send these; delete this file once every
block has been sent and its row in the index carries a Sent date.

## How to use

1. Mount this repository in the session. Pastes 1 to 4 need it read-write so the
   return can be written into `docs/notes/handoff/`; paste 5 must be a **read-only**
   mount.
2. Paste one block per request. Blocks 1 to 5 are independent and can run in any
   order or in separate sessions. **Block 6 waits** until block 1 has returned and
   its intake has passed here.
3. Tell the coordinator which blocks went out and when, so the Sent column is filled.

| Paste | Request | Mount | Unblocks |
| --- | --- | --- | --- |
| 1 | Package B, condition metadata | read-write | Pair scoring, and paste 6 |
| 2 | Package C, licence terms per artifact | read-write | Source-ledger decisions, then downloads |
| 3 | Data-use audit of the shipped site | read-write | Triage of findings |
| 4 | Package A correction, GSE106824 | read-write | Clears one returned row |
| 5 | Crosswalk second check | **read-only** | Admission of any PCC 6311 or PCC 7943 source |
| 6 | Package D, pair comparability | read-write | Scan verdicts; **send after 1 returns** |

## Paste 1: Package B, condition metadata per study

```text
requester:   owner
target:      mythos / fable (the in-repository agents)
ticket:      docs/notes/tickets/O_claude-science-offload__20260927.md
package:     B, condition metadata per candidate study
status:      dispatched 2026-10-02

You are working under docs/validation/claude-science-handoff.md in the mounted
repository. Read it first. Your output is evidence and recommendation, never
admission, licence permission, a locus join, or a lab decision.

INPUT
docs/notes/handoff/cyano_package_A_candidates_20260928.tsv (74 rows, SHA-256
d6f456174fd10cb4cd265a342134de5e5de0d6580ebc0c93fc1d8b149073001f). Work on the
rows whose status is "candidate", with two corrections found at intake:
- GSE106824 is listed as a transcriptomics candidate but all 12 of its samples
  carry library_strategy = ChIP-Seq. Treat it as rejected and skip it.
- GSE103606 is a mixed series: 94 RNA-seq samples and 12 ChIP-seq samples.
  Extract conditions for the RNA-seq samples only.
That leaves 57 rows, about 45 distinct papers. Repository metadata states growth
conditions for almost none of them, so the values have to come from the papers.

TASK
For every one of those candidates, extract the values needed to score each axis
of condition comparability (docs/validation/data-contract.md, "Condition
comparability"):
- temperature
- light intensity as photon flux
- light regime, including spectrum class, continuous versus diel, and the
  photoperiod
- CO2 regime
- medium, with nitrogen source and any organic carbon
- culture format
- growth phase, with OD750 where reported
- replicate count

ACCEPTANCE
- Each value quotes or cites the sentence, table, or metadata field it came from.
- A value the study does not report is returned as "not reported", never
  estimated from a similar study.
- A value reported in different units is returned as reported, with the
  conversion shown separately.
- A row whose assay has no growth condition (the genome annotation rows) is
  returned with conditions "not applicable", not omitted.
- Where a study has several conditions, return one row per condition set, each
  naming the samples it covers.

RETURN FORMAT
One row per candidate (or per condition set), TSV, with exactly these columns:
strain, assay, conditions, replicates, build, licence, artifact, checksum,
per_gene_table, mapping_route, status, source.
- conditions: one value per axis above, each with its source location, or
  "not reported".
- replicates: biological replicate count per condition with its source location,
  or "not stated".
- status: candidate, rejected, or escalate, with the reason.
- source: a checkable citation for every claim in the row.
Carry the other columns over from the input row unchanged unless you found them
wrong, and say so in status when you did.

Write the table to docs/notes/handoff/cyano_package_B_conditions_YYYYMMDD.tsv
and add a section for this package to
docs/notes/handoff/RET_claude-science-session__YYYYMMDD.md (create it if absent,
using the header of RET_claude-science-session__20260930.md), stating the row
count, the table's SHA-256, what could not be read and whether the refusal came
from your sandbox or from the source, and anything in the input you found wrong.
Change no other file.

HARD BOUNDARIES
Do not decide licence permission. Do not invent or infer a locus join. Do not
report a prediction as a measurement. Do not judge whether two studies are
comparable; that is package D and, for marginal cases, the lab. Do not return a
claim without a checkable source. Full text is read by deposit (Unpaywall,
Semantic Scholar, PMC, Europe PMC); do not work around a paywall or a publisher
refusal. No child work outside this scope.
```

## Paste 2: Package C, licence and redistribution terms per artifact

```text
requester:   owner
target:      mythos / fable (the in-repository agents)
ticket:      docs/notes/tickets/O_claude-science-offload__20260927.md
package:     C, licence and redistribution terms per artifact
status:      dispatched 2026-10-02

You are working under docs/validation/claude-science-handoff.md in the mounted
repository. Read it first. Your output is evidence and recommendation, never
admission, licence permission, a locus join, or a lab decision.

INPUT
docs/notes/handoff/cyano_package_A_candidates_20260928.tsv (74 rows, SHA-256
d6f456174fd10cb4cd265a342134de5e5de0d6580ebc0c93fc1d8b149073001f). Work on the
rows whose status is "candidate", except GSE106824, which intake found to be
ChIP-seq and treats as rejected. That leaves 57 rows.

TASK
For every artifact in those rows, locate the terms that govern the specific
file, not only the article: journal licence, supplement or dataset legend,
repository record metadata, and any per-file notice.

ROUTE
Per-file supplement legends come from Europe PMC, confirmed 2026-09-28: for an
article with a PMC deposit, .../europepmc/webservices/rest/<PMCID>/fullTextXML
carries each file's legend in its <supplementary-material> blocks, and
.../rest/<PMCID>/supplementaryFiles returns the deposited files. No publisher
host is needed. journals.asm.org returns 403 from ASM itself; leave it alone. For
a repository deposit (GEO, SRA, ENA, PRIDE, ProteomeXchange, MassIVE,
PeptideAtlas, Zenodo, Figshare) use the repository record. An artifact that is
neither PMC-deposited nor repository-hosted is the one real gap: return that
fact for the row, not a guess.

ACCEPTANCE
- The return quotes the governing text and gives its location.
- Where the article and the artifact differ, both are quoted. Two known examples
  of the pattern: the Adomako 2022 Data Set S1 legend specifies CC BY 4.0 while
  the workbook does not repeat it; the ELPRECISE300 repository is MIT beside a
  CC BY-NC-ND 4.0 paper.
- Every recommendation is labelled as a recommendation.
- Any file you actually retrieve gets its SHA-256 and retrieval date.

RETURN FORMAT
One row per artifact, TSV, with exactly these columns: strain, assay,
conditions, replicates, build, licence, artifact, checksum, per_gene_table,
mapping_route, status, source.
- licence: the governing licence for the artifact, the quoted evidence, and its
  location; a recommendation, never a permission.
- artifact: immutable identifier and accession (DOI, GEO/SRA/PRIDE accession,
  supplement filename and version, or commit-addressed repository path).
- checksum: SHA-256 of any file retrieved, with the retrieval date; empty when
  nothing was retrieved.
- status: candidate, rejected, or escalate, with the reason.
Carry the other columns over from the input row unchanged.

Write the table to docs/notes/handoff/cyano_package_C_licences_YYYYMMDD.tsv and
add a section for this package to
docs/notes/handoff/RET_claude-science-session__YYYYMMDD.md (create it if absent,
using the header of RET_claude-science-session__20260930.md), stating the row
count, the table's SHA-256, and every artifact whose governing text could not be
read, with whether the refusal came from your sandbox or from the source. Change
no other file.

HARD BOUNDARIES
Do not decide licence permission; the decision is recorded here in
docs/validation/source-ledger.md. Do not download a data file beyond what is
needed to read its terms. Do not invent a join. Do not return a claim without a
checkable source. No child work outside this scope.
```

## Paste 3: data-use audit of the shipped site

```text
requester:   owner
target:      mythos / fable (the in-repository agents)
ticket:      docs/notes/tickets/O_claude-science-data-use-audit__20260928.md
package:     semantic audit of how the shipped data is used, derived, and
             described
status:      dispatched 2026-10-02

You are working under docs/validation/claude-science-handoff.md in the mounted
repository. Read it first, then read the ticket named above in full: its
sections "What to audit" (A to E), "Required return format", and "Hard
boundaries" are this package's text and are not repeated here.

SCOPE
Audit branch main as you find it; state the commit you audited. The pinned
release is under site/data/ and data/, the contracts are under docs/validation/
(start with data-contract.md), and the code that displays the data is under
site/js/. The deployed site is
https://rohinshanker.github.io/isaacs-cyano-gene-selection/. Read the primary
literature behind each shipped source by deposit.

The five questions, in the ticket's words:
A. Does each value still mean what its source measured?
B. Where is anything filled in, and is it allowed?
C. Are units and scales honestly mixed?
D. Does the prose match the data?
E. Do the validation documents match the code?

RETURN FORMAT
One finding per row, each independently checkable, with these fields:
Location (exact file and line, or the exact data field and artifact), Claim
(what the site currently asserts or does, quoted), Source (what the underlying
artifact or contract actually supports, cited), Category (meaning drift,
disallowed fill, denominator or scale error, prose overstatement, or document
drift), Severity (whether a reader could draw a wrong scientific conclusion, and
how), Evidence (how to reproduce the check), Confidence (explicit, with the
reason for any uncertainty).

Also report what was checked and found correct, so the audit's coverage is
legible, and anything you could not check and why.

Write the findings to docs/notes/handoff/cyano_data_use_audit_YYYYMMDD.tsv with
a Markdown rendering beside it, and add a section for this package to
docs/notes/handoff/RET_claude-science-session__YYYYMMDD.md (create it if absent,
using the header of RET_claude-science-session__20260930.md). Change no other
file.

HARD BOUNDARIES
Findings, not fixes: change no code, data, site file, ticket, or validation
document. Evidence, not verdicts: a finding cites the source or the contract
clause it rests on. No new data: do not admit, download, or propose datasets.
Do not resolve the lab's open questions (rows 13 to 15 of
docs/validation/AAA-biological-decisions-to-review.md). Report uncertainty; do
not resolve it. No child work outside this scope.
```

## Paste 4: Package A correction, GSE106824

```text
requester:   owner
target:      mythos / fable (the in-repository agents)
ticket:      docs/notes/tickets/O_claude-science-offload__20260927.md
package:     A, correction of one returned row
status:      dispatched 2026-10-02

You returned docs/notes/handoff/cyano_package_A_candidates_20260928.tsv on
2026-09-28. Intake in the repository accepted it with one row returned for
correction.

CLAIM TO CHECK
GSE106824 is listed as a "transcriptomics (RNA-seq)" candidate, but all 12 of
its samples carry library_strategy = ChIP-Seq. If you confirm that from the GEO
sample records, reclassify the row as "rejected: ChIP-seq is not an admitted
data type". If you find otherwise, say what the sample records show and leave
the row as it is.

While there, re-check its sibling under the same PMID 29241543: GSE103606 was
found to be a mixed series of 94 RNA-seq and 12 ChIP-seq samples. Confirm or
correct those two counts; the row stays a candidate for its RNA-seq samples.

RETURN
Write the corrected table to
docs/notes/handoff/cyano_package_A_candidates_YYYYMMDD.tsv (a new file; do not
overwrite the 2026-09-28 one), and add a section to
docs/notes/handoff/RET_claude-science-session__YYYYMMDD.md (create it if absent,
using the header of RET_claude-science-session__20260930.md) giving the new
table's SHA-256, the rows that changed, and the GEO fields you read. Change no
other row and no other file.

HARD BOUNDARIES
Evidence only. No admission, no licence permission, no join. No child work
outside this scope.
```

## Paste 5: crosswalk second check (read-only mount)

```text
requester:   owner
target:      mythos / fable (the in-repository agents)
ticket:      docs/notes/tickets/O_cross-strain-data-scan__20260927.md
package:     independent second check of the PCC 6311 and PCC 7943 crosswalk
status:      dispatched 2026-10-02

This is a second check, in the sense of docs/validation/claude-science-handoff.md,
"Second-checking, not just fetching". The repository built a crosswalk; you
re-derive its coverage counts without seeing how. The repository is mounted
read-only.

DO NOT READ, until your own counts are final: anything under tools/, the file
sister-strain-crosswalk-v1.tsv or its manifest, tests/, and
docs/validation/sister-strain-crosswalk.md.

PINNED RELEASES (fetch them yourself from NCBI)
- UTEX 2973: GCF_000817325.1, annotation release GCF_000817325.1-RS_2026_05_13
- PCC 6311:  GCF_022984265.1, annotation release GCF_022984265.1-RS_2025_12_23
- PCC 7943:  GCF_022984345.1, annotation release GCF_022984345.1-RS_2025_12_23
State the exact files you retrieved, with SHA-256 and retrieval date, and
confirm each is the release named.

JOIN RULE
The only join key is an exact RefSeq protein accession (protein_id) present in
the GFF3 of both strains. Product text, coordinates, and sequence similarity are
not join keys. Count unique protein-bearing loci.
- matched: a locus sharing at least one protein accession with a locus of the
  other strain.
- unmatched: a protein-bearing locus sharing none.
- ambiguous: a matched locus whose join is not one-to-one, because its protein
  is attached to more than one locus on either side, or because it reaches more
  than one counterpart. Ambiguous loci are a SUBSET of matched loci, not a third
  bucket, so matched + unmatched equals the total.

COUNTS TO AGREE OR DISAGREE WITH
UTEX 2973 side, 2,715 loci in each case:
- against PCC 6311: matched 2,663, unmatched 52, ambiguous 8
- against PCC 7943: matched 2,636, unmatched 79, ambiguous 8
Sister side:
- PCC 6311, 2,714 loci: matched 2,661, unmatched 53, ambiguous 6
- PCC 7943, 2,715 loci: matched 2,635, unmatched 80, ambiguous 7

RETURN
For each strain and side: your total, matched, unmatched, and ambiguous, and
"agrees" or "disagrees". Where a number disagrees, name the disagreeing loci by
locus tag and say which side of the definition they fall on. Only after that,
you may open sister-strain-crosswalk-v1.tsv to locate a disagreement. Return the
result as text in the session and as a saved artifact; you cannot write to the
read-only mount.

HARD BOUNDARIES
Do not edit the crosswalk or propose a mapping for an unmatched or ambiguous
locus. Do not admit a source. No child work outside this scope.
```

## Paste 6: Package D, pair comparability (send after paste 1 returns)

Hold this until Package B has returned and its intake has passed. Replace
`<PACKAGE_B_TABLE>` with the path of the accepted Package B table.

```text
requester:   owner
target:      mythos / fable (the in-repository agents)
ticket:      docs/notes/tickets/O_claude-science-offload__20260927.md
package:     D, candidate pair comparability
status:      dispatched YYYY-MM-DD

You are working under docs/validation/claude-science-handoff.md in the mounted
repository. Read it first. Your output is evidence and recommendation, never
admission or a lab decision.

INPUT
<PACKAGE_B_TABLE>, the condition metadata accepted at intake.

TASK
For candidate pairs within one data type, score every axis against the
documented thresholds in docs/validation/data-contract.md, "Condition
comparability", using only the values in the input table. Two datasets are
comparable only when every axis the assay responds to agrees:
- Temperature: within 2 C, and both inside one regime, standard 28-32 C or
  elevated 36-40 C.
- Light intensity: within +/-25% of the same photon flux, and both at or below
  400 umol photons m-2 s-1, or both above it.
- Light regime: same spectrum class, and continuous matched to continuous or
  diel matched to diel at the same photoperiod.
- CO2: same regime, ambient near 0.04% or elevated at 1% or more, and within a
  factor of two inside the elevated regime.
- Medium: BG-11 on both sides, same nitrogen source, no added organic carbon.
  Conditioned or spent medium is never comparable to fresh medium.
- Culture format and phase: both planktonic or both biofilm, and both
  exponential with overlapping OD750, or both stationary.
If the table in the repository differs from this summary, the repository wins;
say so.

ACCEPTANCE
- Each pair returns pass or fail per axis, the overall verdict, and the failing
  axis where one fails.
- A pair that passes on paper but leaves genuine doubt, or fails one axis
  narrowly, is returned as "escalate" with the marginal axis and both condition
  sets, not as a verdict.
- A pair with a "not reported" value on any axis the assay responds to is
  returned as "undecidable", not as a pass.

RETURN FORMAT
One row per pair, TSV: data type, both artifacts with their accessions, both
condition sets, pass or fail per axis, verdict (comparable, not comparable,
escalate, undecidable), failing or marginal axis, and source for each value.
Write it to docs/notes/handoff/cyano_package_D_pairs_YYYYMMDD.tsv and add a
section to docs/notes/handoff/RET_claude-science-session__YYYYMMDD.md (create
it if absent, using the header of RET_claude-science-session__20260930.md) with
the row count and the table's SHA-256. Change no other file.

HARD BOUNDARIES
The thresholds themselves, case-by-case comparability of an escalated pair, and
UTEX 3055's closeness per data type are reserved for the lab (rows 13 to 15 of
docs/validation/AAA-biological-decisions-to-review.md): report, do not resolve.
Do not re-extract or alter a condition value; report a suspected error in the
input instead. No child work outside this scope.
```

## Not in this batch, and why

These wait on an owner answer, so no paste exists for them yet. Each becomes a
block here once its question is answered.

| Item | Waiting on |
| --- | --- |
| tRNA viewer CS-1 (score versus calibrated probability) | Dispatch approval, and whether "how likely" means the tool's score or a calibrated probability |
| RBS Calculator CS-1 (validation applicable to UTEX 2973) | Dispatch approval, and v1.0 versus a newer version (return Q7) |
| PCC 7942 curated regulatory content package (return 5.2) | Return Q5 and Q2 |
| Curated ortholog annotation package (return 5.6) | Return Q2, Q5, and Q6 |
| Recoding site-type review (return 5.3) | Recoding ticket question 1 |
| Per-strain BioCyc packages | Return Q1, Q2, and Q4 |
| iDOG promoter-library and promoter-strength claims (return 5.4) | The owner's own iDOG review |
| BioCyc release watch (return 5.7) | Owner adoption; fires only when BioCyc moves past version 30.0 |

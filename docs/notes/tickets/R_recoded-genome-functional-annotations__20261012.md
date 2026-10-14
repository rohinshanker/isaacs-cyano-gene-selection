# R_recoded-genome-functional-annotations__20261012 — Resolved

Scope: Fill supported missing functional annotations in Syn57 and Syn61 from pinned nonrecoded reference records.
Status: resolved
Opened: 2026-10-12
Updated: 2026-10-14

## Outcome

Closed by **cyano-lit-unreach** (Agent Deck 80c81443-1791314087) on 2026-10-14.
Implementation and independent review are complete. No finding remains open.

Unique full-length identical proteins support each accepted hop: Syn57 to the
named MG1655 reference, and Syn61 to public MDS42 with a separately verified
MG1655 annotation hop. Public references are not asserted to be exact experimental
parental stocks. Native gene payloads, coordinates and annotations are preserved;
Syn61 retains all 3,985 native GO relationships across 1,649 plotted genes.

The display layer fills 1 Syn57 and 23 Syn61 symbols, 1 Syn57 product, and supplies
inherited GO relationships for 3,331 Syn57 and 1,518 Syn61 genes. It distinguishes
UniProt entry metadata from actual function descriptions. Search, detail, exact
GO term filtering/colouring, URL state and exports preserve native/inherited
provenance, explicit NOT, conflicts, ND and unchecked ontology status.

Ambiguous, altered, unsupported and unmatched proteins remain explicitly
unassigned. Broad lab-reviewed categories remain unknown because no such source
assignment is admitted; these are evidence boundaries, not unfinished joins.
Other sessions' already-pushed regulatory changes were merged without conflicts;
none of their active worktrees or processes was modified.

## Findings

| Id | Finding | Resolving commit |
| --- | --- | --- |
| RFA-01 | Real GO term filters/colours and distinct negative/conflicting/ND/missing states | `253694e` |
| RFA-02 | Native EC and structured GenBank-note GO preservation | `253694e` |
| RFA-03 | Source-null Syn57 placeholders distinguished from native products | `253694e` |
| RFA-04 | UniProt metadata versus actual function text and readable field labels | `253694e` |
| RFA-05 | GO controls remain available on every gene-map tab | `07a3173` |
| RFREV-01 | Preserve GO NOT/conflicts/ND/unchecked states and evidence meaning in search | `17ae27a` |
| RFREV-02 | Preserve nullable ontology status and term-name provenance in exports | `17ae27a` |

## Verification

- Full integrated suites: 1,597 JavaScript tests; 2,079 Python tests, 20 optional
  skips and 51 subtests. All six organism contracts, manifests and live-metric
  checks pass. Annotation readiness, source pins and deterministic rebuilds pass.
- Independent packed-CDS/native/reference checks pass. Original genes.json files
  remain byte-identical. Native source EC and all Syn61 GO rows match exactly.
- Actual browser: 46 recoded states across mobile/tablet/desktop/wide and
  breakpoint pairs; native UTEX GO search; 32 exact RNA-folding parity cases plus
  lifecycle/error/export states. Healthy diagnostics and overflow checks pass.
  Deliberate missing-data diagnostics are isolated; axe is unavailable.
- DEM-404 independent Codex review reproduced both generated layers and verified
  source receipts. Its repair recheck approved `17ae27ad8ae1e4354495c925d8a7810df4a0a6d7`
  and independently checked all 20,023 Syn61 exported GO relationships, including
  283 unchecked rows. Its read-only checkout lacked generated export fixtures;
  coordinator full tests and reviewer independent shipped-data checks passed.
  The prior Claude attempt returned no review after its provider biology flag.
- No source/data code changed after the reviewed repair. Remaining work is only
  the owner-authorized main integration and deployment verification.

## Cleanup

Reusable rules are in [the rebuild contract](../../validation/recoded-functional-annotations.md),
[the source ledger](../../validation/source-ledger.md), and
[dated source receipts](../handoff/recoded_functional_source_checks__20261014.json).
The validation index includes the contract. The queue row is removed. Delete
this resolved ticket last, then remove only this task's temporary worktrees and
browser/server processes after publication.

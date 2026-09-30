# O_biocyc-utex-2973-data__20260930 — Open

- **Scope:** Assess what relevant BioCyc data for UTEX 2973 can be retrieved to
  strengthen the project's evidence and annotations; select useful additions
  before planning any data pull.
- **Status:** open
- **Opened:** 2026-09-30
- **Updated:** 2026-09-30

## Current State

Owner-supplied starting point:
[BioCyc organism summary](https://biocyc.org/organism-summary?orgid=GCF_000817325).
The repository's target assembly is `GCF_000817325.1`, UTEX 2973, per
[data-contract.md](../../validation/data-contract.md). The BioCyc page's organism
identity, release, contents, retrieval options, and terms still need verification.
A read attempt through the web tool on 2026-09-30 returned an inaccessible-page
error; no page contents were obtained.

This is an open planning ticket. Research and data ingestion have not started.
Potential inventory categories include gene/product annotations, pathways,
reactions, enzymes, complexes, metabolites, and regulatory annotations where
available. These are questions to investigate, not claims that BioCyc has them.

## Dependencies

| Id | Prerequisite | Dependent step |
| --- | --- | --- |
| D1 | Confirm BioCyc database identity, release, curation basis, and accessible retrieval methods | Build a trustworthy inventory |
| D2 | Resolve priorities and intended use below | Select additions that make UTEX “more robust” |
| D3 | Verify artifact-specific access, reuse, and redistribution terms; record permission decisions in the source ledger | Retrieve and publish selected artifacts |
| D4 | Establish release-compatible identifiers and exact mapping to target loci, retaining ambiguity | Integrate selected annotations |
| D5 | Pass evidence, provenance, and admission checks under existing contracts | Ship any data or derived display |

Coordinate research with the
[cross-strain scan](O_cross-strain-data-scan__20260927.md) and
[Claude Science offload](O_claude-science-offload__20260927.md), reusing existing
findings instead of repeating requests. This ticket owns BioCyc-specific
assessment; it does not require completion of either whole ticket.

The five sister-strain BioCyc tickets can assess availability independently.
They depend only on relevant shared decisions and source contracts established
here; a UTEX download is not a prerequisite for their discovery.

Any regulatory-site candidates may supply the data dependency of
[the recoding metric](O_recoding-regulatory-site-change__20260930.md), but do not
establish regulatory function or make that metric ready to implement.

## Clarifying questions for later

1. Which gaps should BioCyc fill first: gene functions, pathway context, metabolic
   reactions, regulatory annotations, or something else?
2. What does “more robust” mean here: better gene detail, stronger candidate
   selection, new filtering/coloring metrics, broader coverage, or several?
3. Should assessment include all available BioCyc data families, with ranked
   recommendations, or begin with a narrower subset?
4. Is authenticated or paid BioCyc access available and intended? Which retrieval
   routes should be used if access is limited? Never assume credentials or bypass
   a restriction.
5. Should BioCyc provide a separate evidence layer or reconcile existing
   annotations? What should happen when sources disagree?
6. Are computational annotations acceptable alongside curated evidence, with
   their basis and uncertainty explicit?
7. Are the sister-strain tickets also BioCyc-focused, as provisionally scoped,
   or should they cover additional sources beyond the existing cross-strain scan?

## Claude Science claims

No scientific or licence claim is verified by opening this ticket. Before
external research proceeds, prepare a bounded Claude Science package under the
[handoff contract](../../validation/claude-science-handoff.md), then add the
dispatchable package to Pending Claude Science. It is not dispatchable yet:
scope questions and BioCyc access capabilities remain unresolved.

Return one row per candidate data family or artifact: organism and database
identifier, release, source URL, upstream citation, curation/evidence basis,
available fields and coverage, identifier namespace and mapping route, retrieval
method, quoted access/reuse/redistribution terms with their location, proposed
project use, duplication or conflicts with shipped data, and recommendation.
Explicitly report unavailable data and inaccessible sources. Add bounded,
falsifiable claim rows for assumptions that gate implementation. Research output
is evidence, not data admission, licence permission, or a lab decision.

## Acceptance criteria

- A sourced inventory identifies useful additions, duplicates, unavailable items,
  and unresolved access or reuse restrictions.
- Each proposed addition names the project gap it fills and preserves its
  evidence basis, source identity, release, and mapping provenance.
- Only owner-selected artifacts that pass the existing admission and source-ledger
  contracts proceed to retrieval and integration.
- Any eventual integration has tests for all new paths, including missing,
  ambiguous, conflicting, and invalid records; no guessed identifiers or values.

## Verification

Ticket creation verified 2026-09-30: required fields, dependency links, later
questions, and live index entries checked; `git diff --check` passed. Gates run
from the repository root passed: `npm test` (659 tests), pytest (332 passed,
1 skipped, 24 subtests passed), and contract validation (96 passed, 0 failed,
1 declared skip). No data retrieval, admission, implementation, or UI change
in this pass.

Future integration: run `npm test`, `.venv/bin/python -m pytest -q`, and
`.venv/bin/python tools/validate_contract.py`; verify pinned artifact checksums,
licence decisions, mapping coverage and ambiguity, and evidence labels. Visible
UI changes also require the UI render/inspect/repair skill and real renders at
mobile, tablet, and desktop widths.

## Cleanup

On resolution, rename the ticket and H1 to resolved, record final validation,
distill only reusable source/retrieval/mapping and validation guidance into
`docs/validation/`, update `validation/INDEX.md`, then delete the resolved ticket
and remove its live index row.

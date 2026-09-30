# O_biocyc-pcc-6301-data__20260930 — Open

- **Scope:** Assess and, after selection and admission, retrieve useful BioCyc
  data for PCC 6301 as explicitly labelled sister-strain evidence for UTEX 2973.
- **Status:** open
- **Opened:** 2026-09-30
- **Updated:** 2026-09-30

## Current State

Opened at the owner's request for additional sister-strain data tickets.
BioCyc focus is provisional, following the UTEX request. No organism-summary URL,
database availability, release, data family, access terms, or retrieval method
has been verified for PCC 6301. No research dispatch or data pull has started.

Reuse existing strain crosswalk and source findings where applicable, but verify
that the BioCyc release and identifier namespace actually fit them.

## Dependencies

| Id | Prerequisite | Dependent step |
| --- | --- | --- |
| D1 | Relevant priorities, evidence standards, and access decisions from [the UTEX BioCyc ticket](O_biocyc-utex-2973-data__20260930.md) | Select useful data families; availability discovery is independent |
| D2 | Verify a BioCyc database actually represents PCC 6301, its release, curation basis, and accessible artifacts | Inventory and choose source artifacts |
| D3 | Artifact-specific licence/access evidence and recorded source-ledger permission decision | Retrieve and redistribute selected data |
| D4 | Exact, unique, release-compatible identifier crosswalk to UTEX 2973; required independent checks passed | Transfer admissible locus evidence |
| D5 | Applicable strain/data-type and condition-comparability contracts, with provenance and evidence basis retained | Integrate and display selected data |

Related: [cross-strain scan](O_cross-strain-data-scan__20260927.md) and
[Claude Science offload](O_claude-science-offload__20260927.md). Reuse their
findings; this ticket owns BioCyc-specific work rather than a duplicate general
literature scan. A whole-ticket completion dependency is not imposed.

UTEX 2973 stays the target genome. Sister-strain coordinates must not be placed
on its axis; transferred annotations must not become native UTEX measurements.
New data types require an explicit contract decision before admission.

## Clarifying questions for later

1. Is PCC 6301 a priority now, or should this ticket wait until native UTEX
   BioCyc gaps and the relative value of sister-strain coverage are known?
2. Which data families should be assessed or pulled for this strain?
3. Should evidence remain a separately selectable strain layer, or supplement
   missing native annotations under an approved precedence rule?
4. What minimum mapping coverage and evidence quality justify integration, and
   how should unmatched or ambiguous loci appear?
5. If BioCyc lacks this strain or access is unavailable, should this ticket close
   with that finding or expand to other sources, coordinated with the existing scan?
6. Does the owner want a ranked inventory first, or authorize retrieval of
   selected artifacts once the research, licence, and admission gates pass?

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

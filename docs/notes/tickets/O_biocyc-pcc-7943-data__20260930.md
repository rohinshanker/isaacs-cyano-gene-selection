# O_biocyc-pcc-7943-data__20260930 — Open

- **Scope:** Assess and, after selection and admission, retrieve useful BioCyc
  data for PCC 7943 as explicitly labelled sister-strain evidence for UTEX 2973.
- **Status:** open
- **Opened:** 2026-09-30
- **Updated:** 2026-10-02

## Current State

Opened at the owner's request for additional sister-strain data tickets.
BioCyc focus is provisional, following the UTEX request. The current RefSeq
assembly is `GCF_022984345.1` (Chromosome). No data pull or admission has started.

The existing PCC 6311/7943 crosswalk's independent Claude Science second check
is pending in the cross-strain ticket/index. Discovery can proceed; admission of
this strain's sources waits on that check and on a compatible BioCyc identifier
mapping. Do not assume BioCyc identifiers match the crosswalk.

## Claude Science claims

The confirmed availability result is recorded under D2 and links to the single
six-strain results block. Further external research must follow the
[handoff contract](../../validation/claude-science-handoff.md). Research output
is evidence, not data admission, licence permission, or a lab decision.

## Dependencies

| Id | Prerequisite | Dependent step |
| --- | --- | --- |
| D1 | Relevant priorities, evidence standards, and access decisions from [the UTEX BioCyc ticket](O_biocyc-utex-2973-data__20260930.md) | Select useful data families; availability discovery is independent |
| D2 | No PCC 7943 PGDB exists in BioCyc version 30.0: the assembly-orgid probe returns the *E. coli* fallback and the PGDB list contains no PCC 7943 entry. See the [six-strain results block](O_biocyc-utex-2973-data__20260930.md#biocyc-availability-six-strains-returned-2026-09-30). | Decide whether any BioCyc inventory remains useful |
| D3 | Artifact-specific licence/access evidence and recorded source-ledger permission decision | Retrieve and redistribute selected data |
| D4 | Exact, unique, release-compatible identifier crosswalk to UTEX 2973; required independent checks passed | Transfer admissible locus evidence |
| D5 | Applicable strain/data-type and condition-comparability contracts, with provenance and evidence basis retained | Integrate and display selected data |

Related: [cross-strain scan](O_cross-strain-data-scan__20260927.md) and
the [Claude Science handoff contract](../../validation/claude-science-handoff.md#what-claude-science-is-for-this-repository). Reuse their
findings; this ticket owns BioCyc-specific work rather than a duplicate general
literature scan. A whole-ticket completion dependency is not imposed.

UTEX 2973 stays the target genome. Sister-strain coordinates must not be placed
on its axis; transferred annotations must not become native UTEX measurements.
New data types require an explicit contract decision before admission.

## Clarifying questions for later

1. Is PCC 7943 a priority now, or should this ticket wait until native UTEX
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

7. Raised by the 2026-09-30 return; unanswered (Q1): These three add no annotation the pinned RefSeq and GO layers do not already carry. Is there a comparative use that still makes them worth keeping — gene presence/absence across the clade, or confirming a locus is conserved? In particular, is **UTEX 3055's greater divergence an asset** here, as an outgroup for a conservation score, rather than the deficiency this return has been treating it as?
8. Raised by the 2026-09-30 return; unanswered (Q2): Should the per-strain tickets give way to one ortholog-annotation ticket organised by database, or do you want per-strain tickets retained because strain identity matters to how you will read the evidence?

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

Evidence-return application verified 2026-10-02: the shared BioCyc block and
ticket-local result, owner questions, assembly, links, and required fields passed
contract validation; `git diff --check`, `npm test`, and the full Python test
suite passed. No data was admitted or retrieved.

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

# R_agreement-report-exports__20261010 — Resolved

- **Scope:** Reproducible statistics-only JSON and replicate/response TSV exports from a full processed-expression agreement report.
- **Status:** resolved
- **Opened:** 2026-10-10
- **Updated:** 2026-10-10

## Outcome

Closed by `cyano-regulatory-sites` (session `e6e54b6e-1791581192`) on
2026-10-10. The standalone exporter retains metadata, denominators, nulls, zeros
and caveats, omitting only the declared gene vectors. It records exact input and
exporter checksums without inventing generator provenance. Complete-report
validation and destination preflight precede any writes. Scientific calculations,
frozen artifacts and the site's display are unchanged by this scope.

This completes the reproducible-export prerequisite of Data Sources S6.
[Data Sources](O_data-sources-selection__20261005.md) remains open for UI
integration, data admission and its remaining statistical work. Other sessions'
work and ticket ownership are preserved.

## Findings

Every finding against this scope is resolved in integration commit `0cf195e`:

| Finding | Resolution |
| --- | --- |
| EXP-R1 | Worker `6cc8a01`: reject blocked parent chains, nested output destinations and unresolvable paths before writing. |
| EXP-R2 | Worker `214c690`: validate required fields, numeric/null types, ranges, denominator bounds and cross-references without recomputing statistics. |
| EXP-R3 | Worker `214c690`: normalize Unicode and letter case for output containment, collision and ancestry checks. |
| EXP-R4 | Worker `214c690`: protect every declared input's resolved location, including symlinks outside the repository. |

Independent review DEM-353 confirmed all four repairs at immutable `214c690`,
reran the original reproductions with unchanged-file assertions, and found no
remaining actionable defect. Integrated code/tests are byte-identical to that
reviewed target. No open findings remain.

## Verification

The final combined tree at `a6a215e`, including the other session's accepted
fitness-selector changes, passed:

- `npm test`: 1,491 passed.
- `.venv/bin/python -m pytest -q`: 1,154 passed, one declared skip and 46 subtests passed.
- `.venv/bin/python tools/validate_contract.py`: 126 passed, zero failed, one declared spliced-CDS skip.
- Exporter-focused independent review: 196 tests passed.
- A regenerated full report with 53 layers, 1,378 level pairs, 52 contrasts and
  26 response pairs exported successfully. Replicate and response TSVs match
  the preserved artifacts byte for byte (5,683 and 10,717 bytes). All common
  statistics-summary fields match; only documented export/generator provenance
  differs.
- Relative documentation links, fragments and `git diff --check` pass.

No UI changes belong to this ticket. Final remote push and the GitHub validation
and deployment workflow are the coordinator's remaining delivery checks, outside
the completed implementation scope.

## Cleanup

The reusable command, validation rules, conservative path-alias policy,
per-file atomic-write limitation and provenance comparison are distilled in
[expression-agreement.md](../../validation/expression-agreement.md); its
validation index entry is updated. Nothing a later reader needs remains only in
this ticket. Remove its live queue row with this resolution, then delete this
resolved ticket in a separate final cleanup commit.

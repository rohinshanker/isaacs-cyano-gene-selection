# A_tss-recoding-edit-counts__20261015 — Active

Scope: Count edits to admitted native Tan TSS bases under the active recoding scheme, with per-gene coloring, exact-base inspection in both gene visualizers, and reproducible export semantics.
Status: active
Opened: 2026-10-15
Updated: 2026-10-15

## Current State

Owner: `cyano-regulatory-sites` (AgentDeck `e6e54b6e-1791581192`). Isolated
worktree `worktrees/tss-recoding-changes-20261015`, baseline `cccd4a8`.
Other sessions' unknown-function work, source admissions and model work are outside
this scope. Multica DEM-421 completed the read-only integration map; DEM-423 owns the
implementation in its separate worktree. The coordinator owns independent
release-data enumeration, integration documentation, review and closure.

Owner confirmed 2026-10-15: **ship the TSS edit counts first**. This is the
first slice of [regulatory-site changes](O_recoding-regulatory-site-change__20260930.md).
It reports sequence edits at experimentally reported positions, not loss of a TSS,
promoter activity, new-promoter prediction or disrupted transcription. Predictions
and other site types remain separate in the parent ticket.

## Acceptance Criteria

- Count distinct admitted Tan TSS point identities inside the union of the focal
  gene's actual CDS segments, including both site strands and self, neighbouring,
  or unassigned source associations. Repeated conditions/owners do not multiply
  the count; strand-distinct sites at one base remain distinct. Preserve all
  source identifiers and original positions. Split-CDS gaps are excluded.
- Compare original and recoded bases from the exact active scheme and its existing
  start/stop/eligibility rules. Show edited-site count separately from evaluated
  site count, with a zero only after a valid sequence/evidence evaluation. Missing,
  failed, unsupported or deselected evidence is not evaluated, never zero.
- Coloring updates with the active scheme; metric explanation and export identify
  the sequence-edit definition, evaluated denominator and limitations. Do not
  create a new promoter/model inference or infer negative expression evidence.
- Both compact gene visualizers and expanded sequence inspection expose the
  changed sites, their exact original/recoded bases and strand context. Keep the
  original TSS positions visible, preserve the existing visibility controls and
  distinguish edited from unchanged using text as well as color.
- Cover strand, boundaries, circular origin, split segments, duplicates, shared
  sites, missingness, start/stop exclusions, custom/identity schemes, source
  changes and stale state with appropriate tests and independent release-data
  enumeration. Render real mobile/tablet/desktop views and relevant states.

## Review Findings

- **TSS-UI-1 — resolved by `e726d7d`.** The shared purple-line legend and expanded sequence
  explanation still say neighbouring-gene sites while the new edit comparison
  draws all contained Tan sites, including self/unassigned. The legend/explanation
  now describe the actual set, preserving the existing neighbour-only count.

- **TSS-R1 — resolved by `f894e1a` (DEM-425 verified).** The panel designer must reject a scheme-dependent
  edited-site count as a fixed hard constraint, including saved/manual constraints;
  its input identity currently does not capture the active display scheme.
- **TSS-R2 — resolved by `f894e1a` (DEM-425 verified).** Avoid rebuilding complete per-base models for every
  CDS on scheme changes; preserve exact semantics and validate measured runtime.
- **TSS-R3 — resolved by `f894e1a` (DEM-425 verified).** Readiness/promotion/default-scale selection must
  include both TSS payloads for colors, axes and numeric filters.

- **TSS-R4 — open (DEM-425).** Scheme changes must invalidate the detail card's
  cached cohort for the edited-count percentile.
- **TSS-R5 — open (DEM-425).** The panel-designer export must carry selected Tan
  evidence through to both count columns and its manifest, just like shortlist exports.
- **TSS-R6 — open (coordinator; DEM-425 confirmed).** Exclude the evaluated
  denominator from fixed constraints too: Tan source selection changes its
  availability without participating in the panel input identity. Ordinary filters stay.

## Verification

Pending implementation, focused tests, rendered checks and independent review.
Required completion gates: `npm test`, canonical `.venv/bin/python -m pytest -q`,
and canonical `.venv/bin/python tools/validate_contract.py` from the isolated
worktree. Browser dependencies use existing machine-wide Playwright CLI; no new
project dependency is planned. No new source is admitted.

## Cleanup

Close only this owned slice after every review finding has a resolution. Distill
reusable coordinate/count/availability and rendering contracts into
`docs/validation/`, update its index, rename/H1 to resolved with final validation,
remove the live queue row, then delete the resolved ticket in a final cleanup
commit. The broader regulatory-site changes ticket stays open for new predictions
and other site types.

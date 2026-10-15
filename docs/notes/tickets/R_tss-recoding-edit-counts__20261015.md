# R_tss-recoding-edit-counts__20261015 — Resolved

Scope: Count edits to admitted native Tan TSS bases under the active recoding scheme, with per-gene coloring, exact-base inspection in both gene visualizers, and reproducible export semantics.
Status: resolved
Opened: 2026-10-15
Updated: 2026-10-15

## Outcome

Closed by `cyano-regulatory-sites` (AgentDeck `e6e54b6e-1791581192`),
2026-10-15. The first TSS sequence-edit slice is implemented and independently
reviewed. All findings against this scope are resolved below; none remain open.
Other sessions' source/model work was preserved through isolated worktrees and
fast-forward-compatible integration. The broader regulatory prediction ticket
and the separately recorded pre-existing panel source-state issue stay open.

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

- **TSS-R4 — resolved by `b541817` (DEM-425 verified).** Scheme changes must invalidate the detail card's
  cached cohort for the edited-count percentile.
- **TSS-R5 — resolved by `b541817` (DEM-425 verified).** The panel-designer export must carry selected Tan
  evidence through to both count columns and its manifest, just like shortlist exports.
- **TSS-R6 — resolved by `b541817` (DEM-425 verified).** Exclude the evaluated
  denominator from fixed constraints too: Tan source selection changes its
  availability without participating in the panel input identity. Ordinary filters stay.

## Verification

Final integrated production code reviewed at `b541817`; peer mapping changes
merged at `34ae7de` without browser changes. DEM-425 verified all six findings
and the earlier legend repair; its final 96 focused tests pass.

- `npm test`: 1,668 passed, no skips or failures.
- Canonical `.venv/bin/python -m pytest -q` from the isolated integration
  worktree: 2,383 passed, 16 expected skips, 51 subtests passed.
- Annotation input verification/reproduction and readiness checks pass.
  Contract, manifest and live-metric checks pass for all six published organisms.
- Independent reference checks all 2,715 CDSs across four schemes, including
  every physical site's exact native coordinate and oriented base changes.
- Real UI: 53 viewer/source/scheme/loading/failure states, delayed dependencies
  for colors/axes/filters, explicit scales, fixed constraint exclusions, real
  panel CSV/manifest with Tan selected/deselected, and percentile cohort changes.
  Mobile 375, tablet 768, desktop 1280/wide 1440 and breakpoint neighbours were
  rendered and inspected. No unexpected console, page or request errors or
  page-level overflow. Keyboard, focus and semantic checks pass; no axe or
  screen-reader session was run and no visual baselines changed.
- RNA browser gate: all 32 numerical cases match, lifecycle/search/exports and
  source coverage pass, no diagnostics. Preload graph and diff checks pass.

## Cleanup

Reusable rules and commands live in
[the TSS comparison contract](../../validation/tss-recoding-edits.md), linked in
`docs/validation/INDEX.md`. No ticket-only decision is needed after deletion.
The broader [prediction work](O_recoding-regulatory-site-change__20260930.md)
remains open for new promoters and other site types. Pre-existing panel
source-selection and neighboring-count export work is retained in
[its separate ticket](O_panel-source-constraint-state__20261015.md).
Remove this queue row now and delete this resolved file in the last cleanup commit.

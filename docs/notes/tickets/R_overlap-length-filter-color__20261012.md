# R_overlap-length-filter-color__20261012 — Resolved

Scope: Gene filtering and colouring by 5′ and 3′ overlap length in bp.
Status: resolved
Opened: 2026-10-12
Updated: 2026-10-12

## Outcome

Closing session: cyano-regulatory-sites (`e6e54b6e-1791581192`), 2026-10-12.
Implemented inclusive min/max filtering for either transcriptional end and
independent numerical colours for 5′, 3′ and their sum. Shared intervals are
unioned and counted continuously inward, with strand, origin, gap, zero and
unavailable semantics. Saved views, gene details and CSV exports share the
same derived values. No genomic payload changes.

Implementation ran in isolated coordinator/implementer worktrees. The completed
Tan changes on main (`5c22ee9`) were merged without editing or interrupting
that session. DEM-385 implemented; DEM-386 accepted exact runtime target
`d65275f6e6a282b21b2b3a8c41535bf0b529cc5b` after bounded repair review.

## Findings

Every finding is resolved; no open audit finding or implementation dependency
remains for this ticket.

| Finding | Resolution |
| --- | --- |
| OL1 | `6685917` / integrated `559eab8`: validated replicon lengths; independently confirmed |
| OLR-1 | `f670590`: one registry-owned CSV column per overlap metric; independently confirmed |
| OLR-2 | `c88331e`: unavailable-layer legends retain marker explanations without invented ramps/counts; independently confirmed |
| OLR-3 | `d65275f`: remove dead owner plumbing, test actual view restoration and replicon aliases; independently confirmed |
| OLR-4 | `d65275f`: blank bounds are unfiltered, with no saved constraint or load promotion; independently confirmed |
| OLR-5 | `d65275f`: keyboard clear focuses the minimum field; independently confirmed |

Reviewer styling nits require no action: the native select can elide its final
word at phone width while the end remains clear; import/header and comment
placement do not affect behaviour. The older Clear-all focus behaviour and
pre-existing duplicate length CSV columns are outside this ticket.

## Verification

- Required gates on `d65275f`: JavaScript 1,566 passed; Python 1,751 passed,
  16 optional-source/environment skips, 51 subtests passed; UTEX contract
  130 passed, zero failed, one declared spliced-CDS exemption.
- All six organism contracts, data manifests and live-metric checks passed;
  Syn57 raw checks used the verified publisher record normalized into a
  temporary directory (95 passed, one declared contiguity exemption).
- Annotation verification: 15 pinned inputs and four reproducible artifacts;
  readiness: 75 tests passed. Native overlap oracle matched all 21,952 genes;
  independent 3,000-genome oracle passed. Both new modules have 100% line,
  branch and function coverage. Independent final review: 92 focused tests.
- Real map/chromosome views and controls: 375, 768, 1280, 1440 px and both sides
  of the 960/1240 breakpoints. Covered zero/empty/invalid ranges, colours,
  keyboard focus, URL and organism restoration, filter/preview composition,
  missing/loading/failure/retry, help, values, and actual CSV/manifest downloads.
  No unexpected runtime/console/request errors. Manual accessibility checks
  passed; no axe dependency was added.
- RNA browser release gate: all 32 parity cases, lifecycle/cache/cancellation/
  failure states, responsive matrix and diagnostics passed.
- Evidence: `/tmp/cyano-overlap-length-20261012/{coordinator,integration,rna}`.
  Git publication and deployed-content smoke verification are the final release
  steps; source and test bytes remain those of the accepted target.

## Cleanup

Reusable metric, control, export, regression and repair contracts are distilled
in [overlap-length.md](../../validation/overlap-length.md), linked from the
validation index and OG contract. The live queue row is removed. This resolved
ticket is deleted last; no task history is retained as permanent guidance.

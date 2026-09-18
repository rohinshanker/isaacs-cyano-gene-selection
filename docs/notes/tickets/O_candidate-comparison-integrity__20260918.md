# O_candidate-comparison-integrity__20260918 — Open

- **Scope**: Radar, parallel-coordinate, and table comparison for 6–10 candidates.
- **Status**: open
- **Opened**: 2026-09-18
- **Updated**: 2026-09-18
- **Priority**: P0 — the plots can turn unknown values into apparently typical values.

## Current State

Verified on viewer commit `fd0e42981ba4347189e27faf25e1e8f3aee42524`
with 10 shortlisted genes.

- `zScore()` returns `NaN` for a missing measurement, but radar drawing puts a
  non-finite value on the middle ring and parallel-coordinate drawing maps it to
  z=0. Unknown therefore looks exactly median. The shared table correctly prints
  an em dash, so the picture and the table disagree.
- The categorical colours and dash patterns contain eight entries and wrap by
  modulo. Candidates 9 and 10 reuse the exact visual identities of candidates 1
  and 2. This fails at the user's target panel size of up to 10 genes.
- At 375 px, the left radar labels are clipped (for example Start-region MFE and
  Codon-pair score lose their prefixes). Ten overlaid polygons and a wrapped
  legend are difficult to trace even when values are present.
- With no active recoding scheme, Target fraction remains a default comparison
  axis even though it is constant zero and supplies no information.

## Proposed Resolution

- Treat missing values as missing geometry: leave a gap or use an explicit
  missing marker, never substitute the median. Put a missing-value count in the
  chart description and legend.
- Provide at least 10 distinguishable combined encodings and interactive focus
  that emphasizes one candidate across chart, legend, and table. Consider small
  multiples for radar once line count exceeds a tested threshold.
- Allocate responsive label margins from measured text or use a scrollable
  minimum chart width; do not clip axis names.
- Exclude inactive/constant metrics from default axes and explain why an axis is
  unavailable.

## Verification

- Fixtures include a candidate missing expression and prove it is not drawn at
  the median in radar or parallel coordinates.
- Ten candidates remain individually distinguishable at 375×812, 768×1024, and
  1440×900; labels are complete and the table remains reachable.
- Chart, legend, accessible name, and table agree on missing values.
- Default axes all have non-zero spread in the current analysis state.
- Browser screenshots and semantic snapshots cover 0, 1, 2, 8, and 10 candidates.

## Cleanup

When resolved, add the 10-candidate and missing-value comparison matrix to the
viewer validation runbook, update its index, and remove this ticket and its row.

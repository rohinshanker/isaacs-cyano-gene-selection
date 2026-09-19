# A_recoded-rna-folding__20260918 — Active

- **Scope**: On-demand wild-type/recoded RNA folding for shortlisted genes.
- **Status**: active
- **Opened**: 2026-09-18
- **Updated**: 2026-09-18
- **Priority**: P1 — the interface ships a permanently disabled control for a contract feature.

## Current State

The Candidate shortlist contains a disabled “Fold recoded RNA” button and says the
calculation will arrive later. The data contract names ΔMFE as the one deliberate
on-demand metric, and the active project ticket says shortlisted genes should be
folded on request, so this is unfinished rather than an optional affordance.

The browser can reconstruct the recoded CDS from packed codons, but it cannot
reconstruct the start-region `-30:+60` window exactly because the upstream
sequence is not shipped. Any implementation that folds only CDS bases would
silently change the metric definition.

## Proposed Resolution

- Extend the data contract with the minimal strand-oriented upstream/start context
  needed to reproduce the pipeline's start window, including sequence-boundary
  behavior and overlaps. Do not ship the whole genome unless justified.
- Lazy-load a validated ViennaRNA WebAssembly worker (or an equivalently exact
  local engine) only when requested. Keep the static/no-server architecture.
- Fold wild type and the exact recoded sequence for both defined windows, report
  ΔMFE with version/model settings, and cache by dataset checksum + gene + scheme.
- Support cancellation, progress, per-gene failures, and a clear unsupported
  message without blocking the main UI.

## Verification

- Browser results match the pinned Python/ViennaRNA pipeline within a declared
  numeric tolerance for positive/negative strands, contig boundaries, overlaps,
  non-ATG starts, and multiple schemes.
- Protein identity and terminal-stop handling remain correct before folding.
- A 10-gene request stays responsive and repeated identical work hits the cache.
- Loading, success, partial failure, cancellation, offline, and narrow-screen
  states receive rendered browser checks.

## Cleanup

When resolved, document the folding window, engine version, tolerance, cache key,
and validation command in `docs/validation/`, update its index, and remove this
ticket and its index row.

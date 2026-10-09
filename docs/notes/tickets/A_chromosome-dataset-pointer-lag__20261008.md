# A_chromosome-dataset-pointer-lag__20261008 — Active

Scope: Diagnose and remove mouse-movement lag in the chromosome viewer while dataset-based coloring is active.
Status: active
Opened: 2026-10-08
Updated: 2026-10-08

## Current State

Owner: `cyano-general-ticket-closing` (`bfdd1b08-1791384632`), assigned by the
owner on 2026-10-08 to implement unblocked work without colliding with active
sessions. Implementation starts from `8bdefc7` in an isolated worker worktree;
this session owns integration, independent review, and closure. The existing
UI disclosure/tRNA/regulatory work stays with `cyano-ui-fixes`.

Opened at the owner's request: moving the mouse over the chromosome viewer
lags when using dataset-based coloring. Baseline profiling is the first
implementation step. The exact organism, coloring metric, source selection,
zoom level and browser for this new report are not yet recorded.

Opening baseline: canonical Desktop checkout, `main` at
`e1f54f85d52c57344c5a70c5abe19297fd18b079`. Earlier chromosome performance work
is integrated. Treat this as a new reported symptom and measure the current
application before attributing a cause or assuming the earlier fix covers it.

Source context: `site/js/ui/chromosome-view.js` handles `pointermove`, hit
testing and drag redraws; `ChromosomeView.setInteraction` supplies the existing
hover/keyboard update path. The measurement responsiveness contract in
[chromosome-view.md](../../validation/chromosome-view.md) preserves cached source
membership, live metric values and the distinction between pooling and
non-pooling quantities. These observations do not establish the cause of lag.

## Acceptance

- Reproduce and profile ordinary mouse movement and hover with dataset-based
  coloring. Record the exact organism, metric, selected sources, browser, zoom,
  viewport and cold/warm state; compare with a native, non-dataset metric.
- Fix the measured bottleneck and demonstrate responsive pointer entry,
  continuous movement, gene-to-gene hover and pointer exit on the reported case.
  Record before/after event and frame timings and long tasks against an explicit
  performance target chosen from the baseline.
- Preserve accurate hit targets, tooltips/detail updates, highlighting, pinning,
  keyboard selection, drag/pan and wheel zoom. Check both repeated movement over
  one gene and movement across many genes.
- Preserve source selections, metric values, missingness, scale semantics and
  organism isolation. Verify abundance pools and named/non-pooling quantities;
  do not drop contributors or suppress needed updates to improve timing.

## Verification

At opening, source locations, related guidance and queue links were checked.
The owner's lag report remains to be reproduced.

At implementation, use the UI render/inspect/repair workflow on the real app at
375, 768, 1280 and 1440 px and relevant breakpoints. Profile desktop pointer
movement explicitly; check touch/keyboard behavior at applicable widths. Cover
the available protein abundance, transcript initiation and transcript abundance
defaults, individual datasets and multi-source selections. Inspect screenshots,
runtime diagnostics and timing traces. Add focused regression coverage, run the
existing chromosome/source-selection checks and all repository completion gates.

## Cleanup

The implementing session owns closure and must name itself and every remaining
finding. Distill reusable performance and interaction guarantees into
`docs/validation/chromosome-view.md`, update `docs/validation/INDEX.md`, then
resolve and remove this ticket and its queue row under the repository rules.
Keep [dataset-coloring loading feedback](O_dataset-coloring-loading-bar__20261008.md)
as a separate acceptance scope.

# A_chromosome-measurement-performance__20261007 — Active

Scope: Investigate and improve chromosome visualizer responsiveness with protein abundance, transcript initiation, and transcript abundance, including default selections and large dataset selections.
Status: active
Opened: 2026-10-07
Updated: 2026-10-07

## Current State

Owned by `cyano-general-ticket-closing` (`bfdd1b08-1791384632`). Active reproduction and profiling starts from `4826fa172441387f5872ba0d8d1b743f207bfa4a`, including the separate protein ratio assay and signed export contracts. No root cause is assumed. The coordinator owns implementation and rendered profiling; a read-only scout will inspect the calculation and redraw paths independently.

Owner report: the chromosome visualizer appeared “pretty laggy” when tried with
four transcriptomics datasets. Clarification on 2026-10-07: this happens whenever
protein abundance, transcript initiation, or transcript abundance is open,
even on the defaults. The problem is therefore not limited to large or customized
dataset selections.

Start reproduction with each of those three measurement types using the default
dataset selection, checking loading and settled interactions. Also investigate
the original four-transcriptomics-dataset scenario and realistic larger
selections. Exact identities for that original selection remain optional context;
their absence does not block profiling the reported default cases. The affected
operation, organism, browser/device, and whether the lag persists after loading
remain to be recorded. No root cause or timing has been verified.

Source starting points: `site/js/ui/chromosome-view.js` owns updates, canvas
drawing, resizing, and pointer interactions; `site/js/app.js` builds and refreshes
the chromosome model; `site/js/core/type-metrics.js` reads selected and pooled
datasets. These are investigation locations, not diagnosed bottlenecks.

Opening baseline: canonical Desktop checkout, `main` at
`b769ee1d34fa14d2fe13452173a914e0a82ef19a`.

## Acceptance

- Establish repeatable chromosome performance scenarios for protein abundance,
  transcript initiation, and transcript abundance on their default dataset
  selections, plus the four-transcriptomics-dataset case. Record exact
  data/view/environment settings and distinguish reported from provisional cases.
- Measure transfer/loading, parsing/application, pooled-metric computation,
  rendering, and interaction costs separately; identify the dominant cause with
  runtime evidence before selecting a fix.
- Compare defaults, one dataset, the four-dataset case, and a realistic larger
  selection, including cold loading and warm/settled use. Check pan/zoom, hover/pin,
  filtering, source changes, and view switching where the lag occurs.
- Implement a measured improvement for the reproduced bottleneck and verify
  responsive interaction without repeated unnecessary work as selections grow.
  Record before/after timings, long tasks/frame behavior, and any remaining limit.
- Preserve all selected data, existing pooling/missing-value semantics, truthful
  progress, source attribution, coordinate accuracy, and selection behavior.
  Performance gains must not come from silently reducing the dataset selection.
- Add meaningful regression coverage for the repaired path using the existing
  test infrastructure and a reproducible performance check with documented bounds.

## Affected Area and Clarification

Before implementation and again at resolution, compare loading, dataset/type
processing, chromosome rendering, and interaction behavior against the opening
baseline. Record intervening changes, the affected areas actually repaired, and
whether anything needs owner clarification. State explicitly when none is needed.

The owner's default-case clarification broadens the original large-dataset
scope. Determine which interaction and stage are affected before claiming the
reported lag is resolved; do not make the four dataset identities a prerequisite
for investigating the defaults. Coordinate
with `O_data-sources-selection__20261005.md` and
`A_loading-scramble-and-progress__20261006.md` where shared loading/state changes
are necessary.

## Verification

Ticket opening and clarification: source locations and queue link checked; the
ticket was renamed to reflect the measurement/default-case scope. The reported
lag has not been reproduced, profiled, or repaired.

At implementation, profile the real application with exact selected datasets
and capture before/after runtime evidence on the same environment. Render and
inspect loading and settled chromosome states at 375, 768, 1280, and 1440 px
for all three reported measurement types, including default and multi-dataset
selections, interaction stress, long-task/frame behavior, and console/runtime
diagnostics. Check other affected map views for regressions. Run focused
chromosome/type-metric/loading tests and all repository completion gates.

## Cleanup

When repaired and verified, report the measured improvement, affected-area
changes, clarification assessment, and remaining performance limits. Rename and
status-mark this ticket resolved and record final validation. Distill only
reusable profiling/reproduction and performance contracts into
`docs/validation/chromosome-view.md` and relevant loading/data contracts; update
`docs/validation/INDEX.md`. Then delete the resolved ticket and remove its queue
row. Keep transient profiling artifacts outside permanent validation documents.

## Owner environment, 2026-10-08

Confirmed in the UI-closeout session: Chrome on a Mac; lag occurs on default
selections of protein abundance, transcript initiation and transcript abundance.
The original four-dataset identities are not required to reproduce these defaults.
cyano-general-ticket-closing retains ownership of profiling/repair.

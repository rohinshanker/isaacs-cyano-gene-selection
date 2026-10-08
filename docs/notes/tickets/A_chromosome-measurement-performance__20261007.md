# A_chromosome-measurement-performance__20261007 — Active

Scope: Investigate and improve chromosome visualizer responsiveness with protein abundance, transcript initiation, and transcript abundance, including default selections and large dataset selections.
Status: active
Opened: 2026-10-07
Updated: 2026-10-08

## Current State

Owned by `cyano-general-ticket-closing` (`bfdd1b08-1791384632`). Active reproduction and profiling starts from `4826fa172441387f5872ba0d8d1b743f207bfa4a`, including the separate protein ratio assay and signed export contracts. No root cause is assumed. The coordinator owns implementation and rendered profiling; a read-only scout will inspect the calculation and redraw paths independently.

Runtime finding PERF-1 (open): at 1440 px in local Headless Chrome 154 on this
Mac, a settled transcript-abundance hover blocked for about 2.4 seconds while
canvas paint took about 5 ms. CPU samples put repeated `typeGroups` rebuilding
at the top, through the per-gene `contributingDatasets` callback. The repair
caches membership by immutable dataset/source/named-contributor snapshots,
without caching measurement values. Cold/warm and selection-size profiling is
in progress; the four-source reproduction is provisional, chosen in manifest
order because the originally reported four IDs were not supplied.

Owner clarification 2026-10-08: pan or zoom feels slowest. An isolated 40-move
drag and 40-event wheel run with 54 transcript datasets found the incoming hover
blocked for 2,543 ms, while drag/wheel handlers stayed at or below 0.6 ms and
their frames below 5 ms. The source-membership repair removes that dominant
cost. PERF-2 (open): the resulting 54-dataset hover still rebuilt the whole
colour model (about 160 ms); hover/keyboard previews now update only emphasis
and the shared detail, preserving the loaded colour/coordinate models. Pins,
filters, source changes and file landings still use the full update.

The source-ingestion coordinator owns a separate approved UI integration into
main (tab order/name, chromosome information disclosure and Compare disclosure).
This work remains isolated and preserves the stable `chromosome` ID; integrate
their result before the final rendered and repository gates.

Integration now includes that coordinator's `7bf8811` through merge `9716d53`.
The original review target `65d1add` remains frozen in its first worktree while
the final writer is isolated in `worktrees/chromosome-performance-integration-20261008`.
PERF-3 (open): the required source-change browser check found the existing
unconditional `setSources` -> `renderMap` call throws on the chromosome tab
(`tabBlurb` receives no scatter descriptor), leaving colours stale after changing
membership. Removing that redundant render lets `renderAll` dispatch the active
view once. A shipped real-browser regression now verifies exact pooled hashes
through named-source selection, deselection, restoration, view switches and
reload, and asserts that runtime errors fail the check.

Read-only scout DEM-313 confirmed the call path. Its suggested pending-rank
invalidation risk was checked: a wholly unknown layer never calls `ranks`,
because the existing finite-value guard skips it. A regression test now reads
the pool before and after a simulated layer arrival and checks exact ranks;
no rank-cache change is needed for this loading contract.

Affected-area comparison against `b769ee1`: application wiring, chromosome
view/model and paint priority are unchanged. The intervening fitness pooling,
E. coli layer additions and PXD005105 ratio classification are preserved.
No owner clarification is needed to repair the measured default-case stalls.

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

## Review findings

DEM-317 reviewed `65d1add` and approved the cache/preview implementation, with
closure held for these findings. The integration writer has already moved to
`42e8801`; all five original findings are approved on `e510d2e`, with all gates and the final
render/timing matrix passing. A final tool-only correction for REV-6 is below.

| Finding | Current disposition |
| --- | --- |
| REV-1: chromosome source changes throw | `42e8801` resolves the same defect as PERF-3; the new browser regression fails on `65d1add` and passes the final source-switch repair |
| REV-2: incomplete validation claim against old source-switch artifacts | Old `state-results.txt` failed on `65d1add`; those failures are retained as evidence, not counted as passing. The integration directory contains the passing final regression, 24-case matrix and full gates. Final closure will name the exact verified target |
| REV-3: future in-place source writes could silently stale the cache | Open pending review: resolver now freezes its three input containers; mutation assertions prove that source-ID, named-source and catalogue-array writes fail at the writer |
| REV-4: three-gene fixture described as a 2,715-gene sweep | Wording corrected to 2,715 metric reads; pending final review |
| REV-5: initiation default and multi cases duplicate coverage | Runbook now explicitly states there is one initiation source and no pooled-initiation case; 24 executed cases include four duplicates, pending final review |
| REV-6: reload tool failed to assert preservation of passing-gene count | Final tool clears its temporary filter through the real Clear all filters control and asserts all 2,715 passing genes survive reload. Browser check passes with identical pooled hashes and zero runtime/request errors; pending bounded final tool review |

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

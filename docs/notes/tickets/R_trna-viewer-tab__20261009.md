# R_trna-viewer-tab__20261009 — Resolved

- **Scope:** Give the tRNA viewer its own application tab.
- **Status:** resolved
- **Opened:** 2026-10-09
- **Updated:** 2026-10-10

## Outcome

Closing owner: `cyano-ui-fixes` (80c81443-1791314087), 2026-10-09.
The dedicated tRNA tab is implemented in 5600acb with navigation guidance
clarified in 17fe463. Independent DEM-342 review approved the exact integrated
17fe463 patch with no actionable findings. The owner-visible localhost preview
was opened in Google Chrome at http://127.0.0.1:8871/site/#p=trna before closure.

## Acceptance

- Provide a clearly named tRNA tab containing its track, search/filter controls,
  locus list, and independent sequence/detail view. Avoid duplicating the full
  viewer in Chromosome/Gene.
- Preserve the existing annotation/source labels, genomic versus model-effective
  anticodons, transcription-oriented sequence, and hidden-by-default predicted
  candidate. This is a placement change, not new biological evidence.
- Keep tRNA selection independent of protein-gene pinning, shortlist, filters,
  and metrics. Preserve supported tRNA state when switching tabs.
- Define how native-coordinate navigation reaches the chromosome view and how
  any retained chromosome tRNA overlay shares the coordinate window without
  sharing protein-gene selection.
- Integrate tab routing, active-tab indication, direct links, reload, and
  keyboard navigation. Keep unavailable, loading, failure/retry, and ready states
  truthful for each organism; request only declared tRNA inputs.

## Implementation (scoped implementer, DEM-341, worktree `trna-tab-20261009`)

The tab is built and validated; integration, owner preview and closure remain
with `cyano-ui-fixes`. `TRNA_TAB` (`id: trna`) sits beside Chromosome/Gene in
`ALL_TABS`, with its own `#trna-view` tabpanel, a one-column layout class, and
no rail handles. The chromosome figure no longer hosts the viewer; the only
state crossing between them is the coordinate window, through `trnaViewport()`,
with `defaultTrnaViewport(organism.genome)` supplying the full primary replicon
before that view has drawn. Selection stays in this layer, and an explicit
**Show on chromosome** button is the one hand-off: it switches tab and brings
the native coordinates into view, leaving the pin, shortlist, filters and colouring
unchanged. The link promotes `trnaLoci` for this tab instead of the chromosome.

Rendered checks at 375x812, 768x1024, 1280x800, 1440x900 and both sides of the
600, 960 and 1240 px breakpoints: no horizontal scroll, no overflow, filters
collapsing to one column at 600 and two above, zero console messages in every
scenario. Exercised: direct `#p=trna` link before any chromosome render, reload,
Back, tablist arrow keys, search, each filter, no matches, candidate opt-in,
track off, hover and focus states, marker focus, the hand-off with a pinned gene
and a shortlist present (both verified unchanged afterwards), camera sharing
after a chromosome zoom, the unavailable state for conventional and recoded
E. coli with no file requested, and — on a separate mirrored server, so the
expected failure is isolated from the passing runs — a corrupt payload producing
the failure state and its retry recovering in place.

## Verification

Final integrated code at 17fe463 passed 1,473 JavaScript tests; 958 Python tests
and 46 subtests with one skip; all-organism contracts (126/88/94/94/100 checks,
one declared UTEX skip); annotation verification/reproduction, readiness and
live-metric checks for all five published organisms. All 13 release commands
passed. The RNA-folding browser gate passed all 32 numeric cases with zero
error, lifecycle checks and zero unexpected diagnostics.

Rendered checks passed at 375x812, 768x1024, 1280x800, 1440x900 and both sides
of the 600/960/1240 breakpoints. Direct links, reload, Back/Forward, keyboard,
search, filters, empty results, selection, candidate visibility, initial track,
zoomed chromosome handoff, source details and all data states were exercised.
Protein pin/shortlist/filter/colour state remained unchanged. All four E. coli
releases showed truthful absence without a tRNA-file request. A delayed file
named trna-loci-v1.json in loading progress; HTTP503 retry recovered to 44 loci.
Zero unexpected console/page/request errors and zero page overflow. Accessibility
checks covered semantics and keyboard/focus; no automated axe or screen-reader
conformance claim. No visual baselines changed.

## Findings and disposition

- DEM341-V1: 5600acb removes the duplicate explanatory paragraph identified in
  the first render.
- DEM341-V2: 17fe463 accepted after rendered and independent review: the inherited
  bounded list remains scrollable at tablet width and every row is reachable;
  this is retained list behavior, not a missing-locus or clipping defect.
- DEM341-V3: 17fe463 records the camera/window boundary. Browser-history changes
  keep the existing camera-reset behavior; tRNA local state survives and an
  explicit handoff reveals the locus. Independent Back/Forward and zoomed-handoff
  checks passed; no new camera-persistence requirement was introduced.
- DEM341-D1: open, separately tracked in
  [O_documentation-link-integrity__20261009](O_documentation-link-integrity__20261009.md).
  Fifteen missing-file targets elsewhere were independently confirmed. Other
  possible anchor findings remain unverified in that ticket; none occurs in this
  patch's changed validation docs and none blocks this placement change.
- DEM342: exact-patch independent review approved 17fe463; no actionable finding.

## Cleanup

Reusable placement, source/sequence boundaries, declared-data behavior and tab
navigation are distilled in chromosome-view.md, trna-annotation-validation.md
and viewer-interaction-state.md, with their validation INDEX descriptions.
Transient evidence is outside Git under /tmp/cyano-trna-tab-20261009/. The owner
preview server stays available. Remove this resolved ticket last; preserve the
separate open documentation-link and overlap-visibility tickets.

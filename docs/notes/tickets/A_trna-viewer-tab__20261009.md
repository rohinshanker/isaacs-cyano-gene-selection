# A_trna-viewer-tab__20261009 — Active

- **Scope:** Give the tRNA viewer its own application tab.
- **Status:** active
- **Opened:** 2026-10-09
- **Updated:** 2026-10-10

## Current State

Owned by `cyano-ui-fixes`; implementation begins after the worktree audit.
A scoped implementer uses its own worktree; this session retains integration,
independent review, owner preview and closure. PCA wheel zoom remains owned
by `cyano-regulatory-sites` in its separate worktree. At baseline `4ad4163`, the tRNA viewer is embedded below the
CDS viewer in Chromosome/Gene. Move the full tRNA viewer into a separate
application tab, using the existing tab framework.

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
**Show on chromosome** button is the one hand-off: it switches tab and centres
the native coordinates, leaving the pin, shortlist, filters and colouring
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

Ticket-only intake; the current UI has not changed. Intake validation on
2026-10-09 passed metadata/link checks and the repository gates: 1,395 JavaScript
tests; 925 Python tests and 36 subtests with one skip; 119 contract checks with
one declared skip. This validates the baseline, not the unimplemented tab.

Gates re-run on the implemented patch: 1,469 JavaScript tests; 958 Python tests
with 46 subtests and one skip; 126 contract checks with one declared skip.

Before implementation closure, use the UI render skill to exercise the tRNA tab
and return to Chromosome/Gene at mobile, tablet, and desktop widths. Check search,
filters, selection, coordinate navigation, source details, candidate visibility,
keyboard focus, direct links/reload, and unavailable/loading/error states. Run
the gates in `AGENTS.md`. Before resolving this tRNA viewer ticket, open the
localhost preview for the owner to view, as required by their earlier decision.

## Cleanup

The implementing session owns closure and records every remaining finding.
Update [chromosome-view.md](../../validation/chromosome-view.md),
[trna-annotation-validation.md](../../validation/trna-annotation-validation.md),
and the tab-state runbook with reusable placement/state rules; update the
validation index and follow the required resolved-ticket lifecycle.

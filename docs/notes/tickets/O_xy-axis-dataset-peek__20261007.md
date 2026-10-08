# O_xy-axis-dataset-peek__20261007 — Open

Scope: Add a center dataset-selection peek for each Metric X vs Y axis whose selected metric has multiple data sources, separate from the PCA map's dataset-selection window.
Status: open
Opened: 2026-10-07
Updated: 2026-10-08

## Current State

Opened for later at the owner's request. No implementation started.

Owner reconfirmation, 2026-10-08: **yes** to independent applied X/Y/PCA
selections. Record this decision only; do not implement it yet.

For Metric X vs Y, selecting an axis metric with multiple data sources should
provide an option to open a center peek and select datasets. The owner explicitly
wants this to be a separate window from the PCA map's dataset-selection window.
The picker must identify the axis and metric whose datasets are being selected.

Source context: `syncAxisSourceSelects()` in `site/js/app.js` currently shows X/Y
source dropdowns for type metrics with at least two globally selected datasets.
Those dropdowns offer an individual informing source or pooled datasets.
`site/js/ui/data-sources.js` currently owns one reusable selection peek with
multi- and single-choice modes. Inspect the actual X vs Y and PCA interfaces
before implementing; this ticket adds the requested separate axis picker rather
than treating the existing dropdown as sufficient. This is source inspection,
not rendered validation.

Opening baseline: canonical Desktop checkout, `main` at
`b769ee1d34fa14d2fe13452173a914e0a82ef19a`. Related dataset/type-metric work has
changed since the earlier UI tickets' opening baseline; recheck its contracts.

## Acceptance

- Both X and Y offer a clearly associated dataset-selection action when the
  selected axis metric has multiple available data sources.
- The action opens a center peek listing datasets relevant to that metric and
  identifying the requesting axis. Do not make additional sources unreachable
  merely because only one is currently selected elsewhere.
- The Metric X vs Y picker is a separate window from the PCA dataset picker;
  opening it must not repurpose or overwrite the PCA window's draft.
- Users can select datasets and apply or cancel the choice, with the applied
  selection reflected truthfully in the axis controls and plot.
- Preserve the established pooled/individual-source interpretation and source
  attribution; do not invent a new pooling or aggregation rule for this UI change.
- Reuse shared dataset rows, condition information, and modal primitives where
  appropriate. Support keyboard/touch operation, background inertness, dismissal,
  and focus restoration to the initiating axis control.

## Affected Area and Clarification

Before implementation and again at resolution, compare X/Y metric and source
controls, dataset/type state, and the PCA picker against the opening baseline.
Record intervening changes, how they affect the separate-picker request, and any
owner clarification needed. State explicitly when none is needed.

Owner decision, 2026-10-08: committed X, Y and PCA dataset selections are independent. Each axis owns its selection and draft; applying it must not change the other axis or PCA. Reuse existing pooling/missing-value rules.

The owner specified a separate window. Clarify whether committed dataset
selections must also be independent of the PCA selection and the other axis if
the shared state would couple them; a different title alone does not establish a
separate window. Record this decision before implementing coupled behavior.

Related: `O_data-sources-selection__20261005.md` defines the broader selection
feature and established pooling rules. Coordinate this axis-specific request
with that work without resolving the broader ticket.

## Verification

Ticket opening: source locations and queue link checked. UI behavior has not
been rendered or changed.

At implementation, render Metric X vs Y and the PCA picker at 375, 768, 1280,
and 1440 px widths and relevant breakpoints. Inspect both axes, multi-source
metrics, single-source/computed metrics, one currently selected dataset with
multiple available sources, apply/cancel, metric changes, and repeated opens of
the X/Y and PCA windows. Check state separation, plot/source attribution,
keyboard/touch access, focus, overflow, and runtime diagnostics. Run focused
axis/source/state/modal checks and all repository completion gates.

## Cleanup

When implemented and verified, report the affected-area change and clarification
assessment, rename/status-mark this ticket resolved, and record final validation.
Distill the reusable axis-picker and state-separation contracts into
`docs/validation/explicit-metric-axes.md` and
`docs/validation/data-selection-interactions.md`; update
`docs/validation/INDEX.md`. Then delete the resolved ticket and remove its queue
row. Leave broader Data Sources work open.

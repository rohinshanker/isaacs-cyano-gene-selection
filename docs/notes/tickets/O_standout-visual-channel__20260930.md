# O_standout-visual-channel__20260930 — Open

- **Scope:** Decide whether, and how, the standout genes of a heavy-tailed metric
  (TSS initiation, expression) get a second visual channel on the zoomed-out
  chromosome view, beyond the paint order that already puts them on top. Covers
  `site/js/ui/chromosome-view.js`, `site/js/core/paint-priority.js`, the
  accessible description, their tests, and `docs/validation/chromosome-view.md`.
  No change to any value, to the colour scale, to the scatter maps, or to
  `site/data/*.json`.
- **Status:** open
- **Opened:** 2026-09-30
- **Updated:** 2026-09-30

## Current State

Opened by owner decision at the close of the zoomed-out visual priority ticket,
where it was decision D4 and was deferred until the ordering had been looked at
in a render. Nothing has been built.

The render that prompted it, taken by the independent inspector on the ordering
patch: at whole-genome zoom the ten highest-valued genes per replicon now own
their column's colour, by pixel readback, at every width. To the eye they are
still not conspicuous. The genome-wide TSS initiation maximum, `M744_RS11625` at
323,996, is one bright column among about 1,100 dark purple and teal ones on a
1440 px screen; at about 4x zoom the same gene is unmistakable. Readback says the
ordering is right; the eye says a reader has to go looking.

The owner's standing preference, recorded 2026-09-30: no explanatory text, info
buttons, or cues on screen for what a reader learns by zooming or panning; the
site is not optimised for phones; aesthetic controls live inside an existing
collapsed surface. Any channel built here must be a mark, not a note.

## Questions for the owner

1. Which genes qualify: a fixed top percentile of the selected metric, a fixed
   count per replicon, or a rank the reader sets? The ordering ticket used the
   ten highest per replicon as its acceptance check only.
2. Which mark: a taller bar reaching above the lane, a tick above the axis in the
   start-site row's style, or a halo behind the bar? A taller bar reuses the
   existing geometry and needs no legend entry beyond one line; a halo adds a
   second colour.
3. Whether the mark stays on as the reader zooms in, or fades once the bars are
   wide enough to be told apart by colour alone.
4. Whether it applies to every metric or only to the heavy-tailed ones. The draw
   direction control already lets a reader put the lowest values on top; if the
   mark follows that direction, the "standouts" of a minimised metric are its
   lowest values.

## Constraints

- Paint order and the shared-column rule in
  [chromosome-view.md](../../validation/chromosome-view.md) stay as they are; the
  mark is added on top of that picture, never in place of it.
- Missing stays absent: a gene with no value never gets the mark.
- The mark is disclosed in the accessible description and, if a legend entry is
  unavoidable, in one short line; nothing else on screen explains it.
- Nothing is removed and every CDS stays hit-testable and keyboard-reachable.

## Acceptance criteria

- Chosen with the owner from question 2, then: at whole-genome zoom in TSS
  initiation and expression colour the qualifying genes are distinguishable at a
  glance in a screenshot at 1280 and 1440 px, judged by an independent rendered
  inspection, not by readback alone.
- The mark never lands on a gene without a value, by pixel readback.
- Frame time and hit testing on the chromosome view do not regress.
- `npm test`, `.venv/bin/python -m pytest -q`, and
  `.venv/bin/python tools/validate_contract.py` pass.

## Verification

Not started. Rendered inspection at 1280 and 1440 px, with 375 and 768 checked
only for nothing breaking, before and after, in both colours and both draw
directions.

## Claude Science claims

None. The mark is a visual encoding of values already shipped; no value,
denominator, or population changes.

## Cleanup

On resolution, record the chosen mark and its rule in
[chromosome-view.md](../../validation/chromosome-view.md), then delete this
ticket and its index row.

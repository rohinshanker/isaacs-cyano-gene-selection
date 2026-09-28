# Controls column, reset confirmations, and the gene visualizer

Reusable contracts for the viewer's controls column, the confirmation every
reset goes through, and the gene track drawn in both side columns.

## The controls column is view state

The column holds three panels, identified in `site/js/core/left-panels.js`:

| Id | Title | Fresh state |
| --- | --- | --- |
| `gene-viewer` | Gene visualizer | First, collapsed |
| `scheme` | Recoding scheme | Second, expanded |
| `filters` | Filters | Third, expanded |

The gene visualizer leads because it says what is being looked at before the
scheme and filters change what is shown, and it starts collapsed because it is a
reference view rather than a control: expanded, it would push the scheme editor
below the fold on a first visit.

Order and collapsed set are shareable state, not browser-local preferences. They
encode into the URL hash as `po` and `pc` at encoder version 5.

- `po` is the full order, comma separated, written only when it differs from the
  fresh order.
- `pc` is the collapsed set in panel order, written only when it differs from the
  fresh set. **Nothing collapsed encodes as the literal `none`.** An empty value
  would be dropped by the encoder and read back as the gene visualizer collapsed
  again, so a link would not reproduce the column it was copied from.
- A state object that carries neither field writes neither. Silence about the
  layout is not a claim that every panel is open.

Decoding is defensive in both directions. An order from a link is normalized to
contain every known panel exactly once: unknown ids are dropped and missing ids
appended in fresh order, because a control the user cannot find is worse than one
in an unexpected place. A collapsed set is filtered to known ids and sorted into
panel order, so two equivalent sets produce the same link.

A live hash change applies the layout as well as the rest of the view. Without
that, the address bar would describe one column while the page kept another.

### Reordering

Two mechanisms, both required:

- **Move up and move down buttons** on every panel head. They clamp at the ends
  rather than wrapping, and focus stays on the pressed control, moving to its
  partner when the pressed one becomes disabled at an end. Each move announces
  the panel's new position.
- **A pointer drag** from the grip.

The drag's `pointermove`, `pointerup` and `pointercancel` listeners are on the
window, not on the grip. Reordering re-appends the dragged card, and moving an
element in the DOM drops its pointer capture, so grip-bound listeners never
receive the release: the drag hangs with the card still marked and the new order
never saved. This was observed in a rendered drag, not predicted.

## Every reset asks first

`site/js/ui/confirm-dialog.js` is the single gate. Every reset control in the
page is wired through `confirmedReset`, so a reset added later cannot skip the
question by forgetting to ask.

The contract:

- The dialog is `role="alertdialog"` with `aria-modal="true"`, labelled by its
  title and described by its body.
- The confirming button is red and carries the reset's own verb, such as
  **Reset layout** or **Reset metrics**, never a bare "OK".
- **Cancel is an ordinary button, comes first in the DOM, and takes focus.** The
  safe answer is the easy one, and a straight Tab reaches the destructive button
  second rather than landing on it.
- Escape and a click on the backdrop both cancel. A click inside the dialog does
  not.
- Tab cycles between the two buttons. A modal that lets Tab walk into the page
  behind it is not modal.
- Focus returns to the control that asked, so a keyboard user is not dropped at
  the top of the document.
- A second question while one is open answers the first as Cancel rather than
  stacking two modals.

Controls currently gated: Reset view, Reset selections, Reset panel widths, Reset
panel layout, Reset metrics, and the panel designer's Reset settings. The
category legend's **Clear category selection** is deliberately not gated: it
clears a filter that is restored by clicking the categories again, so a modal
would be noise rather than protection.

## Comparison metrics travel in the link

The chosen comparison metric set encodes as `cm`.

- `null` means the comparison is on its own defaults, and writes no field. The
  defaults adapt to the dataset, dropping any metric with no spread, so freezing
  whatever they resolved to today into a link would misrepresent a view the
  reader never chose.
- An empty `cm` is read as silence, not as "no axes". A comparison with no axes
  cannot be drawn.
- **Reset metrics** is disabled while the set is `null`, so the control also
  reports whether the view is on its defaults.

## The gene visualizer

One gene drawn in transcription orientation, as inline SVG, in both the
gene-detail column (first section, above candidate evidence, open) and the
controls column (collapsed by default). The same component serves both, so a
gene reads identically wherever it appears.

Every coordinate is an offset in nucleotides from the first base of the
annotated coding sequence, increasing in the direction of transcription. A
negative offset is upstream. That frame, not raw genomic position, is what makes
a minus-strand gene read the same way as a plus-strand one, and it is the frame
positional evidence from a sister strain must arrive in, because genomic
coordinates do not transfer across the UTEX 2973 inversion. See
[the sister-strain rules](data-contract.md#sister-strains-admitted-for-utex-2973-data).

What it draws, and only this:

- the annotated coding span, with each `cdsSegments` piece drawn separately and
  the gap between them shown. A translation that depends on a frameshift is a
  high-risk recoding target and must not be smoothed into one bar;
- the initiation triplet and the terminal stop, both exceptions to how the rest
  of the gene is treated, each with a minimum drawn width because three
  nucleotides of a kilobase gene is well under a pixel. The start grows
  rightwards from its first base and the stop leftwards from its last, so both
  stay inside the coding bar;
- published Tan 2018 start sites, at the distances **that study published
  against its own gene model**. `sourceStartDistanceNt` is never recomputed
  against this release's start, and the panel says so beside the drawing.
  Silently remeasuring it would invent a coordinate the source never reported;
  the caveat also repeats that these measure initiation, not abundance.

A site with no published distance has nowhere to be drawn and is left out. A
record with no coordinates draws nothing rather than guessing. The SVG carries a
sentence-level accessible description naming the gene, strand, replicon, length,
any splice, any translational exception, the terminal stop, and each start-site
distance with its caveat.

## Opening the help panel keeps its button on screen

The **How to read this** toggle scrolls the page header to the top, not the help
section. The help section is taller than the viewport, so bringing it into view
pushed the toggle off the top of the screen: the control that opened the panel
disappeared, and the one that closes it could not be found.

## Checks

```sh
npm test
.venv/bin/python -m pytest -q
.venv/bin/python tools/validate_contract.py
```

Rendered checks, which source inspection does not replace:

- At 375, 768, 1280 and 1440 wide: no horizontal page overflow, no panel-head
  overflow, and the gene visualizer SVG inside its column.
- Collapse a panel and move another; confirm the hash gains `pc` and `po`, and
  that pasting that hash into a fresh load reproduces the column.
- Drag a panel by its grip past another panel and release; confirm the order
  changes, the hash records it, and no card keeps the dragging state.
- Open each reset; confirm the title, the red button's verb, that Cancel holds
  focus, that Escape cancels without changing anything, and that focus returns
  to the opener.
- Scroll the page down, open the help panel, and confirm its toggle is still
  fully in the viewport.
- Select a spliced gene, `M744_RS00920`, and confirm two coding bars, the join
  gap, the ribosomal-slippage flag, and the terminal stop mark.
- Select a gene with several start sites, `M744_RS08615`, and confirm one mark
  per published site with the paper-era caveat.
- Read the browser console: zero errors and zero warnings.

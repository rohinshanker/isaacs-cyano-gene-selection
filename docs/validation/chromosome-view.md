# The chromosome view

Reusable contract for the `chromosome` tab: which coordinates may appear on its
axes, how each replicon is drawn, and the rendered checks the view has to pass.

Geometry lives in `site/js/core/chromosome-model.js`, which is DOM-free; the
canvas and its events are `site/js/ui/chromosome-view.js`. Everything below is a
property of the first file unless it names the second.

## It is a tab, not a mode

The view is a selectable tab in the shared tablist, built the same way as
Lengths, Regulatory sites, and Citations & sources: a frozen `CHROMOSOME_TAB`
descriptor with `id`, `name`, `blurb`, and `source` exported from its own
module, listed in `ALL_TABS` in `site/js/app.js`, with its own
`role="tabpanel"` container in `site/index.html`.

The id is `chromosome`. That is the permanent token `p` carries in the URL hash,
so a link opens straight onto this view. The encoder needed no change: `p`
already accepts any id in `ALL_TABS` and falls back to `native` for an unknown
one.

Shipping this tab does **not** retire the native codon-space PCA. That is a
separate, user-facing removal and a separate owner decision.

### The gene detail column stays open beside it

Recorded decision. This view takes a `chromosome-active` class on the layout
element for styling, but it is deliberately **absent** from the list in
`workspaceColumns` (`site/js/ui/workspace-resize.js`) that reduces the column
count. It therefore keeps the two-column and three-column workspace exactly as
the scatter maps do: controls rail from 960 px, gene detail rail from 1240 px.

The reason is the handoff. Lengths, Regulatory sites, and Citations have no
per-gene selection to pass anywhere, so they widen to a single column.
Selecting a CDS here is the whole point of the view: it pins the gene, and the
gene visualizer that draws it lives in the controls rail and in the gene detail
card. Hiding either rail would break the thing the tab exists to do.

Because detail returns to document flow below 1240 px, the view carries its own
selection-only **Jump to selected gene detail** control
(`#chromosome-detail-jump`), sharing the `.detail-jump` class so the same
breakpoint rule hides it once the sticky side rail begins. See
[responsive-workspace.md](responsive-workspace.md).

## What may be placed on an axis

1. **UTEX 2973 coordinates from the genome of record, and nothing else.** The
   three replicons and their lengths are declared in `GENOME_OF_RECORD`, taken
   from [genome-provenance.md](genome-provenance.md#genome-of-record). The
   shipped `meta.json` carries `genome.accession` and `genome.totalLength` but
   not the per-replicon lengths, and an axis cannot be drawn without them.
   `repliconTracks` therefore checks the declaration against the dataset before
   anything is drawn, and returns `verified: false` with a list of problems when
   they disagree. The view renders those problems instead of a picture. An axis
   drawn from an unverified length would misplace every mark on it.

   It fails the same way for a CDS whose coordinates run past its replicon, for
   a CDS on a `seqid` the genome of record does not have, and for a CDS that
   reports no strand and so has no lane: each is named, never silently dropped.

2. **Native Tan 2018 gene-linked start sites, at their published positions.**
   These were measured on this assembly, so `tssPositions` places them at their
   absolute coordinates on the tick row above each axis. The published
   `position` is used as given and is never recomputed against this release's
   annotated start; `sourceStartDistanceNt` is carried beside it. Non-gene-linked
   Tan features stay in the Regulatory sites tab.

3. **No sister-strain coordinate, ever.** Coordinates do not transfer between
   strains. Positional evidence from an admitted sister strain reaches the
   viewer only as an offset against a named UTEX locus, in the gene visualizer.
   This module has no route that accepts one, and the view states the rule.

4. **A missing value is absent, never zero.** A CDS with no value for the
   selected colour draws as an empty outline, never as a colour that would imply
   a measurement.

### Replicon accessions are compared normalised

`genes.json` writes `NZ_CP006471.1`; the Tan 2018 extract writes `CP006471`.
They are the same sequence under RefSeq and INSDC naming. `sameReplicon`
compares them through `normalizeAccession`, which strips the `NZ_` prefix and
the version suffix. Comparing raw strings would silently drop every start site
on the chromosome, and every join must go through this pair of functions.

## Drawing rules

**One scale per replicon.** The chromosome `NZ_CP006471.1` (2,690,418 bp, 2,655
plotted CDSs) is the primary track, with base 1 at the origin. `NZ_CP006472.1`
(46,366 bp, 54 plotted CDSs) and `NZ_CP006473.1` (7,842 bp, 6 plotted CDSs) are
explicit secondary tracks beneath it, each at its own scale and each labelled
with accession, length, and plotted CDS count. A plasmid coordinate is never
mapped onto the chromosome axis, and neither plasmid track is ever hidden: their
60 CDSs are part of the plotted set. Each track keeps its own window, so zooming
one leaves the others where they were, and each reports its own visible range.

**Strand decides the lane.** Plus-strand CDSs draw above the axis, minus-strand
below it (`strandLane`). There is no third lane and no default: a record that
names neither strand is a named verification problem, like an unknown `seqid`
and an out-of-range span, and the view refuses to draw rather than assert a
transcription direction the annotation never reported. Every CDS in this
release is stranded, so the case is a defect in the data, not a shape.

**One bar per annotated segment.** `cdsPieces` reads `cdsSegments` whenever it is
present and falls back to `[start, end]` only when it is absent. The gap in a
discontinuous CDS is left empty rather than smoothed over.

**The two circular-origin CDSs.** `M744_RS13290` on `NZ_CP006472.1` and
`M744_RS13620` on `NZ_CP006473.1` carry `start: 1` and `end: <replicon length>`,
so their naive span is the entire replicon. Only `cdsSegments` describes them
truthfully. `wrapsOrigin` identifies them as a multi-piece CDS touching both
base 1 and the last base — a gene that merely begins at base 1, and a spliced
gene in the middle of a replicon such as `M744_RS00920`, are not wraps. They are
drawn as their two pieces, each inside the replicon, with a clipped-edge chevron
on the bar at each end of the axis. The chevron sits **inside** the track: a
glyph hanging off the end of the axis reads as an axis terminator rather than as
this gene continuing. No span beyond the replicon length is ever drawn.

Each chevron is clipped to the piece it annotates, never drawn beside it.
`M744_RS13620` opens with 13 bp of a 7,842 bp plasmid, about one pixel at full
extent, so a marker at its full 5 px would cover empty track next to that bar
and read as a free-floating arrowhead pointing at nothing. `barRect` computes
that one rectangle — the snapped column from `pieceRect` and the lane rows the
bar fills — and the marker is both placed on it and `ctx.clip()`ped to it.

The clip is the part that matters, and bounding the chevron's vertices is not a
substitute for it. A canvas centres a 1 px stroke on the path, and a miter join
overshoots its vertex by up to `miterLimit` line widths: on a bar about one
pixel wide the chevron is the sharpest join on the canvas, and its outline
spiked a column left of the bar and about five rows above and below it while
every vertex sat inside. "On the bar" has to be true of the pixels, so the fill,
the outline and the outline's joins are all drawn inside one clip. The chevron
is also centred on that rectangle and reaches at most to its rows, so the clip
bounds the stroke rather than cutting the shape.

`anchorBp` is the CDS's first transcribed base, which for a wrapping CDS is the
piece before the origin on the plus strand and the high end on the minus strand.
Keyboard navigation and the announcement use it.

**Operon brackets.** `operonBrackets` groups a track's marks by `operonId` and
spans the member CDSs only. The bracket is never extended to a promoter or a
terminator, neither of which the adjacent-same-strand operon call records. Each
bracket carries the pipeline's `operonSize` as `declaredSize` beside the member
count it actually drew, so a bracket narrower than the operon is visible as such.

**Legibility gates, not omissions.** An operon bracket narrower than 4 px and
the start-site row when its ticks would be closer than 3 px apart are not drawn:
at whole-chromosome zoom 2,413 start sites over a few hundred pixels merge into
a solid bar that reads as continuous evidence across the genome. Both fill in as
the window narrows, and the view says so. Tick marks always draw; only their
labels thin out to whatever the width allows (`fitTickLabels`), because choosing
a smaller tick count instead works through round 1/2/5 steps and drops a narrow
axis from five labels straight to one. All ticks on one axis share a unit
(`axisUnit`), so a ruler never reads "500.0 kb" beside "1.00 Mb".

**The drawing is measured on the canvas.** `resize` reads the canvas's own
box, never the host's. The host carries a border and padding the canvas does
not, so its border box is about 10 px wider, and `pointerPosition` reads every
pointer coordinate against the canvas. Sizing the bitmap from the host stretches
it across a narrower element, and the mark under the cursor drifts from the mark
the hit test finds — invisibly at the origin and by a whole gene at the far end
of the chromosome. The unit check gives the fake host and canvas *different*
widths for this reason; equal widths cannot see the defect. The backing store is
also asserted to equal the canvas's CSS width at 375, 768, 960, 1280 and 1440 px
and at both device pixel ratios: slack there does not only drift the hit test,
it makes the browser resample the bitmap horizontally, which softens every
one-pixel bar the device-column snapping below exists to keep sharp.

A sub-pixel CDS is snapped to a whole device column. At whole-genome zoom a
1 kb gene is a third of a pixel, and drawn at a fractional edge it anti-aliases
into a pale smear that loses its colour. In category mode the CDSs with no
category are painted before those that have one, so a wash of empty outlines
cannot bury the few that carry a value.

## Shared state, not a second copy of it

The view draws the same 2,715 CDSs as every other view and holds no gene state
of its own. Colour, filter mask, filtered-out visibility, pin, and shortlist all
come from `app.js` on each render, under
[viewer-interaction-state.md](viewer-interaction-state.md):

- `colorModel()` in `app.js` is the one colour channel both the scatter map and
  this view read, so a gene is the same colour in both and neither can drift
  into its own colour rules.
- The category legend's hover and focus preview reaches whichever view is on
  screen: `previewCategory` pushes the preview mask at the chromosome view when
  its tab is active and at the scatter plot otherwise. A preview is a
  camera-level change and never touches filter or URL state.
- Selecting a CDS pins it, which opens it in the gene visualizer; see
  [controls-column-and-resets.md](controls-column-and-resets.md).
- Colour, the colour **Scale**, and **Show filtered-out genes** are one piece of
  state with two sets of controls: the map's, in the map toolbar, and this view's
  own copies in its own toolbar. This view resyncs all three on every render;
  `syncSharedControls` in `app.js` is the other direction, and the chromosome
  toolbar's handlers and a live hash change both go through it. Without that,
  choosing CAI here left the map's selector reading GC3 while the plot, the
  legend, and the hash all said CAI.
- This view's toolbar reads **Colour by**, then **Scale**, then its own colour
  explanation directly beneath the toolbar — the map toolbar's order, so the two
  tabs are learned once. The scale options, which of them are disabled, and the
  reason each disabled one carries come from `app.js` through the model, and both
  toolbars point their selector at them with the one `syncScaleSelect`, so they
  cannot offer different scales or give different reasons. The colour scale
  itself is contracted in
  [current-design-answers.md](current-design-answers.md#the-colour-scale).
- A selection that arrives from anywhere else is reconciled in `update`, not
  only when the view happens to be idle: the camera reveals it (`revealIndex`)
  and the keyboard cursor adopts it. The cursor is this view's own copy of a
  selection the workspace owns, so clearing the shared active index does not
  clear it, and a stale one sends the next arrow key off from a gene the reader
  left behind.
- **Reset view** goes through `confirmedReset`, as every reset control does. The
  double-click and `0` shortcuts stay direct, as the scatter map's do: the
  control is the gate, and a modal on a pointer gesture would be noise.
- The camera — each replicon's window — is **not** shareable state. It carries
  no URL field, and applying a hash live resets every track to its full extent,
  for the same reason the scatter map resets pan and zoom: a pasted link should
  show what it encodes at a known scale.

`renderLegend` and `renderCategoryLegend` take `markerConventions`. This view
passes `false`, because the shared legend's rows name the scatter map's point
shapes and the same evidence states are bars on an axis here. The colour key is
what is shared; the view states its own conventions beside it, with live counts
of the CDSs that have no value and the CDSs the filters exclude.

## Input

Pointer, keyboard, and touch follow the existing map conventions:

- drag a track to pan it, scroll over it to zoom it, double-click or `0` to
  return every track to its full length;
- the visible Zoom in / Zoom out / Reset view controls give the equivalent touch
  path and act on the chromosome track, as do `+` and `-`;
- Left and Right move an active CDS along one strand lane and announce it
  without pinning it; Up and Down cross to the next lane or replicon;
- crossing lanes compares each candidate's **fraction** of its own replicon,
  because two replicons do not share a scale and a base-pair distance between
  them would mean nothing;
- movement skips filtered-out CDSs while "Show filtered-out genes" is off;
- `Enter` pins only an explicitly active CDS; `S` toggles the active CDS, or the
  pinned one when none is active;
- a CDS reached from another view is brought into the window at the current zoom
  level (`revealIndex`), on any incoming selection and not only on arrow
  navigation;
- **Reset view** asks first; double-click and `0` do not.

`touch-action: none` on the canvas lets the drag handler own the gesture.

## The dosage statement

The view states, in prose above the track and in the canvas's accessible
description, that every per-gene value on it is per genome copy and never a
per-cell dosage. This chromosome is present in many copies per cell, that number
varies with growth condition, and no source in this release records it, so the
view states none. Polyploidy is a copy-number property of the single chromosome,
not a second coordinate system, and adds nothing to draw.

## Accessible description

`describeChromosomeView` returns one sentence-level description, rebuilt on
every paint and set as the canvas's `aria-label`. It names the colour channel
and the value scale that channel is read under, the passing and total counts,
the primary track with its length and visible
range, each secondary track with its length and plotted CDS count, the strand
convention, the two origin-crossing CDSs, any committed category filter, the
selected CDS, and the per-genome-copy limit. A picture with no text equivalent
would leave this view unreadable to anyone not looking at it.

A category filter is **named**, not counted: "1 function category is selected"
does not say which one, and this sentence is all a reader who is not looking at
the legend has. `app.js` resolves the names through `categoryLabelFor`, the same
lookup the legend and the detail panel use, and they are separated by semicolons
because most category names contain "and".

## Checks

Unit coverage is `tests/js/chromosome-model.test.mjs` and
`tests/js/chromosome-view.test.mjs`; the tab registration is asserted in
`tests/js/layout.test.mjs` and the column decision in
`tests/js/workspace-resize.test.mjs`. The model suite includes a check against
the shipped release: all 2,715 CDSs place, split 2,655 / 54 / 6, every piece
inside its replicon, exactly `M744_RS13290` and `M744_RS13620` wrapping, and
every operon bracket drawing as many members as the pipeline counted.

Rendered validation is required for any change to this view, and source
inspection does not substitute for it. Serve `site/` over HTTP and check, at
375×812, 768×1024, 1280×800, and 1440×900, and at 959/960 px and 1239/1240 px:

- all three tracks present, each labelled, with the chromosome first;
- the track captions and the tick labels inside the canvas at the narrowest
  width, with no clipped text;
- a gene selected, and the selection visible in the gene detail card;
- a filter active, with the filtered-out CDSs grey and the counts in the note
  matching;
- Function category colour, including a legend hover preview;
- a zoomed chromosome window, where operon brackets and start sites appear;
- a plasmid zoomed independently, leaving the chromosome window unchanged;
- at 1440 px, click the centre of a CDS at the far right of the chromosome at
  whole-genome zoom and confirm the gene detail names that CDS, not its
  neighbour;
- choose a colour and uncheck **Show filtered-out genes** here, then open a
  scatter tab and confirm its selector and checkbox report the same state as the
  plot, the legend, and the hash;
- zoom the chromosome in hard, pin a distant gene from another tab's search,
  return, and confirm the window moves to it and the next arrow key steps from
  it;
- press **Reset view** and confirm the question, that Cancel keeps the windows,
  and that confirming returns every track to its full length;
- `document.documentElement.scrollWidth <= innerWidth` in every state;
- a clean browser console.

The published site pins `color-scheme: light` in `site/css/app.css`, so a dark
operating-system preference renders it identically. Emulating dark is still part
of the check; the expected result is an unchanged page, and a difference means
a colour has been hard-coded somewhere that now responds to the preference.

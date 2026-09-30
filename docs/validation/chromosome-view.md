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

A sub-pixel CDS is snapped to a whole column. At whole-genome zoom a 1 kb gene
is a third of a pixel, and drawn at a fractional edge it anti-aliases into a pale
smear that loses its colour.

**The column is a CSS pixel, not a device pixel.** `pieceRect` rounds to a whole
drawing unit, and the canvas transform is set to `devicePixelRatio`, so that unit
is a CSS pixel — two device pixels at ratio 2. Every rule below is stated in that
unit deliberately: `strokeRect`'s one-pixel outline and its half-pixel inset are
CSS pixels too, and two marks coincide *exactly* only when they snap to the same
CSS column. A measurement taken in device columns reports each CSS column twice
and must be halved before it is compared with anything here.

### Which CDS a shared column shows

Columns are shared almost everywhere at whole-genome zoom: 69% to 96% of the
occupied ones hold more than one CDS, with a median of 2 to 5 and a worst case of
9 to 16. The column shows the **highest-priority** CDS among them, under the one
shared rule in `site/js/core/paint-priority.js` — see
[viewer-interaction-state.md](viewer-interaction-state.md#which-mark-is-seen-where-they-overlap),
which the scatter maps read too. `columnOccupancy` groups the visible marks by
lane and column, and the view sorts by that rule and paints ascending, so the
winner is simply the last mark drawn there. It is recomputed on every zoom, so it
disappears as soon as genes separate.

Two passes — unvalued first, then valued — used to be the whole of it, which
separated a categorised CDS from an uncategorised one but left the winner among
the valued ones to whichever happened to start last. That is why the genome-wide
TSS maximum, `M744_RS11625` at 323,996, was overpainted by a neighbour 62 times
lower.

**Owner decision D2, when two different categories share a column:** a
lab-reviewed category over a source-derived one, then the category with more CDSs
in that column, then the earlier locus.

**The majority is a property of the column, not of the CDS.** A CDS wide enough
to cross several columns can hold the majority category in one of them and be the
minority in the next, so there is no single number to put in a band-wide order:
scoring the CDS by one of its columns paints it over the others, and a column
then shows a category that one CDS in it carries against two that do not. Each
occupied column is therefore resolved on its own, by `topByPaintOrder` with the
majority counted **in that column**, and where that answer is not already the
last thing the band's order painted there, the winner's bar is repainted clipped
to that one column. The band's own order is the same rule with no majority in it,
which is exactly right: until a column is named there is no majority to count.
Only the CDSs the filters keep are counted, and only in the column being
resolved.

**Hit testing follows the picture.** A click on an occupied column selects the
CDS that column shows — the same answer, read out of the same per-column
resolution, so the two cannot disagree. The enlarged hit target a one-pixel bar
needs applies **only** where the pointer's column drew nothing, and reaches for
the nearest bar within three drawing units. It used to be the whole of the
answer: a one-pixel bar was given a two-pixel rectangle, so a bar in column *c*
sat at distance zero from a pointer in column *c+1*, and wherever that neighbour
ranked higher it won the click inside a bar the reader could see — measured on
`b6e21e9` as **166 of 787 shared columns** at 1440 px. Every other CDS in a
column stays reachable by the arrow keys and by zooming in; nothing is removed,
and all 2,715 stay counted.

### Owner decision D1: a sub-pixel source-derived category draws solid

`paintMark` can stroke a filled bar only at `MIN_HOLLOW_MARK_PX` (3) or wider:
below that the outline would be the whole bar. A source-derived category is a
white fill inside a category-coloured outline, so below that width it used to be
its white fill and nothing else — measured on `main` at `34bb240` as **0 of 916
to 1,634 derived-only columns keeping any category colour**, at every width and
both device pixel ratios, leaving 72% to 92% of occupied columns reading white.

Under D1, a derived category narrower than that threshold draws in its **full
category colour**; at or above it the hollow style is back. The rule lives in
`resolveMarkPaint` and nowhere else: `markStyle` returns the pale fill as a
request flagged `hollow`, and each piece resolves its own paint, because a
discontinuous CDS can have one piece wide enough for the hollow style and one
not — `M744_RS00920` at 1280 px over 160,000–180,000 is drawn as segments of 1.9
and 27.9 px. Measured after the change: every column holding a categorised CDS
reads a category colour and **none reads white**, at 375, 768, 1280 and 1440 px.

The threshold is three because the hollow style needs an outline column on each
side and at least one column of fill between them. There is no width between one
and three at which both the white fill and its ring can be read, which is why the
style gives way rather than being drawn anyway.

A CDS with **no** category is unaffected and keeps its empty outline. It never
read as a gap: uncategorised-only columns read the uncategorised grey `#c6cdd5`,
measured as 0 white out of 1,649 across the four widths before the change and
after it. The sub-pixel neutral tick this view once proposed for them was
therefore **not built** — grey is not crowding out colour, and a tick would add a
mark that could be misread as a low value for no measured gain.

### What the view says about all this

Paint order changes which gene is seen without changing a value, so it is
disclosed wherever it changes the picture. The canvas's accessible description
names the ordering and its direction, gives the genes-per-column figure on the
primary track at the current zoom, states the D2 rule in category colour
including that each column is decided by what is in it, and — while D1's
full-colour drawing is in effect — says that source-derived and lab-reviewed
categories draw alike at this zoom **with the count of each**, which is the
owner's own condition on approving D1. The conventions note beneath the colour
key says the same in the view's own words, from the same sentence in
`describeSolidDerived`, and returns to the ordinary "outlined bar with a pale
fill" sentence as soon as bars are wide enough. Both are written after the bands
are painted, because neither figure is knowable before the picture exists.

Three things about those figures are load-bearing, because a figure the reader is
given about the picture has to be true of the picture:

- **The crowding count is clamped to the columns the band draws into.** A CDS
  wider than the window covers every column it would take at this scale, and
  unclamped that reported **1,883 occupied columns on a 564 px canvas** at a
  500 bp window. `columnOccupancy` takes the band and bounds the answer to
  `drawnColumns(band)`, which also drops the far piece of an origin-crossing CDS
  whose other piece is what brought it into the window.
- **A derived CDS is counted once if *any* segment the band drew came out under
  the threshold**, not only if every segment did. Counting only the wholly narrow
  CDSs left `M744_RS00920`'s solid 1.9 px segment out of the count and let the
  note say no derived category was drawn solid while one was.
- **The sentence reads at every count it can take.** At one CDS of either kind it
  is singular; where no lab-reviewed CDS is in the window it says what the colour
  is rather than offering "the 0 lab-reviewed ones" as something to compare
  against. The crowding sentence is singular at one shared column too.

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
- **Draw on top** is one more piece of shared state with two sets of controls,
  decided once by `drawDirectionControlState` and applied by
  `renderDrawDirection` to both. It sits at the foot of each toolbar's colour
  explanation disclosure, which is closed in a fresh view, so it adds no row,
  label, or height to this toolbar at any width; see
  [viewer-interaction-state.md](viewer-interaction-state.md#which-mark-is-seen-where-they-overlap).
- Colour, the colour **Scale**, and **Show filtered-out genes** are one piece of
  state with two sets of controls: the map's, in the map toolbar, and this view's
  own copies in its own toolbar. This view resyncs all three on every render;
  `syncSharedControls` in `app.js` is the other direction, and the chromosome
  toolbar's handlers and a live hash change both go through it. Without that,
  choosing CAI here left the map's selector reading GC3 while the plot, the
  legend, and the hash all said CAI.
- This view's toolbar has the **map toolbar's structure**, so the two tabs are
  learned once: **Colour by** and **Scale** alone on the first row, then the note
  naming any scale this metric cannot take, then its own colour explanation, then
  **Zoom in**, **Zoom out**, **Reset view** and **Show filtered-out genes** on a
  row of their own. One flat wrapping row is what once let `Zoom in (+)` wrap up
  beside Scale at 375 px with Colour by stranded above it; the colour row and the
  button row are now separate elements, and the colour row is the shared
  `.colour-scale-row` the map toolbar uses, so the two fields are two columns of
  one line at every width (see
  [responsive-workspace.md](responsive-workspace.md)). The Scale control's whole
  state is **one object**:
  `scaleControlState` in `site/js/ui/scale-select.js` decides the options, which of
  them are disabled and why, the scale in effect, and whether the control itself
  is disabled with its own reason; `app.js` builds it once per render and hands the
  same object to both toolbars, which apply it with the one `syncScaleSelect`.
  Carrying the control-level state beside the options rather than inside them is
  what once left this toolbar's selector **enabled under a Function category
  colour**, offering five scales that snapped silently back to Linear; a state
  that travels with the options cannot be applied to one toolbar and not the
  other. `syncScaleSelect` writes the selector **and** the visible note beneath
  it (`#chromosome-color-scale-notice`, which the selector names in
  `aria-describedby`) from that one object, because a `title` needs a pointer to
  reach and a select disabled as a whole cannot even be focused: without the note
  a keyboard or screen-reader reader on this tab has no way to learn why a scale
  is missing. The colour scale itself is contracted in
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
- at 375 px, Colour by and Scale as two columns of the toolbar's first row with
  no view button beside them, both fields with the same label placement, and the
  scale note and then the colour explanation beneath that row;
- a metric a scale cannot take (`#p=chromosome&c=rareCount`) and one every scale
  can (`#c=tssInitiation`), confirming the note carries the reasons and then
  occupies nothing at all;
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
- in Function category colour at whole-genome zoom, read pixels back and confirm
  that every column holding a categorised CDS shows a category colour and none
  reads white, then zoom in and confirm the hollow derived style returns;
- click a column holding several CDSs and confirm the gene detail names the one
  the column shows, then step through the rest with the arrow keys;
- open the colour explanation, reverse **Draw on top**, and confirm the legend
  note, both canvases' descriptions, and the hash all follow, and that with the
  disclosure closed the toolbar, canvas and legend are the height they were;
- press **Reset view** and confirm the question, that Cancel keeps the windows,
  and that confirming returns every track to its full length;
- `document.documentElement.scrollWidth <= innerWidth` in every state;
- a clean browser console.

The published site pins `color-scheme: light` in `site/css/app.css`, so a dark
operating-system preference renders it identically. Emulating dark is still part
of the check; the expected result is an unchanged page, and a difference means
a colour has been hard-coded somewhere that now responds to the preference.

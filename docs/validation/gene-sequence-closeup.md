# The pinned gene's sequence close-up

Reusable contract for the sequence strip at the foot of the Chromosome tab: which
bases it may show, the frame their coordinates are read in, the order an
origin-crossing CDS is transcribed in, and the rendered checks the view has to
pass.

The sequence, translation and coordinate arithmetic live in
`site/js/core/gene-sequence-model.js`, which is DOM-free; the strip and its
events are `site/js/ui/gene-sequence-view.js`; the transcription order every
coordinate depends on is `transcriptionPieces` in
`site/js/core/gene-view-model.js`. Everything below is a property of the first
file unless it names another.

## It follows the pin, not the pointer

One horizontal strip in transcription orientation, drawn as inline SVG so the
letters are real text, mounted at the **foot of the chromosome figure** by owner
decision of 2026-09-30: after the tracks, the colour key, the track summaries and
the evidence note, in the host `chromosome-view.js` exposes as
`sequenceElement()`. `renderChromosomeView` in `site/js/app.js` feeds it from
`pinnedIndex()` and from nothing else.

**Hover and keyboard preview never reach it.** The gene detail card and the small
gene visualizer follow pointer hover, then keyboard preview, then the pin, which
is right for a panel that describes whatever the reader is looking at now; see
[viewer-interaction-state.md](viewer-interaction-state.md). A sequence being read
base by base must not change under the pointer, so this view takes the pinned
gene alone. The small track-style visualizer in the controls column and the
detail card is unchanged and still follows the preview; see
[controls-column-and-resets.md](controls-column-and-resets.md#the-gene-visualizer).

The consequence is that a hover re-renders the whole chromosome tab and costs
this view nothing: `update` compares the gene id and the scheme version and
returns before building a model when neither moved. With nothing pinned the strip
is empty and the note reads "Pin a gene to read its sequence here."; every
navigation call is a defensive no-op rather than an error.

`geneSequenceModel` returns null, and the view shows that same empty state, for a
record with no packed `codons`, a `codons` string the codon table refuses to
decode, a non-finite `start` or `end`, or no table. `decode` throws on an unknown
symbol rather than reading index zero, which is what turns a corrupt string into
no model instead of a plausible wrong protein.

## The coordinate frame

Every offset is a **nucleotide offset from the first base of the annotated coding
sequence**, increasing in the direction of transcription. Zero is the first base
of the initiation triplet, a negative offset is upstream, and the terminal stop
occupies the last three offsets. That is the same frame the small gene visualizer
uses, so a gene reads the same way in both and a minus-strand gene reads like a
plus-strand one.

`signedOffset` is the one label format: `start` at zero, `+1,200` above it, and
`−30` below it with a true minus sign. The ruler carries these and only these.

**Genomic coordinates appear in the readout and per codon, never on the ruler**
(owner decision Q3). They are in the window readout beneath the toolbar
("Nucleotides −30 to +26 of 27; genomic 971 to 1,027 on the plus strand."), in
every codon's tooltip and click readout, and in every upstream base's tooltip. A
ruler carrying genomic positions would put two coordinate systems on one axis and
make an offset look like a position.

The drawn domain is **exactly the selected shipped sequence**: `min` is the
negative selected upstream extent when context is shipped and 0 when it is not,
`max` is `cdsLengthNt`. The initial extent remains 30 nt. For an organism that
declares an expanded sidecar, the toolbar offers only declared extents no longer
than the exact sequence that has landed; choosing one rebuilds the native column
map and resets the camera. The small
visualizer's domain pads, to at least 60 nt upstream and 4% or 12 nt past the
stop, because it draws a gene as a shape; this one draws bases, and a padded
domain would offer positions no base occupies.

## Sequence rules

**Position zero is the literal initiation triplet, always translated as
methionine, and never recoded.** `codons[0]` holds the triplet as the release
packed it; its residue is forced to `M` whatever the codon table says, and the
recoding lookup is skipped for `kind === 'start'`, so a scheme targeting that
triplet reports no change there. Across the 2,715 included genes the starts are
2,244 ATG, 356 GTG, 103 TTG and 12 across ATC, CTG and ATT, so this is not a rare
path: `nonStandardStart` is set when the triplet is not ATG and the description
and the click readout say "although it is not ATG". A GTG elsewhere in the same
gene is an ordinary valine, and the rows show it as one. See
[data-contract.md](data-contract.md#start-codons).

**`terminalStop` is carried separately from the packed codons.** `codons` excludes
the stop, so the full coding sequence is `decode(codons) + terminalStop` and the
model appends it as a ninth cell to eight sense codons. It is appended only when
the codon table says the triplet is a stop: a sense triplet in that field yields
`terminalStop: null` and no stop cell, rather than a residue row claiming a
translation that ends nowhere. In the included set the stops are 1,071 TAG, 895
TAA and 749 TGA, and stop reassignment is a mainstream scheme, so a view that
read `codons` alone would show an amber-reassignment scheme changing nothing.
`cdsLengthNt` counts the stop and `lengthCodons` does not, which is the
denominator convention the rest of the site uses; see
[data-contract.md](data-contract.md#the-terminal-stop-is-carried-separately-and-it-matters).

**The initial 30 upstream bases come from `rnaContext`; a declared optional
sidecar may supply longer exact context, and no flank is padded or invented.**
Both core forms are read: `{upstream: <30 ACGT bases>}` directly, and the
90-base `[-30,60)` window form only when
`cdsOffsets[30]` is 0 and the first 30 offsets are all −1, which is what says
base 30 of that window is the start. Any other shape, a wrong length, a non-ACGT
character or a missing `cdsOffsets`, yields **no upstream at all**: the domain
begins at 0 and the description says "No upstream context is shipped for this
gene." Padding a flank would put invented sequence in front of a start codon the
reader is about to recode, which the data contract forbids outright.

`sequence_context.json` is the optional long-context payload. It is keyed to the
exact `genes.json` order, carries one fixed-length ACGT string per gene in
transcription orientation, and declares `origin: "computed"` plus a non-empty
producer. The loader rejects another gene order, another configured extent, a
non-ACGT sequence, or a sequence whose final 30 bases disagree with that gene's
core context. Keeping it out of `genes.json` preserves the core map-start budget;
the sidecar has its own compact-payload budget. The producer and contract
validator derive and independently re-check both strands and circular origins
against the pinned RefSeq genome. A missing, loading or failed sidecar leaves the
truthful 30 nt initial view; it never manufactures a longer option.

The window form is also the only source of **junction gap bases**. A run of −1
strictly between two consecutive CDS offsets is the genomic gap of a splice, and
it is attached to that junction only when its length equals the junction's own
`gapNt`, so the label can read "2 nt skipped: GG" instead of a bare count. Gaps
outside that 90-base window have no bases to show and are labelled by their
length.

**A discontinuous CDS keeps its gap.** Three genes in the release are a join of
non-adjacent genomic segments. `junctionsOf` reports each later piece as the CDS
offset it begins at with the number of genomic bases skipped before it; the
position table steps over the gap, so a fixture shaped like `M744_RS00920` runs
1,070 to 1,072 and then 1,074 to 1,076; and the strip draws a dashed junction line
with its label. `M744_RS00920` is `prfB`, whose translation depends on a
programmed ribosomal frameshift, and the description names it as "ribosomal
slippage". A gene whose translation depends on a frameshift is a high-risk
recoding target, so the join is surfaced rather than smoothed into one bar.

**A record whose segments do not add up to the coding length shows no genomic
coordinates at all.** `genomicPositions` returns null in that case,
`coordinatesKnown` is false, every codon's `positions` is null, the window readout
and the click readout drop their genomic clause, and the description states the
reason. Half-right coordinates on every base of a gene are worse than none:
nothing on screen would mark where the disagreement began.

**Upstream positions wrap the replicon origin.** Every replicon is circular, so
base −1 of a gene starting at base 1 is the replicon's last base. On the 7,842 bp
plasmid a gene starting at base 3 has −1 at base 2, −2 at base 1 and −3 at base
7,842. An unknown `seqid` has no length to wrap against and yields no position
rather than a modular answer against the wrong number.

**The rows are one strand, the transcribed one.** There is no strand toggle and
no complement row, by owner decision Q3. A minus-strand gene's bases are shown as
transcribed, and its genomic coordinates count down while its offsets count up,
which is what says which strand is being read without drawing a second one.

## Transcription order for an origin-crossing CDS

**`transcriptionPieces` is the one function that orders a CDS's genomic pieces.**
`genomicPositions`, `junctionsOf` and `orientedSegments` all read it, so a base's
coordinate, a junction's offset and a drawn segment cannot disagree about which
piece comes first. Plus-strand pieces run by ascending coordinate and
minus-strand pieces by descending coordinate, with one exception.

The exception is a CDS that crosses the circular origin, one whose pieces touch
both base 1 and the replicon's last base. `wrapsOrigin` is the test, and it is
described where the bars are drawn:
[chromosome-view.md](chromosome-view.md#drawing-rules). A gene that merely begins
at base 1, and a spliced gene in the middle of a replicon such as `M744_RS00920`,
are not wraps.

- `M744_RS13290` is `complement(join(45877..46366,1..2510))` on the 46,366 bp
  plasmid. It is transcribed from **2,510 down to 1 and then from 46,366 down to
  45,877**, so base 1's piece is ordered first: codon 1 is 2,510/2,509/2,508, the
  codon spanning the junction is 2/1/46,366, and the last codon is
  45,879/45,878/45,877.
- `M744_RS13620` is `join(7830..7842,1..281)` on the 7,842 bp plasmid. The piece
  ending at the last base comes first: codon 1 is 7,830/7,831/7,832, the codon
  spanning the junction is 7,842/1/2, and the last codon is 279/280/281.

**Ordering the pieces by coordinate is what drew these across a whole replicon.**
Both records carry `start: 1` and `end: <replicon length>`, so their naive span is
the entire replicon and only `cdsSegments` describes them truthfully; ordered by
coordinate, `M744_RS13620` accumulated a 7,548 nt gap and a 294 nt gene was drawn
across 7,842 nt of plasmid. The rule fixes the small visualizer as well as this
view, because both read `orientedSegments`.

**Every gap is measured around the circle**, so a wrap junction skips zero bases
and its label reads `origin` rather than a five-figure count. A real splice keeps
its real count.

**`cdsMark.anchorBp` is the first transcribed base under the same rule**: for a
minus-strand wrap it is base 1's piece's high end, 2,510 for `M744_RS13290`, and
for a plus-strand wrap the far piece's first base, 7,830 for `M744_RS13620`. It is
what keyboard navigation and the chromosome view's announcement use, so a wrap is
navigated from the base it is read from.

## The rendering scales

Every threshold is an exported constant of the view module, in pixels per
nucleotide unless stated, and each one is a legibility gate rather than an
omission: what gives way is the detail that can no longer be read, never the
gene's extent.

- **Letters per base at 8 px/nt and above** (`LETTER_PX_PER_NT`), at font size 12
  from 11 px/nt and 10 below it. The strip opens at 12 (`OPEN_PX_PER_NT`) and
  never zooms closer than 24 (`MAX_PX_PER_NT`), because letters stop getting more
  legible past that.
- **Cells per codon at 2 px/nt and above** (`CELL_PX_PER_NT`): one rect per codon
  on the base row, one on the recoded row when a scheme is active, one on the
  protein row, with alternating shading so triplet boundaries are visible without
  a letter in them.
- **Bar mode below 2 px/nt.** The upstream context becomes one bar, the coding
  sequence one bar per segment split at the junction offsets, and the two
  exceptions become marks at least 4 px wide so three nucleotides of a kilobase
  gene are still visible. A selected codon survives as an outline.
- **A residue letter needs 9 px per codon** (`RESIDUE_LETTER_PX`), so it appears
  from 3 px/nt.
- **Residue numbers** are 1 and then every round step from the shared `tickStep`,
  and never on the terminal stop, which has a residue position in no protein.

**The protein row is labelled only where residues are actually drawn.** In bar
mode there are no residues, so the gutter names `Bases` alone; with cells it
names `Bases` and `Protein`, or `Original`, `Recoded` and `Protein` under an
active scheme. A labelled empty row reads as a protein this gene does not have,
rather than as a scale this zoom cannot render.

Only the visible window is built, from `floor(window.from)` to
`ceil(window.to)`, so a five-kilobase gene costs what a short one costs. The
drawable width is the strip's own measured width less the 60 px label gutter,
floored at 120 px; an unmeasured strip, as in a tab that has never been shown,
falls back to 720 px so the first draw is a strip rather than nothing. Ruler ticks
target one per 90 px and residue numbers one per 70 px.

## The recoded row

Shown **only while a scheme is active**, which means a compiled scheme with
`active` true and a `Uint8Array` replacement table. An empty scheme is not
active, the row disappears again, and each codon's `recoded` is null.

- **A changed codon is marked by shape as well as colour.** The recoded cell turns
  amber and a triangular mark is drawn under it; in bar mode a change is a tick on
  the recoded bar. Colour is never the only channel that says a base changed.
- **Terminal-stop reassignment is included.** The stop cell is recoded like any
  other codon, counted in `changedCodons`, and reported separately as
  `stopChanged`, so the description reads "changes 2 codons, including the
  terminal stop".
- **Position zero is excluded**, per the rule above, so a scheme targeting the
  initiation triplet leaves that cell unmarked and the count unaffected.
- **The protein row is unchanged.** Every sense substitution a scheme may make is
  synonymous and a stop may map only to another stop, so the residues under an
  active scheme are the residues without one. `protein` is read off the original
  codons and the unit suite asserts it is identical across the change; a differing
  protein row would mean the scheme compiler admitted a substitution it must not.
- A scheme change **keeps the camera and the selected codon** and rewrites what
  that codon says about itself. Only a change of pinned gene resets them.

## Navigation and the camera

The strip is a single focusable group with an `aria-label`, described through
`aria-describedby` by one visible instruction line naming the gestures and keys,
and the SVG carries `describeGeneSequence` as both its `aria-label` and its
`desc`. That line and the two `role="status"` readouts are the whole of the
on-screen copy: no legend, no info button, no popover and no cue for what a zoom
will reveal. What the picture means belongs in the accessible description, as it
does on the chromosome tracks.

- **Opening window:** readable letters at 12 px/nt with the upstream context at
  the left edge and the annotated start in view (`openingCamera`).
- **Zoom** by the wheel about the offset under the pointer, by `+` and `-`, and by
  the Zoom in and Zoom out chips, in steps of 1.6; each announces the number of
  nucleotides now shown.
- **Pan** by dragging the strip, by Shift with the wheel or a mostly horizontal
  wheel, and by Left and Right, which move 15% of a window, or a whole window with
  Shift.
- **Jump:** `0`, Home, a double-click and the Start chip return to the opening
  window; End brings the terminal stop to the right edge, zooming back to at least
  the opening scale if the strip was in bar mode; the Fit gene chip fits the whole
  gene.
- **Click** a codon to select it and write its codon, residue, CDS offsets,
  genomic coordinates and recoding change to the readout. A drag is not a click:
  movement of 2 px or more pans and leaves the selection alone. A click on the
  upstream context clears the selection.
- `clampCamera` keeps the window inside the gene plus a 2 nt margin at each end,
  never closer than 24 px/nt and never wider than that extent, and centres a gene
  too short to fill the strip at the closest zoom. The scale never drops below the
  one that fits the gene, so a short gene fills the strip rather than floating in
  empty space.

**The camera lives in memory only.** It persists across a tab change, resets to
the opening window when another gene is pinned, along with the selected codon, and
is **never written to the URL or to browser storage**. This is owner decision Q8,
not an omission: a pasted link should show what it encodes at a known scale, which
is the same reason the chromosome tracks' windows carry no URL field. A later
reader should not "fix" this by adding one.

The strip has no Reset control, so nothing here goes through `confirmedReset`:
Start and Fit gene move a camera and destroy no state. See
[controls-column-and-resets.md](controls-column-and-resets.md#every-reset-asks-first).

## The narrow-strip rule

At a 375 px viewport the strip measures about 299 CSS px, so about 239 drawable
pixels, which at the opening 12 px/nt is about 20 nucleotides: **fewer than the 30
upstream bases**. Opening at the upstream edge therefore filled the strip with
context and showed none of the gene.

`openingCamera` gives up upstream bases rather than the start. Its left edge is
`max(domain.min − 2, min(0, 12 − span))`, so that strip opens at about −8 and
reaches +12, keeping `MIN_OPENING_CDS_NT` coding bases beside the start while the
letters stay at the opening scale. A strip wide enough for both still opens at the
upstream edge, −32: at a 1,440 px viewport it measures 732 px, about 672 drawable
and some 56 nucleotides. A gene with no shipped upstream context opens at −2
either way.

## Admitted marker layers on the sequence

An admitted positional feature is marked in a row **above the ruler**, each mark
on the base its own published genome coordinate names. The shared record every
view reads is `core/marker-layers.js`; what is specific to this view is that at
one letter per column the coordinate basis stops being a nuance.

**The native coordinate places the mark, and nothing else does.** The small gene
visualizer draws each Tan 2018 site at the distance the study published against
**its own** gene model, which is the evidence that study reported. This release's
annotated start can differ from that model, and at base resolution a distance
measured against the other model points at the wrong letter. So this strip looks
the site's own `position` up in a map of the genomic position of every base it
shows (`sequenceColumns`), built from the model's own position tables rather than
from arithmetic over the gene's start — which is what makes a minus-strand gene, a
spliced CDS and an origin-crossing one fall out of one lookup. A coordinate the
strip has no base for is **not** moved to one.

Both bases are carried and neither is substituted for the other. Each mark's
description, each list row and the accessible description name the other
placement and the gap between them, and take no side: which placement a construct
boundary should follow is the lab's call.

**Agreement is only ever claimed about a comparison that exists.** `basisGapNt`
is null where there is none — a row this strip cannot place, or a row that
publishes no distance against the study's own gene model — and null is never read
as a gap of zero. A row carrying a native coordinate and no distance is marked
here, drawn nowhere else, and said out loud as exactly that: the mark, the list
row, the list's note and the accessible description state that the other mapping
is not published, that the gene visualizer draws no mark for it, and that there
is nothing to compare. No distance is derived from the coordinate, or a
coordinate from a distance, to make one. Where several rows are placed, the
sentences name which rows agree, which disagree and by how much, and which carry
only one mapping. In the shipped file 869 of the 2,432
published rows land on a base this strip shows, across 853 genes, and **63 of
them disagree with the published distance** — `M744_RS00920`, the one spliced gene
with a site, by 67 nt, and `M744_RS08390` by 87 nt onto a base inside the current
coding sequence. The drawn gap always equals the `placementGapNt` the gene view
already reports; the column map is the authority where they could differ.

**Point and interval both place.** A point occupies one column. An interval
occupies the columns this strip shows of it, says in its description when that is
fewer than it covers, and is never extended to an edge to look complete; an
interval missing one end is an unmapped interval, not a point at the end it has.

**The covered columns are what is drawn, not the range around them.**
`markerPlacement` returns `runs`: the contiguous stretches of columns the
interval actually covers, in ascending order, from the one shared membership test
(`markerCoversPosition`). `fromOffset` and `toOffset` are only the envelope
around those runs, for the window and crowding tests that ask roughly where a
mark is. The two differ whenever the covered columns are **disjoint** — an
interval whose end precedes its start runs across the circular origin, and a
window on this side of the origin then shows two separate stretches of it with
uncovered bases between. The renderer draws one span, one stem and one outlined
column **per run**, so no outline ever sits on a base the source did not cover;
the mark and its list row say how many stretches there are and that the bases
between them are not covered. `M744_RS01695` with `CP006471:320212..320206` is
the pinned case: 253 covered bases in runs `−30..+4` and `+10..+227`, not the 258
columns between the ends, and offsets `+5..+9` stay unpainted while their letters
stay on screen. One row is still one mark with one identity and one description:
separate outlines are how coverage is drawn and never two sites.

**A row the selected strip cannot place is kept, with its reason.** At the
initial 30 nt extent, 1,563 of the shipped rows are further upstream and no mark
is drawn for them; the list says so in those words. At the configured 1,000 nt
extent every current Tan row has a native column (2,417 upstream and 15 inside
the CDS), so all 2,432 can be drawn without changing any published gene-model
distance. The three reasons are
distinct and none of them is absence: `no-native-coordinate`, `other-replicon`,
and `outside-shown-sequence`. A gene whose segments do not add up to its coding
length has no coordinate for any base, so it places nothing — the same reason it
already shows no genomic coordinates.

**Presentation priority comes only from explicit origin.** A marker record with
`origin: "computed"` is supplementary: its tag fill is 0.62 opacity and it is
painted before a `source` record, so source evidence stays on top at an overlap.
`producer` is retained in its pointer, touch, keyboard and list metadata. A
measurement may still be measured or predicted independently; neither that
field, a tool name, display text nor a confidence-looking value changes the
priority. Stable paint order does not merge records: every overlapping marker
keeps its own focus target and list row.

Start and stop annotations and every marker are focusable SVG annotations with
an accessible label and a `<title>`. Hover and `:focus-visible` draw the same
outline in both the small gene visualizer and the sequence close-up. A pointer
or touch click moves focus to the annotation so the metadata remains available
without hover; Enter or Space on a close-up start/stop cell selects the codon and
fills the persistent readout.

**The marker row is reserved by the data, not by the reader.** It is 16 px tall
whenever this locus has a placeable mark and the layer has landed, whether or not
the marks are shown, so hiding them moves no letter; the gutter stops naming the
row when nothing is drawn in it, because a labelled empty band would read as a
locus with no start site. A locus with no placeable row reserves nothing.

**Crowding is a fact about the zoom.** Two heads closer than one head width
(`MARKER_HEAD_PX`) share drawn space, grouped by single linkage over the drawn
axis — the same rule the small visualizer uses, except that this strip has no
viewBox scaling, so the threshold is a real pixel count at the current zoom and
not a constant of the picture. A crowded head is outlined and says so, the
accessible description counts them and says the grouping is display only, and
zooming in separates them. Nothing is merged, dropped or moved: two rows on one
base keep two marks, two descriptions and two rows.

**The show/hide and the list.** **Show ‹study› start sites** sits between the
strip and the instructions and is built only where there is a mark to govern — a
declared layer, a landed file, and at least one placeable row. A file in flight or
failed puts a note there instead and builds no list, so hidden stays distinct from
absent, loading, failed and unplaceable. Hiding removes the whole mark group: no
head, no stem, no outlined column, no `<title>` and nothing for `elementFromPoint`
to find. The complete list below the strip stays either way, because it is the
metadata and not the drawing; it is the keyboard and touch path, since a pointer
hint answers for whichever head is on top. The choice is `tss.sequence` in
`state.hiddenMarkers`, independent of the other three views and carried in a link
under [the `mk` contract](viewer-interaction-state.md#marker-layer-visibility-rides-in-mk).

**Keyboard focus survives every one of those transitions.** The control and the
list are rebuilt on every render, and every unrelated change to the page is a
render: a recompiled scheme, another view's marker visibility, a hover elsewhere.
So this view reads, before it rebuilds, whether the reader is standing inside its
own control host or its own list host — scoped to those hosts, because a view
that moved focus when *someone else* held it would take the reader out of what
they were using. The checkbox is restored by identity where it still exists.
Where it does not — the layer still loading, the layer failed, an organism with
no such layer, a locus whose rows this window has no base for, or nothing pinned
at all — focus goes to the labelled part of this view that survived: the strip
(`role="group"`, "Sequence close-up"), or, when the whole figure is hidden
because nothing is pinned, the view's own host (`role="group"`, `tabIndex -1`,
"Gene sequence close-up"), which carries the note saying why there is nothing to
show. If this view is hidden altogether, the nearest visible ancestor that is
already labelled and already takes focus does; nothing is made focusable or
labelled to find a target, and where there is none focus is left where it is.

The site list is **built once and only refilled**. Its `<details>`, its
`<summary>`, its note and its `<ol>` keep their identity for the life of the
view, so an open disclosure stays open and a reader on its summary stays there
across any rerender; a locus with no rows hides it and empties it rather than
leaving the last gene's rows behind a summary, and focus is carried out of it the
same way. This is a browser-only contract: a fake document leaves
`document.activeElement` pointing at a detached node, so a unit test can assert
focus "survived" a rebuild that in a browser dropped it to `<body>`. The unit
suite pins where focus is *put* and the disclosure's identity and state;
`tools/ui/check_sequence_markers.js` is what proves it in a real browser.

**Six states the description tells apart**, so an empty row never reads as
absence: no such layer for this organism and nothing said at all; the file still
loading; the file failed; landed with no row for this locus by exact locus tag;
rows placed and drawn; rows placed and hidden by the named control; and rows
published whose coordinates are not bases this strip shows.

## Every letter names its row

Base letters carry their own classes, `gene-sequence-letter-original` and
`gene-sequence-letter-recoded`, distinct from `gene-sequence-residue-letter` and
`gene-sequence-residue-number`, and the stylesheet's white fill for the solid
start and stop cells is keyed on the two base-letter classes.

The rule exists because selecting every `text` in a start or stop cell also caught
the residue letter and the residue number, which sit on the **white** protein cell
below and carry their own colours: the first codon's "M" and its "1" were painted
white on white and vanished at 1280 px. A changed codon's amber recoded cell
returns its recoded letters to the default ink for the same reason, so a
reassigned terminal stop stays readable.

Two assertions hold it: that every `text` in a start or stop cell carries exactly
one of the four classes, and that the stylesheet contains no rule selecting every
`text` in those cells. The second is what stops the defect returning through CSS
alone.

## Checks

```sh
npm test
.venv/bin/python -m pytest -q
.venv/bin/python tools/validate_contract.py
```

Unit coverage:

- `tests/js/gene-sequence-model.test.mjs`: decoding and the appended stop, the
  forced methionine at position zero and a non-ATG start, the upstream context in
  both `rnaContext` forms, an expanded exact sidecar extent and every malformed shape, minus-strand positions,
  splices and their gap bases, both origin-crossing genes, upstream positions
  wrapping the origin, the scheme diff with the reassigned stop and the unchanged
  protein, unknown coordinates, and a pass over the shipped `site/data` asserting
  that every gene builds, `cdsLengthNt` equals `lengthNt`, all 30 upstream bases
  are present, `protein.length` equals `lengthCodons`, exactly 3 genes are spliced,
  and both wrap genes' first and last codon positions are the ones above.
- `tests/js/gene-sequence-view.test.mjs`: the camera arithmetic, residue ticks, the
  empty state and its no-op navigation, the opening render with every row and
  tooltip, focusable start/stop annotations, the initial and expanded upstream
  selector, the free hover re-render, the camera and selection reset on a changed
  pin, the zoom and pan keys and chips, the wheel about the pointer, click against
  drag, the recoded row with its shape marks, the letter and cell thresholds,
  junction labels including `origin`, the width fallback, the no-upstream and
  unknown-coordinate case, the letter classes with the stylesheet rule that reads
them, the narrow strip, and the protein label in bar mode.
- `tests/js/gene-view-model.test.mjs`: `transcriptionPieces` and
  `orientedSegments` for both wrap genes, the not-a-wrap cases, and an unknown
  replicon.
- `tests/js/chromosome-model.test.mjs`: `wrapsOrigin` and `cdsMark.anchorBp`,
  2,510 for `M744_RS13290` and 7,830 for `M744_RS13620`.
- `tests/js/codon-table.test.mjs`: `decode` throwing on an unknown symbol, which is
  what makes a corrupt `codons` string yield no model.
- `tests/js/sequence-start-sites.test.mjs`: the column map over both strands, a
  splice gap, a gene with no shipped upstream context and an origin-crossing
  gene; point and interval placement including a clipped interval and one
  across a splice gap; an audit over the shipped file that every published row
  reaches the list exactly once, that 869 place and 1,563 do not, and that the
  drawn gap equals the gene view's `placementGapNt` on all 869; the 63
  disagreeing rows drawn at their own coordinate; the six description states;
  marks-only hiding against a whole-view fingerprint; focus across the repaint;
  the caller owning the choice through a link, a reload and a locus with no
  control; crowding at a fitted zoom and its separation when zoomed in; two
  rows on one base keeping both marks; an origin-wrapping interval's disjoint
  covered runs checked against the shared membership test position by position,
  one outline per run with the excluded bases left unpainted, and a contiguous
  interval and a point still drawing one run each; agreement claimed only for an
  available comparison equal to zero, with the native-only row's missing
  mapping named in the mark, the row and the description; and focus across every
  transition that takes the control away, the open list keeping its node, its
  state and its focus across a rerender, and focus outside the view left alone.
- `tests/js/marker-layers.test.mjs`: the shared representation — TSS and TIS
  distinct, every type's geometry, a point row, an interval needing both ends,
  an unmapped row kept with every field it carries, circular coverage and spans,
  the per-organism layer registry, availability, and the four independent
  visibilities with their canonical order, plus explicit source/computed
  presentation priority that is independent of measurement and producer text.

Rendered validation is required for any change to this view, and source
inspection does not substitute for it. Serve `site/` over HTTP, open the
Chromosome tab, and check at **375, 768, 1280 and 1440 px** wide:

- nothing pinned: the note, no strip, and no stray height at the foot of the
  figure;
- a pinned gene: identity, strand, length and codon count in the heading, the
  ruler in signed offsets, every base a letter, the protein row beneath, and the
  readout naming both the offsets and the genomic range;
- a changed pin: the camera back at the opening window and the codon readout
  cleared;
- an unpinned gene: back to the empty note;
- a hover and a keyboard preview while a gene is pinned: the detail card and the
  small visualizer follow them and **the strip does not move**;
- an active recoding scheme: the Original and Recoded rows aligned, changed codons
  amber **and** shape-marked, a reassigned terminal stop among them, the protein
  row unchanged, and the base letters readable on the solid start and stop cells
  including the "M" and the "1";
- a long gene at several zooms: letters, then cells without letters, then bar
  mode, with the protein row labelled only where residues are drawn;
- a reverse-strand gene: genomic coordinates counting down while the offsets count
  up;
- a non-ATG start: the triplet as shipped, an M beneath it, and the caveat in the
  click readout;
- a spliced gene, `M744_RS00920`: the junction line, the skipped-base label, and
  the ribosomal-slippage note in the accessible description;
- both origin-crossing genes, `M744_RS13290` and `M744_RS13620`: the junction
  labelled `origin`, coordinates continuing across base 1 in the right direction,
  and the small visualizer drawing each as a short track rather than a whole
  replicon;
- the keyboard path alone: focus the strip and drive zoom, pan, Home and End with
  no pointer;
- an admitted marker layer, at every width: the marks on the columns their
  coordinates name with the row reserved above the ruler, a disagreeing locus
  (`M744_RS00920`) drawn at its own base and not at the published distance, a
  locus whose rows are all unplaceable (`M744_RS09240`) with no control and the
  rows still listed, Tab from the strip to the control and Space to hide, a tap
  on the control's words, `elementFromPoint` at a former mark returning the bare
  SVG with the strip's height unchanged, the hidden choice surviving a reload in
  `mk` while the other three views keep their marks, and an organism with no
  such layer saying nothing about a start site;
- the upstream selector at its initial 30 nt and at every offered exact extent,
  including 1,000 nt: camera reset, native-coordinate placement, source distances
  unchanged, all annotations focusable, hover and keyboard outlines equivalent,
  and a tap exposing the same metadata without hover;
- `document.documentElement.scrollWidth <= innerWidth` in every state, with the
  SVG inside the strip at 375 px;
- a clean browser console.

`tools/ui/check_sequence_markers.js` runs the marker part of that list, and is
what the focus contract is proved by:

```sh
playwright-cli -s=<unique-session> open \
  "http://127.0.0.1:<port>/index.html?uiArtifacts=<absolute dir>"
playwright-cli -s=<unique-session> run-code --filename=tools/ui/check_sequence_markers.js
```

It checks focus across the transitions that take the control away, the open
disclosure's identity, state and focus across an unrelated rerender, the keyboard
and link path, that focus outside the view is left alone, and zero page overflow
with every outline inside the strip at 375, 768, 960, 1240, 1280 and 1440 px.
Two things it needs to be given:

- **Touch.** A context without touch cannot tap, so the tap is skipped and
  reported as skipped rather than passed. Run the file a second time in a touch
  session (`open --mobile`) to cover it, and read `touchTapChecked` in the result.
- **Data the shipped file has no row for.** Every shipped row carries both
  mappings and no admitted layer publishes an interval, so pass
  `&uiFixture=<base url of a copy of site/>` whose `data/tss_evidence.json` gives
  one locus a native-coordinate-only row and an origin-wrapping interval (with
  that file's `bytes` and `sha256` updated in `data/data-manifest.json`). That
  leg checks the two outlines, the gap over the uncovered bases with their
  letters still drawn, and that no description claims an agreement. Browser-only
  detail: `instant-hints.js` moves every SVG `<title>` into a description node,
  so a mark's own text is read through its `aria-describedby`, not from a
  `<title>` child.

The published site pins `color-scheme: light`, so a dark operating-system
preference renders it identically; emulating dark is still part of the check and
the expected result is an unchanged page.

# Viewer interaction and shareable-state contract

## Map input

Pointer hover, keyboard-active preview, and pinned selection are separate states.
Hover wins while the pointer is on a gene; otherwise keyboard preview wins;
otherwise the pinned gene is shown. Committing a pin clears any old preview.

With the canvas focused:

- arrows move and announce an active gene without pinning it;
- Enter pins only an explicitly active gene;
- S toggles the active gene, or the pinned gene when no active gene exists;
- Shift+arrow pans, plus/minus zoom, and 0 resets; and
- visible Zoom in/out and Reset controls provide the equivalent touch path.

Unavailable projections disable all view buttons and canvas navigation/zoom is a
defensive no-op. The canvas instructions are linked with `aria-describedby`.
The legend names filtered CDSs only when they are rendered. In Function
category colour mode, excluded reviewed CDSs are grey outlined squares and
excluded unknown or unclassified CDSs are smaller filled grey dots with no
outline; every other colour mode keeps the grey outlined square. They retain
their map coordinates and pointer access when that visibility option is
enabled; noncoding Tan features have no PCA coordinates and remain in the
separate regulatory search.

Included points are circles in every colour mode. Their radius is scaled by
`sqrt(4 / pi)` from the half-size of the former square, preserving marker area
and the density of crowded regions. Excluded points remain smaller squares or
dots, so shape alone separates included from excluded points in every mode.

A pinned gene exposes an icon Unpin button beside its Pinned status in the detail panel. Search rows show Pin/Unpin
and Shortlist/Remove according to shared state; both actions stay enabled so
they can be reversed in place. Search actions keep focus on the same row button
after rerender. The detail shortlist button keeps focus when its label changes;
unpinning from detail moves focus to the detail landmark. Unpin clears the URL
pin without changing the shortlist. Clicking a pinned dot again also unpins it.
Reset view changes only the map camera. Reset selections clears the pin and
shortlist while retaining filters, the recoding scheme, and the map camera. It
disables itself when both selections are empty and moves focus to Reset view
after activation.

## Search result activation

Typing may replace the result list, but a blur/change event for an unchanged
query must not. A pointer click moves focus away from the search field between
pointer-down and pointer-up; replacing the button during that interval swallows
the first Pin or Shortlist activation. Repeated searches for the already rendered
query are therefore idempotent. Validate both actions with one click immediately
after typing, as well as with keyboard activation.

## Function-category legend filter

When **Colour by** is Function category, every legend row is a control with
`role="checkbox"`, including the multiple-functions and unknown-or-unclassified
buckets. Hover or keyboard focus previews only that category on the map;
other CDSs take the filtered-out treatment for the duration and the map returns
to the committed state on leave or blur. Hover and focus are tracked as
separate channels, so leaving one restores the other's preview rather than the
committed selection. A preview never changes filter or URL state.

Click, Enter, or Space toggles the row into the committed category filter.
Selected categories combine with OR semantics; an empty selection excludes
nothing. The selection composes with the numeric, activity, expression,
protein, and exception filters, and applies to the category resolved under
the enabled annotation sources. Excluded categorised CDSs, reviewed or
derived, use the grey outlined square while excluded unknown CDSs use the
filled grey dot. After a toggle the
legend is rebuilt and keyboard focus is restored to the same row, so repeated
Enter or Space keeps working and the focus ring stays visible.

Marker-convention legend swatches are decorative inline SVGs that reproduce
the canvas geometry: filled coloured circle, hollow derived circle with a
centre dot, open unknown ring, excluded categorised square, excluded unknown
dot, shortlist diamond, and pinned ring with four crosshair ticks. The same SVG shapes are used in numeric legend notes;
excluded rows with a zero count are omitted.

**Clear category selection** below the legend clears only the category filter
and disables itself when nothing is selected. **Clear all filters** clears it
too, so no stale `cf` field remains in the URL. The URL field `cf` carries the
sorted, deduplicated category ids; unknown ids are dropped on decode and a
hash without `cf` decodes to no category filter. The export manifest records
the committed selection in both its `filterState` and `viewState` fields.

## Annotation sources for colouring

Owner decision, 2026-10-06: the three source toggles are data sources, so they
are rendered by the Data Sources section (`site/js/ui/data-sources.js`,
`annotation` mode) directly below "Function category explanation", on the map
and on the chromosome tab, and not by the category legend. The section opens
closed and is shown only while the colouring metric has a data selection
behind it; the toggles' behaviour below is unchanged.

Three checkboxes, UTEX 2973, PCC 7942, and GO IEA, sit inside the category
legend directly above the category rows and appear only when **Colour by** is
Function category. All three are on in a fresh view. They govern
function-category colouring and the legend counts only; the detail panel,
shortlist and comparison tables, panel-designer gene list, search
suggestions, and export always show every source, including the GO IEA
evidence tier and its discrepancy notes. The single-source views and their
`as` URL field no longer exist: a version-3 hash carrying `as` decodes
without error and the field is dropped.

The enabled set is encoded in the URL field `cs` only when it is not the
default: a single id, a comma list of ids in canonical order, or `none`. In
Function category colour mode the toggles decide the colour by precedence
UTEX 2973 > PCC 7942 > GO IEA: a lab-reviewed assignment wins when that
source is on, otherwise the PCC-derived category, otherwise the GO-derived
category, otherwise unknown. A lower-priority enabled source that assigns a
different category never changes the colour; the detail panel and export name
the conflict. Derived colour draws as a hollow ring with a centre dot, the
legend title names the counted sources and its counts change live with each
checkbox, keyboard focus stays on the checkbox after the legend rebuilds, and
hover, click, and multi-select filtering act on the resolved category; see
[source-derived-categories.md](source-derived-categories.md).

## Start-site marks that land on each other

The gene visualizer draws every mapped start site at the distance its study
published, so a dense locus draws a cluster of overlapping heads:
`M744_RS01695`'s tightest marks are 2.7 view units apart as 6-unit circles. The
anchors are the evidence, so nothing is moved, thinned, merged or dropped to
make room. What makes the cluster readable is a list, not a different picture.

**The complete list.** `tssSiteRows` in `core/gene-view-model.js` carries every
published row of a gene, and the viewer renders one row per source row inside a
closed `details.gene-view-sites` disclosure beneath the distance caveat, titled
with the study and the row count. Each row carries its identifier, the type it
was published as, its strand, its replicon and published coordinate, the
distance published against that study's own gene model, the disagreement with
its own coordinate where there is one, and whether the row records condition
read counts. A field the row does not carry says so and is never filled in from
a neighbour. A row with **no published distance** has no mark and stays in the
list, stated as unmapped: dropping it from both would make it indistinguishable
from a row nobody published.

The list is what a touch or keyboard reader has, and it is why it exists: a
`<title>` on a head needs a pointer and resolves to whichever head is on top, so
it cannot answer which site is which inside a cluster. The disclosure takes
focus and its rows are plain text in drawn order. It is built only for an
organism that declares the layer, and only once the file has landed — a list
built mid-join would read as the locus's complete set of sites.

**Grouping is display only.** `overlapGroups` links marks that are less than one
drawn head apart, by single linkage so a chain is one cluster. Two marks closer
than a head overlap at every rendered width and two a head apart at none,
because the viewBox scales the head and the gap by the same factor. Every mark
joins exactly one group, groups are numbered over the overlapping ones only, and
each affected row says it is `drawn in overlapping cluster N of M … (display
only)`. The accessible description says the same count and adds that a cluster
is where the marks are drawn at this width, not one site and not continuous
evidence. No row is ever folded into another.

The list is built whether or not the marks are shown, because it is the
metadata and not the drawing — see
[the gene visualizer's own show/hide](controls-column-and-resets.md#showing-and-hiding-the-start-site-marks).
What goes with the marks is every claim about where a mark is: with them hidden
the note says so and no row carries a cluster label, because there is no cluster
to be in.

The chromosome view's own overlap answer is different and stays as it was: its
tick row is dropped whole below 3 px of spacing rather than thinned, and its
show/hide control is contracted in
[chromosome-view.md](chromosome-view.md#showing-and-hiding-the-start-site-layer).
That control is that view's state and governs nothing here.

Coverage is `tests/js/tss-overlap-inspection.test.mjs`, over the shipped
`site/data/tss_evidence.json` as well as fixtures: the dense locus, both
strands, a site-only gene, unmapped and malformed rows, the loading and failed
states, an organism with no layer, the linkage rule at exactly one head width,
and a per-gene audit that every shipped row reaches the list exactly once.

## Which mark is seen where they overlap

At 2,715 CDSs many marks land on the same pixels, so something has to be on top
and everything else underneath it. That is one rule, in
`site/js/core/paint-priority.js`, read by the scatter maps and the chromosome
view alike; neither carries a copy. Painting ascending puts the highest priority
on top. The tiers, lowest first:

1. a CDS the filters exclude, whatever its value — a hidden standout never
   climbs over a passing gene;
2. a CDS with **no value** for the selected colour. Absence is not a low value,
   so it stays under the coloured marks in either draw direction;
3. a CDS with a value. In category colour a **lab-reviewed** category draws over
   a **source-derived** one. In metric colour the order is by value, in the
   direction below;
4. the marks the reader singled out — shortlisted, keyboard-active, hovered,
   pinned — above everything. The scatter map realises this tier through the
   focus rings it already draws last; the chromosome view sorts its bars by it
   as well, so a pinned bar is not buried by a neighbour.

Ties break by the **earlier locus**, which is therefore the one on top, and that
is the rule's last word: two CDSs equal on every other field always resolve the
same way, so a re-render can never flicker between them.

**One rule, and what the scatter map's batching does to it.** The scatter map
groups its points by quantized colour and draws each group as one path, because
a path per point cannot hold a frame rate at this size. It cannot sort points one
at a time, so it does not: a batch is a set of points that share every field the
rule compares, and `paintBatchOrder` prices each batch through `paintPriority`
and sequences them with the same comparator. The map's pass order — ghosts, then
no-value rings, then derived, then reviewed — is that sequence, not a second
opinion about it.

One residual difference follows from batching, and it is the only one permitted:
two batches that tie on **every** field the rule compares cannot be separated by
the earlier locus, because a batch has no single locus. Those are issued in a
fixed declared order — the unknown ghosts before the classified ones, then by
bucket within each evidence layer, which is the order the legend lists the
categories in. It arises only in a **category** colour, where two categories of
equal evidence tie; a value ramp separates every batch by value, so it has no
residual at all. `tests/js/scatter-paint-order.test.mjs` asserts the agreement
pair by pair, on every tier and in both directions, and asserts that a value
ramp's residual count is zero.

**Picking follows the picture, on both views.** Where marks overlap, a click
selects the mark painted on top, not the one whose centre is nearest.

- On the scatter map, where the pointer is inside a painted disc the topmost such
  disc wins, and the nearest centre decides only where the pointer is on no disc
  at all — which is what a click in empty space needs. The open ring for a gene
  with no value is not a disc: nothing is painted inside it. A disc reaches as
  far as its paint, stroke included (`markerReach`): a reviewed disc's dark
  border and a derived ring's coloured stroke lie half outside the path, and a
  pointer on that half is on the mark that drew it. The rank comes from the
  batches, so a pointer move reads it and never sorts.
- On the chromosome view, a click on an occupied column selects the CDS that
  column shows; see
  [chromosome-view.md](chromosome-view.md#which-cds-a-shared-column-shows).

Before this, both views answered by nearest centre or nearest rectangle, which
could pin a gene whose colour was nowhere under the pointer.

**Draw on top: highest or lowest.** Highest is the default for every metric.
The control reverses only tier 3, and only for a value ramp: a function-category
colour has no value order to reverse, so it is shown **disabled with its reason**
in visible text, exactly as the Scale control is under the same colour. It is an
aesthetic preference of little consequence, so by owner decision of 2026-09-30 it
takes no space in a primary area: it is on no toolbar row, adds no always-visible
row, label, or height, and lives at the foot of the **colour explanation**
disclosure beneath Colour by — closed in a fresh view, present on every scatter
tab and on the chromosome tab. It is keyboard reachable, in visual order, once
that disclosure is open.

**That disclosure is also the only visible place any of this is explained**, by a
second owner decision of the same day, taken after the first render: no ordering
clause in the legend in any colour or either direction, no D1 notice and no
crowding sentence in the chromosome view's conventions note, no info button, no
popover, and no cue that a zoomed-out column stands for several CDSs. The reader
learns those by zooming or panning, and the owner does not want them explained on
screen; the site is not optimised for phones. With the disclosure closed, nothing
about paint order is on screen and every legend box is the height it is on
`34bb240`.

The explanation is therefore in two places and two only: both canvases'
**accessible descriptions**, which state it unconditionally, and the **open
disclosure**, which states the same sentences beside the control that reverses
them. `describePaintOrder` in `core/chromosome-model.js` composes both from one
set of facts — `describeDrawOrder` for the ordering, the crowding sentence, the
D2 sentence, and `describeSolidDerived` for D1 — so the visible copy cannot drift
from the description, and neither can drift from the comparator. A short legend
clause lived in `drawOrderNote` until this decision; it was deleted rather than
left unused, because a second wording with no caller is the thing that drifts.
The scatter map's copy passes no columns and no D1 counts: its marks are discs on
a projection, so the crowding figure and the per-column majority have nothing to
be about there.

The scatter map keeps its batching by quantized colour, which is what makes
panning fast. Only the order the batches are issued in changes, and that order is
decided with the buckets — on a colour, mask, or direction change — never per
frame.

**URL field `dt`,** written only when the direction is reversed. It did **not**
bump the encoder, on the test in the section below: an omitted `dt` has exactly
one meaning — highest on top, which is the fresh view — so no reader can misread
another's hash.

It does not mean "the picture this link used to draw", and the version number
could not have made it mean that. Before this work the chromosome view put
whichever CDS started last on top rather than the highest value, and the no-value
and evidence layers moved on both views, so an old link opens on a different
picture whatever number the encoder carries; there is no code left that draws the
old one. The version test is only about whether an omitted field is ambiguous.

The export manifest records the direction in `viewState.drawOnTop`, because it
changes no number but does decide which of two overlapping marks the exported
picture shows.

Coverage is `tests/js/paint-priority.test.mjs` (every tier, the earlier-locus
tie-break, and the batch order), `tests/js/scatter-paint-order.test.mjs` (the
batches a frame actually issues in both directions, the agreement between the
comparator and the batch order, and picking where discs overlap),
`tests/js/chromosome-view.test.mjs` (the per-column rule, the D1 disclosure
counts, the clamped crowding figures, and the click at four stage widths and both
device pixel ratios), `tests/js/url-state.test.mjs` (the round trip and the
no-key case), `tests/js/draw-direction.test.mjs` (the control and the explanation
block it carries) and `tests/js/legend.test.mjs` (that the legend states none of
it, whatever it is handed).

## Pinned status row

When a gene is pinned, the unpin control sits to the left of the "Pinned"
label at the status text's size, keeps a 24 px hit area, its `aria-label`,
title, and `data-detail-action="unpin"` hook, and focus after unpin lands where
the reversible-pinning rules above say.

## Colour by, axes and filters name a data type

Owner decision, 2026-10-06: the Expression entries are types ("Transcript
abundance (RNA-seq)", "Transcription initiation (RNA-seq)"), each informed by
one dataset chosen under Data Sources (a radio beside each dataset of a type
with more than one selected), on the Metric X vs Y source select, or through
the filters' Select source peek. The type keeps its key when the dataset
changes; the legend, help and axis note read the informing dataset's unit and
provenance, the colour scale re-defaults from the new values, and the link
records the choice as `src=` only where it differs from the default. A
dataset's own metric, and the percentile the pipeline derives from that one
dataset ("Expression percentile (PCC 7942)"), are never offered in these menus:
the type stands for them, and a pooled type already reads as a percentile. The
contract and the key scheme are in
[data-contract.md](data-contract.md) ("Data-type metrics"); tests in
`tests/js/type-metrics.test.mjs`, `tests/js/url-state.test.mjs` and
`tests/js/data-sources-panel.test.mjs`.

## Filters update live

Owner decision, 2026-10-05: a filter takes effect as it moves, not on release,
and a point disappears or reappears at once, with no fade.

- **Per frame, while a thumb moves.** Every metric range filter and the CDS
  length range has a two-thumb slider (`site/js/ui/range-slider.js`: two native
  range inputs over one track, each thumb with its own accessible name and
  value text, a thumb at an outer end meaning no bound), and the activity
  threshold keeps its single slider. Each movement, pointer or arrow key,
  reports through `onLiveChange`/`onRangeInput`; `applyFiltersLive` in
  `app.js` keeps only the newest values and applies them once per animation
  frame: the mask is recomputed, the current view repainted with it (the
  scatter plot through `setMask`, the chromosome view through
  `setFilterMask`, the length chart through a `live` update), and the filter
  panel's passing count, the row's fields, its histogram band and its
  accessible label follow. Nothing is rebuilt: a panel update that lands
  mid-gesture syncs the held control in place (`FilterPanel.liveControl`), so
  pointer capture and keyboard focus survive, and nothing is announced or
  written to the address.
- **On release.** The browser's `change` commits the same values through the
  ordinary `onChange` path: `renderAll`, one `replaceState`, the legend's
  hidden count, the detail, the comparison, and the panel rebuilt. The value
  on release is the value applied, and an arrow-key step is a completed
  gesture of its own.
- **Fields and thumbs agree both ways.** The *At least* and *At most* fields
  stay for an exact value and a blank still means no bound; a thumb moves
  them, and a typed value moves the thumb on commit. The thumbs cannot cross.
  A metric whose finite values have no spread shows fields only.
- Tests: `tests/js/range-slider.test.mjs`, `tests/js/filters-live.test.mjs`,
  and the slider case in `tests/js/length-explorer.test.mjs`.

## URL and local persistence

The current encoder is `ver=6`. A viewer-generated hash is a complete shareable
snapshot and always includes `l=`, including for an explicitly empty shortlist.
Hash and browser-history changes are applied live without reload.

Precedence is:

1. explicit URL fields;
2. local persistence only for fields an older or absent URL truly leaves
   unspecified; and
3. defaults.

A default that changes what an old snapshot means is versioned rather than
applied to it. Versions 1 and 2 omitted `ax`/`ay` exactly when the axes were CDS
length against CAI, so a hash declaring one of those versions decodes to that
pair and keeps plotting the axes its author shared. Version 3 omits them when
the axes are the measured fresh-view pair. A hash with no `ver` was not written
by this encoder, so its axes stay unspecified and fall to rule 3, the fresh
default, because axes have no local persistence; an explicit
`ax`/`ay` wins in every version. Version 4 dropped the single-source view
field `as` and added `cs` for the colour-source checkboxes as a comma list or
`none`; a version-3 hash with `as` decodes without error and opens on every
source. Version 5 added the controls-column layout `po`/`pc` and the chosen
comparison metrics `cm`, and version 6 moved those metrics out of the link into
browser storage, so a version-5 hash carrying `cm` is read past and dropped
exactly as `as` was. `tests/js/url-state.test.mjs` covers the old snapshot, the explicit
override, the unversioned fragment, the dropped `as` field, and the current
round trip.

Not every new field needs a version. A version number earns its place only where
the **absence** of a field has to mean two different things to two readers, as an
omitted `ax`/`ay` does. The per-axis scales `xs`/`ys` and the colour scale `csc`
and the draw direction `dt` are all absent-means-the-default fields, so none of
them bumped the encoder: an omitted `xs`/`ys` has only ever meant linear, an
omitted `dt` means highest on top and has never meant anything else, and an
omitted `csc` means the
colour metric's own default scale, which is exactly what a fresh view shows. That
last point is an owner decision of 2026-09-29 and is what makes an already shared
link to TSS initiation agree with a fresh view rather than stay pixel-identical to
what it once drew. `csc` is written whenever a scale is in effect, so a link
records which scale its author saw; a function-category colour has no scale and
writes no field. A `csc` naming a scale the metric cannot take resolves to that
metric's default, and the visible control and the URL correct themselves to
match — the same self-healing rule `xs`/`ys` follow.

Before applying a decoded snapshot, all state fields reset to fresh defaults;
omitted default-valued fields therefore cannot leak from the prior view. One
malformed percent-encoded field is ignored without discarding valid neighboring
fields or stranding the loading screen. The selected activity metric and its
threshold, scheme-name draft, filters, panel, colour, scheme map, shortlist,
pin, comparison tab, and visibility modes all round-trip.

Preset names populate the draft. Target/replacement changes retain it. **No
scheme** is the explicit clear and removes both map and draft name.

**Clear all filters** is atomic: it resets every numeric range, the activity
threshold, the translational-exception mode, and measured-only mode together.
No stale filter field may remain visible or encoded in the URL.

Saved-scheme **Load** and **Delete** are enabled only for a selected scheme that
still exists. With no saved schemes the selector is disabled; deleting the
selection clears and disables both actions rather than leaving silent no-ops.

Regression coverage is in `tests/js/scatter-navigation.test.mjs` and
`tests/js/url-state.test.mjs`; the all-channel reset is covered in
`tests/js/interface-copy.test.mjs`, and idempotent search rendering is covered in
`tests/js/gene-search.test.mjs`, including all search action states. Browser
validation must include live hash
changes, back/forward, seeded local storage plus explicit empty shortlist,
unavailable-map controls, first-click and keyboard search activation, keyboard
preview followed by search/pointer pinning, repeated map-point and search-result
pinning, reversible selection in both panels, focus after rerender and reset,
selections-only reset, and explicit scheme clear.

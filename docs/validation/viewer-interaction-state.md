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

## Annotation sources

The **Annotation sources** control is three independent checkboxes, UTEX
2973, PCC 7942, and GO IEA, all on in a fresh view. All three on is the
combined view; exactly one on is that source's single-source view; every
toggle off blanks every annotation field and leaves every CDS unknown. The
enabled set is encoded in the URL field `as` only when it is not the default:
a single id, a comma list of ids in canonical order, or `none`. Versions up to
3 wrote `as` as one id, which still decodes to that source alone, so old links
keep their meaning. Every view reads annotation fields through one accessor
(`site/js/core/annotation-source.js`), so the detail panel, shortlist and
comparison tables, panel-designer gene list, search suggestions, category
colour, and export agree on what the enabled sources annotated; see the
[data contract](data-contract.md#annotation-source-views) for the blank-value
rule. Search still matches locus tags in every view because identity is not
one source's annotation, while name and product suggestions come only from
UTEX 2973 and GO suggestions only from GO IEA. The GO IEA evidence tier and
its discrepancy notes belong to the combined view alone; PCC 7942 alone shows
the borrowed call without them.

In Function category colour mode the toggles also decide the colour: a
lab-reviewed UTEX 2973 assignment always wins when that source is on, an
enabled PCC 7942 or GO IEA source otherwise supplies its derived category,
and two derived sources that disagree fall into the multiple-functions
bucket. Derived colour draws as a hollow ring with a centre dot, the legend
title names the counted sources and its counts change live with each toggle,
and hover, click, and multi-select filtering act on the resolved category;
see [source-derived-categories.md](source-derived-categories.md). Toggles
are re-synced from the URL on hash and history changes.

## Pinned status row

When a gene is pinned, the unpin control sits to the left of the "Pinned"
label at the status text's size, keeps a 24 px hit area, its `aria-label`,
title, and `data-detail-action="unpin"` hook, and focus after unpin lands where
the reversible-pinning rules above say.

## URL and local persistence

The current encoder is `ver=4`. A viewer-generated hash is a complete shareable
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
`ax`/`ay` wins in every version. Version 4 changed the grammar of `as` from
one source id to a comma list or `none`; a version-3 single id still means
that source alone, and an older reader given a version-4 list falls back to
every source. `tests/js/url-state.test.mjs` covers the old snapshot, the
explicit override, the unversioned fragment, the `as` migration, and the
current round trip.

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

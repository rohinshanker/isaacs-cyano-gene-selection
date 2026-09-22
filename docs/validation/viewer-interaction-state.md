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
The legend names filtered CDSs as grey outlined squares only when they are
rendered. They retain their map coordinates and pointer access when that
visibility option is enabled; noncoding Tan features have no PCA coordinates
and remain in the separate regulatory search.

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

## URL and local persistence

The current encoder is `ver=3`. A viewer-generated hash is a complete shareable
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
by this encoder, so its axes stay unspecified under rule 2, and an explicit
`ax`/`ay` wins in every version. `tests/js/url-state.test.mjs` covers the old
snapshot, the explicit override, the unversioned fragment, and the current
round trip.

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

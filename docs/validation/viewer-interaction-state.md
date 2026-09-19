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
The legend names hidden grey dots only when those dots are actually rendered.

## URL and local persistence

The current encoder is `ver=2`. A viewer-generated hash is a complete shareable
snapshot and always includes `l=`, including for an explicitly empty shortlist.
Hash and browser-history changes are applied live without reload.

Precedence is:

1. explicit URL fields;
2. local persistence only for fields an older or absent URL truly leaves
   unspecified; and
3. defaults.

Before applying a decoded snapshot, all state fields reset to fresh defaults;
omitted default-valued fields therefore cannot leak from the prior view. One
malformed percent-encoded field is ignored without discarding valid neighboring
fields or stranding the loading screen. The selected activity metric and its
threshold, scheme-name draft, filters, panel, colour, scheme map, shortlist,
pin, comparison tab, and visibility modes all round-trip.

Preset names populate the draft. Target/replacement changes retain it. **No
scheme** is the explicit clear and removes both map and draft name.

Regression coverage is in `tests/js/scatter-navigation.test.mjs` and
`tests/js/url-state.test.mjs`. Browser validation must include live hash changes,
back/forward, seeded local storage plus explicit empty shortlist, unavailable-map
controls, keyboard preview followed by search/pointer pinning, and explicit
scheme clear.

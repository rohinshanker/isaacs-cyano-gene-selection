# Responsive workspace contract

The viewer keeps the active analysis in one source-ordered center column:

1. gene map;
2. candidate comparison;
3. collapsed guided panel designer;
4. candidate shortlist; and
5. collapsed dataset provenance.

Scheme and filter controls precede that column. Gene detail follows it. This DOM
order is also the single-column mobile reading and focus order; CSS never moves a
later element visually ahead of an earlier one.

The visible **Jump to map** control and the keyboard skip control scroll to and
focus the map canvas without replacing the versioned application hash. Navigation
inside the page must not erase a scheme, filter, shortlist, or pinned gene.

At 960 px the controls and analysis form two columns and detail remains below
them. At 1240 px detail becomes the third column. A long desktop detail card is
sticky and scrolls within the viewport; its landmark accepts arrow, Page Up,
Page Down, Home, and End. At a scroll boundary those paging keys hand movement
back to the document. Mouse-wheel and touch scrolling remain usable. On narrow
screens detail returns to document flow, and a selection-only **Jump to selected
gene detail** button makes the distant card reachable without changing state.

On desktop, the light grey separator resizes the controls rail with a pointer,
Arrow Left/Right (16 px), Shift+Arrow (48 px), Home, or End. At 1240 px a second
separator resizes the detail rail. Each rail stays at least 260 px wide and the
map column at least 400 px wide. Widths are saved in this browser under
`cyano.panel-widths.v1`; **Reset panel widths** restores the defaults. The
length view keeps the left separator only. Regulatory and citations views have
no side rails or resize controls. Presentation widths stay out of URL and
scientific exports. The scatter canvas observes its container size and redraws
after resizing.

The designer, shortlist help, and provenance use native disclosures so support
content does not dominate the default page. Wide tables, including the opened
axis-loadings table, scroll inside their own containers. The document itself
must not scroll horizontally.

## Regression checks

Render at 375×812, 768×1024, 959/960 px, 1239/1240 px, 1280×800, and
1440×900. Exercise empty, one-gene, and ten-gene shortlists; expanded provenance;
an opened axis-loadings table; completed shortlist and panel exports with their generated
filenames; an open designer with results; and a long selected-gene detail. Verify:

- comparison begins immediately after the map rather than after a sidebar;
- source order and focus order remain map → comparison → designer → shortlist →
  provenance → detail;
- sticky detail is viewport-bounded and keyboard/touch scrollable;
- the selected-detail shortcut appears only for a selection, remains available
  through 1239 px, and disappears when the sticky side rail begins at 1240 px;
- using either map jump, including while data is still loading, leaves
  `window.location.hash` byte-for-byte unchanged;
- both handles respect rail/map minima after drag, keyboard End, reload and
  viewport changes, and reset restores the default widths; and
- `document.documentElement.scrollWidth <= innerWidth` in every state.

The static source-order checks live in `tests/js/layout.test.mjs`.

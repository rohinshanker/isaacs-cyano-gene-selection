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

The map toolbar stacks rather than compressing. Colour by and Scale share its
first row, the colour explanation is directly beneath that row, and **Find a gene
is alone on its row and full width at every breakpoint** — the row grows into the
whole column instead of competing with a select for it. The order is fixed in
[controls-column-and-resets.md](controls-column-and-resets.md), and DOM order is
keyboard order, so the visual order is the tab order at every width.

Every dropdown reserves 2 rem on the right for its chevron, which sits 0.65 rem
inside the border. The control remains a native select for keyboard and menu
behavior; forced-colors mode restores its native appearance. The Filters
activity chooser always places its full-width select below **Judge activity by**.

**The Colour by and Scale row is the one exception to stacking**, by owner
decision, 2026-09-29: the two fields stay two columns of one row down to 360 px
rather than becoming two rows, because the owner asked for them on one line.
`.colour-scale-row` in `site/css/app.css` is that row, a CSS grid so the pair
cannot split, and the same rule serves the map toolbar and the chromosome
toolbar. Three things make the exception work:

- **The two fields always take the same label placement as each other.** Never
  one inline and the other stacked — that mismatch is what once left the Scale
  field 13 px above Colour by with its select 13 px below it, two fields on one
  row that looked like neither. One rule sets the placement for both.
- **Below 560 px both labels sit above their controls**; from 560 px up both sit
  beside them. Inline at 360 px the two labels and their gaps take 134 of a
  274 px row and leave the selects nothing — a content-sized Scale column reduced
  Colour by to 30 px of dropdown arrow with no text in it. Stacked, each select
  gets its whole column and both read at 360 px.
- **Colour by is the field that truncates.** From 560 px up Scale's column is
  sized to its own longest option, so the scale in effect is always legible, and
  Colour by takes every remaining pixel; it has the toolbar's longest option text
  ("Expected ENC − observed (codons)"), and truncating it costs little because
  the full metric label heads the explanation directly beneath the row and the
  legend names the metric and the scale in full.

Between that row and the colour explanation sits the note naming any scale this
metric cannot take, with the reason (`#color-scale-notice`, and the chromosome
tab's own). It is hidden, occupying nothing, whenever every scale is available,
which is why the explanation is still directly beneath the row in the ordinary
case. The chromosome toolbar has the map toolbar's structure for the same reason:
its own Colour by and Scale row, then that note, then its colour explanation,
then its view buttons on a row of their own — flat, it wrapped `Zoom in (+)` up
beside Scale at 375 px and stranded Colour by above it. See
[chromosome-view.md](chromosome-view.md).

An info button sits immediately beside each **Scale** label and remains enabled
when the Scale select is disabled. Label and icon share `.scale-label-row`, an
inline flex row with centered items. Both field labels reserve the icon's height,
so the Colour by and Scale selects share a baseline below 560 px as well as
above it. The icon stays on the label line when the fields stack; it must never
be a third line between label and select. Its popover is fixed to viewport coordinates,
clamped to 16 px side margins, and placed above the trigger when there is not
room below. At 375 px its long symmetric-log copy must remain wholly within the
viewport; the same control and placement rules apply on the Chromosome/Gene
tab. Hover, focus, click/touch, Escape, focus departure, and an outside pointer
press are the supported open/dismiss paths.

The shared scatter-map toolbar has a 0.5 rem bottom margin. This leaves a small
gap above the plot even when the view buttons wrap. Search results and filter
status stay in normal flow between toolbar and canvas; keep this spacing on the
toolbar rather than adding it to every canvas or individual button.

The designer, shortlist help, and provenance use native disclosures so support
content does not dominate the default page. Wide tables, including the opened
axis-loadings table, scroll inside their own containers. The document itself
must not scroll horizontally.

Every tan information treatment uses the shared closed native
`details.tan-disclosure` contract. The inventory is: borrowed-source notes in
filters; search-alias and GO search notes; gene-view sequence structure;
function-category, cross-organism, translational-exception, sequence-structure,
and borrowed-metric notes in gene detail; colour-legend provenance; guided-panel
borrowed-source, constraint, result-status/result-information, and per-gene
caveat notes; regulatory-source cautions; RNA handoff warnings; shortlist filter
status; synthetic strain-fitness evidence; recomputation warnings; and the
center-column filter banner. Each keeps a concise summary visible, starts closed
when created, retains its original content and controls when opened, and leaves
no explanatory gap when closed. A red blocking/error treatment such as
`.metric-alert` is not a tan information box and remains immediately visible.

## Regression checks

Render at 375×812, 768×1024, 959/960 px, 1239/1240 px, 1280×800, and
1440×900. Exercise empty, one-gene, and ten-gene shortlists; expanded provenance;
an opened axis-loadings table; completed shortlist and panel exports with their generated
filenames; an open designer with results; and a long selected-gene detail. Verify:

- comparison begins immediately after the map rather than after a sidebar;
- dropdown text leaves room before the inset chevron, including long selected
  values and disabled Scale controls; the activity selector spans the filter
  column below its label at every width;
- in the map toolbar, Colour by and Scale share the first row, the colour
  explanation is directly beneath it, and Find a gene is alone on the next row at
  full width, with the tab order following that;
- Colour by and Scale are still two columns of one row at 360 px, both fields
  with the same label placement, their selects on one baseline, and every scale
  name legible in the Scale select; the same holds on the chromosome tab, where
  no view button shares their row;
- the note naming an unavailable scale sits between that row and the colour
  explanation on both tabs, and takes no height at all under a metric every scale
  can take (`#c=tssInitiation` against `#c=rareCount`);
- the adjacent Scale info button still opens when Scale is disabled; its dynamic
  symmetric-log and percentile copy fits the viewport and dismisses by keyboard,
  touch/click, focus departure, and an outside pointer press on both affected tabs;
- every inventoried tan information box starts closed, opens and re-closes with
  native keyboard operation, and conditional boxes disappear without leaving a gap;
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
The real-browser alignment, spacing, popover and shared-map interaction checks
use the existing machine-wide Playwright CLI, without a project dependency:

```sh
playwright-cli -s=<unique-session> open 'http://127.0.0.1:<task-port>/site/?uiArtifacts=<absolute ignored artifact directory>'
playwright-cli -s=<unique-session> run-code --filename=tools/ui/check_toolbar_layout.js
```

Start the server from the assigned worktree. The check renders both toolbars at
360, 375, 559/560, 768, 959/960, 1239/1240, 1280 and 1440 px, checks element
centers and select baselines, and saves screenshots. It also checks hover,
keyboard and pointer disclosure paths, disabled and enabled Scale, changing
explanations, viewport clamping, shared scatter views, zoom/pan/reset, and search
and filter content between toolbar and plot. Unexpected browser errors fail it.

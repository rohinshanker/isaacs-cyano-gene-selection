# O_tab-navigation-layout__20261016 — Open

- **Scope:** Reduce the number of rows the view tabs (`#panel-tabs`, built from
  `ALL_TABS` in `site/js/app.js`) take on every screen width while keeping every
  view reachable. Covers `site/` tab markup, styling and key handling, and the
  validation documents that fix the tab contract. Excludes the organism selector,
  Colour by/Scale, filters, scheme presets and the Data Sources panel, which are
  dataset and filter controls, not view tabs.
- **Status:** open
- **Opened:** 2026-10-16
- **Updated:** 2026-10-16

## Current state

Opened at the owner's explicit request (via DEM-438; distinct from DEM-437):
**the tabs take too many rows; reduce them, retain all views, and give
suggestions to review when this ticket starts.** No option below is approved, and
none blocks opening the ticket. Nothing is implemented or scheduled. The owner
has not been asked to choose; the first step when work starts is to review the
options and the design choices below with the owner.

### What exists (rendered from commit 3f4ad333, 2026-10-16)

The tabs are one `role="tablist"` with a roving tabindex and Left/Right arrow
movement. Each tab is a registered `ALL_TABS` record whose permanent id is the `p`
token in the URL hash. `.tablist` in `site/css/app.css` is
`display: flex; flex-wrap: wrap`, so rows are whatever wrapping produces.

| Organism | Width | Tabs | Rows | Tablist height | Tablist top (page y) |
| --- | --- | --- | --- | --- | --- |
| UTEX 2973 (default) | 375 | 11 | 7 | 250 px | 3,974 of 8,076 |
| UTEX 2973 | 768 | 11 | 3 | 109 px | 2,788 of 5,902 |
| UTEX 2973 | 1280 | 11 | 3 | 109 px | 260 of 4,207 |
| Syn61Δ3(ev5) | 375 | 12 | 8 | 285 px | 4,243 of 8,365 |
| Syn61Δ3(ev5) | 768 | 12 | 3 | 109 px | 2,930 of 6,129 |
| Syn61Δ3(ev5) | 1280 | 12 | 4 | 144 px | 296 of 4,937 |

- The tab set varies by organism. A recoded derivative adds
  "MDS42 public-reference codon space" (285 px wide, the widest tab) and orders
  the tabs differently; that is what makes Syn61 wrap to 4 rows at 1280. Only
  UTEX 2973 and Syn61Δ3(ev5) were rendered; other E. coli entries were not.
- On desktop the tablist sits in the centre column (about 590 px at 1280), not
  across the page. Eleven tabs sum to about 1,460 px, so even a full-width bar
  at 1280 would not hold them in one row with today's labels and padding.
- On narrow screens the tablist follows the whole controls column in DOM order
  (`docs/validation/responsive-workspace.md`), so it starts roughly 4,000 px down
  the page at 375 px. Reordering it conflicts with that contract; treat it as a
  design choice below, not a given.
- No horizontal overflow and no console errors at any measured width.
- Observed contract gaps, recorded so the implementation does not regress or
  accidentally change them: a tab change calls `replaceState` (history length
  unchanged after a click), so Back/Forward does not step through tabs today;
  tabs have no `aria-controls`; Home/End are not handled; Left/Right wrap
  around.

### Options for review (provisional; none approved)

Estimated row counts are projections from the measured tab widths, not
renders; measure them when implementing.

1. **One horizontally scrollable row.** Keep one tablist, `flex-wrap: nowrap`,
   `overflow-x: auto`, scroll the selected tab into view, edge fades or chevron
   buttons as the scroll cue.
   - Pros: always 1 row at every width; smallest change; DOM order, `p` tokens,
     roving tabindex and arrow keys stay as they are.
   - Cons: off-screen tabs are less discoverable on a 12-tab set and need
     clear navigation cues; horizontal scrolling inside a
     page that forbids horizontal document scroll needs care; weak on mouse
     without a scroll cue.
2. **Map-space selector plus short view tabs.** The six scatter projections
   (Native, Parent-reference, Metric X vs Y, Recoding-risk, Baseline risk UMAP,
   Perturbation) share one map canvas and toolbar. Replace them with one
   "Map space" select or menu button that sets the existing `p` ids, beside tabs
   for the remaining views: Chromosome/Gene, tRNA, Lengths, Regulatory sites,
   Strain fitness, Citations & sources, with shortened labels.
   - Pros: removes most of the width pressure while retaining all views; projection
     ids and links stay as they are; likely 1–2 rows at 768 and 1280 and about 3
     at 375 (from 7–8); matches how the views are actually related.
   - Cons: a projection takes two clicks instead of one; tab and select need one
     consistent selected-state story; the Syn61 reference projection's long name
     needs a short label.
3. **Priority tabs plus a "More" menu.** Show the few most-used views as tabs
   and fold the rest into an overflow menu button that opens on click and
   keyboard.
   - Pros: 1 row at all widths; common views stay one click; a familiar
     pattern.
   - Cons: which views are "primary" is an owner judgment and differs by
     organism; the active view inside the menu needs visible state; a menu
     adds an ARIA menu/disclosure and focus-return surface.
4. **Two-level groups.** A short row of group tabs (for example Map spaces,
   Genome views, Evidence) with a second row of that group's tabs only.
   - Pros: targets 2 rows; scales when more views are added. Narrow screens
     still need a bounded/scrollable subrow to avoid wrapping further.
   - Cons: uses 2 rows even where a single-row option would fit;
     two-level tab semantics and arrow-key behaviour are harder to make
     accessible; more clicks to reach any view.

**Provisional recommendation:** option 2, using option 1's scroll fallback only
below the width where the remaining tabs still wrap. It reduces the visible tab count, retains every view and keeps the `p`
registry intact; projection choices move inside the labelled selector. This is the proposer's view for the
owner to review, not a decision.

### Design choices to review when implementation begins

- Which views belong behind a selector or group, and the short label for each.
- Whether the tablist keeps its place after the controls on narrow screens or
  moves nearer the top, given the DOM-order contract.
- Whether tab changes should add history entries (they do not today).
- Whether to add `aria-controls`, Home/End, and no-wrap arrows while the keyboard
  code is open.
- How a selector reports the selected view to assistive technology, and whether
  its Left/Right behaviour matches the remaining tabs.
- The organism-specific extra tab and its order.

## Constraints

Any option must preserve: every current view and its `p` token; deep links,
reload and the last-view memory; the selected state; roving tabindex, arrow-key
movement and visible focus; discoverability of every view; and use at 375, 768
and 1280 px with no document-level horizontal scroll. Changes touch
`site/js/app.js`, `site/css/app.css`, `tests/js/layout.test.mjs`,
`docs/validation/viewer-interaction-state.md`, and
`docs/validation/responsive-workspace.md`. Related, separate ticket:
[O_ui-clutter-human-audit__20261005](O_ui-clutter-human-audit__20261005.md), which
concerns standing wording, not tab layout.

## Verification

Ticket-opening evidence only; no implementation exists.

- Rendered the static `site/` from this worktree with a private
  `python3 -m http.server` and a private Playwright CLI session at 375×812,
  768×1024 and 1280×800 for UTEX 2973 and Syn61Δ3(ev5); row counts and tab
  positions measured from the DOM. Console: 0 errors, 0 warnings.
- Screenshots are kept outside the repository and are not committed.
- A tab click was checked for hash change and history length (see above).
- Not verified: other organisms, the 1440 px width, a keyboard pass, forced
  colours.
- When implementing, render all three widths for at least two organisms with the
  chosen option, run `npm test`, `.venv/bin/python -m pytest -q` and
  `.venv/bin/python tools/validate_contract.py`, and record the results here.

## Cleanup

Close under the "Closing a ticket" rules in `AGENTS.md`: distill the final tab
contract into `docs/validation/viewer-interaction-state.md` and
`docs/validation/responsive-workspace.md`, then delete this ticket and its
`INDEX.md` row.

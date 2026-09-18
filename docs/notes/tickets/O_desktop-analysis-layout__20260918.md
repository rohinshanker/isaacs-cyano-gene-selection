# O_desktop-analysis-layout__20260918 — Open

- **Scope**: Relationship between controls, map, detail, and candidate comparison on desktop.
- **Status**: open
- **Opened**: 2026-09-18
- **Updated**: 2026-09-18
- **Priority**: P1 — the comparison workflow is separated from the map by several blank screens.

## Current State

At 1440×900 on viewer commit `fd0e42981ba4347189e27faf25e1e8f3aee42524`,
with a 10-gene scheme-active shortlist:

- the controls column is 3,937.5 px tall;
- the map is 1,115.1 px tall;
- the gene-detail card is 107.1 px tall before selection; and
- the comparison section starts at y=4,106.0, leaving about 2,838 px between the
  bottom of the map and the start of comparison.

The comparison section sits after the entire three-column grid in document flow,
so the tallest control column determines where comparison begins. The expanded
metric-convention provenance and readable shortlist rows make the structural
problem more visible, but they are not the cause.

## Proposed Resolution

- Restructure the workspace so map and candidate comparison share an analysis
  column and remain adjacent, while controls and detail occupy their own columns.
- Keep source order logical for keyboard and small-screen reading; use nested grid
  areas rather than CSS visual reordering.
- If controls become sticky or independently scrollable, avoid a nested-scroll
  trap and keep every control reachable with keyboard and touch.
- Preserve the current single-column mobile order and table horizontal scrolling.

## Verification

- At 1280×800 and 1440×900, comparison starts directly after the map/analysis
  content rather than after the tallest sidebar.
- At 375×812 and 768×1024, content order, focus order, and headings remain logical.
- Validate empty, one-gene, and 10-gene shortlists; long provenance; selected gene
  detail; and all comparison tabs.
- No page-level horizontal overflow or unreachable sticky content.

## Cleanup

When resolved, record the responsive workspace layout contract in
`docs/validation/`, update its index, and remove this ticket and its index row.

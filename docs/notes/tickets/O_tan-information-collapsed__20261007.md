# O_tan-information-collapsed__20261007 — Open

Scope: Make every instance of the tan text/information box across the site collapsed by default, with a relevant label that opens the full existing content.
Status: open
Opened: 2026-10-07
Updated: 2026-10-09

## Current State

Implemented by `codex-implementer` in the DEM-322 worktree on 2026-10-09;
the ticket remains open for its owning session to review and close.

The owner's clarified scope on 2026-10-07 is all instances of the tan text box,
including the one at the bottom of the center panel. The original filter-only
scope is superseded. Initially show only a relevant disclosure label, such as
“Provenance / information”; opening it reveals the full existing content.
The example label is guidance, not a demand for that exact spelling.

Source context: `.provenance-warning` supplies the shared tan box styling in
`site/css/app.css`. Its current renderers include Filters, the center-panel
legend, gene detail, shortlist, panel designer, regulatory sites, folding handoff,
and the provenance section. The center-panel source note is appended by
`site/js/ui/legend.js`. Inventory all rendered tan text boxes at implementation,
including visually equivalent boxes using other classes such as `.gene-flag`,
`.search-alias-note`, `.filter-banner.active`, and `.candidate-borrowed-caution`;
the scope is not limited to one CSS selector. These are source observations,
not rendered validation.

Opening baseline: canonical Desktop checkout, `main` at
`fb9747e6c3a4ed26f778e72a653c174beead9500`. Existing uncommitted Data Sources
work touches `site/css/app.css` and the Data Sources modules; preserve it.

## Acceptance

- Every tan text/information box starts collapsed on a fresh view and when its
  content first appears, including filter boxes and the bottom-center-panel box.
- A concise, relevant label remains visible and opens/closes the explanation.
- Collapsed content occupies no blank explanatory block; surrounding controls
  stay visible and usable in both disclosure states.
- Keep all existing text, links, and controls available when opened, including
  source, organism, measurement, uncertainty, and warning information. Keep the
  content current as the view, selection, source, or underlying state changes.
- Use the existing disclosure conventions, with keyboard operation, a visible
  focus state, and an accessible expanded/collapsed state.
- Apply the behavior consistently across every affected view and panel; document
  the complete instance inventory so none is silently left out.

## Affected Area and Clarification

Before implementation and again at resolution, compare every affected tan box
and its surrounding controls against the opening baseline. Record whether
intervening changes affected these areas, which instances were changed, and
whether anything needs owner clarification. State explicitly when no
clarification is needed.

Related: `O_ui-clutter-human-audit__20261005.md` covers broader explanatory text;
this is a specific owner-approved collapse request. Update any affected standing
text contract to reflect this request while retaining the explanation in the
disclosure.

## Verification

Ticket opening and scope clarification: source locations and queue link checked;
the ticket was renamed to reflect the site-wide scope. UI behavior has not been
rendered or changed.

At implementation, render the real application at 375, 768, 1280, and 1440 px
widths and relevant breakpoints. Inspect initial collapsed, expanded, and
re-collapsed states for every inventoried instance, including conditional boxes
and the bottom-center-panel box. Exercise keyboard operation, view/source/state
changes, and relevant content appearing/disappearing. Confirm the full content
and controls remain reachable, wording stays accurate, and there is no leftover
gap, clipping, or horizontal overflow. Inspect runtime diagnostics; run focused
checks for every affected component and all repository completion gates.

Implementation verification, `codex-implementer`, 2026-10-09: a shared
`tanDisclosure()` native-details contract now wraps the complete inventory:
borrowed-source filter notes; search alias and annotation-search notes; gene-view
sequence structure; gene-detail function-category, cross-organism,
translational-exception, sequence-structure, and borrowed-metric notes; legend
provenance; guided-panel borrowed measurements, borrowed constraints, stale and
feasible result information, and gene caveats; regulatory source cautions; RNA
handoff warnings; shortlist filter status; synthetic strain-fitness evidence;
recomputation warnings; and the center-column filter-status box. Blocking red
errors remain visible because they are not tan information boxes. Every created
disclosure is closed by default, its summary remains visible, and its existing
text/links/controls remain inside the opened body. The filter disclosure hides
and resets closed when no genes are filtered.

Rendered inspection covered fresh, opened, and re-collapsed native disclosures,
conditional search and filter boxes, map/chromosome provenance, both organisms,
all ten tabs, and the condition-grid active-button hover at 375×812, 768×1024,
1280×800, 1440×900, plus 559/560 and 1319/1321 breakpoint pairs. The visible
tan-class audit found every instance nested in a closed
`details.tan-disclosure`; no document overflow appeared. A forced gene-data HTTP
500 showed a reachable Retry control, and retry succeeded after the route was
restored. The active Cyanobacteria chip and condition-grid Done button both kept
`rgb(31, 95, 125)` behind white text on hover.

Affected-area comparison: the opening baseline `fb9747e6` predates substantial
Data Sources, multi-organism, chromosome, and strain-fitness work present at
implementation parent `8bdefc7`; the inventory was therefore repeated against
the current renderers rather than copied from the opening list. The Multica
bookkeeping commit `766e93e` changed no project code. No owner clarification was
needed. Focused component checks passed. Final gates passed: `npm test` ran 1,340
JavaScript tests; Python ran 891 tests with one expected skip and 36 subtests;
`tools/validate_contract.py` passed 117 checks with one declared skip. The
managed worktree had no `.venv`, so both Python gates used the canonical
checkout's existing `.venv/bin/python` against this worktree.

PRESENTATION-R1 repair, `codex-implementer`, 2026-10-09: the misplaced
disclosure was removed from the grey GO IEA context block and applied to the
tan function-category block itself. With `M744_RS00005` pinned, the full source,
probability, threshold, provenance and caveat explanation is now closed behind
“Function category / information” at 375×812, 768×1024, 1280×800 and
1440×900. Opening it restores the complete content. A second real-data
regression confirms GO context retains its candidate-evidence presentation and
does not acquire the function-category label. Borrowed metric-source notes
remain closed inside the parent-integrated lazy metric-family table; that lazy
construction and its tests were preserved. Focused checks passed 44/44. Final
gates passed: 1,346 JavaScript tests; 891 Python tests with one expected skip
and 36 subtests; 117 contract checks with one declared skip. No visual baseline
files changed.

## Cleanup

When implemented and verified, report the affected-area change and clarification
assessment, rename/status-mark this ticket resolved, and record final validation.
Distill the reusable shared tan-box disclosure behavior and affected component
contracts into the relevant validation documents; update
`docs/validation/INDEX.md`. Then delete the resolved ticket and remove its queue
row. Leave the broader clutter audit open.

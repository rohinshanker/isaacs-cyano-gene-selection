# O_tan-information-collapsed__20261007 — Open

Scope: Make every instance of the tan text/information box across the site collapsed by default, with a relevant label that opens the full existing content.
Status: open
Opened: 2026-10-07
Updated: 2026-10-07

## Current State

Opened for later at the owner's request. No implementation started.

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

## Cleanup

When implemented and verified, report the affected-area change and clarification
assessment, rename/status-mark this ticket resolved, and record final validation.
Distill the reusable shared tan-box disclosure behavior and affected component
contracts into the relevant validation documents; update
`docs/validation/INDEX.md`. Then delete the resolved ticket and remove its queue
row. Leave the broader clutter audit open.

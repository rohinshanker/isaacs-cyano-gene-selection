# O_annotation-precedence-data-sources__20261007 — Open

Scope: Move the functional-annotation precedence explanation into the expandable Data Sources section, visible only when opened and spanning its full content width.
Status: open
Opened: 2026-10-07
Updated: 2026-10-07

## Current State

Opened for later at the owner's request. No implementation started.

The owner wants the functional-annotation precedence text removed from its
standing location and placed inside Data Sources. It should appear only when
that section is opened and use the full section width rather than half width.

Source context: `site/js/ui/legend.js` appends the precedence explanation to the
function-category legend as a `.legend-ramp-note`. That class has a `38ch`
maximum width in `site/css/app.css`. The same paragraph ends with a category
interaction hint; keep that hint's behavior and separate it from the precedence
copy if needed. `site/js/ui/data-sources.js` builds the closed-by-default
`details.data-sources` section and already renders annotation-source toggles
inside it. These are source observations, not a rendered reproduction of the
reported half-width layout.

Opening baseline: canonical Desktop checkout, `main` at
`fb9747e6c3a4ed26f778e72a653c174beead9500`. Data Sources work is already
uncommitted in `site/js/ui/data-sources.js`, `site/js/core/data-sources.js`, and
`site/css/app.css`; preserve and coordinate with that work at implementation.

## Acceptance

- Functional-annotation precedence is explained inside Data Sources, with no
  duplicate standing precedence paragraph outside the section.
- The explanation is visible only while Data Sources is expanded; collapsing
  or hiding the section leaves no blank space or exposed explanation.
- It spans the full available content width of the section, with normal padding
  and responsive wrapping, without the former narrow/half-width constraint.
- Preserve organism-specific source names, precedence, evidence labels,
  thresholds, and conflict disclosures; source toggles continue to work.
- Expansion and collapse remain keyboard accessible, and switching metrics or
  organisms does not show stale annotation text or disturb unrelated source lists.

## Affected Area and Clarification

Before implementation and again at resolution, compare the function-category
legend, annotation-source controls, and Data Sources section against the opening
baseline. Record whether intervening changes affected this area, whether the
requested relocation still applies, and whether anything needs owner
clarification. State explicitly when no clarification is needed.

Related: `O_data-sources-selection__20261005.md` covers the broader feature;
`O_ui-clutter-human-audit__20261005.md` covers other explanatory text. This
ticket records the owner's specific move and does not resolve those broader tasks.

## Verification

Ticket opening: source locations and queue link checked. UI behavior has not
been rendered or changed.

At implementation, render the real application at 375, 768, 1280, and 1440 px
widths and relevant breakpoints. Inspect Data Sources expanded, collapsed, and
hidden, annotation-source toggles, function-category and other colour metrics,
and both organisms where applicable. Inspect screenshots and full-width text
geometry, keyboard expansion/collapse, overflow, and runtime diagnostics. Run
focused legend/Data Sources checks and all repository completion gates.

## Cleanup

When implemented and verified, report the affected-area change and clarification
assessment, rename/status-mark this ticket resolved, and record final validation.
Distill the reusable placement/visibility contract into the relevant Data Sources
and function-category validation documents and update `docs/validation/INDEX.md`.
Then delete the resolved ticket and remove its queue row. Leave broader Data
Sources and clutter-review work open.

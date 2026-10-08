# O_scale-information-popover__20261007 — Open

Scope: Move the scale explanation from below the map into a popover opened by an info button beside Scale.
Status: open
Opened: 2026-10-07
Updated: 2026-10-07

## Current State

Opened for later at the owner's request. No implementation started.

The owner wants the information about the scale removed from below the map.
An info button next to “Scale” should open that information as a popover on
both click and hover.

Source context: `site/js/ui/legend.js` appends `.legend-scale-note` below the map
using `describeValueScale()`, which describes the current scale and any
symmetric-log transition or percentile interpretation. Nearby `describeRamp()`
copy describes the ramp family and its origin. Inspect the rendered explanation
to establish the full text to move. `site/index.html` supplies the Scale label,
selector, hidden hint, and availability notice; the Chromosome view shares the
scale state. Reuse existing help/overlay conventions rather than relying on a
native title tooltip. This is source inspection, not rendered validation.

Opening baseline: canonical Desktop checkout, `main` at
`fb9747e6c3a4ed26f778e72a653c174beead9500`. Other uncommitted Data Sources and
metric changes are present; preserve them and check their effect on scale copy
when implementing.

## Acceptance

- Scale explanatory text is available in a popover from an info button adjacent
  to the “Scale” label, instead of standing below the map.
- Both hover and click open the popover; click/touch and keyboard operation make
  the same information available without requiring hover.
- Preserve all applicable scale explanation and keep it current when the metric
  or scale changes, including symmetric-log and percentile details.
- Remove the former explanatory block without leaving a blank gap. Preserve
  functional scale labels, ramp/tick meaning, and the selector's behavior.
- Provide an accessible button name, visible focus, and usable dismissal/focus
  behavior. The popover must fit the viewport and remain readable while hovered.
- Check the shared Scale control in every affected view, including Chromosome;
  keep its explanation consistent with the active scale and available when the
  selector is disabled.

## Affected Area and Clarification

Before implementation and again at resolution, compare the Scale controls,
below-map explanations, and shared view behavior against the opening baseline.
Record whether intervening changes affected these areas, which text was moved,
and whether anything needs owner clarification. State explicitly when no
clarification is needed.

Related: `O_ui-clutter-human-audit__20261005.md` covers broader explanatory text.
`O_tan-information-collapsed__20261007.md` covers tan text boxes; coordinate any
overlap without duplicating the scale explanation.

## Verification

Ticket opening: source locations and queue link checked. UI behavior has not
been rendered or changed.

At implementation, render the real application at 375, 768, 1280, and 1440 px
widths and relevant breakpoints. Inspect popover closed/open, hover, click/touch,
keyboard focus and dismissal, long symmetric-log/percentile copy, metric/scale
changes, and disabled Scale. Check affected map and Chromosome states for
positioning, clipping, overlap, full text visibility, and removed below-map space.
Inspect runtime diagnostics; run focused scale/legend/interaction checks and all
repository completion gates.

## Cleanup

When implemented and verified, report the affected-area change and clarification
assessment, rename/status-mark this ticket resolved, and record final validation.
Distill the reusable scale-info placement/interaction contract into
`docs/validation/current-design-answers.md` and relevant responsive guidance;
update `docs/validation/INDEX.md`. Then delete the resolved ticket and remove its
queue row. Keep the broader clutter audit open.

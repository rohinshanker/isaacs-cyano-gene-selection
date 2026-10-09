# O_scale-information-popover__20261007 — Open

Scope: Move the scale explanation from below the map into a popover opened by an info button beside Scale.
Status: open
Opened: 2026-10-07
Updated: 2026-10-09

## Current State

Implemented by `codex-implementer` in the DEM-322 worktree on 2026-10-09;
the ticket remains open for its owning session to review and close.

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

Implementation verification, `codex-implementer`, 2026-10-09: the former long
legend note was removed. Map and Chromosome/Gene now have independently enabled,
adjacent info buttons backed by the same live scale description. Browser checks
covered hover, focus, click/touch-style pinning, second-click dismissal, Escape
with focus restoration, focus departure, and outside-pointer dismissal. Dynamic
percentile and symmetric-log copy updated with the metric and the observed
transition scale; Function category kept the info button operable while both
Scale selects were disabled. At 375×812 the popover was clamped to `x=16..359`;
768×1024, 1280×800, 1440×900, and 559/560 and 1319/1321 breakpoint pairs had no
document overflow or clipped affected controls.

Affected-area comparison: the opening baseline `fb9747e6` predates the shared
scale state and current Chromosome/Gene toolbar present at implementation parent
`8bdefc7`; the requested move still applied and was implemented through those
current contracts rather than copying state. The Multica bookkeeping commit
`766e93e` changed no project code. No owner clarification was needed. Focused
scale, legend, disclosure, and chromosome checks passed. Final gates passed:
`npm test` ran 1,340 JavaScript tests; Python ran 891 tests with one expected
skip and 36 subtests; `tools/validate_contract.py` passed 117 checks with one
declared skip. The managed worktree had no `.venv`, so both Python gates used
the canonical checkout's existing `.venv/bin/python` against this worktree.

UI-REVIEW-5 follow-up, `codex-implementer`, 2026-10-09: repeated availability
reasons are now emitted once in the visible Scale notice while each unavailable
option retains its own verbatim disabled reason. A regression test covers a
numeric metric with zero finite values and all five scale options disabled.
Rendered verification deliberately returned HTTP 500 for
`expression_layers.json`, selected one of that file's unavailable transcript
datasets, and confirmed the actionable failure text and Retry button remain
visible while both Native codon space and Chromosome/Gene state the shared
“has no finite values to scale” reason exactly once. This held at 375×812,
768×1024, 1280×800, and 1440×900 with no horizontal overflow. The info popover
remained operable in that state, fit within the 375 px viewport, and Escape
closed it with focus restored. Restoring the route and choosing Retry removed
the failure and returned the selected source to a usable scale. The deliberate
HTTP 500 was the only console error; there were no warnings or unexpected
runtime errors. Evidence is under the durable presentation artifact directory
as `ui-review-5-*`. Final gates: 1,342 JavaScript tests passed; Python passed
891 tests with one expected skip and 36 subtests; the contract validator passed
117 checks with one declared skip.

## Cleanup

When implemented and verified, report the affected-area change and clarification
assessment, rename/status-mark this ticket resolved, and record final validation.
Distill the reusable scale-info placement/interaction contract into
`docs/validation/current-design-answers.md` and relevant responsive guidance;
update `docs/validation/INDEX.md`. Then delete the resolved ticket and remove its
queue row. Keep the broader clutter audit open.

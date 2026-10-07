# A_instant-hover-hints__20261006 — Active

- **Scope:** Replace delayed native browser/platform hover hints that provide
  additional information across `site/` with instant hints that follow the mouse,
  including dataset light measurements and their exact values.
- **Status:** active
- **Opened:** 2026-10-06
- **Updated:** 2026-10-06

## Current State

Opened at the owner's request; implementation has not started. The owner reports
that important details currently require holding the mouse over an element for
one or two seconds. Source inspection confirms HTML `title` attributes and SVG
`<title>` elements are used for supplementary information. In particular,
`conditionTrack()` in `site/js/ui/data-sources.js` supplies the formatted range,
units, and original reported text through an SVG title and an accessible label.
The reported delay has not been reproduced in a browser for this ticket.

## Requirements

1. Audit the site's existing native hover hints that expose additional text.
   Cover dataset light measurements, other condition tracks, and other relevant
   HTML/SVG hints, rather than fixing only the example.
2. Display the hint immediately on pointer entry, with no dwell timer or delayed
   reveal. Follow the mouse as it moves within the triggering element. Use a
   custom tooltip element wherever native hints cannot provide this behavior.
3. Clicking while a hint is visible must hide it immediately and suppress its
   return for the rest of that visit to the triggering element. Moving within
   the element, waiting, or clicking again must not restore it. Leaving and
   re-entering the element must show it immediately again.
4. Preserve every existing hint's text exactly, including wording, punctuation,
   numeric precision, units, and dynamically supplied values. Reuse the current
   text sources; do not rewrite, summarize, or append instructions.
5. Do not mention click dismissal or re-entry behavior in popup/hint text. The
   owner expects users to discover the interaction themselves.
6. Prevent duplicate delayed native hints alongside the replacement. Retain the
   existing information's accessible exposure when moving it out of HTML/SVG
   native titles. The hint must not intercept clicks or interfere with the
   underlying control's normal action.
7. Keep hints inside the viewport with a small pointer offset and support long
   existing text without clipping. Clear stale hints when the trigger disappears,
   its containing popup closes, or navigation changes the view. Preserve access
   to the same information for keyboard and touch/iOS users where applicable.

## Implementation Reference

The owner's personal website already has the desired instant, mouse-following
presentation for the bottom-most visible card in a Solitaire tableau stack:
`/Users/Rohin/Desktop/coding_stuff/personal-website/scripts/home/features/solitaire.js`
(`solAttachTableauTooltip`, `solPositionTableauTooltip`, and
`solTableauColumn`) and `styles/home/apps/solitaire.css` (`.sol-tableau-tooltip`).
Source inspection shows a body-level tooltip with a 12 px pointer offset and
viewport-edge clamping. Use this as a behavior reference; click suppression until
exit/re-entry is an explicit requirement of this ticket.

Coordinate coverage of dataset rows with
[O_data-sources-selection__20261005](O_data-sources-selection__20261005.md).

## Verification

Implementation verification is pending. Acceptance requires:

- Inventory the existing hint text before conversion and verify exact equality
  after conversion, including dataset light ranges, units, and reported values.
- Test immediate entry, movement, exit, click dismissal, suppression during
  subsequent movement/wait/click, and immediate return after exit/re-entry.
- Test switching between triggers, dynamic content, popup closure, native-hint
  duplication prevention, and preservation of underlying click actions.
- Use the `ui-render-inspect-repair` skill to render and inspect the actual site
  at mobile, tablet, and desktop widths. Check dataset light measurements, other
  converted hints, viewport edges, long text, scrolling, keyboard access, and
  touch/iOS behavior where available; record any platform not verified.
- Run repository gates: `npm test`, `.venv/bin/python -m pytest -q`, and
  `.venv/bin/python tools/validate_contract.py`.

Ticket intake: checked the live queue and canonical checkout's Git remote,
identified existing native hint sources, and inspected the Solitaire reference.
No application code changed for ticket creation.

Ticket-creation checks passed: ticket identity, required fields, unique queue
link, whitespace, `git diff --check`, `npm test` (1,066 passed),
`.venv/bin/python -m pytest -q` (479 passed, 1 skipped, 36 subtests passed), and
`.venv/bin/python tools/validate_contract.py` (110 passed, 1 skipped). These check
the current working tree; the requested hover behavior remains unimplemented.

## Cleanup

On implementation acceptance, resolve the filename, H1, and status; record final
validation. Distill reusable tooltip behavior and text-preservation checks into
`docs/validation/`, update `docs/validation/INDEX.md`, then delete the resolved
ticket and remove its queue row.

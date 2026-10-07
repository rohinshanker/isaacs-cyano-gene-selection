# A_instant-hover-hints__20261006 — Active

- **Scope:** Replace delayed native browser/platform hover hints that provide
  additional information across `site/` with instant hints that follow the mouse,
  including dataset light measurements and their exact values.
- **Status:** active
- **Opened:** 2026-10-06
- **Updated:** 2026-10-07

## Current State

Integrated on canonical main and independently confirmed in DEM-259. One delegated controller now converts every existing and
dynamically added HTML `title` or SVG `<title>` into a body-level instant hint.
The existing renderers remain the only text sources. The controller follows the
pointer, suppresses a clicked hint until exit and re-entry, clamps long text,
preserves accessible descriptions, and clears stale state on removal, hiding,
scrolling, popup closure, and navigation.

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

Implementation verification completed 2026-10-06:

- The pre-change inventory found two static HTML hint attributes, nineteen
  dynamic HTML hint-writer sites, and seven SVG title-writer sites across
  controls, gene identity, comparison, dataset conditions, length histograms,
  gene sequence, and gene/TSS views. None of those source strings was rewritten.
- Browser checks matched the exact before-source text to the rendered hint for
  dataset temperature, light and CO2 tracks, including `5–30 µmol. As reported:
  5–30 μmol photons m-2 s-1 (low light)` and the longer 0–600 µmol reported
  value, and for a length-histogram bin. Open states contained zero native HTML
  `title` attributes and zero SVG `<title>` nodes.
- `tests/js/instant-hints.test.mjs` covers immediate entry and movement,
  switching triggers, click dismissal and suppression, exit/re-entry, viewport
  clamping, exact Unicode/numeric text, dynamic updates and removal, popup
  cleanup, nested and page scrolling, keyboard focus, touch pointer entry, and
  preservation of underlying clicks and pre-existing accessible descriptions.
- Rendered the native map/data-selection route at 375×812, 768×1024, and
  1280×800, and the Lengths route at 1440×900. Checked default, open/closed
  popup, dataset condition tracks, long and viewport-edge text, source-details
  activation, mouse suppression/re-entry, keyboard focus, emulated touch
  pointer entry, nested scrolling, and SVG histogram states. There were no
  console errors, failed requests, new page-level horizontal overflow, or
  standalone accessibility-description nodes. Chromium's accessibility tree
  retained `Source details and citation` as the source button's description.
- Render evidence:
  `/Users/Rohin/multica_workspaces_desktop-api.multica.ai/demeter-5df2b7b4e167/dem-257-dbc0eff72afd/worktree/.playwright-cli/dem-257-hints/data-long-hint-mobile-375x812.png`,
  `.../data-hint-tablet-768x1024.png`,
  `.../data-light-hint-desktop-1280x800.png`, and
  `.../length-hint-wide-1440x900.png`. No visual baseline changed.
- `npm test`: 1,077 passed. `.venv/bin/python -m pytest -q`: 486 passed,
  1 skipped, 36 subtests passed, using the canonical checkout's pinned ignored
  raw inputs through temporary links removed after the run.
  `.venv/bin/python tools/validate_contract.py`: 110 passed, 1 expected spliced-
  CDS contiguity skip, using the same temporary raw-input linkage.
- Limitation: real iOS/touch hardware was unavailable; touch pointer behavior
  was exercised in the unit suite and Chromium. At 375 px the existing data-
  selection dialog still squeezes its long heading and uses its pre-existing
  horizontally scrolling table; this patch did not alter that unrelated layout.

Acceptance still requires owner/coordinator review of the delivered patch:

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

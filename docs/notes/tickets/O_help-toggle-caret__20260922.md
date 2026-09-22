# O_help-toggle-caret__20260922 — Open

- Scope: header "How to read this" toggle button; expand/collapse affordance.
- Status: open
- Opened: 2026-09-22
- Updated: 2026-09-22

## Current State

Implemented on `feat/help-toggle-caret` (commit `2740732`): an inline SVG
caret was added after the label in `site/index.html`, `aria-hidden` and
`focusable="false"`, sized with `width`/`height` in `em` and stroked with
`currentColor`. CSS in `site/css/app.css` rotates it 180deg when
`#help-toggle[aria-expanded="true"]`, transitioning under the repo's existing
global `prefers-reduced-motion: reduce { * { transition: none } }` rule — no
new rule was needed. The click handler in `site/js/app.js` (~line 1498) was
unchanged; it already drives `aria-expanded`, which the CSS reads.

The header button `#help-toggle` (`site/index.html`, `.chip-button`) toggles
the `#help` section and already flips `aria-expanded` in `site/js/app.js`
around line 1498. Nothing visual tells the reader that the button expands or
collapses a text region.

Add a caret to the button:

- Collapsed (`aria-expanded="false"`): a caret pointing down, after the label
  text, sized to the button's text and coloured with `currentColor`.
- Expanded (`aria-expanded="true"`): the same caret pointing up.
- Drive the direction from `aria-expanded` in CSS (a rotated inline SVG or a
  pseudo-element) so the existing click handler needs no new state; if a
  transition is used, respect `prefers-reduced-motion`.
- The caret is decorative: the accessible name stays exactly "How to read
  this", the caret is `aria-hidden`, and the button's focus ring, hover, and
  chip styling are unchanged.
- The header must not wrap or overflow at about 390 px because of the added
  width; check the header actions row at that width.

## Verification

Done: `npm test` (452/452 pass), pytest (301 passed, 22 subtests), and
`node tools/check_live_metrics.mjs` (failed=0) all pass; `git diff --check`
clean. Rendered inspection via `playwright-cli` at 1280x800 and 390x844
confirmed the down caret when collapsed, the up caret after both a mouse
click and a keyboard Enter activation, a visible focus ring throughout, an
unchanged accessible name ("How to read this"), no header-actions overflow
or wrap at 390 px, and zero console messages.

## Cleanup

No permanent validation guidance is expected; delete this ticket and its
queue row after validation.

# O_help-toggle-caret__20260922 — Open

- Scope: header "How to read this" toggle button; expand/collapse affordance.
- Status: open
- Opened: 2026-09-22
- Updated: 2026-09-22

## Current State

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

Pending: existing `tests/js` suites green, including `interface-copy` and
`layout` tests that inspect header markup; rendered inspection at desktop and
about 390 px showing the down caret when collapsed and the up caret when
expanded, via mouse and keyboard, with the focus ring visible and no header
overflow, per the `ui-render-inspect-repair` skill.

## Cleanup

No permanent validation guidance is expected; delete this ticket and its
queue row after validation.

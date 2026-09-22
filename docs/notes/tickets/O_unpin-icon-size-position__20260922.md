# O_unpin-icon-size-position__20260922 — Open

- Scope: detail panel pinned-status row; unpin control size and placement.
- Status: open
- Opened: 2026-09-22
- Updated: 2026-09-22

## Current State

When a gene is pinned, the detail panel's status row (`site/js/ui/side-panel.js`,
`.gene-status-row`) shows the text "Pinned" followed on its right by a 32 px
icon button with an 18 px SVG (`.unpin-button` in `site/css/app.css`). The icon
is visually larger than the 0.78 rem status text and sits after it.

Change the control so that:

- The unpin icon renders at the size of the adjacent status text (its glyph
  height matches the "Pinned" line height, roughly 1 em of `.gene-status`),
  so it reads as part of the line rather than a separate button block.
- The icon sits on the left of the "Pinned" text, before it in DOM order and
  visually, with the existing small gap.
- The button keeps an accessible hit area (at least 24 px, and the touch path
  remains usable) via padding or a pseudo-element without enlarging the visible
  glyph, keeps its `aria-label`, `title`, focus ring, and the `data-detail-action`
  hook that tests and the reversible-pinning contract rely on.
- The preview state (not pinned) is unchanged: no icon, same wording.
- No horizontal overflow of the status row at the 260 px side-panel minimum.

Read `docs/validation/viewer-interaction-state.md` for the unpin and focus
rules before changing markup order; focus after unpin must still move where
that contract says.

## Verification

Pending: existing `tests/js` suites green (interface-copy, layout, and any test
that queries `.unpin-button` or `data-detail-action="unpin"`); rendered
inspection at desktop and about 390 px of a pinned gene showing the icon left of
"Pinned" at text size, keyboard focus ring visible, click and Enter unpin, and
focus landing per contract, per the `ui-render-inspect-repair` skill.

## Cleanup

Record the control's placement in `docs/validation/viewer-interaction-state.md`
if it changes stated behaviour, then delete this ticket and its queue row.

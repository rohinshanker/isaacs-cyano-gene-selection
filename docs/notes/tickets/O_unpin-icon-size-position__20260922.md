# O_unpin-icon-size-position__20260922 — Open

- Scope: detail panel pinned-status row; unpin control size and placement.
- Status: open
- Opened: 2026-09-22
- Updated: 2026-09-22

## Current State

Implemented on branch `feat/unpin-icon`. `statusRow.prepend(unpinButton)` in
`site/js/ui/side-panel.js` now places the unpin button before the "Pinned"
text in DOM order. `.unpin-button` in `site/css/app.css` is sized `1em`/`1em`
with `font-size: 0.78rem` (matching `.gene-status`) so the glyph reads at text
size, with a `::before` pseudo-element providing a 24x24px hit area without
enlarging the visible glyph or the button's own box (`padding: 0`, `border:
none`, taken out of flow via `position: absolute`).

Previously: when a gene is pinned, the detail panel's status row
(`site/js/ui/side-panel.js`, `.gene-status-row`) showed the text "Pinned"
followed on its right by a 32 px icon button with an 18 px SVG
(`.unpin-button` in `site/css/app.css`). The icon was visually larger than the
0.78 rem status text and sat after it.

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

Done: `npm test` (447/447), `pytest -q` (301 passed, 22 subtests), `node
tools/check_live_metrics.mjs` (all PASS), `git diff --check` clean. Rendered
inspection via `playwright-cli` at 1280x800 and 390x844 confirmed the icon
left of "Pinned" at text size, a visible keyboard focus ring, both click and
Enter unpinning, and focus landing on the "Gene detail" complementary
landmark after unpin, matching `docs/validation/viewer-interaction-state.md`.
Confirmed no horizontal overflow with the detail panel forced to 260 px
width. Zero console errors throughout.

## Cleanup

Record the control's placement in `docs/validation/viewer-interaction-state.md`
if it changes stated behaviour, then delete this ticket and its queue row.

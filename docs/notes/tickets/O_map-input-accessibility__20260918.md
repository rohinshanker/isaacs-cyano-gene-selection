# O_map-input-accessibility__20260918 — Open

- **Scope**: Keyboard, touch, and state feedback for the canvas gene map.
- **Status**: open
- **Opened**: 2026-09-18
- **Updated**: 2026-09-18
- **Priority**: P1 — the documented controls do not match the implemented controls.

## Current State

Verified on viewer commit `fd0e42981ba4347189e27faf25e1e8f3aee42524`.

- The visible hint says arrow keys move between genes and Enter pins the current
  gene. `ScatterPlot.onKeyDown` has no Enter branch; pressing Enter from the
  initial state changes nothing. The first arrow press calls `onSelect`, writes a
  `g=` value into the URL, and labels the gene `Pinned`. There is no separate
  keyboard-active/preview state.
- The canvas uses `touch-action: none`, implements one-pointer panning and wheel
  zoom, but has neither pinch zoom nor visible zoom-in/zoom-out controls. A
  touch-only user cannot perform the documented “scroll to zoom” action.
- When filtered genes are hidden by clearing the grey-dot checkbox, the legend
  still says the hidden genes are represented by small grey dots.

The root cause is that pointer hover, keyboard navigation, pinned selection, and
viewport controls were compressed into one canvas state even though they have
different interaction and accessibility contracts.

## Proposed Resolution

- Add an explicit active-gene index distinct from the pinned index. Arrow keys
  move the active gene and preview/announce it; Enter pins it; `S` toggles the
  pinned or active gene using one documented rule.
- Add labelled zoom-in, zoom-out, and reset buttons next to the map. Pinch zoom
  may supplement them, but must not be the only mobile affordance.
- Link the full keyboard instructions with `aria-describedby`, keep focus visible,
  and announce the active gene and action without claiming it is pinned.
- Make the legend conditional on `showHidden`.
- Cover the state machine in unit tests and in browser tests driven by keyboard
  and touch/pointer input.

## Verification

- From no selection, Enter is a no-op with an accurate instruction, or pins the
  explicitly active gene; an arrow press never silently changes pinned state.
- Keyboard focus, active preview, pinning, shortlist toggle, pan, zoom, and reset
  work at 375×812 and 1440×900.
- A touch user can zoom without a wheel or hardware keyboard.
- The legend describes only marks that are actually rendered.
- No page-level overflow, console error, or focus loss is introduced.

## Cleanup

When resolved, add the durable keyboard/touch map contract to the viewer validation
runbook, update `docs/validation/INDEX.md`, and remove this ticket and its index row.

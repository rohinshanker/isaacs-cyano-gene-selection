# R_strain-navigation-format__20261009 — Resolved

- **Scope:** Group and order the organism selector; preserve collapsible, movable recoding panels.
- **Status:** resolved
- **Opened:** 2026-10-09
- **Updated:** 2026-10-10

## Outcome

Closed by `cyano-regulatory-sites` (session `e6e54b6e-1791581192`) on
2026-10-10. Three top-level controls now read Cyanobacteria, E. coli Syn61,
and E. coli. The conventional-strain menu contains MG1655 (default), MDS42
public reference, and DH10B public reference. Ordinary strain links retain
exact identities and remembered views. Recoding panels retain their existing
movement, collapse, and URL persistence. Implementation: `dac03b2`; repair:
`39066ef` (worker originals `89d199b` and `e4a5102`). No open findings remain.

| Finding | Resolution |
| --- | --- |
| NAV-R1: phone menu clipped left of viewport | `39066ef`: shared viewport placement, live resize/scroll/anchor tracking, both-edge checks |
| NAV-R2: separator had no rendered gap | `39066ef`: CSS flex gap and real-browser spacing assertion |
| NAV-R3: default MG1655 falsely announced as selected; label mismatch | `39066ef`: truthful default/selected accessible names including visible label; non-link trigger no longer claims a strain-link id |
| NAV-R4: new registry records could silently disappear from navigation | `39066ef`: registry-to-navigation set-equality test |
| NAV-R5: unused close API and implicit listener lifetime | `39066ef`: unused API removed; once-per-document listener lifetime documented and independently accepted |

## Verification

- Independent Claude review DEM-347 accepted all NAV-R1 through NAV-R5 on
  `56a1b3d..40a69ab`, the exact worker repair integrated as `39066ef` and
  `ed03f05`. It found no residual defect and verified existing popover geometry
  and scroll dismissal in the browser.
- Coordinator `npm test`: 1,476 passed on the combined code/docs integration.
  Python gate: 958 passed, 46 subtests passed, one skip. Contract gate:
  126 passed, zero failed, one declared spliced-CDS skip. Python and contract
  ran before the UI-only repair; no Python or data changed afterward.
- Rendered all five direct organism addresses; pointer/keyboard navigation,
  focus return, copied links and recoding-panel persistence passed. Geometry
  matrix: 32 states across default/MG1655/MDS42/DH10B and widths
  320, 375, 420, 439, 440, 768, 1280, and 1440 passed. Console/network checks
  were clean. Independent review also checked scrolling and 812x375 landscape.
- `node tools/build_module_preloads.mjs --check`, scoped documentation links,
  ticket metadata and `git diff --check` passed.

## Cleanup

Reusable grouping, geometry, accessibility, registry and browser-check guidance
is in [organism-selector.md](../../validation/organism-selector.md); panel
persistence is in [controls-column-and-resets.md](../../validation/controls-column-and-resets.md).
[Documentation-link guidance](../../validation/documentation-links.md) covers
retirement checks. The validation index is updated and the Syn57 ticket now
links to the durable panel contract. Remove this resolved file only after this
closure is recorded; the queue row is removed with closure. No remaining finding
or unique reusable guidance is held only in this ticket.

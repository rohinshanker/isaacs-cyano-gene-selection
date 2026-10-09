# R_regulatory-feature-hit-targets__20261009 — Resolved

- **Scope:** Enlarge hover/click targets for regulatory and start/stop annotations in both gene viewers.
- **Status:** resolved
- **Opened:** 2026-10-09
- **Updated:** 2026-10-09

## Outcome

Closed by **cyano-ui-fixes**, 2026-10-09.

The visible genomic geometry is unchanged. Invisible padding makes regulatory
markers and gene start/stop annotations easier to hover and activate in both
viewers, retaining evidence precedence, full inspection lists and neighboring
codon identity. Padding-only hover shows the same outline/details as the mark,
and click/touch focuses the same annotation. No predictor output was added.

### Implementation findings

- **HIT-1:** missing enlarged marker targets — `cd7e8ef`.
- **HIT-2:** start/stop padding and padding-only outlines — `cd7e8ef`.
- **HIT-3:** standalone codon padding lacked hover details — `ca1dc16`;
  independently confirmed by DEM-336.

## Verification

Final application code `88ffb1e` passed 1,415 JavaScript tests, 938 Python tests
and 36 subtests (one skip), and 119 contract checks (one declared skip). Later
`ecd2a12` only corrects a browser-fixture text reader and its documentation.
The final browser contract passed 31 states: six main viewports from 375 to
1440 px; long-status and two full camera-navigation cycles at 375, 768 and
1440 px; all five reported crowded loci at fitted zoom; exact hover details,
outline/dismissal, marker click focus and preserved codon selection in both
viewers; native-only and origin-wrapping synthetic rows with the five uncovered
bases still visible. Screenshots were directly inspected; no captured browser
errors or horizontal overflow occurred. Emulated-touch checks on the final
accessible labels passed Tan reveal, padded marker/codon focus, compact-view
focus and chromosome pan, with zero diagnostics. No physical-device,
screen-reader or automated axe certification is claimed.

Independent Claude review DEM-336 approved implementation `866f2cd` and confirmed
F1–F6 resolved. Its two low test findings and accessible-name observation are
resolved by `88ffb1e`; the interval-render observation is covered by the final
fixture run. These final small changes were checked by the owning coordinator;
no additional independent approval is claimed for them.

## Review findings at closure

- **DEM-336-F1:** camera-only completion lost focus — `f531145`, independently
  confirmed; completion returns to the working visibility checkbox.
- **DEM-336-F2:** camera navigation oscillated — `866f2cd`, independently confirmed;
  **Go to next site** traverses in transcription order and wraps.
- **DEM-336-F3:** wide intervals lost padding to distant neighbours — `866f2cd`,
  independently confirmed; padding partitions the gap between adjacent edges.
- **DEM-336-F4:** dense-marker assertions promised impossible padding — `866f2cd`,
  independently confirmed; visible heads remain contained and crowding is explicit.
- **DEM-336-F5:** padding-only marker interaction lacked regression checks —
  `866f2cd`, independently confirmed in both viewers.
- **DEM-336-F6:** long-status responsive evidence was missing — `866f2cd`,
  independently confirmed, with separate emulated-touch evidence.
- **DEM-336-G1:** isolated target size was not independently pinned — `88ffb1e`;
  isolated opening-view markers require at least 19 px, while dense cases use
  containment checks.
- **DEM-336-G2:** a hidden action could pass the cycle check — `88ffb1e`; each
  activation now requires a visible button holding focus.
- **Accessible-name observation:** `88ffb1e` uses the visible changing action as
  the accessible name; real keyboard and touch paths pass.
- **Interval-render observation / UI-CHECK-1:** `ecd2a12` fixes the optional
  fixture's consumed-title reader; its native-only and wrapping cases now pass.
- No open finding remains against this work.

## Cleanup

Reusable interaction, focus, crowding, reachability, cyclic-navigation and
fixture-reading rules are in [gene-sequence-closeup.md](../../validation/gene-sequence-closeup.md)
and the validation index. Related overlap guidance links to that durable guide.
The live queue row is removed. Deleting this resolved ticket is the last cleanup
step; no ticket-only contract or unresolved finding is discarded.

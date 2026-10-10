# R_overlap-visibility-and-base-pairs__20261009 — Resolved

- **Scope:** Readable small overlaps, stable chromosome hints and strand-aware shared base letters in both gene viewers.
- **Status:** resolved
- **Opened:** 2026-10-09
- **Updated:** 2026-10-10

## Outcome

Closed by `cyano-ui-fixes` (`80c81443-1791314087`) on 2026-10-10. Small overlaps have fixed directional heads and exact proportional tails; compact disclosures and expanded tracks expose aligned native DNA with strand orientation. Chromosome hints preserve layout and dismiss on viewport, scroll or panel movement. No findings remain open.

| ID | State | Requirement |
| --- | --- | --- |
| OG-V1 | `b09f0c7` | Small overlaps must remain clearly visible and easy to inspect in the gene visualizers. The owner suggests a fixed-size directional arrowhead with a tail representing the actual overlapping sequence. |
| OG-V2 | `b09f0c7` | Chromosome overlap hover should show a hover hint without expanding in-flow text above the chromosome or moving the hovered mark away from the pointer. |
| OG-C1 | `b09f0c7` | Coordinator render inspection: compact exact-base rows must align letters despite unequal selected/partner label widths. |
| OG-C2 | `b09f0c7` | Coordinator render inspection: shared-span line must not strike through the expanded partner nucleotide letters. |
| OG-R1 | `ccf3f9d` | Independent review confirmed the viewport-movement defect recorded as OG-C5; fixed with listener cleanup and rendered regression. |
| OG-R2 | `c00e104` | Keep continuation chevrons below the partner base letters at clipped edges. |
| OG-R3 | `c00e104` | Describe letters conditionally on readable zoom and the visible shared interval. |
| OG-R4 | `c00e104` | Give long exact-base scrollers a named keyboard-focusable group. |
| OG-R5 | `c00e104` | Apply overlap hover feedback to the padded hit target state. |
| OG-R6 | `c00e104` | Hide the duplicate visual hint from assistive readers; preserve the live announcement. |
| OG-R7 | `9471b05` | Dismiss an overlap hint when a panel splitter resizes its canvas host without a viewport resize or scroll. |
| OG-C5 | `ccf3f9d` | Combined browser render: dismiss fixed hints on viewport or nested scrolling/resizing so they cannot float over unrelated sequence content. |
| OG-C4 | `b09f0c7` | Real emulated touch ends with pointerleave: the first-tap hint must persist and a subsequent tap remain usable; Escape must also dismiss from overlap controls. |
| OG-C3 | `b09f0c7` | Verify tooltip bounds against the visible viewport when the canvas is partially scrolled; host-only clamping is insufficient. |
| OG-V3 | `b09f0c7` | Show the overlapping partner's actual base letters, aligned with the selected gene, rather than conveying the overlap only through a coloured block. Make same-strand versus opposite-strand relationships clear. |

## Verification

Independent read-only review DEM-348 approved runtime commit `9471b05890f791851a1cc1f1ca34f5fdf63d7f07`, resolving OG-R1–R7. Final JavaScript suite: 1,482 passed. Python suite: 958 passed, 46 subtests passed, one declared skip. All five organism contracts and live metrics, annotation verification/reproduction, and readiness checks passed. Native FASTA comparison verified 1,980 bases across 18 pairs in all five organisms. RNA browser check passed 32 parity cases with zero numerical error and no unexpected diagnostics.

Rendered Chromium checks cover 375, 768, 959, 960, 1239, 1240, 1280 and 1440 px widths; hover has zero canvas shift and no page overflow. Actual touch, keyboard sequence scrolling, padded hover targets, readable clipped-edge letters, viewport/scroll dismissal and splitter dismissal/reopen passed. Semantic and keyboard checks passed; no formal screen-reader or axe audit was run. Changes preserve the native overlap relation and OG filters/colouring.

## Cleanup

Reusable contracts and checks are retained in [gene-overlaps.md](../../validation/gene-overlaps.md), [gene-sequence-closeup.md](../../validation/gene-sequence-closeup.md) and the validation index. The queue row is removed; the resolved ticket is deleted last, after this resolution record is committed. No unique follow-up information remains only here.

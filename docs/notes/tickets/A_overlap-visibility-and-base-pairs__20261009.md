# A_overlap-visibility-and-base-pairs__20261009 — Active

- **Scope:** Improve small overlapping-gene marks, prevent chromosome overlap hover from moving the canvas, and display strand-aware nucleotide sequences for overlapping partners.
- **Status:** active
- **Opened:** 2026-10-09
- **Updated:** 2026-10-10

## Current State

Opened by `cyano-ui-fixes` at the owner's request, following the initial OG
release on main `74c79db`. Claimed 2026-10-10 by `cyano-ui-fixes` (session `80c81443-1791314087`), which owns integration and closure. Implementation uses an isolated worker worktree based on `5431386`; no other active session owns these overlap changes.
The owner reports that small overlaps are hard to see, and that chromosome
hover text increases the space above the canvas, moving the overlap away from
the pointer. These are owner-reported findings; this intake does not claim a
fresh rendered reproduction or a fix.

The existing relation, native-coordinate coverage and viewer contract are in
[gene-overlaps.md](../../validation/gene-overlaps.md). Preserve that relation,
the OG tag/filter/colour semantics, partner navigation and all native organisms.
This ticket changes presentation and interaction, not which genes overlap.

## Requested changes and open findings

| ID | State | Requirement |
| --- | --- | --- |
| OG-V1 | `b09f0c7` | Small overlaps must remain clearly visible and easy to inspect in the gene visualizers. The owner suggests a fixed-size directional arrowhead with a tail representing the actual overlapping sequence. |
| OG-V2 | `b09f0c7` | Chromosome overlap hover should show a hover hint without expanding in-flow text above the chromosome or moving the hovered mark away from the pointer. |
| OG-C1 | `b09f0c7` | Coordinator render inspection: compact exact-base rows must align letters despite unequal selected/partner label widths. |
| OG-C2 | `b09f0c7` | Coordinator render inspection: shared-span line must not strike through the expanded partner nucleotide letters. |
| OG-R1 | `ccf3f9d` | Independent review confirmed the viewport-movement defect recorded as OG-C5; fixed with listener cleanup and rendered regression. |
| OG-R2 | open | Keep continuation chevrons below the partner base letters at clipped edges. |
| OG-R3 | open | Describe letters conditionally on readable zoom and the visible shared interval. |
| OG-R4 | open | Give long exact-base scrollers a named keyboard-focusable group. |
| OG-R5 | open | Apply overlap hover feedback to the padded hit target state. |
| OG-R6 | open | Hide the duplicate visual hint from assistive readers; preserve the live announcement. |
| OG-C5 | `ccf3f9d` | Combined browser render: dismiss fixed hints on viewport or nested scrolling/resizing so they cannot float over unrelated sequence content. |
| OG-C4 | `b09f0c7` | Real emulated touch ends with pointerleave: the first-tap hint must persist and a subsequent tap remain usable; Escape must also dismiss from overlap controls. |
| OG-C3 | `b09f0c7` | Verify tooltip bounds against the visible viewport when the canvas is partially scrolled; host-only clamping is insufficient. |
| OG-V3 | `b09f0c7` | Show the overlapping partner's actual base letters, aligned with the selected gene, rather than conveying the overlap only through a coloured block. Make same-strand versus opposite-strand relationships clear. |

### Small marks and direction

Apply readable overlap marks to both the compact gene visualizer and expanded
sequence close-up. Evaluate the owner's fixed-size arrowhead proposal; it is a
preferred design direction, not a specified pixel size. Keep the arrowhead
legible when the shared interval is one or a few bases, while the tail remains
anchored to the exact shared coordinates and scales with the sequence. Make
the distinction between a visibility aid and genomic extent clear. Keep exact
base counts/coordinates inspectable and do not inflate the reported overlap.

Retain distinct partner identities and direction indicators when several marks
coincide. Increase usable hit targets without making adjacent partners or
initiation/termination/regulatory features unreachable.

### Stable chromosome hover hints

Present partner identities, strand relationship, shared coordinates and base
count in an overlay hint attached to the mark or pointer. Entering, changing or
leaving a hovered overlap must not change the canvas position or panel height.
Avoid hover flicker or loss caused by the hint itself intercepting the pointer.
Keep the hint within the visible viewport without clipping its contents.

Provide equivalent keyboard/focus and touch access, retain the Previous/Next
overlap controls for coincident pairs, and preserve accessible announcements
without an expanding visible status block. Keep pinning, pan/zoom, filters and
the corrected O → arrow → Enter targeting behaviour intact.

### Base-pair display and strand relationship

Display actual A/C/G/T letters for the shared sequence, with the partner's
identity and strand/direction. Coordinates alone do not satisfy this request.
Align bases by shared genomic position, show the appropriate complement for
opposite-strand partners, and label 5′/3′ orientation so the rows do not imply
that both genes are read in the same direction. Preserve the selected gene's
existing transcription-oriented coordinate convention.

The expanded viewer should expose aligned per-partner base rows at readable
sequence zoom. In the compact viewer, retain a legible mark and provide an
accessible way to inspect the exact bases when letters cannot fit. Keep long
sequences readable without overlapping labels or page-level overflow. A
missing native sequence or unrecorded strand must remain explicitly unknown;
do not infer it from a colour or fabricate bases. Use admitted native sequence
and actual annotated segments, including split and origin-crossing features.

## Verification

Implementation `b09f0c7` (worker `7acc3a7`, DEM-345) resolves OG-V1/V2/V3 and OG-C1/C2/C3/C4. Integrated with concurrent navigation/documentation work at `74615a8`. Final combined gates: `npm test` 1,481 pass; pytest 958 pass, 46 subtests pass, one declared skip; all five organism contracts and live-metric checks, annotation verification/reproduction, and readiness pass. Native FASTA oracle confirms 1,980 shared bases across 18 pairs and all five organisms. RNA browser regression passes 32 parity cases with zero error, lifecycle states and diagnostics. Mobile/tablet/desktop viewport-edge, actual touch, compact-column alignment and expanded-base readability checks pass; eight-width geometry matrix is being rechecked on the combined tree. Independent read-only review DEM-348 is pending; do not close until its findings are resolved.


Intake: checked the live ticket index and existing OG contract; this is the
only open ticket for these three requested improvements. Check the ticket
identifier, metadata, local links and index entry before committing.

At implementation, use the `ui-render-inspect-repair` skill and render the real
chromosome, compact and expanded gene views at 375×812, 768×1024, 1280×800 and
1440×900, plus the 960/1240 px breakpoints. Cover one-base and short overlaps,
long intervals, same/opposite strands, several coincident partners, clipped
windows, split/origin-crossing features and noncoding partners. Useful native
fixtures are UTEX `M744_RS00425` (one-base overlaps), MG1655 `b0018` (an RNA
partner), and `b4793`/`b4455`/`b4647` (coincident intervals).

Assert unchanged canvas bounding coordinates during hover entry, movement,
hint-content changes and dismissal. Verify pointer stability, keyboard/focus,
touch, tooltip accessibility and continued access to neighbouring features.
Compare displayed letters/orientation with pinned native sequence on both
strands; test exact endpoints and unavailable-sequence behaviour. Inspect
screenshots, overflow and console/page/request diagnostics, then run the
repository gates in [AGENTS.md](../../../AGENTS.md).

## Cleanup

The implementing owner must name the closer/date and record a resolving commit
for OG-V1, OG-V2 and OG-V3, plus any later findings, before closure. Update the
reusable OG and gene-viewer validation contracts to describe the final marker,
hint and sequence behaviour. Follow the resolved-ticket lifecycle and delete
the resolved ticket only after distillation and final validation.

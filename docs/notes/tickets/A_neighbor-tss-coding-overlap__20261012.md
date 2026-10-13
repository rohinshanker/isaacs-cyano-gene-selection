# A_neighbor-tss-coding-overlap__20261012 — Active

Scope: Finish neighboring TSS/RBS coding-overlap implementation and production navigation verification.
Status: active
Opened: 2026-10-12
Updated: 2026-10-12

## Current State

Reopened by owning session `cyano-regulatory-sites` after the final production
navigation check on deployed `47bbb88`. The gene-detail viewer selects the new
gene but throws while restoring focus to a neighboring-site action whose key
contains JSON quotes. The exception prevents URL persistence. Other sessions
remain untouched; coordinator continues in `work/neighbor-sites-20261012`.

Admitted evidence remains UTEX Tan 2018 TSSs only; RBS and other-organism TSS
layers remain unavailable. Data payloads and RBS Calculator hold are unchanged.

## Findings

- **NS-P3 — resolved by `90d81b9`:** Shared categorical draw-direction help labels the new TSS
  category as Function category. Use an accurate shared reason; preserve the
  existing view-specific paint-order explanation.

- **NS-P2 — resolved by `b553487`:** Switching from the neighboring-site colour to a normal
  colour throws in the shared metric-help renderer because the new colour
  branch deleted its summary/content structure. Preserve the common disclosure
  and test colour round trips in chromosome and scatter views.
- **NS-P1 — resolved by `ab15d6e` and test fixture `f688c7b`:** Gene-detail focus restoration interpolates a structured site
  key into a CSS selector. Reproduce with M744_RS00665 -> Open M744_RS00660 in
  the detail viewer; `querySelector` throws and URL still pins M744_RS00665.
  Compare opaque action values directly, preserve focus on unrelated updates,
  and verify navigation from both compact mounts and expanded sequence.
- NS-1, NS-2, NS-3, NS-4, NS-5: resolved by `0205070`, confirmed in DEM-389.
- NS-6: resolved by `8afee71`, confirmed by independent repair review.
- NS-R1, NS-R2, NS-R3, NS-R4, NS-R5, NS-R6, NS-R7, NS-R8, NS-R9:
  resolved by `7c7cbbf`, accepted by DEM-389 at that exact commit.

## Verification

`47bbb88` passed 1,581 JS tests; 1,751 Python tests plus 51 subtests (16 skips);
UTEX contract 130 passed/zero failed/one declared skip; all six organism release
data gates; RNA browser regression; eight-width UI checks. Actions validate and
deploy succeeded, and 13 live site files matched the intended SHA. Production
filters, all organism counts, exports, RNA and shared-link reload passed.
DEM-390 independently accepted NS-P1 at `f688c7b` and NS-P2 at `b553487`.
The repaired UI passed 1,582 JS tests, 1,751 Python tests plus 51 subtests
(16 skips), and contract 130/0/1. Eight-width browser checks passed.
NS-P3 was corrected locally and rendered in both colour disclosures at
375, 768 and 1280 px with no diagnostics or overflow. Final repaired production
verification remains; the ticket stays active until that succeeds.

## Cleanup

Preserve the focus-restoration contract in
[neighbor-regulatory-sites.md](../../validation/neighbor-regulatory-sites.md).
Owning session must account for NS-P1 and all prior findings, then resolve and
delete this ticket last after the repair and production verification pass.

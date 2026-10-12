# A_pcc7942-essentiality-color-filter__20261012 — Active

Scope: PCC 7942 essentiality coloring and filtering below functional annotation in Reviewed function.
Status: active
Opened: 2026-10-12
Updated: 2026-10-12

## Current State

Owner: cyano-ui-fixes. The owner requests a new “PCC 7942 essentiality” option
using Rubin et al. 2015, DOI 10.1073/pnas.1519220112. Work is isolated from
main at 425a753; the earlier Tan condition split remains separately pending its
count-source decision on work/tan-condition-selection-20261012.

Reuse the admitted exact PCC-to-UTEX join and keep strain, assay conditions,
source attribution and uncertain/unmapped states explicit. Confirm the existing
Adomako-redistributed calls against the original Rubin supplement before claiming
original-supplement parity. Do not replace calls, broaden joins or mix GO/UTEX
allele evidence into this category without verified source support.

Owner confirmed on 2026-10-12: show separate Essential, Beneficial, Non-essential
and Unresolved display classes. Preserve detailed source statuses in gene details
and exports. UI implementation is assigned to isolated Multica DEM-382.
Keep the existing initial color and filter defaults. Add the option in the map
and chromosome color menus, an independent categorical filter, meaningful legend,
shared-link and export support, and correct staged-loading/error behavior.

## Source finding

**PCC-COLOR-1 — source access limitation:** on 2026-10-12 the direct PNAS S3 URL
returned HTTP 403. Europe PMC's supplementary endpoint returned an XML error
stating that PMC4672817 is not open access; fullTextXML returned HTTP 500.
The ordinary browser route did not expose the supplement. No challenge was
solved. Therefore original-S3 parity is unverified; use the admitted Adomako
republication with both citations, never present it as newly extracted S3.
This does not block showing the already admitted calls. Their source chain,
exact joins and interpretation are governed by `docs/validation/pcc-essentiality.md`.

## Verification

Both deterministic essentiality/candidate-evidence build checks pass, as do
24 relevant Python tests. Current visible buckets total 2,715: 660 essential,
154 beneficial, 1,617 non-essential and 284 unresolved. The final bucket retains
71 ambiguous, 1 not_analyzed, 39 missing and 173 unknown raw states.

Pending: focused and full tests; rendered mobile,
tablet and desktop selection/filter/legend states; organism isolation; independent
patch review; release gates and Pages verification. No published change yet.

## Cleanup

Close only this owned ticket after naming the closer and every finding, distill
reusable guidance, and delete the resolved ticket last. Preserve all other active
work, the pending Tan branch, and the owner's localhost preview on port 8871.

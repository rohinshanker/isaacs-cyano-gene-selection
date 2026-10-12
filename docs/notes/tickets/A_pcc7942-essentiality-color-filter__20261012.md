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

One optional display preference is pending: separate Essential, Beneficial,
Non-essential and Unresolved classes (recommended), or essential highlighting
with all other classes neutral. Default to the separate classes after a reasonable
response window; preserve detailed source statuses in gene details and exports.
Keep the existing initial color and filter defaults. Add the option in the map
and chromosome color menus, an independent categorical filter, meaningful legend,
shared-link and export support, and correct staged-loading/error behavior.

## Verification

Pending: original supplement comparison; focused and full tests; rendered mobile,
tablet and desktop selection/filter/legend states; organism isolation; independent
patch review; release gates and Pages verification. No published change yet.

## Cleanup

Close only this owned ticket after naming the closer and every finding, distill
reusable guidance, and delete the resolved ticket last. Preserve all other active
work, the pending Tan branch, and the owner's localhost preview on port 8871.

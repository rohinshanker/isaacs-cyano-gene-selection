# R_pcc7942-essentiality-color-filter__20261012 — Resolved

Scope: PCC 7942 essentiality coloring and filtering below functional annotation in Reviewed function.
Status: resolved
Opened: 2026-10-12
Updated: 2026-10-12

## Outcome

Closing session: cyano-ui-fixes, 2026-10-12. Implemented in 718c8f0 (worker
DEM-382 a75d1a8). Owner confirmed four separate classes: Essential 660,
Beneficial 154, Non-essential 1,617, Unresolved 284. The exact source states
and mapping reasons remain in details and exports. Map/chromosome menus,
independent filters, keyboard/hover previews, shared links and exports use the
same grouping; all five E. coli views omit this UTEX-specific evidence channel.

## Findings

- PCC-COLOR-1: resolved by the evidence boundary in 7a48b50 and the explicit
  Rubin/Adomako source labels in 718c8f0. The category uses the already admitted
  Adomako republication, with no new data or join. Original Rubin S3 access and
  parity remain unverified, a documented limitation, not a claim of this feature.
- PCC-COLOR-2: resolved in 718c8f0. All legend previews preserve other filters;
  direct browser observation confirms identical mouse/focus masks of 510 essential
  genes for the tested OG class, with no other PCC calls. Clearing essentiality
  no longer claims that every other filter was cleared.
- No open findings against this UI. DEM-383 independently approved immutable
  718c8f049427f494fc8fa19342ec4a923e569fc4 with no actionable findings.
- The Tan condition split remains open in its own ticket and branch; no Tan
  runtime/data changes are included here.

## Verification

Integrated npm: 1,539 passed. Integrated Python: 1,682 passed, 10 optional
source/runtime skips, 51 subtests passed. Initial isolated-checkout failures
were missing pinned Syn61 inputs; the full rerun with individual local input
links passed. All six organisms pass contract, manifest and live-metric checks.
Annotation inputs/artifact checks, readiness, module preloads and diff checks pass.

Rendered 375/768/1280/1440 px and breakpoint boundaries: counts, all classes,
combined/empty filters, legend hover/focus, keyboard retention, map/chromosome,
loading/failure/absent/retry, late data, shared links, CSV/manifest downloads and
organism isolation. Independent reviewer repeated 103 focused tests and browser
edge states. RNA browser: 32 parity cases, worst discrepancy 0, 11 lifecycle/UI
states and no diagnostics. No automated axe package is installed; keyboard and
semantic checks were performed. No visual baseline was changed.

## Cleanup

Reusable source, class, missingness, URL/export and verification contracts are
in docs/validation/pcc-essentiality.md and its INDEX row. Close by renaming this
file/H1 to R_, removing its queue row, then delete the resolved ticket in a separate
cleanup commit. The closing session owns the authorized main push and will verify
Pages validate/deploy plus live content before reporting publication complete.
Preserve the pending Tan branch, other sessions and owner preview port 8871.

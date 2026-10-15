# R_array-expression-reader__20261007 — Resolved

- **Scope:** Lossless GEO SOFT reader and admission of seven processed PCC 7942 array series.
- **Status:** resolved
- **Opened:** 2026-10-07
- **Updated:** 2026-10-14

## Outcome

Closed by **cyano-lit-unreach**, 2026-10-14. There are no remaining findings
against this ticket. The owner authorized separate deposited samples with author
probe averaging disclosed, plus validated source-specific optional summaries.
The release contains 122 individual samples and five explicit summaries, with
separate log-ratio, normalized-signal and temporal-profile types. Scientific
source discrepancies, exact channels, transferred-strain evidence and unknown
measurements remain explicit. No raw-probe reprocessing or automatic array
pooling is performed.

Claude reviewer DEM-415 independently verified all sample values, summaries and
source pins, then approved `86d8512..078810e`. Integration `dc0c441` preserves
main's comparability judgements and filter work. `a33cc1d` scopes the browser
check to map provenance after the filter disclosure was integrated.

| Finding | Resolving commit | Disposition |
| --- | --- | --- |
| AR-01 | `31b9f4f` | Release counts corrected; validation tolerance/error retain exact precision. |
| AR-02 | `5dd405d` | GSM1267085 numerator, denominator, Loess-only exception and conflicting VALUE header disclosed. |
| AR-03 | `5dd405d` | Depositor amplitude-2 description distinguished from observed WT mean ≈0 and peak-to-trough 1; every source ORF checked. |
| AR-04 | `5dd405d` | Individual/summary wording and orientation corrected; computed summaries labelled; punctuation fixed. |
| AR-05 | `5dd405d` | GPL9534 and independent dye-swap summary added to dated upstream artifacts; all 16 pins tested. |
| AR-06 | `5dd405d`, `078810e` | Isolated rebuild cache, CLI preservation/creation tests, actual checked-default assertions and accessible close control. |
| AR-07 | `5dd405d`, `078810e`, `a33cc1d` | Long medium chip wraps inside its table cell; rendered geometry checked at four widths, including merged filter UI. |

## Verification

On the integrated code: npm **1,625 passed**; pytest **2,181 passed, 20 skipped,
51 subtests passed**. All 21 release commands passed (annotation verify/check,
readiness, and each organism's contract, manifest and live metrics). UTEX
contract: 130 passed, 0 failed, 1 declared discontinuous-CDS skip.

Real browser array checks passed at 375, 768, 959, 961, 1239, 1241, 1280 and
1440 px: individual defaults, mouse/keyboard switching, explicit summaries,
method/provenance, missingness, abundance exclusion, array filtering and medium
cell geometry. Screenshots inspected; no unexpected page, console or request
errors. CSV/manifest export included all 127 array columns and their provenance.
RNA folding passed all 32 real-worker parity cases (worst error 0), lifecycle,
responsiveness, breakpoints and diagnostics. Existing measured values and gene
payloads are unchanged. No unresolved merge conflicts; diff whitespace checks pass.

## Cleanup

Reusable source pins, mapping and quantity contracts, source-specific summary
rules, discrepancies and repeatable browser checks are in
[geo-array-reader.md](../../validation/geo-array-reader.md), indexed under
validation. Inbound links now point there. Remove this resolved ticket last;
keep transient inputs, browser artifacts and test logs outside the release.

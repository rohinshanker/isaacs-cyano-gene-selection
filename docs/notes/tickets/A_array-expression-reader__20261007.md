# A_array-expression-reader__20261007 — Active (reviewed by rohin)

- **Scope:** An array reader for `tools/ingest_expression.py` and the separate
  "array" platform listing in Data Sources, for the seven PCC 7942 microarray
  series with processed GEO sample tables. Covers `tools/ingest_expression.py`,
  `data/expression/ingest/`, `docs/validation/data-contract.md` and the Data
  Sources platform grouping.
- **Status:** active
- **Opened:** 2026-10-07
- **Updated:** 2026-10-14

## Current state

Owner clarification, 2026-10-14: **show separate deposited samples; disclose
author averaging**. Initial browser admission does not require selectable raw
physical probes. Preserve each GSM and its source metadata, explain the
depositor's probe reduction, and keep new pooling optional and explicit.

Owned by **cyano-lit-unreach** as of 2026-10-14, isolated on
`work/array-expression-reader-20261014`. Scope is the deposited microarray
reader, source-specific measurement/pooling contracts and admission. The
filter/TSS UI work owned by cyano-unblocked-tix and comparability work owned
by cyano-regulatory-sites remain separate.

Owner decision, 2026-10-14: keep microarray measurements separate by default,
but allow optional pooling. The owner explicitly clarified that the answer
labelled D6 referred to this ticket's dye-swap/probe measurements, not E. coli
datasets. Preserve the individual measurements and their provenance; do not
silently collapse them into one per-gene value. In the follow-up the owner chose
**develop and validate source-specific pooling rules**. A universal mean/median
is not selected; define each rule from the deposit's assay, channel orientation,
normalisation and probe mapping, and validate it before a pooled layer ships.
J5's separate array platform remains. No further owner choice of a universal
pooling method is required to begin that work.

The seven deposits provide processed SOFT and series matrices, correcting the
original raw-only assumption. GSE59112 is Pattanayak 2014, not Markson 2013.
The source catalogue pins both representations, GPL9534 and the published
GSE50919 dye-swap summary. Admission comprises 122 individual GSM samples and
five explicit optional summaries (one dye swap and four within-treatment means).
No new physical-probe processing occurs. Three declared quantities distinguish
log-ratios, positive normalized signals and within-gene temporal profiles.

Reusable source counts, mapping, orientation, processing and pooling rules are
in [the array contract](../../validation/geo-array-reader.md). All seven retain
the source-ledger citation permission dated 2026-10-06.

## Work

1. Preserve individual probes and dye-swap measurements by default, with optional
   pooling as requested. Record channel orientation and normalisation from the
   deposits, and develop/validate each source's pooling method before computing
   a combined value.
2. Implement the reader behind a `reader.format` of its own, with tests, in the
   shape the existing readers take.
3. Ingest the series whose condition records are already settled, each under the
   admission contract.
4. Distil the rules into `docs/validation/data-contract.md` and list the array
   platform apart in Data Sources.

## Verification

Implementation is under validation and independent review. Initial full gates
found expected release-count changes, one stale generated meta hash, and a
missing Temporal profile exclusion in the browser abundance classifier. These
are being corrected before closure. Per series: the gates (`npm test`, pytest,
`tools/validate_contract.py`), the join audit counts in its `ingest` block, a
rendered check of its Data Sources entry under the array platform, and its
citation row with downloads that resolve.

## Cleanup

On resolution, distil the array rules into `docs/validation/data-contract.md`,
update `validation/INDEX.md`, then delete this ticket and its index row.

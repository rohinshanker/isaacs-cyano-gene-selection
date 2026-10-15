# A_array-expression-reader__20261007 — Active (reviewed by rohin)

- **Scope:** An array reader for `tools/ingest_expression.py` and the separate
  "array" platform listing in Data Sources, for the seven PCC 7942 microarray
  series that deposit raw files only. Covers `tools/ingest_expression.py`,
  `data/expression/ingest/`, `docs/validation/data-contract.md` and the Data
  Sources platform grouping.
- **Status:** active
- **Opened:** 2026-10-07
- **Updated:** 2026-10-14

## Current state

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

Split out of
the resolved licence-unblocked-sources ticket (row 6 was split out of it)
row 6 by the owner's decision of 2026-10-07, so that ticket can close on the
rows whose deposits already carry a per-gene table. Nothing is built yet.

The seven series, all permitted with citation since 2026-10-06 and all raw-only:

| Series | Study | Deposited |
| --- | --- | --- |
| GSE50908 | Markson 2013 | `GSE50908_RAW.tar` |
| GSE50919 | Markson 2013 | `GSE50919_RAW.tar`, plus a log2 ratio table that is not an abundance |
| GSE50920 | Markson 2013 | `GSE50920_RAW.tar` |
| GSE52486 | Markson 2013 | `GSE52486_RAW.tar` |
| GSE59112 | Markson 2013 | `GSE59112_RAW.tar` |
| GSE18902 | Vijayan 2009 | `GSE18902_RAW.tar` |
| GSE102914 | Vicente 2019 | `GSE102914_RAW.tar` |

Why this is not the RNA-seq route: these are two-colour arrays, so a value is a
channel intensity against a co-hybridised reference, not an abundance on its own
scale. Reading them means deciding, and recording, four things the RNA-seq specs
never had to: which channel or ratio is the value, whether the deposited
normalisation is kept or recomputed, how dye-swap pairs combine, and how several
probes per gene reduce to one per-gene number. Each is a scientific choice, not a
parsing detail, and each belongs in the data contract before any layer ships.

Owner decision J5 already stands: arrays are listed apart from sequencing in the
Data Sources platform grouping, so an array layer is never silently pooled with
an RNA-seq one.

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

Not started. Per series: the gates (`npm test`, pytest,
`tools/validate_contract.py`), the join audit counts in its `ingest` block, a
rendered check of its Data Sources entry under the array platform, and its
citation row with downloads that resolve.

## Cleanup

On resolution, distil the array rules into `docs/validation/data-contract.md`,
update `validation/INDEX.md`, then delete this ticket and its index row.

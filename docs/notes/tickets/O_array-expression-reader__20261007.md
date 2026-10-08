# O_array-expression-reader__20261007 — Open

- **Scope:** An array reader for `tools/ingest_expression.py` and the separate
  "array" platform listing in Data Sources, for the seven PCC 7942 microarray
  series that deposit raw files only. Covers `tools/ingest_expression.py`,
  `data/expression/ingest/`, `docs/validation/data-contract.md` and the Data
  Sources platform grouping.
- **Status:** open
- **Opened:** 2026-10-07
- **Updated:** 2026-10-07

## Current state

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

1. Decide and record the four rules above. The per-gene reduction and the
   dye-swap rule need an owner or lab judgement; the rest follow from the
   deposits.
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

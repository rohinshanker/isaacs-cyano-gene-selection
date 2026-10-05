# O_fitness-screen-data-type__20261005 — Open

- **Scope:** Bring condition-resolved fitness screens, starting with the PCC 7942
  RB-TnSeq deposits, into the site as a data type of their own, in their own tab of
  the data selection window. Covers `docs/`, `data/`, the pipeline, and `site/`.
- **Status:** open
- **Opened:** 2026-10-05
- **Updated:** 2026-10-05

## Current state

Opened on the owner's decision of 2026-10-05 that fitness screens are wanted, in
their own tab; the [data contract](../../validation/data-contract.md#sister-strains-admitted-for-utex-2973-data)
now lists them as an admitted data type. Nothing is ingested. Two candidates are
known from the condition sweep: GSE205443, 25 RB-TnSeq samples with a per-gene
counts file, and the fitness arm of GSE205445. Both belong to the study behind the
PCC 7942 abundance table already shipped (PMID 35814646, CC BY 4.0), and several of
their condition sets use conditioned medium. A 2026-09-30 count found 28 further
GEO transposon-sequencing or essentiality records that no sweep has read.

The site already shows borrowed PCC 7942 essentiality calls from Rubin 2015 under
[pcc-essentiality.md](../../validation/pcc-essentiality.md). Those are one
condition's essential-or-not calls; a fitness screen is a per-condition
quantitative score. The two stay separate layers.

## Work

1. Read the GSE205443 counts file and its paper's methods: what the per-gene value
   is, how fitness is computed from barcode counts, and which conditions and
   replicates exist. Record the quotes and locations.
2. Sweep the 28 unread GEO records and list the ones in an admitted strain.
3. Run the admission contract for GSE205443: manifest entry, checksum, the exact
   shared-protein join to UTEX 2973 loci with matched, unmatched and ambiguous
   counts, and the cross-strain label.
4. Give fitness its own tab in the data selection window, with its own units and
   legend. A fitness value never shares a scale, a layer, or a combined estimate
   with an expression value.

## Verification

Not started. Admission needs the contract tests and the mapping audit; the tab
needs rendered checks at mobile, tablet and desktop widths; the gates run.

## Cleanup

On resolution, distil the fitness-score definition and its display rules into
`docs/validation/`, update `validation/INDEX.md`, then delete this ticket and its
index row.

# O_fitness-screen-data-type__20261005 — Open

- **Scope:** Bring condition-resolved fitness screens, starting with the PCC 7942
  RB-TnSeq deposits, into the site as a data type of their own, in their own tab of
  the data selection window. Covers `docs/`, `data/`, the pipeline, and `site/`.
- **Status:** open
- **Opened:** 2026-10-05
- **Updated:** 2026-10-06

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

## Progress, 2026-10-06

Steps 1, 3 and 4 are done; step 2 remains.

- The GEO deposit (`GSE205443_Counts.txt.gz`, 1,919 loci × 25 samples) holds
  per-gene barcode counts, not fitness; the series record says fitness scores
  and T-values were generated with the Wetmore et al. 2015 scripts, and the
  paper publishes them in Supplementary File S4, sheet "2) Gene Fitness and
  T-values" (one Fitness and T-value column per fraction sample, 1,917 loci
  evaluated). Those published values are ingested, not recomputed: nine layers,
  one per fraction (Experiment 1 tube biofilmers and settlers; Experiment 2 tube
  planktonic, settlers and biofilmers in fresh BG-11, settlers and biofilmers in
  conditioned medium; flask biofilmers in each), each with its Package B row
  (22, 23 or 24) and record. T-values are not carried.
- Admission: spec `data/expression/ingest/GSE205443.json` pins the Europe PMC
  supplementary archive (SHA-256 `97a96ea3…`, member `Data_Sheet_4.XLSX`),
  maps `Synpcc7942_` loci through the one-to-one old-locus-tag crosswalk (1,835
  mapped, 85 unmapped per layer), carries `signed: true`, and the tables ship
  under the Simkovsky 2022 ledger entry (CC BY 4.0).
- Display: a fitness source forms the Fitness family with a diverging default
  scale and the type metric "Gene fitness (RB-TnSeq)"; the data selection peek's
  Fitness screen tab lists the nine sets; the legend carries the authors'
  definition as the unit; a fitness value is never offered as a traffic metric
  and never shares a scale with an expression value. Rendered at 1280 px with a
  clean console.

Open: the sweep of the 28 unread GEO transposon/essentiality records (step 2);
the Fitness family sits after the genome-derived families in the selectors
because the measured-first ordering reads expression provenance only.

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

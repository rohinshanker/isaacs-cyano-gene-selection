# A_fitness-screen-data-type__20261005 — Active

- **Scope:** Bring condition-resolved fitness screens, starting with the PCC 7942
  RB-TnSeq deposits, into the site as a data type of their own, in their own tab of
  the data selection window. Covers `docs/`, `data/`, the pipeline, and `site/`.
- **Status:** active
- **Opened:** 2026-10-05
- **Updated:** 2026-10-07

## Current state

Completion acceptance is active in an isolated worktree based on `4a2a4c0`.
The release already contains nine GSE205443 fractions and 90 Fitness Browser
condition sets covering all 129 experiments. Independent source/payload review,
rendered controls and required gates are being checked before closure. No new
source admission is planned. PRIDE, recoded E. coli, condition recovery and raw
pilot work retain their existing owners. The earlier progress below predates
the completed compendium implementation and is being reconciled.

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

Step 2, the GEO sweep, done 2026-10-06 with E-utilities against `gds`: the
2026-09-30 count of 28 was over every entry type (series, samples, platforms;
50 today with "transposon" and "Tn5" added). Restricted to series, *S.
elongatus* has three records naming Tn-seq, transposon or essentiality, all
from the Simkovsky study: GSE205443 (ingested), GSE205444 (the RNA-seq arm,
shipped earlier) and GSE205445 (their SuperSeries, no data of its own). The
thirteen series the broader forms reach are expression profiling, one
ChIP-seq set (GSE114693) and one termination study (GSE309256); none is a
fitness screen. GEO therefore holds no further condition-resolved fitness for
this organism. The evident next source is outside GEO: the Fitness Browser's
PCC 7942 RB-TnSeq compendium (Price lab, Rubin et al. 2015 library across
many conditions), which needs its terms read and a ledger decision before any
file is fetched.

Open: the Fitness Browser candidate above; the Fitness family sits after the
genome-derived families in the selectors because the measured-first ordering
reads expression provenance only.

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

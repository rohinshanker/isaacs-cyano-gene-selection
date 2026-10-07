# O_fitness-browser-access__20261006 — Open

- **Scope:** Admit the Fitness Browser's PCC 7942 RB-TnSeq compendium as
  condition-resolved fitness layers once its terms and tables are supplied by the
  owner. Covers `data/expression/`, `site/data/citations.json`, the source ledger
  and the fitness-screen ticket's data type.
- **Status:** open
- **Opened:** 2026-10-06
- **Updated:** 2026-10-06

## Current state

The owner decided on 2026-10-06 to proceed with the Fitness Browser
(https://fit.genomics.lbl.gov/, Price et al. 2018). Every page the agents request
answers with a Cloudflare bot check, which is not solved; the Chrome extension
route was unavailable in the session that tried it. The owner's step-by-step
instructions are item 1 of [AAA-next-steps.md](../../validation/AAA-next-steps.md):
save the About or terms page and the PCC 7942 gene-fitness, experiment and gene
tables into the private drop folder.

## Work

1. Owner: supply the files (AAA-next-steps.md, item 1).
2. Read the terms; record a ledger row (cite the resource and Price et al. 2018,
   Nature 557:503) and a citation entry.
3. Map the compendium's locus tags (Synpcc7942 old locus tags) through the
   pinned crosswalk; one signed fitness layer per experiment or per condition
   set, grouped by the experiment table's condition, under the existing
   `type.fitness.rb-tnseq.fitness` type; condition records from the experiment
   table with quotes.
4. Gates, rendered check of the Fitness group in Data Sources, pins.

## Verification

Not started. The three gates, the join audit, a rendered check at 1280 and 375.

## Cleanup

On resolution, record the resource in `docs/validation/data-contract.md` beside
GSE205443, update `validation/INDEX.md`, then delete this ticket and its index
row.

# A_fitness-browser-access__20261006 — Active

- **Scope:** Admit the Fitness Browser's PCC 7942 RB-TnSeq compendium as
  condition-resolved fitness layers once its terms and tables are supplied by the
  owner. Covers `data/expression/`, `site/data/citations.json`, the source ledger
  and the fitness-screen ticket's data type.
- **Status:** active
- **Opened:** 2026-10-06
- **Updated:** 2026-10-07

## Owner delivered the files, 2026-10-07

The owner passed the bot check and saved the pages and tables into
`~/Desktop/coding_stuff/ISAACS-LAB/private-literature/fitness-browser/`
(outside the repository, never committed). Verified present on 2026-10-07:

| File | What it is |
| --- | --- |
| `about.html` | the Help page, which carries the method and the value semantics |
| `Synechococcus elongatus PCC 7942.html` | the organism page the downloads came from; the owner's `readme.txt` says to use it to index each file's source link |
| `Updated Annotations for Synechococcus elongatus PCC 7942.html` | the reannotation page |
| `fit.genomics files/fit_organism_SynE.tsv` | **the fitness table**: 1,899 genes × 129 experiment columns, plus `orgId`, `locusId`, `sysName`, `geneName`, `desc` |
| `fit.genomics files/exp_organism_SynE.txt` | **the experiments table**: 129 rows, with `expName`, `expDesc`, `timeZeroSet` and per-experiment read statistics |
| `fit.genomics files/organism_SynE_genes.tab` | the genes table |
| `fit.genomics files/t_organism_SynE.tsv` | per-gene t scores, the significance companion to the fitness values |
| `fit.genomics files/cofit_organism_SynE.txt`, `specific_phenotypes_SynE.txt`, `reanno_SynE.tsv`, `organism_SynE.faa`, `organism_SynE.fna` | cofitness, specific phenotypes, reannotation and sequences; not needed for a fitness layer |

Everything the ticket asked for arrived, and more. **The access blocker is gone**
and item 1 of [AAA-next-steps.md](../../validation/AAA-next-steps.md) is done.

What the Help page establishes, read 2026-10-07 from the saved copy:

- The data are RB-TnSeq, from the Arkin and Deutschbauer labs, method paper
  Wetmore et al., mBio 2015.
- A fitness value is a **log2 ratio** of a gene's mutant abundance at the end of
  an experiment against its Time0 start, so a layer from it is **signed**, like
  the shipped GSE205443 layers, and takes a diverging ramp rather than a
  logarithmic one. Quote: "Fitness values are log 2 ratios that describe the
  change in abundance of mutants in that gene during the experiment."
- No licence or reuse statement appears on the Help page; the only terms-like
  sentence is that the site's *code* is freely available. Under the owner's
  decision of 2026-10-06 that every source is permitted with citation, that is
  sufficient, and the ledger row should cite the Fitness Browser, Price et al.
  2018 and the Wetmore et al. 2015 method paper.

**Not started: the ingestion itself.** It was deliberately not begun on
2026-10-07 because another session was running release gates and preparing to
publish, and ingesting would rewrite `data/expression/sources.json` and the
whole of `site/data/` underneath it. One owner decision is needed first, the
same one GSE311172 raised: 129 experiments is far too many selectable layers,
so which conditions become layers, and whether the t-score table gates them,
is a judgement call before any code runs.

## Owner design decision, 2026-10-07: pool by default, grid to subset

Taken after a parallel session had already ingested the compendium as **90
layers, one per compound and dose**, staged but not committed. That is the
granularity question answered differently from how it was about to be put to the
owner, so the owner settled the presentation instead:

- **Default: the 90 are pooled and appear as one checkbox**, not 90 rows. The
  Data Sources list gains a single Fitness Browser entry, which keeps the list
  readable and matches the clutter audit in
  [O_ui-clutter-human-audit__20261005](O_ui-clutter-human-audit__20261005.md).
- **Selecting a subset stays possible.** A control on that single row opens a
  **second peek, stacked over the data-selection peek**, for choosing which of
  the 90 inform the metric.
- **That second peek is a grid of checkboxes, not a list of rows**, with the
  conditions laid out by what distinguishes them.

Why a grid fits this particular compendium, measured from the staged manifest on
2026-10-07: the 90 layers are **34 compounds** crossed with dose. Fourteen
compounds have a single dose, four have two, five have three, seven have four,
three have five and one has ten. So the natural grid is **compound down the
side, dose across**, at most ten columns and usually five or fewer, ragged on
the right. Compound names run to 46 characters, which suits a left-hand label
column; the full condition strings run to 63, which is what makes 90 list rows
unwieldy and a grid legible. The single BG-11 no-compound control and the four
remaining non-dose conditions sit apart from the grid rather than forcing an
empty column.

**Implementation note for whoever builds it.** `site/js/ui/data-sources.js`
currently holds exactly one peek: `this.peek` is built once and appended to
`document.body` with its own backdrop, `aria-modal`, focus trap and Escape
handling, all written for a single instance. Stacking a second peek over it is
the real work here, not the grid: the modal machinery has to become stack-aware
so focus, Escape and the backdrop act on the topmost peek. Group and subgroup
header rows already exist, but they are row-based and do not give a grid.

Not yet built. The ingestion itself belongs to the session that staged it.

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

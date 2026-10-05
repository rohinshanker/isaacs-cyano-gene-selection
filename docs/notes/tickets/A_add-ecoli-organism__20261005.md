# A_add-ecoli-organism__20261005 — Active

Scope: Add E. coli as a selectable organism in the visualizer.
Status: active
Opened: 2026-10-05
Updated: 2026-10-05

## Current State

The owner asked on 2026-10-05 for implementation and data gathering to begin. A
selector at the top of the visualizer offers **Cyanobacteria** and **E. coli**,
with Cyanobacteria (UTEX 2973) the fresh-view default. E. coli is a fallback
model organism explored for richer annotation and supporting data; that is a
benefit to assess per source, not a claim that every E. coli annotation or
measurement is more accurate.

The six clarifying questions below were not answered before work began. Work
proceeds on the provisional defaults recorded against each, chosen to be
reversible; an owner answer that differs reopens the affected stream.

Three streams, coordinated from the interactive session `cyano-batch-closing`.
A read-only inventory of the site's single-organism assumptions (DEM-227)
returned 2026-10-05 and is carried in the stream 3 handoff. It settled the
switching design: the organism lives in the query string (`?org=`), no parameter
means Cyanobacteria, and a switch is a full page navigation, because the page's
module state, caches, and folding workers have no teardown.

| Stream | Scope | State |
| --- | --- | --- |
| 1. Source evidence | Dossier of candidate E. coli K-12 MG1655 sources with identifiers, licence text, and identifier namespaces | DEM-225 returned 2026-10-05: 69 candidate rows, commit `a49f18d` on `agent/claude-evidence-analyst/dem-225`, not yet in this checkout. Independent re-check DEM-231 returned 2026-10-05 asking for correction (1 blocking, 7 should-fix, 2 minor; quotations matched). Correction DEM-237 returned 2026-10-05 (commit `d6c8a9c` on `agent/claude-evidence-analyst/dem-237`, 74 rows): all ten findings upheld and applied. Confirmation DEM-241 returned 2026-10-05: the revised shortlist can go to the owner; all 60 re-checked quotations matched. Two should-fix items in the search section (queries not recorded reproducibly; one overgeneralised sentence) are with a final follow-up, DEM-244; then the dossier is placed in `docs/notes/handoff/` for the owner |
| 2. Pipeline and base dataset | Organism-parametrised pipeline and contract validator; RefSeq-only E. coli dataset under `site/data/organisms/ecoli-k12-mg1655/` | DEM-226 returned 2026-10-05: commits `5d70c9f` and `11c90ee`; 4,287 genes kept, 31 excluded. Review DEM-235 reproduced every count independently and confirmed UTEX byte identity, and found the published E. coli tAI wrong (the selenocysteine tRNA counted as a decoder of the Trp codon, shifting 3,738 genes), the CAI reference rule missing the RNA-polymerase subunits and EF-G/EF-Ts it documents, and the dataset ungated in the Pages workflow. Repair DEM-239 returned 2026-10-05 (commits `17f04a0`, `7728925`, `a0365d7` on `agent/codex-implementer/dem-239`): all 18 findings addressed, Sec removed from the decoding pool, CAI reference set now 81 loci by rule, E. coli added to the Pages gate, a citations ledger published, dataset rebuilt (`genes.json` 8,042,652 bytes). Confirmation DEM-240 returned 2026-10-05: "integrate", all 18 findings resolved, every reported number reproduced independently, UTEX byte-identical. A final follow-up, DEM-243, is running for three should-fix items (reader-facing bookkeeping in the citations ledger, ledger values untied to the build, and a CI loop in which one organism's failure hid the other gates) and the minor ones. **Not release-valid** until the size budget is decided |
| 3. Selector and isolation | Organism selector, per-organism data loading, URL and saved-state isolation | DEM-228 returned 2026-10-05: commits `26a6733` and `69e9839`, gates green (991 JS tests). Review DEM-234: no blocking defect and no wrong-organism data shown or exported; one should-fix (the inline early fetch ignores the organism's layer list) and three minor. Repair DEM-238 returned 2026-10-05 (six commits through `5a421d5` on `agent/claude-implementer/dem-238`): all four findings fixed with tests (1,005 JS tests), rendered against the real dataset at 375, 768, 1280, and 1440 px with a clean console; one further defect found and fixed (the footer named the default organism's data directory). Confirmation DEM-242 returned 2026-10-05: all four findings resolved, "can be integrated", rendered on the integrated real dataset at 375, 768, 1280, and 1440 px with no wrong-organism data or export contamination. Its two minor items (the Lengths blurb above an unavailable line; a runbook sentence overstating a failed layer as a failed load) are fixed by the coordinator on the integration branch, commit `b0dc293` |

## Genome of record for E. coli

Resolved by NCBI Datasets query on 2026-10-05, not from memory:
RefSeq **`GCF_000005845.2`** (ASM584v2), *Escherichia coli* str. K-12 substr.
MG1655, taxid 511145, complete genome, one chromosome, 4,641,652 bp, reference
genome, BioProject PRJNA225. Annotation "submitted by NCBI RefSeq", release date
2026-09-02, reporting 4,290 protein-coding genes, 215 non-coding, and 145
pseudogenes. `GCF_000005845.1` (ASM584v1) is the superseded version in the same
FTP directory and is not used.

## Integration branch

`feat/ecoli-organism`, worktree `../worktrees/ecoli-organism`, holds both
patches for testing: the selector commits on their baseline snapshot, with the
pipeline commits, their repair, and the selector repair cherry-picked on top
(through `8217d42`), plus the coordinator's `b0dc293`. On it, 1,007 JS tests pass, the E. coli live-metric check passes, and the real dataset loads
through the selector at 1280 px: five requests, all inside its own directory, a
clean console, the map and the chromosome view drawn, no cyanobacterial wording
in the page text. The branch rests on a snapshot of other sessions' uncommitted
work in the main checkout as of 2026-10-05, so it cannot land on `main` until
that work is committed there; then it is rebased onto it.

The E. coli Citations tab now shows the dataset's provenance from its own
ledger (the RefSeq record and the methods used). Its primary-data entry ends
with a sentence about the open publication decision, which is repository
bookkeeping in reader-facing text and has to come out before release.

## Open decision: the `genes.json` size budget

The E. coli `genes.json` is 8,042,652 bytes after the repair's rebuild (8,042,780 before); the contract
validator's budget is 6 MiB (6,291,456 bytes), set when the only organism had 2,715 genes. The
pipeline run stopped and reported instead of weakening the check, and the
repair is told to leave the limit alone. Measured by the review (DEM-235):

| | UTEX 2973 | E. coli K-12 |
| --- | ---: | ---: |
| included genes | 2,715 | 4,287 |
| `genes.json`, raw bytes | 5,169,989 | 8,042,780 |
| raw bytes per gene | 1,904 | 1,876 |
| gzip -9 bytes | 1,596,122 | 2,506,417 |
| brotli q11 bytes | 1,230,428 | 1,917,106 |

The overage is gene count, not schema growth. The budget stands in for time to
a usable map on a slow link: the documented profile (750 kB/s, uncompressed)
gives 9.1 s for UTEX and scales to roughly 14 s for E. coli.

- **A per-gene budget** (about 2,000 bytes per gene admits both organisms):
  one configuration value and a validator change, no loader work; the gate still
  catches schema growth. It accepts the longer load without measuring it.
- **A sidecar for `rscu` and the packed `codons`,** which the data contract
  already names as the remedy when the core file exceeds the budget. Moving both
  leaves a 4,936,617-byte core; moving `rscu` alone leaves 6,308,090 bytes,
  still over. It needs loader work, and `codons` is what every recoding
  computation reads, so the map would draw before recoding is ready.

Until the owner decides, the E. coli validator run fails that one check.

## Lab questions raised by the E. coli dataset

Not decided here; for the owner or the lab.

- The three selenoprotein genes (`fdnG`, `fdoG`, `fdhF`) are excluded, so their
  in-frame TGA is never offered as a recodable stop. Is exclusion right, or
  should they be shown and flagged?
- CAI reference set membership under the product-name rule: the frameshifted
  `prfB`; the zinc-independent ribosomal paralogues `ykgM` and `ykgO`, which are
  near-silent in rich media; and whether EF-P belongs.
- At nine loci with more than one annotated product, the longest CDS is kept and
  the alternates are excluded (for example the `dnaX` gamma frameshift product,
  CheA-short). Is the longest product the right one to recode against?

## Source dossier, returned 2026-10-05, under correction

Evidence only; nothing below is admitted, permitted, or decided. The dossier's
first candidates by layer: PRECISE-1K for transcript abundance; Ettwiller 2016
for start sites; Yan 2018 for operons and Adams 2021 for 3' ends; EcoCyc and
UniProtKB for curated function; the RefSeq annotation itself for tRNA genes and
gene-model flags. It found no genome-wide essentiality call measured in MG1655
itself (the best-licensed, Goodall 2018, is BW25113) and no per-gene protein
table that combines MG1655 with a redistribution grant; both are statements
about its candidate list, which was not a systematic archive sweep.

The independent re-check found both negatives too strong. Mori 2021 includes a
measured MG1655 (sub-strain EQ353) proteomics subset, three biological cultures
in seven MS runs, with corrected gene-level tables; and Choe 2022 (PMID
36507678) is a native-MG1655 Tn-seq study with a per-file CC BY table of 4,498
`b`-number records and 523 LB essential calls, whose own subject is false
essential calls. The corrected dossier adds both and reranks layers 5 and 6:
Choe 2022 first for essentiality, with Goodall 2018 (BW25113) as a
cross-substrain comparator; the Mori 2021 EQ353 subset first for protein
abundance, then Zhao 2019 (MG1655, M9 glucose, two biological replicates).
Neither cross-strain ruling is now a precondition for those layers. Still open
for the owner or the lab: whether sub-strain EQ353 stands for MG1655; how to
show an essentiality call whose own paper documents its error classes; and a
ledger rule for a supplementary file that carries no licence legend of its own.

Raised for the coordinator and the owner:

- **The RefSeq annotation of this genome is not PGAP output.** Its record says
  the annotation is derived from EcoCyc. The source ledger's RefSeq rule rests on
  PGAP being a US-government work, so it does not carry over unexamined, and it
  is the rule stream 2's base dataset relies on. The re-check confirms the
  record's wording ("Protein update by submitter; annotation updates are derived
  from EcoCyc", a reviewed RefSeq record with an EcoCyc direct submission dated
  2024-11-06) and that NCBI policy distinguishes government-created material
  from contributed content. Until the owner decides, the E. coli dataset is
  built and validated locally and is not published.
- **Four owner actions would unlock the most:** executing the EcoCyc data
  licence (a form; files are released after review); asking CCG-UNAM for written
  consent to redistribute RegulonDB-derived tables; a ruling on carrying
  BW25113, NCM3722, or W3110 measurements onto MG1655 genes; and ledger rules for
  licence situations the ledger does not cover yet (CC BY-NC and NC-SA, a
  repository licence over data, US-government works, author-manuscript terms).
- **Disclosure.** The run made one BioCyc web-service call as an access probe,
  and the BioCyc licence says API use signifies assent to its terms. No further
  call was made, no account was created, and no licence form was submitted. The
  re-check is told to make none.
- **BioProject.** Settled by the re-check from the two BioProject records:
  PRJNA225 is the original GenBank project and PRJNA57779 its RefSeq peer
  project for the same assembly. Both are correct.

## Provisional defaults for the clarifying questions

1. *Strain and assembly.* K-12 MG1655, `GCF_000005845.2`, single strain.
2. *Recoding workflow or browsing.* The full existing workflow. Scheme burden and
   every target-dependent metric are computed in the browser from the packed
   codons, so a dataset that honours the data contract gets them without a
   reduced mode.
3. *Which data first.* The RefSeq-derived base dataset ships first. Stream 1
   ranks curated function, regulation, expression, essentiality, and protein
   evidence; each further source needs the admission contract and an owner
   sign-off before it enters `data/` or `site/`.
4. *Independent view or comparison.* An independent E. coli view. Matched-gene
   comparison and E. coli evidence on a cyanobacterial gene stay out of scope;
   they need an ortholog mapping with evidence labels.
5. *State on switching.* Each organism keeps its own scheme, filters, pinned
   gene, and shortlist; nothing carries across.
6. *URLs and saved schemes.* A shareable URL names the organism, and a link with
   no organism means Cyanobacteria, so existing links keep their meaning. Saved
   schemes are stored per organism. A cyanobacterial strain selector is not
   built.

## Verification

For implementation: verify the default organism, switching and return behavior,
organism-specific labels and data, URL restoration, and absence of
mixed-organism state. Render the selector and affected views at mobile, tablet,
and desktop widths, then run the repository's JavaScript, Python, and
data-contract gates. The E. coli dataset must pass the contract validator's
independent re-derivation from the raw genome, and the UTEX 2973 output must be
byte-identical before and after the pipeline is parametrised.

## Cleanup

Once implemented and validated, distill reusable organism/data isolation and
selector guidance into docs/validation/, update its index, resolve this ticket,
and remove it from the live queue.

## Scientific dependencies

Only the RefSeq assembly and annotation are in use, as a reproducibility input
fetched at build time under a checksum pin, following the
[source ledger](../../validation/source-ledger.md)'s RefSeq rule. No other source
is selected or admitted. Stream 1 returns evidence, never admission, licence
permission, a locus join, or a lab decision; its dossier is re-checked by an
independent reviewer and then goes to the owner. Any cross-organism evidence
transfer needs explicit mapping and evidence labels and is not part of this
ticket's first release.

Related context: the
[cross-strain scan](O_cross-strain-data-scan__20260927.md) covers cyanobacterial
dataset selectors; the
[UTEX BioCyc ticket](O_biocyc-utex-2973-data__20260930.md) separately asks whether
curated E. coli evidence should be shown on matched UTEX loci.

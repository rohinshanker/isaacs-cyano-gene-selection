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
| 1. Source evidence | Dossier of candidate E. coli K-12 MG1655 sources with identifiers, licence text, and identifier namespaces | Done, with the owner: `docs/notes/handoff/ecoli_source_dossier_20261005.md` and `.tsv` (74 rows) with its search manifest. Written as DEM-225, re-checked (DEM-231), corrected (DEM-237), confirmed (DEM-241), and closed by a final pass (DEM-244) that made the search reproducible and corrected one statement about where the Mori 2021 tables are deposited. Evidence only; nothing is admitted |
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

`feat/ecoli-organism`, worktree `../worktrees/ecoli-organism`, at `62dc528`: 19
commits above `d38b431`, onto which it was rebased on 2026-10-05 once the main
checkout's outstanding work was committed there. It holds the selector stream,
the pipeline stream, both repairs, the pipeline follow-up (DEM-243), and four
coordinator commits: the Lengths blurb fix, the per-gene size budget, and two
that take repository remarks out of the E. coli source ledger and close the
final review's minor findings.

Gates on it, for both organisms, with the pinned inputs supplied: 1,007 JS
tests; 405 Python tests passed, 1 skipped; contract validator 98 passed for UTEX
2973 and 64 passed, 0 failed for E. coli; live-metric checks, manifest checks,
and the UTEX byte-identity check pass. The real E. coli view loads through the
selector with a clean console, its Citations tab shows the dataset's own
ledger, and no cyanobacterial wording appears.

The final integration review (DEM-245) found no blocking or should-fix defect,
confirmed by `git range-diff` that the rebase lost and duplicated nothing, and
gave two verdicts: merge to local `main`, yes; push, hold until the publication
decision below. Its four minor findings are closed in `62dc528`, which no
reviewer has seen.

**Not merged.** A push of `main` deploys the site, so the branch stays apart
until the publication decision below. Brought up to date on 2026-10-05 (merge
of `main` at `858a958`, commit `914b0f7`, plus `5acad55`, which hides the Data
Sources section for an organism that publishes no measured source): the
Data Sources feature, the eleven ingested PCC 7942 layers, and the separate
`expression_layers.json` payload all ride on it. Gates after the merge, both
organisms: 1,030 JS tests; 455 Python tests passed, 1 skipped; contract
validator 106 passed for UTEX 2973 and 68 for E. coli; live-metric and manifest
checks pass; both views rendered with a clean console. It now fast-forwards
into `main` without conflict.

## Decided: the `genes.json` size budget

Owner decision, 2026-10-05: 2,000 bytes per plotted gene for every organism,
replacing the fixed 6,291,456 bytes. Implemented in the contract validator with
tests (`cf69c0e`), and recorded with its measurements in the data contract's
"Size budget" section. UTEX 2973 is 5,169,989 bytes against 5,430,000; E. coli
is 8,042,652 against 8,574,000.

## Open decision: publishing data derived from this annotation

The RefSeq record's annotation is derived from EcoCyc, so the source ledger's
RefSeq rule, which rests on NCBI's own pipeline being a government work, does
not settle it. The owner asked for a recommended path on 2026-10-05; the
coordinator's recommendation is to publish with attribution to both NCBI RefSeq
and EcoCyc, record that as a ledger rule for curator-submitted RefSeq
annotation, and send SRI the notification its open-database terms ask for.
Not decided. Until it is, the branch is not pushed.

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

## Source dossier, 2026-10-05

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

Done on the integration branch: the default organism, switching and return,
organism-specific labels and data, URL restoration, absence of mixed-organism
state, and exports, rendered at 375, 768, 1280, and 1440 px in Chromium by the
writer and independently by two reviewers; the JavaScript, Python, and
data-contract gates for both organisms; the contract validator's independent
re-derivation of the E. coli gene model from the raw genome; and UTEX 2973
output byte-identical apart from `builtAt`.

Not verified: browsers other than Chromium; a screen reader; the folding worker
across an organism switch; a measured first load of the 8 MB E. coli gene file
over a real network; the Pages workflow on GitHub itself, which has only been
simulated locally; an independent tRNAscan-SE run for E. coli.

## Remaining

For the base view to ship:

1. The owner's publication decision, then the EcoCyc citation and ledger rule
   it implies.
2. Merge to `main`, push, and verify the production URL and the first real CI
   run.

For the ticket's purpose, richer annotation and supporting data than the
cyanobacterial view has, which the base view does not yet deliver (it carries
genome-derived metrics only):

3. The owner's choice of sources from the dossier's shortlist, and ledger rules
   for the licence situations it lists.
4. For each admitted source, the admission contract: a manifest entry, checksum
   pin, the documented join to `b`-number locus tags with matched, unmatched,
   and ambiguous counts, the organism record's layer declaration, and contract
   and UI tests. The first candidates need no further permission step:
   UniProtKB function and GO (CC BY 4.0), then PRECISE-1K transcript abundance
   (MIT over the files).
5. An annotation-evidence and GO layer for E. coli, which needs the annotation
   release tooling generalised beyond UTEX 2973.

Then the six clarifying questions and the lab questions below, and cleanup.

## Cleanup

Once shipped and validated: the reusable guidance already lives in
`docs/validation/organism-selector.md`, `genome-provenance.md`,
`data-contract.md`, `cai-reference-set.md`, and `trna-annotation-validation.md`;
add the README's description of the organism selector, resolve this ticket, and
remove it from the live queue. The Multica run worktree left behind by DEM-234
and the merged agent branches can be removed.

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

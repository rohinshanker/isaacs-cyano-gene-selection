# Ticket Index

Live queue of open and active tickets only. Resolved tickets are deleted and
their reusable guidance distilled into `docs/validation/`.

Closing a ticket is governed by the "Closing a ticket" section of
[AGENTS.md](../../../AGENTS.md): the owning session closes it, names itself and
the date, and lists every open finding against the work by identifier. A ticket
whose audit is unresolved is not closed, and a closure that would lose an open
finding is reverted rather than argued about.

| Ticket | Scope |
| --- | --- |
| [A_regulatory-methods-shortlist__20261008](A_regulatory-methods-shortlist__20261008.md) | Primary-source candidate assessment for RBS and other regulatory/cryptic-site methods; no execution/admission; existing iDOG hold retained |
| [A_ui-closeout-safe-batch__20261007](A_ui-closeout-safe-batch__20261007.md) | Isolated UI closeout coordinated by cyano-source-ingestion; clear disclosures/tab order first; pending owner decisions and three inherited 375px Data Selection mockup findings retained |
| [O_loading-bar-header-placement__20261007](O_loading-bar-header-placement__20261007.md) | Open for later: move additional loading progress beneath the top-right Jump to map / Reset panel widths controls; prevent menu resizing and the leftover center-panel gap; assess intervening changes and clarification at resolution |
| [O_annotation-precedence-data-sources__20261007](O_annotation-precedence-data-sources__20261007.md) | Open for later: move functional-annotation precedence text into expanded Data Sources only, spanning the section's full width; assess intervening changes and clarification at resolution |
| [O_tan-information-collapsed__20261007](O_tan-information-collapsed__20261007.md) | Open for later: collapse every tan text/information box across the site, including the bottom-center-panel box, behind a relevant label; assess intervening changes and clarification at resolution |
| [O_scale-information-popover__20261007](O_scale-information-popover__20261007.md) | Open for later: move below-map scale information into a popover opened on click/hover from an info button beside Scale; assess intervening changes and clarification at resolution |
| [O_xy-axis-dataset-peek__20261007](O_xy-axis-dataset-peek__20261007.md) | Open for later: center dataset picker for each multi-source X vs Y axis, in a separate window from the PCA picker; applied X/Y/PCA selections are independent by owner decision 2026-10-08; assess affected-area changes at resolution |
| [A_chromosome-measurement-performance__20261007](A_chromosome-measurement-performance__20261007.md) | Active: `cyano-general-ticket-closing` owns runtime profiling and repair of measurement-default chromosome lag, four-dataset and larger selections; preserve all pooling, ratio separation, loading and coordinate contracts |
| [O_gene-sequence-structural-features__20261007](O_gene-sequence-structural-features__20261007.md) | Open for later: verify Tan initiation start-site display and future structural-feature support in the sequence viewer at the bottom of Chromosome/Gene; owner request 2026-10-07: determine Shine-Dalgarno / RBS-like sequences per gene and show them in both gene viewers as a predicted `rbs` layer (method decision stays with the RBS Calculator ticket); existing Tan support and sequence-extent limits need rendered assessment |
| [A_ui-interactivity-batch__20261006](A_ui-interactivity-batch__20261006.md) | Engineering accepted and verified; awaiting the owner’s loading defaults; human clutter marks remain open |
| [A_loading-scramble-and-progress__20261006](A_loading-scramble-and-progress__20261006.md) | Accepted A/B/C and grouped/continuous previews with truthful progress; owner visual choices pending before production defaults change |
| [O_array-expression-reader__20261007](O_array-expression-reader__20261007.md) | Array reader and the separate array platform listing for the seven raw-only PCC 7942 microarray series, split from the licence-unblocked ticket 2026-10-07; four scientific rules (channel, normalisation, dye swap, probe-to-gene) to decide before any layer ships |
| [O_review-original-source-downloads__20261007](O_review-original-source-downloads__20261007.md) | Ready for owner review: pros/cons of listing original RefSeq GFF/feature tables and Rubin Dataset S3 with citations, sizes and hashes; current downloads stay unchanged |
| [A_add-ecoli-organism__20261005](A_add-ecoli-organism__20261005.md) | E. coli K-12 MG1655 (`GCF_000005845.2`) base view shipped 2026-10-06 behind the Cyanobacteria/E. coli selector, attributed to NCBI RefSeq, EcoCyc and Blattner 1997 by owner decision. Open: the owner's SRI notification; richer layers (UniProtKB/GO, PRECISE-1K) under the admission contract; six provisional defaults and the lab questions |
| [A_recoded-ecoli-multiomics__20261007](A_recoded-ecoli-multiomics__20261007.md) | Owner-requested admission of the Nyerges 2026 partially recoded *E. coli* datasets (PMID 42331836), the first recoded organisms here. All six owner questions answered 2026-10-07: one organism record per profiled genome, design and derived genomes admissible pinned by checksum, both codon projections published and labelled, fitness admitted as a new per-strain type, all three Supplementary Data 3 quantities admitted separately, and the Claude Science check withdrawn. The seven removed codons and their replacement distribution are derived and cross-checked in repository (`tools/recoded_scheme.py`, 43 tests); the scheme is a distribution, not a codon-to-codon map, so `scheme.js` cannot express it yet. Open: the reference strain behind each fold-change column, the per-strain segment-coordinate reconciliation, and the scheme-representation decision |
| [O_trna-identification-viewer__20260930](O_trna-identification-viewer__20260930.md) | Bounded first version over 44 annotated UTEX tRNA loci plus 1 distinct predicted pseudogene candidate; the detailed proposal awaits only owner reading. CS-1 applies to future probability scoring, not this viewer |
| [O_review-trna-viewer__20261007](O_review-trna-viewer__20261007.md) | Owner approved 2026-10-08 after the in-chat summary; specification transferred for bounded implementation in DEM-320 |
| [O_biocyc-pcc-7942-data__20260930](O_biocyc-pcc-7942-data__20260930.md) | Assess BioCyc v30's `SYNEL`, the only Tier 2 curated database among the six strains, as labelled sister-strain evidence. Which assembly `SYNEL` is built on is observed, not determined; owner questions Q2 and Q5 and the source-ledger and admission decisions pending; no pull started |
| [O_biocyc-utex-2973-data__20260930](O_biocyc-utex-2973-data__20260930.md) | Assess what BioCyc v30's Tier 3 uncurated UTEX 2973 database adds beyond the pinned RefSeq annotation: inferred pathways and reactions and 1,969 predicted transcription units, plus the returned ortholog table. Owner questions Q2, Q4, and Q6 and the source-ledger decision pending; no pull started |
| [O_rbs-calculator-gene-visualizer__20260930](O_rbs-calculator-gene-visualizer__20260930.md) | Assess RBS Calculator v1.0 for RBS predictions and gene-visualizer display. Code and terms now established: GPL v3.0, Python 2, an unbundled separately licensed NuPACK, and an *E. coli* anti-Shine-Dalgarno default. Scientific interpretation depends on CS-1 (pending); owner question Q7 unanswered |
| [O_idog-promoter-prediction__20260930](O_idog-promoter-prediction__20260930.md) | Future Mythos 5.1 / Fable 5.1 assessment of iDOG for UTEX promoter work. CS-1 refuted 2026-09-30 as to promoter-location prediction; the operon designer and 48-promoter design library are now recorded. Held open by owner direction pending their own code and literature review — not to be closed, resolved, or run through Cleanup |
| [O_biocyc-pcc-6301-data__20260930](O_biocyc-pcc-6301-data__20260930.md) | Assess BioCyc v30's Tier 3 uncurated PCC 6301 database as labelled sister-strain evidence; owner question Q2 and access, mapping, source-ledger, and admission decisions pending; no pull started |
| [O_folding-compute-backend__20260930](O_folding-compute-backend__20260930.md) | Bouchet available per owner 2026-10-07; Spinup/OOD choice, cluster agents/workspace, allocation and automated access remain open. Method and fallback-host assessment stay separate |
| [O_recoding-regulatory-site-change__20260930](O_recoding-regulatory-site-change__20260930.md) | Future coloring metric for regulatory-site DNA changes under recoding. Its D1 research package is fully specified and one owner answer away from dispatchable — clarifying question 1, which site types come first. Implementation and dispatch not started |
| [O_biocyc-pcc-6311-data__20260930](O_biocyc-pcc-6311-data__20260930.md) | BioCyc v30 has no PCC 6311 database. Kept open pending owner questions Q1 and Q2 on whether the strain has a comparative use and what ticket shape to keep; no pull started |
| [O_biocyc-pcc-7943-data__20260930](O_biocyc-pcc-7943-data__20260930.md) | BioCyc v30 has no PCC 7943 database. Kept open pending owner questions Q1 and Q2 on whether the strain has a comparative use and what ticket shape to keep; no pull started |
| [O_biocyc-utex-3055-data__20260930](O_biocyc-utex-3055-data__20260930.md) | BioCyc v30 has no UTEX 3055 database. Kept open pending owner questions Q1 and Q2, including whether its greater divergence is useful as an outgroup; no pull started |
| [O_cross-strain-data-scan__20260927](O_cross-strain-data-scan__20260927.md) | Package B's condition metadata is in; the crosswalk second check returned 2026-10-04 and agrees on every count, lifting the hold on PCC 6311/7943 sources (none exists yet). Pair scoring done through package D (intake 2026-10-06) and the owner's judgements; extend the gene viewer with sister-strain overlays (gated on data that is not admitted) and flanking-neighbour context; design the dataset and condition selectors |
| [O_comparability-lab-judgements__20261005](O_comparability-lab-judgements__20261005.md) | Ten scientific judgement questions from packages D and E, J1 to J10. The owner decided all but two on 2026-10-05. J10 is with the owner as a generated review sheet of the 32 escalated pairs; J2 is open and minor |
| [O_unreadable-literature-workarounds__20261005](O_unreadable-literature-workarounds__20261005.md) | Eight papers Claude Science could not read. Five are readable by the agents from the PMC article page, probed 2026-10-05; the owner supplied the other five with supplements the same day, in a private drop folder outside the repository. An in-repository extraction with a mechanical quote match counts as verified. Next: the addendum to packages B and C |
| [O_gated-pages-and-accounts__20261005](O_gated-pages-and-accounts__20261005.md) | Sources refused by a CAPTCHA, a script-rendered page, metering, or a missing account: which a browser render solves, which need an email for terms, and BioCyc, where the owner signs in to their own account in an opened browser and an agent reads the wanted pages with the owner present |
| [O_depositor-condition-correspondence__20261007](O_depositor-condition-correspondence__20261007.md) | Owner/labmate sends prepared queries; remaining unknowns/conflicts are accepted outcomes and replies do not block the completed engineering/recovery scopes |
| [A_raw-read-pilot-execution__20261007](A_raw-read-pilot-execution__20261007.md) | Active non-release execution of the pinned GSE122841 four-library raw-read pilot; preparation and eight-file input verification are complete, but full pipeline outputs remain in progress |
| [O_data-sources-selection__20261005](O_data-sources-selection__20261005.md) | Build the Data Sources feature: the section below "Color by", the data selection peek with groups, subgroups, filters and per-row source details, the source controls in filters, axes and projection views, structured condition records, and per-dataset loading. Design fixed by the owner 2026-10-05; prototype done; build in progress on main |
| [O_ui-clutter-human-audit__20261005](O_ui-clutter-human-audit__20261005.md) | Prepared: 20 desktop/tablet renders and the numbered text inventory. Owner decision 2026-10-06: leave open for human keep/move/merge/remove marks, then agents apply them |

## Pending Claude Science

**Owner decision, 2026-10-05: Claude Science is the default last resort.**
The owner explicitly requested the E. coli multi-omics review on 2026-10-06;
P-ECOLI-OMICS returned 2026-10-07 and passed intake; its row is gone from the queue.
The two older CS-1 claims need no dispatch and are researched in the repository.

Items the owner takes to the next Claude Science session, per
[claude-science-handoff.md](../../validation/claude-science-handoff.md). Agents add a
row when they add a claim or a dispatchable package and remove it when the result
is pasted into the ticket and intake passes.

**A session returned 2026-09-28.** Its manifest, findings, and the ordered list of
what to pick up next are in
[`docs/notes/handoff/RET_claude-science-session__20260928.md`](../handoff/RET_claude-science-session__20260928.md).
Read that before starting any row below.

**A second session returned 2026-09-30**, reviewing the thirteen tickets opened
that date. Read
[`docs/notes/handoff/RET_claude-science-session__20260930.md`](../handoff/RET_claude-science-session__20260930.md)
before starting work on any ticket opened 2026-09-30.

| Ticket | Id | Request | Unblocks | Sent | Returned |
| --- | --- | --- | --- | --- | --- |
| [O_trna-identification-viewer__20260930](O_trna-identification-viewer__20260930.md) | CS-1 | Check whether tRNAscan-SE scores support calibrated tRNA-gene probabilities over the 45 Infernal-confirmed tRNA loci on this genome — the population is now known, not an open-ended genome-wide screen; return score semantics and calibration evidence/limits. Future probability-scoring option only; no dependency for the first-version viewer or its owner review. Planning only; not dispatched | Accurate likelihood-versus-score definition for a future scoring option | | |
| [O_rbs-calculator-gene-visualizer__20260930](O_rbs-calculator-gene-visualizer__20260930.md) | CS-1 | Check whether v1.0 translation-initiation predictions have validation applicable to UTEX 2973; return method/validation sources and limitations. Planning only; not dispatched | Biological interpretation before RBS-prediction integration | | |

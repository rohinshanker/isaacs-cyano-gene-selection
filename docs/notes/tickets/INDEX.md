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
| [O_dataset-coloring-loading-bar__20261008](O_dataset-coloring-loading-bar__20261008.md) | Overlay a continuous loading bar on the map when switching to dataset-based coloring, driven by actual data-loading progress; separate from the existing header-placement request |
| [A_regulatory-methods-shortlist__20261008](A_regulatory-methods-shortlist__20261008.md) | Owner-selected RBS Calculator, iDOG/TransTermHP, Promoter Calculator, ViennaRNA, STREME, Rfam/Infernal and IntaRNA; annotation opacity/precedence and hover outlines recorded; implementation resumed; existing iDOG-specific hold retained |
| [A_ui-closeout-safe-batch__20261007](A_ui-closeout-safe-batch__20261007.md) | cyano-source-ingestion coordination; implementation resumed on confirmed owner decisions; isolated workers and coordinator own open UI work; integrated presentation slice and all open findings retained |
| [O_loading-bar-header-placement__20261007](O_loading-bar-header-placement__20261007.md) | Open for later: move additional loading progress beneath the top-right Jump to map / Reset panel widths controls; prevent menu resizing and the leftover center-panel gap; assess intervening changes and clarification at resolution |
| [O_annotation-precedence-data-sources__20261007](O_annotation-precedence-data-sources__20261007.md) | Open for later: move functional-annotation precedence text into expanded Data Sources only, spanning the section's full width; assess intervening changes and clarification at resolution |
| [O_tan-information-collapsed__20261007](O_tan-information-collapsed__20261007.md) | Open for later: collapse every tan text/information box across the site, including the bottom-center-panel box, behind a relevant label; assess intervening changes and clarification at resolution |
| [O_scale-information-popover__20261007](O_scale-information-popover__20261007.md) | Open for later: move below-map scale information into a popover opened on click/hover from an info button beside Scale; assess intervening changes and clarification at resolution |
| [O_xy-axis-dataset-peek__20261007](O_xy-axis-dataset-peek__20261007.md) | Open for later: center dataset picker for each multi-source X vs Y axis, in a separate window from the PCA picker; applied X/Y/PCA selections are independent by owner decision 2026-10-08; assess affected-area changes at resolution |
| [O_gene-sequence-structural-features__20261007](O_gene-sequence-structural-features__20261007.md) | Adjustable upstream window and regulatory annotations in both gene viewers; owner requests lower-precedence slightly transparent calculated-prediction tags and hover outlines including initiation/termination; implementation resumed; calculated predictions yield to library annotations |
| [A_ui-interactivity-batch__20261006](A_ui-interactivity-batch__20261006.md) | Engineering accepted; owner selected B with 500 ms hold, implementation resumed; continuous geometry confirmed; human clutter marks remain open |
| [A_loading-scramble-and-progress__20261006](A_loading-scramble-and-progress__20261006.md) | Owner selected B with 500 ms hold and continuing activity; B500ms + continuous confirmed; accurate filename/KB/MB text required; implementation resumed |
| [O_array-expression-reader__20261007](O_array-expression-reader__20261007.md) | Array reader and the separate array platform listing for the seven raw-only PCC 7942 microarray series, split from the licence-unblocked ticket 2026-10-07; four scientific rules (channel, normalisation, dye swap, probe-to-gene) to decide before any layer ships |
| [O_review-original-source-downloads__20261007](O_review-original-source-downloads__20261007.md) | Owner selected upstream catalogue with last-link-check dates and source/version/file/integrity/access metadata; catalogue/checker implemented for review; existing tracked downloads preserved |
| [A_add-ecoli-organism__20261005](A_add-ecoli-organism__20261005.md) | E. coli K-12 MG1655 (`GCF_000005845.2`) base view shipped 2026-10-06 behind the Cyanobacteria/E. coli selector, attributed to NCBI RefSeq, EcoCyc and Blattner 1997 by owner decision. Open: the owner's SRI notification; richer layers (UniProtKB/GO, PRECISE-1K) under the admission contract; six provisional defaults and the lab questions |
| [A_recoded-ecoli-multiomics__20261007](A_recoded-ecoli-multiomics__20261007.md) | Syn61 16 typed omics layers, 48-strain growth/5,280-well fitness, recoded UI/presets and public MDS42/DH10B references implemented; DEM-318/319 reviews accepted and all 11 findings resolved. Remaining D5-isolates exact partial genomes and D4-debug-identity assay-clone crosswalk |
| [O_trna-identification-viewer__20260930](O_trna-identification-viewer__20260930.md) | Approved bounded 44-locus + opt-in candidate viewer; isolated 5f2d8da has five open DEM-321 findings; repairs returned for independent review; closure requires opening final localhost for owner; CS-1 is future scoring only |
| [O_review-trna-viewer__20261007](O_review-trna-viewer__20261007.md) | Owner approved specification; implementation review unresolved (TRNA-R1–R5); implementation resumed and localhost opening required before viewer resolution |
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
| [O_ui-clutter-human-audit__20261005](O_ui-clutter-human-audit__20261005.md) | Prepared 20 renders/text inventory; owner will enter keep/move/merge/remove marks on this ticket itself; leave open and hold implementation |

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

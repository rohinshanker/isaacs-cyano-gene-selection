# Ticket Index

Live queue of open and active tickets only. Resolved tickets are deleted and
their reusable guidance distilled into `docs/validation/`.

| Ticket | Scope |
| --- | --- |
| [A_ui-interactivity-batch__20261006](A_ui-interactivity-batch__20261006.md) | Engineering accepted and verified; awaiting the owner’s loading defaults; human clutter marks remain open |
| [A_loading-scramble-and-progress__20261006](A_loading-scramble-and-progress__20261006.md) | Accepted A/B/C and grouped/continuous previews with truthful progress; owner visual choices pending before production defaults change |
| [O_fitness-browser-access__20261006](O_fitness-browser-access__20261006.md) | Admit the Fitness Browser PCC 7942 RB-TnSeq compendium once the owner saves its terms and tables past the bot check (AAA-next-steps.md item 1) |
| [O_pmc-gated-method-papers__20261006](O_pmc-gated-method-papers__20261006.md) | Read the four PMC-deposited method papers once the owner saves them past PMC's proof-of-work check (AAA-next-steps.md item 2); nothing in the data waits on it |
| [A_licence-unblocked-sources__20261006](A_licence-unblocked-sources__20261006.md) | Rows 1, 2 and 5 shipped 2026-10-07: 20 RNA-seq layers from nine GEO series under the admission contract. Remaining: the three PRIDE deposits (row 7, ratio layers permitted); rows 3 and 4 wait on depositor replies, drafts in AAA-next-steps.md item 5; arrays split out; rows 8 and 9 deferred to the owner review of 2026-10-07 |
| [O_array-expression-reader__20261007](O_array-expression-reader__20261007.md) | Array reader and the separate array platform listing for the seven raw-only PCC 7942 microarray series, split from the licence-unblocked ticket 2026-10-07; four scientific rules (channel, normalisation, dye swap, probe-to-gene) to decide before any layer ships |
| [O_review-original-source-downloads__20261007](O_review-original-source-downloads__20261007.md) | Ready for owner review: pros/cons of listing original RefSeq GFF/feature tables and Rubin Dataset S3 with citations, sizes and hashes; current downloads stay unchanged |
| [A_add-ecoli-organism__20261005](A_add-ecoli-organism__20261005.md) | E. coli K-12 MG1655 (`GCF_000005845.2`) base view shipped 2026-10-06 behind the Cyanobacteria/E. coli selector, attributed to NCBI RefSeq, EcoCyc and Blattner 1997 by owner decision. Open: the owner's SRI notification; richer layers (UniProtKB/GO, PRECISE-1K) under the admission contract; six provisional defaults and the lab questions |
| [O_ecoli-multiomics-datasets__20261006](O_ecoli-multiomics-datasets__20261006.md) | Owner-requested Claude Science literature review (P-ECOLI-OMICS, pending manual handoff): find and retrieve transcriptomics, proteomics and Ribo-seq sources with many biological replicates per condition, preferably matched across layers; partial multi-omics and similar-condition sources from separate experiments are acceptable fallbacks |
| [A_recoded-ecoli-multiomics__20261007](A_recoded-ecoli-multiomics__20261007.md) | Owner-requested admission of the Nyerges 2026 partially recoded *E. coli* datasets (PMID 42331836), the first recoded organisms here. All six owner questions answered 2026-10-07: one organism record per profiled genome, design and derived genomes admissible pinned by checksum, both codon projections published and labelled, fitness admitted as a new per-strain type, all three Supplementary Data 3 quantities admitted separately, and the Claude Science check withdrawn. The seven removed codons and their replacement distribution are derived and cross-checked in repository (`tools/recoded_scheme.py`, 43 tests); the scheme is a distribution, not a codon-to-codon map, so `scheme.js` cannot express it yet. Open: the reference strain behind each fold-change column, the per-strain segment-coordinate reconciliation, and the scheme-representation decision |
| [A_regulatory-site-viewer-layers__20260930](A_regulatory-site-viewer-layers__20260930.md) | Active completion: shared point/interval marker handling, Tan sequence close-up, independent per-view link persistence, full render and review gates |
| [O_trna-identification-viewer__20260930](O_trna-identification-viewer__20260930.md) | Bounded first version over 44 annotated UTEX tRNA loci plus 1 distinct predicted pseudogene candidate; the detailed proposal awaits only owner reading. CS-1 applies to future probability scoring, not this viewer |
| [O_review-trna-viewer__20261007](O_review-trna-viewer__20261007.md) | Ready for owner reading only: full initial tRNA viewer specification, inventory, interactions, evidence limits and implementation acceptance; no research, source-access or compute blocker |
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
| [O_claude-science-offload__20260927](O_claude-science-offload__20260927.md) | Hand the cross-strain sweep to Claude Science as packages A to D under a fixed return format and the evidence-not-admission boundary. All four have returned and passed intake (A corrected, B, C on 2026-10-04; D on 2026-10-06: 0 comparable, 32 escalated and owner-judged, 178 undecidable, 731 not); licence decisions are in the source ledger. Remaining: cleanup only |
| [O_comparability-lab-judgements__20261005](O_comparability-lab-judgements__20261005.md) | Ten scientific judgement questions from packages D and E, J1 to J10. The owner decided all but two on 2026-10-05. J10 is with the owner as a generated review sheet of the 32 escalated pairs; J2 is open and minor |
| [O_unreadable-literature-workarounds__20261005](O_unreadable-literature-workarounds__20261005.md) | Eight papers Claude Science could not read. Five are readable by the agents from the PMC article page, probed 2026-10-05; the owner supplied the other five with supplements the same day, in a private drop folder outside the repository. An in-repository extraction with a mechanical quote match counts as verified. Next: the addendum to packages B and C |
| [O_gated-pages-and-accounts__20261005](O_gated-pages-and-accounts__20261005.md) | Sources refused by a CAPTCHA, a script-rendered page, metering, or a missing account: which a browser render solves, which need an email for terms, and BioCyc, where the owner signs in to their own account in an opened browser and an agent reads the wanted pages with the owner present |
| [O_depositor-condition-correspondence__20261007](O_depositor-condition-correspondence__20261007.md) | Owner/labmate sends prepared queries; remaining unknowns/conflicts are accepted outcomes and replies do not block the completed engineering/recovery scopes |
| [A_condition-metadata-gaps__20261005](A_condition-metadata-gaps__20261005.md) | Active completion: current pair rescore and gap ranking, scoped unknown/conflict disposition and a sequential local raw-read pilot; depositor correspondence remains owner/labmate work |
| [O_package-e-evidence-gaps__20261005](O_package-e-evidence-gaps__20261005.md) | Gaps in the package E evidence: undelivered pilot code, no confidence intervals, a two-contrast result, hand-parsed condition records, 35 unread audit chunks. The mockup render is done and recorded there |
| [O_data-sources-selection__20261005](O_data-sources-selection__20261005.md) | Build the Data Sources feature: the section below "Color by", the data selection peek with groups, subgroups, filters and per-row source details, the source controls in filters, axes and projection views, structured condition records, and per-dataset loading. Design fixed by the owner 2026-10-05; prototype done; build in progress on main |
| [O_fitness-screen-data-type__20261005](O_fitness-screen-data-type__20261005.md) | Condition-resolved fitness screens as their own data type and tab, admitted by owner decision 2026-10-05. GSE205443 shipped 2026-10-06 as nine signed fitness layers (the authors' published values, one per biofilm-assay fraction) in the Fitness family and the Fitness screen tab; open: the sweep of 28 unread GEO transposon/essentiality records |
| [O_ui-clutter-human-audit__20261005](O_ui-clutter-human-audit__20261005.md) | Prepared: 20 desktop/tablet renders and the numbered text inventory. Owner decision 2026-10-06: leave open for human keep/move/merge/remove marks, then agents apply them |
| [O_agent-topology-and-handoff__20260928](O_agent-topology-and-handoff__20260928.md) | Owner-side half of the Claude Science topology: which agent profiles to create in that account and their loadouts, and ratification of the mandatory-validation trigger list. The mechanism lives in [claude-science-handoff.md](../../validation/claude-science-handoff.md) |

## Pending Claude Science

**Owner decision, 2026-10-05: Claude Science is the default last resort.**
The owner explicitly requested the E. coli multi-omics review on 2026-10-06;
P-ECOLI-OMICS below is pending manual handoff and has not been sent.
The two older CS-1 claims need no dispatch and are researched in the repository. Package D
returned 2026-10-04 and passed intake 2026-10-06 (offload ticket); the Package B
correction's ten cells are read as not reported and Package D scored them so,
which is all the correction changed. Their rows are gone.

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

Paste-ready text for the rows that went out is in
[`docs/notes/handoff/SEND_claude-science-session__20261002.md`](../handoff/SEND_claude-science-session__20261002.md).

**All six pastes have returned and passed intake.** The manifest for pastes 1 to
4 is
[`docs/notes/handoff/RET_claude-science-session__20261003.md`](../handoff/RET_claude-science-session__20261003.md);
paste 5 ran on a read-only mount and its two files were placed in
`docs/notes/handoff/` by the owner; paste 6 (package D) returned as
[`RET_claude-science-session__20261004.md`](../handoff/RET_claude-science-session__20261004.md).

| Paste | Queue row | Sent | Returned | Intake recorded in |
| --- | --- | --- | --- | --- |
| 1 | Package B | 2026-10-02 | 2026-10-03 | [offload ticket](O_claude-science-offload__20260927.md#package-b-intake-2026-10-04); passed, data rows 31 and 70 returned for relabelling |
| 2 | Package C | 2026-10-02 | 2026-10-03 | [offload ticket](O_claude-science-offload__20260927.md#package-c-intake-2026-10-04); passed |
| 4 | Package A correction | 2026-10-02 | 2026-10-03 | [offload ticket](O_claude-science-offload__20260927.md#package-a-correction-intake-2026-10-04); passed |
| 5 | Crosswalk second check | 2026-10-02 | 2026-10-04 | [scan ticket](O_cross-strain-data-scan__20260927.md#crosswalk-second-check-result-returned-2026-10-04); passed, all four sides agree |
| 6 | Package D | by the owner | 2026-10-04 | [offload ticket](O_claude-science-offload__20260927.md#package-d-intake-2026-10-06); passed, 32 escalations already judged by the owner |

| Ticket | Id | Request | Unblocks | Sent | Returned |
| --- | --- | --- | --- | --- | --- |
| [O_ecoli-multiomics-datasets__20261006](O_ecoli-multiomics-datasets__20261006.md#p-ecoli-omics-paste-ready-claude-science-handoff) | P-ECOLI-OMICS | Owner-requested E. coli literature/archives sweep for transcriptomics, proteomics and Ribo-seq: quantify biological replication per condition, verify cross-layer sample/condition matching, retrieve shortlisted processed files and recommend matched or independent fallback sources. Pending manual handoff | Evidence for selecting and acquiring experimental E. coli data sources | | |
| [O_trna-identification-viewer__20260930](O_trna-identification-viewer__20260930.md) | CS-1 | Check whether tRNAscan-SE scores support calibrated tRNA-gene probabilities over the 45 Infernal-confirmed tRNA loci on this genome — the population is now known, not an open-ended genome-wide screen; return score semantics and calibration evidence/limits. Future probability-scoring option only; no dependency for the first-version viewer or its owner review. Planning only; not dispatched | Accurate likelihood-versus-score definition for a future scoring option | | |
| [O_rbs-calculator-gene-visualizer__20260930](O_rbs-calculator-gene-visualizer__20260930.md) | CS-1 | Check whether v1.0 translation-initiation predictions have validation applicable to UTEX 2973; return method/validation sources and limitations. Planning only; not dispatched | Biological interpretation before RBS-prediction integration | | |

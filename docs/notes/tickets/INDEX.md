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
| [O_overlap-visibility-and-base-pairs__20261009](O_overlap-visibility-and-base-pairs__20261009.md) | Make small OG marks readable with a fixed-size arrowhead proposal; use chromosome hover hints that do not shift the canvas; expose aligned partner base letters and strand direction in the gene viewers; implementation unassigned |
| [O_pca-grid-wheel-zoom__20261009](O_pca-grid-wheel-zoom__20261009.md) | Restrict PCA wheel zoom to the plotted grid; scrolling over axes and outer margins should scroll the page; implementation unassigned |
| [O_trna-viewer-tab__20261009](O_trna-viewer-tab__20261009.md) | Move the full tRNA viewer into its own application tab; preserve independent selection, evidence labels and coordinate navigation; implementation not started |
| [O_strain-fitness-dataset-selector__20261009](O_strain-fitness-dataset-selector__20261009.md) | Local Strain fitness dataset selector when no compatible dataset is already selected elsewhere; reuse an unambiguous existing selection and retain source/units/export identity; implementation not started |
| [O_strain-navigation-format__20261009](O_strain-navigation-format__20261009.md) | Order Cyanobacteria → E. coli Syn61 → E. coli; conventional E. coli dropdown MG1655 (default), MDS42, DH10B; retain collapsible/movable recoding panels; implementation not started |
| [O_syn57-visualizer-inclusion__20261009](O_syn57-visualizer-inclusion__20261009.md) | Add Syn57 from the Nyerges radical-recoding paper with explicit design/strain provenance; then replace Syn61 button with Recoded E. Coli dropdown containing Syn57 and Syn61; owner approved the ticket; implementation not started |
| [O_pichea-lab-data-integration__20261009](O_pichea-lab-data-integration__20261009.md) | Add Pichea using the lab's own data; data intake/integration await the owner's later download, with exact organism identity and source permissions to establish from the handoff |
| [A_regulatory-methods-shortlist__20261008](A_regulatory-methods-shortlist__20261008.md) | All selected methods now have sourced routes for very rough cross-organism UTEX predictions, with donor/native-coordinate distinctions, controls and limits. Owns Promoter Calculator, standalone TransTermHP, STREME, Rfam/Infernal, IntaRNA and new ViennaRNA regulatory uses; no new predictor run or layer admitted; iDOG execution hold retained |
| [O_array-expression-reader__20261007](O_array-expression-reader__20261007.md) | Array reader and the separate array platform listing for the seven raw-only PCC 7942 microarray series, split from the licence-unblocked ticket 2026-10-07; four scientific rules (channel, normalisation, dye swap, probe-to-gene) to decide before any layer ships |
| [A_add-ecoli-organism__20261005](A_add-ecoli-organism__20261005.md) | E. coli K-12 MG1655 (`GCF_000005845.2`) base view shipped 2026-10-06 behind the Cyanobacteria/E. coli selector, attributed to NCBI RefSeq, EcoCyc and Blattner 1997 by owner decision. Open: the owner's SRI notification; richer layers (UniProtKB/GO, PRECISE-1K) under the admission contract; six provisional defaults and the lab questions |
| [A_recoded-ecoli-multiomics__20261007](A_recoded-ecoli-multiomics__20261007.md) | Syn61 16 typed omics layers, 48-strain growth/5,280-well fitness, recoded UI/presets and public MDS42/DH10B references implemented; DEM-318/319 reviews accepted and all 11 findings resolved. Remaining D5-isolates exact partial genomes and D4-debug-identity assay-clone crosswalk |
| [O_biocyc-pcc-7942-data__20260930](O_biocyc-pcc-7942-data__20260930.md) | Assess BioCyc v30's `SYNEL`, the only Tier 2 curated database among the six strains, as labelled sister-strain evidence. Which assembly `SYNEL` is built on is observed, not determined; owner questions Q2 and Q5 and the source-ledger and admission decisions pending; no pull started |
| [O_biocyc-utex-2973-data__20260930](O_biocyc-utex-2973-data__20260930.md) | Assess what BioCyc v30's Tier 3 uncurated UTEX 2973 database adds beyond the pinned RefSeq annotation: inferred pathways and reactions and 1,969 predicted transcription units, plus the returned ortholog table. Owner questions Q2, Q4, and Q6 and the source-ledger decision pending; no pull started |
| [O_rbs-calculator-gene-visualizer__20260930](O_rbs-calculator-gene-visualizer__20260930.md) | Owner confirmed this is the missing-code ticket to keep reopened/open. Await more complete Salis Lab repo; rough native-UTEX scoring/related-strain context assessment authorized, with PCC 6803 prediction limitations recorded. v2.1.1 harness lacks private DNAc; v1.0 needs Python 2/NUPACK. No RBS run; validated-UTEX claims remain unresolved (CS-1) |
| [O_idog-promoter-prediction__20260930](O_idog-promoter-prediction__20260930.md) | Held open for owner review; rough transfer planning recorded for RBS/terminator components, with standalone TransTermHP separately assessable. Yeast/T7 parts do not establish a native UTEX promoter locator; CS-1 remains refuted. No iDOG execution or closure authorized |
| [O_biocyc-pcc-6301-data__20260930](O_biocyc-pcc-6301-data__20260930.md) | Assess BioCyc v30's Tier 3 uncurated PCC 6301 database as labelled sister-strain evidence; owner question Q2 and access, mapping, source-ledger, and admission decisions pending; no pull started |
| [O_folding-compute-backend__20260930](O_folding-compute-backend__20260930.md) | Bouchet available; Spinup/OOD, workspace and automated access remain open. New rough ViennaRNA/IntaRNA regulatory workloads link to the method assessment and should first test bounded local feasibility; no cluster or model run |
| [O_recoding-regulatory-site-change__20260930](O_recoding-regulatory-site-change__20260930.md) | Future regulatory-site change metric; rough transferred/model-derived candidates recorded as possible inputs, with same-model original/recoded comparisons and separate functional-effect claims. Priority, metric definition and coverage remain open; no implementation or metric-package dispatch |
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
| [O_rbs-calculator-gene-visualizer__20260930](O_rbs-calculator-gene-visualizer__20260930.md) | CS-1 | Check whether v1.0 translation-initiation predictions have validation applicable to UTEX 2973; direct source review records PCC 6803 limitations, not UTEX validation. Not dispatched | Any validated-UTEX claim; does not block owner-authorized rough candidate assessment | | |

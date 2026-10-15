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
| [O_pichea-lab-data-integration__20261009](O_pichea-lab-data-integration__20261009.md) | Add Pichea using the lab's own data; data intake/integration await the owner's later download, with exact organism identity and source permissions to establish from the handoff |
| [O_yfr1-transcript-interaction-evidence__20261014](O_yfr1-transcript-interaction-evidence__20261014.md) | I-SCI-1 remains open: establish full native Yfr1 transcript boundaries and target evidence before any such claim; separate from the admitted RF01116 family interval |
| [A_add-ecoli-organism__20261005](A_add-ecoli-organism__20261005.md) | MG1655 view shipped; show/flag selenoproteins, review newest CDS and publication evidence, and review CAI membership evidence while retaining current membership. Additional E. coli source choices remain open; SRI notification was sent 2026-10-07 |
| [A_recoded-ecoli-multiomics__20261007](A_recoded-ecoli-multiomics__20261007.md) | Syn61 16 typed omics layers, 48-strain growth/5,280-well fitness, recoded UI/presets and public MDS42/DH10B references implemented; DEM-318/319 reviews accepted and all 11 findings resolved. Remaining D5-isolates exact partial genomes and D4-debug-identity assay-clone crosswalk |
| [O_biocyc-ortholog-annotations__20261014](O_biocyc-ortholog-annotations__20261014.md) | Consolidated BioCyc/ortholog scope: include UTEX predictions first, PCC 7942 second and E. coli only for gaps; disclose disagreements. Proposed PCC 6311/7943/UTEX 3055 scopes dropped; access, assembly and admission checks remain |
| [O_rbs-calculator-gene-visualizer__20260930](O_rbs-calculator-gene-visualizer__20260930.md) | Owner confirmed this is the missing-code ticket to keep reopened/open. Await more complete Salis Lab repo; rough native-UTEX scoring/related-strain context assessment authorized, with PCC 6803 prediction limitations recorded. v2.1.1 harness lacks private DNAc; v1.0 needs Python 2/NUPACK. No RBS run; validated-UTEX claims remain unresolved (CS-1) |
| [O_idog-promoter-prediction__20260930](O_idog-promoter-prediction__20260930.md) | Owner review hold released 2026-10-14: investigate a new promoter locator around iDOG, not promoter design. Public code has no locator; bytecode-only source gaps and CS-1 absence finding remain explicit |
| [O_folding-compute-backend__20260930](O_folding-compute-backend__20260930.md) | RNA folding/accessibility/mRNA secondary structure first; assess active-scheme versus original structure changes. Bouchet available; workload scale, service policy, workspace/route and remote deployment choices remain |
| [O_recoding-regulatory-site-change__20260930](O_recoding-regulatory-site-change__20260930.md) | Per-gene changed/added sites under active scheme versus original; no-data/not-evaluated differs from zero. Owner scope and missingness settled; concrete admitted intervals and comparison/count contracts remain |
| [O_cross-strain-data-scan__20260927](O_cross-strain-data-scan__20260927.md) | Shared CDS/reference work shipped; add general annotation search/open for noncoding genes and pseudogenes outside CDS-only metrics/recoding; distinguish hypothetical functions and keep native PCA. Further source admission retains its own scope |
| [O_gated-pages-and-accounts__20261005](O_gated-pages-and-accounts__20261005.md) | Sources refused by a CAPTCHA, a script-rendered page, metering, or a missing account: which a browser render solves, which need an email for terms, and BioCyc, where the owner signs in to their own account in an opened browser and an agent reads the wanted pages with the owner present |
| [O_depositor-condition-correspondence__20261007](O_depositor-condition-correspondence__20261007.md) | Owner/labmate sends prepared queries; remaining unknowns/conflicts are accepted outcomes and replies do not block the completed engineering/recovery scopes |
| [A_raw-read-pilot-execution__20261007](A_raw-read-pilot-execution__20261007.md) | Active non-release execution of the pinned GSE122841 four-library raw-read pilot; preparation and eight-file input verification are complete, but full pipeline outputs remain in progress |
| [O_data-sources-selection__20261005](O_data-sources-selection__20261005.md) | Existing selection/agreement UI shipped; additional admission remains. PXD036717 enrichment and PXD044412 interaction approved as separate evidence types; new readers and aggregation contracts needed |
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

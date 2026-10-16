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
| [A_add-ecoli-organism__20261005](A_add-ecoli-organism__20261005.md) | MG1655 view shipped; show/flag selenoproteins, review newest CDS and publication evidence, and CAI primary-source review recorded with current membership retained. Additional E. coli source choices remain open; SRI notification was sent 2026-10-07 |
| [A_recoded-ecoli-multiomics__20261007](A_recoded-ecoli-multiomics__20261007.md) | Syn61 16 typed omics layers, 48-strain growth/5,280-well fitness, recoded UI/presets and public MDS42/DH10B references implemented; DEM-318/319 reviews accepted and all 11 findings resolved. Remaining D5-isolates exact partial genomes and D4-debug-identity assay-clone crosswalk |
| [O_biocyc-ortholog-annotations__20261014](O_biocyc-ortholog-annotations__20261014.md) | Consolidated BioCyc/ortholog scope: include UTEX predictions first, PCC 7942 second and E. coli only for gaps; disclose disagreements. Proposed PCC 6311/7943/UTEX 3055 scopes dropped; access, assembly and admission checks remain |
| [O_rbs-calculator-gene-visualizer__20260930](O_rbs-calculator-gene-visualizer__20260930.md) | Owner confirmed this is the missing-code ticket to keep reopened/open. Await more complete Salis Lab repo; rough native-UTEX scoring/related-strain context assessment authorized, with PCC 6803 prediction limitations recorded. v2.1.1 harness lacks private DNAc; v1.0 needs Python 2/NUPACK. No RBS run; validated-UTEX claims remain unresolved (CS-1) |
| [O_folding-compute-backend__20260930](O_folding-compute-backend__20260930.md) | RNA folding/accessibility/mRNA secondary structure first; local original/recoded base-pair comparison shipped. Bouchet available; workload scale, service policy, workspace/route and remote deployment choices remain |
| [O_recoding-regulatory-site-change__20260930](O_recoding-regulatory-site-change__20260930.md) | TSS sequence-edit counts, coloring, viewers and exports implemented; new-promoter predictions and other site calculations remain. Owner scope/missingness settled; further admitted intervals and model comparisons required |
| [O_gene-viewer-upstream-context-overlap-proteins__20261016](O_gene-viewer-upstream-context-overlap-proteins__20261016.md) | Gene viewers: left arrow for known further-upstream TSS/regulatory sites not shown; annotated upstream-context genes drawn with coding DNA and protein like OG partners; OG partners also show encoded protein with original/recoded provenance. Requirements recorded, nothing implemented |
| [O_unknown-function-status__20261015](O_unknown-function-status__20261015.md) | Extend the D10 unknown-function label to DUF/UPF products (124 to 230 unlabelled per organism) a three-state Jev-assisted function status with filter and export (owner decisions recorded 2026-10-15); Jev labels committed, not regenerated per release |
| [O_cross-strain-data-scan__20260927](O_cross-strain-data-scan__20260927.md) | Shared CDS/reference work shipped; annotation search/open for genes outside the CDS set and unknown-function labels shipped 2026-10-14 (D10); native PCA kept. Further source admission retains its own scope |
| [O_gated-pages-and-accounts__20261005](O_gated-pages-and-accounts__20261005.md) | Audit current 2026-10-16: owner confirms BioCyc Yale/Keychain access, no new login requested; cyano-regulatory-sites owns UTEX/SYNEL entitlement verification. Other account/render/email requests retired or reassigned |
| [O_depositor-condition-correspondence__20261007](O_depositor-condition-correspondence__20261007.md) | Owner/labmate sends prepared queries; remaining unknowns/conflicts are accepted outcomes and replies do not block the completed engineering/recovery scopes |
| [A_raw-read-pilot-execution__20261007](A_raw-read-pilot-execution__20261007.md) | Active non-release execution of the pinned GSE122841 four-library raw-read pilot; preparation and eight-file input verification are complete, but full pipeline outputs remain in progress |
| [A_pxd036717-admission-checks__20261016](A_pxd036717-admission-checks__20261016.md) | cyano-lit-unreach: isolated identification evidence and condition metadata checks; browser release remains in parent |
| [O_data-sources-selection__20261005](O_data-sources-selection__20261005.md) | Existing selection/agreement UI shipped; PXD036717 reconstruction, mapping, identification evidence and condition records implemented; flagged-measurement release approved, detection UI and browser admission open; PXD044412 reader/aggregation separately owned |
| [O_ui-clutter-human-audit__20261005](O_ui-clutter-human-audit__20261005.md) | Prepared 20 renders/text inventory; owner will enter keep/move/merge/remove marks on this ticket itself; leave open and hold implementation |
| [O_tab-navigation-layout__20261016](O_tab-navigation-layout__20261016.md) | Owner asked for fewer rows of view tabs with every view kept; 4 options and a provisional recommendation (map-space selector plus short tabs) await owner review when work starts; nothing implemented or scheduled |

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

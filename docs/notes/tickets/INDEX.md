# Ticket Index

Live queue of open and active tickets only. Resolved tickets are deleted and
their reusable guidance distilled into `docs/validation/`.

| Ticket | Scope |
| --- | --- |
| [O_trna-identification-viewer__20260930](O_trna-identification-viewer__20260930.md) | Assess UTEX GtRNAdb/tRNAscan-SE evidence and tRNA identification filter/coloring, reusing completed tRNA validation; future sister-strain/local-run options and questions recorded; probability interpretation depends on CS-1; not started |
| [O_folding-compute-backend__20260930](O_folding-compute-backend__20260930.md) | Assess future RNA/protein folding backend on Yale Bouchet, with lab Mac mini and owner Jetson Orin Nano fallbacks; access, workloads, routing, and architecture questions recorded; not started |
| [O_regulatory-site-viewer-layers__20260930](O_regulatory-site-viewer-layers__20260930.md) | Audit mapped Tan 2018 gene-view markers; support future initiation/termination/regulatory markers and chromosome site-type toggles, preserving source and coordinate semantics; not started |
| [O_pinned-gene-sequence-viewer__20260930](O_pinned-gene-sequence-viewer__20260930.md) | Larger pinned-gene visualizer within the Chromosome tab showing actual bases, codons, and encoded amino acids; layout/navigation questions and sequence-integrity dependencies recorded; not started |
| [O_rbs-calculator-gene-visualizer__20260930](O_rbs-calculator-gene-visualizer__20260930.md) | Assess RBS Calculator v1.0 for RBS predictions and gene-visualizer display, including input/annotation gaps; scientific interpretation depends on CS-1; not started |
| [O_idog-promoter-prediction__20260930](O_idog-promoter-prediction__20260930.md) | Future Mythos 5.1 / Fable 5.1 assessment of iDOG for UTEX promoter prediction and gene-visualizer use, including required data/annotation improvements; adoption depends on CS-1; not dispatched |
| [O_biocyc-utex-2973-data__20260930](O_biocyc-utex-2973-data__20260930.md) | Assess useful UTEX 2973 BioCyc data, access/reuse terms, and integration priorities; questions and dependencies recorded; no pull started |
| [O_biocyc-pcc-6301-data__20260930](O_biocyc-pcc-6301-data__20260930.md) | Assess and plan BioCyc data pulls for PCC 6301 as labelled sister-strain evidence; depends on applicable access, mapping, and admission checks; no pull started |
| [O_biocyc-pcc-6311-data__20260930](O_biocyc-pcc-6311-data__20260930.md) | Assess and plan BioCyc data pulls for PCC 6311 as labelled sister-strain evidence; depends on applicable access, mapping, and admission checks; no pull started |
| [O_biocyc-pcc-7942-data__20260930](O_biocyc-pcc-7942-data__20260930.md) | Assess and plan BioCyc data pulls for PCC 7942 as labelled sister-strain evidence; depends on applicable access, mapping, and admission checks; no pull started |
| [O_biocyc-pcc-7943-data__20260930](O_biocyc-pcc-7943-data__20260930.md) | Assess and plan BioCyc data pulls for PCC 7943 as labelled sister-strain evidence; depends on applicable access, mapping, and admission checks; no pull started |
| [O_biocyc-utex-3055-data__20260930](O_biocyc-utex-3055-data__20260930.md) | Assess and plan BioCyc data pulls for UTEX 3055 as labelled sister-strain evidence; depends on applicable access, mapping, and admission checks; no pull started |
| [O_recoding-regulatory-site-change__20260930](O_recoding-regulatory-site-change__20260930.md) | Future coloring metric for regulatory-site DNA changes under recoding; depends on site-type research, sufficient admitted data, and owner decisions recorded as clarifying questions. Idea only; implementation and research dispatch not started |
| [O_cross-strain-data-scan__20260927](O_cross-strain-data-scan__20260927.md) | Build the PCC 6311/7943 crosswalk; scan literature and repositories for sister-strain annotation, transcriptomics, proteomics, ribosome-occupancy, TIS, TSS, and TTS data; apply the condition-comparability thresholds; extend the shipped gene viewer; design the chromosome visualizer as its own tab and the dataset selectors |
| [O_claude-science-offload__20260927](O_claude-science-offload__20260927.md) | Decide which cross-strain scan work is handed to Claude Science; fix the handoff specification, per-candidate return format, and the evidence-not-admission boundary; confirm its interface, literature access, and file retrieval before dispatch |
| [O_claude-science-data-use-audit__20260928](O_claude-science-data-use-audit__20260928.md) | Commission a Claude Science audit of how the shipped data is already used, derived, and interpolated: meaning drift against each source, disallowed fills, denominator and scale errors, prose overstatement, and drift between the code and the validation documents |
| [O_agent-topology-and-handoff__20260928](O_agent-topology-and-handoff__20260928.md) | Owner-side half of the Claude Science topology: which agent profiles to create in that account and their loadouts, and ratification of the mandatory-validation trigger list. The mechanism lives in [claude-science-handoff.md](../../validation/claude-science-handoff.md) |
| [O_progressive-site-loading__20260929](O_progressive-site-loading__20260929.md) | Replace the blank loading page with a shell present from first paint, a determinate loading-bar overlay, and data fetched in priority tiers; eight further suggestions await the owner's approval. **Not started by owner instruction** |
| [O_standout-visual-channel__20260930](O_standout-visual-channel__20260930.md) | Decide whether standout TSS initiation and expression genes get a second visual mark on the zoomed-out chromosome view, beyond paint order; was decision D4 of the visual priority ticket, deferred on the inspector's render. Four questions for the owner. **Not started** |

## Pending Claude Science

Items the owner takes to the next Claude Science session, per
[claude-science-handoff.md](../../validation/claude-science-handoff.md). Agents add a
row when they add a claim or a dispatchable package and remove it when the result
is pasted into the ticket and intake passes.

**A session returned 2026-09-28.** Its manifest, findings, and the ordered list of
what to pick up next are in
[`docs/notes/handoff/RET_claude-science-session__20260928.md`](../handoff/RET_claude-science-session__20260928.md).
Read that before starting any row below.

| Ticket | Id | Request | Unblocks | Sent | Returned |
| --- | --- | --- | --- | --- | --- |
| [O_trna-identification-viewer__20260930](O_trna-identification-viewer__20260930.md) | CS-1 | Check whether tRNAscan-SE scores support calibrated tRNA-gene probabilities for the selected feature population; return score semantics and calibration evidence/limits. Planning only; not dispatched | Accurate likelihood-versus-score definition for filtering/coloring | | |
| [O_rbs-calculator-gene-visualizer__20260930](O_rbs-calculator-gene-visualizer__20260930.md) | CS-1 | Check whether v1.0 translation-initiation predictions have validation applicable to UTEX 2973; return method/validation sources and limitations. Planning only; not dispatched | Biological interpretation before RBS-prediction integration | | |
| [O_idog-promoter-prediction__20260930](O_idog-promoter-prediction__20260930.md) | CS-1 | Verify whether iDOG's implemented method supports promoter-location prediction applicable to UTEX 2973; return code/method and biological validation evidence. Future assessment; not dispatched | Scientific applicability decision before any promoter-prediction integration | | |
| [O_claude-science-offload__20260927](O_claude-science-offload__20260927.md) | Package A correction | Reclassify GSE106824 as `rejected: ChIP-seq is not an admitted data type`; all 12 of its samples are `library_strategy = ChIP-Seq`. Found at intake 2026-09-28, see [Package A intake](O_claude-science-offload__20260927.md#package-a-intake-2026-09-28) | Nothing; the row is treated as rejected until corrected | | |
| [O_claude-science-offload__20260927](O_claude-science-offload__20260927.md) | Package B | Condition metadata per candidate study from A, one value per comparability axis with its source location. **Now scoped:** ~45 papers, since repository metadata states conditions for almost none of the returned rows | Scan ticket step 3 pair scoring | | |
| [O_claude-science-offload__20260927](O_claude-science-offload__20260927.md) | Package D | Candidate pair comparability against the documented thresholds, using B | Scan ticket step 3 verdicts and rows 13 to 15 escalations | | |
| [O_claude-science-offload__20260927](O_claude-science-offload__20260927.md) | Package C | Licence and redistribution terms per artifact. **No longer held**: per-file legends come from Europe PMC `fullTextXML`, confirmed 2026-09-28 on the Adomako Data Set S1 case. The residual gap is an artifact that is neither PMC-deposited nor repository-hosted, where the row returns that fact rather than a guess | Source-ledger licence decisions, then any download | | |
| [O_cross-strain-data-scan__20260927](O_cross-strain-data-scan__20260927.md) | Crosswalk second check | Re-derive the PCC 6311 and PCC 7943 exact shared-protein crosswalk counts independently from the pinned releases (`GCF_022984265.1-RS_2025_12_23`, `GCF_022984345.1-RS_2025_12_23`, UTEX `GCF_000817325.1-RS_2026_05_13`) without reading `tools/`; report agreement with matched/unmatched/ambiguous = 2,663/52/8 and 2,636/79/8 on the UTEX side, or name the disagreeing loci. Read-only mount; per [second-checking](../../validation/claude-science-handoff.md#second-checking-not-just-fetching) | Admission of any PCC 6311 or PCC 7943 source | | |
| [O_claude-science-data-use-audit__20260928](O_claude-science-data-use-audit__20260928.md) | Audit | Semantic audit of how shipped data is used, derived, and described; findings only | Triage of findings into fixes, tickets, rejections, or lab escalations | | |

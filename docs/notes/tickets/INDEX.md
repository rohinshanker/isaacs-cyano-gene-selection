# Ticket Index

Live queue of open and active tickets only. Resolved tickets are deleted and
their reusable guidance distilled into `docs/validation/`.

| Ticket | Scope |
| --- | --- |
| [O_add-ecoli-organism__20261005](O_add-ecoli-organism__20261005.md) | Preliminary E. coli fallback organism view with a top-level Cyanobacteria/E. coli selector, cyano default; six questions cover strain, features, evidence, comparisons, and saved state |
| [O_regulatory-site-viewer-layers__20260930](O_regulatory-site-viewer-layers__20260930.md) | D1 done 2026-10-02: all 2,432 mapped Tan 2018 sites draw in the gene view, pinned by a test over the shipped data. Remaining: future initiation/termination/regulatory markers and chromosome site-type toggles, preserving source and coordinate semantics; owner questions 1 to 8 unanswered |
| [O_trna-identification-viewer__20260930](O_trna-identification-viewer__20260930.md) | Assess UTEX GtRNAdb/tRNAscan-SE evidence and tRNA identification filter/coloring, reusing completed tRNA validation. D1 answered 2026-09-30: GtRNAdb is the same tool on the same assembly and adds no locus, and its terms remain undetermined. What is left is CS-1 (score semantics, pending) and the UI decision over the 45 known loci; owner question Q3 unanswered |
| [O_biocyc-pcc-7942-data__20260930](O_biocyc-pcc-7942-data__20260930.md) | Assess BioCyc v30's `SYNEL`, the only Tier 2 curated database among the six strains, as labelled sister-strain evidence. Which assembly `SYNEL` is built on is observed, not determined; owner questions Q2 and Q5 and the source-ledger and admission decisions pending; no pull started |
| [O_biocyc-utex-2973-data__20260930](O_biocyc-utex-2973-data__20260930.md) | Assess what BioCyc v30's Tier 3 uncurated UTEX 2973 database adds beyond the pinned RefSeq annotation: inferred pathways and reactions and 1,969 predicted transcription units, plus the returned ortholog table. Owner questions Q2, Q4, and Q6 and the source-ledger decision pending; no pull started |
| [O_rbs-calculator-gene-visualizer__20260930](O_rbs-calculator-gene-visualizer__20260930.md) | Assess RBS Calculator v1.0 for RBS predictions and gene-visualizer display. Code and terms now established: GPL v3.0, Python 2, an unbundled separately licensed NuPACK, and an *E. coli* anti-Shine-Dalgarno default. Scientific interpretation depends on CS-1 (pending); owner question Q7 unanswered |
| [O_idog-promoter-prediction__20260930](O_idog-promoter-prediction__20260930.md) | Future Mythos 5.1 / Fable 5.1 assessment of iDOG for UTEX promoter work. CS-1 refuted 2026-09-30 as to promoter-location prediction; the operon designer and 48-promoter design library are now recorded. Held open by owner direction pending their own code and literature review — not to be closed, resolved, or run through Cleanup |
| [O_biocyc-pcc-6301-data__20260930](O_biocyc-pcc-6301-data__20260930.md) | Assess BioCyc v30's Tier 3 uncurated PCC 6301 database as labelled sister-strain evidence; owner question Q2 and access, mapping, source-ledger, and admission decisions pending; no pull started |
| [O_folding-compute-backend__20260930](O_folding-compute-backend__20260930.md) | Assess future RNA/protein folding backend on Yale Bouchet, with lab Mac mini and owner Jetson Orin Nano fallbacks. D1 (Bouchet access) is not yet held, so no workload/host matrix is measurable; an x86-only bundled TransTermHP makes each device's architecture a gating D2 answer; owner question Q8 unanswered |
| [O_recoding-regulatory-site-change__20260930](O_recoding-regulatory-site-change__20260930.md) | Future coloring metric for regulatory-site DNA changes under recoding. Its D1 research package is fully specified and one owner answer away from dispatchable — clarifying question 1, which site types come first. Implementation and dispatch not started |
| [O_biocyc-pcc-6311-data__20260930](O_biocyc-pcc-6311-data__20260930.md) | BioCyc v30 has no PCC 6311 database. Kept open pending owner questions Q1 and Q2 on whether the strain has a comparative use and what ticket shape to keep; no pull started |
| [O_biocyc-pcc-7943-data__20260930](O_biocyc-pcc-7943-data__20260930.md) | BioCyc v30 has no PCC 7943 database. Kept open pending owner questions Q1 and Q2 on whether the strain has a comparative use and what ticket shape to keep; no pull started |
| [O_biocyc-utex-3055-data__20260930](O_biocyc-utex-3055-data__20260930.md) | BioCyc v30 has no UTEX 3055 database. Kept open pending owner questions Q1 and Q2, including whether its greater divergence is useful as an outgroup; no pull started |
| [O_cross-strain-data-scan__20260927](O_cross-strain-data-scan__20260927.md) | Package B's condition metadata is in; the crosswalk second check returned 2026-10-04 and agrees on every count, lifting the hold on PCC 6311/7943 sources (none exists yet). Pair scoring waits on package D; extend the gene viewer with sister-strain overlays (gated on data that is not admitted) and flanking-neighbour context; design the dataset and condition selectors |
| [O_claude-science-offload__20260927](O_claude-science-offload__20260927.md) | Hand the cross-strain sweep to Claude Science as packages A to D under a fixed return format and the evidence-not-admission boundary. A (corrected), B, and C have returned and passed intake 2026-10-04, B with two rows returned for relabelling; licence decisions are in the source ledger; D is the one package still to send |
| [O_claude-science-data-use-audit__20260928](O_claude-science-data-use-audit__20260928.md) | The audit returned 10 findings 2026-10-03, all verified and triaged 2026-10-04: two fixed in documents, eight ticketed below, A-02 also escalated to the lab as row 8 evidence. Stays open until the ticketed fixes close and the reusable checklist is distilled |
| [O_data-use-audit-fixes__20261004](O_data-use-audit-fixes__20261004.md) | The eight code fixes accepted from the data-use audit, one change per finding: mark clamped z-scores in the comparison views, label the gene-view versus chromosome-view TSS placement divergence, gate the length histogram's range wording, and remove five latent null-to-zero coercions; items 1 to 3 need rendered validation |
| [O_agent-topology-and-handoff__20260928](O_agent-topology-and-handoff__20260928.md) | Owner-side half of the Claude Science topology: which agent profiles to create in that account and their loadouts, and ratification of the mandatory-validation trigger list. The mechanism lives in [claude-science-handoff.md](../../validation/claude-science-handoff.md) |

## Pending Claude Science

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

Paste-ready text for the rows that can go out now is in
[`docs/notes/handoff/SEND_claude-science-session__20261002.md`](../handoff/SEND_claude-science-session__20261002.md).

**Five of its six pastes have returned and passed intake 2026-10-04.** The
manifest for pastes 1 to 4 is
[`docs/notes/handoff/RET_claude-science-session__20261003.md`](../handoff/RET_claude-science-session__20261003.md);
paste 5 ran on a read-only mount and its two files were placed in
`docs/notes/handoff/` by the owner. Paste 6 (package D) has not been sent.

| Paste | Queue row | Sent | Returned | Intake recorded in |
| --- | --- | --- | --- | --- |
| 1 | Package B | 2026-10-02 | 2026-10-03 | [offload ticket](O_claude-science-offload__20260927.md#package-b-intake-2026-10-04); passed, data rows 31 and 70 returned for relabelling |
| 2 | Package C | 2026-10-02 | 2026-10-03 | [offload ticket](O_claude-science-offload__20260927.md#package-c-intake-2026-10-04); passed |
| 3 | Audit | 2026-10-02 | 2026-10-03 | [audit ticket](O_claude-science-data-use-audit__20260928.md#intake-check-2026-10-04); passed, all 10 findings triaged |
| 4 | Package A correction | 2026-10-02 | 2026-10-03 | [offload ticket](O_claude-science-offload__20260927.md#package-a-correction-intake-2026-10-04); passed |
| 5 | Crosswalk second check | 2026-10-02 | 2026-10-04 | [scan ticket](O_cross-strain-data-scan__20260927.md#crosswalk-second-check-result-returned-2026-10-04); passed, all four sides agree |

| Ticket | Id | Request | Unblocks | Sent | Returned |
| --- | --- | --- | --- | --- | --- |
| [O_trna-identification-viewer__20260930](O_trna-identification-viewer__20260930.md) | CS-1 | Check whether tRNAscan-SE scores support calibrated tRNA-gene probabilities over the 45 Infernal-confirmed tRNA loci on this genome — the population is now known, not an open-ended genome-wide screen; return score semantics and calibration evidence/limits. Planning only; not dispatched | Accurate likelihood-versus-score definition for filtering/coloring | | |
| [O_rbs-calculator-gene-visualizer__20260930](O_rbs-calculator-gene-visualizer__20260930.md) | CS-1 | Check whether v1.0 translation-initiation predictions have validation applicable to UTEX 2973; return method/validation sources and limitations. Planning only; not dispatched | Biological interpretation before RBS-prediction integration | | |
| [O_claude-science-offload__20260927](O_claude-science-offload__20260927.md) | Package D | Candidate pair comparability against the documented thresholds, using the accepted package B table `docs/notes/handoff/cyano_package_B_conditions_20261003.tsv` (SHA-256 `fa65266c…`, accepted 2026-10-04) in place of `<PACKAGE_B_TABLE>` in paste 6. Score the five GSE103606 SubSeries, not the SuperSeries; treat the `not retrieved` cells of data rows 31 and 70 as not reported | Scan ticket step 3 verdicts and rows 13 to 15 escalations | | |
| [O_claude-science-offload__20260927](O_claude-science-offload__20260927.md) | Package B correction | Relabel as `not reported` the `not retrieved` cells of data rows 31 (GSE225426: `co2`, `culture_format`, `growth_phase`) and 70 (PXD023591: seven axes), per the return's own rule in B.3.4 that a deposit with no publication reports what it omits as not reported. Optional, the owner's call: package A data row 54 lists `GCF_000817325.1` as a PCC 6301 annotation; it is the UTEX 2973 genome of record (NCBI taxid 1350461), already rejected as data row 51, and is treated as rejected here. See [Package B intake](O_claude-science-offload__20260927.md#package-b-intake-2026-10-04) | Nothing; the ten cells are read as not reported either way and paste 6 does not wait on this | | |

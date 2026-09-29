# Ticket Index

Live queue of open and active tickets only. Resolved tickets are deleted and
their reusable guidance distilled into `docs/validation/`.

| Ticket | Scope |
| --- | --- |
| [O_cross-strain-data-scan__20260927](O_cross-strain-data-scan__20260927.md) | Build the PCC 6311/7943 crosswalk; scan literature and repositories for sister-strain annotation, transcriptomics, proteomics, ribosome-occupancy, TIS, TSS, and TTS data; apply the condition-comparability thresholds; extend the shipped gene viewer; design the chromosome visualizer as its own tab and the dataset selectors |
| [O_claude-science-offload__20260927](O_claude-science-offload__20260927.md) | Decide which cross-strain scan work is handed to Claude Science; fix the handoff specification, per-candidate return format, and the evidence-not-admission boundary; confirm its interface, literature access, and file retrieval before dispatch |
| [O_claude-science-data-use-audit__20260928](O_claude-science-data-use-audit__20260928.md) | Commission a Claude Science audit of how the shipped data is already used, derived, and interpolated: meaning drift against each source, disallowed fills, denominator and scale errors, prose overstatement, and drift between the code and the validation documents |
| [O_agent-topology-and-handoff__20260928](O_agent-topology-and-handoff__20260928.md) | Owner-side half of the Claude Science topology: which agent profiles to create in that account and their loadouts, and ratification of the mandatory-validation trigger list. The mechanism lives in [claude-science-handoff.md](../../validation/claude-science-handoff.md) |
| [O_progressive-site-loading__20260929](O_progressive-site-loading__20260929.md) | Replace the blank loading page with a shell present from first paint, a determinate loading-bar overlay, and data fetched in priority tiers; eight further suggestions await the owner's approval. **Not started by owner instruction** |
| [O_zoomed-out-visual-priority__20260929](O_zoomed-out-visual-priority__20260929.md) | Draw the informative marks on top when genes share pixels: categorised over uncategorised and no white gaps on the zoomed-out chromosome view, standout high values over low ones for TSS initiation and expression, and the same ordering on the scatter maps. Four display decisions await the owner. **Not started** |
| [O_colour-scale-and-map-toolbar__20260929](O_colour-scale-and-map-toolbar__20260929.md) | Add a selectable colour Scale, default the most skewed strictly positive metrics (TSS initiation, expression) to logarithmic, and reorder the map toolbar: Colour by with Scale, then the colour explanation, then Find a gene alone on its row. Goes before the visual-priority ticket. Three questions, including which extra scales, are asked when it becomes active. **Not started** |

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
| [O_claude-science-offload__20260927](O_claude-science-offload__20260927.md) | Package A correction | Reclassify GSE106824 as `rejected: ChIP-seq is not an admitted data type`; all 12 of its samples are `library_strategy = ChIP-Seq`. Found at intake 2026-09-28, see [Package A intake](O_claude-science-offload__20260927.md#package-a-intake-2026-09-28) | Nothing; the row is treated as rejected until corrected | | |
| [O_claude-science-offload__20260927](O_claude-science-offload__20260927.md) | Package B | Condition metadata per candidate study from A, one value per comparability axis with its source location. **Now scoped:** ~45 papers, since repository metadata states conditions for almost none of the returned rows | Scan ticket step 3 pair scoring | | |
| [O_claude-science-offload__20260927](O_claude-science-offload__20260927.md) | Package D | Candidate pair comparability against the documented thresholds, using B | Scan ticket step 3 verdicts and rows 13 to 15 escalations | | |
| [O_claude-science-offload__20260927](O_claude-science-offload__20260927.md) | Package C | Licence and redistribution terms per artifact. **No longer held**: per-file legends come from Europe PMC `fullTextXML`, confirmed 2026-09-28 on the Adomako Data Set S1 case. The residual gap is an artifact that is neither PMC-deposited nor repository-hosted, where the row returns that fact rather than a guess | Source-ledger licence decisions, then any download | | |
| [O_cross-strain-data-scan__20260927](O_cross-strain-data-scan__20260927.md) | Crosswalk second check | Re-derive the PCC 6311 and PCC 7943 exact shared-protein crosswalk counts independently from the pinned releases (`GCF_022984265.1-RS_2025_12_23`, `GCF_022984345.1-RS_2025_12_23`, UTEX `GCF_000817325.1-RS_2026_05_13`) without reading `tools/`; report agreement with matched/unmatched/ambiguous = 2,663/52/8 and 2,636/79/8 on the UTEX side, or name the disagreeing loci. Read-only mount; per [second-checking](../../validation/claude-science-handoff.md#second-checking-not-just-fetching) | Admission of any PCC 6311 or PCC 7943 source | | |
| [O_claude-science-data-use-audit__20260928](O_claude-science-data-use-audit__20260928.md) | Audit | Semantic audit of how shipped data is used, derived, and described; findings only | Triage of findings into fixes, tickets, rejections, or lab escalations | | |

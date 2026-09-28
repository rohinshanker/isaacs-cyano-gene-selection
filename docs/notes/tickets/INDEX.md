# Ticket Index

Live queue of open and active tickets only. Resolved tickets are deleted and
their reusable guidance distilled into `docs/validation/`.

| Ticket | Scope |
| --- | --- |
| [O_cross-strain-data-scan__20260927](O_cross-strain-data-scan__20260927.md) | Build the PCC 6311/7943 crosswalk; scan literature and repositories for sister-strain annotation, transcriptomics, proteomics, ribosome-occupancy, TIS, TSS, and TTS data; apply the condition-comparability thresholds; extend the shipped gene viewer; design the chromosome visualizer as its own tab and the dataset selectors |
| [O_claude-science-offload__20260927](O_claude-science-offload__20260927.md) | Decide which cross-strain scan work is handed to Claude Science; fix the handoff specification, per-candidate return format, and the evidence-not-admission boundary; confirm its interface, literature access, and file retrieval before dispatch |
| [O_claude-science-data-use-audit__20260928](O_claude-science-data-use-audit__20260928.md) | Commission a Claude Science audit of how the shipped data is already used, derived, and interpolated: meaning drift against each source, disallowed fills, denominator and scale errors, prose overstatement, and drift between the code and the validation documents |
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

| Ticket | Id | Request | Unblocks | Sent | Returned |
| --- | --- | --- | --- | --- | --- |
| [O_claude-science-offload__20260927](O_claude-science-offload__20260927.md) | Package A | Systematic sweep per data type across the six strains | Scan ticket step 2 candidate table | 2026-09-28 | **2026-09-28** — 74 rows in [`cyano_package_A_candidates_20260928.tsv`](../handoff/cyano_package_A_candidates_20260928.tsv); awaiting intake. Ribo-seq, TIS, TSS, and TTS returned zero new candidates across all six strains |
| [O_claude-science-offload__20260927](O_claude-science-offload__20260927.md) | Package B | Condition metadata per candidate study from A, one value per comparability axis with its source location. **Now scoped:** ~45 papers, since repository metadata states conditions for almost none of the returned rows | Scan ticket step 3 pair scoring | | |
| [O_claude-science-offload__20260927](O_claude-science-offload__20260927.md) | Package D | Candidate pair comparability against the documented thresholds, using B | Scan ticket step 3 verdicts and rows 13 to 15 escalations | | |
| [O_claude-science-offload__20260927](O_claude-science-offload__20260927.md) | Package C | Licence and redistribution terms per artifact. **No longer held**: per-file legends come from Europe PMC `fullTextXML`, confirmed 2026-09-28 on the Adomako Data Set S1 case. The residual gap is an artifact that is neither PMC-deposited nor repository-hosted, where the row returns that fact rather than a guess | Source-ledger licence decisions, then any download | | |
| [O_claude-science-data-use-audit__20260928](O_claude-science-data-use-audit__20260928.md) | Audit | Semantic audit of how shipped data is used, derived, and described; findings only | Triage of findings into fixes, tickets, rejections, or lab escalations | | |

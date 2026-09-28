# HANDOFF_coordinator__20260928 — Coordinator handoff

**Read this first when picking the repository up after 2026-09-28.** It records
where every stream stood when the coordinating session (agent-deck
`cyano-claude-science`, Claude Fable) stopped, and the exact next action for each.
The mechanism for Claude Science work is
[claude-science-handoff.md](../../validation/claude-science-handoff.md); the live
queue is [tickets/INDEX.md](../tickets/INDEX.md). This file is a manifest, not a
contract, and is deleted once every item below is either on `main` or in a ticket.

```
written:   2026-09-28, ~18:15 UTC
main:      see "State of main" below for the last commit this file knows about
multica:   profile desktop-api.multica.ai, project 6a5e584f-7475-4a16-b6fc-1099f84bc9f9
```

## State of main

Everything below is committed on `main` and gates were green at each commit
(`npm test`, `.venv/bin/python -m pytest -q`, `tools/validate_contract.py`):

| Commit | What |
| --- | --- |
| `9facce6` | Claude Science handoff contract, `AGENTS.md`, session return manifest, package A candidate table |
| `8f9c33e` | Package A intake: all 74 accessions resolve; GSE106824 returned for reclassification |
| `f4e7458` | 57-row candidate register in the roadmap; rejected rows and step 4/5 reframing in the scan ticket |
| `9a68277` | Topology review answers; trigger list amended to five (owner ratification pending) |
| `0dc8351` | Release identifiers corrected to `RS_2025_12_23` |
| `fcd7e7b`, `ea8bc65`, `3c54dd2` | **PCC 6311 / PCC 7943 crosswalk**, built (DEM-147), reviewed and accepted (DEM-149), integrated; doc gap closed |
| `b5b5c0c` | Crosswalk recorded in the scan ticket; its Claude Science second check queued |

## In flight: the chromosome tab (Multica DEM-148)

Branch `agent/claude-implementer/dem-148` in this repository. First commit
`6d8c524` built the tab with rendered validation; the Codex review (DEM-150)
returned four P2 and one P3 interaction defects, and the independent rendered
inspection (DEM-151) added a measured root cause and two low items. All eight
were sent back to the implementer as two comments on DEM-148. Geometry, axis
integrity, wrap handling, missing-value rendering, layout at all widths, keyboard
access, and all gates had already passed.

**Status when this file was written:** see the section "Update at stop" at the
bottom. If it says the fix commit landed but was not confirmed, the next actions
are, in order:

1. `git log main..agent/claude-implementer/dem-148` and read the DEM-148 comments
   for the implementer's fix report and commit hash.
2. Reuse DEM-150 (`01a0e916-3951-752e-838a-4e99d9dde62a`): add a comment naming
   the fix commit and asking `codex-reviewer` to confirm the eight items, then
   `issue update --status in_progress`. Approval never carries across an
   unreviewed commit.
3. On accept: `git cherry-pick -x <build commit> <fix commit(s)>` onto `main`,
   skipping the baseline `chore(agent)` commit. Expect a trivial conflict in
   `docs/validation/INDEX.md` (both sides append a row). Rerun the three gates,
   then serve `site/` and open `/#p=chromosome` once yourself.
4. Record the merged tab in scan ticket section 5, mark DEM-148 and DEM-150 done.

Inspector screenshots were in a session-temporary scratchpad and are gone; the
DEM-150 and DEM-151 issue comments carry the attached key ones.

## Waiting on the owner's Claude Science account

All in the "Pending Claude Science" table of [tickets/INDEX.md](../tickets/INDEX.md):

- Package A correction (reclassify GSE106824 as rejected ChIP-seq).
- Crosswalk second check: re-derive 2,663/52/8 and 2,636/79/8 from the pinned
  releases without reading `tools/`. Until it returns, PCC 6311 and PCC 7943
  sources stay unadmitted.
- Package B (paper-level condition metadata, ~45 papers), then D (pair scoring).
- Package C at scale (per-artifact licence evidence via Europe PMC).
- The data-use audit ticket, fully dispatchable.

## Waiting on the owner's decision

- Ratify the five mandatory-validation triggers in
  [claude-science-handoff.md](../../validation/claude-science-handoff.md); the
  reasoning is in the topology ticket's "Agent-team review".
- Profiles in the Claude Science account: keep or delete
  `CYANO_CROSSWALK_VERIFIER`, curate `CYANO_EVIDENCE_SCOUT`, create
  `CYANO_DATA_AUDITOR` curated. Recommendations are in the topology ticket.
- Scan ticket open questions 1 to 4, including native codon-space PCA retirement.

## Not started, in-repo, no dependency

- Scan ticket step 6, dataset and condition selectors: the design is still open
  and the motivating multi-condition data does not exist yet, so this can wait
  for package B.
- Promotion of register candidates to ranked roadmap entries waits on packages
  B and C by design.

## Environment notes for the next coordinator

- Multica runtimes are local daemons on this Mac and need network access; a run
  that was `running` when connectivity dropped may show as failed or stalled.
  Inspect `issue runs <id>` before starting a replacement, per the delegation
  policy.
- The run list from `issue runs` is newest-first.
- Managed worktrees are removed when a run ends; branches persist in this repo.
- Adding a comment to an issue with an agent assignee queues a new run.

## Update at stop

_(filled in when the coordinating session stops)_

# O_agent-topology-and-handoff__20260928 — Open

- **Scope:** The owner-side half of the Claude Science topology: which agent profiles
  to create in that account, what each may and may not do, and ratification of the
  mandatory-validation trigger list. The mechanism — claims, results blocks, batched
  queue, boundaries, intake — is **not** here; it is fixed in
  [claude-science-handoff.md](../../validation/claude-science-handoff.md). Covers
  `docs/` only; creating a profile is an owner action in the Claude Science
  interface, not a repository change.
- **Status:** open
- **Opened:** 2026-09-28
- **Updated:** 2026-10-02

## Current state

Two agent systems touch this project and there is no wire between them, by design.
Claude Science exposes no endpoint, so `multica` cannot call it and no agent here can
subcontract to it; the round trip is the owner opening a session. That is recorded,
with the rest of the 2026-09-28 capability probe, in
[claude-science-handoff.md](../../validation/claude-science-handoff.md), which is the
canonical contract for how the two sides exchange work and which this ticket does not
restate.

This ticket was opened with a competing handoff specification and was narrowed on
2026-09-28 once the contract above was found to already exist and to be the better
fitted design — claims gating individual steps rather than whole tickets, batched
through the index queue. The division of labour, the second-checking role, and the
mandatory-validation triggers drafted here were folded into that document. What
remains is the part that document cannot cover, because it lives in the owner's
Claude Science account rather than in this repository.

## Work

### 1. Profiles to create in the Claude Science account

A profile is a named agent with its own instructions and its own tool loadout, so the
boundaries in the handoff contract become properties of the agent rather than
reminders in a ticket. Three are worth creating; all three are barred from editing
this repository.

**`CYANO_EVIDENCE_SCOUT`** — runs offload packages A, B, C, and D. Sweeps literature
and repositories across the six admitted strains and the seven admitted data types;
returns one row per candidate in the offload ticket's required format, rejected rows
included. Never decides admission or licence permission, never invents a locus join.
Needs the omics-archive, PubMed, literature-graph, genes-and-ontologies,
protein-annotation, and genome connectors.

**`CYANO_DATA_AUDITOR`** — runs the data-use audit. Reads the pinned release, the
validation documents, and the primary literature behind each shipped source together,
and returns one row per finding in that ticket's seven-field format, including what it
checked and found correct and what it could not check. Changes no file; needs the
working tree read-only plus the same literature reach.

**`CYANO_CROSSWALK_VERIFIER`** — the independent second checker described under
[second-checking](../../validation/claude-science-handoff.md#second-checking-not-just-fetching).
Fetches pinned RefSeq releases itself, re-derives matched, unmatched, and ambiguous
counts without reading the implementation, reports agreement or names the disagreeing
loci. Read-only.

A fourth is worth it only if sweep volume justifies it: a per-data-type scout so the
seven types run in parallel rather than in sequence.

**Created 2026-09-28:** `CYANO_EVIDENCE_SCOUT` and `CYANO_CROSSWALK_VERIFIER`, per
[RET_claude-science-session__20260928.md](../handoff/RET_claude-science-session__20260928.md#profile-decisions-and-a-review-request).
`CYANO_DATA_AUDITOR` was not created; its loadout awaited the review below, now
resolved.

### 2. Decide each profile's loadout

A profile either sees the full live skill and connector catalogue, which keeps working
as new connectors appear, or an explicit curated subset, which starts with **no**
connectors and grants each one deliberately. The curated form is the safer default for
a read-only verifier and the more awkward one for an open-ended sweep, so this is a
per-profile decision, not a policy. Record the choice here with its reason.

### 3. Ratify the mandatory-validation triggers

The five triggers under
[what must not land](../../validation/claude-science-handoff.md#what-must-not-land-without-a-claude-science-claim-or-package)
are derived from this repository's own contracts, reduced from six by the
2026-09-28 agent-team review below, but have not been ratified by the owner.
Until ratified, an agent that is unsure writes a claim row rather than guessing,
which is the conservative failure.

## Agent-team review, 2026-09-28

Answers from the coordinating session to the three questions in the session
return note, with the evidence each rests on. They are recommendations; the owner
ratifies by creating or not creating the profiles and by leaving or reverting the
contract amendment below.

**1. The verifier is not worth a separate profile.** A crosswalk is rebuilt only
when a RefSeq annotation release is re-pinned or a strain is added. The UTEX
release has been pinned once (`RS_2026_05_13`), the PCC 7942 join once, and the
sister-strain build is one dispatch (DEM-147). That is a few events a year. Run
the second check as a work package against the scout with a read-only mount and
a scope line that forbids reading `tools/`; the guarantee that it cannot wander
comes from the package boundary and from intake, not from the loadout. The first
such package is the DEM-147 result, and it goes in the queue when that run lands.
Do not create `CYANO_CROSSWALK_VERIFIER` again if it is deleted; keep it only if
it already costs nothing to leave in place.

**2. Curate the scout.** Package A touched seven connectors: GEO, ENA, PRIDE,
PubMed, Europe PMC, NCBI Datasets, and taxonomy. Packages B and C need Europe PMC
full text and supplementary files, PubMed, and OpenAlex; package D computes over
B and needs none. That set is stable and is exactly the archive list the contract
already fixes under "What Claude Science is". A sweep that meets an archive
outside the loadout returns the row narrowed with the reason, which is what the
contract prescribes anyway; silently reaching for an unlisted host is the failure
the curated form prevents. So: curate `CYANO_EVIDENCE_SCOUT` to the contract's
archive list plus OpenAlex, and create `CYANO_DATA_AUDITOR` curated the same way
plus a read-only mount, since its literature reach is the same and it must not
write.

**3. Six triggers become five, two narrowed, one moved.** Checked against the
work that actually landed on 2026-09-28:

| Trigger | Verdict | Reason |
| --- | --- | --- |
| 1, admitting a new source | keep | Fired correctly: package A rows went to a register, not to a ranked entry, pending B and C. |
| 2, any cross-strain claim | keep, reworded | Building a crosswalk from two pinned RefSeq releases is in-repo work under the contract's own split; the trigger is any *value* transferred over it, and any coordinate placed on this axis. |
| 3, changing what a displayed value means | keep | This is the audit's core defect class and no gate catches it. |
| 4, denominator, normalization, percentile population, or ramp | narrow: drop "ramp" | A ramp's visual encoding changes in routine UI work and the gates decide it. The population and the normalization are the evidence questions. |
| 5, any prose characterising what a number supports | narrow to strengthening | The scan-ticket and roadmap edits landed today reworded prose and would all have fired. Prose that *raises* the support claimed for an external source or *removes* a caveat is the trigger; adding a caveat or weakening a claim lands freely. |
| 6, deleting a user-facing view | move | It is an owner decision, as the trigger itself says. It does not belong on a Claude Science list; it stays in the scan ticket's open question 4. |

The contract's list is amended to match, marked as pending the owner's
ratification.

**Open question 1, `multica` topology, answered.** The interactive coordinator
owns the claims blocks and the index queue and writes results blocks on intake.
Implementers run the gates in their own worktrees and never touch `docs/notes/`.
The docs steward may run the ticket lifecycle on resolution. No managed agent
adds a claim row on its own; it reports the dependency and the coordinator writes
the row.

## Open questions for the owner

1. **Ratify the trigger list.** The five triggers above, reduced from six and two
   of them narrowed, are a recommendation from the 2026-09-28 agent-team review;
   the owner ratifies or reverts them in
   [claude-science-handoff.md](../../validation/claude-science-handoff.md).
2. **Create `CYANO_DATA_AUDITOR`.** Specified under "Profiles to create" above,
   curated the same way as the scout plus a read-only mount, but not yet created
   in the Claude Science account.

## Verification

- Each created profile is exercised once on a bounded package before it is relied on:
  the scout on one data type, the auditor on one shipped source, the verifier on the
  first crosswalk.
- A profile that returns a patch, a diff, or an edited repository file is
  misconfigured, not merely wrong; its instructions are corrected before it is used
  again.

## Cleanup

On resolution, record the created profiles and their loadouts wherever the owner's
agent estate is documented — **not** in `docs/validation/`, which describes this
release rather than the tooling around it — fold any ratified change to the trigger
list back into
[claude-science-handoff.md](../../validation/claude-science-handoff.md), then delete
this ticket and its index row.

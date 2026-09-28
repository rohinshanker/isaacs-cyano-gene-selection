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
- **Updated:** 2026-09-28

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

### 2. Decide each profile's loadout

A profile either sees the full live skill and connector catalogue, which keeps working
as new connectors appear, or an explicit curated subset, which starts with **no**
connectors and grants each one deliberately. The curated form is the safer default for
a read-only verifier and the more awkward one for an open-ended sweep, so this is a
per-profile decision, not a policy. Record the choice here with its reason.

### 3. Ratify the mandatory-validation triggers

The six triggers under
[what must not land](../../validation/claude-science-handoff.md#what-must-not-land-without-a-claude-science-claim-or-package)
are derived from this repository's own contracts but have not been ratified. Confirm,
extend, or cut them, then delete this step. Until ratified, an agent that is unsure
writes a claim row rather than guessing, which is the conservative failure.

## Open questions for the owner

1. **`multica` topology.** The contract specifies what the in-repo side must satisfy,
   not how `multica` is wired, because that wiring has not been described here. Record
   which existing agent owns the claims blocks, the index queue, and the gate runs.
2. **Whether a verifier profile is worth a separate agent** or is better run as a
   package against the general profile. It depends on how often a crosswalk is
   rebuilt, which is not yet known.

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

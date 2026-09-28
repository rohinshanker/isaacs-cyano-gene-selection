# RET_claude-science-session__20260928 — Claude Science session return

**Read this first if you are picking up the repository after 2026-09-28.**

```
requester:   owner
target:      fable
ticket:      O_claude-science-offload__20260927, O_cross-strain-data-scan__20260927,
             O_agent-topology-and-handoff__20260928
package:     A (systematic sweep), plus the capability gate and scan step 1's dependency
scope:       docs/ and docs/notes/handoff/ only; no code, data, or site file was touched
acceptance:  the return format and hard boundaries in
             O_claude-science-offload__20260927.md, and the intake checks in
             docs/validation/claude-science-handoff.md
status:      returned
opened:      20260928
updated:     20260928
```

This file is a manifest, not a second contract. The mechanism stays
[claude-science-handoff.md](../../validation/claude-science-handoff.md); this is the
entry point for one session's output and the list of what to do with it.

## What this session resolved

**1. The capability gate is closed.** The offload and audit tickets were both blocked
on unverified Claude Science capabilities. Confirmed by probe and recorded, with the
call behind each answer, in
[Confirmed 2026-09-28](../tickets/O_claude-science-offload__20260927.md#confirmed-2026-09-28).
Seven hosts were refused by the sandbox allowlist and granted on request; six now
reachable. `journals.asm.org` refuses at ASM's own server and was left alone — no
User-Agent spoofing, no mirror — because it turned out to be unnecessary.

**2. Package C was never really blocked.** Per-file supplement licence legends come
from Europe PMC, not from publisher hosts. Verified on the exact reference case: for
`PMC9239245` (Adomako 2022) the `supplementaryFiles` endpoint returns the 25
deposited files, and `mbio.00862-22-s0001.xlsx` is **byte-identical to the copy this
release already pins** — 1,359,396 bytes, SHA-256
`b988b744c4c939ce6f47232eacfc30338907a9b911830999eb23414cbe6c331b`. The sibling
`fullTextXML` carries the Data Set S1 legend with its copyright holder and CC BY 4.0
statement. The "Held" status on the Package C queue row has been removed.

**3. Scan step 1's unstated dependency is resolved.** The crosswalk is buildable.
Both strains have current RefSeq assemblies with annotation releases to pin:

| Strain | Assembly | Annotation release | Level |
| --- | --- | --- | --- |
| PCC 6311 | `GCF_022984265.1` | `GCF_022984265.1-RS_2025_12_23` | Chromosome |
| PCC 7943 | `GCF_022984345.1` | `GCF_022984345.1-RS_2025_12_23` | Chromosome |

Corrected at intake 2026-09-28: the session wrote both releases as `RS_2025_12_2`; NCBI Datasets serves `RS_2025_12_23` (released 2025-12-23) for both, verified by the coordinator and independently by the DEM-147 run, which stopped on the mismatch as instructed.

Both are **Chromosome**-level, not Complete Genome, unlike UTEX 2973 and PCC 7942.
Record that in the crosswalk audit: an unmatched locus may reflect assembly
incompleteness rather than genuine absence, and the two cases are not the same thing.

**4. Package A is returned.** Candidate table:
[`cyano_package_A_candidates_20260928.tsv`](cyano_package_A_candidates_20260928.tsv),
74 rows, SHA-256 `d6f456174fd10cb4cd265a342134de5e5de0d6580ebc0c93fc1d8b149073001f`,
in the twelve-column format the offload ticket specifies, rejected rows included.

## The finding that should change the plan

Candidate counts per admitted strain and data type, rejected rows excluded:

| Strain | Transcriptomics | Proteomics | Ribo-seq | TIS | TSS | TTS | Annotation |
| --- | --- | --- | --- | --- | --- | --- | --- |
| UTEX 2973 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| PCC 6301 | 0 | 0 | 0 | 0 | 0 | 0 | 3 |
| PCC 6311 | 0 | 0 | 0 | 0 | 0 | 0 | 1 |
| PCC 7942 | 33 | 12 | 0 | 0 | 0 | 0 | 3 |
| PCC 7943 | 0 | 0 | 0 | 0 | 0 | 0 | 1 |
| UTEX 3055 | 0 | 0 | 0 | 0 | 0 | 0 | 1 |

Three consequences, each of which is a planning decision rather than a code change:

- **Ribosome occupancy, TIS, TSS, and TTS return zero new candidates across all six
  strains.** The single TTS hit, `GSE309256`, is the one already ranked in the
  roadmap. The gene viewer's planned ribo-seq and TIS overlays have no data to draw,
  and that is a property of the literature, not of the search.
- **PCC 6311, PCC 7943, and UTEX 3055 have no functional-genomics data at all** —
  zero GEO series and zero ENA deposits (`read_run`, `analysis`, and `wgs_set` all
  nil against each strain's own taxid). They contribute annotation only. The
  crosswalk is still worth building, but it unlocks **nothing currently available**;
  it is forward-looking infrastructure, and the scan ticket should say so rather than
  implying it gates data.
- **UTEX 2973 has exactly one public deposit**, `PRJNA420395` / `SRP125902`, which is
  Tan 2018 — already shipped. There is no second native source. The strain-asymmetry
  the release already documents is not an artifact of what has been ingested; it is
  what exists.

## What Fable should do next

In this order. None of it waits on another Claude Science round trip.

1. **Intake the candidate table** under the five checks in
   [Intake](../../validation/claude-science-handoff.md#intake). Every `artifact`
   identifier is a resolvable GEO, ENA, PRIDE, or RefSeq accession; spot-check a
   sample directly rather than trusting this file.
2. **Build the PCC 6311 and PCC 7943 crosswalk** against the two pinned releases
   above, under the identifier-crosswalk contract. Report matched, unmatched, and
   ambiguous counts, and note the Chromosome-level caveat.
3. **Append accepted rows** to the ranked table in
   [future-data-roadmap.md](../../validation/future-data-roadmap.md#ranked-candidates)
   in its existing form, and record the rejected rows and their reasons in the scan
   ticket.
4. **Correct the scan ticket's framing** of steps 4 and 5: the ribo-seq and TIS
   overlays are not "gated on the data arriving through this ticket", they are gated
   on data that does not exist. Say that, and decide whether the viewer states the
   absence explicitly rather than leaving an empty track.
5. **Build the chromosome tab and the selectors.** Both are pure in-repo work and
   neither waits on anything here.

## What still needs Claude Science, and why

Left in the queue deliberately, not forgotten:

- **Packages B and D.** The candidate table carries conditions and replicate counts
  only where the repository metadata states them; for most rows it records
  "not reported in repository metadata; requires paper-level extraction". Extracting
  temperature, photon flux, light regime, CO₂, medium, culture format, growth phase,
  and replicate count per study means reading 45 papers and quoting the sentence each
  value came from. That is package B, and D cannot score pairs until B exists.
- **Package C at scale.** The route is proven on one artifact; running it across
  every candidate is the package.
- **The data-use audit.** Untouched this session. It is the other open ticket and is
  fully dispatchable.

## Profile decisions, and a review request

Two Claude Science profiles were created this session, per the owner's instruction:

| Profile | Loadout | Rationale |
| --- | --- | --- |
| `CYANO_EVIDENCE_SCOUT` | **Full** — live skill catalogue, all 21 connectors | An open-ended sweep cannot predict which archive it needs next; this session used GEO, ENA, PRIDE, PubMed, Europe PMC, NCBI Datasets, and taxonomy, and would have stalled on a curated list |
| `CYANO_CROSSWALK_VERIFIER` | **Curated** — `self-awareness` skill; `genomes`, `genes-ontologies`, `protein-annotation`, `omics-archives` connectors | Its job is narrow and read-only; a tight loadout is part of the guarantee that it cannot wander into the work it is supposed to be checking |

`CYANO_DATA_AUDITOR` was specified in
[O_agent-topology-and-handoff__20260928](../tickets/O_agent-topology-and-handoff__20260928.md)
but **not created**, because the audit's loadout should follow the same review.

**Review request for the agent team.** Judge this design and make it leaner. Three
specific questions, each of which you are better placed to answer than the session
that proposed it:

1. **Is the verifier worth a separate profile?** It exists because this repository
   values independent second-checking, but it runs only when a crosswalk is rebuilt.
   If that is once or twice a year, a work package against the scout is cheaper than
   a profile to maintain. You know the rebuild cadence; this session does not.
2. **Is the full loadout on the scout a real requirement or an untested assumption?**
   The argument above is from one session's usage. If the connector set that session
   actually touched is stable across packages, a curated scout is tighter and the
   claim should be corrected rather than defended.
3. **Are the six mandatory-validation triggers the right six?**
   [The list](../../validation/claude-science-handoff.md#what-must-not-land-without-a-claude-science-claim-or-package)
   is derived from this repository's contracts but has never been run against real
   work. Cut any trigger that would fire on a change you would have landed anyway —
   a rule that always fires is a rule nobody reads.

Record the answers in the topology ticket and amend the contract. Treat the design as
a proposal from a session with one day of context, not as a decision.

## Boundaries this return respects

No file outside `docs/` was touched. The table contains no admission decision, no
licence permission, no invented locus join, and no comparability verdict — the
`mapping_route` column names a documented route or `none`, and the `licence` column
is labelled a recommendation throughout. Nothing here enters a release without the
admission contract, run in this repository.

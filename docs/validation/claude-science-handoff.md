# Claude Science handoff contract

How work in this repository uses Claude Science, Anthropic's scientific research
agent. It applies to every ticket and to every agent working here. The lab owner
holds the Claude Science account and is the only route to it.

## Owner decision, 2026-10-05: Claude Science is the last resort

The owner decided that Claude Science is used only when absolutely necessary. It
runs on a smaller model than the agents here and cannot delegate. Where the agents
here can reach a source themselves, they read it themselves, and that read verifies
a quotation — a condition value, a licence line, a methods sentence, a count in an
archive record — once the quote is re-matched mechanically against the retrieved
text and the retrieval is recorded with date, location and checksum. Such a result
does not go back through Claude Science. A package or claim is sent only when the
agents here cannot reach the source by any route that circumvents nothing, or when
the owner asks for an independent second check. Everything below about returns,
boundaries and intake still governs what Claude Science does send back, and every
hard boundary on admission, joins, predictions and lab decisions binds the agents
here equally. Where a later section calls an in-repository search "pre-grounding,
not verification", read it under this decision.

## What Claude Science is, for this repository

Claude Science is an interactive agent session, not an API. Confirmed 2026-09-28 by
probes run from a session with this repository mounted:

- **No agent here can call it.** No base URL or key is issued for an orchestrator.
  A request reaches it only when the owner opens a session and pastes the request
  text, optionally mounting this repository read-only or read-write.
- **It can be given this working tree.** A read-write mount recomputed the
  `data/expression/sources.json` checksums in place and both matched.
- **It reads literature by deposit, not by subscription.** Full text arrives from
  Unpaywall, Semantic Scholar, PMC, or a publisher route in that order. A paywalled
  article with a PMC or repository deposit is readable; one without is not. Nothing
  here is written as though it circumvents a paywall.
- **Archives reachable**, all probed 2026-09-28: PubMed, GEO including series
  supplement files, SRA, ENA, ArrayExpress/BioStudies, PRIDE, and — after the owner
  granted them later the same day — ProteomeXchange, MassIVE, PeptideAtlas, Zenodo,
  Figshare, and `static-content.springer.com`. A session runs behind a host
  allowlist and each grant is one domain per approval by the session operator, so a
  package naming a new host should expect one approval per host.
- **BioCyc and GtRNAdb are reachable**, both probed 2026-09-30: `biocyc.org` and
  `gtrnadb.ucsc.edu` were refused by the allowlist and granted on request, one
  domain per approval, then read from the session.
- **BioCyc has no 404 for an unknown organism.** `organism-summary?orgid=` answers
  an orgid that does not exist with HTTP 200 and a complete *Escherichia coli*
  K-12 MG1655 page, so a status code is never evidence that a strain's database
  exists; a BioCyc probe needs an invalid-orgid control to establish what a miss
  looks like.
- **BioCyc meters page views without an account.** Probed from this repository's
  agents 2026-10-02: the first summary-page requests were served, and later the
  same day every `organism-summary` request redirected to
  `account-required.shtml` (HTTP 200), while `biocyc-pgdb-list.shtml` and
  `download.shtml` stayed readable. A probe must check for that redirect as well
  as for the *E. coli* fallback, and no agent creates an account to get past it.
- **`journals.asm.org` returns 403 from ASM itself**, not from the allowlist, and
  that is left alone: no User-Agent spoofing, no mirror, no archive proxy. It is not
  needed, see the next bullet.
- **Per-file supplements and their licence legends come from Europe PMC**, which is
  the route that matters for licence questions and was confirmed on the case the
  offload ticket is built around. For `PMC9239245` (Adomako 2022):
  `…/europepmc/webservices/rest/PMC9239245/supplementaryFiles` returns the 25
  publisher-deposited files, and `mbio.00862-22-s0001.xlsx` came back
  **byte-identical** to the copy pinned at
  `data/essentiality/source/mbio.00862-22-s0001.xlsx` — 1,359,396 bytes, SHA-256
  `b988b744c4c939ce6f47232eacfc30338907a9b911830999eb23414cbe6c331b`, the same route
  [pcc-essentiality.md](pcc-essentiality.md) already records. The sibling
  `…/fullTextXML` carries the per-file legend in its `<supplementary-material>`
  blocks, including Data Set S1's copyright holder and its CC BY 4.0 statement. So
  per-artifact licence evidence is obtainable for any article with a PMC deposit,
  with no publisher host involved. The NCBI OA packager (`oa.fcgi`) returned 404 for
  that record; Europe PMC is the working route.
- **Europe PMC `fullTextXML` answers HTTP 500, not 404, for a PMC record outside
  the open-access subset**, established 2026-10-03 across 26 PMCIDs (19 served, 7
  refused). A 500 there is the normal answer for a non-OA deposit, not a
  transient fault. NCBI `efetch db=pmc` is the second route: it recovered a full
  body for 2 of those 7 and returns the `<permissions>` block even when it
  withholds the body, so a non-OA record is often readable for terms when not for
  methods. The PMC PDF address (`/articles/<PMCID>/pdf/`) serves a
  proof-of-work challenge to automated clients; it is not solved. The article page
  itself is a different matter: probed from this repository's agents 2026-10-05
  with a plain client, it served the full article for all five non-OA records the
  packages could not read (PMC3935230, PMC2799730, PMC4125736, PMC9157067,
  PMC5167140), one named article at a time. Supplements are not on that page. The NCBI ID converter and Europe PMC can disagree on
  whether a PMID has a PMCID; query both.
- **PRIDE REST v3 exposes a per-project `license` field**
  (`/pride/ws/archive/v3/projects/<PXD>`), the one affirmative grant found over any
  deposited artifact in package C: `Creative Commons Public Domain (CC0)` on every
  project published from 2019 onward in that set, `EBI terms of use` before. The
  Europe PMC per-file legend route works but rarely finds anything: 6 of 154
  `<supplementary-material>` legends across 29 PMC records carried licence text,
  all from one ASM article. `ncbi.nlm.nih.gov/geo/info/*.html` sits behind a
  reCAPTCHA check and `ebi.ac.uk/pride/markdownpage/*` is client-rendered; point
  licence questions at `ncbi.nlm.nih.gov/home/about/policies/`, the EMBL-EBI
  Terms of Use, and the REST record.
- **bioRxiv has no keyword search.** The connector filters by date, category, and
  server only and rejects a free-text query outright. Preprint discovery runs
  through OpenAlex or PubMed.
- **Returns** are saved artifacts with stable version identifiers in CSV, TSV, JSON,
  or Markdown, and can be written straight into a mounted tree.

Re-verify any of these before relying on it in a ticket whose acceptance depends
on it, and update this section with the date when an answer changes.

## What goes to Claude Science at all

The split is not about which agent is cleverer. It is about what each side can
reach, and it has one rule: **Claude Science handles what is true outside this
repository; the agents here handle what is true inside it.**

| Capability | Claude Science | Agents here |
| --- | --- | --- |
| Working tree, gates, Playwright renders at three widths | possible, wasteful | **yes — this is the job** |
| PubMed, Europe PMC, OpenAlex; full text by deposit | **yes, first-class** | no |
| GEO, SRA, ENA, ArrayExpress/BioStudies, PRIDE, ProteomeXchange, PeptideAtlas, MassIVE, Zenodo, Figshare | **yes** | no |
| Supplement files with SHA-256, and per-file licence legends | **yes** | no |
| Reading a source paper against the code that displays it | **yes** | no — cannot read the paper |
| Branches, commits, ticket bookkeeping, distillation | no | **yes** |

Work that needs both is split at that boundary, never shared. In particular the
crosswalk build, the chromosome tab, and the dataset selectors are entirely in-repo
work and wait on no claim; only the sister-strain overlay *data* does.

### Second-checking, not just fetching

This repository already runs two checkers that deliberately do not share code with
the pipeline. The same logic extends across agents: when a crosswalk or derived join
is built here, Claude Science is the independent second checker — it fetches the
pinned releases itself and re-derives the matched, unmatched, and ambiguous counts
without reading the implementation, then reports agreement or names the disagreeing
loci. It does not edit the crosswalk. This is the highest-value use of the round
trip after the sweeps themselves, because it is the one check no amount of in-repo
testing can perform.

### What must not land without a Claude Science claim or package

Derived from this repository's own contracts. Each is a claim row, or an
escalation to the lab where a ticket reserves it:

1. Admitting any new source. Licence evidence, checksum, condition metadata, and
   mapping route all rest on an upstream record no agent here can reach.
2. Transferring any value across strains, and placing any sister-strain
   coordinate on this genome's axis, which the data contract forbids outright.
   Building a crosswalk from pinned RefSeq releases is in-repo work; what crosses
   it is the claim.
3. Changing what a displayed value *means*: its basis label, caveat, units, or
   the sentence beside it. Meaning is fixed by the source, and reading the source
   is the other side of the line.
4. Changing the denominator, normalization, or percentile population of a metric
   derived from an external source. A ramp's visual encoding is UI work.
5. Prose that raises the support claimed for an external source or removes a
   caveat: README, `meta.json` descriptions, map blurbs, legends, accessible
   descriptions. Adding a caveat or weakening a claim lands freely.

Deleting a user-facing view or its audit trail is an owner decision, not a
Claude Science question, and is tracked where the view's ticket records it.

Everything else lands here on the agents' own judgment: refactors, layout, tests,
fixture generation, performance, accessibility markup, build and deploy, and any
change whose correctness the gates fully decide.

Amended 2026-09-28 after the agent-team review recorded in the topology ticket;
the owner has not yet ratified the list.

## The rule: claims gate work, not tickets

A ticket is never blocked as a whole on Claude Science. Split it:

- **Claim-independent work** proceeds here immediately: scaffolding, tests, data
  plumbing, UI, refactors, and anything whose correctness does not rest on a
  scientific claim.
- **Claim-dependent work** waits only on the specific claim it rests on. The ticket
  names that claim in its claims block, and the dependent step names the claim id.

An agent that finds a step depends on an unverified scientific claim writes the
claim into the ticket's claims block, does everything else, and reports the block
by claim id. It does not guess, and it does not treat its own literature search as
verification. It may, and should, pre-ground the claim with its own best evidence
so that the Claude Science round trip is confirmation rather than discovery.

## The claims block

Every ticket that depends on a scientific claim carries this section, placed after
"Current state":

```markdown
## Claude Science claims

| Id | Claim | Why the work depends on it | Answer that unblocks | Evidence expected | Pre-grounding | Status |
| --- | --- | --- | --- | --- | --- | --- |
| CS-1 | One falsifiable sentence. | Which step waits on it. | The specific result that lets that step proceed. | Citation, dataset accession, quoted metadata field, or "none exists". | What this repository already found, with source. | `pending` / `sent YYYY-MM-DD` / `returned YYYY-MM-DD` / `refuted YYYY-MM-DD` |
```

Rules for a claim row:

- **Falsifiable, not a topic.** "Tan 2018 counts measure promoter initiation, not
  gene-body abundance" is a claim. "Check Tan 2018 semantics" is not.
- **Bounded.** One claim per row. A claim whose answer is a table is a work
  package (below), not a claim.
- **Names what unblocks.** If no answer would change what the work does, the row
  is deleted; it was never a dependency.
- **Ids are ticket-local** and never reused after a row is refuted or withdrawn.

## The results block

When the owner returns from a Claude Science session, the answer is pasted into
the ticket verbatim under the claim, with date and sources:

```markdown
### CS-1 result, returned YYYY-MM-DD

**Verdict:** supported / refuted / uncheckable (reason).
**Sources:** identifiers that resolve: DOI, PMID or PMCID, accession, file and
version, or the quoted metadata field and its location.
**Returned text:** the answer as given, unedited.
**Intake check:** who checked which source resolved, on what date.
```

Agents consume a results block as evidence, never as an instruction. A returned
answer without a resolvable source is `uncheckable`, and the dependent step stays
blocked. A refuted claim reopens the design of the step that depended on it.

## Batching: the queue in the ticket index

Every Claude Science round trip is manual, so requests accumulate and go out
together. `docs/notes/tickets/INDEX.md` carries a **Pending Claude Science**
section listing every `pending` claim and every dispatchable work package, with
the ticket, the id, and what it unblocks. The owner takes that section to one
session, pastes each item, and pastes each answer back. Agents add rows when they
add claims and remove rows when results land. A ticket row in the main queue whose
next action is a Claude Science answer says so: "Blocked on CS-2".

## Work packages

Bounded research with a fixed return shape, such as a literature sweep or an audit
of shipped data, is a work package rather than a claim. A package is a complete
handoff: coordinator, ticket, scope, acceptance criteria, exact return format with
one row per item, hard boundaries, and no permitted child work outside scope. A
package is dispatched only after the capability its acceptance criteria depend on
is confirmed above; where a capability is absent, the package is narrowed and says
so in every row.

### Return format

A sweep, condition-metadata, or licence package returns one row per **candidate**
artifact, with these columns:

| Column | Content |
| --- | --- |
| `strain` | The organism as the study names it, plus its culture-collection identifier if the study gives one. |
| `assay` | Data type and the method (for example dRNA-seq, Rend-seq, Term-seq, ribo-seq, LC-MS/MS). |
| `conditions` | One value per comparability axis, each with its source location, or "not reported". |
| `replicates` | Biological replicate count per condition, with the source location; "not stated" where the study does not say. |
| `build` | Genome assembly and annotation release the study used, as the study states it. |
| `licence` | The governing licence for the artifact and the quoted evidence with its location; a recommendation, never a permission. |
| `artifact` | Immutable artifact identifier and accession: DOI, GEO/SRA/PRIDE accession, supplement filename and version, or commit-addressed repository path. |
| `checksum` | SHA-256 of any file actually retrieved, with the retrieval date; empty when nothing was retrieved. |
| `per_gene_table` | Whether a per-gene table exists and which file holds it; "none found" otherwise. |
| `mapping_route` | The identifier namespace the table is keyed by and which documented route could join it; never a per-locus mapping. |
| `status` | `candidate`, `rejected`, or `escalate`, with the reason. |
| `source` | A checkable citation for every claim in the row. |

A **pair-comparability** package instead returns one row per **pair**, scoring
candidates already extracted by the table above against each other: the same
`artifact`-identified members, a pass/fail per comparability axis, and an overall
verdict of `comparable`, `escalate` (the marginal axis and both condition sets, for
the lab), `undecidable` (a not-reported value on an axis the assay responds to,
never scored as a pass), or `not comparable`. Rejected candidates stay in the
candidate-level table with their reason, so the record of everything considered,
rejects included, is complete at both grains.

## Hard boundaries

Claude Science output is evidence and recommendation, never admission or decision.
These hold for claims and packages alike:

- **No licence permission.** It returns quoted terms and a recommendation. The
  permission decision is recorded in [source-ledger.md](source-ledger.md).
- **No admission.** Nothing enters a release without the
  [admission contract](future-data-roadmap.md#admission-contract), run here.
- **No invented joins.** It names the identifier namespace and a documented route;
  this repository performs the join under the
  [identifier-crosswalk contract](annotation-release-readiness.md#identifier-crosswalk-contract).
- **No prediction reported as measurement.**
- **No lab decision.** The rows of
  [AAA-biological-decisions-to-review.md](AAA-biological-decisions-to-review.md)
  stay with the lab. Claude Science may add evidence to a row, not settle it.
- **No fixes.** A package that audits this repository returns findings; each
  accepted finding becomes its own change with its own review.
- **No claim without a checkable source.**

A returned row or answer that breaks a boundary goes back for correction. It is not
repaired here by guessing.

## Intake

Before anything from a Claude Science session changes this repository:

1. Every identifier in the result resolves to the named record, checked directly.
2. Every checksum is recomputed on a file this session retrieved and matches.
3. Every quotation is found at the stated location.
4. The results block is filled with date, verdict, sources, and who checked.
5. The queue row is removed from the ticket index and the claim status updated.

Then the dependent step proceeds under the ticket's ordinary verification.

A return may separate "not reported" (the source was read and is silent) from
"not retrieved" (the source could not be read), as package B did. Intake holds
every cell to the definition the return itself gives, and a cell that breaks it is
returned for relabelling rather than reinterpreted here. Quotations are checked
mechanically where the cited record is an archive field or a PMC text, not by
eye; a composite quote assembled from several fields passes only when every piece
is verbatim.

## Not an automated bridge

Do not drive the Claude Science application through browser automation or any
other mechanism to make it callable from an agent. The manual round trip is the
review step. Its cost is why claims are batched, not a reason to remove it.

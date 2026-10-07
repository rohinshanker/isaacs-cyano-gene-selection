# O_biocyc-utex-2973-data__20260930 — Open

- **Scope:** Assess what relevant BioCyc data for UTEX 2973 can add beyond the
  pinned RefSeq annotation; select useful additions before planning any data pull.
- **Status:** open
- **Opened:** 2026-09-30
- **Updated:** 2026-10-02

## Current State

Owner-supplied starting point:
[BioCyc organism summary](https://biocyc.org/organism-summary?orgid=GCF_000817325).
The repository's target RefSeq assembly is `GCF_000817325.1`, UTEX 2973, per
[data-contract.md](../../validation/data-contract.md). The 2026-09-30 failed read
was a refusal by the web tool, not the BioCyc server; the page was read in the
Claude Science return and its identity and availability result passed intake.

This is an open planning ticket. No data pull or admission has started.
Potential inventory categories include pathways, reactions, enzymes, complexes,
metabolites, and regulatory annotations where available. These are questions to
investigate, not claims that BioCyc has them.

## Claude Science claims

The availability result below answers the BioCyc identity and existence part of
D1. It is returned evidence, not admission, licence permission, or a lab decision.

### BioCyc availability, six strains, returned 2026-09-30

**Verdict:** three of six have a PGDB; three do not.

**Sources:** `https://biocyc.org/organism-summary?orgid=…` per strain and
`?object=SYNEL`, plus `https://biocyc.org/biocyc-pgdb-list.shtml`, all read
2026-09-30 against BioCyc version 30.0; invalid-orgid control
`?orgid=GCF_999999999`.

**Returned text:** the tables in 1.1 and 1.2. Note the fallback behaviour: an
invalid orgid returns HTTP 200 and a complete *E. coli* K-12 MG1655 page, so a
status code is not evidence that a strain's database exists.

**Intake check:** `claude-evidence-analyst (Multica DEM-193), 2026-10-02: the invalid-orgid control, all six strain probes, SYNEL by both orgid and object, the PGDB list, BioCyc version 30.0, the three tiers as the pages state them, and all fifteen counts in table 1.2 resolved; nothing in this block failed to resolve`

For UTEX 2973, BioCyc version 30.0 serves orgid `GCF_000817325` as a
Tier 3 Uncurated PGDB whose sequence source is `GCF_000817325.1`. It was
generated in 2020 from an older annotation of the same assembly that the
repository pins, so the additive inventory should focus on pathway and reaction
inferences and its 1,969 computationally predicted transcription units, not treat
its gene annotations as new or those predictions as measurement. Any future pull
must first compare the organism named on the returned page with the requested
strain rather than accept HTTP 200 as a match.

The public summary pages are served without login only for a limited number of
views: on 2026-10-02, after the intake probes, every summary request from this
machine redirected to `account-required.shtml`, which asks for a free account.
The database list at `biocyc-pgdb-list.shtml` stayed readable. No account was
created. BioCyc's download page states that data
file access requires both a licence and a paid subscription and offers separate
academic and commercial routes; authenticated download was not tested, and reuse
or redistribution remains gated on an artifact-specific source-ledger decision.

### Returned ortholog table for D4

The 2026-09-30 return supplied
`docs/notes/handoff/cyano_ortholog_annotation_20260930.tsv`: 318,256 bytes,
SHA-256 `e49f7d8f7d328cfc3b7e4e9f50c4a802f450f32cbc782b8fd9428eb3a01ec861`,
with 2,715 unique published loci. Its columns are `locus_tag`, `old_locus_tag`,
`protein_id`, `product`, `kegg_ko`, `ko_count`, `ortholog_in_eco_K12`,
`ortholog_in_syf_PCC7942`, `ortholog_in_syc_PCC6301`, `pinned_go_iea_count`,
`annotation_status`, and `evidence_basis_if_used`.

Intake recomputed the headline counts: 1,385 loci are `ko_assigned`, 492 are
`go_iea_only`, 447 are `named_no_ko_no_go`, and 391 are
`hypothetical_no_homology_evidence`; 1,584 loci have pinned GO IEA, 1,385 have a
KEGG KO, their union is 1,877, KO adds 293 beyond GO, and 838 have neither.
Among KO-bearing loci, 879 share a KO with *E. coli* K-12, 1,376 with PCC 7942,
and 506 lack an *E. coli* KO counterpart. Of 394 `hypothetical protein` loci,
none has pinned GO IEA, three have a KO, none has an *E. coli* ortholog, and 391
have neither GO nor KO.

The apparently conflicting `old_locus_tag` counts describe different
populations: 2,655 of all 2,776 GFF gene and pseudogene features have one, while
2,600 of the 2,715 published protein-coding loci represented in this table have
one. Intake found one table defect: 46 `product` values retain the GFF escape
`%2C` instead of a comma. The table is returned evidence, not an admitted source
or an identifier join; D3 through D5 still apply before any value is used.

## Dependencies

| Id | Prerequisite | Dependent step |
| --- | --- | --- |
| D1 | BioCyc identity, version, tier, and public-summary availability are confirmed above; artifact retrieval methods still require verification | Build a trustworthy inventory |
| D2 | Resolve priorities and intended use below | Select additions that make UTEX “more robust” |
| D3 | Verify artifact-specific access, reuse, and redistribution terms; record permission decisions in the source ledger | Retrieve and publish selected artifacts |
| D4 | Assess the returned ortholog table above under the identifier-crosswalk contract; establish release-compatible, exact mappings and retain ambiguity | Integrate selected annotations |
| D5 | Pass evidence, provenance, and admission checks under existing contracts | Ship any data or derived display |

Coordinate research with the
[cross-strain scan](O_cross-strain-data-scan__20260927.md) and the
[Claude Science handoff contract](../../validation/claude-science-handoff.md#what-claude-science-is-for-this-repository),
reusing existing findings instead of repeating requests. This ticket owns
BioCyc-specific assessment; it does not require completion of the scan ticket.

The five sister-strain BioCyc tickets can assess availability independently.
They depend only on relevant shared decisions and source contracts established
here; a UTEX download is not a prerequisite for their discovery.

Any regulatory-site candidates may supply the data dependency of
[the recoding metric](O_recoding-regulatory-site-change__20260930.md), but do not
establish regulatory function or make that metric ready to implement.

## Clarifying questions for later

1. Which gaps should BioCyc fill first: gene functions, pathway context, metabolic
   reactions, regulatory annotations, or something else?
2. What does “more robust” mean here: better gene detail, stronger candidate
   selection, new filtering/coloring metrics, broader coverage, or several?
3. Should assessment include all available BioCyc data families, with ranked
   recommendations, or begin with a narrower subset?
4. Is authenticated or paid BioCyc access available and intended? Which retrieval
   routes should be used if access is limited? Never assume credentials or bypass
   a restriction.
5. Should BioCyc provide a separate evidence layer or reconcile existing
   annotations? What should happen when sources disagree?
6. Are computational annotations acceptable alongside curated evidence, with
   their basis and uncertainty explicit?
7. Are the sister-strain tickets also BioCyc-focused, as provisionally scoped,
   or should they cover additional sources beyond the existing cross-strain scan?

8. Raised by the 2026-09-30 return; unanswered (Q2): Should the per-strain tickets give way to one ortholog-annotation ticket organised by database, or do you want per-strain tickets retained because strain identity matters to how you will read the evidence?
9. Raised by the 2026-09-30 return; unanswered (Q4): Is a clearly-labelled *predicted* pathway and operon layer useful to you, or does the no-prediction-as-measurement rule make it more cost than value in this interface?
10. Raised by the 2026-09-30 return; unanswered (Q6, concerning the proposed ortholog ticket): Given that this cannot name the unnamed genes, is curated *E. coli* experimental context on already-named loci worth a display layer — and at rank 4 in the evidence order, would you show it at all, or hold it as export-only?

## Acceptance criteria

- A sourced inventory identifies useful additions, duplicates, unavailable items,
  and unresolved access or reuse restrictions.
- Each proposed addition names the project gap it fills and preserves its
  evidence basis, source identity, release, and mapping provenance.
- Only owner-selected artifacts that pass the existing admission and source-ledger
  contracts proceed to retrieval and integration.
- Any eventual integration has tests for all new paths, including missing,
  ambiguous, conflicting, and invalid records; no guessed identifiers or values.

## Verification

Ticket creation verified 2026-09-30: required fields, dependency links, later
questions, and live index entries checked; `git diff --check` passed. Gates run
from the repository root passed: `npm test` (659 tests), pytest (332 passed,
1 skipped, 24 subtests passed), and contract validation (96 passed, 0 failed,
1 declared skip). No data retrieval, admission, implementation, or UI change
in this pass.

Evidence-return application verified 2026-10-02: the returned BioCyc block was
compared verbatim apart from its filled intake line; all local links and required
ticket fields passed contract validation; `git diff --check` passed; `npm test`
and the full Python test suite passed. No data was admitted or retrieved.

Future integration: run `npm test`, `.venv/bin/python -m pytest -q`, and
`.venv/bin/python tools/validate_contract.py`; verify pinned artifact checksums,
licence decisions, mapping coverage and ambiguity, and evidence labels. Visible
UI changes also require the UI render/inspect/repair skill and real renders at
mobile, tablet, and desktop widths.

## Cleanup

On resolution, rename the ticket and H1 to resolved, record final validation,
distill only reusable source/retrieval/mapping and validation guidance into
`docs/validation/`, update `validation/INDEX.md`, then delete the resolved ticket
and remove its live index row.

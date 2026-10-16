# O_biocyc-ortholog-annotations__20261014 — Open

- **Scope:** Assess and, after access and admission, add BioCyc-derived annotation
  for UTEX 2973 in the owner's order: UTEX 2973 predictions, then PCC 7942
  (`SYNEL`) annotations, then EcoCyc only for gaps neither covers. Replaces the
  six per-strain BioCyc tickets. PCC 6301 has a secondary assessment only.
- **Status:** open
- **Opened:** 2026-10-14
- **Updated:** 2026-10-16

## Current State

Owner decisions, 2026-10-14, recorded in [biocyc-annotations.md](../../validation/biocyc-annotations.md),
which holds the precedence, labelling, scope and probe contract:

- **D1.** Include both UTEX 2973 predictions and PCC 7942 annotations; UTEX takes
  precedence.
- **D2.** *E. coli* fills only gaps not covered by UTEX and PCC 7942, at lower
  priority. Disagreements between sources are disclosed. Priority is not proof of
  greater accuracy.
- **D3.** The proposed BioCyc and comparative scopes for PCC 6311, PCC 7943 and
  UTEX 3055 are dropped for now. Their already admitted datasets and the
  sister-strain crosswalk stay.
- **D4.** The six per-strain tickets are consolidated into this one.

No BioCyc annotation layer has been admitted or shipped. The receipts below are
metadata/returned evidence, not implemented browser layers.
Target genome stays UTEX 2973 (`GCF_000817325.1`, per [data-contract.md](../../validation/data-contract.md)).
Sister-strain coordinates never go on its axis, and transferred values never
become native UTEX measurements.

## Sources in priority order

| Rank | Source | Held | Role |
| --- | --- | --- | --- |
| 1 | BioCyc v30.0 UTEX 2973, orgid `GCF_000817325`, Tier 3 Uncurated | 2,755 genes, 244 pathways, 1,223 enzymatic reactions, 938 compounds, 1,969 predicted transcription units | Additive content is the pathway, reaction and transcription-unit predictions, labelled predicted. Gene text re-presents the pinned RefSeq annotation |
| 2 | BioCyc v30.0 PCC 7942, orgid `SYNEL`, Tier 2 Curated (Caspi, Shearer, Karp, SRI) | 2,775 genes, 241 pathways, 1,191 enzymatic reactions, 950 compounds, 1,976 transcription units | `transferred`, `sisterStrain: true`, strain named. Package spec: return 5.2 |
| 3 | EcoCyc (Tier 1) via shared KEGG KO with `eco`, assembly `GCF_000005845.2` | 879 of 2,715 loci share a KO with *E. coli* K-12 | Gap fill only, rank-4 `transferred`. Package spec: return 5.6 |
| Secondary | BioCyc v30.0 PCC 6301, orgid `GCF_000010065`, Tier 3 Uncurated | 2,720 genes, 244 pathways, 1,212 enzymatic reactions, 910 compounds, 1,949 transcription units | Assessment only, see below |

Specs live in the frozen [2026-09-30 return](../handoff/RET_claude-science-session__20260930.md)
sections 1.1, 1.2, 1.6, 5.2 and 5.6.

**Gap** means a locus and data type with no value from sources 1 and 2. A value
from a lower source is kept beside a higher one when they disagree, each labelled
with its source, and the disagreement is shown. A gap-fill that would hide or
replace a higher value is a defect.

**PCC 6301 (secondary).** Current RefSeq assembly `GCF_000010065.1` (Complete).
The owner placed it in neither the precedence order nor any layer. Assess only
what its Tier 3 database adds beyond sources 1 and 2, and report it as an
inventory. It fills no gap, ranks nowhere, and a layer needs a new owner decision.

## Withdrawn scopes and preserved absence

Dropped by D3, with the assembly each had in the superseded tickets:

| Strain | Assembly | BioCyc v30.0 |
| --- | --- | --- |
| PCC 6311 | `GCF_022984265.1` (Chromosome) | no PGDB; assembly-orgid probe returned the *E. coli* fallback and the PGDB list has no entry |
| PCC 7943 | `GCF_022984345.1` (Chromosome) | same |
| UTEX 3055 | `GCF_003957805.1` (Complete) | same; also no KEGG genome |

PCC 6311 and PCC 7943 have UniProt proteomes (`UP000831723`, `UP000831319`) that
are automatic annotation resting on the same homology evidence. Reopen only on a
new owner request or if a later BioCyc release adds a PGDB (finding BIO-05).
The owner's former comparative question (UTEX 3055 as a conservation outgroup)
is withdrawn with these scopes.

## BioCyc availability receipt, returned 2026-09-30

**Sources:** `https://biocyc.org/organism-summary?orgid=…` per strain and
`?object=SYNEL`, plus `https://biocyc.org/biocyc-pgdb-list.shtml`, all read
2026-09-30 against BioCyc version 30.0; invalid-orgid control
`?orgid=GCF_999999999`, which returns HTTP 200 and a full *E. coli* K-12 MG1655
page, so a status code is not evidence that a database exists. Absence was
confirmed by a second route: the PGDB list names UTEX 2973, PCC 6301 and PCC 7942
and no occurrence of PCC 6311, PCC 7943 or UTEX 3055.

**Intake check:** `claude-evidence-analyst (Multica DEM-193), 2026-10-02: the invalid-orgid control, all six strain probes, SYNEL by both orgid and object, the PGDB list, BioCyc version 30.0, the three tiers as the pages state them, and all fifteen counts in table 1.2 resolved; nothing in this block failed to resolve`

UTEX 2973's database was generated in 2020 from an older annotation of the same
assembly the repository pins. Any pull must compare the organism named on the
returned page with the requested strain.

**Access.** On 2026-10-02 every `organism-summary` request redirected to
`account-required.shtml` (a free account); `biocyc-pgdb-list.shtml` stayed
readable. No account was created. BioCyc's download page states that data-file
access requires both a licence and a paid subscription, with separate academic
and commercial routes; authenticated download was not tested.

## Ortholog table receipt

`docs/notes/handoff/cyano_ortholog_annotation_20260930.tsv`: 318,256 bytes,
SHA-256 `e49f7d8f7d328cfc3b7e4e9f50c4a802f450f32cbc782b8fd9428eb3a01ec861`,
2,715 unique published loci. Columns: `locus_tag`, `old_locus_tag`, `protein_id`,
`product`, `kegg_ko`, `ko_count`, `ortholog_in_eco_K12`, `ortholog_in_syf_PCC7942`,
`ortholog_in_syc_PCC6301`, `pinned_go_iea_count`, `annotation_status`,
`evidence_basis_if_used`.

Intake recomputed: 1,385 `ko_assigned`, 492 `go_iea_only`, 447
`named_no_ko_no_go`, 391 `hypothetical_no_homology_evidence`. Pinned GO IEA
covers 1,584 loci and KEGG KO 1,385 (union 1,877; KO adds 293; 838 have neither).
Among KO-bearing loci, 879 share a KO with *E. coli* K-12, 1,376 with PCC 7942,
and 506 lack an *E. coli* counterpart. Of 394 `hypothetical protein` loci, none
has GO IEA, three have a KO, none has an *E. coli* ortholog and 391 have neither,
so *E. coli* gap-fill will not name the unnamed third of the genome. The
`old_locus_tag` counts differ by population: 2,655 of 2,776 GFF gene and
pseudogene features against 2,600 of the 2,715 protein-coding loci.

The table is returned evidence, not an admitted source or an identifier join.

## Dependencies

| Id | Prerequisite | Dependent step |
| --- | --- | --- |
| D1 | Reuse the completed related session's authorized web-service access contract and pinned outputs (owner decision, 2026-10-16); no concurrent BioCyc fetch. Verify UTEX/SYNEL access separately. Retain source access-term receipts and verify KEGG access terms before any new KO retrieval | Reads not already satisfied by pinned source artifacts |
| D2 | The assembly `SYNEL` is built on: `GCF_000012525.1` (Complete), `GCF_030544905.1` (Complete) or `GCF_014698905.1` (Contig); the `SYNEL` page links `CP000100` and `CP000101`, which NCBI lists as sequences of `GCF_000012525.1`, an observation and not a determination | A valid PCC 7942 join |
| D3 | A documented, exact, release-compatible join per source. UTEX: the return reports gene pages resolving on current locus tags (`M744_RS00070`, legacy `M744_00075`) and `old_locus_tag` in the pinned GFF, not covered by the intake check. *E. coli*: shared KO, unadmitted | Transfer of any locus evidence |
| D4 | Admission contract: manifest entry, checksum pin, documented join, evidence label, and the strain-and-data-type contract. Citation of source, deposit and article is the redistribution condition (owner decision 2026-10-06); no separate redistribution approval is required | Shipping data or a derived display |

Packages 5.2 and 5.6 of the return specify the content reads. Dispatching them to
Claude Science is the owner's call and a last resort under [AGENTS.md](../../../AGENTS.md);
Use that session only for content that still requires authenticated access;
publicly reachable evidence can be assessed directly under the standing policy.

## Open findings carried forward

Identifiers are from the [blocked-task register](../handoff/cyano_blocked_task_register_20261005.md).
All are `open` unless marked.

| Id | Finding |
| --- | --- |
| BIO-01 | Browser-only access premise superseded by the 2026-10-16 web-service authorization; EcoCyc login reported working in the related session. UTEX/SYNEL access verification remains open (D1) |
| BIO-02 | The `SYNEL` assembly is undetermined (D2) |
| BIO-03 | Related work records BioCyc subscription terms section 3.2 and authenticated EcoCyc access. Reuse its completed receipt; UTEX/SYNEL retrieval and any new KEGG access still require verification. This is an access-terms item, not a new redistribution approval gate |
| BIO-05 | The recurring release watch (recheck at each BioCyc version past 30.0) is not adopted or declined |
| BIO-06 — resolved by `3c5fac8` | The pinned reader decodes the 46 escaped product commas at use time, retaining raw text and the unchanged returned table. See [reader contract](../../validation/biocyc-annotations.md#ortholog-product-text-reader). No source admission or join is implied |
| OWN-03 — answered | D1 and D2 select viewer inclusion of both UTEX and `SYNEL`, with lower-priority *E. coli* gap-fill and disclosed disagreements. No additional visible-versus-export-only approval is required; preserve the same provenance in exports |

Answered by the 2026-10-14 decisions: OWN-01 (D4) and OWN-02 (D3). BIO-04 is
preserved above as verified absence. MET-13 (stale crosswalk-check wording in the
PCC 6311 and PCC 7943 tickets) is superseded by D4; those strains' crosswalk
status stays in [the cross-strain ticket](O_cross-strain-data-scan__20260927.md).

## Acceptance criteria

- A sourced inventory of useful additions per source, with duplicates of the pinned
  RefSeq and GO annotation, unavailable items and unresolved access limits, each
  naming the gap it fills and keeping evidence basis, source identity, release and
  mapping provenance.
- The inventory follows UTEX 2973, then `SYNEL`, then EcoCyc gap-fill; each
  disagreement between sources is retained and disclosed with both values.
- Only artifacts that pass the admission contract proceed to retrieval and
  integration. Any integration tests all new paths, including missing, ambiguous,
  conflicting and invalid records, with no guessed identifier or value.

## Verification

Consolidation and owner-decision recording verified 2026-10-14 by
`cyano-regulatory-sites`: 21 open/active tickets pass filename/H1/status/queue
checks; changed Markdown has no missing local link targets; `git diff --check`
is clean. Required repository gates passed on the combined documentation patch:
1,597 JavaScript tests; 2,079 Python tests and 51 subtests (20 skipped); contract
validator 130 passed, 0 failed, 1 declared skip. No application/data files changed;
these checks do not establish BioCyc admission or implementation. No UI render
was needed for the documentation-only patch.

Future integration: run `npm test`, `.venv/bin/python -m pytest -q` and
`.venv/bin/python tools/validate_contract.py`; verify pinned artifact checksums,
mapping coverage and ambiguity, and evidence labels. Visible UI changes also need
the UI render/inspect/repair skill and renders at mobile, tablet and desktop widths.

## Cleanup

On resolution, rename the ticket and H1 to resolved, record final validation and
every open finding above by identifier, move any new reusable source, mapping or
validation guidance into [biocyc-annotations.md](../../validation/biocyc-annotations.md),
update `validation/INDEX.md`, then delete the ticket and its queue row.

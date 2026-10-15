# O_recoding-regulatory-site-change__20260930 — Open

- **Scope:** Plan a future coloring metric showing whether the selected recoding
  scheme changes regulatory sites on DNA sequences. Establish the relevant site
  types and evidence requirements before choosing or implementing the metric.
- **Status:** open
- **Opened:** 2026-09-30
- **Updated:** 2026-10-14

## Current State

Owner decision, 2026-10-14 (D9): **no data / not evaluated is distinct from
zero detected changes**. Preserve a site's original location when recoding
alters or removes its candidate match. A missing evaluation is not a lost site.
D12 also requests an assessment of original-versus-recoded mRNA secondary
structure/accessibility changes; [the folding ticket](O_folding-compute-backend__20260930.md)
owns the initial workload. Predicted structural change is not measured functional
disruption and must remain distinguishable from a changed regulatory-site count.

The owner's inline answers below settle the initial types (including cryptic
promoters), rough native/transferred/model evidence, no minimum coverage gate,
per-gene changed/added counts, and active scheme versus original sequence.
Do not re-ask those as unanswered prerequisites. This pass records the decisions;
no metric or RNA comparison has been implemented by it.

Owner direction, 2026-10-09: investigate very rough regulatory candidates
transferred from other cyanobacteria, E. coli and other prokaryotes. The
[selected-method transfer assessment](../../validation/regulatory-transfer.md)
now records routes for every selected method. These may become exploratory
inputs to this metric, with source host, native sequence and mapping provenance.
The inline owner answers below choose per-gene changed/added counts and no minimum
coverage threshold. Retain experimental, homology-derived and model-only
evidence separately; recompute each method on original and recoded sequence under
identical settings. Report changed predictions separately from functional effects,
and no-hit/unevaluated regions separately from unchanged sites. Original donor
coordinates stay donor-only; any inferred UTEX interval requires its own explicit
alignment/placement contract.

The desired metric is now specified at the owner-policy level. Implementing it
still requires concrete admitted candidate intervals, reproducible original/
recoded calculations and a tested sequence/coordinate contract. Do not replace
those technical dependencies with a new “enough data” approval gate.

The desired outcome is a coloring option that responds to the selected recoding
scheme and indicates changes to regulatory-site DNA. Sequence change and a
functional regulatory effect must be defined separately; neither is established
by this ticket. Native sites are read against the pinned UTEX 2973 RefSeq assembly
`GCF_000817325.1` (taxid 1350461, Complete); any sister-strain evidence names its
own assembly and never lands on this genome's coordinate axis.

## Claude Science claims

No scientific claim is asserted or verified here. The owner has supplied the
initial scope in question 1 below. Review reachable sources directly under the
project's last-resort Claude Science policy; this ticket does not require a
dispatch or another scope answer before claim-independent preparation.

Its return format is one row per site type: definition, biological
context, assay or annotation basis, strain and genome build, coordinate and strand
convention, candidate datasets, coverage and uncertainty, resolvable sources, and
limits on interpreting a sequence edit as a functional effect. Record unsupported
or unavailable evidence explicitly. Returned evidence does not itself admit data
or settle owner decisions. Add ticket-local falsifiable claim rows and queue them
when a concrete scientific assumption gates a step.

## Dependencies

| Id | Prerequisite | Dependent step | Completion condition |
| --- | --- | --- | --- |
| D1 | Initial types answered in question 1; source/model capabilities still require evidence | Build the site inventory | Concrete supported site definitions and source-backed intervals for the selected calculations |
| D2 | Admitted data for each evaluated type; no owner-imposed minimum coverage | Compute and expose the metric | Sources pass admission/coordinate/provenance contracts; uncovered genes/types say no data or not evaluated |
| D3 | Exact changes produced by each supported recoding scheme | Compare original and recoded site sequences | A tested sequence/coordinate contract identifies edited bases and their overlap with admitted sites |
| D4 | Per-gene changed/added counts, active scheme versus original, missingness policy answered | Implement aggregation and UI | A concrete count/deduplication contract preserves source, changed/added states and evaluation coverage |

Related work:
[cross-strain data scan](O_cross-strain-data-scan__20260927.md) may supply relevant
inputs. Its TSS, TTS, and annotation work is an input dependency where applicable,
not a substitute for D1 or permission to admit additional data types. Its whole
ticket need not finish before this metric can proceed. Research routing follows
[Claude Science handoff](../../validation/claude-science-handoff.md).

## Clarifying questions for later

1. Which regulatory-site types should be considered first? Candidate categories
   to investigate include promoters, transcription-factor binding sites,
   terminators, ribosome-binding sites, and regulatory RNA elements; these are
   scope suggestions, not an approved taxonomy or evidence of available data.
include all of these, and suggest additional ones once this ticket is opened. cryptic promoters should also be considered. if there are any additional transcript initation, termination, etc. ribo-seq data sources that would provide specific sites for utex or other strains use those. look for these exact sequences in similar/other genes as well, if possible
2. Does “changed” mean any edited base within an annotated site, a changed motif
   or predicted score, or evidence of altered regulatory function? Should these
   appear as separate metrics?
changed mostly means if a recoding scheme is implemented and it causes a new promoter to appear somewhere. although we cannot infer if certain sites will function the same if they get recoded, it should still be shows that they are changed in some visual way + with a hover hint
3. What qualifies as “enough data”: specified site types, a minimum coverage of
   genes or regions, a confidence threshold, or a combination?
i dont think there needs to be some kind of "enough data" threshold, either it is borrowed from another organism, it is calculated, it is pulled from a utex or other cyano dataset, etc.. if this does become an issue, it can be explicitly asked.
4. Which strains and evidence sources are acceptable? Should measured native
   sites, sister-strain evidence, and predictions be kept as separate layers?
for e. coli, just do e. coli as there should be enough data out there for regulatory sites. for cyano, you can use sister strains, then any cyanos, then carry over data from e. coli or other prokaryotes where necessary and reasonable. if a certain library is for another organism and not cyano or e. coli, it can still be used, but generally the organism of origin should be mentioned
5. What receives the color: a gene, a regulatory site, a chromosome interval,
   or more than one of these? How should a site shared by several genes be handled?
a site shared by several genes can be mentioned on all of the genes. the coloring scheme (if selected in color by) should  be per gene and how many current sites were disrupted/new sites aadded.
6. Should the value be binary, a changed-site count, a fraction of covered sites,
   or a graded score? If several site types contribute, how are they combined?
it can be a changed-site and or added count
7. How should absent annotations, incomplete coverage, and uncertain mappings
   appear so that “no detected change” cannot be mistaken for “no data”?
what do you mean by absent annotations? as in if an annotation gets removed by a recoding scheme? then in that case there should be an indication that it was there and no longer is. ask further clarifying quesitons to confirm these answers.
   **Clarified by the owner 2026-10-14:** a gene/site type without evaluation
   shows “no data/not evaluated,” not 0. This is separate from an evaluated site
   whose match was lost after recoding.
8. Should both disruption of existing sites and creation of new candidate sites
   be considered? What evidence would permit either interpretation?
yes, if the new site matches an existing site or site brought over from other organisms. if possible and lightweight enough, can potentially add the option to calculate some of these on-demand for a newly recoded gene
9. Must the option compare multiple recoding schemes, or only show the active
   scheme against the original sequence? Which recoding controls does it follow?
active scheme against original scheme.

## Acceptance criteria

- D1–D4 have explicit outcomes before implementation is authorized.
- The approved definition distinguishes sequence edits from any claimed
  functional effect and states its denominator and evidence coverage.
- The coloring option updates with the supported recoding controls, explains its
  value and evidence, and distinguishes missing data from an unchanged site.
- Future implementation tests cover edited and unchanged sites, strand and
  boundary cases, shared sites, missing evidence, and every supported metric path.

## Verification

Transfer-planning update checked by `cyano-regulatory-sites`, 2026-10-09:
open status, retained metric-definition decisions, local links and live queue
verified; source evidence is preserved in
[the transfer contract](../../validation/regulatory-transfer.md#primary-source-evidence-receipts).
No metric implementation, dataset or UI changed.

Future implementation: run `npm test`, `.venv/bin/python -m pytest -q`, and
`.venv/bin/python tools/validate_contract.py`; use the UI render/inspect/repair
skill to inspect the actual coloring option at mobile, tablet, and desktop widths
and across supported recoding and missing-data states.

## Cleanup

Keep this ticket open until its requested work is resolved or explicitly
withdrawn. On completion, rename it and its H1 to resolved, record final
validation, distill reusable metric/evidence and validation contracts into
`docs/validation/`, update `validation/INDEX.md`, then delete the resolved ticket
and remove its live index row. Do not retain a task history.

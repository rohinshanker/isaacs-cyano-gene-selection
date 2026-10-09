# O_recoding-regulatory-site-change__20260930 — Open

- **Scope:** Plan a future coloring metric showing whether the selected recoding
  scheme changes regulatory sites on DNA sequences. Establish the relevant site
  types and evidence requirements before choosing or implementing the metric.
- **Status:** open
- **Opened:** 2026-09-30
- **Updated:** 2026-10-09

## Current State

Owner direction, 2026-10-09: investigate very rough regulatory candidates
transferred from other cyanobacteria, E. coli and other prokaryotes. The
[selected-method transfer assessment](A_regulatory-methods-shortlist__20261008.md#cross-organism-transfer-assessment-2026-10-09)
now records routes for every selected method. These may become exploratory
inputs to this metric, with source host, native sequence and mapping provenance.
This research request does not choose the metric's unit, aggregation, coverage
threshold or implementation. Retain experimental, homology-derived and model-only
evidence separately; recompute each method on original and recoded sequence under
identical settings. Report changed predictions separately from functional effects,
and no-hit/unevaluated regions separately from unchanged sites. Original donor
coordinates stay donor-only; any inferred UTEX interval requires its own explicit
alignment/placement contract.

The owner intends to add this metric once enough data has been collected. This
ticket records the idea and questions for a later discussion; it does not
authorize implementation or a research dispatch now. The metric's definition,
site inventory, coverage threshold, and display unit remain undecided.

The desired outcome is a coloring option that responds to the selected recoding
scheme and indicates changes to regulatory-site DNA. Sequence change and a
functional regulatory effect must be defined separately; neither is established
by this ticket. Native sites are read against the pinned UTEX 2973 RefSeq assembly
`GCF_000817325.1` (taxid 1350461, Complete); any sister-strain evidence names its
own assembly and never lands on this genome's coordinate axis.

## Claude Science claims

No scientific claim is asserted or verified here. D1 requires a bounded research
package, and that package's return format is already fully specified below.
**It is one owner answer away from dispatchable:** clarifying question 1, which
regulatory-site types come first (2026-09-30 return, section 5.3). The only missing
input is a scope decision, so D1 is not blocked on evidence it is not waiting for.
The package is not queued in Pending Claude Science until that answer lands.

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
| D1 | The owner's initial scope list (clarifying question 1), then a sourced review of the relevant regulatory-site types | Decide which features the metric covers | Owner approves the site taxonomy and evidence standards after that review |
| D2 | Sufficient admitted data for the approved types | Compute and expose the metric | Owner defines “enough data”; sources pass the existing admission, coordinate, provenance, and licence contracts |
| D3 | Exact changes produced by each supported recoding scheme | Compare original and recoded site sequences | A tested sequence/coordinate contract identifies edited bases and their overlap with admitted sites |
| D4 | Metric and coloring decisions below | Implement aggregation and UI | Owner resolves the blocking design questions and approves a concrete definition |

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
verified; current passing repository gates are recorded in
[the shared assessment](A_regulatory-methods-shortlist__20261008.md#verification).
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

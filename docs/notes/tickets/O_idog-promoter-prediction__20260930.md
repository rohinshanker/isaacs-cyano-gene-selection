# O_idog-promoter-prediction__20260930 — Open

- **Scope:** Determine whether iDOG code can support promoter prediction for
  UTEX 2973 and whether validated predictions could be added to the gene visualizer.
  Assess additional data and annotation requirements before proposing integration.
- **Status:** open
- **Opened:** 2026-09-30
- **Updated:** 2026-10-02
- **Requested future models:** Mythos 5.1 / Fable 5.1. Reserved for future assessment;
  neither availability nor a provider/transport identifier is assumed. Confirm
  routing when work is activated; do not dispatch or substitute a model now.

## Current State

Owner supplied [jayman1466/iDOG](https://github.com/jayman1466/iDOG), pinned at
commit `9d71187f0b2eb27ee681918927e12850470a0688` (2022-04-01, head of `master`),
**MIT licensed**. The name expands to **inter-Domain Operon Generator**. Record the
repository URL and that expansion in any literature search: the bare acronym also
names a canine genomics resource, `iDog` at CNCB/NGDC
(<https://ngdc.cncb.ac.cn/idog/>, PMID 39526388; first described in
PMID 30371881), so a sweep on "iDOG" alone returns dog genome results.

The strain in scope is *Synechococcus* sp. UTEX 2973, RefSeq assembly
`GCF_000817325.1` (taxid 1350461, Complete) — the assembly this repository pins.

A full-tree inventory at that commit (44 files; nine source modules and twelve
shipped only as bytecode) establishes what the tool does:

- **Promoter design exists.** `operon_design`, shipped as bytecode only, reads
  `yeast_elements/promoters.csv` and `yeast_elements/terminators.csv`, carries a
  hardcoded Bacteriophage T7 promoter (`TAATACGACTCACTATAGGG`) and T7 terminator,
  assembles these with generated RBSs and codon-optimized CDSs into an annotated
  GenBank record, and renders it through dnaplotlib promoter glyphs.
- **The promoter library is the substantive asset:** 48 promoters `YP1`-`YP48`,
  columns `Promoter_name`, `Strength`, `Sequence`, `Core`; strengths 49.94 to
  1080.93, a 21.6-fold span; nine `Core` values (0-8); lengths 161, 171, and
  181 nt; a `ccgcgcc` spacer and a `TATAAAAG` TATA box in 48 of 48. The 25
  terminators have no strength column.
- **It is a strength-annotated parts library with a combinatorial shuffle, not a
  fitted sequence-to-activity model.** No model object exists anywhere in the
  tree, and the bacterial case is a single fixed T7 sequence with no strength
  value.
- **Promoter-*location* prediction is absent.** No module takes genomic sequence
  and returns promoter positions. That is what CS-1 asks, and it is refuted; see
  the result block below.

**Design and location prediction are different problems with different labels,
and stay separate here.** This ticket's title and CS-1 are both about location
prediction while the owner's interest is design, so a future reader going by the
title alone will take the wrong scope. Predicting the strength of a candidate
promoter needs sequence-activity pairs; locating promoters in the UTEX 2973 genome
needs positional labels, and this repository's only labelled positional evidence
is Tan 2018 at a single condition. Any refit toward location prediction inherits
that one dataset. These are two claim rows when they are raised, not one.

**Owner hold: this ticket is not to be closed, resolved, or run through its
Cleanup section.** Owner direction recorded in the 2026-09-30 return (section
1.4a): the promoter *design* capability is the point of interest, and the owner
intends to revisit refitting iDOG toward promoter prediction after their own code
and literature review. A CS-1 verdict of "the capability is absent" is therefore
not grounds to resolve this ticket. There is also no model to refit: `promoters.csv` is a lookup table, and its `Core` index and shared
`ccgcgcc`/`TATAAAAG` scaffold show the 48 rows sample a designed combinatorial
space rather than natural promoter diversity.

Reuse constraints already established at that commit:

- **No cyanobacterial codon table.** `codon_tables/` holds `escherichia_coli`,
  `bacillus_subtilis`, and `saccharomyces_cerevisiae` only, and `codon_opt.py:16`
  defaults to `escherichia_coli`.
- **The bundled TransTermHP is an x86-64 Linux ELF binary**, and the README states
  that arm64 requires recompiling from source. That constraint is shared with the
  fallback devices in
  [folding-compute-backend](O_folding-compute-backend__20260930.md).
- **The anti-Shine-Dalgarno parameter defaults to an *E. coli* value.**
  `create_RBS` takes an `rRNA_sequence` parameter defaulting to `"ACCUCCUUA"`, so
  an iDOG run at defaults does not predict UTEX 2973 initiation. The UTEX 2973
  value is derived inside this repository rather than requested from Claude
  Science: `tools/rrna_3prime.py`, documented in
  [annotation-release-readiness.md](../../validation/annotation-release-readiness.md#deriving-annotated-16s-rrna-3-termini),
  reports `ACCUCCUUU` at the annotated 3' end of both 16S copies,
  `M744_RS03180` and `M744_RS13280`, against the *E. coli* default `ACCUCCUUA`.
  The two differ only at the final base. That is the sequence at each annotated
  boundary, with no processing-site evidence behind it; it is not a validated
  anti-Shine-Dalgarno sequence, and it does not decide what sequence either tool
  should be given. The
  [RBS Calculator](O_rbs-calculator-gene-visualizer__20260930.md) defaults the
  same parameter the same way.

The requested outcome is a feasibility decision with evidence, followed by a
concrete gene-visualizer proposal only if the method is suitable. A finding that
iDOG cannot do the intended task is a valid finding about the capability, not a
reason to close the ticket. Do not turn this assessment into an unapproved
promoter-model development project. No iDOG code has been run, adapted, or
integrated here.

## Claude Science claims

| Id | Claim | Why the work depends on it | Answer that unblocks | Evidence expected | Pre-grounding | Status |
| --- | --- | --- | --- | --- | --- | --- |
| CS-1 | iDOG's implemented method supports promoter-location prediction in UTEX 2973 with evidence of applicability to that organism. | Adopting or describing iDOG output as promoter predictions in the gene visualizer. | Supported with an identified method and applicable validation; refuted or uncheckable redirects the feasibility decision without integrating predictions. | Pinned code functions, method documentation and resolvable validation sources; distinguish code capability from biological applicability. | A full-tree inventory at commit `9d71187` finds promoter *design* machinery and a 48-entry strength-annotated promoter library, but no module that returns promoter positions. | refuted 2026-09-30 |

Route external scientific applicability and validation evidence through
[Claude Science](../../validation/claude-science-handoff.md). The future model
assesses code and integration; an owner-returned scientific result and its intake
check remain necessary for the dependent step. No research dispatch is authorized
by opening this ticket.

### CS-1 result, O_idog-promoter-prediction, returned 2026-09-30

**This result does not resolve the ticket.** It answers the CS-1 row as written.
The ticket stays open under the owner's hold in 1.4a.

**Verdict:** refuted, as to promoter-*location* prediction. Not applicable to
promoter design, which the row does not cover.

**Sources:** `github.com/jayman1466/iDOG` at commit
`9d71187f0b2eb27ee681918927e12850470a0688` (2022-04-01), full clone; its
`README.md`, `LICENSE`, complete 44-entry file tree, the nine shipped
command-line modules, the twelve bytecode-only modules, and
`yeast_elements/promoters.csv`; PubMed queries
`"inter-domain operon generator"[All Fields]` and
`Patel JM[Author] AND (operon OR "host range") AND (2020:2026[dp])`, both
returning zero records.

**Returned text:** iDOG's implemented method does not support promoter-location
prediction: no module accepts genomic sequence and returns promoter positions.
The repository is the inter-Domain Operon Generator, and it does contain
promoter *design* machinery — an `operon_design` module (shipped as bytecode
only) that assembles operons from a 48-entry strength-annotated yeast promoter
library (`YP1`–`YP48`, strengths 49.94 to 1080.93, a shared `ccgcgcc` spacer and
`TATAAAAG` TATA box in all 48, nine core-element variants), 25 yeast
terminators without strengths, and a single hardcoded Bacteriophage T7 promoter
for the bacterial case; plus RBS design to a target translation-initiation rate,
codon optimization, internal-RBS removal, and rho-independent terminator removal
through a bundled TransTermHP. That design capability is a parts library with a
combinatorial shuffle, not a fitted sequence-to-activity model; no model object
exists in the repository. The README's citation and website links are unfilled
placeholders and no publication describing the tool is indexed in PubMed, so
there is no validation evidence — for UTEX 2973 or any organism — to assess.
Organism applicability therefore cannot be established either way for the
prediction capability, because that capability is absent; for the design
capability the quantitative library is yeast-specific and the bacterial promoter
carries no strength value. Licence is MIT.

**Intake check:** `claude-evidence-analyst (Multica DEM-193), 2026-10-02: repository at commit 9d71187 (2022-04-01), 44-file tree, nine source and twelve bytecode-only modules, MIT LICENSE, promoters.csv (48 rows, 49.94 to 1080.93, nine Core values, ccgcgcc and TATAAAAG in 48/48), 25 terminators without strengths, hardcoded T7 promoter, absence of any genomic-sequence-to-promoter-position function across the full tree including bytecode, and both PubMed queries returning zero all resolved; the statement that no publication describing the tool is indexed in PubMed did not resolve — PMID 35366417 (Patel JR et al., Cell 2022, PMC10619838) names github.com/jayman1466/iDOG as its code, PMID 40671632 cites the tool by name, and the quoted author query used initials JM where PubMed indexes Patel JR`

Intake found PMID 35366417 (Patel JR et al., *Cell* 2022, PMC10619838), which
names `github.com/jayman1466/iDOG` as its code and describes a 48-promoter
library; whether that paper validates anything about iDOG is not judged here.

## Dependencies and work

1. **Code feasibility:** Pin an iDOG commit; inspect relevant functions, input and
   output contracts, dependencies, runtime compatibility, and code/asset licences.
   Establish whether a promoter predictor actually exists, could be reused through
   a small supported adaptation, or is outside iDOG's purpose. A README omission
   alone is not proof of absence, and neither is an omission from a file listing:
   the 2026-09-30 return first missed the promoter library because its inventory
   was truncated at 40 of 44 entries. Clone and search the full tree, bytecode-only
   modules included, before concluding a capability is absent. Record code evidence
   for the verdict.
2. **Scientific applicability (CS-1):** Establish the method's intended organisms,
   training/validation basis, outputs, limitations, and applicability to UTEX 2973.
   Do not equate translation-initiation or terminator scores with promoter scores.
3. **Data readiness:** Inventory existing inputs and identify mandatory versus
   beneficial additions. Investigate strand-aware genomic flanks, gene starts and
   operon/transcription-unit context, experimentally supported TSS/promoter labels,
   suitable negative examples, condition metadata, and regulatory annotations.
   These are candidate needs to assess, not established requirements of iDOG.
   For each actual gap, state why it matters, source options, mapping requirements,
   whether sister-strain evidence is valid, and whether it gates feasibility or
   only improves performance.
4. **Evaluation:** If justified, specify and run a bounded benchmark after
   activation. Define suitable held-out data, leakage controls, baselines,
   localization tolerance, false-positive costs, and acceptance thresholds before
   evaluating. Report measured performance and coverage; do not invent thresholds
   or claim validated performance from a demonstration.
5. **Integration decision:** Recommend use, limited use, or rejection with reasons.
   If supported, propose gene-visualizer positions, strand, score/evidence labels,
   uncertainty and missing-data states, coordinate mapping, and compute location.
   Implementation requires an approved definition and passing applicable gates.

Related data work:
[UTEX BioCyc assessment](O_biocyc-utex-2973-data__20260930.md) and its sister-strain
tickets may supply annotations; [cross-strain data scan](O_cross-strain-data-scan__20260927.md)
may supply TSS and other suitable evidence. Depend on identified artifacts and
admission checks, not completion of whole tickets. Discovery and code assessment
can proceed without waiting for data collection once this ticket is activated.

The [regulatory-site recoding metric](O_recoding-regulatory-site-change__20260930.md)
may later consume validated predictions, but this ticket does not establish
regulatory function or recoding effects. Predicted sites must remain distinguishable
from measured sites; sister-strain coordinates never become UTEX coordinates.

## Clarifying questions for later

1. Does promoter prediction mean finding native promoter positions, scoring known
   promoter regions, comparing original and recoded DNA, or designing promoters?
2. Is the initial target UTEX 2973 only, or should the method be assessed on sister
   strains too, with separate validity and evidence labels?
3. If iDOG supplies RBS/terminator tools but no suitable promoter predictor, should
   the ticket conclude with that finding or expand to a comparison of alternatives?
   **Answered a third way** by owner direction recorded in the 2026-09-30 return:
   neither, for now — hold pending the owner's own code and literature review.
4. What data and annotation improvements should be prioritized if required inputs
   or credible evaluation labels are missing? Is experimental validation in scope?
5. What precision, recall, localization accuracy, and uncertainty would justify
   displaying predictions, and what false-positive rate is acceptable?
6. Should predictions be shown as a track, gene-detail annotation, optional score,
   or some combination? Should they update under the active recoding scheme?
7. When available, should Mythos 5.1 and Fable 5.1 both assess this, or should one
   implement the assessment and the other review it? Confirm provider and runtime.

## Acceptance criteria

- Deliver a code-grounded feasibility verdict, scientific evidence status, and
  explicit data-gap table separating mandatory and optional improvements.
- Identify the licence, runtime, coordinate, and evaluation constraints that
  affect reuse; preserve unsupported or unavailable findings explicitly.
- Supply an integration proposal only when supported, with prediction/evidence
  distinctions and tests for every proposed computational path.
- Resolve blocking owner questions before implementing or shipping predictions.

## Verification

Ticket creation verified 2026-09-30: required fields, model reservation,
dependencies, local links, and index/claim queue entries checked;
`git diff --check` passed. Repository gates passed: `npm test` (659 tests),
pytest (332 passed, 1 skipped, 24 subtests passed), and contract validation
(96 passed, 0 failed, 1 declared skip). No prediction or visible UI has been
implemented or validated in this pass.

Future work: reproducible pinned-code assessment and benchmark; then `npm test`,
`.venv/bin/python -m pytest -q`, and `.venv/bin/python tools/validate_contract.py`.
Gene-visualizer changes require the UI render/inspect/repair skill and real
mobile, tablet, and desktop renders, including uncertain and missing predictions.

## Cleanup

On resolution, rename the ticket/H1 to resolved and record final validation.
Distill reusable method, evidence, data-readiness, and validation contracts into
`docs/validation/`, update its index, then delete the resolved ticket and remove
its live queue and pending-claim entries. Do not retain task narration.

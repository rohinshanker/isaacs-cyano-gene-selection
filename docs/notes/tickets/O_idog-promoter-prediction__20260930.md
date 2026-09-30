# O_idog-promoter-prediction__20260930 — Open

- **Scope:** Determine whether iDOG code can support promoter prediction for
  UTEX 2973 and whether validated predictions could be added to the gene visualizer.
  Assess additional data and annotation requirements before proposing integration.
- **Status:** open
- **Opened:** 2026-09-30
- **Updated:** 2026-09-30
- **Requested future models:** Mythos 5.1 / Fable 5.1. Reserved for future assessment;
  neither availability nor a provider/transport identifier is assumed. Confirm
  routing when work is activated; do not dispatch or substitute a model now.

## Current State

Owner supplied [jayman1466/iDOG](https://github.com/jayman1466/iDOG). A preliminary
README inspection on 2026-09-30 found descriptions of RBS generation and codon
optimization, including internal RBS and terminator removal options. It did not
establish promoter prediction capability. This is pre-grounding only: promoter
prediction, RBS design, and terminator detection must be evaluated as distinct
capabilities. No code has been cloned, run, adapted, or integrated.

The requested outcome is a feasibility decision with evidence, followed by a
concrete gene-visualizer proposal only if the method is suitable. A finding that
iDOG cannot do the intended task is a valid outcome. Do not turn this assessment
into an unapproved promoter-model development project.

## Claude Science claims

| Id | Claim | Why the work depends on it | Answer that unblocks | Evidence expected | Pre-grounding | Status |
| --- | --- | --- | --- | --- | --- | --- |
| CS-1 | iDOG's implemented method supports promoter-location prediction in UTEX 2973 with evidence of applicability to that organism. | Adopting or describing iDOG output as promoter predictions in the gene visualizer. | Supported with an identified method and applicable validation; refuted or uncheckable redirects the feasibility decision without integrating predictions. | Pinned code functions, method documentation and resolvable validation sources; distinguish code capability from biological applicability. | The supplied repository README describes RBS generation and codon optimization; that alone does not establish this claim. | pending |

Route external scientific applicability and validation evidence through
[Claude Science](../../validation/claude-science-handoff.md). The future model
assesses code and integration; an owner-returned scientific result and its intake
check remain necessary for the dependent step. No research dispatch is authorized
by opening this ticket.

## Dependencies and work

1. **Code feasibility:** Pin an iDOG commit; inspect relevant functions, input and
   output contracts, dependencies, runtime compatibility, and code/asset licences.
   Establish whether a promoter predictor actually exists, could be reused through
   a small supported adaptation, or is outside iDOG's purpose. A README omission
   alone is not proof of absence. Record code evidence for the verdict.
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

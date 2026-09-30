# O_rbs-calculator-gene-visualizer__20260930 — Open

- **Scope:** Assess whether the supplied RBS Calculator code can predict useful
  RBS features for UTEX 2973 and support their display in the gene visualizer.
- **Status:** open
- **Opened:** 2026-09-30
- **Updated:** 2026-09-30

## Current State

Owner-supplied code:
[Ribosome-Binding-Site-Calculator-v1.0](https://github.com/hsalis/Ribosome-Binding-Site-Calculator-v1.0).
The README, inspected 2026-09-30, describes translation-initiation-rate prediction
and synthetic RBS design using a thermodynamic model. It identifies
`RBS_Calculator.py` as the calculation module and states GPL v3.0 licensing.
These are preliminary repository descriptions, not scientific validation or a
licence compatibility decision. No code has been cloned, run, or integrated.

The first task is to determine what “predict RBS” can mean with this code:
identifying a binding region, scoring initiation at a supplied start site, or
finding candidate starts may require different capabilities. Do not present a
translation-initiation score as a measured site or an experimentally supported
boundary. No model assignment was requested for this ticket.

## Claude Science claims

| Id | Claim | Why the work depends on it | Answer that unblocks | Evidence expected | Pre-grounding | Status |
| --- | --- | --- | --- | --- | --- | --- |
| CS-1 | The v1.0 RBS Calculator's translation-initiation predictions are supported by validation applicable to UTEX 2973. | Interpreting calculator outputs as biologically useful UTEX predictions in the visualizer. | Supported with applicable validation and limitations, or refuted/uncheckable with the evidence gap stated so the assessment can conclude or propose evaluation. | Resolvable method and validation sources identifying organisms, inputs, outputs, and performance. | The supplied README describes bacterial initiation-rate prediction; it does not itself establish UTEX applicability. | pending |

External scientific evidence and any licence questions follow the
[Claude Science handoff](../../validation/claude-science-handoff.md). Code
inspection and input inventory are independent of CS-1; adoption of a biological
interpretation waits on the relevant evidence and intake check. This ticket is
planning only; no dispatch or implementation has started.

## Dependencies and assessment

| Id | Prerequisite | Dependent step |
| --- | --- | --- |
| D1 | Clarify desired output and display below | Define the feature and evaluation target |
| D2 | Pin and inspect code, output contracts, runtime dependencies, and code/dependency licences | Decide reuse, adaptation effort, and integration architecture |
| D3 | Establish reliable input sequences, start-site annotations, strand/coordinate mapping, and required model parameters | Run meaningful predictions |
| D4 | Scientific applicability evidence (CS-1) and an approved benchmark where needed | Interpret predictions and set display thresholds |
| D5 | Owner-approved proposal, provenance contract, and required tests/rendered checks | Add outputs to the gene visualizer |

When activated, assess whether more robust data or annotations are mandatory or
beneficial: genomic flanks and transcript context, accurate CDS/TIS/TSS positions,
strain-specific rRNA parameters if used by the implementation, operon context,
and suitable measured translation-initiation or RBS validation data. Verify each
actual requirement from the method; these candidates are not asserted inputs.
Return a gap table with current coverage, missing inputs, candidate sources,
mapping/condition caveats, and whether each gap prevents use or improves confidence.

Define a bounded evaluation before integrating: held-out evidence, baselines,
leakage controls, relevant localization or score metrics, acceptance thresholds,
and failure cases. Inspect reverse-strand genes, overlapping genes, short or
missing flanks, ambiguous starts, and invalid sequences. Retain unsupported and
missing outputs explicitly.

Related: [cross-strain data scan](O_cross-strain-data-scan__20260927.md) and
[UTEX BioCyc assessment](O_biocyc-utex-2973-data__20260930.md) may supply particular
inputs; depend only on identified artifacts and their admission checks. Coordinate
with [iDOG assessment](O_idog-promoter-prediction__20260930.md) where RBS capability
or dependencies overlap, without conflating promoter prediction and RBS scoring
or waiting for the whole iDOG ticket. Validated RBS evidence may later feed
[regulatory-site recoding comparison](O_recoding-regulatory-site-change__20260930.md).
That metric still requires its own definition and evidence decisions.

## Clarifying questions for later

1. Should the feature locate an RBS sequence/region, predict initiation strength
   at annotated starts, identify alternative starts, or combine those outputs?
2. Is the intended target native UTEX 2973 only, or also sister strains and
   recoded sequences, with separate provenance and validity labels?
3. How should results appear: a sequence highlight, positional track, predicted
   initiation score in gene detail, or more than one of these?
4. Should calculations update with the active recoding scheme and show changes
   from original sequence? Should they run on demand or be precomputed?
5. What evidence and accuracy justify display, and should insufficiently validated
   predictions be available as an explicitly exploratory layer?
6. Is assessment restricted to v1.0, or may it compare newer accessible versions
   or alternatives if v1.0 is unsuitable? Which runtime/compute budget is acceptable?
7. Which additional data or annotation gaps should be prioritized if needed, and
   is experimental validation in scope?

## Acceptance criteria

- Deliver a code-grounded capability verdict, scientific evidence status, and
  explicit input/annotation gap table with mandatory versus optional improvements.
- Distinguish site localization, initiation scoring, and synthetic design; state
  which outputs the code actually supports and their limits for UTEX 2973.
- Record licence/dependency constraints and propose an integration only if justified.
- Any future display identifies predictions, source/version, uncertainty, and
  missing data; no sister-strain coordinates become native UTEX coordinates.
- Resolve blocking questions and test every new computational path before shipping.

## Verification

Ticket creation verified 2026-09-30: required fields, dependencies, local links,
live index entry, and CS-1 queue row checked; `git diff --check` passed.
Repository gates passed: `npm test` (659 tests), pytest (332 passed, 1 skipped,
24 subtests passed), and contract validation (96 passed, 0 failed, 1 declared
skip). No RBS prediction or visible UI is implemented or validated in this pass.

Future implementation: reproducible pinned-code evaluation; `npm test`,
`.venv/bin/python -m pytest -q`, and `.venv/bin/python tools/validate_contract.py`.
Use the UI render/inspect/repair skill for real mobile, tablet, and desktop renders,
including unsupported, uncertain, and missing predictions and recoding states
if those are included in the approved scope.

## Cleanup

On resolution, rename the ticket/H1 to resolved and record final validation.
Distill reusable prediction, evidence, coordinate, and validation contracts into
`docs/validation/`, update its index, then delete the resolved ticket and remove
its live queue and pending-claim entries. Do not retain task narration.

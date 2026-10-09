# O_rbs-calculator-gene-visualizer__20260930 — Open

- **Scope:** Assess whether the supplied RBS Calculator code can predict useful
  RBS features for UTEX 2973 and support their display in the gene visualizer.
- **Status:** open
- **Opened:** 2026-09-30
- **Updated:** 2026-10-08

## Current State

Implementation resumed by the owner on 2026-10-08; this supersedes the earlier record-only instruction in this ticket. `cyano-ui-fixes` owns coordination/integration/closure. Standing claim-specific and source-access constraints still apply.

Owner-supplied code:
[Ribosome-Binding-Site-Calculator-v1.0](https://github.com/hsalis/Ribosome-Binding-Site-Calculator-v1.0).
The README describes translation-initiation-rate prediction and synthetic RBS
design using a thermodynamic model, and identifies `RBS_Calculator.py` as the
calculation module. No code has been run or integrated here. The following are
established about the code and its terms, and are not themselves scientific
validation or a licence decision:

- **The GPL v3.0 statement is correct.** Both the README ("licensed under the GNU
  GPL license v3.0") and the `LICENSE` file say so; `LICENSE` is the eleven-line
  GPL notice rather than the full text, which is why the GitHub API reports
  `spdx_id: NOASSERTION`. That is a metadata artifact, not a conflict — do not
  "correct" it.
- **Copyright is held by the Regents of the University of California**, and the
  README routes academic use to `salislab.net/software` and commercial use to
  `denovodna.com/software`. That dual route sits alongside the GPL grant; the
  permission decision belongs in
  [source-ledger.md](../../validation/source-ledger.md), not here.
- **`RBS_Calculator.py` is Python 2.** At commit `8a9c1de` (2015-10-27) it is
  1,145 lines with eleven bare `print` statements, and `python3 -m py_compile`
  fails with a `SyntaxError`. It will not run on this repository's interpreter
  without a port.
- **It imports NuPACK** (`RBS_Calculator.py:19`, `from NuPACK import NuPACK`),
  a wrapper for NUPACK 2.0 that shells out to binaries the repository does not
  bundle. NUPACK is separately licensed, so a GPL-compatible substitute or a
  licence decision is required before the code runs at all, let alone ships.
  `nupack.org` names a "NUPACK Software License Agreement for Non-Commercial
  Academic Use", but that page renders by script and the 2.0 release's terms have
  not been read; the unread page was a tool-reach limit, not a refusal by the
  server.
- **The anti-Shine-Dalgarno sequence defaults to an *E. coli* value.**
  `RBS_Calculator.py:54` sets a class attribute `rRNA = "acctcctta"`, commented as
  the last nine nucleotides of the 16S rRNA 3' end in *E. coli* — a real, settable
  input, though a class attribute rather than a constructor argument. Run at that
  default against UTEX 2973 sequence the calculator does not predict UTEX 2973
  initiation; it predicts *E. coli* initiation on cyanobacterial sequence. The
  UTEX 2973 value is derived inside this repository rather than requested from
  Claude Science: `tools/rrna_3prime.py`, documented in
  [annotation-release-readiness.md](../../validation/annotation-release-readiness.md#deriving-annotated-16s-rrna-3-termini),
  reports `ACCUCCUUU` at the annotated 3' end of both 16S copies,
  `M744_RS03180` and `M744_RS13280`, against the *E. coli* default `ACCUCCUUA`.
  The two differ only at the final base. That is the sequence at each annotated
  boundary, with no processing-site evidence behind it; it is not a validated
  anti-Shine-Dalgarno sequence, and it does not decide what sequence either tool
  should be given. The
  [iDOG assessment](O_idog-promoter-prediction__20260930.md) records the same
  default for `create_RBS`.

The strain in scope is *Synechococcus* sp. UTEX 2973, RefSeq assembly
`GCF_000817325.1` (taxid 1350461, Complete), the assembly this repository pins.

The first task is to determine what “predict RBS” can mean with this code:
identifying a binding region, scoring initiation at a supplied start site, or
finding candidate starts may require different capabilities. Do not present a
translation-initiation score as a measured site or an experimentally supported
boundary. No model assignment was requested for this ticket.

## Claude Science claims

| Id | Claim | Why the work depends on it | Answer that unblocks | Evidence expected | Pre-grounding | Status |
| --- | --- | --- | --- | --- | --- | --- |
| CS-1 | The v1.0 RBS Calculator's translation-initiation predictions are supported by validation applicable to UTEX 2973. | Interpreting calculator outputs as biologically useful UTEX predictions in the visualizer. | Supported with applicable validation and limitations, or refuted/uncheckable with the evidence gap stated so the assessment can conclude or propose evaluation. | Resolvable method and validation sources identifying organisms, inputs, outputs, and performance. | The supplied README describes bacterial initiation-rate prediction; it does not itself establish UTEX applicability. PubMed returns exactly one record pairing the RBS Calculator with any cyanobacterium — PMID 31908923, Sebesta J and Peebles CA, *Metab Eng Commun* 2020;10:e00117, heterologous expression in *Synechocystis* sp. PCC 6803 — and none for *Synechococcus* or UTEX 2973. This sets the expected shape of the answer; it is not a verdict. | pending |

External scientific evidence and any licence questions follow the
[Claude Science handoff](../../validation/claude-science-handoff.md). Code
inspection and input inventory are independent of CS-1; adoption of a biological
interpretation waits on the relevant evidence and intake check. This ticket is
planning only; no dispatch or implementation has started.

## Dependencies and assessment

| Id | Prerequisite | Dependent step |
| --- | --- | --- |
| D1 | Clarify desired output and display below | Define the feature and evaluation target |
| D2 | Pin and inspect code, output contracts, runtime dependencies, and code/dependency licences. The two named blockers are the Python 2 port and the unbundled, separately licensed NuPACK dependency | Decide reuse, adaptation effort, and integration architecture |
| D3 | Establish reliable input sequences, start-site annotations, strand/coordinate mapping, and required model parameters | Run meaningful predictions |
| D4 | Scientific applicability evidence (CS-1) and an approved benchmark where needed | Interpret predictions and set display thresholds |
| D5 | Owner-approved proposal, provenance contract, and required tests/rendered checks | Add outputs to the gene visualizer |

When activated, assess whether more robust data or annotations are mandatory or
beneficial: genomic flanks and transcript context, accurate CDS/TIS/TSS positions,
the strain-specific `rRNA` value, which is a confirmed input rather than a
speculative one, operon context, and suitable measured translation-initiation or
RBS validation data. Verify each remaining requirement from the method; the rest
of these candidates are not asserted inputs.
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
   Q7, raised by the 2026-09-30 return; unanswered: "Is porting v1.0 worth it, or
   would you rather the assessment consider the current Salis-lab version or a
   different initiation model? Your clarifying question 6 asks this; the licence and
   runtime findings now give it a cost side".
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

## Owner direction, 2026-10-08

RBS Calculator remains a primary candidate. The owner requested a broader list
of computational methods that could identify regulatory/cryptic regulatory sites,
including iDOG and methods already mentioned in the repository/open tickets.
A_regulatory-methods-shortlist__20261008 records the primary-source candidate list.
This does not select a model version, calibration threshold, host-specific parameter
or source-admission outcome; those remain method/evaluation decisions.

The owner subsequently selected RBS Calculator, iDOG/TransTermHP, Promoter
Calculator, ViennaRNA, STREME, Rfam + Infernal, and IntaRNA. Methods outside the
requested recommendation should have slightly transparent tags and lower overlap
precedence; the exact category and opacity are not yet specified. Hover outlines
apply to annotations, including initiation/termination sites, in both gene
viewers. See A_regulatory-methods-shortlist__20261008 and
O_gene-sequence-structural-features__20261007 for the shared display requirement.
**Record only; do not evaluate, run or integrate the methods yet.** Existing
scientific, dependency, licence and iDOG-hold constraints remain in force.

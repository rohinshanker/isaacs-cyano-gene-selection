# O_pinned-gene-sequence-viewer__20260930 — Open

- **Scope:** Add a larger gene visualizer inside the Chromosome visualizer tab
  for close inspection of the pinned gene, including actual DNA bases, codon
  triplets, and the amino acids they encode.
- **Status:** open
- **Opened:** 2026-09-30
- **Updated:** 2026-09-30

## Current State

Recorded as the next ticket in the owner's ticket-opening session. Implementation
has not started. The requested view complements the chromosome overview with
readable sequence detail for the pinned gene.

Existing implementation entry points are `site/js/ui/gene-viewer.js`,
`site/js/core/gene-view-model.js`, and `site/js/ui/chromosome-view.js`.
Reuse the project's components, shared selection state, and sequence decoders.
Read [chromosome-view.md](../../validation/chromosome-view.md),
[viewer-interaction-state.md](../../validation/viewer-interaction-state.md), and
[data-contract.md](../../validation/data-contract.md) before implementation.

## Requested behavior

- Provide a substantially larger, readable close-up within the Chromosome tab
  that follows the pinned gene. Clearly name the gene and its strand.
- Let the user inspect literal DNA bases and their grouping into codons, with
  aligned amino-acid identities and positions. Keep higher-level gene context
  available while inspecting the sequence.
- Provide navigation appropriate for long genes, such as zoom/pan or a bounded
  sequence window; choose the interaction after resolving the questions below.
- Define empty, pinned, changed-pin, and unpinned states explicitly. Hover or
  keyboard previews must not silently replace the pinned sequence.
- Keep detail readable and usable at mobile, tablet, and desktop widths and
  with keyboard navigation; do not rely on color alone.

## Dependencies and sequence integrity

| Id | Prerequisite | Dependent step |
| --- | --- | --- |
| D1 | Owner decisions on layout, sequence scope, and navigation | Finalize UI behavior |
| D2 | Existing pinned-selection and chromosome interaction contracts | Synchronize the close-up without conflicting selection state |
| D3 | Exact sequence decoding, translation, and coordinate mapping under the data contract | Display bases, codons, amino acids, and positions correctly |
| D4 | Additional admitted genomic context, only if flanks or both genomic strands are requested beyond available sequence | Display that expanded sequence scope |

The basic CDS close-up uses existing sequence data and does not wait on BioCyc,
promoter prediction, RBS prediction, or the broader data scan. Future annotations
can extend it after passing their own gates:
[iDOG/promoter assessment](O_idog-promoter-prediction__20260930.md),
[RBS Calculator assessment](O_rbs-calculator-gene-visualizer__20260930.md), and
[regulatory-site recoding metric](O_recoding-regulatory-site-change__20260930.md).
Those tickets may use this view, but are not prerequisites for the base viewer.

Implementation must preserve these existing sequence rules:

- Decode `codons` using the declared alphabet; append the separately stored
  `terminalStop` when showing the complete CDS. Mark stop separately from residues.
- Display literal initiation bases and their contract-defined methionine
  translation at position zero, including non-ATG starts. Do not recode position zero.
- Respect reverse-strand orientation and distinguish genomic coordinates from
  CDS offsets and amino-acid positions.
- Preserve discontinuous `cdsSegments` and translation exceptions; do not invent
  a contiguous genomic sequence or an ordinary translation for exceptional cases.
  Verify what exact translation information the current data can support.
- If recoded sequence is included, apply the active scheme under existing rules
  and include terminal-stop changes. Do not infer a functional regulatory effect.

## Clarifying questions for later

1. Where should the large view sit within the Chromosome tab: beneath the overview,
   beside it where space permits, or in an expandable panel? Should it replace
   or supplement the smaller existing gene visualizer?
2. Should the initial view cover CDS only, or also intragenic gaps, upstream and
   downstream genomic context, and neighboring genes? How much flank is useful?
3. Should bases be displayed in coding/transcription orientation, reference-genome
   orientation, or with a toggle? Does “base pairs” require both DNA strands?
4. Should the view show original sequence only, active recoded sequence, or aligned
   original/recoded rows with changed bases and codons highlighted?
5. Should bases, codons, and amino acids be simultaneous aligned rows or selectable
   detail levels? Are one-letter amino-acid codes sufficient?
6. What navigation is preferred: zoom/pan, scrolling, wrapped sequence rows,
   jump-to-position, or a combination? Should pinning initially fit the full gene
   or open a readable window at its start?
7. What should clicking a base/codon expose, and should copying/exporting a selected
   sequence be included in this ticket?
8. Should close-up position/zoom persist across tab changes or shared URLs, and
   reset when another gene is pinned? Any URL changes must be explicitly specified.

## Claude Science claims

None for faithfully displaying existing sequences and contract-defined translation.
No new external scientific interpretation is asserted. If implementation requires
a new annotation, altered translation semantics, or interpretation of an exception,
add a bounded claim and queue the dependent step under the
[Claude Science handoff](../../validation/claude-science-handoff.md).

## Acceptance criteria

- The Chromosome tab contains a readable larger pinned-gene view with actual
  bases, codon grouping, aligned amino acids, and clearly labelled positions.
- Pinning another gene and unpinning update the view deterministically; preview
  interactions preserve the intended pinned-gene behavior.
- Long genes, reverse-strand genes, non-ATG starts, terminal stops, discontinuous
  CDSs, and translation exceptions are rendered correctly or explicitly limited
  where data do not support the requested representation.
- Any approved original/recoded comparison remains aligned and updates with the
  active scheme, with start/stop rules preserved.
- Keyboard/touch navigation, small-screen readability, and existing chromosome
  selection/zoom behavior pass rendered validation; every new code path is tested.

## Verification

Ticket creation verified 2026-09-30: fields, dependency links, questions, and
live index entry checked; `git diff --check` passed. Repository gates passed:
`npm test` (659 tests), pytest (332 passed, 1 skipped, 24 subtests passed), and
contract validation (96 passed, 0 failed, 1 declared skip). No UI implementation
or rendered validation has occurred in this ticket-opening pass.

Future implementation: load the UI render/inspect/repair skill; render the actual
Chromosome tab at mobile, tablet, and desktop widths, covering the selection,
navigation, orientation, sequence-boundary, and exception states above. Compare
sequence/translation output with independent contract fixtures. Run `npm test`,
`.venv/bin/python -m pytest -q`, and `.venv/bin/python tools/validate_contract.py`.

## Cleanup

On completion, rename the ticket/H1 to resolved and record final validation.
Distill reusable viewer, sequence-alignment, coordinate, and rendered-validation
contracts into `docs/validation/`, update its index, then delete the resolved
ticket and remove its live index entry. Do not retain a task history.

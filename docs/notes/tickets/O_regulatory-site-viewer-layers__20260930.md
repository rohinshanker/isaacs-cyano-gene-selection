# O_regulatory-site-viewer-layers__20260930 — Open

- **Scope:** Ensure mapped Tan 2018 initiation sites appear in the gene visualizer;
  support future admitted initiation, termination, and regulatory-site markers;
  add site-type visibility toggles in the Chromosome visualizer.
- **Status:** open
- **Opened:** 2026-09-30
- **Updated:** 2026-09-30

## Current State

Opened during the owner's ticket-planning session; implementation has not started.
The current gene viewer already has Tan TSS rendering through `tssMarks()` in
`site/js/core/gene-view-model.js` and `site/js/ui/gene-viewer.js`. This ticket first
audits that behavior for all valid mapped sites and repairs verified gaps rather
than adding a duplicate rendering path. No rendered completeness check has been
performed in this pass.

The existing chromosome contract places native gene-linked Tan sites at their
published absolute positions, while non-gene-linked features remain in the
Regulatory sites tab. The requested type toggles and any expanded chromosome
coverage need an explicit revision of that display contract during implementation.

## Required behavior

- A gene with valid mapped Tan 2018 TSS evidence shows its initiation-site marks
  in the gene visualizer, including site-only genes without a pooled initiation
  score and genes with multiple sites. Preserve source identity and caveats.
- Future admitted datasets containing initiation, termination, or regulatory
  features feed a shared marker layer when their placement and association are
  supported. Handle point sites and intervals without guessing missing positions.
- Chromosome controls independently show/hide the approved regulatory-site types,
  with an accessible legend identifying enabled layers and their evidence basis.
  Site visibility does not silently filter genes or change their metric values.
- Make source, site type, strand, position/basis, and measured-versus-predicted
  status available on inspection. Distinguish hidden layers, loading data,
  unavailable mappings, and genuinely absent evidence.
- Preserve readable markers when sites overlap or share screen pixels. Define
  aggregation at overview scale and inspection at close scale without dropping
  valid evidence.

## Dependencies and integrity

| Id | Prerequisite | Dependent step |
| --- | --- | --- |
| D1 | Existing Tan evidence/provenance and current rendering audit | Fix any Tan marker omissions now, without waiting on new data |
| D2 | Owner decisions on type taxonomy, defaults, scope, and persistence | Implement chromosome toggles and marker semantics |
| D3 | Shared feature representation with explicit point/interval coordinates, association, source, and evidence basis | Integrate future feature types consistently |
| D4 | Per-dataset admission, source semantics, licence, mapping, and condition checks | Display each new source; the generic marker UI does not wait on all sources |

Read [data-contract.md](../../validation/data-contract.md),
[chromosome-view.md](../../validation/chromosome-view.md), and
[viewer-interaction-state.md](../../validation/viewer-interaction-state.md).

- Tan exact-locus site evidence and the pooled `tssInitiation` score are separate.
  A pooled score alone never creates a site, and an absent pooled score never
  suppresses a mapped site. Do not impose an unapproved start-distance cutoff.
- Preserve published `position` and `sourceStartDistanceNt` separately. The current
  gene viewer draws the reported distance against the source gene model; the
  chromosome uses the native published position. Do not silently remeasure a source
  distance against a different annotation release or imply that these bases agree.
- Native UTEX coordinates may appear on its chromosome axis after validation.
  Sister-strain coordinates never transfer onto that axis. A valid admitted
  gene-relative association is not an exact UTEX genomic position.
- Non-gTSS rows and potential-target hypotheses retain their original semantics;
  do not attach them to the nearest gene or turn hypotheses into regulatory edges.
- Features lacking a valid position or association retain an explicit unavailable
  mapping state; they are not invented marks or evidence of no site.

Related dependencies are artifact-specific:
[cross-strain scan](O_cross-strain-data-scan__20260927.md),
[UTEX BioCyc assessment](O_biocyc-utex-2973-data__20260930.md),
[promoter assessment](O_idog-promoter-prediction__20260930.md), and
[RBS assessment](O_rbs-calculator-gene-visualizer__20260930.md) may supply future
features only after their own validation. Coordinate the shared layer with the
[larger pinned-gene viewer](O_pinned-gene-sequence-viewer__20260930.md) so both gene
views show the same admitted evidence. Neither ticket needs to wait for the
other's entire implementation. The
[recoding regulatory metric](O_recoding-regulatory-site-change__20260930.md) may
consume these features later; displaying them does not establish recoding effects.

## Clarifying questions for later

1. Which distinct toggle types are wanted initially: TSS, TIS, TTS, promoters,
   RBS, binding sites, or broader categories? TSS and TIS must remain distinct.
2. Should chromosome toggles expose Tan antisense, internal, and orphan/novel
   sites as separate types, including sites not associated with a plotted gene?
3. Should all admitted types start enabled, or use a smaller default set? Are
   show-all/hide-all controls useful?
4. Should chromosome toggles also govern the gene visualizers, or should their
   layer selections remain independent? The mapped Tan sites should be visible
   by default in the gene viewer under the requested behavior.
5. Should separate controls select source/dataset, measured-versus-predicted
   evidence, and experimental condition as well as site type?
6. How should overlapping sites, shared-gene associations, uncertain intervals,
   and gene-relative evidence without a chromosome position be presented?
7. Should layer selections persist across tabs/reloads and shared links, and how
   should Reset view, Reset selections, and Clear filters affect them?
8. What should selecting a site do: inspect metadata, pin an associated gene,
   jump to sequence position, or open the Regulatory sites tab?

## Claude Science claims

None for auditing and faithfully rendering existing admitted Tan evidence or
adding visibility controls. No new biological interpretation is asserted here.
New source admission, taxonomy requiring scientific interpretation, positional
mapping assumptions, or altered source semantics require ticket-local bounded
claims and queue entries under the
[Claude Science handoff](../../validation/claude-science-handoff.md). Gate only
the dependent dataset or interpretation; current Tan/UI work can proceed when
this ticket is activated.

## Acceptance criteria

- Every valid mapped Tan site is inspectable in the gene view; site-only,
  score-only, multiple-site, and both-strand examples behave as specified.
- Shared marker handling supports approved point and interval feature types,
  source/evidence labels, and explicit missing/unmapped/loading states.
- Chromosome type toggles work independently with mouse, keyboard, and touch;
  hidden layers have no stale interactive targets, and focus survives rerenders.
- Overview collisions, close-up placement, replicon boundaries, and selection
  interactions pass rendered verification without violating coordinate contracts.
- Tests cover every added path, including malformed/unmapped evidence, type
  selection, overlap, optional datasets, and persistence if approved.

## Verification

Ticket creation verified 2026-09-30: fields, local links, dependencies, and live
index entry checked; `git diff --check` passed. Repository gates passed:
`npm test` (659 tests), pytest (332 passed, 1 skipped, 24 subtests passed), and
contract validation (96 passed, 0 failed, 1 declared skip). No rendered behavior
was validated in this ticket-opening pass.

Future implementation: use the UI render/inspect/repair skill on the real gene
and Chromosome views at mobile, tablet, and desktop widths, covering the cases
above. Check Tan fixtures and source/provenance mappings independently of renderer
geometry. Run `npm test`, `.venv/bin/python -m pytest -q`, and
`.venv/bin/python tools/validate_contract.py`.

## Cleanup

On completion, rename the ticket/H1 to resolved and record final validation.
Distill reusable marker, coordinate, layer-state, and rendered-validation contracts
into `docs/validation/`, update its index, then delete the resolved ticket and
remove its live queue entries. Do not retain task history.

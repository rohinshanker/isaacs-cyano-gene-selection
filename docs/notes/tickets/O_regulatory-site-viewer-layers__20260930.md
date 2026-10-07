# O_regulatory-site-viewer-layers__20260930 — Open

- **Scope:** Ensure mapped Tan 2018 initiation sites appear in the gene visualizer;
  support future admitted initiation, termination, and regulatory-site markers;
  add site-type visibility toggles in the Chromosome visualizer.
- **Status:** open
- **Opened:** 2026-09-30
- **Updated:** 2026-10-07

## Current State

Opened during the owner's ticket-planning session. D1, the completeness audit of the
mapped Tan 2018 sites, is done: every shipped site reaches the drawing faithfully,
nothing needed repair, and the audit now runs on every test run over the shipped file
rather than a fixture. Its counts, case coverage and rendered checks are recorded
once, under [Verification](#d1-2026-10-02). The rest of the ticket has not started:
the chromosome site-type toggles, the shared marker layer, and the overlap-readability
item below are all open. The owner fixed the next implementation scope on
2026-10-07; see the bounded plan below.

The gene viewer renders Tan TSS evidence through `tssMarks()`, which lives only in
`site/js/core/gene-view-model.js`. `site/js/ui/gene-viewer.js` draws `model.tss` and
derives nothing of its own, so there is one path from the evidence file to a mark
and D1 kept it that way.

**Found, not repaired, and not D1's scope:** at desktop widths `M744_RS01695`'s
tightest marks sit 2.3 px apart as 5.1 px circles, so the heads overlap into a
cluster. Every mark is still drawn and each keeps its own `<title>`, so no evidence
is lost, but the cluster is not separately readable. That is the "preserve readable
markers when sites overlap" item under Required behavior, included in the
owner-authorized Tan-only pass below.

`site/js/ui/chromosome-view.js` hides **all** start-site ticks in a band when
`sites.length * MIN_TSS_SPACING_PX > band.width`, with `MIN_TSS_SPACING_PX = 3`
(applied in `paintTss`). Confirmed as the behaviour and **recorded as designed**: at
whole-chromosome zoom 2,413 ticks over a few hundred pixels merge into a solid bar,
which would read as continuous evidence across the genome rather than as discrete
start sites. Unchanged, and deliberately so, and now pinned on both sides of its
threshold in `tests/js/chromosome-view.test.mjs`.

The existing chromosome contract places native gene-linked Tan sites at their
published absolute positions, while non-gene-linked features remain in the
Regulatory sites tab. The requested type toggles and any expanded chromosome
coverage need an explicit revision of that display contract during implementation.

## Tan-only implementation scope, owner decision 2026-10-07

The owner answered "sure" to starting with the **existing admitted Tan TSS
sites, including overlap inspection and visibility controls, before adding other
site types**. The next pass can proceed as code/UI work with no new scientific
interpretation or source admission.

Implementation plan within that decision:

- Use the current mapped gene-linked Tan marks and native chromosome ticks,
  preserving their published position/distance bases and current default
  visibility. Other Tan features remain in the Regulatory sites view under its
  existing association rules. No new type taxonomy or broader chromosome
  placement is implied.
- Add an accessible show/hide control for this existing TSS layer. It affects
  marks only, never gene filtering, scores, ranking or data selection. Reuse the
  current view-state/reset conventions; broader shared/persistent layer state
  can be assessed as an extension rather than holding this pass.
- Make colliding marks inspectable through a complete list of the represented
  sites, retaining every source row and its identity. Their anchors keep their
  exact coordinates; any display grouping must be labelled and must not imply
  one biological site or continuous evidence. Preserve the current chromosome
  overview density rule unless a separately validated presentation replaces it.
- Keep source, strand, source coordinate basis and evidence status reachable
  through pointer, touch and keyboard inspection. Check the known dense
  `M744_RS01695` case and both strands in rendered tests.

These are implementation choices within the confirmed scope, not additional
owner answers. Questions 1 to 8 below remain useful for later type expansion or
new interactions; they are not prerequisites for faithful Tan visibility and
overlap inspection. The separate recoding-effect metric's site-type question is
not answered by this display-only scope decision.

## Claude Science claims

None for auditing and faithfully rendering existing admitted Tan evidence or
adding visibility controls. No new biological interpretation is asserted here.
New source admission, taxonomy requiring scientific interpretation, positional
mapping assumptions, or altered source semantics require ticket-local bounded
claims and queue entries under the
[Claude Science handoff](../../validation/claude-science-handoff.md). Gate only
the dependent dataset or interpretation; current Tan/UI work can proceed when
this ticket is activated.

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
| D2 | Initial scope decided 2026-10-07: existing Tan TSS visibility and overlap inspection; retain current coordinate/default conventions | Implement the Tan-only pass; broader taxonomy/persistence decisions apply to extensions |
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
features only after their own validation. Coordinate the shared layer with the sequence close-up, whose shipped behaviour is
recorded in [gene-sequence-closeup.md](../../validation/gene-sequence-closeup.md);
its own ticket is resolved and deleted. The close-up shipped with no start-site
marks at all, so "both gene views show the same admitted evidence" is still open
and belongs to whichever ticket takes it on. Neither view needs to wait for the
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

Documentation update verified 2026-10-07: the 32-ticket filename/H1/status,
main-queue membership and local-link checks passed; `git diff --check` was clean.
Required gates on the isolated docs worktree: `npm test` 1,116 passed;
`.venv/bin/python -m pytest -q` 494 passed, 1 skipped, 36 subtests;
`.venv/bin/python tools/validate_contract.py` 116 passed, 0 failed, 1 declared
skip. This pass changed no application code, release data or browser UI;
implementation-specific validation remains separate.

Ticket creation verified 2026-09-30: fields, local links, dependencies, and live
index entry checked; `git diff --check` passed. Repository gates passed:
`npm test` (659 tests), pytest (332 passed, 1 skipped, 24 subtests passed), and
contract validation (96 passed, 0 failed, 1 declared skip). No rendered behavior
was validated in that ticket-opening pass.

### D1, 2026-10-02

`tests/js/gene-view-tan-evidence.test.mjs` runs the audit over the shipped
`site/data/tss_evidence.json` on every test run: **2,432 sites across 1,789 genes,
2,432 marks drawn, no omissions and nothing to repair.** The marks are read back out
of the SVG that `geneViewSvg()` builds rather than counted off `model.tss`, so the
audit measures the drawing and not the model: with `drawTss` deleted from the builder
it fails. Drawn marks and source rows are compared as multisets in both directions
over rows whose ids are required distinct, which is what catches one site drawn in
place of another — the counts agree in that case and every drawn id is a real
published site. Each mark keeps its row's id, distance, strand, position and
replicon, carries a stem and a head, is painted at the position its domain gives it,
and lands inside that domain. The domain bound is the check that needed the real
file: `fractionOf` clamps, so a mark past either end is painted onto the edge at a
distance the source never published instead of being dropped.

Each case class is asserted non-empty first, so the pass cannot come from finding
nothing: 482 genes with more than one site, 472 site-only genes with no pooled
`tssInitiation` score, 862 minus-strand and 927 plus-strand genes, the one spliced
gene with sites (`M744_RS00920`), 46 sites published at the annotated start itself
(distance 0, drawn at offset zero rather than read as a missing value), and 15
plasmid genes carrying 19 sites on `NZ_CP006472.1`. Distances run from 0 to 999 nt.
The two origin-crossing plasmid genes `M744_RS13290` and `M744_RS13620` carry **no**
Tan rows in the shipped file; both still build a view model on their own short track
— 3,121 and 307 nt rather than their replicon-spanning `start`–`end` — and the
completeness rule is asserted over whatever rows they carry, so a row added later is
covered without editing the test. The injected failures put the same audit function
to a row with no published distance, the second row of a two-site gene replaced by a
copy of the first, and a site placed past the domain, and require it to reject each
one. `tests/js/loading-states.test.mjs` pins that the recorded-absence statement
waits while the start-site file is in flight.

The Chromosome view's tick-density rule is unchanged and pinned on both sides of its
threshold in `tests/js/chromosome-view.test.mjs`: with the row's ticks exactly filling
the band width every one is drawn, and one tick past that the whole row is dropped
rather than thinned. `MIN_TSS_SPACING_PX` is exported from
`site/js/ui/chromosome-view.js` for it, and the test fails if the constant moves in
either direction.

Rendered with the UI render/inspect/repair skill at 375x812, 768x1024, 1280x800 and
1440x900, pinning `M744_RS01695` (20 sites, densest), `M744_RS07975` (the 999 nt
furthest site), `M744_RS01280` (a site at distance 0), `M744_RS09240` (minus strand)
and `M744_RS00920` (spliced): every mark painted, sized, opaque and inside the SVG
box at every width, no page overflow, no console messages. The crowding finding in
Current State is the only thing the renders turned up. Nothing drawn has changed
since — the fix round that followed touched a comment, one new export, the tests and
these documents — so those renders still stand and none was repeated.

Gates: `npm test` 937 passed, pytest 355 passed with 1 skipped and 39 subtests,
contract validation 98 passed with 0 failed and 1 declared skip. The pytest run needs
the gitignored `data/raw/GCF_000817325.1_*` release inputs, which a fresh worktree
does not carry; copy them from the canonical checkout before running the gate there.

Still to verify when the rest of the ticket is implemented: the Chromosome type
toggles and the shared marker layer, at the same widths, with mouse, keyboard and
touch. Check Tan fixtures and source/provenance mappings independently of renderer
geometry. Run `npm test`, `.venv/bin/python -m pytest -q`, and
`.venv/bin/python tools/validate_contract.py`.

## Cleanup

On completion, rename the ticket/H1 to resolved and record final validation.
Distill reusable marker, coordinate, layer-state, and rendered-validation contracts
into `docs/validation/`, update its index, then delete the resolved ticket and
remove its live queue entries. Do not retain task history.

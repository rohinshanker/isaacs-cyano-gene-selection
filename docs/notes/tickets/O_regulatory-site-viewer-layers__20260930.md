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
once, under [Verification](#d1-2026-10-02).

**D2, the owner-authorized Tan-only pass, shipped 2026-10-07** and is recorded under
[D2](#d2-2026-10-07): the chromosome start-site layer has its own show/hide, each gene
visualizer has its own, and every colliding gene-view mark is inspectable in a
complete per-row list. The ticket stays open. What remains is everything the owner's
2026-10-07 decision deliberately left out: the broader site-type taxonomy and its
toggles, the shared marker layer for future admitted initiation, termination and
regulatory features, layer state that is shared between views or persisted into a
link, and the close-up's missing start-site marks. Clarifying questions 1 to 8 still
belong to that work. Question 4 — whether a chromosome layer control should also
govern the gene views — is answered **only for this layer and only as
independence**: the coordinator's scope check of 2026-10-07 put a control of the
same name in the gene viewer with its own per-view state, and shared or persisted
layer state stays future work.

The gene viewer renders Tan TSS evidence through `tssMarks()`, which lives only in
`site/js/core/gene-view-model.js`. `site/js/ui/gene-viewer.js` draws `model.tss` and
derives nothing of its own, so there is one path from the evidence file to a mark
and D1 kept it that way.

**Found by D1, addressed by D2:** at desktop widths `M744_RS01695`'s tightest marks
sit 2.3 px apart as 5.1 px circles, so the heads overlap into a cluster. Every mark is
still drawn and each keeps its own `<title>`, so no evidence is lost, but the cluster
is not separately readable. The marks were not moved — their published distances are
the evidence — so the cluster is still drawn as a cluster; what D2 added is the
complete per-row list beneath the picture that says which site is which, and the
labelling that names a cluster as a fact about the drawing. That is the "preserve
readable markers when sites overlap" item under Required behavior.

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
- Add an accessible show/hide control for this existing TSS layer, in the
  chromosome view **and in the gene viewer**, independently. It affects marks
  only, never gene filtering, scores, ranking or data selection. Reuse the
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

**Delivered 2026-10-07.** Every bullet above is implemented and verified; the
contracts are in
[chromosome-view.md](../../validation/chromosome-view.md#showing-and-hiding-the-start-site-layer),
[controls-column-and-resets.md](../../validation/controls-column-and-resets.md#showing-and-hiding-the-start-site-marks)
and
[viewer-interaction-state.md](../../validation/viewer-interaction-state.md#start-site-marks-that-land-on-each-other),
and the evidence is under [D2](#d2-2026-10-07) and
[D2b](#d2b-2026-10-07-the-gene-viewers-own-control). No coordinate basis,
default visibility, source identity or density rule changed, and no new
dataset, type taxonomy or persisted state was added.

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
| D2 | Initial scope decided 2026-10-07: existing Tan TSS visibility and overlap inspection; retain current coordinate/default conventions | Tan-only pass implemented and verified 2026-10-07; broader taxonomy/persistence decisions apply to extensions |
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

### D2b, 2026-10-07: the gene viewer's own control

The coordinator's scope check extended the Tan-only visibility control to the gene
viewer, independently of the chromosome's and without shared or persisted state.
**Show Tan 2018 start sites** now sits between the picture and the legend in both
gene-viewer mounts, default visible, built only where there is a mark for it to
govern: an organism that declares the layer, a file that has landed, and at least
one published row with a distance. A locus with no mapped site, a locus whose rows
are all unmapped, the loading and failed states and the E. coli page get no control,
so hidden stays distinct from absent, loading, failed and unpublished. The contract
is in
[controls-column-and-resets.md](../../validation/controls-column-and-resets.md#showing-and-hiding-the-start-site-marks).

It governs marks only. With them hidden the mark group is not built, so there is no
head, no `<title>`, nothing for a pointer to find where a mark was, and no instant-hint
description left behind; the legend loses its start-site key. Everything else is
identical — the domain and the upstream room the furthest site opened, the ruler and
its labels, the track, codons, splice gap and arrow, the gene's facts, the metric
table beside it, the shortlist action, the filters and the selection. The complete
list stays, labelled as the metadata of a picture whose marks are hidden, and no row
carries a cluster label while there is no cluster to be in. The accessible
description gains a fifth state that names the control, says what is unchanged, and
drops every sentence about where a mark is drawn.

The state is each view's own and each caller's to hold, because `renderGeneViewer`
rebuilds its host on every hover: `controlsStartSitesVisible` in `app.js` and
`this.startSitesVisible` on the `SidePanel`, each written only where the reader
changes it, in no link, export or storage. Toggling repaints the whole view and
carries keyboard focus across it; the detail column's focus restoration moved to
after the visualizer is appended, which is the first point at which every control a
reader could be holding is back in the tree.

Tests: `tests/js/gene-view-start-site-visibility.test.mjs` (10 tests, over the
shipped file and the real `SidePanel`) — the control's identity, placement and
accessible naming, marks-only against a whole-view fingerprint, the list and its
note, the choice surviving repeated renders and locus changes including through a
locus with no control, focus across both the toggle's repaint and the caller's,
the two mounts deciding separately, both strands, every state that gets no control,
and a source check that only the two views can write the state. Each contract was
checked against a mutant that breaks it.

Rendered against the real site (`python3 -m http.server`, port 8379, this worktree,
server identity confirmed by PID cwd; session `dem-279-gene-viewer-tan`) at 375×812,
768×1024, 1280×800 and 1440×900, with geometry read back at 375, 480, 768, 959, 960,
1239, 1240, 1280 and 1440 — the control is present in both mounts at every width,
13×13 px, unclipped, inside its column, between the picture and the legend, named
`Show Tan 2018 start sites` through its wrapping label, Tab-reachable before the list
it points at, with a visible 3 px focus ring. Toggled by Space with a mark's hint
open: focus stayed on the rebuilt control, the hint closed, 20 marks and their 20
hint descriptions went, `elementFromPoint` at a former mark returned the bare SVG,
zero description nodes were left unreferenced, and the other gene viewer kept drawing
its 20. Held across six keyboard locus changes including loci with no control, a live
hash application, Reset selections confirmed, the chromosome's Reset view and a tab
change; a reload returned it to visible, with no hash field and no storage key. The
inverse configuration — controls column showing, detail column hidden, chromosome
ticks on — was rendered to show the three controls are independent. The minus-strand
locus `M744_RS09240` toggles with an identical track and ruler, the E. coli page has
no control and no Tan copy at all, and the failed state was rendered by serving a
copy with `tss_evidence.json` removed. No console messages at any point, and no
failed request. Page overflow was zero at every width except 768, where it is the
same 3 px `table.metric-table` and sequence-close-up overflow the earlier pass
reproduced on the baseline commit; no `.gene-view-layer` is among the offenders.

Screenshots and semantic snapshots are under
`/tmp/cyano-tan-20261007/gene-viewer-control`.

Gates on the final patch: `npm test` 1,142 passed; `.venv/bin/python -m pytest -q`
494 passed, 1 skipped, 36 subtests; `.venv/bin/python tools/validate_contract.py`
116 passed, 0 failed, 1 declared skip; `git diff --check` clean.

Not verified here: the loading state's absent control was pinned in unit tests and
not re-rendered, the failed state standing for both; and nothing outside this
control was re-rendered, since D2's matrix already covers it.

### D2, 2026-10-07

The owner-authorized Tan-only pass. Two surfaces, neither of which changes what is
drawn where.

**The chromosome start-site layer has its own show/hide.** `Show Tan 2018 start
sites` sits beside `Show filtered-out genes` on the view-button row and is built only
for an organism that declares a `tssEvidence` layer, so the E. coli page has neither
the control nor the row. It governs the tick row and nothing else: with the layer
hidden the filter mask and the passing count are the objects they were, every CDS bar
is still painted, and the joined sites are still on the model. It is this view's own
state — no URL field, no storage, no export field — and **Reset view does not touch
it**, exactly as it does not touch Show filtered-out genes. The 3 px density rule is
unchanged in both directions: showing the layer where the ticks would merge still
draws nothing. The conventions note now distinguishes four states rather than three,
hidden among them, because an unexplained empty row would read as a genome with no
start sites.

**Every colliding mark is inspectable.** The marks keep their published distances, so
`M744_RS01695`'s cluster is still drawn as a cluster — the crowding Current State
named is explained, not repaired by moving a mark. Beneath the picture a closed
disclosure, `Tan 2018 start sites (20)`, lists one row per published source row with
its identifier, type, strand, replicon and published coordinate, the published
upstream distance, the placement gap where the chromosome's coordinate disagrees, and
whether the row records condition read counts. Rows that share drawn space carry
`drawn in overlapping cluster N of M … (display only)`; the grouping is single
linkage at exactly one drawn mark head, which is the width at which two heads overlap
at every rendered size and at none above it. A row with no published distance has no
mark and is kept in the list as explicitly unmapped. The list is the keyboard and
touch path: a `<title>` needs a pointer and answers for whichever head is on top.

Tests: `tests/js/tss-overlap-inspection.test.mjs` (13 tests — the dense locus over the
shipped file, both strands, a site-only gene, a pooled score inventing no row, an
unmapped row, a malformed row that borrows nothing from its neighbour, the loading and
failed states, an organism with no layer, the linkage rule at exactly one head width,
and a per-gene audit that all 2,432 shipped rows reach the list exactly once), plus the
chromosome control, density-rule and Reset-view cases in
`tests/js/chromosome-view.test.mjs` and the fourth conventions state in
`tests/js/loading-states.test.mjs`.

Rendered with the UI render/inspect/repair skill against the real site
(`python -m http.server`, port 8279, this worktree) at 375×812, 768×1024, 1280×800 and
1440×900, on the Chromosome tab and on a scatter tab, pinning `M744_RS01695` (20 sites,
densest) and `M744_RS09240` (minus strand), and on the E. coli page. Both gene-viewer
mount points — the controls rail and the gene detail card — carry the list, each with
all 20 rows, none clipped at any width. The canvas was read back with `getImageData`:
with the layer shown the tick colour occupies 119 columns at a 160 kb window, and with
it hidden zero pixels of that colour remain while 20,345 painted pixels and the window
readout are unchanged. Toggling by Tab and Space keeps focus on the checkbox, and the
hash gains no field. Reset view returned every track to its full length and left the
layer hidden. `document.documentElement.scrollWidth <= innerWidth` at 375, 1280 and
1440; at 768 the page is 3 px wide, which the baseline commit `7f10b69` reproduces
exactly with no control and no list present — a pre-existing `table.metric-table`
overflow in the gene detail, not this pass's and not repaired here. No console errors
on any route; the single warning was raised by the `getImageData` probe itself.
Screenshots and semantic snapshots are under `/tmp/cyano-tan-20261007`.

Gates on the final patch: `npm test` 1,132 passed; `.venv/bin/python -m pytest -q` 494
passed, 1 skipped, 36 subtests; `.venv/bin/python tools/validate_contract.py` 116
passed, 0 failed, 1 declared skip. A fresh worktree needs the canonical `.venv` and the
gitignored `data/raw/GCF_000817325.1_*` release inputs copied in before the pytest gate
will run.

Not verified here, and not in this pass's scope: the broader site-type toggles and the
shared marker layer, any layer state shared between views or carried in a link, and the
sequence close-up's missing start-site marks.

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

Still to verify when the rest of the ticket is implemented: the broader Chromosome
type toggles and the shared marker layer, at the same widths, with mouse, keyboard and
touch. The existing Tan layer's own controls are verified under
[D2](#d2-2026-10-07) and [D2b](#d2b-2026-10-07-the-gene-viewers-own-control). Check Tan fixtures and source/provenance mappings independently of renderer
geometry. Run `npm test`, `.venv/bin/python -m pytest -q`, and
`.venv/bin/python tools/validate_contract.py`.

## Cleanup

On completion, rename the ticket/H1 to resolved and record final validation.
Distill reusable marker, coordinate, layer-state, and rendered-validation contracts
into `docs/validation/`, update its index, then delete the resolved ticket and
remove its live queue entries. Do not retain task history.

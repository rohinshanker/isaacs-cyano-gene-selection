# O_gene-sequence-structural-features__20261007 — Open

Scope: Ensure the sequence viewer at the bottom of Chromosome/Gene shows Tan initiation start sites and supports other structural/positional features as they are added, starting with determined Shine-Dalgarno and RBS-like sequences per gene, visible in the gene viewers.
Status: open
Opened: 2026-10-07
Updated: 2026-10-08

## Current State

Opened for later at the owner's request. No new implementation started.

## Owner display decision, 2026-10-08

**Record only; do not implement these changes yet**, including the already chosen
adjustable upstream window. Requested methods: RBS Calculator, iDOG/TransTermHP,
Promoter Calculator, ViennaRNA, STREME, Rfam + Infernal, and IntaRNA; method
assessment/admission remains with the linked method tickets.

For annotations from methods that "dont follow the recommendation that i
requested", use slightly transparent tag coloring and do not give them precedence
when multiple annotations overlap. The affected category and opacity value remain
unspecified; clarify them before implementing rather than assigning methods to
that category here. Keep every overlapping annotation inspectable.

Add an outline on hover around any of these gene annotations, including
termination and initiation sites on the genes themselves, in **both**
`site/js/ui/gene-viewer.js` and `site/js/ui/gene-sequence-view.js`. This is an
additional acceptance requirement for both viewers, retaining the existing
source/evidence, coordinate, keyboard and touch contracts.

## Existing context

Owner request: the gene viewer should have Tan initiation start sites and other
future structural features that are added. The owner clarified the target as the
sequence viewer at the bottom of Chromosome/Gene. “Tan” is understood as the
existing Tan 2018 transcription-initiation evidence.

The current source already contains Tan start-site rendering and show/hide
controls in both viewer types: `site/js/ui/gene-viewer.js` and
`site/js/ui/gene-sequence-view.js`. `site/js/core/marker-layers.js` supplies a
shared representation for admitted point/interval features and a vocabulary for
future feature types. `docs/validation/gene-sequence-closeup.md` documents this
existing work. These are source observations; the owner's intended display has
not been checked in a rendered application during this ticket's opening.

Implementation must first establish what is missing in the sequence viewer:
visibility/discoverability of the existing Tan layer, a verified display defect,
or coverage of additional admitted feature layers. Preserve existing working
support and extend its shared contracts rather than duplicating it.

Owner decision during UI closeout, recorded 2026-10-08: offer an adjustable
upstream window. Expand native sequence coverage and controls while retaining
existing coordinate/evidence caveats; 30 bases may remain the initial setting.
This does not authorize remapping gene-relative evidence or admitting a new
feature source. The method choice for the RBS layer remains separate.

Current sequence-marker controls appear only when there is a placeable row;
sites outside the shipped sequence remain listed as unplaceable. Check the
current sequence extent when reproducing the requested display and record any
clarification needed about additional upstream sequence coverage.

Opening baseline: canonical Desktop checkout, `main` at
`b769ee1d34fa14d2fe13452173a914e0a82ef19a`. Tan sequence-marker work is already
present, including commit `203bfcc`; check current state before choosing a patch.

## Owner request, 2026-10-07: Shine-Dalgarno and RBS-like sequences

Regulatory sites such as the Shine-Dalgarno sequence and other RBS-like
sequences should be determined for each gene, added to the gene's data, and
made visible in the gene viewers: the gene viewer (`site/js/ui/gene-viewer.js`)
and the bottom sequence viewer (`site/js/ui/gene-sequence-view.js`). This is the
first concrete feature layer beyond Tan start sites and is in scope here.

What already exists:

- `site/js/core/marker-layers.js` has an `rbs` interval type ("ribosome
  binding site") in the shared marker vocabulary, so no new type is needed;
  the layer needs data and viewer wiring.
- `tools/rrna_3prime.py` derives the annotated UTEX 2973 16S rRNA 3' terminus,
  `ACCUCCUUU` for both copies, recorded in
  [annotation-release-readiness.md](../../validation/annotation-release-readiness.md).
  That document states it is not a validated anti-Shine-Dalgarno claim; a
  complementarity scan built on it ships as *predicted*, with that caveat.
- [O_rbs-calculator-gene-visualizer__20260930](O_rbs-calculator-gene-visualizer__20260930.md)
  covers the thermodynamic alternative (RBS Calculator) and its licence,
  Python 2 and NuPACK blockers. The method decision (complementarity scan,
  RBS Calculator, or both) stays with that ticket; this ticket owns the gene
  data field, the shared layer, and the viewer display once sites exist.

Determination, whichever method is chosen: scan a bounded upstream window of
each annotated start on the gene's own strand, record each candidate as an
interval in native coordinates with its strand, the sequence matched, the
spacing to the start codon, the method and its parameters, and a score where
the method gives one. Record "none found" per gene rather than omitting the
gene. Keep the Tan start-site layer and this layer separately toggleable, and
keep a gene whose annotated start is itself in question (see the chromosome
and Tan tickets) from gaining a confident-looking site.

## Acceptance

- The bottom sequence viewer visibly presents applicable Tan initiation start sites
  at the correct positions, with inspectable source/site information and usable
  show/hide controls; investigate and repair any verified gap.
- Structural/positional feature layers added later can use the shared marker
  representation and appropriate viewer rendering/controls once their data is
  admitted. Check existing support and complete any identified integration gap.
- Distinguish feature types and measured/predicted evidence; retain correct
  coordinate basis, strand, point/interval geometry, and source attribution.
- Preserve every applicable feature in inspectable metadata, including crowded,
  overlapping, out-of-range, or unplaceable sites; keep absence, loading, failure,
  and user-hidden states truthful.
- Keep the sequence viewer's pinned-gene behavior, sequence legibility, keyboard/touch access,
  and responsive performance intact as feature layers are displayed.
- Shine-Dalgarno / RBS-like sites are determined per gene by a recorded method,
  stored on the gene as `rbs` interval markers with strand, native coordinates,
  matched sequence, spacing to the start codon, method, parameters and score,
  and drawn in both gene viewers with their own show/hide control, labelled
  predicted and distinct from the Tan measured layer. Genes with no site say so.
- Future-feature support does not fabricate data or admit a new scientific
  source; those source-specific decisions remain with their data tickets.

## Affected Area and Clarification

Before implementation and again at resolution, compare the bottom sequence-viewer
surface, current Tan controls/markers, and shared feature-layer support against
the opening baseline. Record what was already implemented, what changed after
opening, which gap was repaired, and whether anything needs owner clarification.
State explicitly when none is needed.

The viewer target is confirmed. If rendered behavior already satisfies the
request, report that and clarify any
remaining expectation rather than declaring a source-only check sufficient.
Coordinate with the chromosome performance and viewer-info tickets when they
touch the same surfaces.

## Verification

Ticket opening and clarification: existing source support and queue link checked;
target confirmed as the bottom sequence viewer. The requested viewer behavior
has not been rendered or changed.

At implementation, render the bottom sequence viewer at 375, 768, 1280, and 1440 px
and relevant breakpoints. Inspect genes with zero/one/multiple start sites, both
strands, overlaps, show/hide, loading/failure, and organism-without-layer states.
Check native-coordinate placement and disclosures about gene-relative evidence
under the existing contracts, the shipped sequence extent, and admitted
point/interval layer integration. Verify accessible metadata, keyboard/touch
operation, clipping, runtime diagnostics, and chromosome interaction performance.
Run focused marker/gene-viewer/sequence tests and all repository completion gates.

## Cleanup

When verified, report existing support, changes made, affected-area assessment,
and any clarification; rename/status-mark this ticket resolved and record final
validation. Distill reusable feature-layer integration and viewer behavior into
the relevant marker/data, gene-viewer, and sequence validation contracts; update
`docs/validation/INDEX.md`. Then delete the resolved ticket and remove its queue
row. Keep separate source-admission and performance work open.

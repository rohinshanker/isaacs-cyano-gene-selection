# O_gene-viewer-upstream-context-overlap-proteins__20261016 — Open

Scope: Gene viewers show that further-upstream relevant sites exist off-screen, show annotated genes lying in displayed upstream context with their coding DNA and protein, and show the protein an overlapping gene encodes alongside its codons.
Status: open
Opened: 2026-10-16
Updated: 2026-10-16

## Current State

Opened from three owner requests (2026-10-16); nothing is implemented. The
owner's words: *"if there are further upstream TSS/regulatory sites that are
relevant, there should be an arrow pointing to the left on the sites that
mentions there are further upstream promoters not visible. if upstream context
is being showed and another gene lies in the upstream context, this should be
shown on the upstream context. with its coding proteins etc. similar to how
overlapping genes are shown. also update overlapping genes to also show the
proteins they encode in addition to the codons."*

Surfaces: the expanded gene viewer (pinned sequence close-up,
[gene-sequence-closeup.md](../../validation/gene-sequence-closeup.md)) and the
smaller gene visualizer mounts. A requirement applies to a surface only where
its existing contract supports that context; none gains a new sequence domain.

Existing contracts this builds on, and what each already says:

- Upstream context is the exact shipped sequence in transcription orientation:
  30 nt initially, longer only from the declared sidecar; no flank is padded.
  Admitted marker rows that the current extent cannot place are kept with a
  reason (`outside-shown-sequence`), and **Show nearest/next site** reveals them
  ([gene-sequence-closeup.md](../../validation/gene-sequence-closeup.md#admitted-marker-layers-on-the-sequence)).
- Native neighbouring genes are an inventory plus a schematic; "no downstream
  sequence letters or extra sequence-camera domain are introduced"
  ([gene-neighbours.md](../../validation/gene-neighbours.md)). Requirement 2
  extends that deliberately for upstream flank bases already shown.
- Overlapping partners get aligned rows with native partner bases, 5′→3′ or
  3′→5′ labels and edge chevrons; no protein is shown
  ([gene-overlaps.md](../../validation/gene-overlaps.md#expanded-gene-viewer--the-sequence-close-up)).

### Requirement 1 — off-screen further-upstream site indicator

When a relevant, admitted TSS/regulatory-site record for this gene lies further
upstream than the displayed upstream sequence, the site display carries a
left-pointing arrow stating that further upstream sites exist and are not
visible.

- Transcription-oriented: "upstream" and "left" follow the gene's
  transcription direction, so a minus-strand gene's arrow also points left and
  means the genomic-higher side.
- The arrow explains itself (visible or accessible text): a count, the source
  layer, and the nearest hidden site's native coordinate and signed offset.
  Offsets and genomic coordinates keep their existing two frames
  ([gene-sequence-closeup.md](../../validation/gene-sequence-closeup.md#the-coordinate-frame)).
- Derived only from known admitted records that the current extent cannot place
  (the `outside-shown-sequence` set, plus rows beyond a smaller visualizer's
  domain). Absence of an arrow means no admitted record is hidden, never that
  no promoter exists. No site is inferred, extrapolated or invented; unknown,
  `no-native-coordinate` and `other-replicon` rows are not counted as "further
  upstream".
- Origin-crossing replicons use the existing wrapped upstream positions.
- Hidden layers, loading and failed layers keep their existing distinct states;
  the arrow never appears for a hidden layer's rows.
- The arrow does not replace **Show nearest/next site**; it is the passive cue
  and the button remains the action.

### Requirement 2 — annotated genes inside displayed upstream context

When upstream context is displayed and an annotated gene lies wholly or partly
in it, that gene is drawn on the upstream context, aligned to the same columns,
similar to an overlapping gene.

- Source: the existing native annotation catalogue (`contextFeatures` plus the
  OG `features`), restricted to the focal replicon. Owner choice already
  recorded: all annotated neighbours, not only protein-coding. Noncoding
  neighbours (rRNA, tRNA, other) use neutral grey with an explicit biotype label
  and no protein; nothing is fabricated for them. Pseudogene and unclassified
  biotypes keep their source labels (see
  [gene-neighbours.md](../../validation/gene-neighbours.md#display-and-interaction)).
- A coding neighbour shows its locus id/name, product, physical strand and its
  coding DNA in the displayed columns with the aligned amino-acid translation,
  analogous to an OG partner row. Only the portion inside the displayed
  upstream extent is drawn; an edge chevron says it continues, as OG rows do.
- Frame and sense: translated in the neighbour's own annotated CDS frame
  (including joined and origin-crossing segments), read in its own strand. A
  reverse-strand neighbour shows reverse-complemented codons in the focal
  gene's left-to-right columns with labels like the OG `3′→5′` convention.
  Partial codons at a display edge are marked partial. Derive a residue only
  from a complete codon available in the annotated CDS sequence; distinguish
  clipped display bases from genuinely unavailable sequence and never guess.
- The gene is a flank, not an overlap: a gene that shares bases with the focal
  gene stays an OG partner (no double listing); `overlap-blocked` and
  `OG partners never become separated flanks` still hold.
- Nonselectable loci are labelled annotated context; selectable ones reuse the
  Pin/open route and focus restoration.
- The selected upstream extent decides which annotation intervals intersect
  the view. Reuse the native annotation inventory and stable feature IDs; do
  not limit the view to the single nearest `flankingNeighbours` result if
  several genes fall inside the displayed context. Recompute visibility when
  the extent changes, without changing feature identity or source evidence.

### Requirement 3 — overlapping genes show proteins as well as codons

Each OG partner, where the partner is a coding CDS with a known frame, shows its
aligned amino-acid translation and product identity alongside the existing
codons/bases, in both the expanded close-up and the compact exact-base
disclosure.

- Native annotation/CDS frame of the partner; reverse strand and partial codons
  as in Requirement 2; a noncoding partner shows no protein and says so.
- Partner product text and locus identity appear with the translation.
- Provenance: show what the active view supports. Native partner bases stay
  native annotation bases; where the focal gene is shown original versus
  recoded, partner translation is labelled with the provenance it was computed
  from (original reference vs. recoded sequence) and never silently switches. Donor
  evidence stays in its source genome; a length-preserving recoded sequence may
  use the established native-coordinate alignment with its sequence basis named.

## Implementation Defaults (not owner-approved)

Proposed so work can start; each is open to the owner:

- Arrow glyph is a chevron beside the site row with text such as "+N further
  upstream sites not shown (nearest at −1,240)"; placed at the left edge of the
  marker row in the close-up and as a compact left-edge indicator plus the list
  note in the smaller visualizer.
- Upstream neighbour rows sit in the same lane order as OG partner rows, below
  the focal base letters, upstream flank first, one row per neighbour.
- Neighbour residues use the same residue letter and width thresholds as the
  focal protein row (letters from 9 px per codon; bars below).
- Same data source and loader path as `gene_overlaps.json` / `sequence_context.json`;
  a payload lacking them yields the existing explicit unavailable states.

## Material Ambiguities

- Whether the left arrow should also appear in the smaller visualizer when its
  coarser domain already shows the nearest site (default: show it only when a
  record is outside that domain).
- Whether the upstream-neighbour translation should reach the smaller
  visualizer or stay expanded-only (default: expanded plus a name/strand/product
  note in the smaller view; no letters).
- How recoded-sequence provenance labels partner and neighbour translations when
  a scheme changes bases inside a neighbour (default: native original shown,
  recoded translation shown only where the recoded sequence of that locus exists
  and is labelled).

## Acceptance Criteria

Not met; each needs the test or rendered check named.

1. Arrow appears exactly when ≥1 admitted, visible-layer record is
   both upstream and `outside-shown-sequence` for the shown extent, points left for both strands,
   states count/source/nearest coordinate, and disappears once the extent
   places every such row; test with plus, minus, origin-crossing, no-context and
   hidden/loading/failed-layer fixtures and an independent oracle over the
   shipped Tan rows.
2. No arrow or text claims promoter absence; no inferred site exists in
   unit, export or accessibility output.
3. Every annotated gene inside displayed upstream is drawn with strand, product,
   coding DNA and aligned translation matching an independent translation of the
   native annotation (multiple neighbours, both strands, joined, origin-crossing, partial codons at
   the extent edge, pseudogene, noncoding grey with no protein).
4. No gene is both OG partner and upstream neighbour; neighbour identity is
   stable across extent, scheme, filter and camera changes.
5. Each OG partner shows product and aligned protein with codons, correct for
   same/opposite strand, split/origin, coincident, noncoding (none) and
   unavailable; protein equals independent translation of the partner CDS.
6. Original/recoded provenance is labelled and never silently switches; no
   donor-site claim in native coordinates.
7. Smaller visualizer behaviour follows the resolved ambiguities above; both
   viewers keep keyboard/touch access, focus restoration and no horizontal
   overflow.
8. Contract docs updated: `gene-sequence-closeup.md`, `gene-overlaps.md`,
   `gene-neighbours.md` (the "no downstream/extra letters" line) and exports if
   columns change.
9. Rendered validation at 375×812, 768×1024, 1280×800, 1440×900 and both sides
   of the 960/1240 px breakpoints, using the loci named in `gene-neighbours.md`
   plus a Tan-rich minus-strand gene; then the gates in `AGENTS.md`.

## Verification

Documentation only: no code, data or rendered check has run. Requirements were
recorded verbatim from the owner; existing-contract statements above were read
from the cited validation documents at baseline `3f4ad333`.

## Cleanup

Distill the final upstream-indicator, flank-translation and OG-protein contracts
into `gene-sequence-closeup.md`, `gene-overlaps.md` and `gene-neighbours.md`,
then delete this ticket and its index row.

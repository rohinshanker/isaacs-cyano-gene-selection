# Overlapping genes (OG)

Reusable contract for the overlapping-gene relation: how it is defined, where it
is published, how each view draws it, and the checks it has to pass.

The definition and the payload are in
[data-contract.md § Overlapping genes](data-contract.md#overlapping-genes-and-what-overlapsneighbor-is-not).
Everything below is what the browser does with it.

## One relation, one definition, one index

`site/js/core/gene-overlaps.js` is the only module that decides what an overlap
is. It validates the payload, re-derives every shared interval from the two
features' own segments, and builds the index **once**, when the file is joined.
Nothing in the OG feature recomputes a relationship on a pointer move, a redraw,
a zoom, a pan, or a filter change: a view asks the index.

The index is cached on the dataset as `dataset.geneOverlaps` and every plotted
gene is given two fields by the loader:

- `gene.overlapPartners` — its partners, **widest shared overlap first**, each
  carrying identity, biotype, strand, exact segments, the exact shared
  intervals, the shared base count, the strand relation, the containment
  direction, and whether the map plots it;
- `gene.overlapClass` — one of the four OG classes.

An **array** of no partners means the layer was read and this gene shares no
base with another annotated gene. **No array at all** means nothing has been
read. The two are never collapsed; every surface says which one it is.

## The four classes

Mutually exclusive, exhaustive over genes whose context is known, and the
vocabulary of both the colour mode and the filter:

| id | label | rule |
| --- | --- | --- |
| `no-overlap` | No overlapping gene | shares no base with another annotated gene |
| `overlap-same-strand` | Overlaps on the same strand | every partner whose strand is recorded is on this gene's strand |
| `overlap-opposite-strand` | Overlaps on the opposite strand | every partner whose strand is recorded is on the other strand |
| `overlap-both-strands` | Overlaps on both strands | partners on both strands |
| `overlap-strand-unrecorded` | Overlaps a gene of unrecorded strand | it overlaps and the release records a strand for none of its partners |

A partner whose strand the release does not record adds no relation, because
there is none to read: a gene with one recorded partner and one unrecorded one
is classed by the recorded one, and only a gene whose partners are *all*
unrecorded falls in the last class. Calling that case "both strands" would
invent a transcription direction nobody annotated. The classes separate the
strand relation the annotation records and assert nothing about what an overlap
means for a recoding decision.

**Containment is carried per partner, not as a class**: one gene can contain
one partner and lie inside another, so a containment class would have to
choose. `overlap-unavailable` is a *state*, not a class: it is what every gene
shows while the layer has not been read, drawn in the same neutral the function
categories use for the same reason.

## The filter is one channel

`state.overlapClassFilter` is the set of classes the reader is keeping, carried
in the hash as `og`. Both surfaces write that one set:

- the **Overlapping genes (OG)** fieldset in Filters offers the owner's three
  options — *Show all genes*, *Only overlapping genes*, *Only non-overlapping
  genes* — which are the empty set, the three overlapping classes, and
  `no-overlap`;
- the **OG colour key**'s per-class rows toggle one class each.

A selection the three options cannot express (two classes out of four, say)
leaves none of the radios checked and the panel names the classes in force
instead. Two independent filter channels would let the panel and the key
disagree about which genes are hidden, and a reader could not tell which was in
force.

Counts quoted beside the filter are of the **whole plotted set**, never of what
the other filters leave: the tag records genomic context, so they must not move
as a reader narrows something else.

While the layer has not been read the two narrowing options are disabled and say
why, and a selection carried in from a link is **suspended** rather than
applied: `overlapFilterActs` is false, nothing is hidden, and the panel and the
colour key both say the selection cannot act yet. Applying it would either hide
everything or — worse — present every unknown as a satisfied *only
non-overlapping* result.

## The tag never depends on what is visible

This is the rule the whole feature rests on, and it is the one to re-check after
any change:

- hiding a partner with any filter changes neither the gene's class, its partner
  list, its badge, its underline, nor the overlap row's block;
- the chromosome overlap row is not masked at all, and **Show filtered-out
  genes** governs the gene lanes and not that row;
- opening a partner the current filters hide is allowed, and the announcement
  says so;
- a partner that is not a plotted CDS — a tRNA, an rRNA, a pseudogene, an
  excluded locus — is named and drawn, and says it cannot be opened, rather than
  being dropped or offered a route that goes nowhere.

**And nothing stands in for the layer when it has not been read.** The answer is
unknown, and every surface says so: the export columns are blank, the
panel-design caveat states the unknown (and may name the older
`overlapsNeighbor` flag beside it, labelled as the different and narrower
quantity it is, never as the answer), the ambiguity constraint drops split
coding sequences only and the design says the overlap half did not act, and the
class filter is suspended. Substituting the legacy flag would quietly hand back
the 3 / 70 / 8 / 34 / 15 plotted loci per organism that it cannot see.

## Chromosome view

A dedicated **overlap row** per replicon band, between the lower operon-bracket
row and the tick labels (`bandLayout().overlapTop`/`overlapBottom`). It is its
own row and not a glyph on a gene's bar, because a shared stretch belongs to two
genes that may sit in different lanes: drawn in either lane it would have to be
drawn over one of them.

- one block per shared stretch, at the coordinates both genes occupy, snapped to
  a whole column with a one-pixel floor, so the row reads as overlap density at
  whole-genome zoom;
- a block at least `MIN_OVERLAP_ARROW_PX` wide carries the pair's two direction
  arrows, one per partner, which is the readable close-zoom representation;
- each overlapping CDS also carries a two-pixel **underline inside its own bar**
  over the bases it shares, in its own strand lane, so the strand the lanes carry
  is kept and the colour the bar has is still readable through it;
- hovering a block, or pressing **O** (**Shift+O** backwards) with the track
  focused, names both genes, their strands, the shared interval and the shared
  base count in a pointer-transparent fixed overlay anchored to the canvas mark
  but clamped to the usable viewport outside any visible header,
  and outlines the block **and both partner bars at once**. The matching
  `role="status"` announcement is visually hidden, so changing or dismissing
  the hint cannot change the figure height or canvas coordinates. Scrolling the
  page or a nested container, or resizing the viewport, dismisses the fixed hint
  so it cannot float over unrelated content;
- clicking a block, or **Enter** while one is inspected, pins the plotted gene
  that is not already pinned, so the pair can be walked; a pair with no plotted
  gene pins nothing and says why;
- a first touch on one non-coincident block shows its hint and a second touch
  opens its plotted gene; the touch contact's browser-generated `pointerleave`
  does not dismiss that first-tap hint. **Escape** dismisses a keyboard hint
  from the canvas or either overlap stepper. The overlay has no pointer events,
  so it cannot break hover or steal the second touch;
- **a mark is a pair, not an interval.** Two different pairs can cover exactly
  the same bases — MG1655's `b4793`/`b4647` and `b4793`/`b4455` both cover
  3,720,448–3,720,471 — so every mark carries a `key` built from the replicon,
  both loci and the interval, and that key is what the inspected mark is
  compared by and what `stepOverlap` looks up. A repeated click or tap on
  shared pixels advances to the next pair there and wraps, and says how many
  share them, so the touch route reaches every coincident pair and not only the
  first; hovering names the nearest and does not cycle under the pointer;
- the conventions note and the canvas's accessible description carry the rule,
  the count of stretches on the primary track, and the unavailable state, from
  the one `overlapConventions()` call, so the two cannot disagree.

## Expanded gene viewer — the sequence close-up

One **aligned partner track per partner** under the residue ruler, on the
strip's own coordinate scale, so a partner's bases sit under this gene's bases:

- a pale bar over every column the partner's own annotated segments occupy,
  with a thin tail whose exact endpoints are the shared coordinates. A
  fixed-size outlined arrowhead is a visibility aid rather than genomic extent;
  both use the same column map as the letters, so the tail and base row cannot
  disagree about which base belongs to the partner. Tail and head occupy a
  narrow lower lane beneath the base letters, never striking through them;
- at letter-readable zoom, the actual shared partner bases are text aligned
  under the selected gene's native bases. A same-strand row repeats those
  letters and reads 5′→3′; an opposite-strand row shows their Watson-Crick
  complements and reads 3′→5′ from left to right. Both orientations are
  labelled in the row gutter. An unrecorded strand gets `?→?`, no arrow and no
  inferred bases; unavailable native sequence is named rather than fabricated;
- **edge continuation** is a chevron at the clipped edge, drawn from the genomic
  answer — whether the partner occupies the next base beyond what is drawn,
  stepped around the replicon — and not from the bar reaching the edge. Both
  edges can carry one, which is a partner this gene lies inside;
- one row per partner, never one shared row: two partners in one row would hide
  each other exactly where they share a base of this gene;
- a partner occupying no column the strip shows, and any partner past
  `MAX_PARTNER_ROWS`, keeps its row in the list beneath with its exact shared
  interval;
- the partner name in the list is a **Pin `<id>`** button for a plotted partner,
  which is the navigation route; the track itself is clickable and
  keyboard-activatable for the same thing.

**Opening a partner hands focus on.** Pinning rebuilds every gene surface,
including the control the reader activated, so `openOverlapPartner` reads which
labelled region the activation came from *before* the rebuild and puts focus
back into it afterwards — the controls-column visualizer, the detail column's,
or the sequence strip, each a focusable group with an accessible name. A region
that did not survive falls back to the gene detail column. Without it a
keyboard reader lands on `<body>`, which is what a browser check of the first
implementation found.

The partner list lives in **its own host**, not the marker list's. Each list
writer asks whether the reader is standing in *its* host before it replaces its
contents; sharing one host makes each writer carry the other's focus away on
every render.

## Smaller gene viewer

Owner decision Q3, and only this:

- an **OG badge** in the heading with the partner count, whose title and
  accessible name expand the abbreviation and state the rule. Built on every
  gene whose context is known, including a gene with no partner, because only a
  badge that is always there can tell *nothing shares a base with this gene*
  apart from *nobody looked*;
- a **compact overlap strip** in one reserved lane under the coding track, with
  a thin tail over each exact shared stretch and a fixed-size directional head
  per partner. The head is outlined and documented as a visibility aid, while
  only the proportional tail encodes genomic extent.
  The lane is reserved on every gene, so selecting a gene with no overlap moves
  no other row — the same rule the close-up's marker row follows;
- a one-base tail keeps its proportional width while the fixed-size head and a
  separately padded hit target keep it visible and reachable. Marks that share
  drawn space are **counted in the label**, the way this view already treats
  crowded start-site heads. The strip is a compact display of the relationships
  and is labelled as such;
- every mark is focusable, carries a `<title>`, and names its partner;
- a complete **partner list** under the picture, with an **Open `<id>`** button
  for each plotted partner and a stated reason for each one that is not. Each
  row also has an exact-base disclosure with aligned selected/partner sequences,
  genomic coordinates and 5′/3′ labels; long rows scroll inside the disclosure
  rather than overflowing the page, and missing sequence or strand is explicit.

## OG colour mode

`Colour by → Overlapping genes (OG)`, a second categorical channel beside
Function category, offered for every organism whatever its layer has done — the
legend states the unavailable case, which is a state a reader has to be able to
reach. One distinguishable filled hue per class, none of them the pale grey an absent
value draws in: a gene measured as overlapping nothing is a measurement, so it
is **filled**. While the layer is unread there are no class rows at all, only
the neutral swatch and the sentence that says nothing has been read; rows with
zeroes beside them would read as a genome whose genes overlap nothing.

The key carries **one short rule** and nothing else. The full definition, the
field names behind it and the biotype census live in the colour explanation
disclosure, which is this view's convention for anything a key would have to
shrink to fit; `describeOverlapRule` is the short form and
`describeOverlapDefinition` the long one, and both read the payload's own
`definition` block.

## Exports and panel design

The export carries `overlapClass`, `overlapPartnerCount`, `overlapSharedBases`
and `overlapPartners` (`id:biotype:strand:sharedBases:from-to+from-to`), so the
relation can be rebuilt from the file. `overlapsNeighbor` keeps its own column
and its own meaning beside them.

`core/panel-design.js` prefers the layer for its ambiguity constraint and its
caveats, naming the partners and the bases shared, and falls back to
`overlapsNeighbor` under that field's own wording when no layer is joined, so a
deployment without the layer never silently loses the caveat.

## Rebuilding

```sh
for org in utex2973 ecoli-k12-mg1655 ecoli-mds42-public-reference \
           ecoli-dh10b-public-reference ecoli-syn61-delta3-ev5; do
  .venv/bin/python tools/build_gene_overlaps.py build --organism "$org"
  .venv/bin/python tools/build_data_manifest.py build --organism "$org"
done
```

`tools/build_gene_overlaps.py check --organism <id>` compares the published
bytes with a fresh build and fails on a stale or hand-edited layer. Run `build`
before `tools/build_data_manifest.py build`, which is the gate that refuses a
manifest that no longer matches.

The producer needs only that organism's `*_genomic.gff.gz`. In a worktree where
`data/raw` is gitignored and empty, link the canonical inputs read-only first;
without them the contract validator **skips** its re-derivation rather than
failing, and the skip is the thing to notice.

## Checks

`tests/test_gene_overlap_sweep_oracle.py` independently expands 1,000 seeded
synthetic cases into finite base sets and compares pair intersections with the
sweep. It checks multiple replicons, split segments and coincident intervals
without reusing the producer's interval-intersection implementation.

Deterministic, in `tests/test_gene_overlaps.py` (the producer, over synthetic
annotations) and `tests/js/gene-overlaps.test.mjs` (the model and the loader):

- a gene occupies its child segments, not its envelope — a gene inside the gap
  of a joined CDS shares nothing;
- abutting ends do not overlap and one shared base does;
- a multi-exon RNA contributes its exons;
- a gene row with no child uses its own span and is marked `segmentSource:
  "gene"`;
- every compared gene is named in `coveredGenes`, whether or not it overlaps,
  and the pairwise base count is not a count of distinct bases;
- two CDS isoforms of one gene count a shared base once;
- containment, both strands, several partners, non-adjacent partners;
- different replicons never pair, and an origin-crossing gene pairs on each of
  its two real pieces and not in between;
- non-coding and pseudogene rows count; `riboswitch` and `misc_feature` do not;
- a gene never overlaps itself through its own segments;
- the payload is byte-stable, and the relation does not depend on row order;
- the loader refuses a shared interval the segments do not support, a pair
  across replicons, an out-of-order pair, a mis-declared replicon length, a
  segment past the end of its replicon, non-canonical segments, a duplicate
  locus, a coverage block the listed relations do not support, a layer that
  disagrees with `genes.json` about a plotted CDS, and a layer that does not
  name every plotted CDS in `coveredGenes`.

Behavioural, in `tests/js/chromosome-view.test.mjs`,
`tests/js/gene-sequence-view.test.mjs`, `tests/js/gene-overlap-controls.test.mjs`,
`tests/js/export-manifest.test.mjs`, `tests/js/panel-design.test.mjs` and
`tests/js/url-state.test.mjs`: the row's own band and blocks, the arrows at a
readable zoom and none at whole-genome zoom, the underline inside the bar, the
pointer, touch and keyboard overlay with both partners outlined, partner
opening and the pair with nothing plotted, the row surviving a mask that hides
every gene, the aligned partner tracks, actual same/opposite-strand bases,
orientation labels and chevrons, the partner the strip cannot place keeping its
row, the badge's three states, the compact strip's exact tails, fixed heads and
exact-base disclosures, the filter's three options and its custom-selection notice,
the colour key's five rows and its unread state, the export columns in both
states, the ambiguity caveat in both, and the hash round-trip. Ordinary arrow
navigation ends overlap inspection so Enter pins the gene just announced.
Consecutive arrow changes in the OG radio group retain focus; if a focused
choice becomes unavailable, focus moves to the enabled Show all genes option.
Unrelated updates never take focus from another control.
Chromosome overlap hints are overlay-only, pointer-transparent and viewport
clamped; hover content changes, pointer exit, keyboard stepping, Escape and the
two-tap touch path preserve the canvas and panel geometry.

Rendered: all three views at 375×812, 768×1024, 1280×800 and 1440×900, and
across the 960 px and 1240 px column breakpoints. Exercise a gene with no
partner, one with several, a one-base overlap, a partner that is not a plotted
CDS, an origin-crossing locus, the OG colour mode and each filter state, a
hidden partner, and the unavailable state (point `?data=` at a directory with no
`gene_overlaps.json`). Collect console, page and request diagnostics and fail on
an unexpected one.

Then the gates in [AGENTS.md](../../AGENTS.md).

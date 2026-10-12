# O_neighbor-tss-coding-overlap__20261012 — Open

Scope: Filter, colour and visualize genes whose coding segments contain TSSs associated with neighbouring genes.
Status: open
Opened: 2026-10-12
Updated: 2026-10-12

## Current State

Requested by the owner. Add a shared relationship between a source-associated
neighbouring-gene transcription start site (TSS) and each focal gene whose coding
segments contain that site's coordinate. Implementation is unclaimed.

## Requested behaviour

- **Filters:** allow all genes, genes with a neighbouring-gene TSS in their coding
  segments, or genes without such a recorded overlap. Compose with existing
  filters and distinguish unavailable evidence from a known empty result.
- **Color by:** add a corresponding neighbouring-gene TSS overlap option. The
  legend must distinguish recorded overlap, no recorded overlap and unavailable
  evidence; gene details expose the distinct-site count and contributing sites.
- **Chromosome viewer:** mark the exact overlapping TSS positions against the
  affected coding segments. Identify the TSS-associated neighbouring gene and
  the gene containing the site, with site strand and source provenance.
- **Gene viewer:** show the same sites within the focal gene's coding track in
  compact and expanded views. Support inspecting the site and navigating to its
  associated gene where that gene is selectable. Preserve readable targeting when
  multiple sites coincide or lie close together.

## Acceptance criteria

- Join only records with matching organism, native assembly and replicon. Test
  TSS anchors against the union of actual CDS segments, including boundary bases;
  gaps between split segments and upstream display padding do not count.
- Include both same- and opposite-strand associations, with strand labels
  relative to the focal gene. Handle reverse strands and circular-origin joins.
- Preserve the source's TSS-to-gene association. Do not assign ownership from
  coordinate proximity or silently restrict candidates to the closest plotted
  neighbour. A site associated only with the focal gene is not a neighbouring-
  gene TSS; retain all associations for multiply assigned sites. Report ambiguous
  or unassigned associations explicitly without inventing a neighbouring owner.
- Use admitted, coordinate-resolved site evidence. Define deduplication for
  repeated site/condition records while retaining their provenance and conditions.
  A point overlap does not establish a promoter footprint, expression effect or
  regulatory interaction; label the displayed relationship accordingly.
- Derive filter status, colour status, counts and viewer marks from one shared
  relationship. Hiding a neighbouring gene must not erase its site's overlap.
  Source selection, loading failures and organism changes must update or suspend
  all affected controls consistently; unknown evidence must never become zero.
- Preserve existing TSS visibility controls, self-associated TSS markers and OG
  gene-overlap controls. Follow existing reset and saved-state/share-link rules.

Related work: [native neighbouring genes](../../validation/gene-neighbours.md),
[overlapping genes](../../validation/gene-overlaps.md), and the separately owned
[Tan condition-selection ticket](A_tan-condition-selection__20261012.md). Use its
accepted source contract when applicable; do not take over its active work.

## Verification

Before implementation closes: test inside/outside and exact-boundary anchors,
split-CDS gaps, both strands, origin wrapping, self-only and multi-gene
associations, duplicate condition records, several sites per gene, hidden
neighbours, unavailable evidence, source selection and organism isolation.
Check agreement between filters, colours and both viewers. Render mobile,
tablet and desktop layouts, keyboard inspection/navigation and dense/coincident
markers. Run the required repository gates and record final results here.

## Cleanup

Remain open until claimed and implemented. The owning session must account for
all open findings, preserve the reusable association/coordinate and display
contracts in docs/validation, then resolve and remove this ticket and its queue
row under the repository's closure rules.

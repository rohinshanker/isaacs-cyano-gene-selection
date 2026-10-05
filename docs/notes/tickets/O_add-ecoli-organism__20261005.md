# O_add-ecoli-organism__20261005 — Open

Scope: Add E. coli as a selectable organism in the visualizer.
Status: open
Opened: 2026-10-05
Updated: 2026-10-05

## Current State

Lightweight planning ticket requested by the owner. Add a selector at the top of
the visualizer offering **Cyanobacteria** and **E. coli**, with Cyanobacteria
selected by default. The existing cyanobacterial view is UTEX 2973.

The purpose is to offer E. coli as a fallback model organism users can explore
for richer annotations and more robust supporting data. These are desired
benefits to assess for the chosen strain and sources, rather than a blanket
claim that every E. coli annotation or measurement is more accurate.

Implementation and source selection have not started. Detailed feature design
can follow the questions below; this ticket intentionally stays preliminary.

## Verification

Ticket and live-index consistency checked when opened. For implementation:
verify the default organism, switching and return behavior, organism-specific
labels and data, URL restoration, and absence of mixed-organism state. Render
the selector and affected views at mobile, tablet, and desktop widths, then run
the repository's JavaScript, Python, and data-contract gates.

## Cleanup

Keep open while planning. Once implemented and validated, distill reusable
organism/data isolation and selector guidance into docs/validation/, update its
index, resolve this ticket, and remove it from the live queue.

## Initial feature outline

- Top-level organism selector, with Cyanobacteria as the fresh-view default.
- E. coli opens its own organism view, with the strain and reference assembly
  identified. Dataset provenance and unavailable features remain visible.
- Decide which existing capabilities ship first: gene/chromosome views,
  annotations, metric filters, expression/essentiality evidence, recoding,
  candidate comparison, and exports.
- Keep loci, coordinates, metric populations, saved selections, and exports
  associated with their organism. Any future cross-organism annotation transfer
  needs explicit mapping and evidence labels.

## Clarifying questions

1. Which E. coli strain and reference assembly should come first, for example
   K-12 MG1655? Is a single strain enough initially?
2. Should the first release support the full recoding workflow, or begin with
   browsing genes, annotations, and evidence?
3. Which data matter most initially: curated functions/pathways, regulatory
   sites and operons, expression, essentiality, or protein evidence?
4. Is switching to an independent E. coli view enough, or should users also
   compare matched genes or consult E. coli evidence from a cyanobacterial gene?
5. When switching organisms, should each view remember its own scheme,
   filters, pinned gene, and shortlist, or start fresh?
6. Should shareable URLs and saved schemes remember the selected organism?
   Should the Cyanobacteria option later expose a separate strain selector?

## Scientific dependencies

No new source is selected or admitted by opening this ticket. Selector planning
can proceed independently. Once strain and source scope are chosen, add precise
Claude Science claim rows and pending-index entries for source admission and any
cross-organism evidence transfer, following
[claude-science-handoff.md](../../validation/claude-science-handoff.md).

Related context: the
[cross-strain scan](O_cross-strain-data-scan__20260927.md) covers cyanobacterial
dataset selectors; the
[UTEX BioCyc ticket](O_biocyc-utex-2973-data__20260930.md) separately asks whether
curated E. coli evidence should be shown on matched UTEX loci.

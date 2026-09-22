# O_annotation-source-view__20260922 — Open

- Scope: annotation display in the candidate detail panel, gene list, search suggestions, and export; source-scoped views over UTEX 2973, PCC 7942, and GO IEA annotations.
- Status: open
- Opened: 2026-09-22
- Updated: 2026-09-22

## Current State

Annotations shown for a gene are currently a combination of every admitted
source: the UTEX 2973 RefSeq release (product, symbol, reviewed function
categories), the PCC 7942 layer joined by exact crosswalk (Adomako/Rubin
essentiality and PCC locus tags), and the GO IEA relationships from
`go-annotations-v1.tsv`. There is no way to look at one source on its own.

Add an annotation-source selector with four choices: **All sources**
(current combined behaviour, the default), **UTEX 2973**, **PCC 7942**, and
**GO IEA**. Choosing a single source shows only that dataset's annotations for
every gene and sorts/orders annotation fields by that source:

- If the chosen source has no annotation for a gene, its annotation fields are
  left blank. Do not fill the gap from another source, do not show "unknown"
  as if it were a value from that source, and do not fall back silently. A
  blank means the source is silent for that locus.
- The selected source applies consistently across the detail panel, any list
  or table view, category-label and GO search suggestions, and the export.
  Export records the selected source so a file cannot be mistaken for the
  combined view.
- Each source keeps its own evidence wording, citation, and licence
  attribution (RefSeq/NCBI, Adomako/Rubin CC BY 4.0, Gene Ontology Consortium
  CC BY 4.0). Cross-strain assumption wording stays attached to PCC 7942
  values in the PCC-only view.
- Encode the selected source in the URL state so a shared link reproduces the
  same view. A fresh view starts on All sources.

This is a display and ordering feature. It must not change any join, category
assignment, or essentiality call, and it must not change the panel objective.
It composes with `O_category-legend-hover-filter__20260922` (category filters
apply within the chosen source's view) and with
`O_essentiality-go-iea-fallback__20260922` (the GO IEA fallback and
discrepancy notes belong to the All sources view; a single-source view shows
only that source's own values).

## Verification

Pending: unit tests that a single-source view returns blank fields for loci
the source does not cover, that All sources is unchanged from current output,
and that URL and export round-trip the selection; data-contract update if
`site/data/*.json` changes; rendered inspection of each source view for a
locus covered by all three sources and one covered by only one, at desktop and
narrow breakpoints per the `ui-render-inspect-repair` skill.

## Cleanup

Distill the source-view contract and blank-value semantics into
`docs/validation/data-contract.md` and
`docs/validation/viewer-interaction-state.md`, update
`docs/validation/INDEX.md`, then delete this ticket and its queue row.

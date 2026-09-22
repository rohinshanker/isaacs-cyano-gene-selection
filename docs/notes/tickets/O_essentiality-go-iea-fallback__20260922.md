# O_essentiality-go-iea-fallback__20260922 — Open

- Scope: essentiality evidence layer, GO IEA annotations, UTEX 2973 and PCC 7942 annotation reconciliation, candidate detail panel and export.
- Status: open
- Opened: 2026-09-22
- Updated: 2026-09-22

> This ticket may be picked up at any point by an active agent when it is
> relevant to restructuring, architecting, or reprioritizing current tasks
> (for example while extending the resolved PCC 7942 essentiality work in
> `docs/validation/pcc-essentiality.md`). It does not need to wait for a
> separate assignment; record the pickup by setting the status to active and
> noting the owning session.

## Current State

Essentiality for a UTEX 2973 candidate currently comes only from the licensed
Adomako/Rubin PCC 7942 calls joined by exact RefSeq crosswalk
(`docs/validation/pcc-essentiality.md`). Loci without an admitted join, and
loci whose source call is ambiguous, not analysed, or blank, remain `unknown`.

Add a fallback: when no PCC 7942 essentiality call is admitted for a locus,
essentiality context may fall back on the locus's GO IEA annotations
(`go-annotations-v1.tsv`, all rows currently `IEA`). The fallback is a
lower-tier evidence label, never a replacement for a measured call:

- Display it with its own evidence tier and wording (computational GO IEA
  inference, not a knockout result), distinct from the PCC cross-strain badge
  and from tested UTEX alleles.
- Define explicitly which GO terms or aspects count as essentiality-relevant
  context and record that rule in `docs/validation/`; do not treat raw GO row
  count as evidence.
- Keep the panel objective free of the fallback, as it already is for borrowed
  PCC essentiality.
- Preserve Gene Ontology Consortium CC BY 4.0 attribution and the
  `data/annotation/PROVENANCE.md` notice for any derived field.

Discrepancy reporting: where the GO IEA annotations for a locus disagree with
the UTEX 2973 or PCC 7942 annotations used for the essentiality join or the
reviewed function categories (for example a product name or reviewed category
that contradicts the GO inference, or a PCC call that contradicts the GO-based
context), the discrepancy must be mentioned explicitly in the candidate detail
panel and carried into the export. Do not silently prefer one source.

## Verification

Pending: build check for the derived fallback field with counts by evidence
tier; unit tests for the precedence (tested UTEX allele > admitted PCC call >
GO IEA fallback > unknown) and for discrepancy detection; data-contract update
if `site/data/*.json` changes; rendered inspection of the detail panel and
export for a locus in each tier and for at least one discrepancy case.

## Cleanup

Distill the fallback rule, precedence, and discrepancy contract into
`docs/validation/pcc-essentiality.md` and
`docs/validation/annotation-release-readiness.md`, update
`docs/validation/INDEX.md`, then delete this ticket and its queue row.

# A_annotation-search-noncoding__20261014 — Active

Scope: Owner decision D10 of 2026-10-14, split from
[O_cross-strain-data-scan__20260927](O_cross-strain-data-scan__20260927.md): general
annotation search and open support for noncoding genes and pseudogenes in every
organism view, kept outside CDS-only metrics, filters, shortlist and recoding
candidates and codon-based projections, and a clear distinction of
hypothetical proteins (predicted protein-coding, function unknown) from
known-function CDSs without calling them noncoding. Covers `site/`, `tests/` and
`docs/validation/`.
Status: active
Opened: 2026-10-14
Updated: 2026-10-14

## Current State

Claimed 2026-10-14 by session cyano-unblocked-tix, implementing on branch
`work/annotation-search-20261014` in `../worktrees/annotation-search-20261014`.
The owner's wording is under "Reference-view decisions and implementation scope"
in the parent ticket. The native annotation catalogue already ships as the
`features` and `contextFeatures` arrays of `gene_overlaps.json`
([gene-neighbours.md](../../validation/gene-neighbours.md)); for UTEX 2973 it holds
61 non-CDS records (44 tRNA, 7 pseudogenes, 6 rRNA, 4 other RNAs) with locus tag,
name, biotype, strand and segments, and no product description.

## Acceptance

- Find a gene finds noncoding genes and pseudogenes by locus tag and name, in
  every organism view, labelled with their biotype and kept apart from CDS hits.
- Opening one shows its annotation record: biotype, pseudogene flag, replicon,
  strand, exact segments, and existing neighbour/overlap context. It does not pin
  a CDS, fabricate protein or codon metrics, or enter filters, the shortlist,
  recoding candidates, exports of CDS metrics or any projection.
- The separate tRNA browser stays as it is; a tRNA hit can point to it.
- Hypothetical proteins are labelled as predicted protein-coding with unknown
  function wherever a CDS's function is summarised, and are never called
  noncoding.
- While the catalogue is loading, failed or absent, search says non-CDS records
  are unavailable rather than returning nothing silently.

## Verification

To record: Node tests for search, open and exclusion; the three repository gates;
rendered checks at mobile, tablet and desktop widths for search results and the
opened record in UTEX 2973 and E. coli.

## Cleanup

Distil the search and open contract into `docs/validation/`, update its index,
then close under AGENTS.md and remove this ticket and its queue row.

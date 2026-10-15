# R_annotation-search-noncoding__20261014 — Resolved

Scope: Owner decision D10 of 2026-10-14, split from
[O_cross-strain-data-scan__20260927](O_cross-strain-data-scan__20260927.md): general
annotation search and open support for noncoding genes and pseudogenes in every
organism view, kept outside CDS-only metrics, filters, shortlist and recoding
candidates and codon-based projections, and a clear distinction of
hypothetical proteins (predicted protein-coding, function unknown) from
known-function CDSs without calling them noncoding. Covers `site/`, `tests/` and
`docs/validation/`.
Status: resolved
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

## Outcome

Closed 2026-10-14 by session cyano-unblocked-tix, which owned and implemented it.

Find a gene lists annotated genes outside the plotted CDS set, in every organism,
as their own group under the CDS hits: noncoding RNA genes, pseudogenes, and
coding genes the pipeline excluded, such as E. coli's selenoproteins, which are
named as coding genes with the pipeline's reason and never called noncoding
(43be265, e7a1727). Open expands a read-only card with type, pseudogene flag,
replicon, strand, segments, overlap partners and flanking genes; partner and
flank CDSs open as CDSs, and a tRNA opens the tRNA browser once its list is
loaded. Records have no pin, shortlist, filter, metric, export or projection.
Catalogue loading, failure and absence are said. CDSs whose product is
"hypothetical protein", "(putative) uncharacterized protein" or Syn57's
"uncharacterized design CDS" carry an unknown-function note in search, the detail
panel, both gene viewers, the shortlist, the panel designer and the comparison
table. Contract distilled to `docs/validation/viewer-interaction-state.md`.

## Findings against the work

Codex `gpt-6-astra` at xhigh reviewed 43be265:

- R1 major, excluded coding genes listed as noncoding: resolved in e7a1727 and e888e0d.
- R2 major, absent catalogue not said: resolved in e7a1727.
- R3 major, card disclosure state and focus lost on redraw: resolved in e7a1727.
- R4 minor, tRNA hand-off while its list loads: resolved in e7a1727.
- R5 minor, panel designer lacked the unknown-function note: resolved in e7a1727.
- R6 minor, punctuation-only query matched every record: resolved in e7a1727.
- N1 minor, an absent tRNA file read as loading: resolved in e888e0d.
- Self-found: an opened card was clipped inside the result list's scroll box;
  resolved in 43be265 before review.

The same reviewer confirmed all of them resolved with no new defects. No finding
is open.

## Final validation

On branch `work/annotation-search-20261014`, 2026-10-14: `npm test` 1,634 pass;
`.venv/bin/python -m pytest -q` 2,181 pass, 20 skipped, run with the main
checkout's ignored raw inputs linked in; `tools/validate_contract.py` 130 pass,
1 skipped; module preloads match. Rendered in Chromium at 375, 768, 1280 and
1440 px with no console errors or horizontal overflow: pseudogene and tRNA
searches, an opened tRNA card with nothing pinned, the tRNA browser hand-off,
E. coli K-12 rRNA and selenoprotein records, the neighbour disclosure across a
redraw, and the unknown-function note in search and the detail panel. UTEX 2973
has 61 such records and 394 unknown-function CDSs.

## Cleanup

Distil the search and open contract into `docs/validation/`, update its index,
then close under AGENTS.md and remove this ticket and its queue row.

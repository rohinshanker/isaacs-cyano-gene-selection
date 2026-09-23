# Function-category dataset contract

`site/data/function-categories-v1.json` is the versioned, sparse category layer
for the pinned UTEX 2973 RefSeq release. Rebuild or check it with:

```sh
python3 tools/build_function_categories.py
python3 tools/build_function_categories.py --check
python3 -m pytest -q tests/test_function_categories.py
```

The generator contains the complete user review admitted on 2026-09-22: 13
exact locus/product/symbol rows and the 11-label vocabulary. It checks every
reviewed row against `site/data/genes.json` and derives organism and release
identity from `data/manifest/annotation-release-v1.json`. A changed locus,
product, symbol, or release fails the build; it must be reviewed rather than
silently adopted.

## Consumer rules

Category colour can come from three annotation sources, each with its own
evidence label. The viewer shows three checkboxes, **UTEX 2973**, **PCC
7942**, and **GO IEA**, inside the legend directly above the category
section, visible only when **Colour by** is Function category. They govern
category colouring and the legend counts only; every other view always shows
every source.

- **UTEX 2973 (reviewed).** Only rows in `assignments` are reviewed rows. A
  CDS absent from that sparse array has no UTEX category. One category ID
  displays that category; two or more explicitly reviewed IDs display the
  separate `multiple-functions` bucket. Raw GO row count never creates
  multiple functions.
- **PCC 7942 (derived).** A category judged from the joined PCC 7942 product
  name (and PCC GO terms where a pinned PCC GAF is admitted; none is today)
  for CDSs with an exact crosswalk join, built offline with TypeSafe Jev under
  a frozen blinded rubric and pinned in
  `site/data/source-derived-categories-v1.json` with its probability.
- **GO IEA (derived).** A category judged from the locus's evidence-coded GO
  IEA terms, built and pinned the same way in the same file. Both derived
  sources assign only at probability 0.8 or above; the rubric, threshold
  calibration, blinded spot check, and rebuild checks are in
  [source-derived-categories.md](source-derived-categories.md).
- **Precedence.** With the enabled sources, a CDS takes the UTEX reviewed
  category when one exists, otherwise the PCC-derived category, otherwise the
  GO-derived category, otherwise unknown or unclassified. Derived categories
  never enter the reviewed table, never change the reviewed rows, and never
  display without their evidence label (`reviewed`, `pcc-7942-derived`,
  `go-iea-derived`).
- **Conflicts.** When enabled sources assign different categories to one CDS,
  the CDS is coloured by the highest-priority enabled source and the gene
  detail panel and export list every source's category with an explicit
  conflict note. Conflicts never move a CDS into the multiple-functions
  bucket; that bucket is reserved for a single source assigning two reviewed
  categories.
- **Counts.** Each legend row counts the CDSs resolved to that category under
  the enabled sources, and the unknown row recounts accordingly, so UTEX alone
  leaves most CDSs uncoloured, UTEX with PCC colours many more, and all three
  colour the most. The legend title names the enabled sources.
- Keyword or substring matching over product names or GO terms never creates
  a category; the derived judgments are Jev outputs under a recorded rubric
  with calibration and a blinded spot check, and the offline `--check`
  verifies the pinned file without any API call.
- The three `supportingEvidence` objects record tested UTEX 2973 alleles from
  Ungerer et al. 2018. Their scope is allele- and condition-specific; their
  presence does not claim that the category itself was established by a new
  functional assay.

## Coverage for version 1

The source contains 2,715 CDS loci. Thirteen rows were reviewed: 12 have a
characterized category and one is explicitly unknown. No reviewed row has
multiple categories. With only the UTEX 2973 checkbox enabled, 2,703 loci
therefore resolve to unknown or unclassified, 12 draw a filled reviewed
marker, and zero resolve to the multiple-functions bucket. With PCC 7942 and
GO IEA enabled as well, source-derived categories colour a further 1,352 loci
under their own evidence labels and hollow marker, leaving 1,351 unknown; the
reviewed rows are unchanged either way. Those counts and the resolution rule
are in [source-derived-categories.md](source-derived-categories.md).

The viewer offers **Function category** under **Colour by** on every CDS map.
It is the first selector choice, while GC3 remains the fresh-view default.
Unreviewed and explicitly reviewed unknown loci share the pale open-circle
bucket; the detail panel and export distinguish their review status. Reviewed
coloured circles draw above unknown rings. Derived colour draws as a white
disc with the category colour as ring and centre dot, so reviewed and
computational colour are never confused. When filtered CDSs remain visible,
categorised CDSs, reviewed or derived, use a grey outlined square while
unknown or unclassified CDSs use a smaller filled grey dot with no outline.
These treatments do not change the visible category bucket recorded in CSV
rows and manifest gene entries. Category-label search ranks after direct
locus/name/product matches and before GO suggestions. The export records the
colour mode, the sources enabled for colouring, the visible category bucket,
its evidence label, any conflict, review status, every reviewed category
label, and every per-source derived category.

Circles are the deliberate convention for included points in every colour
mode; their area matches the square markers they replaced. Excluded points are
smaller squares or dots, so shape distinguishes included from excluded points
without relying on colour. The unknown grey (`#c6cdd5`) predates this marker
change and is retained for canvas parity. Against white it remains below WCAG
1.4.11's 3:1 contrast criterion for non-text graphics; legend-size unknown
rings and excluded dots therefore use an approximately 1 px stroke, while a
future palette change remains a lab decision.

The source release manifest records NCBI data usage policies for RefSeq inputs.
GO relationship data have separate Gene Ontology Consortium CC BY 4.0
attribution; they supply only the GO-derived colour under its own evidence
label and never the reviewed colour. PCC-derived colour carries the
Adomako/Rubin attribution and the cross-strain assumption. The category review itself applies only to
UTEX 2973. A future organism deployment would need its own pinned genome,
crosswalk, reviewed category table, and source checks. A generic accession
viewer would leave unavailable functions clearly unavailable until those
sources and joins exist.

Any added or changed reviewed assignment requires a new explicit user review;
derived categories are accepted or rejected as a layer in
`AAA-biological-decisions-to-review.md`. When a
schema or vocabulary change is incompatible with this contract, publish a new
versioned filename rather than changing version 1 semantics in place.

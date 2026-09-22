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

- Only rows in `assignments` are reviewed rows. A CDS absent from that sparse
  array has no reviewed category and resolves to `policy.defaultCategoryId`,
  `unknown-or-unclassified`, unless an enabled derived source colours it under
  the rules below.
- One category ID displays that category. Two or more explicitly reviewed IDs
  display the separate `multiple-functions` bucket. Raw GO row count never
  creates multiple functions.
- `IEA` GO relationships and product-name substrings must not create reviewed
  assignments. Source-derived colour is permitted only through
  `site/data/source-derived-categories-v1.json`, built by blinded TypeSafe Jev
  judgments, never by keyword or substring matching, and only under the
  evidence labels `pcc-7942-derived` and `go-iea-derived`; see
  [source-derived-categories.md](source-derived-categories.md).
- A derived category never enters this table, never changes a reviewed row,
  and never displays without its source label. When UTEX 2973 is enabled a
  reviewed row always wins, including a row reviewed as unknown. Two enabled
  derived sources that disagree use the multiple-functions bucket with each
  source named.
- The three `supportingEvidence` objects record tested UTEX 2973 alleles from
  Ungerer et al. 2018. Their scope is allele- and condition-specific; their
  presence does not claim that the category itself was established by a new
  functional assay.

## Coverage for version 1

The source contains 2,715 CDS loci. Thirteen rows were reviewed: 12 have a
characterized category and one is explicitly unknown. No reviewed row has
multiple categories. At runtime 2,703 loci therefore resolve to unknown or
unclassified, and zero resolve to the multiple-functions bucket.

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
colour mode, the enabled sources, the visible category bucket, its evidence
labels, review status, every reviewed category label, and every per-source
derived category.

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
attribution; those computational annotations are searchable suggestions and
never supply the reviewed colour. They and the PCC 7942 product names may
supply a derived colour only through the labelled derived layer above. The category review itself applies only to
UTEX 2973. A future organism deployment would need its own pinned genome,
crosswalk, reviewed category table, and source checks. A generic accession
viewer would leave unavailable functions clearly unavailable until those
sources and joins exist.

Any added or changed assignment requires a new explicit user review. When a
schema or vocabulary change is incompatible with this contract, publish a new
versioned filename rather than changing version 1 semantics in place.

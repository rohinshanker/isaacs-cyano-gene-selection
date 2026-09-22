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
  array resolves to `policy.defaultCategoryId`, `unknown-or-unclassified`.
- One category ID displays that category. Two or more explicitly reviewed IDs
  display the separate `multiple-functions` bucket. Raw GO row count never
  creates multiple functions.
- `IEA` GO relationships and product-name substrings must not create category
  assignments. They may be presented elsewhere only with their own evidence
  labels.
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
Unreviewed and explicitly reviewed unknown loci share the pale open-circle
bucket; the detail panel and export distinguish their review status. Reviewed
coloured points draw above unknown rings. Filtered CDSs retain the grey outlined
square marker. Category-label search ranks after direct locus/name/product
matches and before GO suggestions. The export records the colour mode, the
visible category bucket, review status, and every reviewed category label.

The source release manifest records NCBI data usage policies for RefSeq inputs.
GO relationship data have separate Gene Ontology Consortium CC BY 4.0
attribution; those computational annotations are searchable suggestions and
never supply the reviewed colour. The category review itself applies only to
UTEX 2973. A future organism deployment would need its own pinned genome,
crosswalk, reviewed category table, and source checks. A generic accession
viewer would leave unavailable functions clearly unavailable until those
sources and joins exist.

Any added or changed assignment requires a new explicit user review. When a
schema or vocabulary change is incompatible with this contract, publish a new
versioned filename rather than changing version 1 semantics in place.

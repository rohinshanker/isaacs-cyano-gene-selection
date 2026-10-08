# Recoded-genome parent-frame codon PCA

- Purpose: Define the reproducible build and artifact contract for projecting a
  recoded genome's per-gene RSCU vectors onto its parent's fixed codon-PCA axes.
- Scope: Native `codon_pca.json` fits and child-local
  `codon_pca_reference.json` artifacts; this does not define organism records or
  browser UI.
- Last verified: 2026-10-07

## Two fits remain distinct

Every organism keeps its own native fit. `scripts/build_features.py` writes that
fit to `codon_pca.json` and writes its coordinates to each gene's `codonPca`
field. A parent-frame projection never changes either location. It is written as
the additional `codon_pca_reference.json` file in the recoded child's dataset
directory.

The separate artifact is an intentional isolation boundary. The browser never
needs to fetch a parent directory at runtime, and replacing or removing the
reference artifact cannot silently replace the child's native coordinates.

## Native fit schema

Newly built `codon_pca.json` documents use schema 2. The existing
`explainedVariance`, `loadings`, and `nComponents` fields remain, and the fit adds
the following fields:

```json
{
  "schemaVersion": 2,
  "projectionType": "native-fit",
  "referenceGenome": {
    "organismId": "parent-record-id",
    "label": "Parent organism label",
    "strain": "Parent strain",
    "genomeAccession": "PINNED_ASSEMBLY",
    "taxid": 1
  },
  "nComponents": 6,
  "explainedVariance": [0.0],
  "loadings": [
    {"codon": "TTT", "aa": "F", "pc": [0.0]}
  ],
  "transform": {
    "featureOrder": ["TTT"],
    "scaler": {
      "mean": [0.0],
      "scale": [1.0]
    },
    "pca": {
      "mean": [0.0],
      "components": [[0.0]]
    }
  }
}
```

The abbreviated arrays above show shape, not a valid 59-feature fit. In a real
artifact, `transform.featureOrder` equals `meta.rscuOrder` exactly. Scaler mean
and scale, PCA mean, and every component are emitted at JSON round-trip
precision rather than the six-decimal display precision used by other generated
metrics. A constant input feature has scaler scale `1.0`, matching
`StandardScaler`; zero, negative, missing, or non-finite scales are invalid.

The loading records and component matrix contain the same values in two useful
orientations. Their codon order and values must agree exactly. The loading form
supports explanations by codon; the component matrix is the executable
transform.

## Required relationship record

The projection CLI accepts only an explicit `recoded-derivative` relationship.
This prevents a directory choice alone from authorizing an arbitrary
cross-strain projection. The relationship is a checked build input and is copied
into the output:

```json
{
  "type": "recoded-derivative",
  "parent": {
    "organismId": "parent-record-id",
    "label": "Parent organism label",
    "genomeAccession": "PINNED_PARENT_ASSEMBLY"
  },
  "child": {
    "organismId": "recoded-child-record-id",
    "label": "Recoded child label",
    "genomeAccession": "PINNED_CHILD_ASSEMBLY"
  },
  "provenance": {
    "recodingScheme": "named scheme",
    "segmentSet": "named segment set",
    "source": "resolvable design or derivation record",
    "description": "How the child genome was derived from this parent."
  }
}
```

The parent id, label, and accession must match the native fit. The parent
`meta.json` accession and taxid must also match that fit. The child accession
must match the child's `meta.json`, and parent and child ids must differ. All
provenance strings are required. A generic related-strain or similarity claim is
rejected.

## Building the child-local artifact

After both datasets have been built and the relationship record has been
reviewed, run:

```sh
.venv/bin/python tools/project_codon_pca.py \
  --parent-dir path/to/parent-data \
  --child-dir path/to/recoded-child-data \
  --relationship path/to/relationship.json
```

The command writes only
`path/to/recoded-child-data/codon_pca_reference.json`. It reads the parent's
`codon_pca.json` and `meta.json`, and the child's `meta.json`, `genes.json`, and
`codon_rscu.json`. It does not write into the parent directory or modify the
child's native `genes.json`, `codon_pca.json`, or RSCU payload.

The output interface is:

```json
{
  "schemaVersion": 1,
  "projectionType": "fixed-parent-codon-pca",
  "relationship": {},
  "reference": {
    "genome": {},
    "sourceArtifact": {
      "file": "codon_pca.json",
      "bytes": 0,
      "sha256": "..."
    },
    "nComponents": 6,
    "explainedVariance": [],
    "loadings": [],
    "transform": {}
  },
  "child": {
    "organismId": "recoded-child-record-id",
    "label": "Recoded child label",
    "genomeAccession": "PINNED_CHILD_ASSEMBLY",
    "taxid": 1,
    "totalLength": 1,
    "rscuSourceArtifact": {
      "file": "codon_rscu.json",
      "bytes": 0,
      "sha256": "..."
    }
  },
  "geneIds": [],
  "coordinates": []
}
```

`reference.transform` is a complete copy, so the child artifact is sufficient
to reproduce and audit every coordinate without a runtime parent fetch.
`sourceArtifact.sha256` pins the exact parent fit bytes used, and
`rscuSourceArtifact.sha256` pins the exact child vectors. `geneIds[i]` and
`coordinates[i]` refer to the same gene, in the exact order of both child
`genes.json` and `codon_rscu.json`.

## Transform and failure rules

For child row `x`, the coordinate calculation is exactly:

```text
scaled = (x - reference.transform.scaler.mean)
         / reference.transform.scaler.scale
coordinate = (scaled - reference.transform.pca.mean)
             @ transpose(reference.transform.pca.components)
```

The tool fails before writing when any of these conditions is false:

- child `meta.rscuOrder` equals the parent's feature order, including order;
- feature ids and gene ids are present, non-empty, and unique;
- RSCU rows have exactly one finite, non-negative value per feature;
- scaler and PCA dimensions match and every transform value is finite;
- every scale is positive, including the unit scale used for constant features;
- loading order and values agree with the executable component matrix;
- child RSCU gene ids equal child `genes.json` ids in exact order;
- parent and child genome identities match the relationship record; and
- the relationship declares recoded derivation and complete provenance.

Feature reordering is not inferred. A set of the same codons in a different
order is rejected because guessing would make a malformed build appear valid.

## Interpretation boundary

Parent-frame coordinates answer where a recoded gene's codon composition falls
under variation learned from the named parent. They do not show fitness,
expression, causal effect, or successful design. A separation associated with
removed codons follows the parent's published loadings and the child's observed
RSCU values; it is not a new measurement. Any UI using this artifact must label
the map as the named parent's frame, carry the recoding scheme and segment set,
and keep the child's recomputed native map reachable beside it.

## Regression checks

`tests/test_codon_pca_projection.py` compares the reusable transform directly
with sklearn, including a constant feature; exercises feature-order, width,
duplicate-id, missing-id, non-finite-value, invalid-scale, genome, and
relationship failures; verifies no input mutation; and invokes the CLI to check
the copied transform, both source checksums, child gene order, and preservation
of native coordinates.

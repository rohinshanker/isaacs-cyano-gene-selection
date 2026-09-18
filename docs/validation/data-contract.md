# Data Contract: `site/data/*.json`

- Purpose: Frozen interface between the Python feature pipeline and the static site.
- Scope: Everything the browser loads. The pipeline is the only writer; the site is read-only.
- Status: authoritative. Any change requires updating this file and both sides together.

## Genome of record

| Field | Value |
| --- | --- |
| RefSeq assembly | `GCF_000817325.1` (ASM81732v1) |
| Organism | *Synechococcus elongatus* UTEX 2973 |
| Taxid | 1350461 |
| Total length | 2,744,626 bp |
| Sequences | `NZ_CP006471.1` chromosome, `NZ_CP006472.1` plasmid, `NZ_CP006473.1` plasmid |

Do not substitute another accession. `GCF_000817745.x` is *Aphanocapsa montana* and
is not this organism.

## Gene inclusion rule

A CDS enters the analysis set only if all hold:

1. `gene_biotype=protein_coding` in the GFF.
2. Not flagged `pseudo=true`.
3. Length divisible by 3.
4. Exactly one terminal stop codon and no internal stop.
5. Sequence contains only `ACGT`.

Every excluded CDS is recorded in `excluded.json` with its locus tag and reason.

Applying this rule to the 2,722 CDS records yields **exactly 2,715 genes and 7
exclusions**, measured independently by the coordinator. All seven exclusions are
pseudogenes; the one CDS whose length is not a multiple of three and the two with
internal stops are among those seven. The pipeline asserts a count between 2,650
and 2,725 and fails loudly outside that range.

**Do not assert equality against the 2,711 records in `protein.faa.gz`.** That file
is keyed by `WP_` protein accession and deduplicated, and four accessions are each
shared by two CDS records: `WP_011243185.1`, `WP_011242480.1`, `WP_011242807.1`,
and `WP_011242808.1`. So 2,715 CDSs map onto 2,711 unique proteins. Join by
`protein_id`, never by record count.

## Codon packing

`codons` is the per-gene coding sequence with the terminal stop removed, encoded
one character per codon over this fixed 64-symbol alphabet:

```
ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/
```

Index order is the standard `TCAG` triplet order: `TTT`=0 (`A`), `TTC`=1 (`B`),
`TTA`=2 (`C`), ... `GGG`=63 (`/`). `meta.json.codonAlphabet` carries the explicit
index-to-codon list; the site must read it rather than recompute the ordering.

This field is what makes recoding schemes a runtime input. Any metric that depends
on which codons are targets is computed in the browser by scanning this string.

## Files

### `meta.json`

```jsonc
{
  "schemaVersion": 1,
  "builtAt": "2026-09-18T20:00:00Z",
  "genome": { "accession": "GCF_000817325.1", "taxid": 1350461, "totalLength": 2744626 },
  "sourceChecksums": { "GCF_000817325.1_ASM81732v1_genomic.fna.gz": "610ceb15..." },
  "geneCount": 2711,
  "codonAlphabet": [ { "sym": "A", "codon": "TTT", "aa": "F" }, ... ],   // 64 entries
  "rscuOrder": [ "TTT", "TTC", ... ],          // 59 synonymous codons, column order
  "defaultReplacement": { "TCG": "AGC", ... }, // most-used synonymous codon, genome-wide
  "highExpressedReplacement": { "TCG": "AGC", ... }, // same, from the CAI reference set
  "caiReferenceSet": { "method": "ribosomal+housekeeping", "locusTags": [...], "n": 57 },
  "tai": { "sValues": { "...": 0.0 }, "tRNAGeneCopies": { "AGC": 2, ... } },
  "rareCodonThreshold": 0.1,
  "metrics": { "gc3": { "label": "GC3", "unit": "fraction", "desc": "..." }, ... }
}
```

`metrics` drives every axis menu, tooltip, and side-panel label in the site. The
site must not hardcode metric labels.

### `genes.json`

Array of gene records. All metrics here are target-independent and never change
when the recoding scheme changes.

```jsonc
{
  "id": "M744_RS03825",          // locus tag, stable key used everywhere
  "name": "rpsL",                // gene symbol or null
  "product": "30S ribosomal protein S12",
  "seqid": "NZ_CP006471.1",
  "start": 812345, "end": 813100, "strand": "+",
  "lengthNt": 756, "lengthCodons": 251,

  "gc": 0.554, "gc1": 0.601, "gc2": 0.412, "gc3": 0.648,
  "a3": 0.12, "t3": 0.23, "g3": 0.34, "c3": 0.31,

  "enc": 48.2, "encExpected": 51.1, "deltaEnc": 2.9,
  "cai": 0.712, "tai": 0.385,

  "rareFraction": 0.061, "rareCount": 15,
  "longestRareRun": 3, "rampRareCount": 2, "minLocalTai": 0.11,

  "cps": 0.042, "underrepresentedPairFraction": 0.081,

  "mfeStart": -8.4,      // -30:+60 around AUG, kcal/mol
  "mfeFirst100": -21.7,  // +1:+100
  "minLocalGc": 0.38, "maxLocalGc": 0.71, "gc5prime": 0.49,

  "neighborUpstreamNt": 112, "neighborDownstreamNt": -4,
  "overlapsNeighbor": true, "operonId": "op_0421", "operonPosition": 2, "operonSize": 4,

  "expression": 1284.6,          // optional, null when unmeasured; see below
  "expressionPercentile": 0.71,  // optional, null when expression is null

  "rscu": [1.02, 0.41, ...],     // 59 floats, order = meta.rscuOrder
  "codonPca": [ -2.14, 0.88, 1.03, ... ],  // first 6 PCs of native codon space
  "riskUmap": [ 4.21, -1.09 ],   // baseline UMAP, target-independent features only
  "codons": "MKTAQ..."           // packed codon string, lengthCodons chars
}
```

Nulls are permitted for `name`, `operonId`, and any metric that genuinely could
not be computed. The site renders null as an em-space, never as zero.

## Expression, and why it is not the default

`expression` is loaded from `data/expression/GSE205444_pcc7942_wt_bg11_day1.tsv`,
a three-column `locus_tag`, `abundance`, `source_gene_id` table. The pipeline joins
it by locus tag and writes `null` for the 164 genes with no value.

**This measurement is from *S. elongatus* PCC 7942, not UTEX 2973**, comes from a
biofilm and conditioned-media experiment, and lacks light and CO2 metadata. Full
caveats and the eight loci deliberately excluded for ambiguous mapping are in
`data/expression/PROVENANCE.md`.

Consequences that both the pipeline and the site must honour:

- The low-traffic threshold **defaults to CAI and tAI**, which are derived from this
  genome. Expression is an opt-in overlay, never the default axis.
- Wherever expression is displayed or used to filter, the interface states the
  source organism in plain words. A user must not be able to threshold on it while
  believing it is UTEX 2973 data.
- `null` renders as unknown, never as zero. A threshold must not silently discard
  genes that simply have no measurement; offer an explicit "include unmeasured"
  control, defaulting to include.

`meta.json` carries the same provenance so the site can display it:

```jsonc
"expressionSource": {
  "accession": "GSE205444",
  "organismMeasured": "Synechococcus elongatus PCC 7942",
  "isTargetOrganism": false,
  "condition": "WT, fresh BG-11, day 1, mean of 3 replicates",
  "normalization": "DESeq2 normalized counts",
  "coverage": { "withValue": 2551, "total": 2715 },
  "caveat": "Measured in PCC 7942, not UTEX 2973, in a biofilm study. Use as a rough guide only.",
  "provenanceDoc": "data/expression/PROVENANCE.md"
}
```

Dropping a real UTEX 2973 table into the same directory and rerunning the pipeline
is the only change needed to switch axes; nothing downstream hardcodes this dataset.

### `codon_pca.json`

```jsonc
{
  "explainedVariance": [0.184, 0.092, ...],   // per PC, fraction
  "loadings": [ { "codon": "TTT", "aa": "F", "pc": [0.14, -0.08, ...] }, ... ],
  "nComponents": 6
}
```

### `excluded.json`

```jsonc
[ { "id": "M744_RS03825", "reason": "length_not_multiple_of_3", "lengthNt": 755 } ]
```

## Computed in the browser, not the pipeline

These depend on the active recoding scheme and must never be baked into JSON:

- Target codon counts, total, fraction, per kb, and counts in the first N codons.
- Maximum local target density over a sliding window, and target cluster count and length.
- The recoded sequence, reconstructed by applying the codon-to-codon map to `codons`.
- Every delta against wild type: ΔGC3, ΔCAI, ΔtAI, ΔENC, Δcodon-pair score.
- Recoding-risk PCA and perturbation PCA, recomputed from the standardized live matrix.

ΔMFE is the sole exception. Folding cannot run genome-wide in a browser, so the
site computes it only for genes on the candidate shortlist, on explicit request.

## Scheme representation

A scheme is a codon-to-codon map, not a set:

```jsonc
{ "name": "Syn61-style", "map": { "TCG": "AGC", "TCA": "AGT", "TAG": "TAA" } }
```

Every replacement must be synonymous with its target, except for stop codons,
which may map to another stop. The site validates this and refuses to apply a
map that changes the encoded protein. Schemes serialize into the URL hash so a
link reproduces the exact view.

## Size budget

The site must load in under three seconds on a normal connection. `genes.json`
stays under 6 MB uncompressed; GitHub Pages serves it gzipped. If it exceeds
that, move `rscu` and `codons` into a separate lazily-fetched file rather than
dropping precision.

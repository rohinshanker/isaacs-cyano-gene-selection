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

`codons` is the per-gene coding sequence **with the terminal stop removed**, encoded
one character per codon over this fixed 64-symbol alphabet:

```
ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/
```

Index order is the standard `TCAG` triplet order: `TTT`=0 (`A`), `TTC`=1 (`B`),
`TTA`=2 (`C`), ... `GGG`=63 (`/`). `meta.json.codonAlphabet` carries the explicit
index-to-codon list; the site must read it rather than recompute the ordering.

This field is what makes recoding schemes a runtime input. Any metric that depends
on which codons are targets is computed in the browser by scanning this string.

### The terminal stop is carried separately, and it matters

Because `codons` excludes the stop, the packed string alone is **lossless only for
sense codons**. `terminalStop` carries the removed codon so the full coding sequence
is `decode(codons) + terminalStop`.

This is not bookkeeping. Stop-codon reassignment is a mainstream recoding scheme, and
in the included set the terminal stops distribute as:

| Stop | Genes |
| --- | --- |
| TAG | 1,071 |
| TAA | 895 |
| TGA | 749 |

An amber-reassignment scheme (`TAG` → `TAA`) touches 1,071 genes. Computing its
burden from `codons` alone would report zero for every gene, because no stop codon
appears there. Always read `terminalStop` when the active scheme maps a stop codon.

**Denominator rule, so numbers are comparable.** `lengthCodons` counts sense codons
and excludes the stop. Target fraction and targets per kb use that denominator.
A reassigned terminal stop contributes to `targetTotal` and to the edit count, but
never to local-density windows or cluster statistics, which are defined over sense
codons only. State the convention wherever a burden number is displayed.

### Start codons

`codons[0]` holds the literal initiation triplet. Across the 2,715 included genes
these distribute as:

| Start | Genes |
| --- | --- |
| ATG | 2,244 |
| GTG | 356 |
| TTG | 103 |
| ATC, CTG, ATT | 12 combined |

All of them translate as methionine at position zero regardless of the triplet's
standard internal meaning, so a substitution there is not synonymous in effect even
when the codon table says it is. **Never recode position zero.** The site excludes
it from target matching and says so where burden is reported.

### Discontinuous CDSs

Three genes have a CDS that is a join of non-adjacent genomic segments, so their
coding length is shorter than `end - start + 1`. For those, `cdsSegments` carries
the explicit segment list and `translationalException` names the cause where NCBI
records one. `M744_RS00920` is `prfB`, whose release factor 2 requires a programmed
ribosomal frameshift; it is annotated `ribosomal_slippage`. The other two,
`M744_RS13290` and `M744_RS13620`, are spliced without a recorded exception.

Never adjust coordinates to force the span to match the coding length. A gene whose
translation depends on a frameshift is a high-risk recoding target, and the site
should surface that flag rather than hide it.

### Exact local RNA folding context

Every gene carries `rnaContext`. For ordinary CDSs it is simply
`{"upstream":"<30 ACGT bases>"}` in transcription orientation. Concatenate this
with the first 60 literal CDS bases for the genomic start window. This includes
the literal initiation triplet, not an artificial ATG.

When that construction is not exact (a short CDS, a join within the window, or
another exceptional genomic mapping), the alternate form is
`{"sequence":"<90 ACGT bases>","cdsOffsets":[...90 integers...]}`. Each offset
is the zero-based nucleotide position in the complete, spliced CDS including its
terminal stop, or `-1` for a base outside this gene. Replace only mapped positions
with the corresponding recoded CDS base. The decoder validates every mapped
wild-type base against the CDS before folding. Genomic positions repeated within
one CDS cannot be independently edited and are rejected by the producer.

The start window is exactly the existing pipeline's **[-30,60)** relative to the
first translation-start base: 30 upstream plus 60 downstream bases, 90 total.
All three replicons wrap circularly at their boundaries; negative-strand windows
are reverse-complemented into transcription orientation. A genomic window stays
genomic across a splice, while `first100` is the first `min(100,lengthNt)` bases
of the spliced CDS. Both include terminal-stop bases when those positions fall
inside the window. Only this gene's mapped bases are edited; overlapping
neighbors and flanks otherwise remain wild type. Neighbor protein identity is
not guaranteed by this calculation.

Recoding never changes codon position zero. Sense substitutions must preserve
their amino acid; a terminal stop may map only to another stop. No padded or
invented upstream sequence is allowed: missing context fails that gene explicitly.

On request, the local worker folds wild type and recoded RNA with the shipped
ViennaRNA 2.7.2 build and reports both energies and **Δ = recoded − wild type**.
See [RNA folding validation](rna-folding.md) for settings, provenance, caching,
numerical tolerance and the browser verification command.

## Files

### `meta.json`

```jsonc
{
  "schemaVersion": 1,
  "builtAt": "2026-09-18T20:00:00Z",
  "genome": { "accession": "GCF_000817325.1", "taxid": 1350461, "totalLength": 2744626 },
  "sourceChecksums": { "GCF_000817325.1_ASM81732v1_genomic.fna.gz": "610ceb15..." },
  "geneCount": 2715,
  "codonAlphabet": [ { "sym": "A", "codon": "TTT", "aa": "F" }, ... ],   // 64 entries
  "rscuOrder": [ "TTT", "TTC", ... ],          // 59 synonymous codons, column order
  "defaultReplacement": { "TCG": "AGC", ... }, // most-used synonymous codon, genome-wide
  "highExpressedReplacement": { "TCG": "AGC", ... }, // same, from the CAI reference set
  "caiReferenceSet": { "method": "ribosomal+housekeeping product-name match", "locusTags": [...], "n": 71 },
  "tai": { "sValues": { "...": 0.0 }, "tRNAGeneCopies": { "AGC": 2, ... } },
  "rareCodonThreshold": 0.1,
  "metrics": { "gc3": { "label": "GC3", "unit": "fraction", "desc": "..." }, ... }
}
```

`metrics` drives every axis menu, tooltip, and side-panel label in the site. The
site must not hardcode metric labels.

### Every metric carries a real definition

Each entry in `metrics` must supply:

```jsonc
"enc": {
  "label": "ENC",
  "unit": "codons",
  "desc": "Effective number of codons, Wright 1990. Ranges 20 to 61: 20 means the gene uses one codon per amino acid, 61 means it uses all synonyms equally. Estimated from families observed more than once; encHasSubstitutedFamilies marks genes where some family was substituted.",
  "scale": "sequential",          // or "diverging" for signed quantities
  "missingPolicy": "null renders as unknown, never as zero or median",
  "direction": "contextual"       // informational only; see below
}
```

**`desc` must not equal `label`.** The validator fails the build when it does.
A description that restates the label teaches nothing, and the panel then
"explains" GC as "GC". Every one of the 33 metrics needs a genuine definition
giving the quantity, its range or window, its source, and any caveat.

`scale` tells the site which colour ramp family to use. Signed quantities such as
ΔGC3 use a diverging ramp centred on zero; unsigned magnitudes use a sequential
ramp. Different metrics may use different ramps, and a ramp is a way of reading a
value, not a claim about whether high is good. `direction` is recorded for
documentation and is **not** used to colour anything.

### Codon occurrence counts

`meta.codonOccurrences` publishes, per codon, `total` and `editable`, where
`editable` excludes occurrences at position zero. Anywhere the interface offers a
codon as a recoding target it must quote the editable count, because the
initiation triplet can never be recoded. For example GTG occurs 18,659 times of
which 18,303 are editable, and TTG 20,427 of which 20,324.

### More than one measured source

The build must not infer its inputs from a directory listing. `data/expression/sources.json`
names every selected source explicitly, and the loader reads only what it lists:

```jsonc
[
  {
    "id": "GSE205444",
    "file": "GSE205444_pcc7942_wt_bg11_day1.tsv",
    "metricKey": "expression",
    "label": "Expression (PCC 7942)",
    "organism": "Synechococcus elongatus PCC 7942",
    "isTargetOrganism": false,
    "assay": "RNA-seq transcript abundance",
    "units": "DESeq2 normalized counts",
    "condition": "WT, fresh BG-11, day 1, mean of 3 replicates",
    "sha256": "...",
    "licence": "GEO/NCBI public repository terms",
    "caveat": "Measured in PCC 7942, not UTEX 2973, in a biofilm study."
  },
  {
    "id": "TAN2018_TSS",
    "file": "tan2018_utex2973_tss_initiation.tsv",
    "metricKey": "tssInitiation",
    "label": "TSS initiation (UTEX 2973)",
    "organism": "Synechococcus elongatus UTEX 2973",
    "isTargetOrganism": true,
    "assay": "dRNA-seq transcription start site initiation",
    "units": "summed mean TSS counts",
    "condition": "Tan et al. 2018, four conditions pooled",
    "caveat": "Initiation strength, NOT transcript abundance."
  }
]
```

Each source contributes **its own per-gene field**, named by its `metricKey`, and **its
own `meta.metrics` entry**, which is what makes it appear in the filters and the
colour-by menu with no site change. `meta.expressionSources` echoes the manifest so the
page can show provenance.

**Sources are never merged, averaged, or ranked together.** TSS initiation and
transcript abundance correlate at Spearman 0.313 on this genome; they answer different
questions and a combined score would hide that. A gene absent from a source is `null`
for that source, never zero and never filled from another source.

Adding a source is a manifest entry plus its table. Nothing downstream is hardcoded to a
particular source, and the existing `cai`, `tai`, `expressionProxy` and every other
metric remain filterable exactly as before.

### Expression: measured first, proxy as a labelled fallback

The threshold axis prefers a real measurement and falls back to a codon-adaptation
proxy per gene, never silently.

- `expression` holds a measured abundance, or `null`. It is never filled with a proxy.
- `expressionProxy` holds a CAI/tAI-derived rank in 0 to 1, available for every gene.
- `expressionBasis` is `"measured"` when that gene has a real value, `"proxy"` when
  the interface is falling back, and `null` when neither exists.
- `expressionSourceId` names the dataset behind a measured value.

The site must show, per gene, which basis a displayed value came from, and must be
able to filter to measured-only. A measured abundance and a proxy rank are different
quantities in different units, so the interface must never present a mixed column as
though it were one measurement.

### `genes.json`

Array of gene records. All metrics here are target-independent and never change
when the recoding scheme changes.

```jsonc
{
  "id": "M744_RS11720",          // locus tag, stable key used everywhere
  "name": "rpsL",                // gene symbol or null
  "product": "30S ribosomal protein S12",
  "seqid": "NZ_CP006471.1",
  "start": 2370396, "end": 2370770, "strand": "+",
  "lengthNt": 375, "lengthCodons": 124,
  "terminalStop": "TAG",         // the stop codon removed from `codons`; never null
  "rnaContext": { "upstream": "<30 strand-oriented ACGT bases>" }, // alternate form above
  "translationalException": null, // or "ribosomal_slippage"
  "cdsSegments": null,           // or [[169621,169692],[169694,170743]] when spliced
  "annotationEvidence": {       // joined from annotations.json at load time
    "repliconType": "chromosome", "repliconName": "chromosome",
    "annotationMethods": ["Protein Homology"],
    "inferences": ["COORDINATES: similar to AA sequence:RefSeq:WP_..."],
    "overlappingCds": [{"locusTag": "M744_RS...", "overlapNt": 7}],
    "nearbyNoncodingRnas": [{"locusTag": "M744_RS...", "biotype": "tRNA", "distanceNt": 8}],
    "goAnnotations": [{
      "goId": "GO:0016787", "qualifier": "enables", "aspect": "F",
      "evidenceCode": "IEA", "reference": "PMID:33270901",
      "withFrom": "HMM:NF...", "assignedBy": "RefSeq",
      "mappingAmbiguity": "", "mappingMethod": "exact RefSeq protein_id"
    }]
  },


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

  "expression": 1284.6,          // measured abundance only; null when unmeasured
  "expressionPercentile": 0.71,  // null when expression is null
  "expressionBasis": "measured", // "measured" | "proxy" | null — never inferred by the site
  "expressionProxy": 0.63,       // CAI/tAI-derived rank in 0..1; the documented fallback
  "expressionSourceId": "GSE205444",  // which dataset supplied a measured value

  "rscu": [1.02, 0.41, ...],     // 59 floats, order = meta.rscuOrder
  "codonPca": [ -2.14, 0.88, 1.03, ... ],  // first 6 PCs of native codon space
  "riskUmap": [ 4.21, -1.09 ],   // baseline UMAP, target-independent features only
  "codons": "MKTAQ..."           // packed codon string, lengthCodons chars
}
```

Nulls are permitted for `name`, `operonId`, and any metric that genuinely could
not be computed. The site renders null as an em-space, never as zero.

`annotations.json` is an object keyed by every published gene's exact locus tag.
The loader requires it when `meta.annotationRelease` is present and attaches its
record to the in-memory gene as `annotationEvidence`. Keeping this relationship
payload separate preserves the `genes.json` interaction budget. It is not a
metric space: overlaps and nearby RNA are
coordinate relationships, annotation methods/inferences remain source text, and
GO relationships retain their qualifier, aspect, evidence code, reference,
assigner, mapping method, and ambiguity. The viewer keeps this material in a
collapsed gene-detail disclosure and never derives a pathway, confidence score,
regulatory interaction, or functional category from it.

`tss_evidence.json` is a separate object keyed by exactly matched current locus
tags. At load time each gene gets `tssEvidence`, an array (empty when no gTSS
maps). Each entry retains the source `id`, `type: "gTSS"`, `replicon`, `strand`,
`position`, `sourceStartDistanceNt` against the paper-era gene model, four pairs
of `rawReads` (`control`, `dark`, `highLight`,
`highTemperature`), and `differential` for each stressed condition with the
authors' `log2FoldChange` and `padj` versus control. Missing differential pairs
are `null`, never zero. This is promoter-level initiation evidence, not a metric
for ranking whole-gene RNA abundance; do not combine multiple TSSs into one
fold change. `meta.tssEvidenceSource` identifies the source, biological-replicate
count (two per condition), threshold, and exact-join coverage. The source and
derived-table hashes and reproduction steps are in
`data/expression/TAN2018_TSS_PROVENANCE.md`.

## Expression, and why it is not the default

`expression` is loaded from `data/expression/GSE205444_pcc7942_wt_bg11_day1.tsv`,
a three-column `locus_tag`, `abundance`, `source_gene_id` table. The pipeline joins
it by locus tag and writes `null` for the 164 genes with no value.

**This measurement is from *S. elongatus* PCC 7942, not UTEX 2973**, comes from a
biofilm and conditioned-media experiment, and lacks light and CO2 metadata. Full
caveats and the eight loci deliberately excluded for ambiguous mapping are in
`data/expression/PROVENANCE.md`.

Consequences that both the pipeline and the site must honour:

- The low-traffic threshold **defaults to a metric actually measured in this organism**
  (native TSS initiation today) when one exists. **Any other real measurement of
  transcript abundance ranks next** — this PCC 7942 abundance value and its
  percentile included, borrowed-strain caveat still attached — **ahead of CAI and
  tAI**, this genome's own codon-adaptation proxies: a measurement outranks a proxy
  regardless of organism. If native measured evidence is absent, the implicit
  selection falls back to CAI, then tAI, then the genome-derived expression
  proxy; borrowed evidence requires an explicit choice even if it appears above
  those proxies in the menu. It remains an opt-in overlay wherever the
  interface excludes it by default (see "Guided panel design"). The ranking follows
  each metric's own `provenance.isTargetOrganism` flag, so a future native
  measurement (gene-body transcriptomics, say) takes the top priority with no
  interface change once it passes this project's replication bar — see
  `orderTrafficCandidates()` in `site/js/ui/filters.js` and the matching
  `constrainableMetrics()` in `site/js/ui/panel-designer.js`. The same priority
  orders the family groups every metric selector offers ("Expression" ahead of
  "Translation") via `orderMetricFamilies()` in `site/js/core/metric-registry.js`.
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
stays under 6 MB uncompressed; relationship-heavy `annotations.json` and
`tss_evidence.json` are separate payloads joined by locus tag, and GitHub Pages
serves them compressed.
If the core file exceeds the budget, move `rscu` and `codons` into a separate
lazily-fetched file rather than dropping precision.

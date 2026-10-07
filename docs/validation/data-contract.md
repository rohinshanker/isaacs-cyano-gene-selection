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

## Organism-scoped releases

`site/data/` remains the backwards-compatible UTEX 2973 release. Additional
organisms use `site/data/organisms/<organism-id>/`; E. coli K-12 MG1655 uses
`site/data/organisms/ecoli-k12-mg1655/`. Each directory is a complete release
root with its own `meta.json`, `genes.json`, `excluded.json`, `codon_pca.json`,
`citations.json` when provenance is published, and `data-manifest.json`. A
manifest describes only the JSON files beside it.

Optional evidence files are local to one organism. They are published only when
that organism's configuration admits their source and `meta.json` declares the
layer. The absence of an unconfigured expression, TSS, essentiality, protein-
evidence, function-category, or annotation layer is intentional and is never
filled with another organism's file. Compatibility measured fields in a gene row
remain `null`; the separately labelled genome-derived expression proxy remains
available.

The canonical records are in `config/organisms.json`. All build and validation
commands default to `utex2973`; `--organism ecoli-k12-mg1655` selects the second
record, and an unknown id must fail before reading or writing data. Raw inputs use
the configured per-organism directory under `data/raw/`.

## Evidence coverage and cross-organism transfer

UTEX 2973 remains the genome, coordinate system, and experimental target of every
published row. It is **not**, however, the only organism from which the project may
draw evidence. Native UTEX 2973 data are too sparse to make "native or unknown" a
useful general policy. For annotations, expression/activity estimates,
essentiality, regulation, protein evidence, and related biological context, the
project prefers the best defensible estimate to an empty field.

Evidence may therefore come from, in decreasing default preference when source
quality and biological relevance are otherwise comparable:

1. a direct UTEX 2973 measurement or reviewed annotation;
2. an admitted sister strain, for the data types named in "Sister strains admitted
   for UTEX 2973 data" below, then any other *S. elongatus*
   strain or close cyanobacterial ortholog;
3. a more distant cyanobacterium with a supported orthology or homology mapping;
4. a conserved bacterial model such as *E. coli*, another phylogenetically
   informative organism, or an explicitly reconstructed ancestral state; and
5. a sequence-, structure-, or genome-derived proxy for UTEX 2973.

This order is a starting prior, not a licence to prefer any nearby organism over a
better experiment. Assay quality, condition match, orthology type, sequence
identity and coverage, domain conservation, paralogy, and the biological quantity
being transferred all affect fitness for use. An *E. coli* result can support a
conserved bacterial function; it does not by itself establish cyanobacteria-specific
regulation, condition-specific expression, or UTEX 2973 essentiality. An ancestral
state is a model reconstruction, not a measurement from an extant organism.

Every non-native value must remain distinguishable from a native value. Use one of
these evidence bases wherever a best-available value is published:

| Basis | Meaning |
| --- | --- |
| `direct` | Measured or manually reviewed in UTEX 2973. |
| `transferred` | Observed or annotated in another organism and mapped to a UTEX 2973 locus. An admitted sister strain also sets `sisterStrain: true` and names the strain. |
| `inferred` | Produced by an explicit model or consensus over one or more evidence sources. |
| `proxy` | Computed from the UTEX 2973 sequence or genome without measuring the requested phenotype. |
| `unknown` | No defensible mapping or estimate is available. |

`unknown` is the last honest outcome, not the preferred outcome. A low-confidence
estimate may be shown and used for exploratory ranking when its basis and uncertainty
are visible; it must not be promoted to a direct measurement or silently substituted
into a direct-source field.

### Sister strains admitted for UTEX 2973 data

Lab decision, recorded 2026-09-27. Five other *S. elongatus* strains are treated as
near enough to UTEX 2973 that, for the data types listed below only, a measurement or
annotation in one of them may supply a UTEX 2973 value. They are not equally close,
so they sit in two tiers:

| Strain | Tier | Role |
| --- | --- | --- |
| UTEX 2973 | target | Every published row keeps this genome and these coordinates. |
| PCC 6301 | close cluster | Admitted for the listed data types. |
| PCC 6311 | close cluster | Admitted for the listed data types. |
| PCC 7942 | close cluster | Admitted for the listed data types. |
| PCC 7943 | close cluster | Admitted for the listed data types. |
| UTEX 3055 | admitted, more divergent | Admitted for the listed data types, with the coverage caveat below. |

The close cluster aligns with UTEX 2973 gene for gene across almost the whole CDS
set. UTEX 3055 does not: it carries 303 pangenome CDS rows absent from all five
cluster strains, and 134 UTEX 2973 CDSs have no UTEX 3055 counterpart. Absence of a
UTEX 3055 value at a locus is therefore often a real gene-content difference rather
than a failed measurement, and must never be rendered as a zero or a negative
result. Where a close-cluster value and a UTEX 3055 value both exist and disagree,
prefer neither silently: keep both and record the conflict.

Admitted data types, and nothing else:

- gene annotations, including symbols, products, functional categories, and
  ortholog-level functional assignment;
- transcriptomics, meaning gene-body transcript abundance;
- proteomics, meaning protein detection and abundance;
- ribosome occupancy, including ribosome profiling density and derived
  translation-efficiency estimates;
- translation initiation sites (TIS);
- transcription start sites (TSS);
- transcription termination sites (TTS); and
- condition-resolved fitness screens such as RB-TnSeq, admitted 2026-10-05 by owner
  decision as a data type of its own. A fitness value is shown in its own tab and
  is never placed on an expression scale or pooled with one. Its source is
  marked `signed` in `sources.json` (the loader, the validator and the browser
  then admit negative values; every abundance stays non-negative), it forms the
  `Fitness` metric family with a diverging default scale, and the first such
  layers are GSE205443's nine fractions, the authors' own fitness values. In every default order the Fitness family follows Expression: the registry promotes the family of every manifest dataset metric after this organism's own measurements and before the computed families (a percentile or proxy derived from a measurement promotes nothing).

Platform is recorded beside the data type (owner decision 2026-10-05). A
microarray is a transcriptomics platform and a protein array a proteomics one, but
an array measures the targets its designers chose and not the whole transcriptome
or proteome. Array datasets are therefore listed apart from sequencing or
mass-spectrometry datasets by default, the RNA-seq selection offers an option to
include them, and an array dataset always says that it is an array and how many
targets it covers.

Everything else keeps the rules it already has. Genome sequence, coordinates,
codon content, GC, CAI, tAI, folding windows, and every other sequence-derived
metric stay UTEX 2973 only, because they are computed from this assembly. PCC 7942
essentiality stays a borrowed, condition-specific call under
[pcc-essentiality.md](pcc-essentiality.md); this section does not promote it. A
value from any strain outside this table remains ordinary cross-organism evidence
under the rules above.

**A sister-strain value is still `transferred`, never `direct`.** It carries the
full provenance and mapping record that the next section requires, plus
`sisterStrain: true` and its source strain. What this section changes is the gate,
not the label: a sister-strain value in an admitted data type may populate a
best-available view and rank ahead of `unknown` without being an opt-in overlay,
and the interface must still name the strain wherever the value is shown, filtered,
coloured, ranked, or exported, and must still offer a direct-UTEX-only view.

Two limits are not negotiable for these strains:

1. **Coordinates never transfer.** UTEX 2973 differs from the PCC 7942 lineage by a
   large chromosomal inversion and an indel, so a positional feature (TSS, TTS, TIS)
   transfers as a gene-relative offset against a named locus, never as an absolute
   genomic position. Publishing a sister-strain coordinate as a UTEX 2973 coordinate
   is a contract violation. The gene visualizer and the planned chromosome
   visualizer consume these offsets; see
   [the scan ticket](../notes/tickets/O_cross-strain-data-scan__20260927.md).
2. **Condition match still governs quantitative transfer.** The documented
   phenotypic difference between UTEX 2973 and PCC 7942 is growth rate under high
   light and high temperature, which is exactly where transcript and protein
   abundance diverge. Sequence-level similarity licenses the join; it does not
   license comparing a 38 °C high-light UTEX culture against a 30 °C PCC culture and
   calling the difference biology. Record each source's light, temperature, CO₂,
   medium, and growth phase, and keep values from different conditions in different
   layers. The starting tolerances are in "Condition comparability" below.

### Condition comparability

These thresholds decide whether two datasets may share one displayed layer or a
combined estimate. They are a starting rule derived from the divergence this
repository already documents, not a literature-established equivalence bound, and
they are pending lab sign-off in
[AAAA-new-bio-decisions-to-review.md](AAAA-new-bio-decisions-to-review.md).
Two datasets are comparable only when **every** axis the assay responds to agrees.

| Axis | Comparable when | Why this boundary |
| --- | --- | --- |
| Temperature | Within 2 °C, and both inside one regime: standard 28–32 °C or elevated 36–40 °C. | Ungerer et al. 2018 compared the strains at 38 °C, while the Rubin PCC 7942 screen ran at 30 °C. A 30 °C and a 38 °C dataset are not one layer. |
| Light intensity | Within ±25% of the same photon flux, and both at or below 400 µmol photons m⁻² s⁻¹, or both above it. | Ungerer et al. 2018 report similar growth for UTEX 2973 and PCC 7942 at 400 µmol photons m⁻² s⁻¹ and diverging growth above it. Two datasets both labelled "high light" are not comparable when they straddle that flux. |
| Light regime | Same spectrum class, and continuous matched to continuous or diel matched to diel at the same photoperiod. | A diel dataset carries circadian structure a continuous dataset does not, which no normalization removes. |
| CO₂ | Same regime, ambient near 0.04% or elevated at 1% or more, and within a factor of two inside the elevated regime. | Elevated CO₂ changes carbon-concentrating and photosynthetic gene expression directly. |
| Medium | BG-11 on both sides, same nitrogen source, no added organic carbon. Conditioned or spent medium is never comparable to fresh medium. | GSE205444 is a biofilm and conditioned-media experiment, which is why its caveat is recorded separately. |
| Culture format and phase | Both planktonic or both biofilm, and both exponential with overlapping OD₇₅₀, or both stationary. | A day-1 biofilm sample and an exponential planktonic culture measure different physiology. |

**Owner decisions, 2026-10-05.** The thresholds above are the default screen and a
piece of evidence, not the sole gate. Agreement computed from the data is shown
beside them: level correlation read against each dataset's own replicate band and,
where both datasets carry their own control, agreement of fold changes.
Whole-distribution comparison appears as a units check only. No statistic carries a
pass mark. Two datasets share a layer or a combined estimate only when the lab
records a judgement for that pair in row 14 of the biological-decisions list; until
then they are separate layers, and any number of separate layers may be shown at
once. On the phase axis an OD₇₃₀ or A₇₃₀ value is accepted as equivalent to OD₇₅₀.
No fixed "narrow miss" boundary decides which near-passes a person looks at: the
condition scales show how near or far two datasets sit on every axis, so the
boundary may be drawn wide, and the owner revisits it if the resulting groups
look wrong. GSE18902, GSE50908, GSE50919 and GSE52486 are judged to share a
spectrum class, because Markson 2013 states its turbidostat cultures were grown as
described in Vijayan 2009; row 14 records the judgement.

A pair failing any axis may still be published, as separate selectable layers with
their conditions stated. What it may not do is enter one combined estimate or one
colour scale as though the difference were biological. Record every rejected pair
and its failing axis, and add a pair whose comparability is genuinely uncertain to
the biological-decisions list rather than resolving it silently.

The join runs through the pinned Adomako 2022 pangenome workbook
(`data/essentiality/source/mbio.00862-22-s0001.xlsx`, sheet `PG_metadata`), which
aligns all six strains gene by gene over 3,113 rows, 3,028 of them CDS. Its
per-strain CDS coverage is:

| Strain | CDS rows in `PG_metadata` | NCBI locus column |
| --- | --- | --- |
| PCC 7942 | 2,722 | `PCC 7942 NCBI` (`SYNPCC7942_RS…`) |
| PCC 6301 | 2,722 | `PCC 6301 NCBI` (`SYC_RS…`) |
| PCC 6311 | 2,721 | none |
| PCC 7943 | 2,721 | none |
| UTEX 2973 | 2,717 | `UTEX 2973 NCBI` (`M744_RS…`) |
| UTEX 3055 | 2,893 | `UTEX 3055 NCBI` (`UTEX3055_RS…`), 2,858 populated |

2,712 CDS rows carry a pangenome locus in all five close-cluster strains, and 2,580
carry one in all six.

PCC 6311 and PCC 7943 have pangenome IDs, coordinates, and strand but **no NCBI
locus column**. The lab has approved building a pinned RefSeq crosswalk for them.
Until that crosswalk exists and is recorded, a source keyed by their own RefSeq tags
cannot join, because the pangenome ID alone is not a crosswalk. When it is built it
follows the existing
[identifier-crosswalk contract](annotation-release-readiness.md#identifier-crosswalk-contract):
exact shared protein sequence or accession, one admitted mapping per locus,
ambiguity preserved rather than resolved, and a pinned source annotation release with
its checksum.

Join routes, in order: the existing exact shared-protein crosswalk where one covers
the strain, then the new per-strain crosswalk once pinned, then the pangenome row.
Record which route each value used. Rows that are absent, ambiguous, or multiply
mapped stay `unknown`, exactly as under the essentiality policy. Where two admitted
strains disagree on the same locus and data type, keep both source values and publish
any resolution as a separate `inferred` field naming its rule.

### Admission and presentation rules

Every transferred or inferred layer must:

- pin the source organism and strain, source artifact, licence, retrieval date,
  checksum or immutable version, assay or annotation method, conditions, and units;
- record the complete mapping path to each UTEX 2973 locus, including source gene or
  protein identifiers, orthology/homology method, relationship type, sequence
  identity and coverage where applicable, and mapping ambiguity;
- expose a per-value confidence, probability, interval, or controlled qualitative
  grade whose meaning and calibration are documented; source distance alone is not
  a confidence score;
- preserve one-to-many and many-to-one relationships instead of choosing a paralog
  silently, and state any deterministic aggregation rule;
- keep original source-specific values intact and publish any cross-source consensus
  or best-available estimate as a separate derived field with its method and inputs;
- label the organism, evidence basis, conditions, and material caveat anywhere the
  value affects colour, filtering, ranking, panel selection, comparison, or export;
  and
- retain `null`/`unknown` when the mapping or estimate is not defensible. Neither is
  ever converted to zero, false, a median, or a confident annotation.

For quantitative expression or activity, raw counts from different assays or
organisms are not commensurate. Transfer uses a documented common scale such as a
within-source percentile, rank, or controlled qualitative band unless a validated
cross-study model supports stronger calibration. The published estimate records the
transformation and uncertainty. For qualitative annotation, a transferred label
records the ortholog or conserved feature that supports it and never erases a
conflicting UTEX 2973 annotation.

These rules broaden admissible evidence; they do not weaken source integrity,
identifier, or experimental-use gates elsewhere in this contract.

## Protein evidence is a separate, versioned release

The site offers a RefSeq protein-record filter and displays direct UTEX 2973
proteomics detection as unavailable with a reason. The offline audit in
`data/protein-evidence/releases/` deliberately keeps three nullable
evidence concepts separate: a pinned RefSeq protein record, direct experimental
detection, and characterized-homolog support. Experimentally tested variant
evidence has its own field. Historical search-database observations live in a
separate optional artifact, with an explicit source-integrity field; they cannot
enter the admitted release merely because a local checksum is stable.
The length chart includes a RefSeq protein-record CDS cohort; the separate protein
filter lists direct detection as unavailable while no accepted per-locus
identification list exists.

Unknown evidence is the literal string `unknown`, never false or absent-row
imputation. Shared accessions produce one row per locus with
`identity_ambiguity=shared_protein_id`. See
[`protein-evidence.md`](protein-evidence.md) for the release and admission rules.

## Gene inclusion rule

A CDS enters the analysis set only if all hold:

1. `gene_biotype=protein_coding` in the GFF.
2. Not flagged `pseudo=true`.
3. Length divisible by 3.
4. Exactly one terminal stop codon and no internal stop.
5. Sequence contains only `ACGT`.
6. One deposited CDS is selected per exact locus tag. When RefSeq supplies
   alternatives, the longest deposited CDS wins; every other record is excluded
   as `alternate_cds` with its `proteinId`, so the selected accession can be
   reconciled without re-deriving the tie-break.

An otherwise valid CDS with an internal `TGA` annotated by `transl_except` as
selenocysteine is excluded as `selenocysteine_internal_tga`; it is not published
as an ordinary internal stop or a recodable stop. Every excluded CDS is recorded
in `excluded.json` with its locus tag and reason.

Applying this rule to the 2,722 CDS records yields **exactly 2,715 genes and 7
exclusions**, measured independently by the coordinator. All seven exclusions are
pseudogenes; the one CDS whose length is not a multiple of three and the two with
internal stops are among those seven. The pipeline asserts a count between 2,650
and 2,725 and fails loudly outside that range.

For E. coli, 4,318 CDS records at 4,308 locus tags yield 4,287 included genes and
31 exclusions: 15 `pseudogene`, ten `alternate_cds`, three
`selenocysteine_internal_tga`, two `missing_terminal_stop`, and one
`length_not_multiple_of_3`.

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
and excludes the stop. Target fraction uses that denominator. Targets per kb
uses full `lengthNt` in nucleotides, including the stop.
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

Raw source fields are never merged, averaged, or overwritten. TSS initiation and
transcript abundance correlate at Spearman 0.313 on this genome; they answer different
questions and a combined score presented as either measurement would hide that. A gene
absent from a source is `null` for that source, never zero and never filled inside that
source field. A later best-available or consensus layer may use multiple admitted
sources only as a separately named `inferred` field that records its inputs,
normalization, model, uncertainty, and conflicts under the cross-organism policy above.

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

The four fields above describe the current release's compatibility view. Future
coverage may add transferred or inferred expression/activity estimates from other
cyanobacteria, *E. coli*, or another supported organism. Such a value gets its own
metric key and provenance; it does not populate `expression`. If a unified
best-available view is added, each row must carry a separate `bestAvailableBasis`
of `direct`, `transferred`, `inferred`, `proxy`, or `unknown`, plus its
source-organism and confidence metadata. A rough transferred estimate may then rank
or display ahead of `unknown`, while a user can still restrict the view to direct
UTEX 2973 measurements. The legacy `expressionBasis` field remains limited to
`measured`, `proxy`, or `null`.

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

  "codonPca": [ -2.14, 0.88, 1.03, ... ],  // first 6 PCs of native codon space
  "riskUmap": [ 4.21, -1.09 ],   // baseline UMAP, target-independent features only
  "codons": "MKTAQ..."           // packed codon string, lengthCodons chars
}
```

Nulls are permitted for `name`, `operonId`, and any metric that genuinely could
not be computed. The site renders null as an em-space, never as zero.

One recorded exception, found by the 2026-10-03 data-use audit (finding A-03):
the two live projections, the risk PCA and the perturbation PCA, substitute a
feature column's finite mean for a non-finite cell before fitting, as
[metric-explanations.md](metric-explanations.md) specifies and the "Features
used" disclosure states to the reader. No shipped feature column has a null, so
the path is dormant on this release; if one ever did, the affected gene would be
placed at that axis's centroid without a per-gene mark. The precomputed
projections take the opposite route and drop such a gene. Whether to keep the
exception or make the live projections drop the gene too is an owner decision;
until it is made, this paragraph is the contract's record that the exception
exists.

`annotations.json` is an object keyed by every published gene's exact locus tag.
Each record may also carry `curatedFunction`: null for UTEX 2973, and for
E. coli K-12 MG1655 (since 2026-10-06) the UniProtKB entry joined to the locus
through its ordered locus name: `accession`, `entryName`, `reviewed`,
`proteinName`, `function` (the curators' FUNCTION sentences, one string per
block, empty when UniProt states none), `existence`, `entryVersion`,
`modified`, `mappingMethod`, `mappingAmbiguity` (an entry naming several loci is
carried to each and says so) and `otherEntries`. The E. coli GO relationships
come from the UniProt-GOA proteome file, not a RefSeq GAF, so their evidence
codes include experimental ones and `assignedBy` names EcoCyc, UniProt,
InterPro and others; the builder is `tools/ecoli_annotation_layer.py`, whose
release directory the organism config names. The viewer shows the function as
the curators' sentences and never derives a category from it.
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
count (two per condition), threshold, exact-join coverage, and the paired pooled
metric's provenance id in `pooledScoreSourceId`. The source and derived-table
hashes and reproduction steps are in
`data/expression/TAN2018_TSS_PROVENANCE.md`.

This site-row layer and the `tssInitiation` metric deliberately remain separate.
The former has 1,789 exact-locus genes and the latter 1,727; their intersection is
1,317, leaving 472 site-only and 410 score-only loci. Each count names its layer:
`meta.tssEvidenceSource.summary.layer` is `tss_evidence.json`, so its
`genesWithoutMappedTss` (926) is genes with no site row, and every expression
metric's `desc` states its coverage "in the `<metricKey>` column of `<payload>`"
(1,727 of 2,715 in the `tssInitiation` column of `genes.json`).
`tools/validate_contract.py` pins both numbers against the shipped columns, so a
count that drifts from its column fails the gate. No start-distance cutoff is
applied to the site join, and neither layer backfills the other. Detail rows and
exports must state `mapped site(s); pooled score absent` for the first direction
and `pooled score; no exact Table S1 site` for the reverse. The exact join audit
and stable examples are in `data/expression/TAN2018_TSS_PROVENANCE.md`.

### The shared marker representation

Every admitted positional feature reaches a view through one record shape,
`core/marker-layers.js`, so no two views can describe the same site
differently. The record exists to keep three things apart that a looser shape
would merge.

**Geometry is explicit.** A feature is a `point` or an `interval`, and an
interval needs both ends. One end alone is an unmapped interval, never a point
at the end it has, because the missing end is not zero and not the other end.
An interval whose end precedes its start runs across the circular origin and is
measured around the replicon; without a known replicon length it is not
measured at all.

**Coordinate bases are carried together and never converted.** A native genomic
coordinate measured on this assembly may go on a genomic axis or on a sequence
column. A distance published against another gene model is gene-relative
evidence and places a mark on a gene-relative track only. A view that draws one
basis names the other and the gap between them; neither is re-measured into the
other, which is the same rule "Coordinates never transfer" states for
sister-strain features.

**What was measured and what landed are separate fields.** `measurement` is
whether the source measured the feature or predicted it — a row's own value
wins, otherwise the layer's statement about its rows, and null where neither
says, which is read as neither answer. `coordinateStatus` is whether the record
carries a usable native coordinate; a row without one is kept and marked
unmapped, never dropped, because a dropped row is indistinguishable from a row
the study never published. Read counts are a third thing again: a published
site with no counts in an extract is still a measured site.

`MARKER_TYPES` is a representation vocabulary and admits nothing. TSS and TIS
are separate entries and must stay separate: transcription initiation and
translation initiation are different measurements at different positions. A
type having an entry there puts no data behind it — an organism's own record
declares which layers exist, and only a declared layer whose file has landed
with a row to govern can be offered a reader a control. The one admitted marker
layer today is the Tan 2018 `tssEvidence` extract, whose gTSS rows are measured
points.

`regulatory_tss.json` separately publishes the 2,333 non-gTSS Table S1 rows
(antisense, internal, and orphan or novel). It preserves every feature's own
coordinate, strand, source locus, raw cultures, and reported condition
comparisons. Mapping to a plotted CDS is only an exact current locus-ID join;
unassociated and unmapped rows remain searchable. The source and derived TSV
hashes, mapping counts, and conditions are pinned in the JSON and provenance
file. No per-gene abundance or regulation claim is calculated from these rows.
Its `potentialTargets` array also preserves the 101 condition-specific
Table S8 antisense-site/potential-target rows as explicitly labelled source
hypotheses, with no inferred regulatory edge.
Regenerate the browser copy with `python3 tools/regulatory_tss.py write` and
verify it with `python3 tools/regulatory_tss.py check`.

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
  tAI**, this genome's own codon-adaptation proxies. This is a decision about the
  admitted PCC 7942 assay, not a rule that every distant measurement outranks every
  UTEX-derived proxy; future ordering must apply the transfer-fitness rules above.
  If native measured evidence is absent, the current implicit
  selection falls back to CAI, then tAI, then the genome-derived expression
  proxy. In the current release, borrowed evidence remains an explicit choice and an
  opt-in overlay wherever the interface excludes it by default (see "Guided panel
  design"). A future best-available layer may select admitted transferred or inferred
  evidence automatically when direct evidence is absent, provided the basis, source,
  confidence, and restriction to direct-only values remain immediately available.
  The current ranking follows
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

Every entry of `data/expression/sources.json` also names `citationId`, the id of its
row in `site/data/citations.json`; the pipeline rejects an empty one, and the ledger
test requires the id to exist. A layer the ingestion tool made
(`tools/ingest_expression.py`) carries an `ingest` block (source file, checksum,
sample columns, normalisation, mapped and unmapped counts, mapping route), from
which the metric help derives the layer's method line and citation.

A protein deposit keyed by UniProt accession takes the `uniprot_pcc7942`
route in `tools/ingest_expression.py`: accession to PCC 7942 ordered-locus name
through UniProt's own table for taxon 1140, pinned beside the specs, then the
`pcc7942_old_locus_tag` crosswalk, both steps one-to-one; a protein group naming
several accessions is dropped and counted. The route is recorded in the source's
`ingest.mappingRoute` with its matched and unmapped counts. A deposit of
DTASelect filter reports instead of a table (`reader.format: dtaselect`, one
`zipMembers` entry per run) is read protein-line by protein-line into one count
column per run (`countColumn`, default `Spectrum Count`); a locus of the UniProt
FASTA form becomes its accession, decoys are dropped, and a layer mean covers
only the proteins every replicate run identified. A table that lists features
besides genes or prefixes each locus tag names the identifiers to read
(`reader.idPattern`, matched whole; the first group, if any, is the identifier):
rows outside it are dropped and counted as unmapped, never read as duplicates.
An identifier column the deposit leaves unnamed is named by the empty string.
A deposit that splits its replicates over several files names them in `files`
rather than `file`, each checksum-pinned and labelled; they are joined on the
identifier and each column takes its file's label as a suffix, as several
sheets of one workbook already are. The manifest's `ingest.sourceFile` and
`sourceSha256` then list every file, semicolon-separated.

Each source also names its `payload`. The two original measurements
(`expression`, `tssInitiation`) ride in `genes.json`; every ingested layer is
published in `site/data/expression_layers.json`, a tier 3 file the site joins by
locus tag, so the gene file the map waits for keeps its size budget however many
studies are admitted:

```jsonc
{
  "schemaVersion": 1,
  "geneIds": ["M744_RS00005", ...],          // genes.json order, checked before the join
  "layers": { "exprGse288532Day": [12.3, null, ...], ... }  // one entry per gene; null is unknown
}
```

The registry lists a layer metric before its file lands (it reads as unknown
until then, and a link that colours, plots, filters, or traffic-lights by one
waits for the file before the reveal); the validator checks the gene order, the
layer set, the values, and the coverage, and that no layer value is duplicated in
`genes.json`.

**Data-type metrics (owner decision, 2026-10-06).** The selectors never offer
a dataset's own metric. They offer one metric per kind of measurement, built in
the browser by `site/js/core/type-metrics.js` from `meta.expressionSources`: the
key is `type.<dataType>.<platform>.<kind>` (kind `abundance`, `initiation` from
an assay naming initiation, or `fitness`), the label names the quantity and the
platform ("Transcript abundance (RNA-seq)", "Transcription initiation
(RNA-seq)"), and the metric reads the one dataset that *informs* it at call
time: its values, unit, description, scale and provenance. The informing dataset
is the only selected dataset of that type; with several selected the type
**pools** them (owner decision, 2026-10-06) unless the reader names one under
Data Sources, on an axis source select, or through the filters' Select source;
the named dataset rides in the link as `src=<type>=<datasetId>`. A link naming
a dataset's own metric (older links, `c=exprGse288532Day`) is read as its type
informed by that dataset, with the dataset added to the selection. The pooling
rule, stated as the value's unit wherever it is shown: an abundance pools as the
mean of each dataset's within-dataset mid-rank percentile (0 to 1, unitless,
because the deposits' units differ); a signed fitness pools as the mean of the
published log2 values. A pooled provenance names every contributing dataset and
cites each. Datasets measured in an engineered strain sit in the `engineered`
group of the data selection and are named as such (owner decision, 2026-10-06).
Every type the release has a dataset for is offered in the selectors; asking
for a type none of whose datasets is selected selects its defaults (the shipped
originals and the standard-growth sets, else every dataset of the type), and the
Data Sources section lists every dataset of the colouring type with an include
control, a pooled row and an "alone informs" choice (owner report, 2026-10-06).

`meta.pairJudgements` carries the owner's judgements on escalated condition-set
pairs from `data/expression/pair_judgements.json` (the transcription of the
2026-10-05 review sheet, three entries extrapolated and marked so). Each names
both sides by study and condition-table row and one call: `share`, `separate`,
`conditional` (with its condition), or `undecided`. The site's `comparable()`
reads a judgement before any threshold; an absent file is no judgement, never a
default call. The validator checks the shape and that no pair is judged twice.

### `codon_pca.json`

```jsonc
{
  "explainedVariance": [0.184, 0.092, ...],   // per PC, fraction
  "loadings": [ { "codon": "TTT", "aa": "F", "pc": [0.14, -0.08, ...] }, ... ],
  "nComponents": 6
}
```

### `codon_rscu.json`

```jsonc
{
  "schemaVersion": 1,
  "geneIds": [ "M744_RS00005", ... ],   // repeats the genes.json order exactly
  "rscu": [ [1.02, 0.41, ...], ... ]    // one 59-float vector per gene
}
```

The per-gene relative synonymous codon use, published apart from `genes.json`
and joined to it by position the way `expression_layers.json` is. `geneIds`
repeats the gene order so a payload built from a different gene file cannot be
joined, and the column order is `meta.rscuOrder`, which stays in `meta.json` and
is not repeated here. No value appears in both files.

**The site never reads a per-gene vector, so this file joins no tier and the
page does not request it.** Its only browser-side relative is
`meta.rscuOrder`, read for the native projection's feature labels. The native
codon PCA is fitted in the pipeline from the in-memory matrix and ships as
`codon_pca.json`; the offline readers are `tools/validate_contract.py`,
`tools/audit_pca_length.py`, and `scripts/check_feature_consistency.py`, each of
which refuses a payload whose `geneIds` do not match the gene file beside it.
`site/js/core/data-files.js` therefore has no entry for it, which is what keeps
it out of the loading bar's denominator; the content manifest still describes it,
because the manifest describes the directory.

A value is a finite non-negative number. The pipeline's absent-family convention
contributes zeros for an amino acid a gene does not use, so a null here would be
a vector that could not be computed, and the validator fails on one rather than
reading it as zero. The file is per organism, written into that organism's own
release root, and an organism that publishes no `genes.json` publishes no vectors
either.

### `excluded.json`

```jsonc
[
  { "id": "M744_RS03825", "reason": "length_not_multiple_of_3", "lengthNt": 755 },
  { "id": "b0470", "reason": "alternate_cds", "lengthNt": 1296,
    "proteinId": "YP_009518751.1" }
]
```

Published JSON is UTF-8 with non-ASCII text emitted directly
(`ensure_ascii=false`), compact separators, insertion-order keys, and one trailing
newline. Those byte-level choices are part of reproducibility: a rebuild must
match every generated file byte for byte except `meta.builtAt`.

### `data-manifest.json`

```jsonc
{
  "schemaVersion": 1,
  "files": {
    "genes.json": { "bytes": 5169989, "sha256": "<64 lower-case hex digits>" }
    // one entry for every other published *.json file, this one excluded
  }
}
```

The content manifest of this directory: every published JSON file with its exact
byte size and SHA-256. It carries no biological content and changes no value. The
site reads it first and addresses each data file by its digest, so a browser may
answer from its cache without asking the server, and uses the sizes as the
loading bar's denominator; see [progressive-loading.md](progressive-loading.md).

It is written by `tools/build_data_manifest.py build`, which must run **last**,
after any tool that writes here, because several of them rewrite one file without
touching `meta.json`. A manifest that no longer matches the files would pin
visitors to a superseded copy, so `tools/build_data_manifest.py check`,
`tools/validate_contract.py`, and the deploy workflow each refuse one.

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
is the file the map waits for. It stays at or below **2,000 bytes per plotted
gene, uncompressed**, for every organism; the validator computes the
limit from the file's own gene count. Relationship-heavy `annotations.json` and
`tss_evidence.json` are separate payloads joined by locus tag, and GitHub Pages
serves them compressed.

The remedy when a core file approaches the budget is to move a field the map does
not wait for into its own joined payload, never to drop precision. A field with
no browser consumer moves transparently: the per-gene RSCU vectors went to
[`codon_rscu.json`](#codon_rscujson), which joins no tier and the page never
requests, and that alone returned about 400 bytes per gene for both organisms.
A field the page does read is a different decision, because the payload then
joins a declared tier and its absence has to read as loading rather than as
missing. The packed `codons` field is on the critical path — `buildCoreDataset`
decodes every gene to build the scheme-metric arrays — and owner decision of
2026-10-07 keeps it in `genes.json` with its current decode, scheme metrics,
deltas, target counts, sequence views, and exports unchanged.

Owner decision, 2026-10-05: the budget is per gene, replacing a fixed
6,291,456 bytes set when the only organism had 2,715 genes. The measurements
behind it, before and after the RSCU split:

| | UTEX 2973 | E. coli K-12 MG1655 |
| --- | ---: | ---: |
| plotted genes | 2,715 | 4,287 |
| `genes.json`, bytes, with `rscu` | 5,169,989 | 8,042,652 |
| bytes per gene, with `rscu` | 1,904 | 1,876 |
| `genes.json`, bytes | 4,079,627 | 6,310,634 |
| bytes per gene | 1,503 | 1,472 |
| limit, bytes | 5,430,000 | 8,574,000 |
| gzip, bytes | 1,304,912 | 2,038,599 |
| `codon_rscu.json`, bytes | 1,112,123 | 1,736,346 |

The gzip row is `gzip -n -9 -c genes.json | wc -c` with Apple gzip 479 on the
files whose SHA-256 begin `d87acf792efb` and `348e8b8ccbb9`.

The two organisms cost the same per gene, so E. coli's larger file is gene
count, not schema growth, and a per-gene gate still catches the latter. What the
decision accepts: the first load of a larger genome takes proportionally longer.
The documented slow-link profile in
[progressive-loading.md](progressive-loading.md) gives a usable map at 9.1 s for
UTEX 2973 and scales to roughly 14 s for E. coli; that E. coli figure is an
estimate, not a measurement, and neither has been re-measured against the
smaller core file. A further joined payload remains the remedy if a core file
outgrows the per-gene budget again.

## Length cohort inventory

The optional `site/data/length_cohorts.json` is a pinned, checked derivation
of the RefSeq GFF, plotted `genes.json`, and exact protein-identity table.
See [length-cohorts.md](length-cohorts.md) for cohort definitions, separate
gene-span and joined-CDS length fields, URL/filter behavior, and the
unavailable direct-detection tier.

## Borrowed PCC 7942 essentiality

`site/data/pcc7942-essentiality-v1.json` is a checked derivation of Adomako
2022 Data Set S1 and the pinned RefSeq crosswalk. Its `byLocus` map has one
entry for each of the 2,715 plotted UTEX CDSs. Each entry holds the **source
PCC 7942 status**, PCC locus and pangenome ID where an exact, unique
shared-protein join is admitted, plus a `mappingStatus` and reason. `unknown`
marks an unjoined locus; `missing`, `not_analyzed`, and `ambiguous` preserve
distinct source states. None is converted to `non-essential`. The `source`
object retains Adomako/Rubin provenance, source conditions, CC BY 4.0
attribution, and the explicit cross-strain assumption. See
[pcc-essentiality.md](pcc-essentiality.md) for the rebuild and interpretation
rules. Candidate evidence and exports reuse these calls without treating them
as a UTEX 2973 measurement.

## GO IEA essentiality context

`site/data/go-iea-essentiality-v1.json` is optional. When present, the browser
requires `candidate_evidence.json` and refuses to load unless each record's
`tier` equals the precedence re-derived from that file. `byLocus` has one sorted
record for each of the 2,715 plotted CDSs:

| Field | Contract |
| --- | --- |
| `tier` | `tested-utex-allele`, `admitted-pcc-call`, `go-iea-context`, or `unknown`, in that precedence. |
| `pcc7942Status` | The PCC status copied from candidate evidence. `ambiguous`, `missing`, `not_analyzed`, and `unknown` are not determinate calls. |
| `goContext` | `null` without GO terms. Otherwise `{label, pCore, mostLikely, termCount}`, with `label` one of `core-cellular-process`, `not-core`, or `uncertain`. |
| `discrepancies` | An ordered list of `{kind, probability, note}`. `kind` is `utex-product`, `pcc7942-product`, `reviewed-category`, or `pcc7942-call`. Judged kinds carry a probability at or above the policy's discrepancy threshold; `pcc7942-call` carries `null` and appears exactly when the label is `core-cellular-process` and the PCC status is `non-essential`. |

Top-level `attribution` carries the Gene Ontology Consortium CC BY 4.0 notice.
`judgment` pins the TypeSafe model, the rubric, and the results hashes, while
`policy` states the rules and thresholds and `counts` summarizes tiers. The GO
tier is computational context, never a measured or borrowed call, and the panel
objective never reads it. See
[go-iea-essentiality-context.md](go-iea-essentiality-context.md). The contract
validator re-derives every tier independently.

## Source-derived function categories

`site/data/source-derived-categories-v1.json` is optional. When present, the
browser requires the reviewed function-category table and
`candidate_evidence.json`, and refuses to load unless the file's vocabulary
equals the reviewed vocabulary and every assignment re-derives from its
probability. `byLocus` has one sorted record for each of the 2,715 plotted
CDSs with two entries:

| Field | Contract |
| --- | --- |
| `pcc-7942` | `null` without an accepted PCC 7942 join. Otherwise `{pccLocusTag, mostLikely, probability, categoryId}` judged from the joined RefSeq product name alone. |
| `go-iea` | `null` without GO IEA terms. Otherwise `{termCount, mostLikely, probability, categoryId}` judged from the GO terms alone. |

`mostLikely` is one of the eleven vocabulary ids; `categoryId` equals
`mostLikely` when it is not `unknown-or-unclassified` and `probability` is at
least `policy.thresholds.derivedProbabilityAtLeast` (0.8), and is `null`
otherwise. Top-level `attribution` carries the Gene Ontology CC BY 4.0 notice
and the Adomako/Rubin PCC 7942 attribution, `judgment` pins the TypeSafe
model, rubric, and result hashes, `policy` states the evidence labels,
precedence, and disagreement rule, and `counts` summarises each source and
the all-sources legend. The reviewed table is never changed. See
[source-derived-categories.md](source-derived-categories.md); the contract
validator re-derives every assignment and the legend independently.

## Annotation sources for colouring

The viewer has three checkboxes, UTEX 2973, PCC 7942, and GO IEA, inside the
category legend. They govern function-category colouring and the legend
counts only. There is no single-source view: the detail panel, shortlist and
comparison tables, panel-designer list, search suggestions, and export always
show every source's annotations, including the GO IEA essentiality tier and
its discrepancy notes. Colour follows UTEX > PCC > GO among the enabled
sources, as described in [function-categories.md](function-categories.md).

The export manifest records `functionColourSources` as `{ id, label,
enabled }`, where `id` is `all`, `none`, a single source id, or the enabled
ids joined with `+`, and a caveat names those sources, so a file's colour
buckets can be read against the toggles that produced them. Rows carry no
per-row source field; `functionCategory`, `functionCategoryEvidence`, and
`functionCategoryConflict` are the only columns that depend on the toggles.
Every export also names `tssInitiationBasis`, `tssInitiationBasisReason`, and
`tssMappedSiteCount`; these remain blank unless both `meta.tssEvidenceSource`
and its provenance-linked pooled-score metric are present.

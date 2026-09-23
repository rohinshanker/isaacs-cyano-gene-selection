/** One reusable explanation contract for every selectable colour metric. */
import {
  describeExpressionSource, isExpressionMetric, isExpressionProxyMetric,
  measurementLimitClauses,
} from './metric-registry.js';
import { annotationSourceLabel } from './annotation-source.js';
import { THRESHOLDS as DERIVED_THRESHOLDS } from './source-derived-categories.js';
import { formatCount } from '../ui/format.js';

const METHODS = Object.freeze({
  gc: 'G or C bases divided by all bases in sense codons; terminal stop excluded.',
  gc1: 'G or C at the first position of each sense codon, divided by sense-codon count.',
  gc2: 'G or C at the second position of each sense codon, divided by sense-codon count.',
  gc3: 'G or C at the third position of each sense codon, divided by sense-codon count.',
  a3: 'A at the third position of each sense codon, divided by sense-codon count.',
  t3: 'T at the third position of each sense codon, divided by sense-codon count.',
  g3: 'G at the third position of each sense codon, divided by sense-codon count.',
  c3: 'C at the third position of each sense codon, divided by sense-codon count.',
  enc: 'Wright effective number of codons from synonymous-family frequencies. Families with fewer than two observations use the class mean or neutral fallback.',
  encExpected: 'Wright neutral expectation 2 + s + 29/(s² + (1 − s)²), where s is synonymous-site GC3 after excluding Met and Trp.',
  deltaEnc: 'Expected ENC from the neutral curve minus observed ENC for this CDS.',
  cai: 'Geometric mean of synonymous codon weights relative to a fixed 71-locus ribosomal/housekeeping reference. Zero reference counts receive 0.5 before normalization; Met and Trp are excluded.',
  tai: 'Geometric mean of codon weights from annotated genomic tRNA copy counts and the dos Reis wobble model. Met is excluded; zero weights use the declared substitution, and Ile-CAT lysidine is represented separately.',
  expressionPercentile: 'Midrank percentile of the PCC 7942 measured abundance values among genes with a mapped value; it is not a UTEX 2973 measurement.',
  expressionProxy: 'Tie-aware average rank of √(CAI × tAI) across all plotted genes, scaled to 0–1. This is a model proxy, not a transcript count.',
  rareFraction: 'Rare sense-codon count divided by sense-codon count; rare means genome-wide frequency within the same amino-acid family strictly below 0.1.',
  rareCount: 'Count sense codons whose genome-wide within-amino-acid frequency is strictly below 0.1.',
  longestRareRun: 'Maximum uninterrupted run of rare sense codons, using the genome-wide within-amino-acid threshold below 0.1.',
  rampRareCount: 'Rare-codon count in the first 50 sense codons, or the whole gene when shorter.',
  minLocalTai: 'Minimum arithmetic mean of codon tAI weights across sliding 9-codon windows of the sense CDS; the whole sense CDS is used when shorter.',
  cps: 'Mean amino-acid-pair-conditioned log observed/expected score across adjacent sense-codon pairs in this CDS.',
  underrepresentedPairFraction: 'Adjacent sense-codon pairs with a negative genome-derived pair score divided by all adjacent pairs.',
  mfeStart: 'ViennaRNA minimum folding free energy for genomic RNA from 30 nt before to 60 nt after the start.',
  mfeFirst100: 'ViennaRNA minimum folding free energy for the first 100 CDS nt, or the entire CDS when shorter.',
  minLocalGc: 'Lowest GC fraction across sliding 30-nt CDS windows; the whole CDS is used when shorter. Windows can include the terminal stop.',
  maxLocalGc: 'Highest GC fraction across sliding 30-nt CDS windows; the whole CDS is used when shorter. Windows can include the terminal stop.',
  gc5prime: 'GC fraction in the first 30 nt of the CDS, or the whole CDS when shorter.',
  lengthNt: 'Sum of joined CDS segment lengths in nucleotides, including the terminal stop; this can differ from the gene span.',
  lengthCodons: 'Number of translated sense codons, excluding the terminal stop.',
  neighborUpstreamNt: 'Strand-aware separation from the preceding CDS on the circular replicon; negative means overlap.',
  neighborDownstreamNt: 'Strand-aware separation from the following CDS on the circular replicon; negative means overlap.',
  operonPosition: 'One-based order within a predicted same-strand group of CDSs separated by at most 100 nt; singleton position is unknown.',
  operonSize: 'Number of CDSs in that predicted same-strand, at-most-100-nt group, including singletons.',
  expression: 'DESeq2 normalized transcript counts from the mapped PCC 7942 study; no value is imputed for an unmatched UTEX locus.',
  tssInitiation: 'Per locus, sum across the separately pinned Figshare per-TSS feature set of the mean of eight raw start-site count fields. This pooled score is independent of the Table S1 site list and is initiation, not gene-body abundance.',
  targetCount: 'Sense-codon target count plus one when the active scheme reassigns this gene’s terminal stop; the start codon is never edited.',
  targetStopEdit: 'One if the active scheme reassigns this gene’s terminal stop, otherwise zero.',
  targetFraction: 'Target count, including a possible stop edit, divided by sense-codon count; the start codon is not a target.',
  targetPerKb: 'Target count, including a possible stop edit, multiplied by 1,000 and divided by full CDS length in nt.',
  targetFirstRamp: 'Targeted sense codons in the first 50 codons; neither initiation codon nor terminal stop enters this window.',
  maxLocalTargetDensity: 'Largest target share among sliding 50-sense-codon windows; the whole sense CDS is used when shorter, and terminal stop is excluded.',
  targetClusters: 'Number of groups of targeted sense codons with gaps no larger than 10 codons.',
  maxClusterSpan: 'Largest inclusive first-to-last sense-codon span among those target clusters.',
  recodedGc3: 'Apply the active synonymous scheme, then recalculate third-position GC fraction over sense codons.',
  recodedCai: 'Apply the active scheme, then recalculate CAI with the same fixed 71-locus reference and 0.5 zero-count convention.',
  recodedTai: 'Apply the active scheme, then recalculate tAI with the same genomic tRNA copy counts and wobble model.',
  recodedEnc: 'Apply the active scheme, then recalculate Wright ENC with the same family-substitution convention.',
  recodedCps: 'Apply the active scheme, then average codon-pair log scores against the wild-type genome reference.',
  dGc3: 'Recoded GC3 minus this gene’s wild-type GC3.',
  dCai: 'Recoded CAI minus this gene’s wild-type CAI.',
  dTai: 'Recoded tAI minus this gene’s wild-type tAI.',
  dEnc: 'Recoded ENC minus this gene’s wild-type ENC.',
  dCps: 'Recoded codon-pair score minus this gene’s wild-type score.',
});

const METHODS_CITATIONS = Object.freeze({
  enc: ['wright-enc'], encExpected: ['wright-enc'], deltaEnc: ['wright-enc'],
  cai: ['sharp-li-cai'], recodedCai: ['sharp-li-cai'], dCai: ['sharp-li-cai'],
  tai: ['dos-reis-tai', 'soma-lysidine'], minLocalTai: ['dos-reis-tai'],
  recodedTai: ['dos-reis-tai', 'soma-lysidine'], dTai: ['dos-reis-tai', 'soma-lysidine'],
  cps: ['coleman-codon-pairs'], underrepresentedPairFraction: ['coleman-codon-pairs'],
  recodedCps: ['coleman-codon-pairs'], dCps: ['coleman-codon-pairs'],
  mfeStart: ['viennarna'], mfeFirst100: ['viennarna'],
  expression: ['simkovsky-2022', 'deseq2'],
  expressionPercentile: ['simkovsky-2022', 'deseq2'],
  expressionProxy: ['sharp-li-cai', 'dos-reis-tai'],
  tssInitiation: ['tan-2018'],
  recodedEnc: ['wright-enc'], dEnc: ['wright-enc'],
});

/**
 * How to weigh a metric when reading a candidate.
 *
 * CAI and tAI reproduce a convention: CAI scores against a frozen 71-locus
 * product-name reference that is not measured high expression, and tAI counts
 * annotated tRNA genes, which is not tRNA abundance, charging, or decoding.
 * The expression proxy is built from both. They stay selectable everywhere and
 * keep their citations; this line says what they are worth beside a
 * measurement, so no one reads a convention as the primary evidence for a gene.
 *
 * A measured metric instead states the replicate count its release declares,
 * so a thin measurement is read as thin rather than hidden.
 */
const READING = Object.freeze({
  cai: () => 'A convention-derived index, not a measurement: read it as supporting context '
    + 'for a candidate, behind measured UTEX 2973 evidence, never as the primary evidence.',
  tai: () => 'A convention-derived index, not a measurement: read it as supporting context '
    + 'for a candidate, behind measured UTEX 2973 evidence, never as the primary evidence.',
  expressionProxy: () => 'A rank built from CAI and tAI, so it inherits both conventions: '
    + 'read it as supporting context, behind measured UTEX 2973 evidence.',
  tssInitiation: (meta) => {
    const replicates = meta?.tssEvidenceSource?.replicatesPerCondition;
    const conditions = meta?.tssEvidenceSource?.conditions?.length;
    return 'Measured in this organism. '
      + (Number.isFinite(replicates)
        ? `The study has only ${replicates} biological ${replicates === 1 ? 'replicate' : 'replicates'} `
          + `per condition${Number.isFinite(conditions) ? ` across ${conditions} conditions` : ''}, `
          + 'and a thin measurement still outranks a codon-usage convention.'
        : 'Replicate depth is not declared in this release, so read the coverage below with it.');
  },
});

/** The reading note plus any declared condition and coverage limits. */
function readingNote(metric, dataset, formatCount) {
  const base = READING[metric.key]?.(dataset.meta) ?? null;
  const limits = measurementLimitClauses(metric, formatCount);
  if (!base && limits.length === 0) return null;
  const limitSentence = limits.length > 0 ? `Measurement limits — ${limits.join('; ')}.` : '';
  return [base, limitSentence].filter(Boolean).join(' ');
}

/**
 * The same limits in one short clause, for a control that has room for a line
 * rather than a paragraph: the axis note beside the Metric X vs Y selectors and
 * the comparison views, wherever a measurement is a default rather than a
 * choice. The full wording stays in the metric's own explanation disclosure.
 *
 * Replicate depth comes from the release record when it declares a count, and
 * otherwise from the source's own condition sentence, which is where a study
 * such as the PCC 7942 transcriptome states its replication. Neither is
 * invented, and the coverage count always follows, so a promoted measurement
 * never appears without saying how thin it is.
 */
function shortLimits(metric, dataset, formatCount) {
  const declaredReplicates = metric.key === 'tssInitiation'
    ? dataset.meta?.tssEvidenceSource?.replicatesPerCondition : undefined;
  const clauses = [];
  if (Number.isFinite(declaredReplicates)) {
    const conditions = dataset.meta?.tssEvidenceSource?.conditions?.length;
    clauses.push(`${declaredReplicates} `
      + `${declaredReplicates === 1 ? 'replicate' : 'replicates'} per condition`
      + (Number.isFinite(conditions) ? ` across ${conditions} conditions` : ''));
  }
  const all = measurementLimitClauses(metric, formatCount);
  const coverage = all.find((clause) => clause.includes('genes have a value'));
  if (clauses.length === 0) {
    // No declared count: the condition sentence carries the study's own
    // replication and conditions, so it is quoted rather than dropped.
    const condition = all.find((clause) => clause.startsWith('condition: '));
    if (condition) clauses.push(condition.replace(/^condition: /, ''));
  }
  if (coverage) clauses.push(coverage);
  return clauses.length > 0 ? clauses.join('; ') : null;
}

/** Build an evidence-coded explanation from registry and release metadata. */
export function metricHelp(metric, dataset) {
  if (!metric) return null;
  const { genes, meta } = dataset;
  const known = genes.reduce((sum, _gene, index) => sum + Number.isFinite(metric.read(index)), 0);
  const release = meta.annotationRelease?.releaseId ?? meta.genome?.accession ?? 'the pinned UTEX 2973 genome';
  const expression = isExpressionMetric(metric) && !isExpressionProxyMetric(metric);
  const origin = expression
    ? (describeExpressionSource(metric.provenance) ?? 'Expression source is not declared in this dataset.')
    : metric.key === 'expressionProxy'
      ? `Derived from codon adaptation in UTEX 2973 release ${release}; it is not measured abundance.`
      : metric.source === 'live'
        ? `Computed in this browser from the active scheme and UTEX 2973 release ${release}.`
        : `Derived from UTEX 2973 RefSeq release ${release}.`;
  const formatCount = (value) => value.toLocaleString('en-US');
  return {
    key: metric.key,
    title: metric.label,
    summary: metric.desc || `${metric.label} for this gene.`,
    method: METHODS[metric.key] ?? metric.desc ?? 'Calculation method is not declared.',
    unit: metric.unit || 'unit not declared',
    origin,
    coverage: `${known.toLocaleString('en-US')} of ${genes.length.toLocaleString('en-US')} plotted CDSs have a finite value; missing values remain unknown, not zero.`,
    reading: readingNote(metric, dataset, formatCount),
    limits: shortLimits(metric, dataset, formatCount),
    citations: [...(METHODS_CITATIONS[metric.key] ?? []),
      ...(expression ? [] : ['ncbi-utex-2973'])],
  };
}

export function methodKeys() {
  return Object.keys(METHODS);
}

/**
 * The explanation shown when the colour is Function category. It states the
 * implemented rule: among the enabled sources, UTEX 2973 > PCC 7942 > GO IEA,
 * so a reviewed row colours only while UTEX 2973 is enabled, and a
 * disagreement is coloured by the highest-priority enabled source and named,
 * never sent to the multiple-functions bucket.
 *
 * @param {{reviewed: object, derived: object|null, categories: object}} options
 *   `reviewed` is `dataset.functionCategories`, `derived` is
 *   `dataset.sourceDerivedCategories` or null, and `categories` is the model
 *   from `resolveFunctionCategories` under the enabled sources.
 */
export function functionCategoryHelp({ reviewed, derived, categories }) {
  const threshold = DERIVED_THRESHOLDS.derivedProbabilityAtLeast.toFixed(2);
  return {
    title: 'Function category',
    summary: 'A broad cyanobacterial function for each CDS under the enabled annotation '
      + 'sources: the lab-reviewed UTEX 2973 assignment when that source is enabled and a '
      + 'reviewed row exists, otherwise a category derived from the PCC 7942 product name or '
      + 'the GO IEA terms. The same colour has the same category on every map tab.',
    unit: 'category (not a numeric metric)',
    method: `The lab approved ${formatCount(reviewed.reviewedCount)} exact locus decisions `
      + `on ${reviewed.source.provenance.userReview.date}. Among the enabled sources, colour `
      + 'follows UTEX 2973 > PCC 7942 > GO IEA: a reviewed row colours its CDS only while '
      + 'UTEX 2973 is enabled, otherwise the PCC 7942 category, otherwise the GO IEA category. '
      + (derived
        ? `Derived categories are TypeSafe ${derived.judgment.model} judgments over each `
          + `enabled source, assigned only at probability ${threshold} or above, drawn as a `
          + 'hollow ring with a centre dot, and labelled pcc-7942-derived or go-iea-derived. '
          + 'When enabled sources disagree, the highest-priority enabled source colours the CDS '
          + 'and the detail panel and export name the conflict; disagreements never use the '
          + 'multiple-functions bucket, which only two reviewed labels reach.'
        : 'GO IEA suggestions never assign a category colour by themselves.'),
    origin: `UTEX 2973 RefSeq ${reviewed.source.provenance.annotationRelease} product records `
      + 'and the lab review table'
      + (derived ? '; PCC 7942 RefSeq product names at admitted joins (Adomako et al. 2022, '
        + 'CC BY 4.0); Gene Ontology IEA relationships (CC BY 4.0).' : '.'),
    coverage: `Under ${annotationSourceLabel(categories.sources)}: `
      + `${formatCount(categories.reviewedCount)} coloured by lab review, `
      + `${formatCount(categories.derivedCount)} by a derived source, `
      + `${formatCount(categories.multipleCount)} in multiple functions, and `
      + `${formatCount(categories.unknownCount)} unknown or unclassified.`,
    citations: ['ncbi-utex-2973'],
  };
}

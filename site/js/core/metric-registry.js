/**
 * The single list of metrics the interface can plot, filter, colour, or tabulate.
 *
 * Pipeline metrics are declared by `meta.metrics`; the site never invents a label
 * for one. Live metrics come from the browser-side scan and carry their own
 * definitions. Both kinds look identical to every consumer, so adding a field to
 * the pipeline, expression included, needs no change here.
 */
import { LIVE_METRICS, isCountMetric } from './live-metrics.js';

/** Fallback grouping when `meta.metrics` does not declare a family. */
const FAMILY_BY_KEY = new Map(Object.entries({
  lengthNt: 'Size', lengthCodons: 'Size',
  gc: 'Base composition', gc1: 'Base composition', gc2: 'Base composition',
  gc3: 'Base composition', a3: 'Base composition', t3: 'Base composition',
  g3: 'Base composition', c3: 'Base composition', minLocalGc: 'Base composition',
  maxLocalGc: 'Base composition', gc5prime: 'Base composition',
  enc: 'Codon usage', encExpected: 'Codon usage', deltaEnc: 'Codon usage',
  cai: 'Translation', tai: 'Translation',
  rareFraction: 'Rare codons', rareCount: 'Rare codons',
  longestRareRun: 'Rare codons', rampRareCount: 'Rare codons', minLocalTai: 'Rare codons',
  cps: 'Codon pairs', underrepresentedPairFraction: 'Codon pairs',
  mfeStart: 'RNA structure', mfeFirst100: 'RNA structure',
  neighborUpstreamNt: 'Genomic context', neighborDownstreamNt: 'Genomic context',
  operonPosition: 'Genomic context', operonSize: 'Genomic context',
}));

/** Keys whose values are whole counts, for display only. */
const INTEGER_KEYS = new Set([
  'lengthNt', 'lengthCodons', 'rareCount', 'longestRareRun', 'rampRareCount',
  'neighborUpstreamNt', 'neighborDownstreamNt', 'operonPosition', 'operonSize',
]);

/**
 * True when a metric describes transcript abundance, which is what the
 * low-traffic filter thresholds on. Detection is by declaration first and by
 * name second, so a pipeline that later adds `expressionTpm` or `rnaSeqRpkm`
 * lights up the filter with no code change.
 */
export function isExpressionMetric(metric) {
  if (metric.family && /expression/i.test(metric.family)) return true;
  if (/^(expression|expr|tpm|rpkm|fpkm|rnaSeq|transcript)/i.test(metric.key)) return true;
  return /\b(tpm|rpkm|fpkm|reads per|transcripts per)\b/i.test(metric.unit ?? '');
}

/**
 * True for the codon-adaptation stand-in the contract calls `expressionProxy`.
 * It is derived from this genome, so it carries no borrowed-measurement warning,
 * and it is a rank in a different unit from any abundance, so the interface must
 * never present the two as one column.
 */
export function isExpressionProxyMetric(metric) {
  return isExpressionMetric(metric) && /proxy/i.test(`${metric.key} ${metric.label}`);
}

/** Short, honest source label for expression selectors. */
export function expressionSourceScope(metric) {
  if (isExpressionProxyMetric(metric)) return 'proxy from this genome';
  if (!isExpressionMetric(metric)) return 'from this genome';
  if (metric.provenance?.isTargetOrganism === true) return 'measured in this organism';
  if (metric.provenance?.isTargetOrganism === false) return 'measured elsewhere';
  return 'measurement source unrecorded';
}

/** The four states the contract's `expressionBasis` can be in, in display order. */
export const EXPRESSION_BASES = Object.freeze(['measured', 'proxy', 'none', 'unrecorded']);

/** The primary abundance metric's own key, stripped of a `Percentile` suffix. */
function isPrimaryAbundanceMetric(metric) {
  return metric.key.replace(/Percentile$/i, '') === 'expression';
}

/**
 * Basis for a metric that is a real measurement but is not the primary PCC
 * abundance field: it carries no proxy, so a gene either has a finite value
 * for it or it does not. Never inherits the primary metric's proxy state.
 */
function metricScopedExpressionBasis(metric, value) {
  if (Number.isFinite(value)) {
    const source = metric.provenance?.id ? ` in ${metric.provenance.id}` : '';
    return { basis: 'measured', short: 'measured', text: `Measured value for ${metric.label}${source}.` };
  }
  return {
    basis: 'none',
    short: 'no basis',
    text: `This gene has no ${metric.label} value.`,
  };
}

/**
 * Where a gene's displayed expression value comes from, per the contract.
 *
 * `measured` and `proxy` are the pipeline's own words. `none` is the contract's
 * null: neither a measurement nor a proxy exists. `unrecorded` means the dataset
 * predates the field, which is an explicit unknown and never assumed to be a
 * measurement. Callers show `text` beside any expression value.
 *
 * A gene-level `expressionBasis`/`expressionSourceId` describes only the primary
 * PCC abundance field and its proxy fallback. Any other real expression metric
 * (a native TSS score, say) is scoped to `metric` and `value` instead, so it is
 * never reported as a PCC proxy: it is either measured for this metric or it
 * has no basis at all.
 *
 * @param {object} gene a `genes.json` record.
 * @param {object|null} [metric] the metric being displayed, when known.
 * @param {number} [value] `metric.read(index)` for this gene, when `metric` is given.
 * @returns {{basis: 'measured'|'proxy'|'none'|'unrecorded', text: string, short: string}}
 */
export function expressionBasisOf(gene, metric = null, value = undefined) {
  if (metric && !isPrimaryAbundanceMetric(metric)) {
    return metricScopedExpressionBasis(metric, value);
  }
  if (!gene || !Object.hasOwn(gene, 'expressionBasis')) {
    return {
      basis: 'unrecorded',
      short: 'basis not recorded',
      text: 'The dataset does not record whether this value is measured or a proxy.',
    };
  }
  const basis = gene.expressionBasis;
  if (basis === 'measured') {
    const source = gene.expressionSourceId ? ` in ${gene.expressionSourceId}` : '';
    return { basis, short: 'measured', text: `Measured abundance${source}.` };
  }
  if (basis === 'proxy') {
    return {
      basis,
      short: 'proxy only',
      text: 'No measurement. The expression proxy, a CAI/tAI rank from this genome, stands in '
        + 'and is a different quantity in a different unit.',
    };
  }
  if (basis === null) {
    return { basis: 'none', short: 'no basis', text: 'Neither a measurement nor a proxy exists.' };
  }
  return {
    basis: 'unrecorded',
    short: 'basis not recognised',
    text: `The dataset records an expression basis of "${basis}", which this page does not know.`,
  };
}

/**
 * How many genes fall under each basis, for legends and filters. With no
 * `metric` this counts the primary PCC abundance field, as it always has.
 * With a `metric` given, counts are scoped to that metric's own values, so a
 * TSS legend reports TSS coverage rather than the primary metric's.
 * @param {object[]} genes
 * @param {object|null} [metric]
 * @returns {{counts: Map<string, number>, recorded: boolean}} `recorded` is false when
 *   no gene carries the field at all, so a filter on it would be meaningless.
 */
export function expressionBasisCounts(genes, metric = null) {
  const counts = new Map(EXPRESSION_BASES.map((basis) => [basis, 0]));
  for (let i = 0; i < genes.length; i += 1) {
    const value = metric ? metric.read(i) : undefined;
    const { basis } = expressionBasisOf(genes[i], metric, value);
    counts.set(basis, counts.get(basis) + 1);
  }
  return { counts, recorded: counts.get('unrecorded') < genes.length };
}

/**
 * Reconciles the two shapes a source declaration is shipped in: the legacy
 * single-source contract (`organismMeasured`/`normalization`/`accession`) and
 * the current `meta.expressionSources` entries (`organism`/`units`/`id`).
 * Every reader of a source goes through this boundary, so a caller never has
 * to know which shape it received.
 * @param {object|null} source
 * @returns {{organism: string|undefined, units: string|undefined, id: string|undefined,
 *   isTargetOrganism: boolean|undefined, condition: string|undefined,
 *   coverage: {withValue: number, total: number}|undefined, caveat: string|undefined}|null}
 */
function normalizeExpressionSource(source) {
  if (!source) return null;
  return {
    organism: source.organism ?? source.organismMeasured,
    units: source.units ?? source.normalization,
    id: source.id ?? source.accession,
    isTargetOrganism: source.isTargetOrganism,
    condition: source.condition,
    coverage: source.coverage,
    caveat: source.caveat,
  };
}

/**
 * A plain-language sentence naming where an expression measurement came from.
 * The interface shows this next to the value rather than in a tooltip, because a
 * measurement from another strain must not be mistaken for this genome's own.
 * @param {object|null} source a `meta.expressionSource` or `meta.expressionSources` entry.
 * @returns {string|null}
 */
export function describeExpressionSource(source) {
  const normalized = normalizeExpressionSource(source);
  if (!normalized) return null;
  const parts = [];
  parts.push(normalized.isTargetOrganism
    ? `Measured in ${normalized.organism}, this genome's own organism.`
    : `Measured in ${normalized.organism}, a different organism from the one on this page.`);
  if (normalized.condition) parts.push(`Condition: ${normalized.condition}.`);
  if (normalized.units) parts.push(`Values are ${normalized.units}.`);
  if (normalized.coverage?.total) {
    parts.push(`${normalized.coverage.withValue} of ${normalized.coverage.total} genes carry a value; `
      + 'the rest are unknown, not zero.');
  }
  if (normalized.id) parts.push(`Source: ${normalized.id}.`);
  if (normalized.caveat) parts.push(normalized.caveat);
  return parts.join(' ');
}

/**
 * @param {object} meta parsed meta.json.
 * @param {Array<object>} genes parsed genes.json.
 * @param {Record<string, Float64Array>} liveFields output of computeLiveMetrics.
 * @returns {{metrics: object[], byKey: Map<string, object>, families: string[],
 *   declaredButMissing: string[]}}
 */
export function buildMetricRegistry(meta, genes, liveFields) {
  const metrics = [];
  const declaredButMissing = [];
  const expressionSources = new Map(
    (meta.expressionSources ?? [])
      .filter((source) => source && typeof source.metricKey === 'string')
      .map((source) => [source.metricKey, source]),
  );

  for (const [key, definition] of Object.entries(meta.metrics ?? {})) {
    // Every gene, not a prefix sample: a sparse metric's first finite value can
    // land anywhere in gene order, and `.some` still exits on the first hit.
    const present = genes.some((gene) => typeof gene[key] === 'number' && Number.isFinite(gene[key]));
    if (!present) {
      declaredButMissing.push(key);
      continue;
    }
    // `scale` is the ramp family the contract lets the pipeline declare; null
    // means undeclared and the colour scale then says it inferred one.
    // `direction` is documentation in the contract and is deliberately not read.
    const metric = {
      key,
      label: definition.label ?? key,
      unit: definition.unit ?? '',
      desc: definition.desc ?? '',
      family: definition.family ?? FAMILY_BY_KEY.get(key) ?? 'Other',
      scale: definition.scale ?? null,
      source: 'pipeline',
      integer: INTEGER_KEYS.has(key),
      read: (index) => {
        const value = genes[index][key];
        return typeof value === 'number' ? value : NaN;
      },
    };
    // A measured expression metric carries its provenance so every place that
    // shows it can say where it came from. The proxy is this genome's own.
    if (isExpressionMetric(metric) && !isExpressionProxyMetric(metric)) {
      // Prefer the per-metric manifest. A derived percentile inherits the
      // source of its raw measurement. `expressionSource` is the legacy single-
      // source declaration and applies only to that raw field and its rank.
      const rawKey = key.replace(/Percentile$/i, '');
      metric.provenance = expressionSources.get(key)
        ?? expressionSources.get(rawKey)
        ?? (rawKey === 'expression' ? meta.expressionSource : null)
        ?? null;
    }
    metrics.push(metric);
  }

  for (const definition of LIVE_METRICS) {
    const values = liveFields[definition.key];
    metrics.push({
      ...definition,
      scale: definition.scale ?? null,
      source: 'live',
      integer: isCountMetric(definition.key),
      read: (index) => values[index],
    });
  }

  const byKey = new Map(metrics.map((metric) => [metric.key, metric]));
  const families = [];
  for (const metric of metrics) {
    if (!families.includes(metric.family)) families.push(metric.family);
  }
  return { metrics, byKey, families, declaredButMissing };
}

/** Rebind live metric readers after a scheme change, keeping labels and order. */
export function rebindLiveMetrics(registry, liveFields) {
  for (const metric of registry.metrics) {
    if (metric.source !== 'live') continue;
    const values = liveFields[metric.key];
    metric.read = (index) => values[index];
  }
  return registry;
}

/** Every metric value as a dense array, for sorting, filtering, and percentiles. */
export function metricValues(metric, count) {
  const out = new Float64Array(count);
  for (let i = 0; i < count; i += 1) out[i] = metric.read(i);
  return out;
}

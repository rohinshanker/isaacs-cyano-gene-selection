/**
 * Everything that depends on the active recoding scheme.
 *
 * One pass over the packed codon string per scheme change produces every
 * scheme-dependent number for every gene. Nothing here is recomputed per render.
 */
import { gc3FromCounts, encFromCounts, caiFromCounts, taiFromCounts } from './codon-metrics.js';

/** Codons per sliding window for local target density. */
export const WINDOW_CODONS = 50;
/** Codons counted as the translation ramp at the 5' end. */
export const RAMP_CODONS = 50;
/** Targets closer than this many codons apart belong to the same cluster. */
export const CLUSTER_GAP_CODONS = 10;
/**
 * Codon position zero is the initiation triplet. It translates as methionine
 * whatever the triplet is, so a substitution there is not synonymous in effect
 * and the scan never treats it as a target.
 */
export const INITIATION_INDEX = 0;

/**
 * Definitions for the metrics this module produces. The site's menus read these
 * exactly as they read `meta.metrics`, so a live metric and a pipeline metric
 * are interchangeable everywhere a metric can be chosen.
 */
export const LIVE_METRICS = Object.freeze([
  { key: 'targetCount', label: 'Target codons', unit: 'codons', family: 'Recoding load',
    desc: 'Edits this scheme would make: sense codons plus the terminal stop when the '
      + 'scheme reassigns it. The start codon is never counted.' },
  { key: 'targetStopEdit', label: 'Terminal stop reassigned', unit: '0 or 1', family: 'Recoding load',
    desc: 'One when the scheme replaces this gene\u2019s terminal stop codon, which the '
      + 'packed sequence does not contain.' },
  { key: 'targetFraction', label: 'Target fraction', unit: 'fraction of sense codons', family: 'Recoding load',
    desc: 'Edits divided by sense codons. The denominator excludes the terminal stop.' },
  { key: 'targetPerKb', label: 'Targets per kb', unit: 'per kb CDS', family: 'Recoding load',
    desc: 'Edit density per kilobase of the full coding sequence, stop included, '
      + 'the usual way synthesis cost is quoted.' },
  { key: 'targetFirstRamp', label: `Targets in first ${RAMP_CODONS} codons`, unit: 'codons', family: 'Recoding load',
    desc: 'Sense-codon edits inside the translation ramp, where changes disturb '
      + 'initiation most. The start codon and the terminal stop are excluded.' },
  { key: 'maxLocalTargetDensity', label: `Max local target density`, unit: `fraction per ${WINDOW_CODONS}-codon window`, family: 'Recoding load',
    desc: `The busiest ${WINDOW_CODONS}-codon stretch of sense codons: the highest share `
      + 'of targets in any window. The terminal stop is in no window.' },
  { key: 'targetClusters', label: 'Target clusters', unit: 'clusters', family: 'Recoding load',
    desc: `Groups of sense-codon targets no more than ${CLUSTER_GAP_CODONS} codons apart.` },
  { key: 'maxClusterSpan', label: 'Longest cluster', unit: 'codons', family: 'Recoding load',
    desc: 'Sense codons spanned by the widest cluster of targets.' },
  { key: 'recodedGc3', label: 'Recoded GC3', unit: 'fraction', family: 'Recoded value',
    desc: 'GC at third codon positions after recoding.' },
  { key: 'recodedCai', label: 'Recoded CAI', unit: 'index 0-1', family: 'Recoded value',
    desc: 'Codon adaptation index after recoding.' },
  { key: 'recodedTai', label: 'Recoded tAI', unit: 'index 0-1', family: 'Recoded value',
    desc: 'tRNA adaptation index after recoding.' },
  { key: 'recodedEnc', label: 'Recoded ENC', unit: 'codons 20-61', family: 'Recoded value',
    desc: 'Effective number of codons after recoding.' },
  { key: 'recodedCps', label: 'Recoded codon-pair score', unit: 'mean log ratio', family: 'Recoded value',
    desc: 'Mean codon-pair score after recoding, against wild-type genome expectations.' },
  { key: 'dGc3', label: 'ΔGC3', unit: 'fraction', family: 'Change from wild type',
    desc: 'Recoded GC3 minus wild-type GC3.' },
  { key: 'dCai', label: 'ΔCAI', unit: 'index', family: 'Change from wild type',
    desc: 'Recoded CAI minus wild-type CAI. Negative means less adapted.' },
  { key: 'dTai', label: 'ΔtAI', unit: 'index', family: 'Change from wild type',
    desc: 'Recoded tAI minus wild-type tAI. Negative means scarcer tRNA supply.' },
  { key: 'dEnc', label: 'ΔENC', unit: 'codons', family: 'Change from wild type',
    desc: 'Recoded ENC minus wild-type ENC. Positive means more even codon use.' },
  { key: 'dCps', label: 'Δcodon-pair score', unit: 'mean log ratio', family: 'Change from wild type',
    desc: 'Recoded codon-pair score minus wild type. Negative means more avoided pairs.' },
]);

/** Keys produced by {@link computeLiveMetrics}, in registry order. */
export const LIVE_METRIC_KEYS = LIVE_METRICS.map((metric) => metric.key);

const COUNT_KEYS = new Set([
  'targetCount', 'targetStopEdit', 'targetFirstRamp', 'targetClusters', 'maxClusterSpan',
]);

/** True when a live metric is a whole count rather than a continuous value. */
export function isCountMetric(key) {
  return COUNT_KEYS.has(key);
}

function allocate(n) {
  const fields = {};
  for (const key of LIVE_METRIC_KEYS) fields[key] = new Float64Array(n);
  return fields;
}

/**
 * Compute every scheme-dependent metric for every gene.
 *
 * @param {object} dataset from `loadDataset`.
 * @param {object} scheme compiled by `compileScheme`; pass an empty scheme for
 *   the wild-type baseline.
 * @param {{baseline: object|null}} options wild-type baseline to subtract; when
 *   omitted the deltas are zero, which is correct for the baseline itself.
 * @returns {{fields: Record<string, Float64Array>, elapsedMs: number,
 *   codonsScanned: number}}
 */
export function computeLiveMetrics(dataset, scheme, options = {}) {
  const started = performance.now();
  const {
    packed, offsets, table, caiWeights, taiWeights, cpsScores, lengthsNt, stopCodons,
  } = dataset;
  const n = offsets.length - 1;
  const fields = allocate(n);
  const baseline = options.baseline ?? null;

  const counts = new Float64Array(64);
  let maxLength = 0;
  for (let g = 0; g < n; g += 1) maxLength = Math.max(maxLength, offsets[g + 1] - offsets[g]);
  const targetFlags = new Uint8Array(maxLength);
  const { replacement, isTarget } = scheme;
  let codonsScanned = 0;

  for (let g = 0; g < n; g += 1) {
    const start = offsets[g];
    const end = offsets[g + 1];
    const length = end - start;
    counts.fill(0);

    let targetCount = 0;
    let rampCount = 0;
    let clusters = 0;
    let clusterStart = -1;
    let maxClusterSpan = 0;
    let lastTarget = -1;
    let cpsSum = 0;
    let previousRecoded = -1;

    for (let i = 0; i < length; i += 1) {
      const original = packed[start + i];
      const recoded = i === INITIATION_INDEX ? original : replacement[original];
      counts[recoded] += 1;
      if (previousRecoded >= 0) cpsSum += cpsScores[previousRecoded * 64 + recoded];
      previousRecoded = recoded;

      const hit = i === INITIATION_INDEX ? 0 : isTarget[original];
      targetFlags[i] = hit;
      if (hit) {
        targetCount += 1;
        if (i < RAMP_CODONS) rampCount += 1;
        if (lastTarget < 0 || i - lastTarget > CLUSTER_GAP_CODONS) {
          clusters += 1;
          clusterStart = i;
        }
        maxClusterSpan = Math.max(maxClusterSpan, i - clusterStart + 1);
        lastTarget = i;
      }
    }
    codonsScanned += length;

    const window = Math.min(WINDOW_CODONS, length);
    let windowCount = 0;
    let maxWindowCount = 0;
    for (let i = 0; i < length; i += 1) {
      windowCount += targetFlags[i];
      if (i >= window) windowCount -= targetFlags[i - window];
      if (i >= window - 1 && windowCount > maxWindowCount) maxWindowCount = windowCount;
    }

    // The terminal stop lives outside the packed string, so it is counted here and
    // deliberately kept out of every window and cluster statistic above.
    const stop = stopCodons ? stopCodons[g] : -1;
    const stopEdit = stop >= 0 && isTarget[stop] ? 1 : 0;
    const edits = targetCount + stopEdit;

    fields.targetCount[g] = edits;
    fields.targetStopEdit[g] = stopEdit;
    fields.targetFraction[g] = length > 0 ? edits / length : NaN;
    fields.targetPerKb[g] = lengthsNt[g] > 0 ? (edits * 1000) / lengthsNt[g] : NaN;
    fields.targetFirstRamp[g] = rampCount;
    fields.maxLocalTargetDensity[g] = window > 0 ? maxWindowCount / window : NaN;
    fields.targetClusters[g] = clusters;
    fields.maxClusterSpan[g] = maxClusterSpan;

    const gc3 = gc3FromCounts(counts, table);
    const cai = caiFromCounts(counts, caiWeights);
    const tai = taiFromCounts(counts, taiWeights, table);
    const enc = encFromCounts(counts, table);
    const cps = length > 1 ? cpsSum / (length - 1) : NaN;
    fields.recodedGc3[g] = gc3;
    fields.recodedCai[g] = cai;
    fields.recodedTai[g] = tai;
    fields.recodedEnc[g] = enc;
    fields.recodedCps[g] = cps;

    if (baseline) {
      fields.dGc3[g] = gc3 - baseline.recodedGc3[g];
      fields.dCai[g] = cai - baseline.recodedCai[g];
      fields.dTai[g] = tai - baseline.recodedTai[g];
      fields.dEnc[g] = enc - baseline.recodedEnc[g];
      fields.dCps[g] = cps - baseline.recodedCps[g];
    }
  }

  return { fields, elapsedMs: performance.now() - started, codonsScanned };
}

/**
 * Build the standardized feature matrix used by the live PCA panels.
 * @param {Array<{key: string, values: Float64Array}>} columns
 * @param {number} rows
 * @returns {{matrix: Float64Array, keys: string[], rows: number, cols: number}}
 *   Non-finite entries become the column mean, since one missing folding energy
 *   should not drop a gene out of the map entirely.
 */
export function buildFeatureMatrix(columns, rows) {
  const cols = columns.length;
  const matrix = new Float64Array(rows * cols);
  columns.forEach((column, c) => {
    let sum = 0;
    let finite = 0;
    for (let r = 0; r < rows; r += 1) {
      const v = column.values[r];
      if (Number.isFinite(v)) {
        sum += v;
        finite += 1;
      }
    }
    const fallback = finite > 0 ? sum / finite : 0;
    for (let r = 0; r < rows; r += 1) {
      const v = column.values[r];
      matrix[r * cols + c] = Number.isFinite(v) ? v : fallback;
    }
  });
  return { matrix, keys: columns.map((column) => column.key), rows, cols };
}

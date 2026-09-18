/**
 * The four map panels and the projections behind them.
 *
 * Two are precomputed by the pipeline and two are computed here, live, from the
 * current recoding scheme. Each carries a plain sentence saying what it shows
 * and what being close together means.
 */
import { pca } from '../core/pca.js';
import { buildFeatureMatrix } from '../core/live-metrics.js';
import { metricValues } from '../core/metric-registry.js';

export const PANELS = Object.freeze([
  {
    id: 'native',
    name: 'Native codon space',
    source: 'Precomputed by the pipeline from codon usage (RSCU).',
    blurb: 'Each dot is a gene, placed by how it uses synonymous codons in the wild-type genome. '
      + 'Two genes close together prefer the same codons, whatever they do in the cell.',
  },
  {
    id: 'risk',
    name: 'Recoding-risk space',
    source: 'Computed in your browser from the current scheme.',
    blurb: 'Each dot is a gene, placed by the features that make recoding risky: codon adaptation, '
      + 'tRNA supply, rare-codon runs, folding, and how many codons this scheme would change. '
      + 'Two genes close together carry the same kind of risk.',
  },
  {
    id: 'umap',
    name: 'Baseline risk UMAP',
    source: 'Precomputed by the pipeline; independent of the scheme.',
    blurb: 'The same risk features arranged by UMAP, which pulls similar genes into tight groups. '
      + 'Closeness means similar; the distance between two groups does not mean anything.',
  },
  {
    id: 'perturbation',
    name: 'Perturbation space',
    source: 'Computed in your browser from the current scheme.',
    blurb: 'Each dot is a gene, placed by how much recoding would change it, not by what it is now. '
      + 'Two genes close together are disturbed in the same way and by the same amount.',
  },
]);

/** Feature keys the risk map prefers, in order. Missing ones are skipped. */
const RISK_FEATURES = [
  'lengthCodons', 'gc3', 'enc', 'cai', 'tai', 'rareFraction', 'longestRareRun',
  'minLocalTai', 'cps', 'underrepresentedPairFraction', 'mfeStart', 'mfeFirst100',
  'gc5prime', 'minLocalGc', 'targetFraction', 'targetPerKb', 'maxLocalTargetDensity',
  'targetClusters',
];

/** Feature keys the perturbation map uses. */
const PERTURBATION_FEATURES = [
  'dGc3', 'dCai', 'dTai', 'dEnc', 'dCps', 'targetFraction',
  'maxLocalTargetDensity', 'targetClusters', 'targetFirstRamp', 'maxClusterSpan',
];

function livePca(registry, keys, rows) {
  const columns = [];
  for (const key of keys) {
    const metric = registry.byKey.get(key);
    if (!metric) continue;
    columns.push({ key, values: metricValues(metric, rows), metric });
  }
  if (columns.length < 2) return null;
  const { matrix, cols } = buildFeatureMatrix(columns, rows);
  const started = performance.now();
  const result = pca(matrix, rows, cols, 2);
  return { result, columns, elapsedMs: performance.now() - started };
}

function axisLabel(component, explained) {
  const percent = Number.isFinite(explained) ? ` (${(explained * 100).toFixed(1)}% of variance)` : '';
  return `PC${component}${percent}`;
}

/**
 * Build the projection for a panel.
 *
 * @param {string} panelId
 * @param {{dataset: object, registry: object, schemeActive: boolean}} context
 * @returns {{available: boolean, x?: Float64Array, y?: Float64Array, xLabel?: string,
 *   yLabel?: string, labels?: string[], message?: string, loadings?: object[],
 *   loadingNote?: string, elapsedMs?: number}}
 */
export function buildProjection(panelId, { dataset, registry, schemeActive }) {
  const genes = dataset.genes;
  const rows = genes.length;
  const labels = genes.map((gene) => (gene.name ? `${gene.id} ${gene.name}` : gene.id));

  if (panelId === 'native') {
    const explained = dataset.codonPca?.explainedVariance ?? [];
    const x = new Float64Array(rows);
    const y = new Float64Array(rows);
    let usable = 0;
    for (let i = 0; i < rows; i += 1) {
      const scores = genes[i].codonPca;
      if (Array.isArray(scores) && scores.length >= 2) {
        x[i] = scores[0];
        y[i] = scores[1];
        usable += 1;
      } else {
        x[i] = NaN;
        y[i] = NaN;
      }
    }
    if (usable === 0) {
      return {
        available: false,
        message: 'This dataset has no precomputed codon-usage coordinates, so the native '
          + 'codon map cannot be drawn. The pipeline writes them into genes.json as codonPca.',
      };
    }
    const loadings = (dataset.codonPca?.loadings ?? []).map((entry) => ({
      label: entry.codon,
      sublabel: entry.aa,
      pc: entry.pc,
    }));
    return {
      available: true,
      x,
      y,
      labels,
      xLabel: axisLabel(1, explained[0]),
      yLabel: axisLabel(2, explained[1]),
      loadings,
      loadingNote: 'Codons that pull genes along each axis. A long bar to the right means genes '
        + 'high on that axis use that codon more than average.',
    };
  }

  if (panelId === 'umap') {
    const x = new Float64Array(rows);
    const y = new Float64Array(rows);
    let usable = 0;
    for (let i = 0; i < rows; i += 1) {
      const coordinates = genes[i].riskUmap;
      if (Array.isArray(coordinates) && coordinates.length >= 2) {
        x[i] = coordinates[0];
        y[i] = coordinates[1];
        usable += 1;
      } else {
        x[i] = NaN;
        y[i] = NaN;
      }
    }
    if (usable === 0) {
      return {
        available: false,
        message: 'This dataset has no precomputed UMAP coordinates. The pipeline writes them '
          + 'into genes.json as riskUmap.',
      };
    }
    return {
      available: true,
      x,
      y,
      labels,
      xLabel: 'UMAP 1',
      yLabel: 'UMAP 2',
      loadings: [],
      loadingNote: 'UMAP has no loadings: its axes are not combinations of metrics, so there is '
        + 'nothing to list. Use colour to see which metric explains a group.',
    };
  }

  if (panelId === 'perturbation' && !schemeActive) {
    return {
      available: false,
      message: 'Perturbation space shows how far recoding moves each gene, so it needs a scheme. '
        + 'Pick target codons on the left, then come back.',
    };
  }

  const keys = panelId === 'risk' ? RISK_FEATURES : PERTURBATION_FEATURES;
  const computed = livePca(registry, keys, rows);
  if (!computed) {
    return {
      available: false,
      message: 'Not enough metrics are present in this dataset to compute this projection.',
    };
  }
  const { result, columns, elapsedMs } = computed;
  const x = new Float64Array(rows);
  const y = new Float64Array(rows);
  for (let i = 0; i < rows; i += 1) {
    x[i] = result.scores[i * 2];
    y[i] = result.scores[i * 2 + 1];
  }
  const loadings = columns.map((column, c) => ({
    label: column.metric.label,
    sublabel: column.metric.unit,
    pc: [result.loadings[c], result.loadings[result.cols + c]],
  }));
  return {
    available: true,
    x,
    y,
    labels,
    xLabel: axisLabel(1, result.explained[0]),
    yLabel: axisLabel(2, result.explained[1]),
    loadings,
    loadingNote: 'Metrics that pull genes along each axis, recomputed every time the scheme changes.',
    elapsedMs,
  };
}

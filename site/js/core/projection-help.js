/** Explain the exact feature matrix behind each published map. */
import { RISK_FEATURES, PERTURBATION_FEATURES } from '../ui/panels.js';
import { metricHelp } from './metric-help.js';
import { DEFAULT_METRIC_AXES } from './metric-axes.js';

const DESCRIPTIONS = Object.freeze({
  native: {
    summary: 'The wild-type PCA uses 59 relative synonymous codon use (RSCU) columns. Each codon value is its observed use divided by equal use within that amino-acid family. Columns are standardized across genes before PCA; the map shows PC1 and PC2. PC2 correlates with CDS length (Pearson r = 0.141) and zero-RSCU count (r = -0.274). Downsampling long genes to 75 codons explains only part of the observed short-CDS shift. Filtering keeps the published coordinates fixed.',
    citations: ['ncbi-utex-2973', 'scikit-learn'],
  },
  risk: {
    summary: 'This PCA standardizes the available baseline risk, length, and active-scheme target-load columns. Unknown cells use the finite mean of their column. It is recomputed in the browser when the scheme changes.',
    citations: ['ncbi-utex-2973'],
  },
  umap: {
    summary: 'The baseline UMAP uses the fixed wild-type risk features declared in this release, standardized before fitting. It is independent of the active scheme. UMAP axes have no linear loadings.',
    citations: ['ncbi-utex-2973', 'umap'],
  },
  perturbation: {
    summary: 'This PCA uses only changes from wild type and active-scheme target-load columns. Unknown cells use their column mean. It requires a recoding scheme and is recomputed in the browser.',
    citations: ['ncbi-utex-2973'],
  },
});

export function projectionHelp(panelId, dataset, registry, axes = DEFAULT_METRIC_AXES) {
  if (panelId === 'axes') {
    const selected = [['X', axes.x], ['Y', axes.y]]
      .map(([axis, key]) => ({ axis, key, metric: registry.byKey.get(key) }))
      .filter((entry) => entry.metric);
    const explained = selected.map(({ axis, key, metric }) => ({
      key,
      label: `${axis}: ${metric.label}${metric.unit ? ` (${metric.unit})` : ''}`,
      role: `${metricHelp(metric, dataset).method} ${metricHelp(metric, dataset).origin}`,
    }));
    return {
      summary: 'The selected metrics are plotted directly on their own axes. Their values are not standardized or fitted by PCA. Genes missing either value have no point on this view.',
      citations: [...new Set(selected.flatMap(({ metric }) => metricHelp(metric, dataset).citations))],
      features: explained,
    };
  }
  const definition = DESCRIPTIONS[panelId];
  if (!definition) return null;
  if (panelId === 'native') {
    const aminoAcids = new Map((dataset.codonPca?.loadings ?? [])
      .map((row) => [row.codon, row.aa]));
    return {
      ...definition,
      features: (dataset.meta.rscuOrder ?? []).map((codon) => ({
        key: codon,
        label: aminoAcids.get(codon) ? `${codon} (${aminoAcids.get(codon)})` : codon,
        role: 'Relative use of this codon among synonymous codons for its amino acid.',
      })),
    };
  }
  const keys = panelId === 'umap' ? (dataset.meta.umap?.features ?? [])
    : (panelId === 'risk' ? RISK_FEATURES : PERTURBATION_FEATURES)
      .filter((key) => registry.byKey.has(key));
  return {
    ...definition,
    features: keys.map((key) => {
      const metric = registry.byKey.get(key);
      return { key, label: metric?.label ?? key, role: metric?.desc ?? 'Source field description unavailable.' };
    }),
  };
}

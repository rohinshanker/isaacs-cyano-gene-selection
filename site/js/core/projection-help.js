/** Explain the exact feature matrix behind each published map. */
import { RISK_FEATURES, PERTURBATION_FEATURES } from '../ui/panels.js';
import { metricHelp } from './metric-help.js';
import { DEFAULT_METRIC_AXES } from './metric-axes.js';
import { organismOf } from './organisms.js';

/**
 * Each map's explanation for one organism. The native map's summary quotes
 * statistics audited on one release, and every map cites that organism's genome,
 * so both come from the organism's record.
 */
function descriptionsFor(organism) {
  const genome = organism.genomeCitation.id;
  return {
    native: {
      summary: organism.copy.nativeProjectionSummary,
      citations: [genome, 'scikit-learn'],
    },
    ...(organism.referenceCodonPca ? {
      reference: {
        summary: organism.copy.referenceProjectionSummary,
        citations: [
          genome, organism.referenceCodonPca.citationId, 'nyerges-2026-recoding', 'scikit-learn',
        ],
      },
    } : {}),
    risk: {
      summary: 'This PCA standardizes the available baseline risk, length, and active-scheme target-load columns. Unknown cells use the finite mean of their column. It is recomputed in the browser when the scheme changes.',
      citations: [genome],
    },
    umap: {
      summary: 'The baseline UMAP uses the fixed wild-type risk features declared in this release, standardized before fitting. It is independent of the active scheme. UMAP axes have no linear loadings.',
      citations: [genome, 'umap'],
    },
    perturbation: {
      summary: 'This PCA uses only changes from wild type and active-scheme target-load columns. Unknown cells use their column mean. It requires a recoding scheme and is recomputed in the browser.',
      citations: [genome],
    },
  };
}

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
  const descriptions = descriptionsFor(organismOf(dataset));
  if (!Object.hasOwn(descriptions, panelId)) return null;
  const definition = descriptions[panelId];
  if (panelId === 'native' || panelId === 'reference') {
    const artifact = panelId === 'reference'
      ? dataset.codonPcaReference?.reference : dataset.codonPca;
    const aminoAcids = new Map((artifact?.loadings ?? [])
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

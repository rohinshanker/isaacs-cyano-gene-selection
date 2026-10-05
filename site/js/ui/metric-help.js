/** Render cited metric and map-feature methods beside their controls. */
import { DEFAULT_ORGANISM } from '../core/organisms.js';

/** Short labels for the method citations every organism shares. */
const CITATION_LABELS = Object.freeze({
  'sharp-li-cai': 'Sharp and Li, CAI',
  'dos-reis-tai': 'dos Reis et al., tAI',
  'soma-lysidine': 'Soma et al., lysidine',
  'wright-enc': 'Wright, ENC',
  'coleman-codon-pairs': 'Coleman et al., codon pairs',
  viennarna: 'ViennaRNA method',
  deseq2: 'DESeq2 method',
  umap: 'UMAP method',
  'scikit-learn': 'Scikit-learn PCA',
});

function citationIndex(manifest) {
  return new Map((manifest?.sections ?? [])
    .flatMap((section) => section.items ?? [])
    .map((item) => [item.id, item]));
}

/**
 * Short labels for one organism: the shared methods, its genome release, and
 * the studies its own evidence comes from.
 */
function citationLabelsFor(organism) {
  return {
    ...CITATION_LABELS,
    [organism.genomeCitation.id]: organism.genomeCitation.label,
    ...organism.citationLabels,
  };
}

function appendCitations(host, identifiers, manifest, organism) {
  const line = document.createElement('p');
  line.className = 'panel-note';
  line.append('Sources: ');
  const available = citationIndex(manifest);
  const labels = citationLabelsFor(organism);
  identifiers.forEach((id, index) => {
    if (index > 0) line.append('; ');
    const item = available.get(id);
    const label = (Object.hasOwn(labels, id) ? labels[id] : null) ?? item?.citation ?? id;
    if (item?.url) {
      const link = document.createElement('a');
      link.href = item.url;
      link.textContent = label;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      line.append(link);
    } else {
      line.append(label);
    }
  });
  host.append(line);
}

function definitionRow(label, value) {
  const row = document.createElement('div');
  const term = document.createElement('dt');
  term.textContent = label;
  const detail = document.createElement('dd');
  detail.textContent = value;
  row.append(term, detail);
  return row;
}

/**
 * @param {HTMLElement} details the disclosure to fill.
 * @param {object|null} model from `metricHelp` or `functionCategoryHelp`.
 * @param {object|null|undefined} manifest the citations manifest, when loaded.
 * @param {object} [organism] the record of the organism on screen, whose
 *   citation labels are used.
 */
export function renderMetricHelp(details, model, manifest, organism = DEFAULT_ORGANISM) {
  const summary = details.querySelector('summary');
  const body = details.querySelector('.help-content');
  if (!model) {
    details.hidden = true;
    return;
  }
  details.hidden = false;
  summary.textContent = `${model.title} explanation`;
  const list = document.createElement('dl');
  list.className = 'metric-help-list';
  list.append(
    definitionRow('Meaning', model.summary),
    definitionRow('Units', model.unit),
    definitionRow('Calculation', model.method),
    definitionRow('Data origin', model.origin),
    definitionRow('Missing values', model.coverage),
  );
  // Says what the number is worth beside a measurement, so a convention-derived
  // index is never read as the primary evidence for a candidate.
  if (model.reading) list.append(definitionRow('How to weigh it', model.reading));
  body.replaceChildren(list);
  appendCitations(body, model.citations, manifest, organism);
}

/** As {@link renderMetricHelp}, for a map's feature list. */
export function renderProjectionHelp(details, model, manifest, organism = DEFAULT_ORGANISM) {
  const summary = details.querySelector('summary');
  const body = details.querySelector('.help-content');
  if (!model) {
    details.hidden = true;
    return;
  }
  details.hidden = false;
  summary.textContent = `Features used (${model.features.length})`;
  const intro = document.createElement('p');
  intro.className = 'panel-note';
  intro.textContent = model.summary;
  const list = document.createElement('ul');
  list.className = 'projection-feature-list';
  for (const feature of model.features) {
    const item = document.createElement('li');
    const label = document.createElement('strong');
    label.textContent = feature.label;
    item.append(label, ` — ${feature.role}`);
    list.append(item);
  }
  body.replaceChildren(intro, list);
  appendCitations(body, model.citations, manifest, organism);
}

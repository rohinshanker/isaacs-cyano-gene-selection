/** Render cited metric and map-feature methods beside their controls. */
const CITATION_LABELS = Object.freeze({
  'ncbi-utex-2973': 'UTEX 2973 RefSeq release',
  'sharp-li-cai': 'Sharp and Li, CAI',
  'dos-reis-tai': 'dos Reis et al., tAI',
  'soma-lysidine': 'Soma et al., lysidine',
  'wright-enc': 'Wright, ENC',
  'coleman-codon-pairs': 'Coleman et al., codon pairs',
  viennarna: 'ViennaRNA method',
  'simkovsky-2022': 'PCC 7942 transcriptome',
  deseq2: 'DESeq2 method',
  'tan-2018': 'Tan et al., UTEX TSS',
  umap: 'UMAP method',
  'scikit-learn': 'Scikit-learn PCA',
});

function citationIndex(manifest) {
  return new Map((manifest?.sections ?? [])
    .flatMap((section) => section.items ?? [])
    .map((item) => [item.id, item]));
}

function appendCitations(host, identifiers, manifest) {
  const line = document.createElement('p');
  line.className = 'panel-note';
  line.append('Sources: ');
  const available = citationIndex(manifest);
  identifiers.forEach((id, index) => {
    if (index > 0) line.append('; ');
    const item = available.get(id);
    const label = CITATION_LABELS[id] ?? item?.citation ?? id;
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

export function renderMetricHelp(details, model, manifest) {
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
  body.replaceChildren(list);
  appendCitations(body, model.citations, manifest);
}

export function renderProjectionHelp(details, model, manifest) {
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
  appendCitations(body, model.citations, manifest);
}

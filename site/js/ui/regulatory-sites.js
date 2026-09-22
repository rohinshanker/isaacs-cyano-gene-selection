/** Search and inspect Tan 2018 non-gene-linked transcription start sites. */
import { REGULATORY_TYPES, potentialTargetsBySite, searchRegulatoryTss } from '../core/regulatory-tss.js';
import { formatTssStatistic } from '../core/tss-evidence.js';

export const REGULATORY_TAB = Object.freeze({
  id: 'regulatory',
  name: 'Regulatory sites',
  blurb: 'Explore UTEX 2973 antisense, internal, and orphan or novel transcription start sites from Tan et al. 2018.',
  source: '',
});

const PAGE_SIZE = 30;
const CONDITION_FIELDS = [
  ['Control', 'control_1', 'control_2'],
  ['Dark', 'dark_1', 'dark_2'],
  ['High light', 'high_light_1', 'high_light_2'],
  ['High temperature', 'high_temperature_1', 'high_temperature_2'],
];
const COMPARISON_FIELDS = [
  ['Dark vs control', 'dark_log2fc', 'dark_padj'],
  ['High light vs control', 'high_light_log2fc', 'high_light_padj'],
  ['High temperature vs control', 'high_temperature_log2fc', 'high_temperature_padj'],
];

function formatReads(value) {
  return value === '' ? 'Unknown'
    : Number(value).toLocaleString('en-US', { maximumFractionDigits: 2 });
}

function formatDifferential(value) {
  return value === '' ? 'Unknown' : formatTssStatistic(Number(value));
}

function makeTable(captionText, headers, records) {
  const table = document.createElement('table');
  table.className = 'tss-table';
  const caption = document.createElement('caption');
  caption.textContent = captionText;
  table.append(caption);
  const head = document.createElement('thead');
  const headerRow = document.createElement('tr');
  for (const label of headers) {
    const cell = document.createElement('th');
    cell.scope = 'col';
    cell.textContent = label;
    headerRow.append(cell);
  }
  head.append(headerRow);
  table.append(head);
  const body = document.createElement('tbody');
  for (const record of records) {
    const row = document.createElement('tr');
    record.forEach((value, index) => {
      const cell = document.createElement(index === 0 ? 'th' : 'td');
      if (index === 0) cell.scope = 'row';
      cell.textContent = value || 'Unknown';
      row.append(cell);
    });
    body.append(row);
  }
  table.append(body);
  return table;
}

function siteCard(row, claims, warnings, onShowGene) {
  const card = document.createElement('details');
  card.className = 'regulatory-site';
  const heading = document.createElement('summary');
  heading.textContent = `${row.tss_id} · ${row.type} · ${row.replicon}:${row.position} (${row.strand})`;
  card.append(heading);
  const sourceLink = document.createElement('p');
  sourceLink.className = 'panel-note';
  sourceLink.textContent = row.source_locus_tag
    ? `Published locus association: ${row.source_locus_tag}. `
      + (row.mapping_status === 'mapped'
        ? 'Exact current CDS identifier match.' : 'No exact current plotted CDS match.')
    : 'No locus association in the published row.';
  card.append(sourceLink);
  if (row.source_start_distance_nt) {
    const distance = document.createElement('p');
    distance.className = 'panel-note';
    distance.textContent = `${row.source_start_distance_nt} nt from the 2018 start model; `
      + 'this distance was not recalculated against current coordinates.';
    card.append(distance);
  }
  if (row.mapping_status === 'mapped') {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'chip-button';
    button.textContent = `Show ${row.mapped_locus_tag} on map`;
    button.addEventListener('click', () => onShowGene(row.mapped_locus_tag));
    card.append(button);
  }
  if (claims.length > 0) {
    const claimNote = document.createElement('p');
    claimNote.className = 'panel-note';
    claimNote.textContent = 'Table S8 lists this antisense site with a potential target '
      + 'based on opposite transcript changes. This is a source hypothesis, not a tested '
      + 'regulatory interaction. The source required opposite changes of at least 1.5 log2FC '
      + 'for dark and high light, or 1.0 for high temperature.';
    card.append(claimNote);
    card.append(makeTable(`Published potential target: ${claims[0].potential_target_locus}`,
      ['Condition', 'aTSS log2FC', 'gTSS log2FC'], claims.map((claim) => [
        `${{ dark: 'Dark', high_light: 'High light', high_temperature: 'High temperature' }[claim.comparison]} (≥${claim.source_selection_min_abs_log2fc})`,
        formatDifferential(claim.atss_log2fc),
        formatDifferential(claim.gtss_log2fc),
      ])));
  }
  for (const sourceWarning of warnings) {
    const warning = document.createElement('p');
    warning.className = 'provenance-warning';
    warning.textContent = `Source caution — Dark vs control: ${sourceWarning.message}`;
    card.append(warning);
  }
  card.append(makeTable('Raw reads at this start site', ['Condition', 'Culture 1', 'Culture 2'],
    CONDITION_FIELDS.map(([label, first, second]) => [
      label, formatReads(row[first]), formatReads(row[second]),
    ])));
  card.append(makeTable('Published DESeq2 comparisons', ['Comparison', 'log2FC', 'Adjusted p'],
    COMPARISON_FIELDS.map(([label, fold, adjusted]) => [
      label, formatDifferential(row[fold]), formatDifferential(row[adjusted]),
    ])));
  return card;
}

export class RegulatorySitesPanel {
  constructor(host, { onShowGene }) {
    this.host = host;
    this.onShowGene = onShowGene;
    this.page = 0;
    this.built = false;
  }

  update(inventory) {
    if (!inventory) {
      const note = document.createElement('p');
      note.textContent = 'The regulatory start-site table is unavailable in this dataset.';
      this.host.replaceChildren(note);
      this.built = false;
      return;
    }
    this.document = inventory;
    this.targets = potentialTargetsBySite(inventory.potentialTargets);
    this.warnings = new Map(inventory.sourceWarnings.map((entry) => [entry.tssId, [entry]]));
    if (!this.built) this.build();
    this.renderResults();
  }

  build() {
    this.host.replaceChildren();
    const title = document.createElement('h2');
    title.textContent = 'Regulatory start sites';
    const intro = document.createElement('p');
    intro.className = 'panel-note';
    intro.textContent = 'Tan et al. measured transcription initiation in UTEX 2973. These 2,333 '
      + 'antisense, internal, and orphan or novel sites are separate from the gene-linked TSSs '
      + 'in gene detail. A published locus association is context, not proof that a site regulates '
      + 'that gene. Missing results are unknown, not zero.';
    const source = document.createElement('p');
    source.className = 'panel-note';
    source.append('Source: ');
    const link = document.createElement('a');
    link.href = 'https://doi.org/10.1186/s13068-018-1215-8';
    link.textContent = 'Tan et al. 2018';
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    source.append(link, ' · UTEX 2973 · dRNA-seq · CC BY 4.0.');
    const conditions = document.createElement('details');
    const conditionsSummary = document.createElement('summary');
    conditionsSummary.textContent = 'Study conditions and interpretation';
    const conditionList = document.createElement('ul');
    for (const [key, label] of [
      ['control', 'Control'], ['dark', 'Dark'], ['high_light', 'High light'],
      ['high_temperature', 'High temperature'],
    ]) {
      const item = document.createElement('li');
      item.textContent = `${label}: ${this.document.source.conditions[key]}`;
      conditionList.append(item);
    }
    const note = document.createElement('p');
    note.className = 'panel-note';
    note.textContent = 'Two biological cultures per condition. Raw read counts and each published '
      + 'DESeq2 comparison stay at the start-site level; no gene-body abundance or gene-level '
      + 'fold change is inferred. The paper gives conflicting high-light exposure durations.';
    conditions.append(conditionsSummary, conditionList, note);
    const controls = document.createElement('div');
    controls.className = 'regulatory-controls';
    const searchLabel = document.createElement('label');
    searchLabel.textContent = 'Find site, coordinate, or locus';
    this.search = document.createElement('input');
    this.search.type = 'search';
    this.search.placeholder = 'e.g. aTSS-1705677 or M744_RS08610';
    this.search.addEventListener('input', () => {
      this.page = 0;
      this.renderResults();
    });
    searchLabel.append(this.search);
    const typeLabel = document.createElement('label');
    typeLabel.textContent = 'Site type';
    this.type = document.createElement('select');
    for (const choice of REGULATORY_TYPES) {
      const option = document.createElement('option');
      option.value = choice.id;
      option.textContent = choice.label;
      this.type.append(option);
    }
    this.type.value = 'all';
    this.type.addEventListener('change', () => {
      this.page = 0;
      this.renderResults();
    });
    typeLabel.append(this.type);
    const mappingLabel = document.createElement('label');
    mappingLabel.textContent = 'Locus link';
    this.mapping = document.createElement('select');
    for (const [value, label] of [
      ['all', 'All links'], ['mapped', 'Current CDS match'],
      ['unmapped', 'Unmapped source locus'], ['unassociated', 'No source locus'],
    ]) {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = label;
      this.mapping.append(option);
    }
    this.mapping.value = 'all';
    this.mapping.addEventListener('change', () => {
      this.page = 0;
      this.renderResults();
    });
    mappingLabel.append(this.mapping);
    const targetLabel = document.createElement('label');
    targetLabel.textContent = 'Table S8 potential target';
    this.potential = document.createElement('select');
    for (const [value, label] of [['any', 'All sites'], ['only', 'Listed potential target']]) {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = label;
      this.potential.append(option);
    }
    this.potential.value = 'any';
    this.potential.addEventListener('change', () => {
      this.page = 0;
      this.renderResults();
    });
    targetLabel.append(this.potential);
    controls.append(searchLabel, typeLabel, mappingLabel, targetLabel);
    this.count = document.createElement('p');
    this.count.className = 'length-summary';
    this.list = document.createElement('div');
    this.list.className = 'regulatory-list';
    const paging = document.createElement('div');
    paging.className = 'regulatory-paging';
    this.previous = document.createElement('button');
    this.previous.type = 'button';
    this.previous.className = 'chip-button';
    this.previous.textContent = 'Previous';
    this.previous.addEventListener('click', () => {
      this.page -= 1;
      this.renderResults();
    });
    this.pageLabel = document.createElement('span');
    this.next = document.createElement('button');
    this.next.type = 'button';
    this.next.className = 'chip-button';
    this.next.textContent = 'Next';
    this.next.addEventListener('click', () => {
      this.page += 1;
      this.renderResults();
    });
    paging.append(this.previous, this.pageLabel, this.next);
    this.host.append(title, intro, source, conditions, controls, this.count, this.list, paging);
    this.built = true;
  }

  renderResults() {
    const matches = searchRegulatoryTss(this.document.rows, {
      query: this.search.value,
      type: this.type.value,
      mapping: this.mapping.value,
      potential: this.potential.value,
      targetSiteIds: new Set(this.targets.keys()),
    });
    const pages = Math.max(1, Math.ceil(matches.length / PAGE_SIZE));
    this.page = Math.min(Math.max(0, this.page), pages - 1);
    this.count.textContent = `${matches.length.toLocaleString('en-US')} of `
      + `${this.document.rows.length.toLocaleString('en-US')} sites match.`;
    this.pageLabel.textContent = `Page ${this.page + 1} of ${pages}`;
    this.previous.disabled = this.page === 0;
    this.next.disabled = this.page >= pages - 1;
    const shown = matches.slice(this.page * PAGE_SIZE, (this.page + 1) * PAGE_SIZE);
    this.list.replaceChildren(...shown.map((row) => siteCard(
      row, this.targets.get(row.tss_id) ?? [], this.warnings.get(row.tss_id) ?? [],
      this.onShowGene,
    )));
    if (shown.length === 0) {
      const empty = document.createElement('p');
      empty.textContent = 'No start sites match this search.';
      this.list.append(empty);
    }
  }
}

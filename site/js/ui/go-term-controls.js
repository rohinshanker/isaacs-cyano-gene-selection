import { GO_EVIDENCE_BUCKETS, filterGoTerms } from '../core/go-term-evidence.js';
import { makeSwatch } from './legend.js';
import { CATEGORICAL, MISSING_COLOR } from './colors.js';

export const GO_EVIDENCE_COLORS = [CATEGORICAL[0], CATEGORICAL[1], CATEGORICAL[5], MISSING_COLOR, CATEGORICAL[7]];

export class GoTermControls {
  constructor(host, onChange) {
    this.host = host;
    this.host.className = 'go-term-controls';
    const heading = document.createElement('h3'); heading.textContent = 'Functional GO term';
    const searchLabel = document.createElement('label'); searchLabel.htmlFor = 'functional-go-search'; searchLabel.textContent = 'Find GO terms';
    this.search = document.createElement('input'); this.search.type = 'search'; this.search.id = searchLabel.htmlFor;
    this.search.placeholder = 'GO ID or part of a term name';
    const termLabel = document.createElement('label'); termLabel.htmlFor = 'functional-go-term'; termLabel.textContent = 'GO term (source annotation)';
    this.term = document.createElement('select'); this.term.id = termLabel.htmlFor;
    const filterLabel = document.createElement('label'); filterLabel.htmlFor = 'functional-go-filter'; filterLabel.textContent = 'GO evidence filter';
    this.filter = document.createElement('select'); this.filter.id = filterLabel.htmlFor;
    for (const [value, label] of [['any', 'All evidence states'], ...GO_EVIDENCE_BUCKETS.map((b) => [b.id, b.label])]) {
      this.filter.add(new Option(label, value));
    }
    this.color = document.createElement('button'); this.color.type = 'button'; this.color.className = 'chip-button';
    this.color.textContent = 'Colour by selected GO term';
    this.note = document.createElement('p'); this.note.className = 'panel-note';
    this.note.textContent = 'Exact source GO relationships, not broad categories, lab review or recoded measurements. NOT, conflicting, ND, obsolete and unavailable evidence remain distinct. Filters and colours use the same term.';
    const termRow = document.createElement('div'); termRow.className = 'field-row'; termRow.append(termLabel, this.term);
    const searchRow = document.createElement('div'); searchRow.className = 'field-row'; searchRow.append(searchLabel, this.search);
    this.matchStatus = document.createElement('p'); this.matchStatus.className = 'panel-note'; this.matchStatus.setAttribute('role', 'status');
    this.matchStatus.id = 'functional-go-matches';
    const filterRow = document.createElement('div'); filterRow.className = 'field-row'; filterRow.append(filterLabel, this.filter);
    this.status = document.createElement('p'); this.status.className = 'panel-note'; this.status.setAttribute('role', 'status');
    host.append(heading, searchRow, this.matchStatus, termRow, filterRow, this.color, this.note, this.status);
    this.search.addEventListener('input', () => this.renderTermOptions(this.term.value));
    this.term.addEventListener('change', () => onChange({ goTerm: this.term.value, goEvidenceFilter: 'any' }));
    this.filter.addEventListener('change', () => onChange({ goEvidenceFilter: this.filter.value }));
    this.color.addEventListener('click', () => onChange({ colorBy: 'goTermEvidence' }));
  }

  renderTermOptions(selected) {
    this.selected = selected;
    const filtered = filterGoTerms(this.terms, this.search.value, selected);
    this.term.replaceChildren(new Option('Choose a GO term…', ''));
    for (const [id, term] of filtered.entries) {
      this.term.add(new Option(`${id} · ${term.name}${term.isObsolete === true ? ' [obsolete]' : term.isObsolete === null ? ' [ontology status unchecked]' : ''}`, id));
    }
    this.term.value = selected;
    this.matchStatus.textContent = `${filtered.count.toLocaleString('en-US')} matching GO terms.`
      + (filtered.selectedOutsideSearch ? ' The selected term remains available outside this search.' : '');
  }

  update(dataset, state, model) {
    this.host.hidden = !dataset.organism?.functionalAnnotations
      || !['native', 'reference', 'axes', 'chromosome'].includes(state.panel);
    if (this.host.hidden) return;
    const terms = dataset.goTerms?.terms;
    if (terms !== this.terms) {
      this.terms = terms;
      this.renderTermOptions(state.goTerm ?? '');
    }
    if (this.selected !== (state.goTerm ?? '')) this.renderTermOptions(state.goTerm ?? '');
    // A shared link naming an unavailable term retains a visible unknown option.
    if (state.goTerm && ![...this.term.options].some((o) => o.value === state.goTerm)) {
      this.term.add(new Option(`${state.goTerm} · unavailable term`, state.goTerm));
    }
    this.term.value = state.goTerm ?? '';
    this.term.disabled = !terms;
    this.search.disabled = !terms;
    this.filter.value = state.goEvidenceFilter ?? 'any';
    this.filter.disabled = !state.goTerm || model.unavailable;
    this.color.disabled = !state.goTerm;
    this.status.textContent = state.goTerm ? model.counts.map((count, i) => `${GO_EVIDENCE_BUCKETS[i].label}: ${count}`).join('; ') : 'Choose a term to inspect, filter or colour its annotation evidence.';
  }
}

export function renderGoTermLegend(host, model) {
  host.replaceChildren();
  const title = document.createElement('p'); title.className = 'legend-title'; title.textContent = model.label;
  const list = document.createElement('ul'); list.className = 'legend-categories';
  for (const [i, bucket] of GO_EVIDENCE_BUCKETS.entries()) {
    const row = document.createElement('li');
    row.append(makeSwatch('filled-circle', GO_EVIDENCE_COLORS[i]), document.createTextNode(`${bucket.label}: ${model.counts[i]}`));
    list.append(row);
  }
  const note = document.createElement('p'); note.className = 'panel-note';
  note.textContent = 'Source annotations only. Positive and NOT conflicts are not resolved; ND, obsolete and unavailable terms never become positive assignments. Native and inherited provenance remains in gene detail.';
  host.append(title, list, note);
}

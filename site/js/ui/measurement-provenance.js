/** Full per-condition provenance, kept in a disclosure beside the summary. */
import { formatExpressionSource, formatCount } from './format.js';
import { expressionSourceParagraphs } from '../core/metric-registry.js';

/** Preserve each complete source field as its own readable paragraph. */
export function expressionSourceNote(source, className) {
  const note = document.createElement('div');
  note.className = className;
  const conditions = source?.pooledConditions ?? [];
  const sourceIds = source?.pooled ?? [];
  const identifyConditions = conditions.length > 0 && conditions.length === sourceIds.length;
  const paragraphs = expressionSourceParagraphs(conditions.length
    ? { ...source, condition: null, caveat: source.poolingCaveat ?? source.caveat,
      ...(identifyConditions ? { id: null, accession: null } : {}) }
    : source, formatCount);
  for (const [index, text] of paragraphs.entries()) {
    const paragraph = document.createElement('p');
    paragraph.textContent = text;
    note.append(paragraph);
    if (index === 0 && conditions.length) {
      const heading = document.createElement('p');
      heading.textContent = `${identifyConditions ? 'Sources and conditions' : 'Conditions'} (${conditions.length} datasets pooled):`;
      const list = document.createElement('ul');
      for (const [index, condition] of conditions.entries()) {
        const item = document.createElement('li');
        item.textContent = identifyConditions ? `${sourceIds[index]}: ${condition}` : condition;
        list.append(item);
      }
      note.append(heading, list);
    }
  }
  if (source?.pooledCaveats?.length) {
    const heading = document.createElement('p');
    heading.textContent = 'Dataset caveats:';
    const list = document.createElement('ul');
    for (const text of source.pooledCaveats) {
      const item = document.createElement('li');
      item.textContent = text;
      list.append(item);
    }
    note.append(heading, list);
  }
  return note;
}

export function renderMeasurementSources(host, sources) {
  const details = document.createElement('details');
  details.className = 'convention-details';
  const summary = document.createElement('summary');
  summary.textContent = `View measurement sources (${sources.length})`;
  const list = document.createElement('ul');
  for (const source of sources) {
    const item = document.createElement('li');
    item.textContent = formatExpressionSource(source);
    list.append(item);
  }
  details.append(summary, list);
  host.append(details);
}

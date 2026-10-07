/** Full per-condition provenance, kept in a disclosure beside the summary. */
import { formatExpressionSource } from './format.js';

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

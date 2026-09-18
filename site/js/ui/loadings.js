/** Loadings view: which inputs pull genes along each axis of a projection. */

const BAR_WIDTH = 78;

function bar(value) {
  const magnitude = Math.min(1, Math.abs(value));
  const width = Math.max(1, magnitude * (BAR_WIDTH / 2));
  const cell = document.createElement('td');
  cell.className = 'loading-bar-cell';
  const track = document.createElement('span');
  track.className = 'loading-bar';
  const fill = document.createElement('span');
  fill.className = value < 0 ? 'loading-fill negative' : 'loading-fill positive';
  fill.style.width = `${width}px`;
  track.append(fill);
  const text = document.createElement('span');
  text.className = 'loading-value';
  text.textContent = value.toFixed(2);
  cell.append(track, text);
  return cell;
}

/**
 * Render the strongest contributors to the first two components.
 * @param {HTMLElement} host
 * @param {{loadings: object[], loadingNote?: string}} projection
 */
export function renderLoadings(host, projection) {
  host.replaceChildren();
  const note = document.createElement('p');
  note.className = 'panel-note';
  note.textContent = projection.loadingNote ?? '';
  host.append(note);

  const loadings = projection.loadings ?? [];
  if (loadings.length === 0) return;

  const ranked = [...loadings]
    .map((entry) => ({ ...entry, strength: Math.hypot(entry.pc[0] ?? 0, entry.pc[1] ?? 0) }))
    .sort((a, b) => b.strength - a.strength)
    .slice(0, 12);

  const table = document.createElement('table');
  table.className = 'loading-table';
  const caption = document.createElement('caption');
  caption.textContent = 'Twelve strongest contributors';
  const head = document.createElement('thead');
  head.innerHTML =
    '<tr><th scope="col">Input</th><th scope="col">PC1</th><th scope="col">PC2</th></tr>';
  const body = document.createElement('tbody');
  for (const entry of ranked) {
    const row = document.createElement('tr');
    const label = document.createElement('th');
    label.scope = 'row';
    label.textContent = entry.label;
    if (entry.sublabel) {
      const sub = document.createElement('span');
      sub.className = 'loading-sub';
      sub.textContent = entry.sublabel;
      label.append(' ', sub);
    }
    row.append(label, bar(entry.pc[0] ?? 0), bar(entry.pc[1] ?? 0));
    body.append(row);
  }
  table.append(caption, head, body);
  host.append(table);
}

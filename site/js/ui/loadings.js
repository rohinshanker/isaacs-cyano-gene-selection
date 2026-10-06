/** Loadings view: which inputs pull genes along each axis of a projection. */
import { pendingNote } from './loading-note.js';
import { MISSING } from './format.js';

const BAR_WIDTH = 78;

/** A missing component draws an empty track and the MISSING token, never a zero bar. */
function bar(value) {
  const cell = document.createElement('td');
  cell.className = 'loading-bar-cell';
  const track = document.createElement('span');
  track.className = 'loading-bar';
  const text = document.createElement('span');
  text.className = 'loading-value';
  if (Number.isFinite(value)) {
    const magnitude = Math.min(1, Math.abs(value));
    const width = Math.max(1, magnitude * (BAR_WIDTH / 2));
    const fill = document.createElement('span');
    fill.className = value < 0 ? 'loading-fill negative' : 'loading-fill positive';
    fill.style.width = `${width}px`;
    track.append(fill);
    text.textContent = value.toFixed(2);
  } else {
    text.textContent = MISSING;
  }
  cell.append(track, text);
  return cell;
}

/** Euclidean strength over the first two components, or null when either is missing. */
function strengthOf(pc) {
  return Number.isFinite(pc?.[0]) && Number.isFinite(pc?.[1]) ? Math.hypot(pc[0], pc[1]) : null;
}

/**
 * Render the strongest contributors to the first two components.
 * @param {HTMLElement} host
 * @param {{loadings: object[], loadingNote?: string}} projection
 */
export function renderLoadings(host, projection, { pending = null } = {}) {
  host.replaceChildren();
  const loadings = projection.loadings ?? [];
  // The file these loadings come from has not landed: an empty table under the
  // usual note would read as a projection that has none.
  if (loadings.length === 0 && pending) {
    host.append(pendingNote(pending, 'the axis loadings'));
    return;
  }
  const note = document.createElement('p');
  note.className = 'panel-note';
  note.textContent = projection.loadingNote ?? '';
  host.append(note);

  if (loadings.length === 0) return;

  // An unknown strength ranks after every known one rather than as zero.
  const ranked = [...loadings]
    .map((entry) => ({ ...entry, strength: strengthOf(entry.pc) }))
    .sort((a, b) => (b.strength ?? -Infinity) - (a.strength ?? -Infinity))
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
    row.append(label, bar(entry.pc?.[0]), bar(entry.pc?.[1]));
    body.append(row);
  }
  table.append(caption, head, body);
  host.append(table);
}

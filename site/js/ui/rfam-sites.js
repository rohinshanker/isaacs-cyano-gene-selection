import { layerOf } from '../core/organisms.js';
import { rfamSiteText } from '../core/rfam-evidence.js';
import { markerPresentation } from '../core/marker-layers.js';

export const RFAM_COLOR = '#13786b';

function element(tag, text = null) {
  const node = document.createElement(tag);
  if (text !== null) node.textContent = text;
  return node;
}

/** One independently controlled view, with evidence retained when marks are hidden. */
export class RfamSitesPanel {
  constructor() {
    this.element = element('div');
    this.element.className = 'rfam-sites';
    this.toggleRow = element('label');
    this.toggleRow.className = 'gene-view-marker-control';
    this.toggle = element('input');
    this.toggle.type = 'checkbox';
    this.toggle.dataset.detailAction = 'rfam-visibility';
    this.toggle.dataset.sequenceAction = 'rfam-visibility';
    const swatch = element('span');
    swatch.className = 'rfam-legend-swatch';
    swatch.style.color = RFAM_COLOR;
    swatch.setAttribute('aria-hidden', 'true');
    this.toggleRow.append(this.toggle, swatch, element('span', ' Show RF01116 / Yfr1 family homology'));
    this.toggle.addEventListener('change', () => this.onChange?.(this.toggle.checked));
    this.status = element('p');
    this.status.className = 'panel-note';
    this.status.setAttribute('role', 'status');
    this.details = element('details');
    this.details.className = 'method-help rfam-evidence';
    this.summary = element('summary', 'RF01116 family evidence, coverage and export');
    this.content = element('div');
    this.content.className = 'help-content';
    this.details.append(this.summary, this.content);
    this.element.append(this.toggleRow, this.status, this.details);
  }

  update({ organism, payload, pending = null, rows = [], visible = true, onChange, onInspect }) {
    this.onChange = onChange;
    this.onInspect = onInspect;
    this.toggle.checked = visible;
    this.toggleRow.hidden = !payload || Boolean(pending) || rows.length === 0;
    this.details.hidden = !payload || Boolean(pending);
    if (!layerOf(organism, 'rfamEvidence')) {
      this.status.textContent = 'RF01116 family homology: this organism has not been evaluated.';
      this.toggleRow.hidden = this.details.hidden = true;
      return;
    }
    if (pending || !payload) {
      this.status.textContent = pending === 'loading'
        ? 'RF01116 family evidence is loading; matches are unknown.'
        : 'RF01116 family evidence could not be loaded; matches are unknown.';
      return;
    }
    this.status.textContent = rows.length
      ? `${rows.length} computed RF01116 family interval${rows.length === 1 ? '' : 's'} in the displayed context; `
        + (visible ? 'teal interval bars with triangular heads shown (computed homology).' : 'marks hidden in this view.')
      : 'No RF01116 match at GA in the displayed context. This does not establish no regulation.';
    const contentKey = `${visible}:${rows.map((row) => row.id).join(',')}`;
    if (this.lastPayload === payload && this.contentKey === contentKey) return;
    this.lastPayload = payload;
    this.contentKey = contentKey;
    this.content.replaceChildren();
    const overview = element('p', `Rfam ${payload.family.release} ${payload.family.accession} / `
      + `${payload.family.name}; GA ${payload.family.gaBits} bits; assembly ${payload.assembly}. `
      + 'Triangular heads are display indicators, not additional bp. Full search and circular-junction details are included in the JSON export.');
    overview.className = 'panel-note';
    this.content.append(overview);
    for (const row of rows) {
      const note = element('p', rfamSiteText(row, payload));
      note.className = 'panel-note';
      this.content.append(note);
      if (onInspect && visible) {
        const button = element('button', `Inspect ${row.id}`);
        button.type = 'button';
        button.className = 'chip-button rfam-inspect';
        button.addEventListener('click', () => this.onInspect?.(row));
        this.content.append(button);
      }
    }
    for (const text of payload.limitations) {
      const note = element('p', text);
      note.className = 'panel-note';
      this.content.append(note);
    }
    const download = element('a', 'Download native RF01116 family sites with provenance and coverage (JSON)');
    download.href = `data:application/json;charset=utf-8,${encodeURIComponent(JSON.stringify(payload, null, 2))}`;
    download.download = 'rfam_rf01116.json';
    this.content.append(download);
  }
}

/** Exact covered interval plus a focusable head for small-scale visibility. */
export function drawRfamIntervals(root, rows, payload, x, y, height = 7) {
  const ns = 'http://www.w3.org/2000/svg';
  for (const row of rows) {
    const group = document.createElementNS(ns, 'g');
    group.setAttribute('class', 'rfam-marker');
    if (typeof group.className === 'string') group.className = 'rfam-marker';
    group.setAttribute('fill', RFAM_COLOR);
    group.setAttribute('data-marker-id', row.id);
    group.setAttribute('data-marker-origin', row.origin);
    group.setAttribute('tabindex', '0');
    group.setAttribute('role', 'img');
    group.setAttribute('aria-label', rfamSiteText(row, payload));
    const title = document.createElementNS(ns, 'title');
    title.textContent = rfamSiteText(row, payload);
    group.append(title);
    for (const run of row.runs) {
      const start = x(run.from);
      const end = x(run.to);
      const rect = document.createElementNS(ns, 'rect');
      for (const [key, value] of Object.entries({
        x: start, y, width: Math.max(0.1, end - start), height,
        opacity: markerPresentation(row).opacity,
      })) rect.setAttribute(key, value);
      group.append(rect);
      const head = document.createElementNS(ns, 'path');
      const mid = (start + end) / 2;
      head.setAttribute('d', `M ${mid - 3} ${y} L ${mid + 3} ${y} L ${mid} ${y + height} Z`);
      head.setAttribute('opacity', markerPresentation(row).opacity);
      group.append(head);
    }
    group.addEventListener('pointerdown', (event) => {
      event.stopPropagation?.();
      group.focus?.({ preventScroll: true });
    });
    group.addEventListener('click', (event) => {
      event.stopPropagation?.();
      group.focus?.({ preventScroll: true });
    });
    root.append(group);
  }
}

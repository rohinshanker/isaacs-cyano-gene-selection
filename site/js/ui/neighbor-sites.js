import { makeSwatch } from './legend.js';
import { GHOST_BORDER, GHOST_COLOR, PINNED_COLOR, SHORTLIST_COLOR } from './colors.js';
import {
  describeNeighborSite, NEIGHBOR_SITE_LABEL, NEIGHBOR_SITE_BUCKETS, NEIGHBOR_SITE_COLORS,
  SITE_CAVEAT,
} from '../core/neighbor-sites.js';

function node(tag, text, className) {
  const result = document.createElement(tag);
  if (text) result.textContent = text;
  if (className) result.className = className;
  return result;
}

/** Persistent disclosure and per-site rows provide a path to every coincident marker. */
export class NeighborSitePanel {
  constructor() {
    this.element = node('details', null, 'method-help neighbor-site-details');
    this.summary = node('summary', NEIGHBOR_SITE_LABEL);
    this.summary.dataset.detailAction = 'neighbor-sites-summary';
    this.note = node('p', null, 'panel-note');
    this.list = node('ol', null, 'gene-view-site-rows');
    this.element.append(this.summary, this.note, this.list);
  }

  update(model, gene, onOpen, onReveal = null, visible = true) {
    const relation = model?.forGene(gene);
    const reason = model?.reason ?? (gene ? '' : 'Select a gene to inspect its sites.');
    if (this.relation === relation && this.geneId === gene?.id && this.reason === reason && this.visible === visible) return;
    const held = this.element.contains(document.activeElement);
    const action = held ? document.activeElement.dataset?.detailAction : null;
    this.relation = relation;
    this.geneId = gene?.id;
    this.reason = reason;
    this.visible = visible;
    this.list.replaceChildren();
    this.summary.textContent = model?.available && !gene ? NEIGHBOR_SITE_LABEL : relation ? `${NEIGHBOR_SITE_LABEL}: ${relation.count} distinct ${relation.count === 1 ? 'site' : 'sites'}` : `${NEIGHBOR_SITE_LABEL}: unavailable`;
    this.note.textContent = (relation ? 'Tan 2018 Table S1, all four published conditions. ' : `${reason} `) + SITE_CAVEAT + (relation && !visible ? ' Start-site marks are hidden in this view; the site list and evidence counts are retained.' : '');
    for (const site of [...new Set([...(relation?.sites ?? []), ...(relation?.unassigned ?? [])])]) {
      const item = node('li', null, 'neighbor-site-row');
      item.append(node('p', describeNeighborSite(site, gene)));
      if (site.associations.length === 0) item.append(node('p', 'Unassigned source site; excluded from neighbouring-gene counts.'));
      if (onReveal) {
        const reveal = node('button', `Inspect ${site.ids.join(', ')}`, 'chip-button');
        reveal.type = 'button';
        reveal.disabled = !visible;
        reveal.dataset.detailAction = `neighbor-site-reveal-${site.key}`;
        reveal.addEventListener('click', () => onReveal(site));
        item.append(reveal);
      }
      for (const association of site.associations) {
        if (!association.native || !association.selectable || association.id === gene?.id) continue;
        const button = node('button', `Open ${association.id}`, 'chip-button');
        button.type = 'button';
        button.dataset.detailAction = `neighbor-site-open-${site.key}-${association.id}`;
        button.addEventListener('click', () => onOpen?.(association.id, association.index));
        item.append(button);
      }
      const evidence = node('details', null, 'neighbor-site-provenance');
      evidence.append(node('summary', `Source records and conditions (${site.records.length})`));
      evidence.addEventListener('toggle', () => {
        if (!evidence.open || evidence.dataset.filled) return;
        evidence.dataset.filled = 'true';
        for (const { row, sourceRow = row, source, locus, layer, warnings = [] } of site.records) {
          for (const warning of warnings) evidence.append(node('p', warning.message));
          if (source?.conditions) evidence.append(node('p', `Source conditions: ${JSON.stringify(source.conditions)}`));
          evidence.append(node('p', `${layer} · source locus ${locus ?? 'unassigned'} · ${source?.doi ?? source?.citation ?? 'Tan 2018 Table S1'}`));
          // Retain raw cultures, reported distances, conditions and discrepancies without deriving an effect.
          const table = node('dl');
          for (const [key, value] of Object.entries(sourceRow)) {
            table.append(node('dt', key), node('dd', typeof value === 'object' ? JSON.stringify(value) : String(value)));
          }
          evidence.append(table);
          const metadata = node('details', null, 'neighbor-site-source-metadata');
          metadata.append(node('summary', 'Source metadata'));
          const sourceFields = node('dl');
          for (const [key, value] of Object.entries(source ?? {})) {
            sourceFields.append(node('dt', key), node('dd', typeof value === 'object' ? JSON.stringify(value) : String(value)));
          }
          metadata.append(sourceFields);
          evidence.append(metadata);
        }
      });
      item.append(evidence);
      this.list.append(item);
    }
    if (held) {
      const next = [this.summary, ...this.element.querySelectorAll('button')].find((entry) => entry.dataset.detailAction === action);
      (next ?? this.summary).focus?.({ preventScroll: true });
    }
  }
}

/** Mark centres retain exact geometry; the inspection list resolves crowded/coincident targets. */
export function drawNeighborSiteMarks(root, sites, gene, positionX, y) {
  const ns = 'http://www.w3.org/2000/svg';
  const group = document.createElementNS(ns, 'g');
  group.setAttribute('class', 'neighbor-site-marks');
  if (typeof group.className === 'string') group.className = 'neighbor-site-marks';
  for (const site of sites) {
    const x = positionX(site);
    if (!Number.isFinite(x)) continue;
    const mark = document.createElementNS(ns, 'g');
    mark.setAttribute('class', 'neighbor-site-mark');
    if (typeof mark.className === 'string') mark.className = 'neighbor-site-mark';
    mark.setAttribute('data-site-key', site.key);
    mark.setAttribute('data-position', site.position);
    mark.setAttribute('tabindex', '0');
    mark.setAttribute('role', 'img');
    mark.setAttribute('aria-label', `${describeNeighborSite(site, gene)} All coincident sites remain in the neighbouring-site list.`);
    mark.addEventListener('click', () => mark.focus?.({ preventScroll: true }));
    const title = document.createElementNS(ns, 'title');
    title.textContent = mark.getAttribute('aria-label');
    const path = document.createElementNS(ns, 'path');
    path.setAttribute('d', `M${x} ${y - 5} l4 5 -4 5 -4 -5 Z`);
    path.setAttribute('fill', NEIGHBOR_SITE_COLORS[1]);
    path.setAttribute('stroke', '#ffffff');
    const target = document.createElementNS(ns, 'rect');
    for (const [key, value] of Object.entries({ x: x - 5, y: y - 7, width: 10, height: 14, fill: 'transparent' })) target.setAttribute(key, value);
    target.addEventListener('click', () => mark.focus?.({ preventScroll: true }));
    mark.append(title, path, target);
    group.append(mark);
  }
  root.append(group);
}

export function renderNeighborSiteLegend(host, model, { markerConventions = true, showHidden = true, hiddenCount = 0 } = {}) {
  host.replaceChildren();
  const list = node('ul', null, 'legend-notes category-legend neighbor-site-legend');
  NEIGHBOR_SITE_BUCKETS.forEach((label, i) => {
    if (!model.available && i !== 2) return;
    const row = node('li');
    const swatch = makeSwatch('filled-circle', NEIGHBOR_SITE_COLORS[i]);
    row.append(swatch, document.createTextNode(` ${label} (${model.counts[i]})`));
    list.append(row);
  });
  host.append(list, node('p', model.reason ?? SITE_CAVEAT, 'panel-note'));
  if (markerConventions) {
    const notes = node('ul', null, 'legend-notes');
    const row = (shape, color, label, fill = color) => {
      const item = node('li'); item.append(makeSwatch(shape, color, fill), document.createTextNode(` ${label}`)); notes.append(item);
    };
    if (showHidden) row('ghost-square', GHOST_BORDER, `${hiddenCount} excluded by filters: grey outlined squares`, GHOST_COLOR);
    row('diamond', SHORTLIST_COLOR, 'Shortlisted: diamond outline');
    row('pin', PINNED_COLOR, 'Pinned: ring with crosshairs');
    host.append(notes);
  }
}

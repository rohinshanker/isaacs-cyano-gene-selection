import { describeTssEdit } from '../core/tss-recoding.js';
import { makeSwatch } from './legend.js';
import { formatCount } from './format.js';
import { GHOST_BORDER, GHOST_COLOR, MISSING_COLOR, PINNED_COLOR, SHORTLIST_COLOR } from './colors.js';
import {
  describeNeighborSite, NEIGHBOR_SITE_LABEL, NEIGHBOR_SITE_BUCKETS, NEIGHBOR_SITE_COLORS,
  SITE_CAVEAT, neighborSiteCountTally,
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
      const hasNeighbor = relation.sites.includes(site);
      if (!hasNeighbor) item.append(node('p', 'No resolved neighbouring-gene association; excluded from neighbouring-gene counts and markers.'));
      if (onReveal && hasNeighbor) {
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

/** One-coordinate ticks and optional one-base underlines; lists resolve coincident targets. */
export function drawNeighborSiteMarks(root, sites, gene, positionX, y, { baseWidth = 0, baseRows = [] } = {}) {
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
    if (typeof site.edited === 'boolean') mark.setAttribute('data-edit-status', site.edited ? 'edited' : 'unchanged');
    mark.setAttribute('tabindex', '0');
    mark.setAttribute('role', 'img');
    mark.setAttribute('aria-label', `${describeNeighborSite(site, gene)} ${typeof site.edited === 'boolean' ? describeTssEdit(site, gene) : ''} Purple line at the exact source base${baseWidth > 0 ? '; underlined in each nucleotide row' : ''}. All coincident sites remain in the ${typeof site.edited === 'boolean' ? 'TSS edit inspection' : 'neighbouring-site'} list.`);
    mark.addEventListener('click', () => mark.focus?.({ preventScroll: true }));
    const title = document.createElementNS(ns, 'title');
    title.textContent = mark.getAttribute('aria-label');
    const line = (className, x1, x2, y1, y2, stroke, strokeWidth) => {
      const result = document.createElementNS(ns, 'line');
      for (const [key, value] of Object.entries({ class: className, x1, x2, y1, y2,
        stroke, 'stroke-width': strokeWidth, 'stroke-linecap': 'butt', 'pointer-events': 'none' })) {
        result.setAttribute(key, value);
      }
      if (typeof result.className === 'string') result.className = className;
      return result;
    };
    mark.append(title,
      line('neighbor-site-halo', x, x, y - 5, y + 5, '#ffffff', 4),
      line('neighbor-site-tick', x, x, y - 5, y + 5, NEIGHBOR_SITE_COLORS[1], 2));
    if (site.edited) {
      const diamond = document.createElementNS(ns, 'polygon');
      diamond.setAttribute('points', `${x},${y - 7} ${x + 3},${y - 4} ${x},${y - 1} ${x - 3},${y - 4}`);
      diamond.setAttribute('fill', NEIGHBOR_SITE_COLORS[1]);
      diamond.setAttribute('stroke', '#ffffff');
      diamond.setAttribute('stroke-width', '1');
      diamond.setAttribute('pointer-events', 'none');
      mark.append(diamond);
    }
    // Exact cell edges, with butt caps: distinct points never paint a span between them.
    if (baseWidth > 0) for (const rowBottom of baseRows) {
      mark.append(
        line('neighbor-site-base-halo', x - baseWidth / 2, x + baseWidth / 2,
          rowBottom - 2, rowBottom - 2, '#ffffff', 4),
        line('neighbor-site-base', x - baseWidth / 2, x + baseWidth / 2,
          rowBottom - 2, rowBottom - 2, NEIGHBOR_SITE_COLORS[1], 2));
    }
    const target = document.createElementNS(ns, 'rect');
    for (const [key, value] of Object.entries({ x: x - 5, y: y - 7, width: 10, height: 14, fill: 'transparent' })) target.setAttribute(key, value);
    target.addEventListener('click', () => mark.focus?.({ preventScroll: true }));
    mark.append(target);
    group.append(mark);
  }
  root.append(group);
}

/**
 * One row per count present, coloured exactly as the map draws it, so 1, 2 and
 * many sites read apart; then the genes whose evidence cannot be read, which
 * are unknown rather than zero.
 */
export function renderNeighborSiteLegend(host, model, {
  scale = null, markerConventions = true, showHidden = true, hiddenCount = 0,
} = {}) {
  host.replaceChildren();
  const list = node('ul', null, 'legend-notes category-legend neighbor-site-legend');
  const tally = neighborSiteCountTally(model);
  for (const { count, genes } of tally.rows) {
    const row = node('li');
    row.append(makeSwatch('filled-circle', scale ? scale.color(count) : NEIGHBOR_SITE_COLORS[count > 0 ? 1 : 0]),
      document.createTextNode(` ${formatCount(count)} ${count === 1 ? 'site' : 'sites'} (${formatCount(genes)} `
        + `${genes === 1 ? 'gene' : 'genes'})`));
    list.append(row);
  }
  // Always listed, zero included, so the key and the filter's own option agree.
  const unknown = node('li');
  unknown.append(makeSwatch('filled-circle', MISSING_COLOR),
    document.createTextNode(` ${NEIGHBOR_SITE_BUCKETS[2]} (${formatCount(tally.unavailable)})`));
  list.append(unknown);
  host.append(
    node('p', 'Distinct sites inside each CDS, same and opposite strand counted alike.', 'panel-note'),
    list, node('p', model.reason ?? SITE_CAVEAT, 'panel-note'),
  );
  if (markerConventions) {
    const notes = node('ul', null, 'legend-notes');
    const row = (shape, color, label, fill = color) => {
      const item = node('li'); item.append(makeSwatch(shape, color, fill), document.createTextNode(` ${label}`)); notes.append(item);
    };
    if (showHidden) row('ghost-square', GHOST_BORDER, `${formatCount(hiddenCount)} excluded by filters: grey outlined squares`, GHOST_COLOR);
    row('diamond', SHORTLIST_COLOR, 'Shortlisted: diamond outline');
    row('pin', PINNED_COLOR, 'Pinned: ring with crosshairs');
    host.append(notes);
  }
}

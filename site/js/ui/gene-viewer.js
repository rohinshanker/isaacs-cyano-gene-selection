/**
 * The gene visualizer: one gene drawn in transcription orientation.
 *
 * Inline SVG rather than canvas, because this view is small, static between
 * selections, and must stay legible to a screen reader and to a reader who
 * zooms the page. The same component serves the gene-detail column and the
 * controls column, so a gene reads identically wherever it appears.
 *
 * It draws only what the release measured: the annotated coding span, its
 * splice gaps, the initiation triplet, the terminal stop, and published Tan
 * 2018 start sites at their own published distances. Nothing is inferred and
 * nothing is placed at a coordinate its source did not report.
 */
import { pendingNote } from './loading-note.js';
import { geneViewModel, fractionOf, ticksFor } from '../core/gene-view-model.js';
import { formatCount } from './format.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

const VIEW_WIDTH = 320;
const VIEW_HEIGHT = 96;
const MARGIN_X = 10;
const TRACK_Y = 46;
const TRACK_HEIGHT = 16;
const TSS_Y = 26;
const RULER_Y = 74;
/** Smallest drawn width for a three-nucleotide mark, in view units. */
const MIN_CODON_WIDTH = 5;

function svg(name, attributes = {}) {
  const node = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attributes)) {
    if (value === null || value === undefined) continue;
    node.setAttribute(key, String(value));
  }
  return node;
}

/** Signed nucleotide offset, written the way the labels read it. */
function signedNt(offset) {
  if (offset === 0) return 'start';
  return offset > 0 ? `+${formatCount(offset)}` : `−${formatCount(Math.abs(offset))}`;
}

/**
 * One sentence naming what is drawn, for the SVG's accessible description.
 * A picture with no text equivalent would leave this view unreadable to anyone
 * not looking at it.
 */
export function describeGeneView(model, tssPending = null) {
  if (!model) return 'No gene is selected.';
  const parts = [];
  const identity = model.name ? `${model.id} ${model.name}` : model.id;
  const length = Number.isFinite(model.lengthNt) ? `${formatCount(model.lengthNt)} nucleotides` : 'unknown length';
  parts.push(`${identity} on the ${model.strand === '-' ? 'minus' : 'plus'} strand of `
    + `${model.replicon ?? 'its replicon'}, ${length}, drawn from its annotated start.`);
  if (model.spliced) {
    parts.push(`The coding sequence is a join of ${model.segments.length} genomic segments, `
      + 'so the track is drawn with the gap between them.');
  }
  if (model.translationalException) {
    parts.push(`Translational exception: ${model.translationalException.replace(/_/g, ' ')}.`);
  }
  if (model.terminalStop) parts.push(`Terminal stop ${model.terminalStop}.`);
  if (model.tss.length > 0) {
    const distances = model.tss.map((site) => `${site.distanceNt} nt`).join(', ');
    parts.push(`${model.tss.length} Tan 2018 start site${model.tss.length === 1 ? '' : 's'} `
      + `upstream at ${distances}, at the distances that study published against its own gene `
      + 'model, not remeasured against this release.');
  } else if (tssPending) {
    // Not loaded is not none: the start-site file has not landed, or could not.
    parts.push(tssPending === 'failed'
      ? 'The Tan 2018 start sites could not be loaded, so none is drawn.'
      : 'The Tan 2018 start sites are still loading, so none is drawn yet.');
  } else {
    parts.push('No Tan 2018 start site maps to this locus by exact locus tag.');
  }
  return parts.join(' ');
}

function drawRuler(root, model, x) {
  const axis = svg('g', { class: 'gene-view-ruler' });
  axis.append(svg('line', {
    x1: MARGIN_X, x2: VIEW_WIDTH - MARGIN_X, y1: RULER_Y, y2: RULER_Y,
  }));
  for (const tick of ticksFor(model.domain, 4)) {
    const tx = x(tick);
    axis.append(svg('line', { x1: tx, x2: tx, y1: RULER_Y, y2: RULER_Y + 4 }));
    const label = svg('text', { x: tx, y: RULER_Y + 14, 'text-anchor': 'middle' });
    label.textContent = tick === 0 ? '0' : formatCount(tick);
    axis.append(label);
  }
  root.append(axis);
}

function drawTrack(root, model, x) {
  const track = svg('g', { class: 'gene-view-track' });
  // The intron-style gap first, so the segment bars sit over it.
  if (model.spliced) {
    const first = model.segments[0];
    const last = model.segments[model.segments.length - 1];
    track.append(svg('line', {
      class: 'gene-view-join',
      x1: x(first.to), x2: x(last.from),
      y1: TRACK_Y + TRACK_HEIGHT / 2, y2: TRACK_Y + TRACK_HEIGHT / 2,
    }));
  }
  for (const segment of model.segments) {
    const left = x(segment.from);
    track.append(svg('rect', {
      class: 'gene-view-cds',
      x: left, y: TRACK_Y,
      width: Math.max(1, x(segment.to) - left), height: TRACK_HEIGHT, rx: 2,
    }));
  }
  for (const codon of model.codons) {
    // Three nucleotides of a kilobase gene is well under a pixel, so each
    // codon mark gets a readable minimum. The start grows rightwards from its
    // own first base and the stop grows leftwards from its last, which keeps
    // both inside the coding bar instead of hanging off an end.
    const left = x(codon.from);
    const right = x(codon.to);
    const width = Math.max(MIN_CODON_WIDTH, right - left);
    const rect = svg('rect', {
      class: `gene-view-codon gene-view-codon-${codon.kind}`,
      x: codon.kind === 'stop' ? right - width : left, y: TRACK_Y,
      width, height: TRACK_HEIGHT,
    });
    const title = svg('title');
    title.textContent = codon.label;
    rect.append(title);
    track.append(rect);
  }
  // A direction arrow at the 3' end. Transcription orientation is left to
  // right whatever the genomic strand, and the arrow is what says so.
  const tip = x(model.segments[model.segments.length - 1].to);
  const mid = TRACK_Y + TRACK_HEIGHT / 2;
  track.append(svg('path', {
    class: 'gene-view-arrow',
    d: `M ${tip} ${TRACK_Y - 3} L ${tip + 8} ${mid} L ${tip} ${TRACK_Y + TRACK_HEIGHT + 3} Z`,
  }));
  root.append(track);
}

function drawStart(root, x) {
  const zero = x(0);
  root.append(svg('line', {
    class: 'gene-view-zero', x1: zero, x2: zero, y1: TSS_Y - 6, y2: RULER_Y,
  }));
}

function drawTss(root, model, x) {
  if (model.tss.length === 0) return;
  const group = svg('g', { class: 'gene-view-tss' });
  for (const site of model.tss) {
    const tx = x(site.offset);
    const mark = svg('g');
    mark.append(svg('line', { x1: tx, x2: tx, y1: TSS_Y, y2: TRACK_Y - 2 }));
    mark.append(svg('circle', { cx: tx, cy: TSS_Y, r: 3 }));
    const title = svg('title');
    title.textContent = `${site.id}: published ${site.distanceNt} nt upstream of the Tan 2018 `
      + 'gene-model start';
    mark.append(title);
    group.append(mark);
  }
  root.append(group);
}

/** Build the SVG for one view model. Exported for rendered tests. */
export function geneViewSvg(model, tssPending = null) {
  const root = svg('svg', {
    class: 'gene-view-svg',
    viewBox: `0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`,
    role: 'img',
    preserveAspectRatio: 'xMidYMid meet',
  });
  const description = svg('desc');
  description.textContent = describeGeneView(model, tssPending);
  root.append(description);
  root.setAttribute('aria-label', describeGeneView(model, tssPending));
  const inner = VIEW_WIDTH - MARGIN_X * 2;
  const x = (offset) => MARGIN_X + fractionOf(model.domain, offset) * inner;
  drawRuler(root, model, x);
  drawStart(root, x);
  drawTrack(root, model, x);
  drawTss(root, model, x);
  return root;
}

function legendRow(items) {
  const list = document.createElement('ul');
  list.className = 'gene-view-legend';
  for (const [swatch, text] of items) {
    const item = document.createElement('li');
    const key = document.createElement('span');
    key.className = `gene-view-key ${swatch}`;
    key.setAttribute('aria-hidden', 'true');
    item.append(key, document.createTextNode(` ${text}`));
    list.append(item);
  }
  return list;
}

function factsFor(model) {
  const facts = document.createElement('dl');
  facts.className = 'gene-view-facts';
  const rows = [
    ['Replicon', model.replicon ?? 'Unknown'],
    ['Strand', model.strand === '-' ? 'Minus' : 'Plus'],
    ['Coordinates', `${formatCount(model.start)}–${formatCount(model.end)}`],
    ['Length', Number.isFinite(model.lengthNt)
      ? `${formatCount(model.lengthNt)} nt, ${formatCount(model.lengthCodons ?? 0)} sense codons`
      : 'Unknown'],
    ['Terminal stop', model.terminalStop ?? 'Unknown'],
  ];
  for (const [term, value] of rows) {
    const dt = document.createElement('dt');
    dt.textContent = term;
    const dd = document.createElement('dd');
    dd.textContent = value;
    facts.append(dt, dd);
  }
  return facts;
}

/**
 * Render the gene visualizer into `host`.
 *
 * @param {HTMLElement} host emptied before drawing.
 * @param {object|null} gene a `genes.json` record with `tssEvidence` joined, or
 *   null when nothing is selected.
 * @param {{tssPending?: 'loading'|'failed'|null}} [options] set while the
 *   start-site file has not landed, so an empty track says so instead of
 *   reading as a gene with no start site.
 */
export function renderGeneViewer(host, gene, { tssPending = null } = {}) {
  host.replaceChildren();
  host.classList.add('gene-view');
  const model = geneViewModel(gene);
  if (!model) {
    const empty = document.createElement('p');
    empty.className = 'panel-note';
    empty.textContent = 'Pin a gene, or move to one with the arrow keys, to draw it here.';
    host.append(empty);
    return null;
  }

  const heading = document.createElement('p');
  heading.className = 'gene-view-heading';
  const identity = document.createElement('strong');
  identity.textContent = model.name ? `${model.id} ${model.name}` : model.id;
  heading.append(identity);
  if (model.product) {
    const product = document.createElement('span');
    product.className = 'gene-view-product';
    product.textContent = model.product;
    heading.append(document.createElement('br'), product);
  }
  host.append(heading, geneViewSvg(model, tssPending));
  if (tssPending) host.append(pendingNote(tssPending, 'the Tan 2018 start sites'));

  const items = [
    ['gene-view-key-cds', 'Coding sequence'],
    ['gene-view-key-start', 'Initiation triplet'],
  ];
  if (model.terminalStop) items.push(['gene-view-key-stop', 'Terminal stop']);
  if (model.tss.length > 0) items.push(['gene-view-key-tss', 'Tan 2018 start site']);
  if (model.spliced) items.push(['gene-view-key-join', 'Splice gap']);
  host.append(legendRow(items));

  const scale = document.createElement('p');
  scale.className = 'panel-note gene-view-scale';
  scale.textContent = `Drawn in transcription orientation from the annotated start, `
    + `${signedNt(model.domain.min)} to ${signedNt(model.domain.max)} nucleotides.`;
  host.append(scale);

  if (model.tss.length > 0) {
    const caveat = document.createElement('p');
    caveat.className = 'panel-note';
    caveat.textContent = 'Start-site distances are the values Tan et al. 2018 published against '
      + 'their own gene model. They are not remeasured against this release, whose annotated '
      + 'start may differ, and they measure initiation rather than transcript abundance.';
    host.append(caveat);
  }

  if (model.spliced) {
    const spliced = document.createElement('p');
    spliced.className = 'gene-flag';
    spliced.textContent = `Discontinuous coding sequence: ${model.segments.length} genomic `
      + 'segments, so the drawn span is longer than the coding length.';
    host.append(spliced);
  }

  host.append(factsFor(model));
  return model;
}

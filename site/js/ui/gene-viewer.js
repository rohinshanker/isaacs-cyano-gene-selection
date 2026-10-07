/**
 * The gene visualizer: one gene drawn in transcription orientation.
 *
 * Inline SVG rather than canvas, because this view is small, static between
 * selections, and must stay legible to a screen reader and to a reader who
 * zooms the page. The same component serves the gene-detail column and the
 * controls column, so a gene reads identically wherever it appears.
 *
 * It draws only what the release measured: the annotated coding span, its
 * splice gaps, the initiation triplet, the terminal stop, and, for an organism
 * that publishes a start-site layer, those sites at their own published
 * distances. Nothing is inferred and nothing is placed at a coordinate its
 * source did not report.
 *
 * Which start-site study there is, if any, is an organism fact. Every function
 * here takes the organism's record and names the study from it; an organism
 * with no such layer is never told that no start site maps to a gene, because
 * nothing was looked for.
 */
import { pendingNote } from './loading-note.js';
import { DEFAULT_ORGANISM, layerOf } from '../core/organisms.js';
import {
  geneViewModel, fractionOf, overlapGroups, ticksFor,
} from '../core/gene-view-model.js';
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
/**
 * Radius of one start-site head, in view units.
 *
 * Exported because it is also what decides whether two heads share drawn
 * space: the viewBox scales the head and the gap between two heads by the same
 * factor, so two marks less than a diameter apart here overlap at every
 * rendered width, and more than a diameter apart at none.
 */
export const TSS_MARK_RADIUS = 3;

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
 *
 * It closes with the organism's own statement of the evidence this view has no
 * data to draw. An empty space reads as "measured and nothing found"; that
 * sentence says what is actually the case, which is that nothing is admitted to
 * draw. It is written about admission, not about biology.
 */
export function describeGeneView(model, tssPending = null, organism = DEFAULT_ORGANISM) {
  if (!model) return 'No gene is selected.';
  const startSites = layerOf(organism, 'tssEvidence');
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
  if (!startSites) {
    // No start-site layer exists for this organism, so nothing is said about
    // one: "none maps to this locus" would be a finding nobody made.
  } else if (model.tss.length > 0) {
    const distances = model.tss.map((site) => `${site.distanceNt} nt`).join(', ');
    parts.push(`${model.tss.length} ${startSites.label} start site${model.tss.length === 1 ? '' : 's'} `
      + `upstream at ${distances}, at the distances that study published against its own gene `
      + 'model, not remeasured against this release.');
    parts.push(placementDivergenceSentence(model.tss));
    parts.push(...overlapSentences(model, startSites));
  } else if (tssPending) {
    // Not loaded is not none: the start-site file has not landed, or could not.
    parts.push(tssPending === 'failed'
      ? `The ${startSites.label} start sites could not be loaded, so none is drawn.`
      : `The ${startSites.label} start sites are still loading, so none is drawn yet.`);
  } else {
    parts.push(`No ${startSites.label} start site maps to this locus by exact locus tag.`);
  }
  // Held back while the start-site file is in flight. The sentence rests on
  // which start-site data set there is, which is a claim about what has landed;
  // saying it beside "still loading" would contradict the loading wording
  // standing right next to it.
  if (!tssPending) parts.push(organism.copy.noAdmittedTrackData);
  return parts.join(' ');
}

/**
 * Drawn position of one nucleotide offset, in view units.
 *
 * The one scale the picture, its description and the start-site list all read,
 * so none of them can describe a mark somewhere the drawing did not put it.
 */
function xScale(model) {
  const inner = VIEW_WIDTH - MARGIN_X * 2;
  return (offset) => MARGIN_X + fractionOf(model.domain, offset) * inner;
}

/**
 * This gene's start-site marks grouped by the drawn space they share.
 *
 * Display only, and labelled as such wherever it is shown: the marks keep
 * their own coordinates and every site keeps its own row in the list below the
 * picture. A group never stands for one site or for continuous evidence.
 */
export function startSiteClusters(model) {
  // Grouped over the published rows, not over the marks projected from them,
  // so a group member is the row the list prints and two rows that share an
  // identifier cannot be labelled as each other.
  const drawn = model.tssSites.filter((row) => row.drawn);
  return overlapGroups(drawn, xScale(model), TSS_MARK_RADIUS * 2);
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

function drawTss(root, model, x, startSites) {
  if (!startSites || model.tss.length === 0) return;
  const group = svg('g', { class: 'gene-view-tss' });
  for (const site of model.tss) {
    const tx = x(site.offset);
    const mark = svg('g');
    mark.append(svg('line', { x1: tx, x2: tx, y1: TSS_Y, y2: TRACK_Y - 2 }));
    mark.append(svg('circle', { cx: tx, cy: TSS_Y, r: TSS_MARK_RADIUS }));
    const title = svg('title');
    title.textContent = `${site.id}: published ${site.distanceNt} nt upstream of the `
      + `${startSites.label} gene-model start`
      + (site.placementGapNt > 0
        ? `; its published genome coordinate, where the chromosome view draws it, is `
          + `${site.impliedDistanceNt} nt from this release's start, ${site.placementGapNt} nt away`
        : '');
    mark.append(title);
    group.append(mark);
  }
  root.append(group);
}

/**
 * The start-site list's own title, so the description, the summary and the
 * sentence that points a reader at the list cannot name different things.
 *
 * It counts published rows rather than drawn marks, because a row with no
 * published distance has no mark and is in the list all the same.
 */
function startSiteListTitle(rows, startSites) {
  return `${startSites.label} start sites (${formatCount(rows.length)})`;
}

/**
 * What the picture does about start-site marks that land on each other, and
 * where each of them can still be read.
 *
 * Nothing is dropped, thinned or merged to make room: the marks stay at the
 * distances their study published, so a dense locus draws a cluster of
 * overlapping heads. A `<title>` cannot answer "which site is which" there —
 * it needs a pointer and resolves to whichever head is on top — so the
 * sentence points at the list that can, and says what a cluster is and is not.
 */
function overlapSentences(model, startSites) {
  const clusters = startSiteClusters(model).filter((group) => group.length > 1);
  if (clusters.length === 0) return [];
  const crowded = clusters.reduce((total, group) => total + group.length, 0);
  return [`${crowded} of those marks share drawn space in ${clusters.length} overlapping `
    + `${clusters.length === 1 ? 'cluster' : 'clusters'}, so their heads are not separately `
    + 'readable in the picture. Every site is listed on its own row, with its identifier, '
    + 'strand, published coordinate and published distance, under '
    + `"${startSiteListTitle(model.tssSites, startSites)}" below. A cluster is where the `
    + 'marks are drawn at this width, not one site and not continuous evidence.'];
}

/**
 * The sentence that says where this gene's start sites sit in the chromosome
 * view, which draws the published genome coordinate rather than the published
 * distance. The two agree for most sites; where they do not, the gap is named
 * and no side is taken.
 */
export function placementDivergenceSentence(sites) {
  const apart = sites.filter((site) => site.placementGapNt > 0);
  if (apart.length === 0) {
    return 'The chromosome view draws the same site'
      + `${sites.length === 1 ? '' : 's'} at the published genome coordinate, which agrees `
      + 'with this placement.';
  }
  const inside = apart.filter((site) => site.impliedDistanceNt < 0);
  const gaps = apart.map((site) => `${site.id} by ${site.placementGapNt} nt`).join(', ');
  return 'The chromosome view draws the published genome coordinate instead, which differs '
    + `from this placement for ${gaps}`
    + (inside.length > 0
      ? `; ${inside.length === 1 ? 'that coordinate falls' : `${inside.length} of those coordinates fall`} `
        + 'inside the current coding sequence'
      : '')
    + '. Which placement a construct boundary should follow is for the lab to decide.';
}

/** Build the SVG for one view model. Exported for rendered tests. */
export function geneViewSvg(model, tssPending = null, organism = DEFAULT_ORGANISM) {
  const root = svg('svg', {
    class: 'gene-view-svg',
    viewBox: `0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`,
    role: 'img',
    preserveAspectRatio: 'xMidYMid meet',
  });
  const description = svg('desc');
  description.textContent = describeGeneView(model, tssPending, organism);
  root.append(description);
  root.setAttribute('aria-label', describeGeneView(model, tssPending, organism));
  const x = xScale(model);
  drawRuler(root, model, x);
  drawStart(root, x);
  drawTrack(root, model, x);
  drawTss(root, model, x, layerOf(organism, 'tssEvidence'));
  return root;
}

/**
 * One row of the start-site list, as a reader reads it.
 *
 * Every field comes from the source row: its identifier, the site type it was
 * published as, its strand, the replicon and coordinate the study measured it
 * at, the distance it published against its own gene model, the disagreement
 * with its own coordinate where there is one, what the row records, and where
 * this width draws it. A field the row does not carry says so; none is filled
 * in from a neighbour.
 */
function siteRowText(row, cluster) {
  const parts = [];
  parts.push(row.type ?? 'site type not recorded');
  parts.push(row.strand === '+' || row.strand === '-'
    ? `${row.strand === '-' ? 'minus' : 'plus'} strand` : 'strand not recorded');
  parts.push(row.position === null
    ? 'no published genome coordinate'
    : `${row.replicon ?? 'replicon not recorded'} ${formatCount(row.position)}`);
  parts.push(row.distanceNt === null
    ? 'no published upstream distance, so no mark is drawn'
    : `published ${formatCount(row.distanceNt)} nt upstream of the published gene-model start`);
  if (row.placementGapNt > 0) {
    parts.push(`its coordinate is ${formatCount(row.impliedDistanceNt)} nt from this release's `
      + `start, ${formatCount(row.placementGapNt)} nt from where this view draws it`);
  }
  parts.push(row.evidence === 'measured'
    ? `measured site, ${formatCount(row.readCount)} condition read `
      + `${row.readCount === 1 ? 'count' : 'counts'} in this row`
    : 'measured site, no condition read count in this row');
  if (cluster) parts.push(cluster);
  return parts.join(' · ');
}

/**
 * The complete start-site list for one gene: every published row, drawn or not.
 *
 * This is how a colliding mark stays inspectable. The picture keeps each mark
 * at its own published distance, so at `M744_RS01695` twenty heads overlap into
 * a cluster, and the `<title>` on a head needs a pointer and answers for
 * whichever head is on top. One row per source row answers for all of them, by
 * pointer, by touch and by keyboard: the disclosure takes focus, and its rows
 * are plain text that reads in order.
 *
 * It is a disclosure rather than an always-open list because twenty rows would
 * push the rest of this reference view out of a side rail; closed, it adds one
 * line. No row is a control and nothing here changes what is drawn, filtered or
 * ranked.
 */
function startSiteList(model, startSites) {
  const rows = model.tssSites;
  if (rows.length === 0) return null;
  // Numbered over the overlapping clusters only, which is what the picture
  // shows and what the description counts; a mark drawn clear of its
  // neighbours is in no cluster and says nothing about one.
  const clusters = startSiteClusters(model).filter((group) => group.length > 1);
  const clusterOf = new Map();
  clusters.forEach((group, index) => {
    for (const row of group) {
      clusterOf.set(row, `drawn in overlapping cluster ${index + 1} of `
        + `${clusters.length}, with ${group.length - 1} other `
        + `${group.length === 2 ? 'site' : 'sites'} (display only)`);
    }
  });

  const details = document.createElement('details');
  details.className = 'method-help gene-view-sites';
  const summary = document.createElement('summary');
  summary.textContent = startSiteListTitle(rows, startSites);
  details.append(summary);

  const note = document.createElement('p');
  note.className = 'panel-note';
  const unmapped = rows.filter((row) => !row.drawn).length;
  note.textContent = `Every row ${startSites.citation} published for this locus, each a measured `
    + 'start site rather than a prediction, at the distance that study published against its own '
    + 'gene model. Marks closer together than one mark head overlap in the picture; the cluster '
    + 'numbers below say where this width draws them and group nothing else, so each site keeps '
    + 'its own coordinate and its own row.'
    + (unmapped > 0
      ? ` ${formatCount(unmapped)} ${unmapped === 1 ? 'row has' : 'rows have'} no published `
        + 'upstream distance and so no mark; the row is kept rather than dropped.'
      : '');
  details.append(note);

  const list = document.createElement('ol');
  list.className = 'gene-view-site-rows';
  for (const row of rows) {
    const item = document.createElement('li');
    const id = document.createElement('span');
    id.className = 'gene-view-site-id';
    id.textContent = row.id ?? 'identifier not recorded';
    item.append(id, document.createTextNode(` · ${siteRowText(row, clusterOf.get(row))}`));
    list.append(item);
  }
  details.append(list);
  return details;
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
      ? `${formatCount(model.lengthNt)} nt, ${formatCount(model.lengthCodons)} sense codons`
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
 * @param {{tssPending?: 'loading'|'failed'|null, organism?: object}} [options]
 *   `tssPending` is set while the start-site file has not landed, so an empty
 *   track says so instead of reading as a gene with no start site. `organism`
 *   is the record of the organism on screen, the default one when omitted.
 */
export function renderGeneViewer(host, gene, {
  tssPending = null, organism = DEFAULT_ORGANISM,
} = {}) {
  const startSites = layerOf(organism, 'tssEvidence');
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
  host.append(heading, geneViewSvg(model, tssPending, organism));
  if (startSites && tssPending) {
    host.append(pendingNote(tssPending, `the ${startSites.fileLabel}`));
  }

  const items = [
    ['gene-view-key-cds', 'Coding sequence'],
    ['gene-view-key-start', 'Initiation triplet'],
  ];
  if (model.terminalStop) items.push(['gene-view-key-stop', 'Terminal stop']);
  if (startSites && model.tss.length > 0) {
    items.push(['gene-view-key-tss', `${startSites.label} start site`]);
  }
  if (model.spliced) items.push(['gene-view-key-join', 'Splice gap']);
  host.append(legendRow(items));

  const scale = document.createElement('p');
  scale.className = 'panel-note gene-view-scale';
  scale.textContent = `Drawn in transcription orientation from the annotated start, `
    + `${signedNt(model.domain.min)} to ${signedNt(model.domain.max)} nucleotides.`;
  host.append(scale);

  if (startSites && model.tss.length > 0) {
    const caveat = document.createElement('p');
    caveat.className = 'panel-note';
    caveat.textContent = `Start-site distances are the values ${startSites.citation} published against `
      + 'their own gene model. They are not remeasured against this release, whose annotated '
      + 'start may differ, and they measure initiation rather than transcript abundance.';
    host.append(caveat);
  }

  // Beneath the caveat that states the distance basis the list reads, and only
  // once the file has landed: a list built while the join is in flight would
  // read as this locus's complete set of sites when it is not.
  if (startSites && !tssPending) {
    const sites = startSiteList(model, startSites);
    if (sites) host.append(sites);
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

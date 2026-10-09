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
 *
 * The start-site marks have their own show/hide, independently in each place
 * this component is mounted. It governs the marks and the text that describes
 * them, and nothing else: the domain, the ruler, the coding track, this gene's
 * values, the selection and the genes on screen are what they were, and every
 * site stays in the list below the picture.
 */
import { pendingNote } from './loading-note.js';
import { tanDisclosure } from './disclosures.js';
import { DEFAULT_ORGANISM, layerOf } from '../core/organisms.js';
import {
  geneViewModel, fractionOf, overlapGroups, paddedHitRange, ticksFor,
} from '../core/gene-view-model.js';
import { markerPaintOrder, markerPresentation } from '../core/marker-layers.js';
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
/** Invisible padding around a marker head, in view units. */
export const TSS_HIT_PADDING = 5;
/** Invisible padding outside the gene's start and stop codon marks. */
export const CODON_HIT_PADDING = 5;

/**
 * The `data-detail-action` value the start-site checkbox carries.
 *
 * Both of this component's mounts are rebuilt from scratch — the controls
 * column on every hover and the gene detail column with the whole panel — so a
 * control the reader is holding has to be found again afterwards. That is what
 * the detail column's focus restoration reads, and this view's own repaint
 * reads the same attribute, so there is one name for the control rather than
 * one per caller.
 */
export const START_SITES_CONTROL = 'gene-view-start-sites';

/**
 * The checkbox's own label, which the description and the list's note quote.
 * One source, so a reader told "its Show ... control is off" finds a control
 * with exactly that name.
 */
function startSitesControlLabel(startSites) {
  return `Show ${startSites.label} start sites`;
}

function svg(name, attributes = {}) {
  const node = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attributes)) {
    if (value === null || value === undefined) continue;
    node.setAttribute(key, String(value));
  }
  return node;
}

/** Make a drawn annotation inspectable by pointer, touch, and keyboard. */
function interactiveAnnotation(node, label) {
  node.setAttribute('tabindex', '0');
  node.setAttribute('role', 'img');
  node.setAttribute('aria-label', label);
  node.addEventListener('pointerdown', (event) => {
    event.stopPropagation?.();
    node.focus?.({ preventScroll: true });
  });
  node.addEventListener('click', (event) => {
    event.stopPropagation?.();
    node.focus?.({ preventScroll: true });
  });
  return node;
}

/** A pointer-only rectangle that forwards inspection to its visible annotation. */
function annotationHitTarget(annotation, attributes) {
  const target = svg('rect', {
    ...attributes,
    fill: 'transparent',
    stroke: 'none',
    'pointer-events': 'all',
    'aria-hidden': 'true',
  });
  const focus = (event) => {
    event.stopPropagation?.();
    annotation.focus?.({ preventScroll: true });
  };
  target.addEventListener('pointerdown', focus);
  target.addEventListener('click', focus);
  const title = svg('title');
  title.textContent = annotation.getAttribute('aria-label');
  target.append(title);
  target.addEventListener('pointerenter', () => annotation.classList.add('is-hit-hovered'));
  target.addEventListener('pointerleave', () => annotation.classList.remove('is-hit-hovered'));
  return target;
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
 *
 * Marks the reader has hidden are a fifth thing to say, distinct from no layer,
 * still loading, could not load, and none maps here: the sites are admitted,
 * mapped and landed, and this view is not drawing them. Without that sentence a
 * picture with no mark would read as the locus having no start site.
 */
export function describeGeneView(model, tssPending = null, organism = DEFAULT_ORGANISM,
  startSitesVisible = true) {
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
  } else if (model.tss.length > 0 && !startSitesVisible) {
    parts.push(`${model.tss.length} ${startSites.label} start site${model.tss.length === 1 ? '' : 's'} `
      + `map${model.tss.length === 1 ? 's' : ''} to this locus, and this view's `
      + `"${startSitesControlLabel(startSites)}" control is off, so no mark is drawn for `
      + 'them. The sites are unchanged, and so are this gene\'s coordinates, its drawn span, '
      + 'its values and which genes are on screen.');
    // Only once the file has landed, because the list is built on the same
    // condition: pointing a reader at a list that is not there would be worse
    // than saying nothing about where to read the sites.
    if (!tssPending) {
      parts.push(`Every one of them is listed under "${startSiteListTitle(model.tssSites, startSites)}" `
        + 'below.');
    }
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
  } else if (model.tssSites.length > 0) {
    parts.push(`${model.tssSites.length} ${startSites.label} source `
      + `${model.tssSites.length === 1 ? 'row is' : 'rows are'} associated with this locus, `
      + 'but no valid published upstream distance is available to place a mark on this '
      + 'gene-relative track. The associated rows remain in the start-site list below.');
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
    const visibleX = codon.kind === 'stop' ? right - width : left;
    const rect = interactiveAnnotation(svg('rect', {
      class: `gene-view-codon gene-view-codon-${codon.kind} gene-view-annotation`,
      'data-codon-kind': codon.kind,
      x: visibleX, y: TRACK_Y,
      width, height: TRACK_HEIGHT,
    }), codon.label);
    track.append(annotationHitTarget(rect, {
      class: 'gene-view-codon-hit-target',
      'data-codon-kind': codon.kind,
      x: codon.kind === 'start' ? visibleX - CODON_HIT_PADDING : visibleX,
      y: TRACK_Y - CODON_HIT_PADDING,
      width: width + CODON_HIT_PADDING,
      height: TRACK_HEIGHT + CODON_HIT_PADDING * 2,
    }));
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

/**
 * The start-site marks, or nothing at all when the reader has hidden them.
 *
 * Hidden means not built: no head, no stem and no `<title>`. A mark left in the
 * tree at zero opacity would still answer a pointer and still be read out, so
 * the picture would disagree with itself.
 */
function drawTss(root, model, x, startSites, visible) {
  if (!startSites || !visible || model.tss.length === 0) return;
  const group = svg('g', { class: 'gene-view-tss' });
  const ordered = markerPaintOrder(model.tss);
  const visibleRanges = ordered.map((site) => {
    const tx = x(site.offset);
    return { from: tx - TSS_MARK_RADIUS, to: tx + TSS_MARK_RADIUS };
  });
  ordered.forEach((site, index) => {
    const tx = x(site.offset);
    const presentation = markerPresentation(site);
    const label = `${site.id}: published ${site.distanceNt} nt upstream of the `
      + `${startSites.label} gene-model start`
      + (site.placementGapNt > 0
        ? `; its published genome coordinate, where the chromosome view draws it, is `
          + `${site.impliedDistanceNt} nt from this release's start, ${site.placementGapNt} nt away`
        : '')
      + (site.origin === 'computed'
        ? `; computed by ${site.producer ?? 'an unrecorded producer'}` : '');
    const mark = interactiveAnnotation(svg('g', {
      class: `gene-view-marker gene-view-marker-${presentation.id} gene-view-annotation`,
      'data-marker-id': site.id ?? '',
      'data-marker-origin': site.origin ?? '',
      'data-marker-producer': site.producer ?? '',
    }), label);
    const hit = paddedHitRange(visibleRanges, index, TSS_HIT_PADDING);
    mark.append(svg('rect', {
      class: 'gene-view-marker-hit-target',
      'data-marker-id': site.id ?? '',
      x: hit.from,
      y: TSS_Y - TSS_MARK_RADIUS - TSS_HIT_PADDING,
      width: hit.to - hit.from,
      height: TRACK_Y - 2 - (TSS_Y - TSS_MARK_RADIUS - TSS_HIT_PADDING),
      fill: 'transparent',
      stroke: 'none',
      'pointer-events': 'all',
      'aria-hidden': 'true',
    }));
    mark.append(svg('line', { x1: tx, x2: tx, y1: TSS_Y, y2: TRACK_Y - 2 }));
    mark.append(svg('circle', { cx: tx, cy: TSS_Y, r: TSS_MARK_RADIUS }));
    const title = svg('title');
    title.textContent = label;
    mark.append(title);
    group.append(mark);
  });
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
export function geneViewSvg(model, tssPending = null, organism = DEFAULT_ORGANISM,
  startSitesVisible = true) {
  const root = svg('svg', {
    class: 'gene-view-svg',
    viewBox: `0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`,
    role: 'group',
    preserveAspectRatio: 'xMidYMid meet',
  });
  const said = describeGeneView(model, tssPending, organism, startSitesVisible);
  const description = svg('desc');
  description.textContent = said;
  root.append(description);
  root.setAttribute('aria-label', said);
  const x = xScale(model);
  drawRuler(root, model, x);
  drawStart(root, x);
  drawTrack(root, model, x);
  drawTss(root, model, x, layerOf(organism, 'tssEvidence'), startSitesVisible);
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
  if (row.origin === 'computed') {
    parts.push(`computed by ${row.producer ?? 'an unrecorded producer'}; supplementary `
      + 'presentation with lower overlap priority');
  }
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
 *
 * It is built whether or not the marks are shown, because it is the metadata
 * and not the drawing: a reader who has put the marks away can still read what
 * was published here. What goes with the marks is every claim about where a
 * mark is — the note says the marks are hidden and no row is labelled with a
 * cluster, because at that point there is no cluster to be in.
 */
function startSiteList(model, startSites, visible) {
  const rows = model.tssSites;
  if (rows.length === 0) return null;
  // Numbered over the overlapping clusters only, which is what the picture
  // shows and what the description counts; a mark drawn clear of its
  // neighbours is in no cluster and says nothing about one.
  const clusters = visible
    ? startSiteClusters(model).filter((group) => group.length > 1) : [];
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
    + 'gene model.'
    + (model.tss.length === 0 ? '' : visible
      ? ' Marks closer together than one mark head overlap in the picture; the cluster '
        + 'numbers below say where this width draws them and group nothing else, so each site keeps '
        + 'its own coordinate and its own row.'
      : ` The marks are hidden in the picture by this view's "${startSitesControlLabel(startSites)}" `
        + 'control, so no row says where it is drawn; the rows themselves are unchanged, and hiding '
        + 'the marks filters no gene and changes no value.')
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

/**
 * This view's own show/hide for the start-site marks.
 *
 * A label wrapping its own checkbox rather than an `id` and a `for`, because
 * this component is mounted twice on the page — the controls column and the
 * gene detail column — and two elements cannot share one `id`. The wrapping
 * label names the checkbox for a screen reader and extends its hit target to
 * the words, which is what the explicit pair buys elsewhere.
 *
 * The state is the caller's, so it survives the caller's next rebuild; the
 * change is reported up rather than stored here.
 */
function startSitesControl(startSites, visible, onChange) {
  const row = document.createElement('label');
  row.className = 'checkbox-row gene-view-layer';
  const box = document.createElement('input');
  box.type = 'checkbox';
  box.checked = visible;
  box.dataset.detailAction = START_SITES_CONTROL;
  box.addEventListener('change', () => onChange(box.checked));
  row.append(box, document.createTextNode(` ${startSitesControlLabel(startSites)}`));
  return { row, box };
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
 * @param {{tssPending?: 'loading'|'failed'|null, organism?: object,
 *   startSitesVisible?: boolean,
 *   onStartSitesVisibleChange?: (visible: boolean) => void}} [options]
 *   `tssPending` is set while the start-site file has not landed, so an empty
 *   track says so instead of reading as a gene with no start site. `organism`
 *   is the record of the organism on screen, the default one when omitted.
 *   `startSitesVisible` is whether this view draws its start-site marks,
 *   visible by default, and `onStartSitesVisibleChange` is how the reader's
 *   change is reported to whoever holds that state.
 *
 * The visibility state is the caller's rather than this module's because this
 * function rebuilds `host` on every call, and both callers call it again for
 * every hover: anything remembered here would last until the next pointer
 * move. Each mount keeps its own, which is why there is no state shared
 * between the two gene viewers or with the chromosome view's own control, and
 * nothing is written to the address bar or to storage. A caller is expected to
 * record the reported value and leave this view to redraw itself, not to
 * re-render in response.
 */
export function renderGeneViewer(host, gene, {
  tssPending = null, organism = DEFAULT_ORGANISM,
  startSitesVisible = true, onStartSitesVisibleChange = null,
} = {}) {
  const startSites = layerOf(organism, 'tssEvidence');
  host.classList.add('gene-view');
  host.tabIndex = -1;
  host.setAttribute('role', 'group');
  host.setAttribute('aria-label', 'Gene visualizer');
  const model = geneViewModel(gene);
  if (!model) {
    const held = host.contains(document.activeElement)
      && document.activeElement.dataset?.detailAction === START_SITES_CONTROL;
    host.replaceChildren();
    const empty = document.createElement('p');
    empty.className = 'panel-note';
    empty.textContent = 'Pin a gene, or move to one with the arrow keys, to draw it here.';
    host.append(empty);
    if (held) host.focus({ preventScroll: true });
    return null;
  }

  /**
   * Draw this gene with the start-site marks shown or hidden.
   *
   * The whole view is rebuilt rather than the mark group alone: the picture's
   * description, the legend key and the list's note each say what the picture
   * is doing with the marks, and editing one of them in place would leave the
   * others describing the other state. What is rebuilt is this host, so the
   * reader's choice, the gene, its coordinates and its values are untouched —
   * only the marks and the sentences about them differ between the two calls.
   */
  const paint = (visible) => {
    // Whether the reader is holding this view's control, read before the
    // rebuild detaches it. The controls column rebuilds through this function,
    // so the carry-over belongs here; the detail column rebuilds the whole
    // panel around this view and restores focus by the same attribute.
    const held = host.contains(document.activeElement)
      && document.activeElement.dataset?.detailAction === START_SITES_CONTROL;
    host.replaceChildren();

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
    host.append(heading, geneViewSvg(model, tssPending, organism, visible));
    if (startSites && tssPending) {
      host.append(pendingNote(tssPending, `the ${startSites.fileLabel}`));
    }

    // Built only where there is a mark to show or hide, which is the one thing
    // it governs. A control beside a locus with no mapped site, beside a file
    // still in flight, or on an organism with no such study would offer to
    // hide evidence that is not there, and would read as a promise that it
    // could be shown.
    let toggle = null;
    if (startSites && model.tss.length > 0) {
      const control = startSitesControl(startSites, visible, (next) => {
        onStartSitesVisibleChange?.(next);
        paint(next);
      });
      toggle = control.box;
      host.append(control.row);
    }

    const items = [
      ['gene-view-key-cds', 'Coding sequence'],
      ['gene-view-key-start', 'Initiation triplet'],
    ];
    if (model.terminalStop) items.push(['gene-view-key-stop', 'Terminal stop']);
    // No key for a mark the picture is not drawing: a legend is what is in the
    // picture, not what could be.
    if (startSites && visible && model.tss.length > 0) {
      items.push(['gene-view-key-tss', `${startSites.label} start site`]);
    }
    if (model.spliced) items.push(['gene-view-key-join', 'Splice gap']);
    host.append(legendRow(items));

    const scale = document.createElement('p');
    scale.className = 'panel-note gene-view-scale';
    scale.textContent = `Drawn in transcription orientation from the annotated start, `
      + `${signedNt(model.domain.min)} to ${signedNt(model.domain.max)} nucleotides.`;
    host.append(scale);

    // Stated whether or not the marks are drawn, because it is the basis of
    // the distances in the list, which is readable either way.
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
      const sites = startSiteList(model, startSites, visible);
      if (sites) host.append(sites);
    }

    if (model.spliced) {
      const spliced = document.createElement('p');
      spliced.className = 'gene-flag';
      spliced.textContent = `Discontinuous coding sequence: ${model.segments.length} genomic `
        + 'segments, so the drawn span is longer than the coding length.';
      host.append(tanDisclosure(spliced, 'Sequence structure / information'));
    }

    host.append(factsFor(model));
    if (held) (toggle ?? host).focus({ preventScroll: true });
  };

  paint(startSitesVisible);
  return model;
}

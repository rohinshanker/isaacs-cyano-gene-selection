/**
 * Geometry for the chromosome view: every plotted CDS at its coordinate on the
 * organism's genome of record, on one linear track per replicon.
 *
 * DOM-free so the arithmetic is testable in Node. Three rules shape everything
 * here and none of them is negotiable:
 *
 * 1. **One scale per replicon.** A 2.69 Mb chromosome and a 7.8 kb plasmid
 *    cannot share an axis legibly, and concatenating them would invent a
 *    coordinate system no source reports. Each replicon gets its own track and
 *    its own scale, and a plasmid position is never mapped onto the chromosome
 *    axis.
 * 2. **No coordinate beyond its replicon.** Two CDSs cross the circular origin.
 *    Their records carry `start: 1` and `end: <replicon length>`, so the naive
 *    span is the whole replicon. Only `cdsSegments` describes them truthfully,
 *    and they are drawn as those pieces with a wrap marker.
 * 3. **Nothing is placed that was not measured on this assembly.** Replicon
 *    identities and lengths come from the genome of record and are verified
 *    against the shipped `meta.json` before anything is drawn. Start sites
 *    measured on this assembly may sit at absolute coordinates; a coordinate
 *    from another strain never can, and this module has no route for one.
 */
import { DEFAULT_ORGANISM, repliconByAccession } from './organisms.js';

/**
 * The default organism's genome of record, from
 * `docs/validation/genome-provenance.md#genome-of-record`.
 *
 * `meta.json` carries `genome.accession` and `totalLength` but not the
 * per-replicon lengths, and the chromosome axis cannot be drawn without them.
 * Each organism's record in `core/organisms.js` therefore declares its own, and
 * {@link repliconTracks} checks the declaration against the shipped metadata
 * and refuses to build tracks when the two disagree. An axis drawn against an
 * unverified length would misplace every mark on it.
 */
export const GENOME_OF_RECORD = DEFAULT_ORGANISM.genome;

/** Narrowest window the chromosome track will zoom to, in base pairs. */
export const MIN_WINDOW_BP = 500;

/**
 * A replicon accession reduced to its bare sequence name.
 *
 * `genes.json` writes `NZ_CP006471.1` while a start-site extract writes
 * `CP006471`: the same sequence under RefSeq and INSDC naming. Comparing the
 * raw strings would silently drop every start site on the chromosome, so
 * accessions are compared in this normalised form and nowhere else.
 */
export function normalizeAccession(accession) {
  if (typeof accession !== 'string') return '';
  return accession.trim().replace(/^NZ_/, '').replace(/\.\d+$/, '').toUpperCase();
}

/** Whether two accessions name the same replicon under either naming scheme. */
export function sameReplicon(left, right) {
  const a = normalizeAccession(left);
  return a !== '' && a === normalizeAccession(right);
}

/**
 * The genomic pieces a CDS actually occupies, 1-based and inclusive.
 *
 * `cdsSegments` wins whenever it is present. For the two origin-crossing CDSs
 * the record's own `start`/`end` describe the entire replicon, so reading them
 * instead would draw a 46 kb plasmid gene as the whole plasmid.
 */
export function cdsPieces(gene) {
  const segments = Array.isArray(gene?.cdsSegments) && gene.cdsSegments.length > 0
    ? gene.cdsSegments
    : [[gene?.start, gene?.end]];
  return segments
    .filter(([from, to]) => Number.isFinite(from) && Number.isFinite(to) && to >= from)
    .map(([from, to]) => ({ from, to }))
    .sort((a, b) => a.from - b.from);
}

/**
 * Whether a CDS crosses the circular origin of a replicon of `lengthBp`.
 *
 * True only for a multi-piece CDS that touches both base 1 and the last base:
 * a gene that merely begins at base 1, or a spliced gene in the middle of a
 * replicon, is not a wrap and must not be marked as one.
 */
/**
 * Length of a replicon by accession, or null.
 *
 * An accession names one sequence, so the lookup is over every organism's
 * genome of record and needs no organism to be passed.
 */
export function repliconLength(seqid) {
  return repliconByAccession(seqid)?.lengthBp ?? null;
}

export function wrapsOrigin(pieces, lengthBp) {
  if (!Array.isArray(pieces) || pieces.length < 2 || !Number.isFinite(lengthBp)) return false;
  return pieces.some((piece) => piece.from === 1) && pieces.some((piece) => piece.to === lengthBp);
}

/**
 * Which side of the axis a strand draws on: plus above, minus below, and
 * `null` for a record that names neither.
 *
 * There is no third lane and no default. Every CDS in this release is
 * stranded, so a record without one is a defect in the dataset rather than a
 * case to draw, and putting it above the axis would assert a transcription
 * direction the annotation never reported. `repliconTracks` reports it as a
 * verification problem, alongside an unknown `seqid` and an out-of-range span.
 */
export function strandLane(strand) {
  if (strand === '+') return 'above';
  if (strand === '-') return 'below';
  return null;
}

/**
 * One CDS's drawable description on its replicon.
 *
 * @param {object} gene a `genes.json` record.
 * @param {number} index its position in `dataset.genes`, the key every other
 *   view uses for colour, filtering, pinning, and the shortlist.
 * @param {number} lengthBp the replicon length, for the wrap test.
 */
export function cdsMark(gene, index, lengthBp) {
  const pieces = cdsPieces(gene);
  if (pieces.length === 0) return null;
  const lane = strandLane(gene.strand);
  if (lane === null) return null;
  const wraps = wrapsOrigin(pieces, lengthBp);
  return {
    index,
    id: gene.id,
    strand: gene.strand,
    lane,
    pieces,
    wraps,
    // The coordinate a wrapping CDS is navigated and announced by: its first
    // transcribed base, which is the far piece's first base on the plus strand
    // and the high end of base 1's piece on the minus strand, because
    // `complement(join(45877..46366,1..2510))` is read from 2,510 down to 1 and
    // then from the last base down. For every other CDS this is just its own
    // first base.
    anchorBp: wraps
      ? (gene.strand === '-' ? pieces[0].to : pieces[pieces.length - 1].from)
      : pieces[0].from,
    coveredBp: pieces.reduce((total, piece) => total + (piece.to - piece.from + 1), 0),
  };
}

/**
 * The tracks to draw, or the reason they cannot be drawn.
 *
 * Verification is a precondition rather than a warning: a mismatch between the
 * declared replicon set and the shipped data means at least one mark would land
 * at a position the release does not support, so the caller is handed
 * `verified: false` and a list of problems to show instead of a picture.
 *
 * @param {object[]} genes `dataset.genes`.
 * @param {object} meta `dataset.meta`.
 * @param {{accession: string, replicons: object[]}} [genomeOfRecord] the
 *   organism's declared genome, from its registry record.
 */
export function repliconTracks(genes, meta, genomeOfRecord = GENOME_OF_RECORD) {
  const problems = [];
  const declaredTotal = genomeOfRecord.replicons
    .reduce((total, replicon) => total + replicon.lengthBp, 0);
  const genome = meta?.genome ?? {};
  if (genome.accession !== genomeOfRecord.accession) {
    problems.push(`This dataset declares assembly ${genome.accession ?? 'none'}, not the `
      + `${genomeOfRecord.accession} genome of record these replicon lengths describe.`);
  }
  if (genome.totalLength !== declaredTotal) {
    problems.push(`The declared replicon lengths total ${declaredTotal.toLocaleString('en-US')} bp, `
      + `but this dataset reports ${(genome.totalLength ?? 0).toLocaleString('en-US')} bp.`);
  }

  const rows = Array.isArray(genes) ? genes : [];
  const tracks = genomeOfRecord.replicons.map((replicon) => {
    const marks = [];
    for (let index = 0; index < rows.length; index += 1) {
      const gene = rows[index];
      if (!sameReplicon(gene?.seqid, replicon.accession)) continue;
      if (strandLane(gene?.strand) === null) {
        problems.push(`${gene?.id ?? 'An unnamed CDS'} on ${replicon.accession} reports no `
          + 'strand, so it has no lane on this axis.');
        continue;
      }
      const mark = cdsMark(gene, index, replicon.lengthBp);
      if (!mark) continue;
      const beyond = mark.pieces.find((piece) => piece.to > replicon.lengthBp || piece.from < 1);
      if (beyond) {
        problems.push(`${gene.id} occupies ${beyond.from}–${beyond.to} on `
          + `${replicon.accession}, which is ${replicon.lengthBp.toLocaleString('en-US')} bp long.`);
        continue;
      }
      marks.push(mark);
    }
    marks.sort((a, b) => a.pieces[0].from - b.pieces[0].from || a.index - b.index);
    return {
      ...replicon,
      marks,
      cdsCount: marks.length,
      wrapCount: marks.filter((mark) => mark.wraps).length,
    };
  });

  const placed = tracks.reduce((total, track) => total + track.cdsCount, 0);
  if (placed !== rows.length) {
    const unplaced = new Set();
    for (const gene of rows) {
      if (!genomeOfRecord.replicons.some((r) => sameReplicon(gene?.seqid, r.accession))) {
        unplaced.add(gene?.seqid ?? 'an unnamed replicon');
      }
    }
    if (unplaced.size > 0) {
      problems.push(`${[...unplaced].sort().join(', ')} is not a replicon of the genome of `
        + 'record, so its CDSs have no axis here.');
    }
  }

  return { tracks, problems, verified: problems.length === 0, plottedCount: placed };
}

/**
 * Operon brackets for one track, grouped from `operonId`.
 *
 * The bracket spans the member CDSs only; it is not extended to a promoter or a
 * terminator, neither of which the operon call records. `operonSize` is carried
 * through so a bracket drawn from fewer members than the pipeline counted is
 * visible as such rather than silently narrower than the operon.
 */
export function operonBrackets(track, genes) {
  const groups = new Map();
  for (const mark of track.marks) {
    const gene = genes[mark.index];
    const operonId = gene?.operonId;
    if (typeof operonId !== 'string' || operonId === '') continue;
    if (!groups.has(operonId)) {
      groups.set(operonId, {
        operonId,
        strand: mark.strand,
        lane: mark.lane,
        from: Infinity,
        to: -Infinity,
        members: [],
        declaredSize: Number.isFinite(gene.operonSize) ? gene.operonSize : null,
        wraps: false,
      });
    }
    const group = groups.get(operonId);
    group.members.push(mark.index);
    group.wraps = group.wraps || mark.wraps;
    for (const piece of mark.pieces) {
      if (piece.from < group.from) group.from = piece.from;
      if (piece.to > group.to) group.to = piece.to;
    }
  }
  return [...groups.values()]
    .map((group) => ({ ...group, size: group.members.length }))
    .sort((a, b) => a.from - b.from);
}

/** Keep a window inside its replicon, never narrower than {@link MIN_WINDOW_BP}. */
export function clampWindow(window, lengthBp, minSpanBp = MIN_WINDOW_BP) {
  const limit = Math.max(1, Math.round(lengthBp));
  const smallest = Math.min(limit, Math.max(1, Math.round(minSpanBp)));
  const requested = Number.isFinite(window?.from) && Number.isFinite(window?.to)
    ? Math.round(window.to) - Math.round(window.from) + 1
    : limit;
  const span = Math.min(limit, Math.max(smallest, requested));
  const from = Math.min(Math.max(1, Math.round(window?.from ?? 1)), limit - span + 1);
  return { from, to: from + span - 1 };
}

/** The whole replicon, the view's reset state. */
export function fullWindow(lengthBp) {
  return { from: 1, to: Math.max(1, Math.round(lengthBp)) };
}

/**
 * Zoom about `anchorBp`, which keeps its screen position.
 * A factor above 1 narrows the window; below 1 widens it.
 */
export function zoomWindow(window, factor, anchorBp, lengthBp, minSpanBp = MIN_WINDOW_BP) {
  const current = clampWindow(window, lengthBp, minSpanBp);
  if (!(factor > 0)) return current;
  const span = current.to - current.from + 1;
  const anchor = Math.min(Math.max(anchorBp ?? current.from, current.from), current.to);
  const fraction = span === 1 ? 0 : (anchor - current.from) / (span - 1);
  const nextSpan = Math.max(1, Math.round(span / factor));
  const from = Math.round(anchor - fraction * (nextSpan - 1));
  return clampWindow({ from, to: from + nextSpan - 1 }, lengthBp, minSpanBp);
}

/** Slide a window by `deltaBp`, clamped to the replicon. */
export function panWindow(window, deltaBp, lengthBp, minSpanBp = MIN_WINDOW_BP) {
  const current = clampWindow(window, lengthBp, minSpanBp);
  const span = current.to - current.from + 1;
  const from = current.from + Math.round(deltaBp);
  return clampWindow({ from, to: from + span - 1 }, lengthBp, minSpanBp);
}

/**
 * A base-pair-to-pixel mapping for one replicon's visible window.
 *
 * `bpToX` places the *left edge* of a base, so a CDS from `a` to `b` inclusive
 * spans `bpToX(a)` to `bpToX(b + 1)` and a one-base feature still has width.
 *
 * @param {{from: number, to: number}} window inclusive, 1-based.
 * @param {number} left pixel x of the window's first base.
 * @param {number} width pixels the window occupies.
 */
export function repliconScale(window, left, width) {
  const span = Math.max(1, window.to - window.from + 1);
  const perBase = width / span;
  return {
    window,
    span,
    perBase,
    bpToX: (bp) => left + (bp - window.from) * perBase,
    xToBp: (x) => window.from + (x - left) / perBase,
  };
}

/** Marks whose drawn pieces intersect `window`, in coordinate order. */
export function visibleMarks(marks, window) {
  return marks.filter((mark) => mark.pieces
    .some((piece) => piece.to >= window.from && piece.from <= window.to));
}

/** A base-pair count as `2.69 Mb`, `46.4 kb`, or `842 bp`. */
export function formatBasePairs(value) {
  if (!Number.isFinite(value)) return 'unknown';
  const bp = Math.round(value);
  if (Math.abs(bp) >= 1e6) return `${(bp / 1e6).toFixed(2)} Mb`;
  if (Math.abs(bp) >= 1e4) return `${(bp / 1e3).toFixed(1)} kb`;
  return `${bp.toLocaleString('en-US')} bp`;
}

/** A coordinate written the way the axis labels read it. */
export function formatCoordinate(bp) {
  return Number.isFinite(bp) ? Math.round(bp).toLocaleString('en-US') : 'unknown';
}

/** A round tick interval over a window, in 1/2/5 times a power of ten. */
export function tickStepBp(window, target = 6) {
  const span = Math.max(1, window.to - window.from + 1);
  const rough = span / Math.max(1, target);
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  for (const multiple of [1, 2, 5]) {
    if (magnitude * multiple >= rough) return magnitude * multiple;
  }
  return magnitude * 10;
}

/**
 * The unit every tick on one axis is written in.
 *
 * One unit for the whole axis, not one per value: a ruler reading
 * "500.0 kb, 1.00 Mb, 1.50 Mb" makes the reader convert between neighbouring
 * ticks. The largest unit that still separates adjacent ticks within a single
 * decimal place wins, so the labels stay short at every zoom without ever
 * rounding two ticks to the same number.
 */
export function axisUnit(step) {
  const candidates = [
    { divisor: 1e6, suffix: 'Mb' },
    { divisor: 1e3, suffix: 'kb' },
    { divisor: 1, suffix: 'bp' },
  ];
  const chosen = candidates.find((candidate) => step / candidate.divisor >= 0.1)
    ?? candidates[candidates.length - 1];
  return { ...chosen, decimals: step / chosen.divisor < 1 ? 1 : 0 };
}

/** Tick coordinates across a window, each with the label the axis draws. */
export function positionTicks(window, target = 6) {
  const step = tickStepBp(window, target);
  const unit = axisUnit(step);
  const label = (bp) => `${(bp / unit.divisor).toLocaleString('en-US', {
    minimumFractionDigits: unit.decimals, maximumFractionDigits: unit.decimals,
  })} ${unit.suffix}`;
  const ticks = [];
  const first = Math.ceil(window.from / step) * step;
  for (let bp = first; bp <= window.to; bp += step) ticks.push({ bp, label: label(bp) });
  if (ticks.length === 0) ticks.push({ bp: window.from, label: label(window.from) });
  return ticks;
}

/**
 * The navigable lanes, in the order they are drawn top to bottom: for each
 * replicon, the plus-strand lane above its axis then the minus-strand lane
 * below it. Keyboard movement walks this structure, so its order is what
 * "the next gene to the right" and "the lane below" mean.
 */
export function navigationLanes(tracks) {
  const lanes = [];
  for (const track of tracks) {
    for (const strand of ['+', '-']) {
      lanes.push({
        accession: track.accession,
        label: track.label,
        lengthBp: track.lengthBp,
        strand,
        lane: strandLane(strand),
        marks: track.marks.filter((mark) => mark.strand === strand),
      });
    }
  }
  return lanes;
}

/**
 * The next position from `current` in a compass direction.
 *
 * Left and right step along one lane in coordinate order. Up and down cross to
 * the adjacent lane and land on the mark nearest the same *fraction* of its own
 * replicon, because the two replicons do not share a scale and a base-pair
 * distance between them would mean nothing.
 *
 * @param {object[]} lanes from {@link navigationLanes}.
 * @param {{laneIndex: number, markIndex: number}|null} current
 * @param {'left'|'right'|'up'|'down'} direction
 * @param {(mark: object) => boolean} allowed skips marks the caller hides.
 * @returns {{laneIndex: number, markIndex: number}|null}
 */
export function neighborMark(lanes, current, direction, allowed = () => true) {
  const firstIn = (laneIndex, step) => {
    const marks = lanes[laneIndex]?.marks ?? [];
    const start = step > 0 ? 0 : marks.length - 1;
    for (let i = start; i >= 0 && i < marks.length; i += step) {
      if (allowed(marks[i])) return { laneIndex, markIndex: i };
    }
    return null;
  };
  if (!current) {
    for (let laneIndex = 0; laneIndex < lanes.length; laneIndex += 1) {
      const found = firstIn(laneIndex, 1);
      if (found) return found;
    }
    return null;
  }
  const lane = lanes[current.laneIndex];
  if (!lane) return null;
  if (direction === 'left' || direction === 'right') {
    const step = direction === 'right' ? 1 : -1;
    for (let i = current.markIndex + step; i >= 0 && i < lane.marks.length; i += step) {
      if (allowed(lane.marks[i])) return { laneIndex: current.laneIndex, markIndex: i };
    }
    return null;
  }
  const step = direction === 'down' ? 1 : -1;
  const origin = lane.marks[current.markIndex];
  if (!origin) return null;
  const fractionOf = (mark, lengthBp) => mark.anchorBp / Math.max(1, lengthBp);
  const target = fractionOf(origin, lane.lengthBp);
  for (let laneIndex = current.laneIndex + step; laneIndex >= 0 && laneIndex < lanes.length;
    laneIndex += step) {
    const candidate = lanes[laneIndex];
    let best = -1;
    let bestDistance = Infinity;
    for (let i = 0; i < candidate.marks.length; i += 1) {
      if (!allowed(candidate.marks[i])) continue;
      const distance = Math.abs(fractionOf(candidate.marks[i], candidate.lengthBp) - target);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = i;
      }
    }
    if (best >= 0) return { laneIndex, markIndex: best };
  }
  return null;
}

/** Where a gene index sits in the lane structure, or null when it is absent. */
export function locateIndex(lanes, index) {
  for (let laneIndex = 0; laneIndex < lanes.length; laneIndex += 1) {
    const markIndex = lanes[laneIndex].marks.findIndex((mark) => mark.index === index);
    if (markIndex >= 0) return { laneIndex, markIndex };
  }
  return null;
}

/**
 * Gene-linked start sites as absolute coordinates on one replicon.
 *
 * These were measured on this assembly, so they are the one positional layer
 * that may sit on the axis directly. The published `position` is used as given
 * and never recomputed against this release's annotated start, which is why the
 * distance the study published is carried alongside it.
 */
export function tssPositions(track, genes) {
  const sites = [];
  for (const mark of track.marks) {
    const evidence = genes[mark.index]?.tssEvidence;
    if (!Array.isArray(evidence)) continue;
    for (const site of evidence) {
      if (!Number.isFinite(site?.position)) continue;
      if (!sameReplicon(site.replicon, track.accession)) continue;
      if (site.position < 1 || site.position > track.lengthBp) continue;
      sites.push({
        id: site.id,
        geneIndex: mark.index,
        geneId: mark.id,
        position: site.position,
        strand: site.strand === '-' ? '-' : '+',
        sourceStartDistanceNt: Number.isFinite(site.sourceStartDistanceNt)
          ? site.sourceStartDistanceNt : null,
      });
    }
  }
  return sites.sort((a, b) => a.position - b.position);
}

/**
 * What the view did about marks that share pixels, in sentences.
 *
 * Paint order changes which gene is seen without changing a single value, so it
 * has to be said out loud: a region can look hotter than its typical gene
 * purely because the standout was moved on top. These sentences name the rule,
 * how crowded the columns are at the zoom now drawn, the rule that settles two
 * different categories in one column, and — while a bar is too narrow to carry
 * the hollow derived style — that derived and reviewed categories draw alike,
 * with the count of each.
 *
 * Both places a reader can meet these sentences call this one function: the
 * canvas's accessible description, and the collapsed colour explanation where
 * the **Draw on top** control sits. By owner decision of 2026-09-30 those are
 * the only two — the legend and the conventions note carry none of it — so the
 * wording cannot drift between them, and neither can drift from the rule.
 *
 * A caller with no columns to report — the scatter map, whose marks are discs on
 * a projection and not bars on an axis — passes `columns` and `alike` null and
 * gets the ordering alone. The column-majority rule goes with the columns for
 * the same reason: without them there is no column whose majority to settle.
 *
 * @param {{categorical: boolean, order: string, accession: string,
 *   columns: {occupied: number, shared: number, median: number, max: number}|null,
 *   alike: {derived: number, reviewed: number}|null}|null} paintOrder
 * @returns {string[]}
 */
export function describePaintOrder(paintOrder) {
  if (!paintOrder) return [];
  const parts = [paintOrder.order];
  const columns = paintOrder.columns;
  const hasColumns = Boolean(columns) && columns.occupied > 0;
  if (hasColumns) {
    parts.push(columns.shared > 0
      ? `They do share pixels here: on ${paintOrder.accession} at this zoom, `
        + `${columns.shared.toLocaleString('en-US')} of `
        + `${columns.occupied.toLocaleString('en-US')} occupied columns `
        + `${columns.shared === 1 ? 'holds' : 'hold'} more than one CDS, `
        + `${columns.median.toLocaleString('en-US')} in the middle column and up to `
        + `${columns.max.toLocaleString('en-US')} at the worst.`
      : `They do not share pixels here: each of the ${columns.occupied.toLocaleString('en-US')} `
        + `occupied columns on ${paintOrder.accession} holds one CDS at this zoom.`);
  }
  if (paintOrder.categorical && hasColumns) {
    // The reviewed-over-derived clause belongs to the channel that has two
    // kinds of evidence behind a category. A channel with one — the
    // overlapping-gene classes — follows the same rule without it.
    parts.push('Where CDSs of different categories share one column, the column shows '
      + (paintOrder.derivedEvidence === false ? ''
        : 'a lab-reviewed category over a source-derived one, then ')
      + 'the category with more CDSs in that column, then the earlier locus. Every column is '
      + 'decided by what is in it: a CDS wide enough to cross several can hold the majority in '
      + 'one and be the minority in the next.');
  }
  if (paintOrder.alike) {
    parts.push(describeSolidDerived(paintOrder.alike));
  }
  parts.push('Nothing is hidden by this order: every CDS stays selectable, reachable by the '
    + 'arrow keys, and counted.');
  return parts;
}

/**
 * Owner decision D1's disclosure: how many source-derived categories are drawn
 * in the solid colour a lab-reviewed one takes, because their bars are too
 * narrow to show the hollow style.
 *
 * Written once, here, and used by both the legend note and the canvas
 * description, so the two cannot disagree about the same picture.
 *
 * Every count this can actually take has to read as English, including the two
 * the picture really produces: one CDS of either kind, and — at any zoom where
 * no lab-reviewed CDS is in the window — none of them. "The same solid colour
 * as the 0 lab-reviewed ones" names a comparison the reader has nothing on
 * screen to make, so at zero the sentence says what the colour is instead.
 *
 * @param {{derived: number, reviewed: number, threshold: number}} alike the
 *   counts the last paint produced, and the width the hollow style needs.
 */
export function describeSolidDerived({ derived, reviewed, threshold }) {
  const subject = derived === 1
    ? '1 source-derived category draws'
    : `${derived.toLocaleString('en-US')} source-derived categories draw`;
  const against = reviewed === 0
    ? 'in the solid colour a lab-reviewed category takes, with no lab-reviewed CDS in the window '
      + 'to compare it against'
    : `in the same solid colour as the ${reviewed.toLocaleString('en-US')} lab-reviewed `
      + `${reviewed === 1 ? 'one' : 'ones'}`;
  return `At this zoom ${subject} ${against}, because a bar under ${threshold} pixels wide `
    + 'cannot show the hollow derived style. It returns on any bar wide enough for it, segment '
    + 'by segment, so zooming in brings it back.';
}

/**
 * One sentence naming what this view is showing, for the canvas's accessible
 * label. A picture with no text equivalent leaves the view unreadable to
 * anyone not looking at it.
 */
export function describeChromosomeView({
  tracks, window, colorLabel, passing, total, selected = null, categoryFilterLabels = [],
  colorScaleClause = null, paintOrder = null, overlapClause = null,
  copyNumberSentence = DEFAULT_ORGANISM.copy.copyNumberSentence,
}) {
  if (!Array.isArray(tracks) || tracks.length === 0) {
    return 'The chromosome view has no verified replicon to draw.';
  }
  const primary = tracks.find((track) => track.primary) ?? tracks[0];
  const secondary = tracks.filter((track) => track !== primary);
  const parts = [];
  // The scale belongs in this sentence, not only in the legend: which colour a
  // value takes depends on it, so a reader who cannot see the ramp still needs it.
  parts.push(`Linear map of ${total.toLocaleString('en-US')} plotted CDSs, `
    + `${passing.toLocaleString('en-US')} of them passing the current filters, coloured by `
    + `${colorLabel}${colorScaleClause ? ` ${colorScaleClause}` : ''}.`);
  parts.push(`${primary.accession}, the ${formatBasePairs(primary.lengthBp)} chromosome, carries `
    + `${primary.cdsCount.toLocaleString('en-US')} of them and is the primary track, with base 1 `
    + `at its origin; the view spans ${formatCoordinate(window.from)} to `
    + `${formatCoordinate(window.to)}.`);
  if (secondary.length > 0) {
    parts.push(`Beneath it, each at its own scale and never concatenated onto the chromosome `
      + `axis: ${secondary.map((track) => `${track.accession}, ${formatBasePairs(track.lengthBp)}, `
        + `${track.cdsCount.toLocaleString('en-US')} plotted CDSs`).join('; ')}.`);
  }
  parts.push('Plus-strand CDSs sit above each axis and minus-strand CDSs below it.');
  // The overlap row is a third band of pixels and has to be in the sentence:
  // a reader who is not looking at the canvas would otherwise not know it is
  // there, nor whether it is empty because nothing overlaps or because the
  // layer has not been read.
  if (overlapClause) parts.push(overlapClause);
  parts.push(...describePaintOrder(paintOrder));
  const wrapping = tracks.flatMap((track) => track.marks.filter((mark) => mark.wraps));
  if (wrapping.length > 0) {
    parts.push(`${wrapping.map((mark) => mark.id).join(' and ')} cross the circular origin and are `
      + 'drawn as their two annotated segments with a wrap marker at each end.');
  }
  // Named, not counted. This sentence is the whole view for a reader who is not
  // looking at it, and "1 function category is selected" does not say which one.
  // Semicolons separate the names because most of them contain "and".
  const filters = Array.isArray(categoryFilterLabels) ? categoryFilterLabels : [];
  if (filters.length > 0) {
    parts.push(`${filters.length} function categor${filters.length === 1 ? 'y is' : 'ies are'} `
      + `selected: ${filters.join('; ')}.`);
  }
  parts.push(selected
    ? `${selected} is selected and open in the gene visualizer.`
    : 'No CDS is selected.');
  // An organism fact, so it is the organism's own sentence or none at all.
  if (copyNumberSentence) parts.push(copyNumberSentence);
  return parts.join(' ');
}

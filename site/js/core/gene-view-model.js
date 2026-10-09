/**
 * Geometry for the gene visualizer, in transcription orientation.
 *
 * DOM-free so the arithmetic is testable in Node. Every coordinate here is an
 * offset in nucleotides from the first base of the annotated coding sequence,
 * increasing in the direction the gene is transcribed. A negative offset is
 * upstream. That frame, rather than raw genomic position, is what makes a
 * negative-strand gene read the same way as a positive-strand one, and it is
 * the frame positional evidence from another strain would have to arrive in,
 * because genomic coordinates do not transfer across the UTEX 2973 inversion.
 */

import { cdsPieces, repliconLength, wrapsOrigin } from './chromosome-model.js';
import { markerLayerForKey, markerOf } from './marker-layers.js';

/** Upstream context drawn by default: the contract's own [-30,60) start window. */
export const UPSTREAM_CONTEXT_NT = 30;

/** Minimum upstream room, so a gene with no TSS evidence still shows its promoter side. */
const MIN_UPSTREAM_NT = 60;

/** Downstream room past the stop codon, as a fraction of the drawn span. */
const DOWNSTREAM_PAD_FRACTION = 0.04;

/**
 * The genomic pieces of a CDS in the order they are transcribed, each with the
 * number of genomic bases skipped before it.
 *
 * Plus-strand pieces run by ascending coordinate and minus-strand pieces by
 * descending coordinate. A CDS that crosses the circular origin, one whose
 * pieces touch both base 1 and the replicon's last base (`wrapsOrigin`), is
 * the exception: on the plus strand the piece ending at the last base comes
 * first and the piece starting at base 1 follows it, and on the minus strand
 * base 1's piece is transcribed first, down to base 1, then the far piece from
 * the last base down. `M744_RS13290` is `complement(join(45877..46366,1..2510))`
 * and reads from 2,510 down to 1 and then from 46,366 down to 45,877. Every gap
 * is measured around the circle, so the wrap junction skips nothing.
 *
 * @returns {{low: number, high: number, gapBefore: number}[]}
 */
export function transcriptionPieces(gene, lengthBp = repliconLength(gene?.seqid)) {
  const pieces = cdsPieces(gene);
  if (pieces.length === 0) return [];
  const wraps = wrapsOrigin(pieces, lengthBp);
  let ordered;
  if (gene.strand === '-') {
    const descending = [...pieces].sort((a, b) => b.from - a.from);
    const far = descending.findIndex((piece) => piece.to === lengthBp);
    ordered = wraps ? [...descending.slice(far + 1), ...descending.slice(0, far + 1)] : descending;
  } else {
    const origin = pieces.findIndex((piece) => piece.from === 1);
    ordered = wraps ? [...pieces.slice(origin + 1), ...pieces.slice(0, origin + 1)] : pieces;
  }
  const around = (distance) => (Number.isFinite(lengthBp) && lengthBp > 0
    ? ((distance % lengthBp) + lengthBp) % lengthBp
    : distance);
  return ordered.map((piece, i) => {
    let gapBefore = 0;
    if (i > 0) {
      const previous = ordered[i - 1];
      gapBefore = gene.strand === '-'
        ? around(previous.from - piece.to - 1)
        : around(piece.from - previous.to - 1);
    }
    return { low: piece.from, high: piece.to, gapBefore };
  });
}

/**
 * The coding segments in transcription order, as offsets from the first
 * transcribed base.
 *
 * A gene with `cdsSegments` is a join of non-adjacent genomic pieces, and the
 * gap between them is real: the drawn track must show it rather than a
 * continuous bar, because a translation that depends on a frameshift is a
 * high-risk recoding target the viewer should not smooth over. The offsets
 * accumulate piece by piece with each genomic gap, which is what places an
 * origin-crossing plasmid gene on one short track instead of across the whole
 * replicon its `start` and `end` span.
 */
export function orientedSegments(gene) {
  const segments = [];
  let offset = 0;
  for (const piece of transcriptionPieces(gene)) {
    offset += piece.gapBefore;
    const length = piece.high - piece.low + 1;
    segments.push({ from: offset, to: offset + length - 1 });
    offset += length;
  }
  return segments.length > 0 ? segments : [{ from: 0, to: Math.max(0, gene.end - gene.start) }];
}

/**
 * Every published Tan 2018 start-site row of one gene, drawn or not.
 *
 * `sourceStartDistanceNt` is the distance the authors published against their
 * own gene model, never recomputed against this release's start. It is drawn as
 * given and labelled as such: silently re-measuring it would invent a
 * coordinate the source never reported.
 *
 * The chromosome view draws the same site at its published absolute
 * `position`, and the two placements can disagree where this release's start
 * differs from the authors' gene model. `impliedDistanceNt` is the distance
 * that position implies against the current start, and `placementGapNt` the
 * disagreement, 0 when both placements coincide; the view labels the gap rather
 * than choosing a side, because which placement a construct boundary should
 * follow is the lab's call.
 *
 * A row with no published distance has no offset to draw at, so it carries
 * `drawn: false` and stays in this list. Dropping it here as well as from the
 * drawing would make an unmapped row indistinguishable from one the study never
 * published, which is the one thing an inspection list must not do.
 *
 * `readCount` is how many finite condition read counts the row itself carries,
 * over whatever conditions it reports; `evidence` is `measured` while it
 * carries one and `unrecorded` when it carries none. Neither is a claim about
 * initiation: a published site with no counts in this extract is still a
 * measured site, and is said to be one.
 *
 * Each row is a shared marker record — {@link markerOf}, with its geometry,
 * type, strand, native coordinate, measured-versus-predicted status and
 * unmapped state — plus the gene-relative fields only a gene-relative track
 * needs. One representation, so the chromosome view, both gene visualizers and
 * the sequence close-up cannot disagree about a site; and `drawn` is about this
 * track alone, since a row's native coordinate can be present while its
 * published distance is not, and the reverse.
 */
export function tssSiteRows(gene) {
  const sites = Array.isArray(gene?.tssEvidence) ? gene.tssEvidence : [];
  const layer = markerLayerForKey('tssEvidence');
  return sites
    .map((site) => {
      const marker = markerOf(site, layer);
      const distanceNt = Number.isFinite(site?.sourceStartDistanceNt)
        ? site.sourceStartDistanceNt : null;
      const { position } = marker;
      const impliedDistanceNt = position === null ? null
        : gene.strand === '-' ? position - gene.end : gene.start - position;
      return {
        ...marker,
        // The source's own type string under the name this track has always
        // printed, beside the representation's `typeId` and `typeLabel`.
        type: site?.type ?? null,
        offset: distanceNt === null ? null : -distanceNt,
        distanceNt,
        impliedDistanceNt,
        placementGapNt: impliedDistanceNt === null || distanceNt === null ? null
          : Math.abs(impliedDistanceNt - distanceNt),
        evidence: marker.readCount > 0 ? 'measured' : 'unrecorded',
        drawn: distanceNt !== null,
      };
    })
    // Drawn rows in drawn order, then the rows with nowhere to be drawn in the
    // order the source published them; `sort` is stable, so that order holds.
    .sort((a, b) => {
      if (a.drawn !== b.drawn) return a.drawn ? -1 : 1;
      return a.drawn ? a.offset - b.offset : 0;
    });
}

/**
 * The start-site marks the track can place, in drawn order.
 *
 * The drawable rows of {@link tssSiteRows}, projected onto the fields a mark
 * is drawn and titled from. The inspection list reads the rows themselves, so
 * the two cannot disagree about a site.
 */
export function tssMarks(gene) {
  return tssSiteRows(gene)
    .filter((row) => row.drawn)
    .map(({
      id, offset, distanceNt, impliedDistanceNt, placementGapNt, strand, position, replicon,
      origin, producer,
    }) => ({
      id, offset, distanceNt, impliedDistanceNt, placementGapNt, strand, position, replicon,
      origin, producer,
    }));
}

/**
 * Marks that share drawn space, grouped by single linkage, in drawn order.
 *
 * Two marks less than `minSeparation` apart on the drawn axis overlap at every
 * rendered size, because the viewBox scales the gap and the mark head by the
 * same factor. A run of such pairs is one visual cluster even where its two
 * ends are further apart than that, which is why this links rather than
 * buckets: `M744_RS01695`'s tightest marks are 2.7 units apart in a chain of
 * 6-unit heads.
 *
 * Every mark joins exactly one group and groups keep drawn order, so a caller
 * can label each mark with where it is drawn and lose none of them. A group is
 * a fact about the picture at this width and never a claim that one biological
 * site, or one continuous stretch of evidence, is behind it.
 *
 * @param {{offset: number}[]} marks in ascending offset.
 * @param {(offset: number) => number} xOf drawn position of one offset.
 * @param {number} minSeparation the drawn width one mark head covers.
 */
export function overlapGroups(marks, xOf, minSeparation) {
  const groups = [];
  let previous = null;
  for (const mark of marks) {
    const x = xOf(mark.offset);
    if (previous === null || Math.abs(x - previous) >= minSeparation) groups.push([]);
    groups[groups.length - 1].push(mark);
    previous = x;
  }
  return groups;
}

/**
 * Add interaction padding to one drawn interval without stealing the nearest
 * part of a neighbouring interval's padding.
 *
 * The visible interval is never shortened. Only the invisible padding is
 * divided at the midpoint of gaps between adjacent feature edges, so nearby marks
 * remain independently reachable. Exactly overlapping features intentionally
 * keep the same target: SVG paint order then applies the existing evidence
 * precedence, while the complete inspection list retains every row.
 *
 * @param {{from: number, to: number}[]} ranges visible intervals in paint order.
 * @param {number} index interval whose hit range is wanted.
 * @param {number} padding non-negative drawn units added at either edge.
 * @returns {{from: number, to: number}|null}
 */
export function paddedHitRange(ranges, index, padding) {
  const range = ranges[index];
  if (!range || !Number.isFinite(range.from) || !Number.isFinite(range.to)
    || range.to < range.from || !Number.isFinite(padding) || padding < 0) return null;
  let from = range.from - padding;
  let to = range.to + padding;
  ranges.forEach((candidate, candidateIndex) => {
    if (candidateIndex === index || !Number.isFinite(candidate?.from)
      || !Number.isFinite(candidate?.to) || candidate.to < candidate.from) return;
    if (candidate.from < range.from) {
      from = Math.max(from, Math.min(range.from, (candidate.to + range.from) / 2));
    }
    if (candidate.to > range.to) {
      to = Math.min(to, Math.max(range.to, (range.to + candidate.from) / 2));
    }
  });
  return { from, to };
}

/**
 * A complete, renderer-agnostic description of one gene's track.
 *
 * @param {object} gene a record from `genes.json`, with `tssEvidence` joined.
 * @returns {object|null} null when the record has no usable coordinates.
 */
export function geneViewModel(gene) {
  if (!gene || !Number.isFinite(gene.start) || !Number.isFinite(gene.end)) return null;
  const segments = orientedSegments(gene);
  const codingEnd = segments[segments.length - 1].to;
  const sites = tssSiteRows(gene);
  const marks = tssMarks(gene);
  const furthestUpstream = marks.length > 0 ? -marks[0].offset : 0;
  const upstream = Math.max(MIN_UPSTREAM_NT, UPSTREAM_CONTEXT_NT, furthestUpstream);
  const span = codingEnd + upstream;
  const domain = {
    min: -upstream,
    max: codingEnd + Math.max(12, Math.round(span * DOWNSTREAM_PAD_FRACTION)),
  };
  // The first three bases are the initiation triplet, which is read as
  // methionine whatever the codon table says and is never recoded. The last
  // three are the terminal stop, carried outside the packed codon string. Both
  // are drawn because both are exceptions to how the rest of the gene is
  // treated.
  const first = segments[0];
  const last = segments[segments.length - 1];
  const codons = [
    {
      kind: 'start',
      from: first.from,
      to: Math.min(first.from + 3, first.to),
      label: 'Initiation triplet, never recoded',
    },
  ];
  if (typeof gene.terminalStop === 'string' && gene.terminalStop.length === 3) {
    codons.push({
      kind: 'stop',
      from: Math.max(last.to - 3, last.from),
      to: last.to,
      label: `Terminal stop ${gene.terminalStop}`,
    });
  }
  return {
    id: gene.id,
    name: gene.name ?? null,
    product: gene.product ?? null,
    replicon: gene.seqid ?? null,
    strand: gene.strand === '-' ? '-' : '+',
    start: gene.start,
    end: gene.end,
    lengthNt: Number.isFinite(gene.lengthNt) ? gene.lengthNt : null,
    lengthCodons: Number.isFinite(gene.lengthCodons) ? gene.lengthCodons : null,
    terminalStop: gene.terminalStop ?? null,
    translationalException: gene.translationalException ?? null,
    spliced: segments.length > 1,
    segments,
    codons,
    tss: marks,
    // Every published row, including any with no distance to be drawn at, so
    // the inspection list can hold them while the drawing cannot.
    tssSites: sites,
    domain,
    upstreamContextNt: UPSTREAM_CONTEXT_NT,
  };
}

/**
 * Fraction of the drawn width for one offset, clamped into the track.
 * Returns 0 for an empty domain rather than a division by zero.
 */
export function fractionOf(domain, offset) {
  const width = domain.max - domain.min;
  if (!(width > 0)) return 0;
  return Math.min(1, Math.max(0, (offset - domain.min) / width));
}

/**
 * A round tick interval giving roughly `target` ticks over the domain.
 * Only 1, 2, and 5 times a power of ten, so the ruler reads in familiar steps.
 */
export function tickStep(domain, target = 5) {
  const width = domain.max - domain.min;
  if (!(width > 0) || !(target > 0)) return 1;
  const rough = width / target;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  for (const multiple of [1, 2, 5]) {
    if (magnitude * multiple >= rough) return magnitude * multiple;
  }
  return magnitude * 10;
}

/** Tick offsets across the domain, always including zero, the annotated start. */
export function ticksFor(domain, target = 5) {
  const step = tickStep(domain, target);
  const ticks = [];
  for (let value = Math.ceil(domain.min / step) * step; value <= domain.max; value += step) {
    ticks.push(Math.round(value));
  }
  if (!ticks.includes(0) && domain.min <= 0 && domain.max >= 0) ticks.push(0);
  return ticks.sort((a, b) => a - b);
}

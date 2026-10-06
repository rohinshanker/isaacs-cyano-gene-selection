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
 * Published Tan 2018 start sites as upstream offsets.
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
 */
export function tssMarks(gene) {
  const sites = Array.isArray(gene.tssEvidence) ? gene.tssEvidence : [];
  return sites
    .filter((site) => Number.isFinite(site?.sourceStartDistanceNt))
    .map((site) => {
      const position = Number.isFinite(site.position) ? site.position : null;
      const impliedDistanceNt = position === null ? null
        : gene.strand === '-' ? position - gene.end : gene.start - position;
      return {
        id: site.id,
        offset: -site.sourceStartDistanceNt,
        distanceNt: site.sourceStartDistanceNt,
        impliedDistanceNt,
        placementGapNt: impliedDistanceNt === null ? null
          : Math.abs(impliedDistanceNt - site.sourceStartDistanceNt),
        strand: site.strand ?? null,
        position,
        replicon: site.replicon ?? null,
      };
    })
    .sort((a, b) => a.offset - b.offset);
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

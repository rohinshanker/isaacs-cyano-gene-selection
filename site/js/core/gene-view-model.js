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

/** Upstream context drawn by default: the contract's own [-30,60) start window. */
export const UPSTREAM_CONTEXT_NT = 30;

/** Minimum upstream room, so a gene with no TSS evidence still shows its promoter side. */
const MIN_UPSTREAM_NT = 60;

/** Downstream room past the stop codon, as a fraction of the drawn span. */
const DOWNSTREAM_PAD_FRACTION = 0.04;

/**
 * Genomic interval to transcription-oriented offsets.
 * On the minus strand the gene's `end` is its first transcribed base, so the
 * interval is mirrored and its ends swap.
 */
function orientInterval([low, high], gene) {
  return gene.strand === '-'
    ? { from: gene.end - high, to: gene.end - low }
    : { from: low - gene.start, to: high - gene.start };
}

/**
 * The coding segments in transcription order.
 *
 * A gene with `cdsSegments` is a join of non-adjacent genomic pieces, and the
 * gap between them is real: the drawn track must show it rather than a
 * continuous bar, because a translation that depends on a frameshift is a
 * high-risk recoding target the viewer should not smooth over.
 */
export function orientedSegments(gene) {
  const raw = Array.isArray(gene.cdsSegments) && gene.cdsSegments.length > 0
    ? gene.cdsSegments
    : [[gene.start, gene.end]];
  return raw
    .map((segment) => orientInterval(segment, gene))
    .sort((a, b) => a.from - b.from);
}

/**
 * Published Tan 2018 start sites as upstream offsets.
 *
 * `sourceStartDistanceNt` is the distance the authors published against their
 * own gene model, never recomputed against this release's start. It is drawn as
 * given and labelled as such: silently re-measuring it would invent a
 * coordinate the source never reported.
 */
export function tssMarks(gene) {
  const sites = Array.isArray(gene.tssEvidence) ? gene.tssEvidence : [];
  return sites
    .filter((site) => Number.isFinite(site?.sourceStartDistanceNt))
    .map((site) => ({
      id: site.id,
      offset: -site.sourceStartDistanceNt,
      distanceNt: site.sourceStartDistanceNt,
      strand: site.strand ?? null,
      position: Number.isFinite(site.position) ? site.position : null,
      replicon: site.replicon ?? null,
    }))
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

/** Native annotation flanks, independent of OG and adjacent-CDS metrics.
 * Build once per validated catalogue; cache each focal answer. No filter or
 * camera enters this index. All published genome-of-record replicons are circular.
 */
import { wrapsOrigin } from './chromosome-model.js';
import { transcriptionPieces } from './gene-view-model.js';

const EMPTY = Object.freeze([]);
const side = (status, neighbours = EMPTY, blockedBy = EMPTY) => Object.freeze({
  status, neighbours: Object.freeze(neighbours), blockedBy: Object.freeze(blockedBy),
});
const mod = (value, length) => ((value % length) + length) % length;
const occupies = (feature, bp) => feature.segments.some(({ from, to }) => from <= bp && bp <= to);

/** Exact outside-boundary distances in the focal gene's transcription frame. */
export function nativeNeighbours(focal, catalogue, lengthBp, partners = []) {
  if (!focal || !Number.isInteger(lengthBp) || lengthBp < 1) return null;
  if (focal.strand !== '+' && focal.strand !== '-') {
    return Object.freeze({ upstream: side('unknown-strand'), downstream: side('unknown-strand') });
  }
  // The pinned catalogue has only two-piece origin joins. More pieces need
  // native outer bounds/order, which this reduced schema does not carry.
  if (focal.segments.length > 2 && wrapsOrigin(focal.segments, lengthBp)) {
    return Object.freeze({ upstream: side('unsupported-geometry'), downstream: side('unsupported-geometry') });
  }
  const direction = focal.strand === '-' ? -1 : 1;
  const pieces = transcriptionPieces({
    ...focal, cdsSegments: focal.segments.map(({ from, to }) => [from, to]),
  }, lengthBp);
  if (!pieces.length) return null;
  const start = direction === 1 ? pieces[0].low : pieces[0].high;
  const last = pieces[pieces.length - 1];
  const end = direction === 1 ? last.high : last.low;
  // Includes joined gaps; those are internal to the transcribed span, never flanks.
  const span = pieces.reduce((total, piece) => total + piece.gapBefore + piece.high - piece.low + 1, 0);
  const outside = lengthBp - span;
  const overlapping = new Set(partners.map((partner) => partner.id));
  const answer = (boundary, step) => {
    if (outside <= 0) return side('no-flank');
    const next = mod(boundary - 1 + step, lengthBp) + 1;
    const blockedBy = partners.filter((partner) => occupies(partner, boundary) && occupies(partner, next))
      .map((partner) => partner.id).sort();
    if (blockedBy.length) return side('overlap-blocked', EMPTY, blockedBy);
    let best = Infinity;
    let nearest = [];
    for (const candidate of catalogue) {
      if (candidate.id === focal.id || candidate.seqid !== focal.seqid) continue;
      let distance = Infinity;
      for (const piece of candidate.segments) {
        const inward = step === 1 ? piece.from : piece.to;
        const reach = mod(step * (inward - boundary), lengthBp);
        if (reach > 0 && reach <= outside) distance = Math.min(distance, reach);
      }
      if (distance > best || !Number.isFinite(distance)) continue;
      const neighbour = Object.freeze({ ...candidate, gapNt: distance - 1 });
      if (distance < best) { best = distance; nearest = []; }
      nearest.push(neighbour);
    }
    nearest.sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
    const outwardPartners = nearest.filter((candidate) => overlapping.has(candidate.id)).map((candidate) => candidate.id);
    if (outwardPartners.length) return side('overlap-blocked', EMPTY, outwardPartners);
    return side(nearest.length ? 'ready' : 'no-flank', nearest);
  };
  return Object.freeze({ upstream: answer(start, -direction), downstream: answer(end, direction) });
}

export function createNeighbourIndex(catalogue, lengthByAccession, partnersById) {
  const byId = new Map(catalogue.map((feature) => [feature.id, feature]));
  const byReplicon = new Map();
  for (const feature of catalogue) {
    if (!byReplicon.has(feature.seqid)) byReplicon.set(feature.seqid, []);
    byReplicon.get(feature.seqid).push(feature);
  }
  const cache = new Map();
  return Object.freeze({
    get resolvedGeneCount() { return cache.size; },
    get(id) {
      if (!byId.has(id)) return null;
      if (!cache.has(id)) {
        const focal = byId.get(id);
        cache.set(id, nativeNeighbours(focal, byReplicon.get(focal.seqid),
          lengthByAccession.get(focal.seqid), partnersById.get(id) ?? EMPTY));
      }
      return cache.get(id);
    },
  });
}

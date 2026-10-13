/** End-contiguous shared bases, derived once from the validated native OG layer. */
import { cdsPieces, wrapsOrigin } from './chromosome-model.js';
import { transcriptionPieces } from './gene-view-model.js';

export const OVERLAP_LENGTH_METHOD = 'Starting at each annotated transcriptional end, walk inward through shared genomic bases until the first uncovered base or real gap between coding segments. Union all OG partners first, regardless of strand, biotype, plotting or filtering. Circular origin is continuous; wholly internal overlaps contribute nothing. Each shared base counts once per end. A fully covered continuous gene contributes its full length to each end; the sum is exactly 5′ + 3′ and can count the same base twice. Known absence is 0 bp; missing data, unknown orientation or unsupported geometry is unavailable.';
export const OVERLAP_LENGTH_METRICS = Object.freeze([
  { key: 'overlap5PrimeNt', field: 'fivePrimeNt', label: '5′ overlap length' },
  { key: 'overlap3PrimeNt', field: 'threePrimeNt', label: '3′ overlap length' },
  { key: 'overlapTotalNt', field: 'totalNt', label: '5′ + 3′ overlap length' },
].map((entry) => Object.freeze({ ...entry, unit: 'bp', family: 'Genomic context',
  integer: true, source: 'derived', fileKey: 'geneOverlaps',
  desc: entry.field === 'totalNt' ? 'Arithmetic sum of the two end-contiguous overlap lengths; shared bases can contribute to both ends.'
    : `Contiguous shared genomic bases inward from the annotated ${entry.field === 'fivePrimeNt' ? '5′' : '3′'} transcriptional end.` })));

/** Frozen {fivePrimeNt, threePrimeNt, totalNt}, or null for unavailable context. */
export function endOverlapLengths(gene, partners, lengthBp) {
  if (!gene || !Array.isArray(partners) || !Number.isSafeInteger(lengthBp) || lengthBp < 1
    || !['+', '-'].includes(gene.strand)) return null;
  const raw = gene.cdsSegments?.length ? gene.cdsSegments : [[gene.start, gene.end]];
  if (!Array.isArray(raw) || raw.some((pair) => !Array.isArray(pair) || pair.length !== 2
    || !Number.isSafeInteger(pair[0]) || !Number.isSafeInteger(pair[1])
    || pair[0] < 1 || pair[1] < pair[0] || pair[1] > lengthBp)) return null;
  const segments = cdsPieces(gene);
  if (segments.length > 2 && wrapsOrigin(segments, lengthBp)) return null;
  // Merge coincident and abutting CDS pieces before ordering; they contain no gap.
  const merged = [];
  for (const piece of segments) {
    const last = merged[merged.length - 1];
    if (last && piece.from <= last.to + 1) last.to = Math.max(last.to, piece.to);
    else merged.push({ ...piece });
  }
  const pieces = transcriptionPieces({ ...gene,
    cdsSegments: merged.map(({ from, to }) => [from, to]) }, lengthBp);
  const shared = [];
  for (const partner of partners) {
    if (!Array.isArray(partner?.sharedIntervals)) return null;
    for (const interval of partner.sharedIntervals) {
      if (!Number.isSafeInteger(interval?.from) || !Number.isSafeInteger(interval?.to)
        || interval.from < 1 || interval.to < interval.from || interval.to > lengthBp) return null;
      shared.push({ ...interval });
    }
  }
  shared.sort((a, b) => a.from - b.from || a.to - b.to);
  const union = [];
  for (const interval of shared) {
    const last = union[union.length - 1];
    if (last && interval.from <= last.to + 1) last.to = Math.max(last.to, interval.to);
    else union.push(interval);
  }
  const count = (fromFivePrime) => {
    let total = 0;
    const ordered = fromFivePrime ? pieces : [...pieces].reverse();
    const ascending = (gene.strand === '+') === fromFivePrime;
    for (let i = 0; i < ordered.length; i += 1) {
      if (i > 0 && (fromFivePrime ? ordered[i].gapBefore : ordered[i - 1].gapBefore) > 0) break;
      const piece = ordered[i];
      const boundary = ascending ? piece.low : piece.high;
      const interval = union.find(({ from, to }) => from <= boundary && boundary <= to);
      if (!interval) break;
      const covered = ascending ? Math.min(piece.high, interval.to) - boundary + 1
        : boundary - Math.max(piece.low, interval.from) + 1;
      total += covered;
      if (covered < piece.high - piece.low + 1) break;
    }
    return total;
  };
  const fivePrimeNt = count(true);
  const threePrimeNt = count(false);
  return Object.freeze({ fivePrimeNt, threePrimeNt, totalNt: fivePrimeNt + threePrimeNt });
}

/** Validate exact bp bounds; never normalize an invalid entry into a different range. */
export function parseOverlapLengthFilter(end, minText, maxText) {
  if (!['5prime', '3prime'].includes(end)) return { error: 'Choose the 5′ or 3′ end.' };
  const bound = (text) => text.trim() === '' ? null
    : /^\d+$/.test(text.trim()) && Number.isSafeInteger(Number(text)) ? Number(text) : NaN;
  const min = bound(String(minText)); const max = bound(String(maxText));
  if (Number.isNaN(min) || Number.isNaN(max)) {
    return { error: 'Enter nonnegative whole numbers in bp, up to 9007199254740991, or leave a bound blank.' };
  }
  if (min !== null && max !== null && min > max) return { error: 'Minimum must be no greater than maximum.' };
  return { value: min === null && max === null ? null : { end, min, max }, error: null };
}

export function overlapLengthFilterActive(filter) {
  return Boolean(filter && (filter.min !== null || filter.max !== null));
}

/** The entire channel is suspended without its layer; individual unknowns remain visible. */
export function passesOverlapLengthFilter(gene, filter, available = true) {
  if (!available || !overlapLengthFilterActive(filter)) return true;
  const value = gene[filter.end === '3prime' ? 'overlap3PrimeNt' : 'overlap5PrimeNt'];
  return !Number.isFinite(value) || ((filter.min === null || value >= filter.min)
    && (filter.max === null || value <= filter.max));
}

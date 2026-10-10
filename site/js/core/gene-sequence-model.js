/**
 * The sequence a pinned gene is read from, base by base.
 *
 * DOM-free, so the decoding, translation, and coordinate arithmetic are
 * testable in Node and the close-up view only draws. Every offset here is a
 * nucleotide offset from the first base of the annotated coding sequence in
 * transcription orientation, the same frame the small gene visualizer uses:
 * zero is the first base of the initiation triplet, negative is upstream, and
 * the terminal stop occupies the last three offsets.
 *
 * It shows only what the release ships exactly: the packed sense codons, the
 * separately stored terminal stop, and exact upstream bases supplied by the
 * core `rnaContext` or its optional expanded sidecar.
 * No flank is padded, no gap base is invented, and position zero is always
 * translated as methionine and never recoded, per the data contract.
 */
import { repliconLength, sameReplicon } from './chromosome-model.js';
import { transcriptionPieces, tssSiteRows, UPSTREAM_CONTEXT_NT } from './gene-view-model.js';
import { markerCoversPosition, markerSpanNt } from './marker-layers.js';
import { replacementAt, occurrenceCounter } from './scheme.js';

/** Full residue names, so a one-letter row can be read out in words. */
export const AMINO_ACID_NAMES = Object.freeze({
  A: 'Alanine', R: 'Arginine', N: 'Asparagine', D: 'Aspartate', C: 'Cysteine',
  Q: 'Glutamine', E: 'Glutamate', G: 'Glycine', H: 'Histidine', I: 'Isoleucine',
  L: 'Leucine', K: 'Lysine', M: 'Methionine', F: 'Phenylalanine', P: 'Proline',
  S: 'Serine', T: 'Threonine', W: 'Tryptophan', Y: 'Tyrosine', V: 'Valine',
  '*': 'Stop',
});

function isDna(text, length) {
  return typeof text === 'string' && text.length === length && /^[ACGT]+$/.test(text);
}

/** How many exact upstream bases this gene can expose without inventing any. */
export function availableUpstreamNt(gene) {
  const context = gene?.rnaContext;
  const coreValid = isDna(context?.upstream, UPSTREAM_CONTEXT_NT)
    || (isDna(context?.sequence, 90) && Array.isArray(context.cdsOffsets)
    && context.cdsOffsets.length === 90
    && context.cdsOffsets[UPSTREAM_CONTEXT_NT] === 0
    && context.cdsOffsets.slice(0, UPSTREAM_CONTEXT_NT).every((offset) => offset === -1));
  if (!coreValid) return 0;
  const expanded = gene?.extendedUpstream;
  return typeof expanded === 'string' && expanded.length >= UPSTREAM_CONTEXT_NT
    && /^[ACGT]+$/.test(expanded) ? expanded.length : UPSTREAM_CONTEXT_NT;
}

/**
 * Genomic position of each transcribed base, in transcription order.
 *
 * Built from the transcription-ordered pieces so a spliced CDS keeps its gap,
 * a minus-strand gene counts downwards, and an origin-crossing gene continues
 * across base 1. Returns null when the pieces do not add up to the coding
 * length, because a position table that disagrees with the sequence would
 * label every base with the wrong coordinate.
 */
export function genomicPositions(gene, cdsLengthNt) {
  const positions = [];
  for (const piece of transcriptionPieces(gene)) {
    const length = piece.high - piece.low + 1;
    for (let k = 0; k < length; k += 1) {
      positions.push(gene.strand === '-' ? piece.high - k : piece.low + k);
    }
  }
  return positions.length === cdsLengthNt ? positions : null;
}

/** The first transcribed base of a gene, in genomic coordinates. */
export function firstTranscribedBase(gene) {
  const [first] = transcriptionPieces(gene);
  if (!first) return null;
  return gene.strand === '-' ? first.high : first.low;
}

/**
 * Genomic position of an upstream offset, wrapping at the replicon origin.
 * Every replicon is circular, so base −1 of a gene starting at base 1 is the
 * replicon's last base. Null when the replicon length is unknown.
 */
export function upstreamPosition(gene, offset, length = repliconLength(gene.seqid)) {
  const anchor = firstTranscribedBase(gene);
  if (!(length > 0) || !(offset < 0) || anchor === null) return null;
  const raw = gene.strand === '-' ? anchor - offset : anchor + offset;
  return ((raw - 1) % length + length) % length + 1;
}

/**
 * Splice junctions as the CDS offset that begins each later piece, with the
 * number of genomic bases skipped before it: zero where the join is only the
 * circular origin.
 */
export function junctionsOf(gene) {
  const junctions = [];
  let offset = 0;
  for (const [i, piece] of transcriptionPieces(gene).entries()) {
    if (i > 0) junctions.push({ atOffset: offset, gapNt: piece.gapBefore, bases: null });
    offset += piece.high - piece.low + 1;
  }
  return junctions;
}

/**
 * The upstream context, and any junction bases the start window happens to
 * contain, read from either `rnaContext` form.
 *
 * The `upstream` form is the 30 bases before the start, already in
 * transcription orientation. The `sequence` form is the [-30,60) genomic window
 * with a CDS offset per base, or -1 outside this gene; its first 30 bases are
 * the upstream context only when base 30 is the start, and a run of -1 between
 * two consecutive CDS offsets is the genomic gap of a junction. Any other shape
 * yields no upstream rather than a guess.
 */
export function upstreamContext(gene, junctions, requestedNt = UPSTREAM_CONTEXT_NT) {
  const context = gene.rnaContext;
  if (!context || typeof context !== 'object') return null;
  const available = availableUpstreamNt(gene);
  const length = Number.isInteger(requestedNt) && requestedNt > 0
    ? Math.min(requestedNt, available) : 0;
  if (length === 0) return null;
  const expanded = gene.extendedUpstream;
  const selected = typeof expanded === 'string' && expanded.length >= length
    ? expanded.slice(-length) : null;
  if (context.upstream !== undefined) {
    return selected ?? (isDna(context.upstream, UPSTREAM_CONTEXT_NT)
      ? context.upstream.slice(-length) : null);
  }
  const { sequence, cdsOffsets } = context;
  if (!isDna(sequence, 90) || !Array.isArray(cdsOffsets) || cdsOffsets.length !== 90) return null;
  const upstream = cdsOffsets[UPSTREAM_CONTEXT_NT] === 0
    && cdsOffsets.slice(0, UPSTREAM_CONTEXT_NT).every((offset) => offset === -1)
    ? sequence.slice(0, UPSTREAM_CONTEXT_NT)
    : null;
  // Gap bases: a run of -1 strictly between offset a and offset a + 1.
  let index = UPSTREAM_CONTEXT_NT;
  while (index < 90) {
    const offset = cdsOffsets[index];
    if (offset >= 0) {
      let end = index + 1;
      while (end < 90 && cdsOffsets[end] === -1) end += 1;
      if (end > index + 1 && end < 90 && cdsOffsets[end] === offset + 1) {
        const junction = junctions.find((entry) => entry.atOffset === offset + 1);
        if (junction && junction.gapNt === end - index - 1) {
          junction.bases = sequence.slice(index + 1, end);
        }
      }
      index = end;
    } else {
      index += 1;
    }
  }
  return selected ?? (upstream ? upstream.slice(-length) : null);
}

/**
 * A complete, renderer-agnostic description of one gene's readable sequence.
 *
 * @param {object} gene a `genes.json` record.
 * @param {import('./codon-table.js').CodonTable} table the dataset's codon table.
 * @param {{active: boolean, replacement: Uint8Array}|null} scheme the compiled
 *   recoding scheme, or null for the original sequence alone.
 * @returns {object|null} null when the record has no packed sequence.
 */
export function geneSequenceModel(gene, table, scheme = null, {
  upstreamNt = UPSTREAM_CONTEXT_NT,
} = {}) {
  if (!gene || typeof gene.codons !== 'string' || gene.codons.length === 0 || !table) return null;
  if (!Number.isFinite(gene.start) || !Number.isFinite(gene.end)) return null;
  let indices;
  try {
    indices = table.decode(gene.codons);
  } catch {
    return null;
  }
  const stopIndex = table.indexOf(gene.terminalStop);
  const hasStop = stopIndex >= 0 && table.isStop[stopIndex] === 1;
  const codonCount = indices.length + (hasStop ? 1 : 0);
  const cdsLengthNt = codonCount * 3;
  const active = Boolean(scheme?.active) && scheme.rotation instanceof Uint8Array;
  const positions = genomicPositions(gene, cdsLengthNt);
  const junctions = junctionsOf(gene);
  const upstream = upstreamContext(gene, junctions, upstreamNt);

  const codons = [];
  let changedCodons = 0;
  // Per-occurrence resolution over this gene, skipping the start triplet, which
  // is the rule the live metrics and the sequence export both follow. The drawn
  // recoded row has to be the sequence those numbers describe.
  const occurrences = occurrenceCounter();
  const codonAt = (index, sequenceIndex, kind) => {
    const codon = table.codons[sequenceIndex];
    let replacementIndex = sequenceIndex;
    if (active && kind !== 'start') {
      replacementIndex = replacementAt(scheme, sequenceIndex, occurrences[sequenceIndex]);
      occurrences[sequenceIndex] += 1;
    }
    const recoded = active ? table.codons[replacementIndex] : null;
    const changed = active && replacementIndex !== sequenceIndex;
    if (changed) changedCodons += 1;
    const aa = kind === 'start' ? 'M' : table.aas[sequenceIndex];
    const offset = index * 3;
    return {
      index,
      offset,
      codon,
      aa,
      aaName: AMINO_ACID_NAMES[aa] ?? aa,
      kind,
      recoded,
      changed,
      positions: positions ? positions.slice(offset, offset + 3) : null,
    };
  };
  for (let i = 0; i < indices.length; i += 1) {
    codons.push(codonAt(i, indices[i], i === 0 ? 'start' : 'sense'));
  }
  if (hasStop) codons.push(codonAt(indices.length, stopIndex, 'stop'));

  const upstreamBases = upstream
    ? [...upstream].map((base, i) => {
      const offset = i - upstream.length;
      return { offset, base, position: upstreamPosition(gene, offset) };
    })
    : [];

  return {
    id: gene.id,
    name: gene.name ?? null,
    product: gene.product ?? null,
    replicon: gene.seqid ?? null,
    strand: gene.strand === '-' ? '-' : '+',
    start: gene.start,
    end: gene.end,
    lengthNt: Number.isFinite(gene.lengthNt) ? gene.lengthNt : cdsLengthNt,
    lengthCodons: indices.length,
    cdsLengthNt,
    terminalStop: hasStop ? gene.terminalStop : null,
    startCodon: codons[0].codon,
    nonStandardStart: codons[0].codon !== 'ATG',
    translationalException: gene.translationalException ?? null,
    spliced: junctions.length > 0,
    junctions,
    upstream: upstreamBases,
    codons,
    protein: codons.filter((entry) => entry.kind !== 'stop').map((entry) => entry.aa).join(''),
    coordinatesKnown: positions !== null,
    scheme: {
      active,
      changedCodons,
      stopChanged: hasStop && codons[codons.length - 1].changed,
    },
    domain: { min: upstreamBases.length > 0 ? -upstreamBases.length : 0, max: cdsLengthNt },
  };
}

/**
 * The displayed column of every genomic position this strip actually shows.
 *
 * Built from the model's own position tables rather than from arithmetic over
 * the gene's start, so a minus-strand gene, a spliced CDS, an origin-crossing
 * one and a gene whose upstream context the release does not ship are all
 * handled by the same lookup: a position is on this strip exactly when the
 * strip has a base at it. A gene whose segments do not add up to its coding
 * length has no coordinates at all (`coordinatesKnown` false), and so
 * contributes no coding columns — the strip would otherwise label a base with
 * a position it cannot stand behind.
 *
 * Coding columns are written after the upstream ones, so a coding base wins
 * the pathological case of a replicon short enough for the 30 upstream bases
 * to wrap into the gene itself: the base belongs to the gene's own sequence.
 *
 * @returns {Map<number, number>} genomic position to CDS offset.
 */
export function sequenceColumns(model) {
  const columns = new Map();
  if (!model) return columns;
  for (const base of model.upstream) {
    if (Number.isFinite(base.position)) columns.set(base.position, base.offset);
  }
  for (const codon of model.codons) {
    if (!codon.positions) continue;
    for (const [k, position] of codon.positions.entries()) {
      if (Number.isFinite(position)) columns.set(position, codon.offset + k);
    }
  }
  return columns;
}

/** Contiguous runs over ascending offsets, the shape every placed track takes. */
function runsOf(offsets) {
  const runs = [];
  for (const offset of offsets) {
    const last = runs[runs.length - 1];
    if (last && offset <= last.toOffset + 1) last.toOffset = Math.max(last.toOffset, offset);
    else runs.push({ fromOffset: offset, toOffset: offset });
  }
  return runs.map((run) => ({ ...run, shownNt: run.toOffset - run.fromOffset + 1 }));
}

/**
 * Where one marker lands on this strip, from its **native genomic coordinate
 * and nothing else**.
 *
 * This is the whole point of marking the close-up. A distance published
 * against another study's gene model is evidence about that model; using it
 * here would put a base-resolution mark on a letter the source never named,
 * because this release's annotated start can differ from the paper's. So the
 * strip places a marker only where it has a base at the marker's own published
 * coordinate, and a marker with no such base keeps an explicit unplaceable
 * state instead of being moved to one.
 *
 * An interval is placed over however many of its bases this strip shows, and
 * says when that is fewer than it covers. A point is placed or it is not.
 *
 * `runs` is the authority for what may be drawn: the contiguous stretches of
 * columns the marker actually covers, in ascending order. `fromOffset` and
 * `toOffset` are only the envelope around them, kept for the window and
 * crowding tests that ask where a mark roughly is. The two differ whenever the
 * covered columns are disjoint — an interval running across the circular
 * origin of a replicon this strip shows twice over, for one — and drawing the
 * envelope there would outline bases the source never covered.
 *
 * @param {object} model the sequence model of the gene on screen.
 * @param {object} marker a shared marker record.
 * @param {Map<number, number>} [columns] from {@link sequenceColumns}.
 * @returns {{status: string, reason: string|null, fromOffset: number|null,
 *   toOffset: number|null, shownNt: number, spanNt: number|null,
 *   runs: {fromOffset: number, toOffset: number, shownNt: number}[]}}
 */
export function markerPlacement(model, marker, columns = sequenceColumns(model)) {
  const unplaceable = (reason) => ({
    status: 'unplaceable',
    reason,
    fromOffset: null,
    toOffset: null,
    shownNt: 0,
    spanNt: null,
    runs: [],
  });
  if (!model || !marker) return unplaceable('no-native-coordinate');
  if (marker.coordinateStatus !== 'mapped') return unplaceable('no-native-coordinate');
  if (!sameReplicon(marker.replicon, model.replicon)) return unplaceable('other-replicon');
  const spanNt = markerSpanNt(marker);
  if (marker.geometry !== 'interval') {
    const offset = columns.get(marker.position);
    if (offset === undefined) return unplaceable('outside-shown-sequence');
    return {
      status: 'placed',
      reason: null,
      fromOffset: offset,
      toOffset: offset,
      shownNt: 1,
      spanNt,
      runs: [{ fromOffset: offset, toOffset: offset, shownNt: 1 }],
    };
  }
  // Walked over the strip's columns rather than the interval's bases: the
  // strip has at most a few thousand of them whatever the interval's length,
  // and the membership test is the shared one, so an interval that runs across
  // the circular origin needs no second rule here.
  const covered = [];
  for (const [position, offset] of columns) {
    if (markerCoversPosition(marker, position)) covered.push(offset);
  }
  if (covered.length === 0) return unplaceable('outside-shown-sequence');
  // Sorted rather than trusted: the column map is built upstream-first and a
  // run has to be contiguous in the order the strip draws, whatever order the
  // positions arrived in.
  covered.sort((a, b) => a - b);
  return {
    status: 'placed',
    reason: null,
    fromOffset: covered[0],
    toOffset: covered[covered.length - 1],
    shownNt: covered.length,
    spanNt,
    runs: runsOf(covered),
  };
}

/**
 * The covered stretches of one placement, as a reader reads them: a single
 * range for the ordinary case, and every stretch named where they are disjoint
 * so no sentence implies the bases between them are covered.
 */
export function placementRangesText(placement) {
  const runs = placement?.runs ?? [];
  if (runs.length === 0) return '';
  const ranges = runs.map((run) => (run.fromOffset === run.toOffset
    ? signedOffset(run.fromOffset)
    : `${signedOffset(run.fromOffset)} to ${signedOffset(run.toOffset)}`));
  if (ranges.length === 1) return ranges[0];
  return `${ranges.slice(0, -1).join(', ')} and ${ranges[ranges.length - 1]}`;
}

/**
 * Every marker row one layer publishes for this gene, with where this strip
 * puts it and where the gene visualizer puts it.
 *
 * Built from {@link tssSiteRows}, so no source row and no identifier is lost
 * on the way here and the two views read one representation. What this adds is
 * the strip's own placement and, beside it, the offset the published
 * source-gene-model distance implies — the basis the small gene visualizer
 * draws. Both are carried and neither is substituted for the other;
 * `basisGapNt` is how far apart the two bases put the same site, and the
 * column placement is the authority for what this strip draws. It is null
 * where there is no comparison to make — a row this strip cannot place, or a
 * row that publishes no distance — which is never the same as a gap of zero.
 *
 * Ordered by the column the strip draws at, then by the order the source
 * published the rows it cannot place; `sort` is stable, so that order holds.
 */
export function sequenceMarkers(gene, model) {
  if (!model) return [];
  const columns = sequenceColumns(model);
  return tssSiteRows(gene)
    .map((row) => {
      const placement = markerPlacement(model, row, columns);
      const basisGapNt = placement.status === 'placed' && row.offset !== null
        ? Math.abs(placement.fromOffset - row.offset) : null;
      return { ...row, placement, sourceOffset: row.offset, basisGapNt };
    })
    .sort((a, b) => {
      const placed = (row) => row.placement.status === 'placed';
      if (placed(a) !== placed(b)) return placed(a) ? -1 : 1;
      return placed(a) ? a.placement.fromOffset - b.placement.fromOffset : 0;
    });
}

/** Whether a canonical segment list occupies one genomic base. */
function occupies(segments, position) {
  return segments.some((piece) => position >= piece.from && position <= piece.to);
}

/** The exact native base this sequence model draws at one offset, or null. */
export function nativeBaseAtOffset(model, offset) {
  if (!model || !Number.isInteger(offset)) return null;
  if (offset < 0) {
    return model.upstream.find((entry) => entry.offset === offset)?.base ?? null;
  }
  const codon = model.codons[Math.floor(offset / 3)];
  if (!codon || typeof codon.codon !== 'string') return null;
  return codon.codon[offset - codon.offset] ?? null;
}

/** Watson-Crick complement of one unambiguous DNA base, or null. */
export function complementBase(base) {
  return ({ A: 'T', C: 'G', G: 'C', T: 'A' })[base] ?? null;
}

/**
 * Actual shared bases aligned in this gene's transcription-oriented columns.
 *
 * The selected row is the native sequence already carried by `genes.json`.
 * A same-strand partner reads the same letters; an opposite-strand partner
 * reads their complements and therefore runs 3′ to 5′ from left to right.
 * An unrecorded strand stays explicitly unknown. No base is reconstructed from
 * an identifier, colour, or coordinate alone.
 */
export function alignedPartnerBases(model, partner, columns = sequenceColumns(model)) {
  const orientation = partner?.relation === 'same'
    ? { left: '5′', right: '3′' }
    : partner?.relation === 'opposite'
      ? { left: '3′', right: '5′' }
      : { left: '?', right: '?' };
  if (!model || !partner || !Array.isArray(partner.sharedIntervals)) {
    return { status: 'sequence-unavailable', orientation, cells: [], runs: [] };
  }
  const cells = [];
  for (const [position, offset] of columns) {
    if (!occupies(partner.sharedIntervals, position)) continue;
    const selectedBase = nativeBaseAtOffset(model, offset);
    const partnerBase = partner.relation === 'same' ? selectedBase
      : partner.relation === 'opposite' ? complementBase(selectedBase) : null;
    cells.push({ position, offset, selectedBase, partnerBase });
  }
  cells.sort((a, b) => a.offset - b.offset);
  const lengthBp = repliconLength(model.replicon);
  const nextGenomicPosition = (position) => {
    const raw = model.strand === '-' ? position - 1 : position + 1;
    if (!(lengthBp > 0)) return raw;
    return ((raw - 1) % lengthBp + lengthBp) % lengthBp + 1;
  };
  const runs = [];
  for (const cell of cells) {
    const last = runs[runs.length - 1];
    // Consecutive strip columns are not necessarily consecutive genomic bases:
    // a split CDS places the two exons side by side. Keep that junction visible
    // instead of describing the gap as one exact genomic run. Circular-origin
    // joins remain contiguous because the expected position wraps at the known
    // replicon length.
    if (last && cell.offset === last.toOffset + 1
      && cell.position === nextGenomicPosition(last.toPosition)) {
      last.toOffset = cell.offset;
      last.toPosition = cell.position;
      last.selected += cell.selectedBase ?? '?';
      last.partner += cell.partnerBase ?? '?';
    } else {
      runs.push({
        fromOffset: cell.offset,
        toOffset: cell.offset,
        fromPosition: cell.position,
        toPosition: cell.position,
        selected: cell.selectedBase ?? '?',
        partner: cell.partnerBase ?? '?',
      });
    }
  }
  const status = partner.relation === 'unknown' ? 'strand-unrecorded'
    : cells.length === 0 || cells.some((cell) => !cell.selectedBase || !cell.partnerBase)
      ? 'sequence-unavailable' : 'available';
  return { status, orientation, cells, runs };
}

/**
 * Overlapping partners aligned onto this strip's own columns.
 *
 * A partner is placed from its **own annotated segments and nothing else**, by
 * the same rule a marker is: it is drawn on the letters whose genomic
 * coordinates it really occupies, so the partner track and the base row cannot
 * disagree about which base is shared. The bases the two genes share are
 * placed separately, as `sharedRuns`, because a partner that merely runs
 * alongside this gene past a junction occupies columns it does not share.
 *
 * Edge continuation is answered in genomic coordinates, not from the drawn
 * runs: the partner continues past the start of what is drawn when it occupies
 * the base one step before the first placed column in *this gene's*
 * transcription direction, and past the end when it occupies the base one step
 * after the last. Both can hold at once, which is exactly a partner this gene
 * lies inside. The step is taken around the replicon, so a partner continuing
 * across the circular origin is not reported as ending there.
 *
 * @param {object} model from {@link geneSequenceModel}.
 * @param {object[]} partners from `core/gene-overlaps.js`, widest first.
 * @param {Map<number, number>} [columns] from {@link sequenceColumns}.
 */
export function partnerPlacements(model, partners, columns = sequenceColumns(model)) {
  if (!model || !Array.isArray(partners) || partners.length === 0) return [];
  const lengthBp = repliconLength(model.replicon);
  const step = (position, forward) => {
    const raw = model.strand === '-' ? (forward ? position - 1 : position + 1)
      : (forward ? position + 1 : position - 1);
    if (!(lengthBp > 0)) return raw;
    return ((raw - 1) % lengthBp + lengthBp) % lengthBp + 1;
  };
  const offsetToPosition = new Map();
  for (const [position, offset] of columns) offsetToPosition.set(offset, position);
  return partners.map((partner) => {
    const covered = [];
    const shared = [];
    for (const [position, offset] of columns) {
      if (occupies(partner.segments, position)) covered.push(offset);
      if (occupies(partner.sharedIntervals, position)) shared.push(offset);
    }
    covered.sort((a, b) => a - b);
    shared.sort((a, b) => a - b);
    const runs = runsOf(covered);
    const partnerNt = partner.segments
      .reduce((total, piece) => total + (piece.to - piece.from + 1), 0);
    const firstPosition = covered.length > 0 ? offsetToPosition.get(covered[0]) : null;
    const lastPosition = covered.length > 0
      ? offsetToPosition.get(covered[covered.length - 1]) : null;
    const alignment = alignedPartnerBases(model, partner, columns);
    return {
      id: partner.id,
      name: partner.name ?? null,
      biotype: partner.biotype,
      strand: partner.strand,
      relation: partner.relation,
      containment: partner.containment,
      selectable: partner.selectable,
      geneIndex: partner.geneIndex,
      sharedBases: partner.sharedBases,
      segments: partner.segments,
      sharedIntervals: partner.sharedIntervals,
      status: covered.length > 0 ? 'placed' : 'outside-shown-sequence',
      runs,
      sharedRuns: runsOf(shared),
      alignment,
      shownNt: covered.length,
      partnerNt,
      continuesBefore: firstPosition !== null
        && occupies(partner.segments, step(firstPosition, false)),
      continuesAfter: lastPosition !== null
        && occupies(partner.segments, step(lastPosition, true)),
    };
  });
}

/** The codon that holds a CDS offset, or null outside the coding sequence. */
export function codonAtOffset(model, offset) {
  if (!model || !(offset >= 0) || offset >= model.cdsLengthNt) return null;
  return model.codons[Math.floor(offset / 3)] ?? null;
}

/** Signed nucleotide offset the way the rows label it: −30, start, +12. */
export function signedOffset(offset) {
  if (offset === 0) return 'start';
  const text = Math.abs(offset).toLocaleString('en-US');
  return offset > 0 ? `+${text}` : `−${text}`;
}

/** The rows named by their own identifiers, for a sentence about some of them. */
function names(rows) {
  const ids = rows.map((row) => row.id ?? 'an unidentified row');
  if (ids.length === 1) return ids[0];
  return `${ids.slice(0, -1).join(', ')} and ${ids[ids.length - 1]}`;
}

/** `n site` / `n sites`, with the label the organism's record gives the study. */
function siteCount(count, label) {
  return `${count.toLocaleString('en-US')} ${label} start site${count === 1 ? '' : 's'}`;
}

/**
 * What this strip is doing about one marker layer, in sentences.
 *
 * Six states, kept apart because an empty marker row would otherwise read as a
 * locus with no start site: the organism publishes no such layer and nothing
 * is said; the file has not landed or failed; it landed and no row maps to
 * this locus; rows map and are drawn; rows map and the reader has hidden them;
 * and rows map but none of their published coordinates is a base this strip
 * shows, which is neither absence nor a hidden mark.
 *
 * The placement basis is stated wherever a mark is drawn. A mark here sits on
 * the base its source published a coordinate for, which is not in general the
 * base the small gene visualizer draws it at: that view uses the distance the
 * study published against its own gene model. Both are true of the same site,
 * and the sentence says so rather than choosing. Where a row carries only one
 * of the two mappings, that is said too: a missing distance is no comparison,
 * and must not be read out as the two views agreeing.
 *
 * @param {object} model the sequence model on screen.
 * @param {{label: string, controlLabel: string, rows: object[],
 *   visible: boolean, pending: 'loading'|'failed'|null}|null} marks the layer
 *   on screen, or null when the organism publishes none.
 */
export function describeSequenceMarkers(model, marks) {
  if (!model || !marks) return [];
  const { label, controlLabel, rows, visible, pending } = marks;
  if (pending) {
    return [pending === 'failed'
      ? `The ${label} start sites could not be loaded, so none is marked on the sequence.`
      : `The ${label} start sites are still loading, so none is marked on the sequence yet.`];
  }
  if (rows.length === 0) {
    return [`No ${label} start site maps to this locus by exact locus tag.`];
  }
  const placed = rows.filter((row) => row.placement.status === 'placed');
  const elsewhere = rows.length - placed.length;
  const listed = `${rows.length === 1 ? 'The one' : `All ${rows.length.toLocaleString('en-US')}`} `
    + `${label} start site${rows.length === 1 ? '' : 's'} published for this locus `
    + `${rows.length === 1 ? 'is' : 'are'} listed below the strip.`;
  if (placed.length === 0) {
    return [`${siteCount(rows.length, label)} ${rows.length === 1 ? 'is' : 'are'} published for `
      + `this locus, and ${rows.length === 1 ? 'its' : 'none of their'} published genome `
      + `coordinate${rows.length === 1 ? ' is not' : 's is'} a base this close-up shows, so no `
      + 'mark is drawn on the sequence. The sites are unchanged, and no mark is placed at a base '
      + 'their source did not report.', listed];
  }
  if (!visible) {
    return [`${siteCount(placed.length, label)} ${placed.length === 1 ? 'lands' : 'land'} on `
      + `${placed.length === 1 ? 'a base' : 'bases'} this close-up shows, and its `
      + `"${controlLabel}" control is off, so no mark is drawn for `
      + `${placed.length === 1 ? 'it' : 'them'}. The sites, this sequence, its coordinates and `
      + 'the window shown are unchanged.', listed];
  }
  const parts = [];
  const where = placed
    .map((row) => `${row.id ?? 'an unidentified row'} at ${signedOffset(row.placement.fromOffset)}`)
    .join(', ');
  parts.push(`${siteCount(placed.length, label)} ${placed.length === 1 ? 'is' : 'are'} marked on `
    + `the sequence at the base each one's own published genome coordinate names: ${where}.`);
  // Agreement is a claim about a comparison, so it is made only where there is
  // one: a row with no published distance has nothing to compare, and reading
  // its absent distance as "the same base" would invent the study's agreement
  // with an annotation it never saw.
  const comparable = placed.filter((row) => row.basisGapNt !== null);
  const apart = comparable.filter((row) => row.basisGapNt > 0);
  const together = comparable.filter((row) => row.basisGapNt === 0);
  const unmatched = placed.filter((row) => row.basisGapNt === null);
  if (apart.length > 0) {
    parts.push(`The gene visualizer draws ${apart.length === 1 ? 'that site' : 'those sites'} `
      + `against the distance the study published for its own gene model instead, `
      + `${apart.length === 1 ? 'which is' : 'which are'} `
      + `${apart.map((row) => `${row.basisGapNt.toLocaleString('en-US')} nt away for ${row.id}`).join(', ')}. `
      + 'Both coordinates are the source\'s own; which one a construct boundary should follow is '
      + 'for the lab to decide.');
  }
  if (together.length > 0) {
    const all = together.length === placed.length;
    const one = together.length === 1;
    parts.push(`The distance the study published against its own gene model puts `
      + `${all ? (one ? 'it' : 'each of them') : names(together)} at the same base, so `
      + `${all ? (one ? 'this placement' : 'these placements') : (one ? 'that placement' : 'those placements')} `
      + 'and the gene visualizer\'s agree.');
  }
  if (unmatched.length > 0) {
    parts.push(`${unmatched.length === placed.length
      ? (placed.length === 1 ? 'That site' : 'Those sites')
      : names(unmatched)} ${unmatched.length === 1 ? 'has' : 'have'} no distance published `
      + 'against the study\'s own gene model, so the gene visualizer draws no mark for '
      + `${unmatched.length === 1 ? 'it' : 'them'} and there is nothing to compare this `
      + `${unmatched.length === 1 ? 'placement' : 'placements'} with. The `
      + `${unmatched.length === 1 ? 'row is' : 'rows are'} kept as published, and no distance `
      + 'is derived from the coordinate to stand in for one.');
  }
  if (marks.crowded > 1) {
    parts.push(`${marks.crowded.toLocaleString('en-US')} of those marks share drawn space at this `
      + 'zoom, so their heads are not separately readable; zoom in to separate them, and each '
      + 'one keeps its own nucleotide offset in the list below. Sharing drawn space is where '
      + 'this zoom puts the heads, not one site and not continuous evidence.');
  }
  if (elsewhere > 0) {
    parts.push(`${elsewhere.toLocaleString('en-US')} further published `
      + `${elsewhere === 1 ? 'row has a coordinate that is not' : 'rows have coordinates that are not'} `
      + 'a base this close-up shows, so no mark is drawn for '
      + `${elsewhere === 1 ? 'it' : 'them'}.`);
  }
  parts.push(listed);
  return parts;
}

/**
 * One paragraph naming what the close-up shows, for its accessible description.
 * The visible strip is a picture; this is its text equivalent.
 */
/**
 * The overlapping-gene sentences for the close-up's description.
 *
 * A reader who is not looking at the picture has to be able to tell the three
 * states apart: the layer has not been read, it was read and this gene shares
 * no base with another annotated gene, or these partners are drawn on these
 * coordinates. `null` is the first, an empty summary the second.
 */
export function describeSequencePartners(partners) {
  if (partners === null || partners === undefined) {
    return ['The overlapping-gene layer has not been read, so no partner track is drawn. '
      + 'That is not an absence of overlapping genes.'];
  }
  if (partners.total === 0) {
    return ['No annotated gene of this release shares a base with this one on its replicon, so '
      + 'there is no partner track to draw. Every annotated gene was compared, tRNA, rRNA and '
      + 'pseudogene rows included.'];
  }
  const parts = [];
  const drawn = partners.drawn ?? [];
  const named = drawn.map((partner) => {
    const relation = partner.relation === 'same' ? 'same strand'
      : partner.relation === 'opposite' ? 'opposite strand' : 'strand not recorded';
    return `${partner.id} (${relation}, ${partner.sharedBases.toLocaleString('en-US')} shared `
      + `base${partner.sharedBases === 1 ? '' : 's'}`
      + `${partner.continues ? ', continuing past the drawn window' : ''}`
      + `${partner.selectable ? '' : ', not plotted on this map'})`;
  }).join('; ');
  parts.push(`${partners.total.toLocaleString('en-US')} annotated `
    + `gene${partners.total === 1 ? '' : 's'} overlap${partners.total === 1 ? 's' : ''} this one, `
    + `each drawn as its own track beneath the sequence on the same coordinates: ${named}. `
    + 'A solid stretch is a base the two genes share and an arrow gives the partner\u2019s '
    + 'reading direction.');
  if (partners.notDrawn > 0) {
    parts.push(`${partners.notDrawn.toLocaleString('en-US')} further `
      + `partner${partners.notDrawn === 1 ? '' : 's'} are listed below rather than drawn.`);
  }
  if (partners.outsideShown > 0) {
    parts.push(`${partners.outsideShown.toLocaleString('en-US')} of them occupy no base this `
      + 'close-up shows.');
  }
  return parts;
}

export function describeGeneSequence(model, window = null, marks = null, partners = null) {
  if (!model) return 'No gene is pinned.';
  const identity = model.name ? `${model.id} ${model.name}` : model.id;
  const parts = [];
  parts.push(`${identity} on the ${model.strand === '-' ? 'minus' : 'plus'} strand of `
    + `${model.replicon ?? 'its replicon'}: ${model.lengthCodons.toLocaleString('en-US')} sense `
    + `codons${model.terminalStop ? ` and the terminal stop ${model.terminalStop}` : ''}, read in `
    + 'transcription orientation from the annotated start.');
  parts.push(`Initiation triplet ${model.startCodon}, translated as methionine`
    + `${model.nonStandardStart ? ' although it is not ATG' : ''}.`);
  if (model.upstream.length > 0) {
    parts.push(`${model.upstream.length} upstream bases precede it.`);
  } else {
    parts.push('No upstream context is shipped for this gene.');
  }
  if (model.spliced) {
    const gaps = model.junctions.map((junction) => `${junction.gapNt.toLocaleString('en-US')} nt `
      + `before offset ${junction.atOffset.toLocaleString('en-US')}`).join(', ');
    parts.push(`The coding sequence is a join of ${model.junctions.length + 1} genomic segments, `
      + `skipping ${gaps}.`);
  }
  if (model.translationalException) {
    parts.push(`Translational exception: ${model.translationalException.replace(/_/g, ' ')}.`);
  }
  if (!model.coordinatesKnown) {
    parts.push('Genomic coordinates are not shown because the annotated segments do not add up '
      + 'to the coding length.');
  }
  if (model.scheme.active) {
    parts.push(model.scheme.changedCodons === 0
      ? 'The active recoding scheme changes no codon in this gene.'
      : `The active recoding scheme changes ${model.scheme.changedCodons.toLocaleString('en-US')} `
        + `codon${model.scheme.changedCodons === 1 ? '' : 's'}`
        + `${model.scheme.stopChanged ? ', including the terminal stop' : ''}.`);
  }
  parts.push(...describeSequenceMarkers(model, marks));
  parts.push(...describeSequencePartners(partners));
  if (window) {
    parts.push(`Showing nucleotides ${signedOffset(window.from)} to ${signedOffset(window.to)}.`);
  }
  return parts.join(' ');
}

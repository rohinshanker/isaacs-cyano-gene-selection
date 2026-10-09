import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  geneViewModel, orientedSegments, paddedHitRange, transcriptionPieces, tssMarks, fractionOf,
  tickStep, ticksFor,
  UPSTREAM_CONTEXT_NT,
} from '../../site/js/core/gene-view-model.js';

const plusGene = {
  id: 'M744_RS00025',
  name: null,
  product: 'YheT family hydrolase',
  seqid: 'NZ_CP006471.1',
  strand: '+',
  start: 4314,
  end: 5318,
  lengthNt: 1005,
  lengthCodons: 334,
  terminalStop: 'TGA',
  cdsSegments: null,
  translationalException: null,
};

const minusGene = { ...plusGene, id: 'M744_RS00030', strand: '-' };

test('a plus-strand gene starts at offset zero and runs to its length', () => {
  const segments = orientedSegments(plusGene);
  assert.equal(segments.length, 1);
  assert.equal(segments[0].from, 0);
  assert.equal(segments[0].to, 1004);
});

test('a minus-strand gene reads the same way, measured from its own first base', () => {
  // The gene's `end` is its first transcribed base on the minus strand, so the
  // drawn track must start there. Reading the record left to right instead
  // would draw the gene backwards.
  const segments = orientedSegments(minusGene);
  assert.equal(segments[0].from, 0);
  assert.equal(segments[0].to, 1004);
});

test('a spliced gene keeps its gap instead of being drawn as one bar', () => {
  const spliced = {
    ...plusGene,
    id: 'M744_RS00920',
    start: 169621,
    end: 170743,
    cdsSegments: [[169621, 169692], [169694, 170743]],
    translationalException: 'ribosomal_slippage',
  };
  const segments = orientedSegments(spliced);
  assert.equal(segments.length, 2);
  assert.deepEqual(segments[0], { from: 0, to: 71 });
  assert.deepEqual(segments[1], { from: 73, to: 1122 });
  const model = geneViewModel(spliced);
  assert.ok(model.spliced);
  assert.equal(model.translationalException, 'ribosomal_slippage');
});

test('a spliced minus-strand gene still runs in transcription order', () => {
  const spliced = {
    ...minusGene, start: 1000, end: 1099, cdsSegments: [[1000, 1029], [1040, 1099]],
  };
  const segments = orientedSegments(spliced);
  assert.deepEqual(segments[0], { from: 0, to: 59 });
  assert.deepEqual(segments[1], { from: 70, to: 99 });
});

test('the initiation triplet and terminal stop are marked at the track ends', () => {
  const model = geneViewModel(plusGene);
  const start = model.codons.find((codon) => codon.kind === 'start');
  const stop = model.codons.find((codon) => codon.kind === 'stop');
  assert.deepEqual([start.from, start.to], [0, 3]);
  assert.deepEqual([stop.from, stop.to], [1001, 1004]);
  assert.match(stop.label, /TGA/);
});

test('a gene with no recorded terminal stop gets no stop mark', () => {
  const model = geneViewModel({ ...plusGene, terminalStop: null });
  assert.equal(model.codons.filter((codon) => codon.kind === 'stop').length, 0);
});

test('start sites are drawn upstream at the distances the source published', () => {
  const gene = {
    ...plusGene,
    tssEvidence: [
      { id: 'gTSS+2', sourceStartDistanceNt: 61, strand: '+', position: 4253, replicon: 'CP006471' },
      { id: 'gTSS+1', sourceStartDistanceNt: 614, strand: '+', position: 3700, replicon: 'CP006471' },
      { id: 'gTSS+3', sourceStartDistanceNt: null },
    ],
  };
  const marks = tssMarks(gene);
  assert.deepEqual(marks.map((mark) => mark.offset), [-614, -61]);
  assert.equal(marks.length, 2, 'a site with no published distance has nowhere to be drawn');
  // The published coordinate implies its own distance against this release's
  // start (4314): 614 agrees exactly, 61 is placed 4253, i.e. 61 nt, so both agree.
  assert.deepEqual(marks.map((mark) => [mark.impliedDistanceNt, mark.placementGapNt]), [[614, 0], [61, 0]]);
  const moved = tssMarks({ ...gene, tssEvidence: [
    { id: 'gTSS+4', sourceStartDistanceNt: 22, strand: '+', position: 4460, replicon: 'CP006471' },
    { id: 'gTSS+5', sourceStartDistanceNt: 10, strand: '+', position: null },
  ] });
  assert.deepEqual(moved.map((mark) => [mark.impliedDistanceNt, mark.placementGapNt]),
    [[-146, 168], [null, null]], 'a coordinate inside the CDS implies a negative distance');
  const minus = tssMarks({ ...gene, strand: '-', start: 1000, end: 2000, tssEvidence: [
    { id: 'gTSS-1', sourceStartDistanceNt: 50, strand: '-', position: 2060, replicon: 'CP006471' },
  ] });
  assert.deepEqual([minus[0].impliedDistanceNt, minus[0].placementGapNt], [60, 10]);
  const model = geneViewModel(gene);
  assert.equal(model.domain.min, -614, 'the domain widens to hold the furthest site');
});

test('a gene with no start-site evidence still shows upstream context', () => {
  const model = geneViewModel(plusGene);
  assert.equal(model.tss.length, 0);
  assert.ok(model.domain.min <= -UPSTREAM_CONTEXT_NT);
  assert.ok(model.domain.max > 1004, 'the stop codon is not flush against the edge');
});

test('a record with no coordinates draws nothing rather than guessing', () => {
  assert.equal(geneViewModel(null), null);
  assert.equal(geneViewModel({ id: 'x', start: null, end: 10 }), null);
});

test('offsets map into the track and clamp at its edges', () => {
  const domain = { min: -100, max: 100 };
  assert.equal(fractionOf(domain, -100), 0);
  assert.equal(fractionOf(domain, 0), 0.5);
  assert.equal(fractionOf(domain, 100), 1);
  assert.equal(fractionOf(domain, 500), 1);
  assert.equal(fractionOf(domain, -500), 0);
  assert.equal(fractionOf({ min: 0, max: 0 }, 5), 0, 'an empty domain divides by nothing');
});

test('the ruler steps in ones, twos and fives, and always marks the start', () => {
  assert.equal(tickStep({ min: 0, max: 1000 }, 5), 200);
  assert.equal(tickStep({ min: 0, max: 100 }, 4), 50);
  assert.ok(ticksFor({ min: -60, max: 1040 }, 4).includes(0));
  assert.ok(ticksFor({ min: -614, max: 1050 }, 4).includes(0));
});

test('interaction padding divides nearby targets without changing visible intervals', () => {
  const ranges = [{ from: 0, to: 6 }, { from: 8, to: 14 }];
  assert.deepEqual(paddedHitRange(ranges, 0, 5), { from: -5, to: 7 });
  assert.deepEqual(paddedHitRange(ranges, 1, 5), { from: 7, to: 19 });
  const overlap = [{ from: 2, to: 8 }, { from: 2, to: 8 }];
  assert.deepEqual(paddedHitRange(overlap, 0, 5), { from: -3, to: 13 },
    'exact overlaps retain paint-order precedence');
  assert.equal(paddedHitRange(ranges, 9, 5), null);
});

test('wide intervals share only the gap between edges with neighbouring targets', () => {
  assert.deepEqual(paddedHitRange([{ from: 0, to: 200 }, { from: 257, to: 263 }], 0, 5),
    { from: -5, to: 205 }, 'a distant point cannot take an interval edge padding');
  const near = [{ from: 0, to: 200 }, { from: 204, to: 210 }];
  assert.deepEqual(paddedHitRange(near, 0, 5), { from: -5, to: 202 });
  assert.deepEqual(paddedHitRange(near, 1, 5), { from: 202, to: 215 });
  assert.deepEqual(paddedHitRange([{ from: -8, to: -4 }, { from: 0, to: 200 }], 1, 5),
    { from: -2, to: 205 }, 'left gaps follow the same rule');
  assert.deepEqual(paddedHitRange([{ from: 0, to: 200 }, { from: 50, to: 60 }], 0, 5),
    { from: -5, to: 205 }, 'an interior mark cannot shrink the outer padding');
  assert.deepEqual(paddedHitRange([{ from: 0, to: 200 }, { from: -2, to: 5 },
    { from: 197, to: 203 }], 0, 5), { from: 0, to: 200 },
  'overlapping neighbours remove padding without shortening the visible interval');
});

test('invalid hit ranges and padding are rejected or ignored without changing valid geometry', () => {
  for (const range of [null, { from: NaN, to: 2 }, { from: 0, to: Infinity }, { from: 3, to: 2 }]) {
    assert.equal(paddedHitRange([range], 0, 5), null);
    assert.deepEqual(paddedHitRange([{ from: 0, to: 6 }, range], 0, 5), { from: -5, to: 11 });
  }
  for (const padding of [-1, NaN, Infinity]) {
    assert.equal(paddedHitRange([{ from: 0, to: 6 }], 0, padding), null);
  }
  assert.deepEqual(paddedHitRange([{ from: 0, to: 6 }], 0, 0), { from: 0, to: 6 });
});

test('an origin-crossing plus-strand gene is one short track, not the whole replicon', () => {
  // M744_RS13620: join(7830..7842,1..281) on the 7,842 bp plasmid. Its record
  // spans the entire replicon, so ordering its pieces by coordinate drew a
  // 294 nt gene across 7,842 nt.
  const wrap = {
    ...plusGene,
    id: 'M744_RS13620', seqid: 'NZ_CP006473.1', start: 1, end: 7842,
    lengthNt: 294, lengthCodons: 97, cdsSegments: [[7830, 7842], [1, 281]],
  };
  assert.deepEqual(transcriptionPieces(wrap), [
    { low: 7830, high: 7842, gapBefore: 0 },
    { low: 1, high: 281, gapBefore: 0 },
  ]);
  assert.deepEqual(orientedSegments(wrap), [{ from: 0, to: 12 }, { from: 13, to: 293 }]);
  const model = geneViewModel(wrap);
  assert.ok(model.spliced);
  assert.equal(model.domain.max < 400, true);
});

test('an origin-crossing minus-strand gene reads base 1\'s piece first', () => {
  // M744_RS13290: complement(join(45877..46366,1..2510)), transcribed from
  // 2,510 down to 1 and then from 46,366 down to 45,877.
  const wrap = {
    ...plusGene,
    id: 'M744_RS13290', seqid: 'NZ_CP006472.1', strand: '-', start: 1, end: 46366,
    lengthNt: 3000, lengthCodons: 999, cdsSegments: [[45877, 46366], [1, 2510]],
  };
  assert.deepEqual(transcriptionPieces(wrap), [
    { low: 1, high: 2510, gapBefore: 0 },
    { low: 45877, high: 46366, gapBefore: 0 },
  ]);
  assert.deepEqual(orientedSegments(wrap), [{ from: 0, to: 2509 }, { from: 2510, to: 2999 }]);
});

test('a spliced gene that merely touches base 1 is not a wrap', () => {
  const edge = {
    ...plusGene, seqid: 'NZ_CP006473.1', start: 1, end: 100,
    cdsSegments: [[1, 30], [41, 100]],
  };
  assert.deepEqual(transcriptionPieces(edge), [
    { low: 1, high: 30, gapBefore: 0 },
    { low: 41, high: 100, gapBefore: 10 },
  ]);
  const minus = { ...edge, strand: '-' };
  assert.deepEqual(transcriptionPieces(minus), [
    { low: 41, high: 100, gapBefore: 0 },
    { low: 1, high: 30, gapBefore: 10 },
  ]);
  assert.deepEqual(orientedSegments(minus), [{ from: 0, to: 59 }, { from: 70, to: 99 }]);
});

test('a gene on an unknown replicon still orders its pieces by coordinate', () => {
  const unknown = { ...plusGene, seqid: 'NZ_UNKNOWN.1', cdsSegments: [[4314, 4400], [4402, 5318]] };
  assert.deepEqual(orientedSegments(unknown), [{ from: 0, to: 86 }, { from: 88, to: 1004 }]);
  assert.deepEqual(transcriptionPieces({ ...plusGene, start: null, end: null }), []);
});

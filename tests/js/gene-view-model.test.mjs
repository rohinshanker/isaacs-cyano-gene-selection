import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  geneViewModel, orientedSegments, tssMarks, fractionOf, tickStep, ticksFor,
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

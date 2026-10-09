import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import {
  AMINO_ACID_NAMES, availableUpstreamNt, codonAtOffset, describeGeneSequence,
  firstTranscribedBase, geneSequenceModel, genomicPositions, junctionsOf, signedOffset,
  upstreamContext, upstreamPosition,
} from '../../site/js/core/gene-sequence-model.js';
import { compileScheme } from '../../site/js/core/scheme.js';
import { CodonTable } from '../../site/js/core/codon-table.js';
import { standardTable } from './helpers.mjs';

const table = standardTable();

/** Pack codon strings into the fixture alphabet. */
function pack(codons) {
  return table.encode(codons.map((codon) => table.indexOf(codon)));
}

const UPSTREAM = 'ACGTACGTACGTACGTACGTACGTACGTAC';

/** A plus-strand gene of eight sense codons and a stop, at chromosome base 1,001. */
function plusGene(overrides = {}) {
  const sense = ['ATG', 'GCT', 'TCG', 'AAA', 'GTG', 'TCA', 'TGG', 'CCC'];
  return {
    id: 'M744_RS00005',
    name: 'abcA',
    product: 'test protein',
    seqid: 'NZ_CP006471.1',
    strand: '+',
    start: 1001,
    end: 1027,
    lengthNt: 27,
    lengthCodons: 8,
    terminalStop: 'TAG',
    translationalException: null,
    cdsSegments: null,
    rnaContext: { upstream: UPSTREAM },
    codons: pack(sense),
    ...overrides,
  };
}

test('a plus-strand gene decodes its codons, appends the stop, and translates', () => {
  const model = geneSequenceModel(plusGene(), table);
  assert.equal(model.lengthCodons, 8);
  assert.equal(model.cdsLengthNt, 27);
  assert.equal(model.codons.length, 9);
  assert.equal(model.codons[0].kind, 'start');
  assert.equal(model.codons[0].aa, 'M');
  assert.equal(model.codons[1].codon, 'GCT');
  assert.equal(model.codons[1].aa, 'A');
  assert.equal(model.codons[1].aaName, 'Alanine');
  assert.equal(model.codons[8].kind, 'stop');
  assert.equal(model.codons[8].codon, 'TAG');
  assert.equal(model.codons[8].aa, '*');
  assert.equal(model.protein, 'MASKVSWP');
  assert.equal(model.terminalStop, 'TAG');
  assert.equal(model.startCodon, 'ATG');
  assert.equal(model.nonStandardStart, false);
  assert.equal(model.spliced, false);
  assert.equal(model.scheme.active, false);
  assert.deepEqual(model.domain, { min: -30, max: 27 });
  assert.deepEqual(model.codons[0].positions, [1001, 1002, 1003]);
  assert.deepEqual(model.codons[8].positions, [1025, 1026, 1027]);
  assert.ok(model.coordinatesKnown);
});

test('every residue letter has a name, and stop is named as stop', () => {
  for (const aa of new Set(table.aas)) assert.ok(AMINO_ACID_NAMES[aa], `${aa} has a name`);
  assert.equal(AMINO_ACID_NAMES['*'], 'Stop');
});

test('a non-ATG start still reads as methionine at position zero and says so', () => {
  const gene = plusGene({ codons: pack(['GTG', 'GCT', 'TCG', 'AAA', 'GTG', 'TCA', 'TGG', 'CCC']) });
  const model = geneSequenceModel(gene, table);
  assert.equal(model.codons[0].codon, 'GTG');
  assert.equal(model.codons[0].aa, 'M');
  assert.equal(model.codons[0].aaName, 'Methionine');
  assert.equal(model.nonStandardStart, true);
  // The later GTG is an ordinary valine.
  assert.equal(model.codons[4].aa, 'V');
  assert.match(describeGeneSequence(model), /Initiation triplet GTG, translated as methionine although it is not ATG/);
});

test('the upstream context reads in transcription orientation with genomic positions', () => {
  const model = geneSequenceModel(plusGene(), table);
  assert.equal(model.upstream.length, 30);
  assert.equal(model.upstream[0].offset, -30);
  assert.equal(model.upstream[0].base, 'A');
  assert.equal(model.upstream[0].position, 971);
  assert.equal(model.upstream[29].offset, -1);
  assert.equal(model.upstream[29].position, 1000);
});

test('an explicit sidecar extent expands the exact upstream window on request', () => {
  const extendedUpstream = `${'G'.repeat(30)}${UPSTREAM}`;
  const gene = plusGene({ extendedUpstream });
  assert.equal(availableUpstreamNt(gene), 60);
  const model = geneSequenceModel(gene, table, null, { upstreamNt: 60 });
  assert.equal(model.upstream.length, 60);
  assert.equal(model.upstream[0].offset, -60);
  assert.equal(model.upstream[0].base, 'G');
  assert.equal(model.upstream[59].offset, -1);
  assert.equal(model.upstream[59].base, UPSTREAM.at(-1));
  assert.deepEqual(model.domain, { min: -60, max: 27 });
  assert.equal(model.upstream[0].position, 941);

  assert.equal(availableUpstreamNt(plusGene({ extendedUpstream: `${'N'.repeat(30)}${UPSTREAM}` })), 30);
  assert.equal(availableUpstreamNt(plusGene({ rnaContext: null, extendedUpstream })), 0);
});

test('a minus-strand gene counts genomic positions downwards from its end', () => {
  const gene = plusGene({ strand: '-' });
  const model = geneSequenceModel(gene, table);
  assert.deepEqual(model.codons[0].positions, [1027, 1026, 1025]);
  assert.deepEqual(model.codons[8].positions, [1003, 1002, 1001]);
  assert.equal(model.upstream[29].position, 1028);
  assert.equal(model.upstream[0].position, 1057);
  assert.equal(firstTranscribedBase(gene), 1027);
});

test('a spliced gene keeps its junction, its gap, and skips the gap in its positions', () => {
  // 72 bases, a one-base gap, then the rest: the shape of M744_RS00920.
  const sense = Array.from({ length: 30 }, (_, i) => (i === 0 ? 'ATG' : 'GCT'));
  const gene = plusGene({
    start: 1001, end: 1094, lengthNt: 93, lengthCodons: 30,
    cdsSegments: [[1001, 1072], [1074, 1094]],
    translationalException: 'ribosomal_slippage',
    codons: pack(sense),
  });
  const model = geneSequenceModel(gene, table);
  assert.ok(model.spliced);
  assert.deepEqual(model.junctions, [{ atOffset: 72, gapNt: 1, bases: null }]);
  assert.deepEqual(model.codons[23].positions, [1070, 1071, 1072]);
  assert.deepEqual(model.codons[24].positions, [1074, 1075, 1076]);
  assert.match(describeGeneSequence(model), /join of 2 genomic segments, skipping 1 nt before offset 72/);
  assert.match(describeGeneSequence(model), /ribosomal slippage/);
});

test('an origin-crossing plus-strand gene continues from the last base to base 1', () => {
  // M744_RS13620: join(7830..7842,1..281) on the 7,842 bp plasmid.
  const sense = Array.from({ length: 97 }, (_, i) => (i === 0 ? 'ATG' : 'GCT'));
  const gene = plusGene({
    id: 'M744_RS13620', seqid: 'NZ_CP006473.1', start: 1, end: 7842,
    lengthNt: 294, lengthCodons: 97, cdsSegments: [[7830, 7842], [1, 281]], codons: pack(sense),
  });
  const model = geneSequenceModel(gene, table);
  assert.ok(model.coordinatesKnown);
  assert.deepEqual(model.codons[0].positions, [7830, 7831, 7832]);
  assert.deepEqual(model.codons[4].positions, [7842, 1, 2]);
  assert.deepEqual(model.codons[97].positions, [279, 280, 281]);
  assert.deepEqual(model.junctions, [{ atOffset: 13, gapNt: 0, bases: null }]);
  assert.equal(model.upstream[29].position, 7829);
  assert.equal(firstTranscribedBase(gene), 7830);
});

test('an origin-crossing minus-strand gene reads base 1\'s piece first, then the far piece', () => {
  // M744_RS13290: complement(join(45877..46366,1..2510)) on the 46,366 bp plasmid.
  const sense = Array.from({ length: 999 }, (_, i) => (i === 0 ? 'ATG' : 'GCT'));
  const gene = plusGene({
    id: 'M744_RS13290', seqid: 'NZ_CP006472.1', strand: '-', start: 1, end: 46366,
    lengthNt: 3000, lengthCodons: 999, cdsSegments: [[45877, 46366], [1, 2510]], codons: pack(sense),
  });
  const model = geneSequenceModel(gene, table);
  assert.ok(model.coordinatesKnown);
  assert.deepEqual(model.codons[0].positions, [2510, 2509, 2508]);
  assert.deepEqual(model.codons[836].positions, [2, 1, 46366]);
  assert.deepEqual(model.codons[999].positions, [45879, 45878, 45877]);
  assert.deepEqual(model.junctions, [{ atOffset: 2510, gapNt: 0, bases: null }]);
  assert.equal(model.upstream[29].position, 2511);
  assert.equal(firstTranscribedBase(gene), 2510);
});

test('upstream positions wrap around the replicon origin', () => {
  const gene = plusGene({ seqid: 'NZ_CP006473.1', start: 3, end: 29 });
  assert.equal(upstreamPosition(gene, -1), 2);
  assert.equal(upstreamPosition(gene, -2), 1);
  assert.equal(upstreamPosition(gene, -3), 7842);
  const minus = plusGene({ seqid: 'NZ_CP006473.1', strand: '-', start: 7814, end: 7840 });
  assert.equal(upstreamPosition(minus, -1), 7841);
  assert.equal(upstreamPosition(minus, -2), 7842);
  assert.equal(upstreamPosition(minus, -3), 1);
  assert.equal(upstreamPosition(plusGene({ seqid: 'NZ_UNKNOWN.1' }), -1), null);
  assert.equal(upstreamPosition(gene, 0), null);
});

test('the alternate rnaContext form yields the upstream and any junction bases in the window', () => {
  const sense = Array.from({ length: 30 }, (_, i) => (i === 0 ? 'ATG' : 'GCT'));
  const cds = `${sense.join('')}TAG`;
  // A two-base gap after CDS offset 41, inside the 60-base window.
  const gene = plusGene({
    start: 1001, end: 1095, lengthNt: 93, lengthCodons: 30,
    cdsSegments: [[1001, 1042], [1045, 1095]],
    codons: pack(sense),
    rnaContext: {
      sequence: `${UPSTREAM}${cds.slice(0, 42)}GG${cds.slice(42, 58)}`,
      cdsOffsets: [
        ...Array(30).fill(-1),
        ...Array.from({ length: 42 }, (_, i) => i),
        -1, -1,
        ...Array.from({ length: 16 }, (_, i) => 42 + i),
      ],
    },
  });
  const model = geneSequenceModel(gene, table);
  assert.equal(model.upstream.length, 30);
  assert.equal(model.upstream[0].base, 'A');
  assert.deepEqual(model.junctions, [{ atOffset: 42, gapNt: 2, bases: 'GG' }]);
});

test('a malformed or absent rnaContext yields no upstream rather than a guess', () => {
  const cases = [
    undefined,
    null,
    { upstream: 'ACGT' },
    { upstream: 'N'.repeat(30) },
    { sequence: 'A'.repeat(90) },
    { sequence: 'A'.repeat(90), cdsOffsets: Array(90).fill(-1) },
    { sequence: 'A'.repeat(89), cdsOffsets: Array(90).fill(0) },
  ];
  for (const rnaContext of cases) {
    const model = geneSequenceModel(plusGene({ rnaContext }), table);
    assert.deepEqual(model.upstream, [], JSON.stringify(rnaContext));
    assert.equal(model.domain.min, 0);
  }
  assert.equal(upstreamContext({ rnaContext: 'text' }, []), null);
  assert.match(describeGeneSequence(geneSequenceModel(plusGene({ rnaContext: null }), table)),
    /No upstream context is shipped/);
});

test('an active scheme recodes every target except position zero, the stop included', () => {
  const gene = plusGene({ codons: pack(['GTG', 'GCT', 'TCG', 'AAA', 'GTG', 'TCA', 'TGG', 'CCC']) });
  const scheme = compileScheme({ TCG: 'AGC', TCA: 'AGT', GTG: 'GTC', TAG: 'TAA' }, table);
  const model = geneSequenceModel(gene, table, scheme);
  assert.ok(model.scheme.active);
  assert.equal(model.codons[0].recoded, 'GTG', 'position zero is never recoded');
  assert.equal(model.codons[0].changed, false);
  assert.equal(model.codons[2].recoded, 'AGC');
  assert.equal(model.codons[2].changed, true);
  assert.equal(model.codons[4].recoded, 'GTC');
  assert.equal(model.codons[5].recoded, 'AGT');
  assert.equal(model.codons[8].recoded, 'TAA');
  assert.equal(model.codons[8].changed, true);
  assert.equal(model.scheme.changedCodons, 4);
  assert.equal(model.scheme.stopChanged, true);
  assert.equal(model.protein, 'MASKVSWP', 'the protein is unchanged');
  assert.match(describeGeneSequence(model), /changes 4 codons, including the terminal stop/);
  const untouched = geneSequenceModel(gene, table, compileScheme({ CTG: 'CTA' }, table));
  assert.equal(untouched.scheme.changedCodons, 0);
  assert.match(describeGeneSequence(untouched), /changes no codon/);
  const inactive = geneSequenceModel(gene, table, compileScheme({}, table));
  assert.equal(inactive.scheme.active, false);
  assert.equal(inactive.codons[2].recoded, null);
});

test('segments that do not add up to the coding length leave every position unknown', () => {
  const gene = plusGene({ cdsSegments: [[1001, 1010], [1020, 1027]] });
  const model = geneSequenceModel(gene, table);
  assert.equal(model.coordinatesKnown, false);
  assert.equal(model.codons[0].positions, null);
  assert.equal(genomicPositions(gene, 27), null);
  assert.match(describeGeneSequence(model), /Genomic coordinates are not shown/);
});

test('a record with no usable sequence yields no model', () => {
  assert.equal(geneSequenceModel(null, table), null);
  assert.equal(geneSequenceModel(plusGene({ codons: '' }), table), null);
  assert.equal(geneSequenceModel(plusGene({ codons: 'ÿ' }), table), null);
  assert.equal(geneSequenceModel(plusGene({ start: null }), table), null);
  assert.equal(geneSequenceModel(plusGene(), null), null);
  assert.equal(describeGeneSequence(null), 'No gene is pinned.');
});

test('a gene whose stop is missing or not a stop is shown without one', () => {
  const model = geneSequenceModel(plusGene({ terminalStop: null }), table);
  assert.equal(model.terminalStop, null);
  assert.equal(model.codons.length, 8);
  assert.equal(model.cdsLengthNt, 24);
  assert.equal(model.scheme.stopChanged, false);
  const sense = geneSequenceModel(plusGene({ terminalStop: 'GCT' }), table);
  assert.equal(sense.terminalStop, null);
});

test('offsets resolve to codons and read as signed labels', () => {
  const model = geneSequenceModel(plusGene(), table);
  assert.equal(codonAtOffset(model, 0).index, 0);
  assert.equal(codonAtOffset(model, 5).index, 1);
  assert.equal(codonAtOffset(model, 26).kind, 'stop');
  assert.equal(codonAtOffset(model, 27), null);
  assert.equal(codonAtOffset(model, -1), null);
  assert.equal(codonAtOffset(null, 1), null);
  assert.equal(signedOffset(0), 'start');
  assert.equal(signedOffset(1200), '+1,200');
  assert.equal(signedOffset(-30), '−30');
});

test('the description names the window when one is given', () => {
  const model = geneSequenceModel(plusGene(), table);
  const described = describeGeneSequence(model, { from: -30, to: 12 });
  assert.match(described, /M744_RS00005 abcA on the plus strand of NZ_CP006471.1: 8 sense codons and the terminal stop TAG/);
  assert.match(described, /30 upstream bases precede it/);
  assert.match(described, /Showing nucleotides −30 to \+12\./);
});

test('junctions and positions come from the same transcription order', () => {
  const gene = plusGene({
    strand: '-', start: 1001, end: 1094, lengthNt: 93, lengthCodons: 30,
    cdsSegments: [[1001, 1021], [1023, 1094]],
    codons: pack(Array.from({ length: 30 }, (_, i) => (i === 0 ? 'ATG' : 'GCT'))),
  });
  assert.deepEqual(junctionsOf(gene), [{ atOffset: 72, gapNt: 1, bases: null }]);
  const positions = genomicPositions(gene, 93);
  assert.equal(positions[0], 1094);
  assert.equal(positions[71], 1023);
  assert.equal(positions[72], 1021);
  assert.equal(positions[92], 1001);
});

const SITE_DATA = new URL('../../site/data/', import.meta.url);

test('every shipped gene builds with known coordinates and its 30 upstream bases', {
  skip: !existsSync(new URL('genes.json', SITE_DATA)) && 'site/data is not present',
}, async () => {
  const genes = JSON.parse(await readFile(new URL('genes.json', SITE_DATA), 'utf8'));
  const meta = JSON.parse(await readFile(new URL('meta.json', SITE_DATA), 'utf8'));
  const shipped = new CodonTable(meta.codonAlphabet);
  let spliced = 0;
  for (const gene of genes) {
    const model = geneSequenceModel(gene, shipped);
    assert.ok(model, gene.id);
    assert.ok(model.coordinatesKnown, `${gene.id} coordinates`);
    assert.equal(model.cdsLengthNt, gene.lengthNt, `${gene.id} length`);
    assert.equal(model.upstream.length, 30, `${gene.id} upstream`);
    assert.equal(model.protein.length, gene.lengthCodons);
    if (model.spliced) spliced += 1;
  }
  assert.equal(spliced, 3);
  const wrapMinus = geneSequenceModel(genes.find((gene) => gene.id === 'M744_RS13290'), shipped);
  assert.deepEqual(wrapMinus.codons[0].positions, [2510, 2509, 2508]);
  assert.deepEqual(wrapMinus.codons[wrapMinus.codons.length - 1].positions, [45879, 45878, 45877]);
  const wrapPlus = geneSequenceModel(genes.find((gene) => gene.id === 'M744_RS13620'), shipped);
  assert.deepEqual(wrapPlus.codons[0].positions, [7830, 7831, 7832]);
  assert.deepEqual(wrapPlus.codons[wrapPlus.codons.length - 1].positions, [279, 280, 281]);
});

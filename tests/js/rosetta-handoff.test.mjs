import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { parseCt, standardTable } from './helpers.mjs';
import {
  copyTextWithFallback, dotBracketToCt, handoffHeader, handoffSequence, writeHandoffFormats,
} from '../../site/js/core/rosetta-handoff.js';
import { matchingFoldStructure } from '../../site/js/ui/rosetta-handoff-panel.js';

const references = JSON.parse(await readFile(new URL('../fixtures/rna-folding.json', import.meta.url)));
const table = standardTable();
const sample = references.cases.find((entry) => entry.gene.rnaContext.upstream);

test('hand-off uses folding orientation, converts T to U, and applies the exact recoding map', () => {
  const wild = handoffSequence({ gene: sample.gene, table, map: sample.map, form: 'wild-type', region: 'start' });
  const recoded = handoffSequence({ gene: sample.gene, table, map: sample.map, form: 'recoded', region: 'start' });
  assert.match(wild.sequence, /^[ACGU]{90}$/);
  assert.match(recoded.sequence, /^[ACGU]{90}$/);
  assert.equal(wild.sequence.includes('T'), false);
  assert.equal(wild.label, 'start_-30_59');
  const reverse = references.cases.find((entry) => entry.gene.strand === '-');
  assert.equal(handoffSequence({ gene: reverse.gene, table, map: reverse.map,
    form: 'recoded', region: 'start' }).sequence, reverse.windows.start.recoded);
});

test('full CDS and inclusive context ranges return only supplied strand-oriented sequence', () => {
  const cds = handoffSequence({ gene: sample.gene, table, form: 'wild-type', region: 'cds' });
  const whole = handoffSequence({ gene: sample.gene, table, form: 'wild-type', region: 'range', start: -30, end: 59 });
  const one = handoffSequence({ gene: sample.gene, table, form: 'wild-type', region: 'range', start: 0, end: 0 });
  assert.equal(cds.sequence.length, sample.gene.codons.length * 3 + 3);
  assert.equal(whole.sequence.length, 90);
  assert.equal(one.sequence, whole.sequence[30]);
  assert.throws(() => handoffSequence({ gene: sample.gene, table, region: 'range', start: -31, end: 2 }), /supplies only/);
  assert.throws(() => handoffSequence({ gene: sample.gene, table, region: 'range', start: 3, end: 2 }), /must not exceed/);
});

test('recoded ranges use the active map and mapped genomic context fails closed at gaps and limits', () => {
  const recodedSample = references.cases.find((entry) => entry.gene.rnaContext.upstream
    && entry.windows.start.wild !== entry.windows.start.recoded);
  const recoded = handoffSequence({ gene: recodedSample.gene, table, map: recodedSample.map,
    form: 'recoded', region: 'range', start: 0, end: 14 });
  assert.equal(recoded.sequence, recodedSample.windows.start.recoded.slice(30, 45));
  assert.notEqual(recoded.sequence, recodedSample.windows.start.wild.slice(30, 45));

  const joined = references.cases.find((entry) => entry.gene.id === '+-joined');
  for (const fixture of [joined, references.cases.find((entry) => entry.gene.id === '+-short')]) {
    const upstream = handoffSequence({ gene: fixture.gene, table, form: 'wild-type',
      region: 'range', start: -30, end: -1 });
    const acrossStart = handoffSequence({ gene: fixture.gene, table, form: 'wild-type',
      region: 'range', start: -5, end: 5 });
    assert.equal(upstream.sequence, fixture.windows.start.wild.slice(0, 30));
    assert.equal(acrossStart.sequence, fixture.windows.start.wild.slice(25, 36));
  }
  assert.throws(() => handoffSequence({ gene: joined.gene, table, form: 'wild-type',
    region: 'range', start: 0, end: 14 }), /contiguous only through transcript coordinate 11.*crosses an intron/);
  const short = references.cases.find((entry) => entry.gene.id === '+-short');
  assert.throws(() => handoffSequence({ gene: short.gene, table, form: 'wild-type',
    region: 'range', start: 0, end: 59 }), /maps transcript coordinates 0 through 20; requested 0 through 59/);
  const malformed = structuredClone(joined.gene);
  const malformedBase = malformed.rnaContext.sequence[28];
  malformed.rnaContext.cdsOffsets[28] = [...joined.windows.first100.wild.replaceAll('U', 'T')]
    .findIndex((base) => base === malformedBase);
  assert.throws(() => handoffSequence({ gene: malformed, table, form: 'wild-type',
    region: 'range', start: -2, end: -1 }), /does not contain the contiguous unmapped upstream coordinates/);
  const missing = structuredClone(joined.gene);
  missing.rnaContext.cdsOffsets[31] = -1;
  assert.throws(() => handoffSequence({ gene: missing, table, form: 'wild-type',
    region: 'range', start: 1, end: 1 }), /does not map transcript coordinate 1/);
});

test('blank, null, whitespace, and non-numeric range values are refused', () => {
  for (const value of ['', '  ', null, 'not-a-number']) {
    assert.throws(() => handoffSequence({ gene: sample.gene, table, region: 'range',
      start: value, end: 5 }), /Range start must be an integer/);
    assert.throws(() => handoffSequence({ gene: sample.gene, table, region: 'range',
      start: 0, end: value }), /Range end must be an integer/);
  }
});

test('full CDS does not require RNA context and still requires a terminal stop', () => {
  const withoutContext = { ...sample.gene, rnaContext: null };
  assert.match(handoffSequence({ gene: withoutContext, table, region: 'cds' }).sequence, /^[ACGU]+$/);
  assert.throws(() => handoffSequence({ gene: { ...withoutContext, terminalStop: 'AAA' },
    table, region: 'cds' }), /terminal stop/);
});

test('full CDS validates recoded maps and unsupported regions fail before CDS construction', () => {
  const invalidMap = { TCG: 'AAA' };
  const proteinChange = { message: 'TCG encodes S but AAA encodes K; that would change the protein.' };
  assert.throws(() => handoffSequence({ gene: sample.gene, table, map: invalidMap,
    form: 'recoded', region: 'start' }), proteinChange);
  assert.throws(() => handoffSequence({ gene: sample.gene, table, map: invalidMap,
    form: 'recoded', region: 'cds' }), proteinChange);
  assert.throws(() => handoffSequence({ gene: {}, table, region: 'unsupported' }),
    /Choose a supported RNA region/);
});

test('all alignment formats round-trip the exact RNA sequence', () => {
  const sequence = 'AUGCGUACGU';
  const header = handoffHeader({ locus: 'M744_RS00001', strain: 'UTEX-2973', form: 'wild-type',
    schemeName: '', region: 'start_-30_59', siteVersion: 'test' });
  const files = writeHandoffFormats({ sequence, header });
  assert.equal(files.sequence.trim(), sequence);
  for (const format of ['fasta', 'a3m', 'a2m']) assert.equal(files[format].trim().split('\n')[1], sequence);
  const stockholm = files.stockholm.trim().split('\n');
  assert.equal(stockholm[0], '# STOCKHOLM 1.0');
  assert.equal(stockholm[1].split(/\s+/)[1], sequence);
  assert.equal(stockholm.at(-1), '//');
});

test('dot bracket and CT agree with each other and the exact fold sequence', () => {
  const sequence = 'AUGCGUACGU';
  const structure = '(((....)))';
  const files = writeHandoffFormats({ sequence, header: 'test', structure, mfe: -3.4 });
  const parsed = parseCt(files.ct);
  assert.deepEqual(parsed, { sequence, structure });
  assert.equal(files.ct.split('\n')[0], '10 ENERGY = -3.4 test');
  assert.match(files.dotBracket, new RegExp(`${sequence}\\n\\(\\(\\(\\.\\.\\.\\.\\)\\)\\)`));
  assert.throws(() => dotBracketToCt(sequence, '((.....))', 'test', -1), /match/);
  assert.throws(() => dotBracketToCt(sequence, '(((.....))', 'test', -1), /unbalanced/);
  assert.throws(() => dotBracketToCt(sequence, structure, 'test'), /MFE/);
});

test('a structure is returned only for the exact sequence captured by the worker', () => {
  const result = { windows: { start: { wildSequence: 'ACGU', wildStructure: '(())', wildMfe: -1.2 } } };
  assert.deepEqual(matchingFoldStructure(result, 'ACGU', 'wild-type', 'start'),
    { structure: '(())', mfe: -1.2 });
  assert.equal(matchingFoldStructure(result, 'AGGU', 'wild-type', 'start'), null);
  assert.equal(matchingFoldStructure(result, 'ACGU', 'recoded', 'start'), null);
});

test('clipboard fallback records success and reports total refusal', async () => {
  let removed = false;
  const textarea = { style: {}, setAttribute() {}, select() {}, remove() { removed = true; } };
  const documentRef = { body: { append(node) { assert.equal(node, textarea); } },
    createElement: () => textarea, execCommand: () => true };
  await copyTextWithFallback('ACGU', {
    clipboard: { writeText: async () => { throw new Error('blocked'); } }, documentRef,
  });
  assert.equal(textarea.value, 'ACGU');
  assert.equal(removed, true);
  await assert.rejects(copyTextWithFallback('ACGU', {
    clipboard: { writeText: async () => { throw new Error('blocked'); } },
    documentRef: { ...documentRef, execCommand: () => false },
  }), /Could not copy.*refused/);
});

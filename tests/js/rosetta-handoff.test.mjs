import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { standardTable } from './helpers.mjs';
import {
  dotBracketToCt, handoffHeader, handoffSequence, parseCt, writeHandoffFormats,
} from '../../site/js/core/rosetta-handoff.js';

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

test('all alignment formats round-trip the exact RNA sequence', () => {
  const sequence = 'AUGCGUACGU';
  const header = handoffHeader({ locus: 'M744_RS00001', strain: 'UTEX-2973', form: 'wild-type',
    schemeName: '', region: 'start_-30_59', siteVersion: 'test' });
  const files = writeHandoffFormats({ sequence, header });
  assert.equal(files.sequence.trim(), sequence);
  for (const format of ['fasta', 'a3m', 'a2m']) assert.equal(files[format].trim().split('\n')[1], sequence);
  assert.equal(files.stockholm.trim().split('\n')[1].split(/\s+/)[1], sequence);
});

test('dot bracket and CT agree with each other and the exact fold sequence', () => {
  const sequence = 'AUGCGUACGU';
  const structure = '(((....)))';
  const files = writeHandoffFormats({ sequence, header: 'test', structure });
  const parsed = parseCt(files.ct);
  assert.deepEqual(parsed, { sequence, structure });
  assert.match(files.dotBracket, new RegExp(`${sequence}\\n\\(\\(\\(\\.\\.\\.\\.\\)\\)\\)`));
  assert.throws(() => dotBracketToCt(sequence, '((.....))'), /match/);
  assert.throws(() => dotBracketToCt(sequence, '(((.....))'), /unbalanced/);
});

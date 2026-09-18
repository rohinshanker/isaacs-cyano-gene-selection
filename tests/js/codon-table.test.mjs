import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CodonTable, standardCodonList, standardAminoAcid } from '../../site/js/core/codon-table.js';
import { standardAlphabet, standardTable, SYMBOLS } from './helpers.mjs';

test('standard codon list is the TCAG ordering the contract specifies', () => {
  const codons = standardCodonList();
  assert.equal(codons.length, 64);
  assert.equal(codons[0], 'TTT');
  assert.equal(codons[1], 'TTC');
  assert.equal(codons[2], 'TTA');
  assert.equal(codons[63], 'GGG');
});

test('standard amino acids follow translation table 1', () => {
  assert.equal(standardAminoAcid('ATG'), 'M');
  assert.equal(standardAminoAcid('TGG'), 'W');
  assert.equal(standardAminoAcid('TAA'), '*');
  assert.equal(standardAminoAcid('TAG'), '*');
  assert.equal(standardAminoAcid('TGA'), '*');
  assert.throws(() => standardAminoAcid('NNN'), /not a codon/);
});

test('table exposes families, GC3 flags, and stop flags', () => {
  const table = standardTable();
  assert.equal(table.family.get('L').length, 6);
  assert.equal(table.family.get('*').length, 3);
  assert.equal(table.familySize[table.indexOf('ATG')], 1);
  assert.equal(table.isGc3[table.indexOf('TCG')], 1);
  assert.equal(table.isGc3[table.indexOf('TCA')], 0);
  assert.equal(table.isStop[table.indexOf('TGA')], 1);
  assert.equal(table.indexOf('NNN'), -1);
});

test('synonyms exclude the codon itself and stop codons pair with stops', () => {
  const table = standardTable();
  assert.deepEqual(table.synonymsOf('TAG').sort(), ['TAA', 'TGA']);
  assert.equal(table.synonymsOf('ATG').length, 0);
  assert.equal(table.synonymsOf('TGG').length, 0);
  assert.ok(!table.synonymsOf('TCG').includes('TCG'));
  assert.equal(table.synonymsOf('ZZZ').length, 0);
});

test('decode and encode round-trip, and translation follows the code', () => {
  const table = standardTable();
  const packed = `${SYMBOLS[0]}${SYMBOLS[35]}${SYMBOLS[63]}`;
  const decoded = table.decode(packed);
  assert.deepEqual([...decoded], [0, 35, 63]);
  assert.equal(table.encode(decoded), packed);
  assert.equal(table.translate(decoded), 'FMG');
});

test('decode rejects a symbol outside the alphabet', () => {
  const table = standardTable();
  assert.throws(() => table.decode('!'), /unknown codon symbol/);
});

test('a malformed alphabet is rejected rather than silently accepted', () => {
  assert.throws(() => new CodonTable([]), /64 entries/);
  const duplicated = standardAlphabet();
  duplicated[1].sym = duplicated[0].sym;
  assert.throws(() => new CodonTable(duplicated), /duplicate symbol/);
  const wrongAa = standardAlphabet();
  wrongAa[0].aa = 'W';
  assert.throws(() => new CodonTable(wrongAa), /standard code says/);
  const wrongCodon = standardAlphabet();
  wrongCodon[0].codon = 'TTX';
  assert.throws(() => new CodonTable(wrongCodon), /codon invalid/);
  const longSymbol = standardAlphabet();
  longSymbol[0].sym = 'ab';
  assert.throws(() => new CodonTable(longSymbol), /one character/);
  const nonAscii = standardAlphabet();
  nonAscii[0].sym = 'é';
  assert.throws(() => new CodonTable(nonAscii), /ASCII/);
  const duplicateCodon = standardAlphabet();
  duplicateCodon[1].codon = duplicateCodon[0].codon;
  assert.throws(() => new CodonTable(duplicateCodon), /duplicate codon/);
});

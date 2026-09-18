import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PRESETS, validateSchemeMap, compileScheme, recodableCodons, prefillReplacement,
  serializeSchemeMap, parseSchemeMap, verifyProteinsUnchanged,
} from '../../site/js/core/scheme.js';
import { standardTable, fixtureDataset } from './helpers.mjs';

const table = standardTable();

test('a synonymous map is accepted and compiled into lookup tables', () => {
  const map = { TCG: 'AGC', TCA: 'AGT' };
  assert.equal(validateSchemeMap(map, table).ok, true);
  const scheme = compileScheme(map, table);
  assert.equal(scheme.active, true);
  assert.deepEqual(scheme.targets, ['TCA', 'TCG']);
  assert.equal(scheme.replacement[table.indexOf('TCG')], table.indexOf('AGC'));
  assert.equal(scheme.replacement[table.indexOf('GGG')], table.indexOf('GGG'));
  assert.equal(scheme.isTarget[table.indexOf('TCA')], 1);
  assert.equal(scheme.isTarget[table.indexOf('GGG')], 0);
});

test('an empty map compiles to an inactive identity scheme', () => {
  const scheme = compileScheme({}, table);
  assert.equal(scheme.active, false);
  for (let i = 0; i < 64; i += 1) assert.equal(scheme.replacement[i], i);
});

test('a map that would change the protein is rejected with a reason', () => {
  const result = validateSchemeMap({ TCG: 'GCG' }, table);
  assert.equal(result.ok, false);
  assert.match(result.errors[0], /change the protein/);
  assert.throws(() => compileScheme({ TCG: 'GCG' }, table), /invalid recoding scheme/);
});

test('self-replacement, unknown codons, and chained targets are rejected', () => {
  assert.match(validateSchemeMap({ TCG: 'TCG' }, table).errors[0], /cannot be replaced by itself/);
  assert.match(validateSchemeMap({ XYZ: 'AGC' }, table).errors[0], /not a codon/);
  assert.match(validateSchemeMap({ TCG: 'QQQ' }, table).errors[0], /no valid replacement/);
  assert.match(
    validateSchemeMap({ TCG: 'AGC', AGC: 'TCC' }, table).errors[0],
    /itself a target/,
  );
});

test('stop codons may only be replaced by other stops', () => {
  assert.equal(validateSchemeMap({ TAG: 'TAA' }, table).ok, true);
  assert.equal(validateSchemeMap({ TAG: 'CAA' }, table).ok, false);
});

test('only codons with a synonymous alternative can be targeted', () => {
  const codons = recodableCodons(table);
  assert.equal(codons.length, 62);
  assert.ok(!codons.includes('ATG'));
  assert.ok(!codons.includes('TGG'));
});

test('replacements prefill from meta and fall back when a source is missing', () => {
  const meta = {
    defaultReplacement: { TCG: 'AGC' },
    highExpressedReplacement: { TCG: 'TCC', TCA: 'TCT' },
  };
  assert.equal(prefillReplacement('TCG', meta, table, false), 'AGC');
  assert.equal(prefillReplacement('TCG', meta, table, true), 'TCC');
  assert.equal(prefillReplacement('TCA', meta, table, false), 'TCT', 'falls back to the other map');
  assert.equal(prefillReplacement('GGG', meta, table, false), 'GGT', 'falls back to a synonym');
  assert.equal(prefillReplacement('ATG', meta, table, false), null);
});

test('a prefill never picks a codon the same scheme removes', () => {
  // The genome's favourite synonym for TCA is TCG, which Syn61 also removes.
  const meta = { defaultReplacement: { TCA: 'TCG' }, highExpressedReplacement: {} };
  assert.equal(prefillReplacement('TCA', meta, table, false), 'TCG');
  const avoided = prefillReplacement('TCA', meta, table, false, ['TCG', 'TCA', 'TAG']);
  assert.notEqual(avoided, 'TCG');
  assert.equal(table.aas[table.indexOf(avoided)], 'S');
  assert.equal(
    prefillReplacement('TAG', meta, table, false, ['TAG', 'TAA', 'TGA']),
    null,
    'excluding every alternative leaves nothing to prefill',
  );
});

test('serialization round-trips and ignores malformed fragments', () => {
  const map = { TCG: 'AGC', TAG: 'TAA' };
  const text = serializeSchemeMap(map);
  assert.equal(text, 'TAG-TAA.TCG-AGC');
  assert.deepEqual(parseSchemeMap(text), map);
  assert.deepEqual(parseSchemeMap(''), {});
  assert.deepEqual(parseSchemeMap('nonsense.TCG-AGC'), { TCG: 'AGC' });
  assert.equal(serializeSchemeMap(undefined), '');
});

test('presets name real target codons', () => {
  for (const preset of PRESETS) {
    for (const codon of preset.targets) assert.ok(table.indexOf(codon) >= 0);
  }
  assert.deepEqual([...PRESETS[1].targets], ['TCG', 'TCA', 'TAG']);
});

test('applying a scheme to every real gene leaves every protein unchanged', async () => {
  const dataset = await fixtureDataset();
  const scheme = compileScheme({ TCG: 'AGC', TCA: 'AGT', CTG: 'CTC' }, dataset.table);
  const result = verifyProteinsUnchanged(dataset, scheme);
  assert.equal(result.ok, true);
  assert.equal(result.genesChecked, dataset.genes.length);
  assert.ok(result.codonsChecked > 10000);
  assert.equal(result.firstMismatch, null);
});

test('verification accepts a stop reassignment and rejects a stop turned into sense', async () => {
  const dataset = await fixtureDataset();
  const good = compileScheme({ TAG: 'TAA' }, dataset.table);
  const goodResult = verifyProteinsUnchanged(dataset, good);
  assert.equal(goodResult.ok, true);
  assert.ok(goodResult.codonsChecked > dataset.packed.length - dataset.genes.length);

  const bad = compileScheme({}, dataset.table);
  bad.replacement[dataset.table.indexOf('TAG')] = dataset.table.indexOf('CAG');
  const badResult = verifyProteinsUnchanged(dataset, bad);
  const anyAmber = dataset.genes.some((gene) => gene.terminalStop === 'TAG');
  assert.equal(anyAmber, true, 'the fixture has amber-terminated genes to catch');
  assert.equal(badResult.ok, false);
  assert.equal(badResult.firstMismatch.from, 'TAG');
  assert.equal(badResult.firstMismatch.to, 'CAG');
});

test('verification ignores the initiation codon, which is never recoded', async () => {
  const dataset = await fixtureDataset();
  const startCodons = new Set(
    dataset.genes.map((gene, g) => dataset.table.codons[dataset.packed[dataset.offsets[g]]]),
  );
  assert.ok(startCodons.size > 1, 'the fixture uses more than one start triplet');
  // GTG reads as methionine at position zero but as valine anywhere else. Mapping
  // it must not be reported as a protein change, because position zero is skipped.
  const scheme = compileScheme({ GTG: 'GTC' }, dataset.table);
  assert.equal(verifyProteinsUnchanged(dataset, scheme).ok, true);
});

test('protein verification catches a map that slipped through as non-synonymous', async () => {
  const dataset = await fixtureDataset();
  const broken = compileScheme({}, dataset.table);
  broken.replacement[dataset.table.indexOf('GCT')] = dataset.table.indexOf('TTT');
  const result = verifyProteinsUnchanged(dataset, broken);
  assert.equal(result.ok, false);
  assert.equal(result.firstMismatch.from, 'GCT');
  assert.equal(result.firstMismatch.to, 'TTT');
});

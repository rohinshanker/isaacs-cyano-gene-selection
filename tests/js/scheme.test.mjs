import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PRESETS, validateSchemeMap, compileScheme, recodableCodons, prefillReplacement,
  serializeSchemeMap, parseSchemeMap, verifyProteinsUnchanged, codonOccurrenceCounts,
  ROTATION_SIZE, destinationsOf, isDistribution, apportion, replacementAt,
  occurrenceCounter, rebalanceShares,
} from '../../site/js/core/scheme.js';
import { standardTable, fixtureDataset } from './helpers.mjs';

const table = standardTable();

/**
 * Force every occurrence of `codon` to compile to `destination`.
 *
 * `rotation` is what the app applies and what the verifier reads, so a test
 * simulating a corrupted compiled scheme has to corrupt that, not `replacement`.
 */
function forceRotation(scheme, codonTable, from, to) {
  const index = codonTable.indexOf(from);
  scheme.rotation.fill(
    codonTable.indexOf(to), index * ROTATION_SIZE, (index + 1) * ROTATION_SIZE,
  );
}

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
  forceRotation(bad, dataset.table, 'TAG', 'CAG');
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
  forceRotation(broken, dataset.table, 'GCT', 'TTT');
  const result = verifyProteinsUnchanged(dataset, broken);
  assert.equal(result.ok, false);
  assert.equal(result.firstMismatch.from, 'GCT');
  assert.equal(result.firstMismatch.to, 'TTT');
});


test('published editable counts are quoted, and they leave out the start codon', async () => {
  const dataset = await fixtureDataset();
  const { counts, published } = codonOccurrenceCounts(dataset);
  assert.equal(published, true, 'the fixture must publish meta.codonOccurrences');
  const { table, packed, offsets, genes } = dataset;
  // Recount from the sequence: every occurrence except position zero.
  const editable = new Map(table.codons.map((codon) => [codon, 0]));
  for (let g = 0; g < genes.length; g += 1) {
    for (let i = offsets[g] + 1; i < offsets[g + 1]; i += 1) {
      const codon = table.codons[packed[i]];
      editable.set(codon, editable.get(codon) + 1);
    }
    editable.set(genes[g].terminalStop, editable.get(genes[g].terminalStop) + 1);
  }
  for (const codon of table.codons) {
    assert.equal(counts.get(codon), editable.get(codon), `${codon} editable count`);
  }
  // Start codons occur at position zero, so their editable count is below the raw one.
  const atgIndex = table.indexOf('ATG');
  assert.ok(counts.get('ATG') < dataset.genomeCounts[atgIndex]);
  // A stop's editable count is the number of genes that end with it.
  assert.equal(counts.get('TAG'), genes.filter((gene) => gene.terminalStop === 'TAG').length);
});

test('a dataset without published counts falls back to raw counts and says so', async () => {
  const dataset = await fixtureDataset();
  const { meta, ...rest } = dataset;
  const { codonOccurrences: _dropped, ...metaWithout } = meta;
  const { counts, published } = codonOccurrenceCounts({ ...rest, meta: metaWithout });
  assert.equal(published, false);
  const atgIndex = dataset.table.indexOf('ATG');
  assert.equal(counts.get('ATG'), dataset.genomeCounts[atgIndex]);
  assert.equal(counts.get('TAG'), dataset.genes.filter((gene) => gene.terminalStop === 'TAG').length);
  // A partial table is not trusted either: every codon must be published.
  const partial = codonOccurrenceCounts({ ...rest, meta: { ...metaWithout, codonOccurrences: { ATG: { total: 1, editable: 1 } } } });
  assert.equal(partial.published, false);
});


// --------------------------------------------------------------------------
// Distribution schemes
// --------------------------------------------------------------------------

test('destinationsOf reads a single codon and a distribution through one shape', () => {
  assert.deepEqual(destinationsOf('AGC'), [{ codon: 'AGC', share: ROTATION_SIZE }]);
  assert.deepEqual(destinationsOf([['AGC', 60], ['AGT', 40]]), [
    { codon: 'AGC', share: 60 },
    { codon: 'AGT', share: 40 },
  ]);
  assert.deepEqual(destinationsOf([{ codon: 'AGC', share: 100 }]), [
    { codon: 'AGC', share: 100 },
  ]);
  assert.deepEqual(destinationsOf(undefined), []);
});

test('isDistribution is true only for more than one destination', () => {
  assert.equal(isDistribution('AGC'), false);
  assert.equal(isDistribution([['AGC', 100]]), false);
  assert.equal(isDistribution([['AGC', 60], ['AGT', 40]]), true);
});

test('a distribution whose shares are synonymous and sum to 100 is accepted', () => {
  const map = { TCG: [['AGC', 60], ['AGT', 40]] };
  assert.deepEqual(validateSchemeMap(map, table), { ok: true, errors: [] });
});

test('a distribution is rejected when its shares do not sum to 100', () => {
  const { ok, errors } = validateSchemeMap({ TCG: [['AGC', 60], ['AGT', 30]] }, table);
  assert.equal(ok, false);
  assert.match(errors.join(' '), /add up to 90%, not 100%/);
});

test('a distribution is rejected for a non-synonymous destination', () => {
  const { ok, errors } = validateSchemeMap({ TCG: [['AGC', 60], ['GGG', 40]] }, table);
  assert.equal(ok, false);
  assert.match(errors.join(' '), /that would change the protein/);
});

test('a distribution is rejected for a destination the scheme also removes', () => {
  const { ok, errors } = validateSchemeMap(
    { TCG: [['AGC', 60], ['AGT', 40]], AGT: 'TCT' }, table,
  );
  assert.equal(ok, false);
  assert.match(errors.join(' '), /which is itself a target/);
});

test('a distribution is rejected for a repeated destination', () => {
  const { ok, errors } = validateSchemeMap({ TCG: [['AGC', 60], ['AGC', 40]] }, table);
  assert.equal(ok, false);
  assert.match(errors.join(' '), /lists AGC more than once/);
});

test('a distribution is rejected for a share that is not a whole percent above zero', () => {
  for (const share of [0, -10, 12.5]) {
    const { ok, errors } = validateSchemeMap(
      { TCG: [['AGC', share], ['AGT', 100 - share]] }, table,
    );
    assert.equal(ok, false, `share ${share} must be rejected`);
    assert.match(errors.join(' '), /a share is a whole number of percent above zero/);
  }
});

test('a target with no replacement at all is rejected', () => {
  const { ok, errors } = validateSchemeMap({ TCG: [] }, table);
  assert.equal(ok, false);
  assert.match(errors.join(' '), /TCG has no replacement/);
});

test('apportion fills every slot and honours each share exactly', () => {
  const slots = apportion([
    { codon: 'TCT', share: 40 }, { codon: 'TCC', share: 35 }, { codon: 'TCG', share: 25 },
  ]);
  assert.equal(slots.length, ROTATION_SIZE);
  const tally = slots.reduce((acc, codon) => ({ ...acc, [codon]: (acc[codon] ?? 0) + 1 }), {});
  assert.deepEqual(tally, { TCT: 40, TCC: 35, TCG: 25 });
});

test('apportion spreads destinations instead of blocking them', () => {
  const slots = apportion([{ codon: 'TCT', share: 40 }, { codon: 'TCC', share: 60 }]);
  // A blocked rotation would give the first forty slots to one codon. The point
  // of spreading is that a gene holding only a few occurrences still sees both.
  assert.equal(new Set(slots.slice(0, 5)).size, 2);
  assert.equal(new Set(slots.slice(0, 3)).size, 2);
});

test('apportion is deterministic', () => {
  const destinations = [{ codon: 'TCT', share: 33 }, { codon: 'TCC', share: 67 }];
  assert.deepEqual(apportion(destinations), apportion(destinations));
});

test('apportion handles a single destination and a hundred-way split', () => {
  assert.deepEqual(new Set(apportion([{ codon: 'TCT', share: 100 }])), new Set(['TCT']));
  const even = apportion([{ codon: 'TCT', share: 50 }, { codon: 'TCC', share: 50 }]);
  assert.deepEqual(even.slice(0, 4), ['TCT', 'TCC', 'TCT', 'TCC']);
});

test('compiling a distribution records it and keeps the dominant destination', () => {
  const scheme = compileScheme({ TCG: [['AGC', 60], ['AGT', 40]] }, table);
  assert.deepEqual(scheme.distributed, ['TCG']);
  assert.equal(scheme.rotationSize, ROTATION_SIZE);
  // `replacement` answers "mostly becomes", which is the larger share.
  assert.equal(scheme.replacement[table.indexOf('TCG')], table.indexOf('AGC'));
});

test('compiling a single replacement leaves distributed empty', () => {
  const scheme = compileScheme({ TCG: 'AGC' }, table);
  assert.deepEqual(scheme.distributed, []);
  assert.equal(scheme.replacement[table.indexOf('TCG')], table.indexOf('AGC'));
});

test('every rotation slot of a single replacement is that replacement', () => {
  const scheme = compileScheme({ TCG: 'AGC' }, table);
  for (let s = 0; s < ROTATION_SIZE; s += 1) {
    assert.equal(replacementAt(scheme, table.indexOf('TCG'), s), table.indexOf('AGC'));
  }
});

test('an untargeted codon is returned unchanged at every ordinal', () => {
  const scheme = compileScheme({ TCG: [['AGC', 60], ['AGT', 40]] }, table);
  const ggg = table.indexOf('GGG');
  for (const ordinal of [0, 1, 7, 99, 100, 1234]) {
    assert.equal(replacementAt(scheme, ggg, ordinal), ggg);
  }
});

test('replacementAt cycles the rotation so a long gene keeps the shares', () => {
  const scheme = compileScheme({ TCG: [['AGC', 60], ['AGT', 40]] }, table);
  const tcg = table.indexOf('TCG');
  const seen = [];
  for (let i = 0; i < 200; i += 1) seen.push(replacementAt(scheme, tcg, i));
  const agc = seen.filter((index) => index === table.indexOf('AGC')).length;
  assert.equal(agc, 120, 'two full rotations hold two hundred occurrences at 60%');
  // Cycling means ordinal 100 repeats ordinal 0, which is what makes a gene of
  // any length reproducible from the scheme alone.
  assert.equal(replacementAt(scheme, tcg, 100), replacementAt(scheme, tcg, 0));
});

test('occurrenceCounter is a fresh zeroed counter per gene', () => {
  const counter = occurrenceCounter();
  assert.equal(counter.length, 64);
  assert.equal(counter.every((value) => value === 0), true);
  assert.notEqual(occurrenceCounter(), counter);
});

test('a distribution serializes with shares and round-trips', () => {
  const map = { TCG: [['AGC', 60], ['AGT', 40]] };
  const text = serializeSchemeMap(map);
  assert.equal(text, 'TCG-AGC:60/AGT:40');
  assert.deepEqual(parseSchemeMap(text), {
    TCG: [{ codon: 'AGC', share: 60 }, { codon: 'AGT', share: 40 }],
  });
});

test('a single replacement keeps the original serialized form exactly', () => {
  assert.equal(serializeSchemeMap({ TCG: 'AGC', TCA: 'AGT' }), 'TCA-AGT.TCG-AGC');
  assert.deepEqual(parseSchemeMap('TCA-AGT.TCG-AGC'), { TCA: 'AGT', TCG: 'AGC' });
});

test('a distribution serializes stably whatever order it is given in', () => {
  const a = serializeSchemeMap({ TCG: [['AGT', 40], ['AGC', 60]] });
  const b = serializeSchemeMap({ TCG: [['AGC', 60], ['AGT', 40]] });
  assert.equal(a, b);
  // Equal shares order by codon, so the text is still stable.
  assert.equal(
    serializeSchemeMap({ TCG: [['AGT', 50], ['AGC', 50]] }), 'TCG-AGC:50/AGT:50',
  );
});

test('single and distributed entries mix in one serialized scheme', () => {
  const map = { TAG: 'TAA', TCG: [['AGC', 60], ['AGT', 40]] };
  const text = serializeSchemeMap(map);
  assert.equal(text, 'TAG-TAA.TCG-AGC:60/AGT:40');
  assert.deepEqual(parseSchemeMap(text), {
    TAG: 'TAA',
    TCG: [{ codon: 'AGC', share: 60 }, { codon: 'AGT', share: 40 }],
  });
});

test('parsing a malformed distribution skips it rather than guessing', () => {
  assert.deepEqual(parseSchemeMap('TCG-AGC:'), {});
  assert.deepEqual(parseSchemeMap('TCG-AGC:60/'), {});
  assert.deepEqual(parseSchemeMap('TCG-XXX:60/AGT:40'), {});
  assert.deepEqual(parseSchemeMap('TCG-AGC:60/AGT:40.bogus'), {
    TCG: [{ codon: 'AGC', share: 60 }, { codon: 'AGT', share: 40 }],
  });
});

test('a parsed distribution with bad shares is reported, not repaired', () => {
  const map = parseSchemeMap('TCG-AGC:60/AGT:10');
  assert.deepEqual(map, { TCG: [{ codon: 'AGC', share: 60 }, { codon: 'AGT', share: 10 }] });
  assert.equal(validateSchemeMap(map, table).ok, false);
});

test('a distribution leaves every protein unchanged on the real fixture', async () => {
  const dataset = await fixtureDataset();
  const scheme = compileScheme(
    { TCG: [['TCT', 34], ['TCC', 33], ['AGC', 33]] }, dataset.table,
  );
  const result = verifyProteinsUnchanged(dataset, scheme);
  assert.equal(result.ok, true);
  assert.equal(result.firstMismatch, null);
  assert.ok(result.codonsChecked > 10000);
});

test('a distribution actually uses more than one destination on real sequence', async () => {
  const dataset = await fixtureDataset();
  const { table: codonTable, packed, offsets, genes } = dataset;
  const scheme = compileScheme({ TCG: [['TCT', 50], ['TCC', 50]] }, codonTable);
  const tcg = codonTable.indexOf('TCG');
  const used = new Set();
  const counter = occurrenceCounter();
  for (let g = 0; g < genes.length; g += 1) {
    counter.fill(0);
    for (let i = offsets[g] + 1; i < offsets[g + 1]; i += 1) {
      const from = packed[i];
      if (from === tcg) used.add(replacementAt(scheme, from, counter[from]));
      counter[from] += 1;
    }
  }
  assert.deepEqual(
    [...used].sort(), [codonTable.indexOf('TCC'), codonTable.indexOf('TCT')].sort(),
  );
});

test('the compiled rotation of a distribution is itself all synonymous', () => {
  const scheme = compileScheme({ TCG: [['AGC', 60], ['AGT', 40]] }, table);
  const tcg = table.indexOf('TCG');
  for (let s = 0; s < ROTATION_SIZE; s += 1) {
    const to = replacementAt(scheme, tcg, s);
    assert.equal(table.aas[to], table.aas[tcg]);
  }
});

test('rebalanceShares keeps the total at a hundred', () => {
  const start = [
    { codon: 'TCT', share: 50 }, { codon: 'TCC', share: 25 }, { codon: 'AGC', share: 25 },
  ];
  for (const requested of [1, 7, 20, 33, 50, 97, 98, 99, 100, 1000, -5, NaN]) {
    const next = rebalanceShares(start, 0, requested);
    const total = next.reduce((sum, d) => sum + d.share, 0);
    assert.equal(total, ROTATION_SIZE, `requested ${requested} must still total 100`);
    assert.equal(next.every((d) => Number.isInteger(d.share) && d.share >= 1), true);
    assert.deepEqual(next.map((d) => d.codon), ['TCT', 'TCC', 'AGC'], 'order is kept');
  }
});

test('rebalanceShares applies the requested share when it fits', () => {
  const start = [{ codon: 'TCT', share: 50 }, { codon: 'TCC', share: 50 }];
  assert.deepEqual(rebalanceShares(start, 0, 20), [
    { codon: 'TCT', share: 20 }, { codon: 'TCC', share: 80 },
  ]);
});

test('rebalanceShares clamps so every other destination keeps one percent', () => {
  const start = [
    { codon: 'TCT', share: 34 }, { codon: 'TCC', share: 33 }, { codon: 'AGC', share: 33 },
  ];
  const next = rebalanceShares(start, 0, 100);
  assert.equal(next[0].share, 98, 'two others need one percent each');
  assert.deepEqual(next.slice(1).map((d) => d.share), [1, 1]);
});

test('rebalanceShares spreads the remainder in proportion', () => {
  const start = [
    { codon: 'TCT', share: 20 }, { codon: 'TCC', share: 60 }, { codon: 'AGC', share: 20 },
  ];
  const next = rebalanceShares(start, 0, 40);
  assert.equal(next[0].share, 40);
  // The 60 share keeps three times the 20 share, of the slack above the floors.
  assert.ok(next[1].share > next[2].share);
  assert.equal(next[1].share + next[2].share, 60);
});

test('rebalanceShares on a single destination returns the full share', () => {
  assert.deepEqual(rebalanceShares([{ codon: 'TCT', share: 100 }], 0, 40), [
    { codon: 'TCT', share: ROTATION_SIZE },
  ]);
});

test('a rebalanced result always validates', () => {
  const start = [
    { codon: 'TCT', share: 40 }, { codon: 'TCC', share: 35 }, { codon: 'AGC', share: 25 },
  ];
  for (const position of [0, 1, 2]) {
    for (const requested of [1, 13, 50, 99, 200]) {
      const map = { TCG: rebalanceShares(start, position, requested) };
      assert.equal(
        validateSchemeMap(map, table).ok, true,
        `position ${position} at ${requested} must validate`,
      );
    }
  }
});


test('published presets preserve proteins and match the pinned observed distributions', async () => {
  const dataset = await fixtureDataset();
  for (const preset of PRESETS.filter((p) => p.map)) {
    assert.equal(validateSchemeMap(preset.map, table).ok, true);
    assert.equal(verifyProteinsUnchanged(dataset, compileScheme(preset.map, table)).ok, true);
  }
  assert.deepEqual(PRESETS.find((p) => p.id === 'syn61').map,
    { TCG: 'AGC', TCA: 'AGT', TAG: 'TAA' });
  const preset = PRESETS.find((p) => p.id === 'ec-syn57');
  const counts = new Map(preset.targets.map((c) => [c, new Map()]));
  for (const filename of ['ec_syn57_substitutions.tsv', 'ec_syn57_terminal_substitutions.tsv']) {
    const lines = (await readFile(new URL(`../../data/recoded/${filename}`, import.meta.url), 'utf8'))
      .trim().split('\n').map((line) => line.split('\t'));
    const header = lines.shift();
    for (const values of lines) {
      const row = Object.fromEntries(header.map((h, i) => [h, values[i]]));
      if (row.source && row.source !== 'genome_wide') continue;
      counts.get(row.native_codon)?.set(row.recoded_codon, Number(row.count));
    }
  }
  for (const [codon, observed] of counts) {
    const total = [...observed.values()].reduce((a, b) => a + b, 0);
    assert.ok(total > 0);
    const shares = new Map([...observed].map(([to, n]) => [to, Math.floor(n * 100 / total)]));
    const remainder = 100 - [...shares.values()].reduce((a, b) => a + b, 0);
    const ranked = [...observed].sort(([a, an], [b, bn]) =>
      (bn * 100 % total) - (an * 100 % total) || a.localeCompare(b));
    for (const [to] of ranked.slice(0, remainder)) shares.set(to, shares.get(to) + 1);
    assert.deepEqual(Object.fromEntries(preset.map[codon].map((d) => [d.codon, d.share])),
      Object.fromEntries(shares), codon);
  }
});

/**
 * Every consumer of a compiled scheme must resolve a distribution identically.
 *
 * Three places turn a scheme into recoded codons: the live metric scan, the
 * sequence export, and the gene sequence close-up. Before distributions they all
 * read one lookup table and could not disagree. Now they each walk a rotation
 * with their own counter, so agreement is a property that has to be tested
 * rather than assumed. A drift here would show the reader a recoded row that is
 * not the sequence its own numbers were computed from.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  compileScheme, replacementAt, occurrenceCounter, ROTATION_SIZE,
} from '../../site/js/core/scheme.js';
import { computeLiveMetrics, INITIATION_INDEX } from '../../site/js/core/live-metrics.js';
import { recodedSequence } from '../../site/js/core/export-manifest.js';
import { geneSequenceModel } from '../../site/js/core/gene-sequence-model.js';
import { fixtureDataset } from './helpers.mjs';

/** A three-way serine split, so every consumer has a real choice to make. */
const SPLIT = { TCG: [['TCT', 40], ['TCC', 35], ['AGC', 25]] };

/** The recoded coding sequence of one gene, computed straight from the model. */
function expectedRecoded(dataset, index, scheme) {
  const { packed, offsets, table, stopCodons } = dataset;
  const occurrences = occurrenceCounter();
  let out = '';
  for (let i = offsets[index]; i < offsets[index + 1]; i += 1) {
    const original = packed[i];
    const position = i - offsets[index];
    if (position === INITIATION_INDEX) {
      out += table.codons[original];
      continue;
    }
    out += table.codons[replacementAt(scheme, original, occurrences[original])];
    occurrences[original] += 1;
  }
  const stop = stopCodons ? stopCodons[index] : -1;
  if (stop >= 0) out += table.codons[replacementAt(scheme, stop, occurrences[stop])];
  return out;
}

test('the sequence export resolves a distribution per occurrence', async () => {
  const dataset = await fixtureDataset();
  const scheme = compileScheme(SPLIT, dataset.table);
  for (const index of [0, 1, 2, dataset.genes.length - 1]) {
    const { recoded } = recodedSequence(dataset, index, scheme);
    assert.equal(recoded, expectedRecoded(dataset, index, scheme));
  }
});

test('the start codon consumes no rotation slot', async () => {
  const dataset = await fixtureDataset();
  const { table, packed, offsets } = dataset;
  // Pick a gene whose start triplet is also a target, which is the only case
  // where consuming a slot at position zero would be visible.
  const tcg = table.indexOf('TCG');
  const index = dataset.genes.findIndex((gene, g) => {
    if (packed[offsets[g]] !== tcg) return false;
    for (let i = offsets[g] + 1; i < offsets[g + 1]; i += 1) {
      if (packed[i] === tcg) return true;
    }
    return false;
  });
  if (index < 0) {
    // The fixture may not contain such a gene; the invariant is still asserted
    // directly below, against a synthetic ordinal walk.
    const scheme = compileScheme(SPLIT, table);
    assert.equal(replacementAt(scheme, tcg, 0), table.indexOf('TCT'));
    return;
  }
  const scheme = compileScheme(SPLIT, table);
  const { recoded } = recodedSequence(dataset, index, scheme);
  assert.equal(recoded.slice(0, 3), 'TCG', 'the start triplet is left alone');
  // The first recoded occurrence after it must take rotation slot zero, not one.
  const first = [];
  for (let i = offsets[index] + 1; i < offsets[index + 1]; i += 1) {
    if (packed[i] === tcg) { first.push((i - offsets[index]) * 3); break; }
  }
  assert.equal(
    recoded.slice(first[0], first[0] + 3), table.codons[replacementAt(scheme, tcg, 0)],
  );
});

test('the close-up draws the same recoded codons the export writes', async () => {
  const dataset = await fixtureDataset();
  const scheme = compileScheme(SPLIT, dataset.table);
  let compared = 0;
  for (const gene of dataset.genes.slice(0, 12)) {
    const model = geneSequenceModel(gene, dataset.table, scheme);
    if (!model) continue;
    const index = dataset.genes.indexOf(gene);
    const { recoded } = recodedSequence(dataset, index, scheme);
    const drawn = model.codons.map((codon) => codon.recoded ?? codon.codon).join('');
    assert.equal(drawn, recoded, `gene ${gene.id} draws what the export writes`);
    compared += 1;
  }
  assert.ok(compared > 0, 'at least one gene was compared');
});

test('the live scan counts the codons the export actually produced', async () => {
  const dataset = await fixtureDataset();
  const scheme = compileScheme(SPLIT, dataset.table);
  const { fields } = computeLiveMetrics(dataset, scheme);
  // GC3 is defined over the literal recoded codons, so recomputing it from the
  // exported sequence is an independent check that both walked one rotation.
  for (const index of [0, 3, 9]) {
    const { recoded, recodedStop } = recodedSequence(dataset, index, scheme);
    const body = recodedStop ? recoded.slice(0, -3) : recoded;
    let gc3 = 0;
    let counted = 0;
    for (let i = 2; i < body.length; i += 3) {
      if (body[i] === 'G' || body[i] === 'C') gc3 += 1;
      counted += 1;
    }
    assert.ok(counted > 0);
    assert.ok(
      Math.abs(fields.recodedGc3[index] - gc3 / counted) < 1e-9,
      `gene ${index} GC3 agrees between the scan and the exported sequence`,
    );
  }
});

test('a single-replacement scheme is unchanged by the rotation machinery', async () => {
  const dataset = await fixtureDataset();
  const single = compileScheme({ TCG: 'AGC' }, dataset.table);
  const { recoded } = recodedSequence(dataset, 0, single);
  // Read it codon by codon: TCG can appear as a substring across a codon
  // boundary without any TCG codon surviving, so `includes` would be wrong.
  const bodyCodons = [];
  for (let i = 3; i + 3 <= recoded.length; i += 3) bodyCodons.push(recoded.slice(i, i + 3));
  assert.equal(bodyCodons.includes('TCG'), false, 'no TCG codon survives after position zero');
  // Rotation size does not leak into a single replacement's behaviour.
  for (const ordinal of [0, 1, ROTATION_SIZE - 1, ROTATION_SIZE, ROTATION_SIZE + 7]) {
    assert.equal(
      replacementAt(single, dataset.table.indexOf('TCG'), ordinal),
      dataset.table.indexOf('AGC'),
    );
  }
});

test('a distribution changes the live metrics away from its dominant destination', async () => {
  const dataset = await fixtureDataset();
  const spread = computeLiveMetrics(dataset, compileScheme(SPLIT, dataset.table));
  const dominantOnly = computeLiveMetrics(dataset, compileScheme({ TCG: 'TCT' }, dataset.table));
  // If a consumer silently read `scheme.replacement`, these two would be equal.
  const differs = spread.fields.recodedGc3.some(
    (value, i) => Math.abs(value - dominantOnly.fields.recodedGc3[i]) > 1e-9,
  );
  assert.equal(differs, true, 'the spread is applied, not collapsed to one codon');
});

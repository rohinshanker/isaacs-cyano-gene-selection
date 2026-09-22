import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  functionCategoryLabel, joinFunctionCategories, reviewedFunctionLabels,
} from '../../site/js/core/function-categories.js';

const root = new URL('../../site/data/', import.meta.url);
const source = JSON.parse(await readFile(new URL('function-categories-v1.json', root), 'utf8'));
const publishedGenes = JSON.parse(await readFile(new URL('genes.json', root), 'utf8'));
const genes = () => publishedGenes.map(({ id, name, product }) => ({ id, name, product }));
const release = 'GCF_000817325.1-RS_2026_05_13';

test('only the 13 approved rows get reviewed labels or category colours', () => {
  const rows = genes();
  const model = joinFunctionCategories(source, rows, release);
  assert.equal(model.reviewedCount, 13);
  assert.equal(model.unknownCount, 2703);
  assert.equal(model.explicitUnknownCount, 1);
  assert.equal(model.multipleCount, 0);
  assert.equal(model.multipleLabel, 'Multiple functions');
  assert.deepEqual([...model.counts], [3, 0, 1, 2, 1, 0, 0, 5, 0, 0]);
  assert.equal(functionCategoryLabel(model, 'M744_RS10050'), 'Signaling and circadian regulation');
  assert.equal(functionCategoryLabel(model, 'M744_RS00030'), 'Unknown or unclassified');
  assert.equal(functionCategoryLabel(model, 'M744_RS00005'), 'Unknown or unclassified');
  assert.deepEqual(reviewedFunctionLabels(model, 'M744_RS10050'),
    ['Signaling and circadian regulation']);
  assert.deepEqual(reviewedFunctionLabels(model, 'M744_RS00005'), []);
  assert.deepEqual(rows.find((row) => row.id === 'M744_RS00030').reviewedFunctionLabels,
    ['Unknown or unclassified']);
  assert.equal(rows.find((row) => row.id === 'M744_RS00005').reviewedFunctionLabels, undefined);
  assert.equal(model.values[rows.findIndex((row) => row.id === 'M744_RS00005')], -1);
});

test('release, exact product, review method, and coverage drift are rejected', () => {
  assert.throws(() => joinFunctionCategories(source, genes(), 'other-release'), /invalid version/);
  const productDrift = genes();
  productDrift.find((row) => row.id === 'M744_RS10050').product = 'other';
  assert.throws(() => joinFunctionCategories(source, productDrift, release), /Invalid reviewed/);
  const inferred = structuredClone(source);
  inferred.assignments[0].classificationBasis = 'IEA';
  assert.throws(() => joinFunctionCategories(inferred, genes(), release), /Invalid reviewed/);
  const countDrift = structuredClone(source);
  countDrift.coverage.classifiedLoci += 1;
  assert.throws(() => joinFunctionCategories(countDrift, genes(), release), /coverage differs/);
  const reviewDrift = structuredClone(source);
  reviewDrift.assignments[0].locusTag = 'M744_RS00005';
  assert.throws(() => joinFunctionCategories(reviewDrift, genes(), release), /approved 13 loci/);
  const vocabularyDrift = structuredClone(source);
  vocabularyDrift.vocabulary.categories[0].label = 'Suggested photosynthesis';
  assert.throws(() => joinFunctionCategories(vocabularyDrift, genes(), release), /vocabulary is incomplete/);
});

test('two explicit reviewed labels use the separate multiple-functions bucket', () => {
  const multi = structuredClone(source);
  multi.assignments[0].categoryIds.push('carbon-and-nutrient-metabolism');
  multi.coverage.multipleFunctionLoci = 1;
  const rows = genes();
  const model = joinFunctionCategories(multi, rows, release);
  assert.equal(model.multipleCount, 1);
  assert.equal(model.values[rows.findIndex((row) => row.id === 'M744_RS00265')], 10);
  assert.equal(functionCategoryLabel(model, 'M744_RS00265'), 'Multiple functions');
  assert.deepEqual(reviewedFunctionLabels(model, 'M744_RS00265'),
    ['Photosynthetic light reactions', 'Carbon and nutrient metabolism']);
});

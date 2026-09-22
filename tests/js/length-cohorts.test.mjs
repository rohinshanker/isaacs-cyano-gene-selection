import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  cohortValues, countInRange, lengthBins, passingLengthBins, validateLengthInventory,
} from '../../site/js/core/length-cohorts.js';

const inventory = JSON.parse(fs.readFileSync(
  new URL('../../site/data/length_cohorts.json', import.meta.url), 'utf8',
));

test('release cohorts retain distinct gene spans, CDS lengths, and missingness', () => {
  assert.equal(cohortValues(inventory, 'annotated').total, 2776);
  assert.equal(cohortValues(inventory, 'coding').total, 2715);
  assert.equal(cohortValues(inventory, 'cds').total, 2715);
  assert.equal(cohortValues(inventory, 'refseq').total, 2715);
  assert.equal(cohortValues(inventory, 'rna').total, 54);
  assert.equal(cohortValues(inventory, 'pseudogene').total, 7);
  assert.equal(cohortValues(inventory, 'annotated').unknown, 0);
  assert.equal(cohortValues(inventory, 'pseudogene').values.includes(78), true);
});

test('length range includes both endpoints and empty cohorts remain empty', () => {
  assert.equal(countInRange([200, 201, 2001, 2002], 201, 2001), 2);
  assert.equal(lengthBins([], 4).bins.length, 4);
  assert.deepEqual(lengthBins([75, 75], 2).bins, [2, 0]);
  const histogram = lengthBins([75, 201, 2001, 2002], 2);
  assert.deepEqual(passingLengthBins([75, 201, 2001, 2002], histogram, 201, 2001), [1, 1]);
  assert.throws(() => cohortValues(inventory, 'detected'), /unknown length cohort/);
});

test('published inventory agrees with plotted CDS lengths and release', () => {
  const genes = JSON.parse(fs.readFileSync(
    new URL('../../site/data/genes.json', import.meta.url), 'utf8',
  ));
  assert.equal(
    validateLengthInventory(inventory, genes, inventory.annotationRelease),
    inventory,
  );
  assert.throws(
    () => validateLengthInventory(inventory, genes, 'other-release'),
    /annotation release/,
  );
  const altered = structuredClone(inventory);
  altered.records[0].cdsLengthNt += 3;
  assert.throws(
    () => validateLengthInventory(altered, genes, inventory.annotationRelease),
    /CDS disagrees/,
  );
});

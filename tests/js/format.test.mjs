import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatValue, formatDelta, formatExpressionSource, formatPercentile, formatCount,
  formatSpan, csvField, MISSING, ordinalSuffix,
} from '../../site/js/ui/format.js';

test('a missing value renders as an em-space, never as zero', () => {
  assert.equal(MISSING, ' ');
  for (const value of [null, undefined, NaN, Infinity]) {
    assert.equal(formatValue({ integer: false }, value), MISSING);
  }
  assert.equal(formatValue({ integer: false }, 0), '0');
});

test('precision follows the size of the number', () => {
  const metric = { integer: false };
  assert.equal(formatValue(metric, 0.6483), '0.648');
  assert.equal(formatValue(metric, 4.21), '4.21');
  assert.equal(formatValue(metric, 48.23), '48.2');
  assert.equal(formatValue(metric, 2744626), '2,744,626');
  assert.equal(formatValue(metric, 0.00004), '4.0e-5');
  assert.equal(formatValue({ integer: true }, 1234.6), '1,235');
});

test('deltas carry an explicit sign', () => {
  const metric = { integer: false };
  assert.equal(formatDelta(metric, 0.25), '+0.250');
  assert.equal(formatDelta(metric, -0.25), '−0.250');
  assert.equal(formatDelta(metric, 0), '0');
  assert.equal(formatDelta(metric, NaN), MISSING);
});

test('percentiles read as plain rank language', () => {
  assert.equal(formatPercentile(0.78), '78th pct');
  // A rank reads as English: 1st, 2nd, 3rd, and the eleven-to-thirteen exceptions.
  assert.equal(formatPercentile(0.01), '1st pct');
  assert.equal(formatPercentile(0.02), '2nd pct');
  assert.equal(formatPercentile(0.03), '3rd pct');
  assert.equal(formatPercentile(0.04), '4th pct');
  assert.equal(formatPercentile(0.11), '11th pct');
  assert.equal(formatPercentile(0.12), '12th pct');
  assert.equal(formatPercentile(0.13), '13th pct');
  assert.equal(formatPercentile(0.21), '21st pct');
  assert.equal(formatPercentile(0.22), '22nd pct');
  assert.equal(formatPercentile(0.23), '23rd pct');
  assert.equal(formatPercentile(0.999), 'top 1%');
  assert.equal(formatPercentile(0.001), 'bottom 1%');
  assert.equal(formatPercentile(NaN), MISSING);
  assert.deepEqual([1, 2, 3, 4, 11, 12, 13, 101, 111].map(ordinalSuffix),
    ['st', 'nd', 'rd', 'th', 'th', 'th', 'th', 'st', 'th']);
});

test('counts, spans, and CSV fields are shaped for reading and for machines', () => {
  assert.equal(formatCount(2711), '2,711');
  assert.equal(formatCount(0), '0');
  assert.equal(formatCount(null), MISSING);
  assert.equal(formatCount(undefined), MISSING);
  assert.equal(formatCount(NaN), MISSING);
  assert.equal(formatSpan(812345, 813100, '+'), '812,345–813,100 (+)');
  assert.equal(csvField('plain'), 'plain');
  assert.equal(csvField('with,comma'), '"with,comma"');
  assert.equal(csvField('say "hi"'), '"say ""hi"""');
  assert.equal(csvField(null), '');
  assert.equal(csvField(undefined), '');
});

test('expression provenance formats coverage counts for the interface', () => {
  const source = {
    organism: 'Synechococcus elongatus PCC 7942',
    isTargetOrganism: false,
    coverage: { withValue: 2551, total: 2715 },
  };
  assert.match(formatExpressionSource(source), /2,551 of 2,715 genes carry a value/);
});

test('source paragraphs retain full field text and match the plain-text description', async () => {
  const { expressionSourceParagraphs } = await import('../../site/js/core/metric-registry.js');
  const { expressionSourceNote } = await import('../../site/js/ui/measurement-provenance.js');
  const { withFakeDocument } = await import('./fake-dom.mjs');
  const source = {
    id: 'study.1', organism: 'S. elongatus PCC 7942', isTargetOrganism: false,
    condition: '1.5% CO2; 30 °C. Two conditions pooled', units: 'log2 ratios',
    coverage: { withValue: 2551, total: 2715 }, caveat: 'Measured elsewhere. Not a native measurement.',
  };
  await withFakeDocument(() => {
    const note = expressionSourceNote(source, 'provenance-warning');
    const paragraphs = note.querySelectorAll('p').map(item => item.textContent);
    assert.equal(paragraphs.length, 6);
    assert.equal(paragraphs.join(' '), formatExpressionSource(source));
    assert.equal(paragraphs[1], `Condition: ${source.condition}.`);
    assert.equal(paragraphs[5], source.caveat);
    assert.deepEqual(expressionSourceParagraphs(null), []);
    assert.equal(expressionSourceNote(null, 'panel-note').childNodes.length, 0);
    assert.equal(formatExpressionSource(null), null);
    const pooled = expressionSourceNote({ ...source, pooledConditions: ['1.5% CO2. Replicate 1', '0.04% CO2'] }, 'provenance-warning');
    assert.deepEqual(pooled.querySelectorAll('li').map(item => item.textContent), ['1.5% CO2. Replicate 1', '0.04% CO2']);
    assert.match(pooled.textContent, /Conditions \(2 datasets pooled\)/);
    assert.ok(!pooled.textContent.includes(source.condition));
    const cautions = expressionSourceNote({ ...source, pooledConditions: ['A', 'B'], poolingCaveat: 'Pooled ranks.', pooledCaveats: ['A is borrowed.', 'B has no growth phase.'] }, 'provenance-warning');
    assert.deepEqual(cautions.querySelectorAll('li').map(item => item.textContent), ['A', 'B', 'A is borrowed.', 'B has no growth phase.']);
    assert.ok(cautions.textContent.includes('Pooled ranks.'));
    assert.ok(!cautions.textContent.includes(source.caveat));
    const identified = expressionSourceNote({ ...source, pooledConditions: ['A', 'B'], pooled: ['dataset-1', 'dataset-2'] }, 'provenance-warning');
    assert.deepEqual(identified.querySelectorAll('li').map(item => item.textContent), ['dataset-1: A', 'dataset-2: B']);
    assert.match(identified.textContent, /Sources and conditions/);
    assert.ok(!identified.textContent.includes(`Source: ${source.id}`));
  });
});

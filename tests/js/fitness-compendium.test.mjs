/**
 * Production invariants of the Fitness Browser PCC 7942 compendium.
 *
 * Ninety condition sets joined the one fitness type that already held nine
 * GSE205443 biofilm fractions. The type pools whatever it is given, so the
 * question these tests pin is what it is given by default: averaging
 * plain-growth fitness, 85 chemical stresses and a biofilm assay would answer
 * none of the three questions.
 *
 * These read the shipped payload rather than a fixture, because the thing worth
 * protecting is the real default a reader gets.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { typeKeyFor, defaultDatasetsOfType, typeLabelFor } from '../../site/js/core/type-metrics.js';

const meta = JSON.parse(
  await readFile(new URL('../../site/data/meta.json', import.meta.url), 'utf8'),
);
const layered = meta.expressionSources.filter((s) => s.payload === 'expression_layers.json');
const fitness = layered.filter((s) => s.record.dataType === 'fitness');
const compendium = fitness.filter((s) => s.record.studyId === 'FitnessBrowser_SynE');
const FITNESS_TYPE = 'type.fitness.rb-tnseq.fitness';

test('the compendium ships ninety condition sets alongside the nine biofilm fractions', () => {
  assert.equal(compendium.length, 90);
  assert.equal(fitness.length, 99);
  assert.equal(typeKeyFor(compendium[0]), FITNESS_TYPE);
  assert.equal(typeLabelFor(compendium[0]), 'Gene fitness (RB-TnSeq)');
});

test('the fitness type defaults to plain growth, not to a pool of ninety-nine', () => {
  const chosen = defaultDatasetsOfType(FITNESS_TYPE, layered);
  assert.equal(chosen.length, 1, 'one default, not an average across conditions');
  assert.equal(chosen[0].record.group, 'standard');
  assert.equal(chosen[0].id, 'FitnessBrowser_SynE_BG_11_with_no_added_compound');
  // The rule that produces this is group === 'standard'. Exactly one dataset of
  // this type may claim it, or the default silently becomes an average again.
  assert.equal(fitness.filter((s) => s.record.group === 'standard').length, 1);
});

test('every stressed condition set is marked as such, so none can become the default', () => {
  const groups = {};
  for (const source of fitness) {
    groups[source.record.group] = (groups[source.record.group] ?? 0) + 1;
  }
  assert.deepEqual(groups, { biofilm: 9, stress: 85, other: 4, standard: 1 });
});

test('every compendium layer is signed and takes a diverging ramp', () => {
  for (const source of compendium) {
    assert.equal(source.signed, true, `${source.id} must be signed`);
    assert.equal(meta.metrics[source.metricKey].scale, 'diverging');
    // A log2 ratio against Time0 is centred on zero, so a sequential or
    // logarithmic ramp would hide the sign that carries the meaning.
    assert.match(source.units, /log2 ratio/);
  }
});

test('every compendium layer joins the same genes through the same route', () => {
  const coverage = new Set(compendium.map((s) => s.coverage.withValue));
  assert.deepEqual([...coverage], [1774], 'one crosswalk, so one coverage');
  for (const source of compendium) {
    assert.equal(source.coverage.total, 2715);
    assert.equal(source.isTargetOrganism, false, 'measured in PCC 7942, not UTEX 2973');
    assert.match(source.ingest.mappingRoute, /^pcc7942_old_locus_tag in identifier-crosswalk/);
    assert.equal(source.ingest.normalization, 'as-deposited');
  }
});

test('a condition set run more than once says it is a mean, and names its experiments', () => {
  const pooled = compendium.filter((s) => s.ingest.columns.length > 1);
  assert.equal(pooled.length, 17, 'seventeen condition sets were repeated');
  for (const source of pooled) {
    assert.match(
      source.record.samples,
      new RegExp(`mean of ${source.ingest.columns.length} experiments`),
      `${source.id} must say how many experiments it averages`,
    );
  }
  const single = compendium.filter((s) => s.ingest.columns.length === 1);
  for (const source of single) {
    assert.match(source.record.samples, /the experiment's published value/);
  }
  // Every one of the compendium's 129 experiments is accounted for exactly once.
  const columns = compendium.flatMap((s) => s.ingest.columns);
  assert.equal(columns.length, 129);
  assert.equal(new Set(columns).size, 129);
});

test('the four axes the experiment table does not record are not reported', () => {
  for (const source of compendium) {
    const { conditions } = source.record;
    for (const axis of ['lightIntensity', 'lightRegime', 'co2', 'phase']) {
      assert.equal(
        conditions[axis].status, 'not reported',
        `${source.id} ${axis} must not be filled in from elsewhere`,
      );
    }
    assert.equal(conditions.temperature.status, 'reported');
    assert.equal(conditions.temperature.lo, 30);
    assert.equal(conditions.medium.status, 'reported');
    assert.equal(conditions.format.status, 'reported');
  }
});

test('every layer carries the strain and the borrowed-measurement caveat', () => {
  for (const source of compendium) {
    assert.equal(source.record.strain, 'PCC 7942');
    assert.equal(source.record.basis, 'transferred');
    assert.match(source.caveat, /not in UTEX 2973/);
    assert.match(source.caveat, /never\s+placed on an expression scale/);
    assert.match(source.label, /\(PCC 7942\)$/);
  }
});

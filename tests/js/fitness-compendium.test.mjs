/**
 * Production invariants of the Fitness Browser PCC 7942 compendium.
 *
 * Ninety condition sets joined the one fitness type that already held nine
 * GSE205443 biofilm fractions. The type pools whatever it is given, so the
 * question these tests pin is its default scope: the owner chose the whole
 * compendium, and the separate biofilm study stays out of that mean.
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

test('the fitness type defaults to the whole compendium, and to nothing else', () => {
  // Owner decision, 2026-10-07: the ninety condition sets pool with each other
  // by default. The boundary that still matters is the study: pooling must not
  // reach across to the biofilm fractions, which answer a different question.
  const chosen = defaultDatasetsOfType(FITNESS_TYPE, layered);
  assert.equal(chosen.length, 90);
  assert.deepEqual(new Set(chosen.map((d) => d.record.studyId)), new Set(['FitnessBrowser_SynE']));
  assert.equal(chosen.filter((d) => d.record.studyId === 'GSE205443').length, 0);
});

test('the compendium still records a stress as a stress, not as standard growth', () => {
  // The default is expressed by study, not by relabelling conditions, so the
  // condition records stay truthful everywhere else in the interface.
  assert.equal(fitness.filter((s) => s.record.group === 'standard').length, 1);
  assert.equal(
    compendium.find((s) => s.record.group === 'standard').id,
    'FitnessBrowser_SynE_BG_11_with_no_added_compound',
  );
});

test('every condition set retains its reported group under the pooled default', () => {
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
    assert.match(source.units, /log2/);
  }
});

test('every compendium layer joins the same genes through the same route', () => {
  const coverage = new Set(compendium.map((s) => s.coverage.withValue));
  assert.deepEqual([...coverage], [1819], 'one crosswalk, so one coverage');
  for (const source of compendium) {
    assert.equal(source.coverage.total, 2715);
    assert.equal(source.isTargetOrganism, false, 'measured in PCC 7942, not UTEX 2973');
    assert.match(source.ingest.mappingRoute, /^pcc7942_old_locus_tag in identifier-crosswalk/);
    assert.equal(source.ingest.normalization, 'as-deposited');
  }
});

test('valid letter-suffix and plasmid identifiers survive the fitness ingest', async () => {
  const payload = JSON.parse(await readFile(new URL('../../site/data/expression_layers.json', import.meta.url), 'utf8'));
  const targets = ['M744_RS06585', 'M744_RS13290', 'M744_RS13440'];
  // Synpcc7942_1912a, Synpcc7942_B2633 and Synpcc7942_B2615 have exact shared
  // protein crosswalks. Digits-only identifier filters used to discard them.
  for (const source of compendium) {
    for (const target of targets) {
      const index = payload.geneIds.indexOf(target);
      assert.ok(index >= 0);
      assert.ok(Number.isFinite(payload.layers[source.metricKey][index]), `${source.id}: ${target}`);
    }
    assert.equal(source.ingest.unmappedIdentifiers, 80, 'unmatched sources remain unknown');
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

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CONDITION_SCALES, DATASET_GROUPS, NO_SELECT_ALL_GROUPS, comparable, conditionRange, datasetsFrom, defaultSelection,
  emptyFilter, formatRange, groupDatasets, isDefaultSelection, normalizeSelection, passesFilters,
  regimeOf, selectedMetricKeys, studyColors, subgroups, summariseSet, dataTypeOfMetric,
} from '../../site/js/core/data-sources.js';

/** A complete record with any field overridden; conditions override per axis. */
function record({ id = 'GSE1', row = 1, group = 'standard', treatments = [], conditions = {}, ...rest } = {}) {
  const axis = (fields) => ({ status: 'reported', text: 'x', quote: 'x', where: 'test', ...fields });
  const base = {
    studyId: id, dataType: 'transcriptomics', platform: 'RNA-seq', strain: 'PCC 7942', basis: 'transferred',
    conditionSet: `${id} set ${row}`, samples: 'x', archiveUrl: 'https://example.org', citation: null,
    replicates: { count: 3, text: 'three', where: 'test' }, treatments, group, conditionTableRow: row,
    conditions: {
      temperature: axis({ lo: 30, hi: 30, unit: '°C' }),
      lightIntensity: axis({ lo: 40, hi: 40, unit: 'µmol photons m⁻² s⁻¹' }),
      lightRegime: axis({ kind: 'continuous', photoperiod: null, spectrumClass: null, entrained: false }),
      co2: axis({ lo: 1, hi: 1, unit: '%' }),
      medium: axis({ base: 'BG-11', modified: false, conditioned: false, nitrogenAltered: false }),
      format: axis({ value: 'planktonic liquid' }),
      phase: axis({ label: 'OD stated', od: [0.3, 0.3], odNm: 750 }),
    },
    ...rest,
  };
  for (const [name, fields] of Object.entries(conditions)) Object.assign(base.conditions[name], fields);
  return base;
}
const dataset = (opts = {}) => {
  const rec = record(opts);
  return { id: `${rec.studyId}.${rec.conditionTableRow}`, metricKey: opts.metricKey ?? `m${rec.studyId}${rec.conditionTableRow}`, label: rec.conditionSet, record: rec, source: {} };
};
const unreported = { status: 'not reported', lo: null, hi: null, where: '' };

test('datasetsFrom keeps only sources with a metric key and a condition record', () => {
  const meta = { expressionSources: [
    { id: 'A', metricKey: 'expression', label: 'A', record: record({ id: 'A' }) },
    { id: 'B', metricKey: 'b' },
    null,
    { id: 'C', label: 'no key', record: record({ id: 'C' }) },
  ] };
  const found = datasetsFrom(meta);
  assert.deepEqual(found.map((d) => d.id), ['A']);
  assert.equal(found[0].label, 'A');
  assert.deepEqual(datasetsFrom({}), []);
});

test('regimeOf reads the contract bands and never guesses for a missing range', () => {
  assert.equal(regimeOf('temperature', [30, 30]), 'standard');
  assert.equal(regimeOf('temperature', [37, 37]), 'elevated');
  assert.equal(regimeOf('temperature', [20, 20]), 'outside');
  assert.equal(regimeOf('lightIntensity', [100, 100]), 'standard');
  assert.equal(regimeOf('lightIntensity', [600, 600]), 'elevated');
  assert.equal(regimeOf('lightIntensity', [300, 500]), 'outside');
  assert.equal(regimeOf('co2', [0.04, 0.04]), 'ambient');
  assert.equal(regimeOf('co2', [3, 3]), 'standard');
  assert.equal(regimeOf('co2', [0.7, 0.7]), 'outside');
  assert.equal(regimeOf('co2', null), 'unknown');
  assert.equal(CONDITION_SCALES.co2.max, 5.5);
});

test('conditionRange returns a reported or conflicting span and null otherwise', () => {
  const d = dataset({ conditions: { co2: unreported, temperature: { status: 'conflicting', lo: 33, hi: 45 } } });
  assert.deepEqual(conditionRange(d, 'temperature'), [33, 45]);
  assert.equal(conditionRange(d, 'co2'), null);
  assert.deepEqual(conditionRange(d, 'lightIntensity'), [40, 40]);
});

test('comparable passes on shared axes within the thresholds and ignores an unreported axis', () => {
  const a = dataset({ id: 'A' });
  const b = dataset({ id: 'B', conditions: { lightIntensity: { lo: 48, hi: 48 }, co2: unreported } });
  assert.equal(comparable(a, b), true);
  const far = dataset({ id: 'C', conditions: { lightIntensity: { lo: 60, hi: 60 } } });
  assert.equal(comparable(a, far), false, 'ratio 1.5 fails the default light tolerance');
  assert.equal(comparable(a, far, { tolerance: 'wide' }), true, 'but passes the widened one');
});

test('comparable needs three shared axes, matching treatments, and agreeing regimes', () => {
  const a = dataset({ id: 'A' });
  const thin = dataset({ id: 'B', conditions: { lightIntensity: unreported, co2: unreported, medium: { base: null } } });
  assert.equal(comparable(a, thin), false, 'only temperature and format are shared');
  assert.equal(comparable(a, dataset({ id: 'C', treatments: ['salt'] })), false);
  assert.equal(comparable(a, dataset({ id: 'D', conditions: { lightRegime: { kind: 'diel', photoperiod: '12:12' } } })), false);
  const diel1 = dataset({ id: 'E', conditions: { lightRegime: { kind: 'diel', photoperiod: '12:12' } } });
  const diel2 = dataset({ id: 'F', conditions: { lightRegime: { kind: 'diel', photoperiod: '8:16' } } });
  assert.equal(comparable(diel1, diel2), false, 'different photoperiods');
  assert.equal(comparable(a, dataset({ id: 'G', conditions: { lightRegime: { spectrumClass: 'warm white LED' } } })), true,
    'a class on one side only does not block');
  assert.equal(comparable(dataset({ id: 'H', conditions: { lightRegime: { spectrumClass: 'cool fluorescent' } } }),
    dataset({ id: 'I', conditions: { lightRegime: { spectrumClass: 'warm white LED' } } })), false);
  assert.equal(comparable(a, dataset({ id: 'J', conditions: { temperature: { lo: 37, hi: 37 } } })), false);
  assert.equal(comparable(a, dataset({ id: 'K', conditions: { co2: { lo: 3, hi: 3 } } })), false, 'factor 3 on CO₂');
  assert.equal(comparable(a, dataset({ id: 'L', conditions: { medium: { conditioned: true } } })), false);
  assert.equal(comparable(a, dataset({ id: 'M', conditions: { format: { value: 'solid plate' } } })), false);
  assert.equal(comparable(dataset({ id: 'N', conditions: { phase: { label: 'exponential' } } }),
    dataset({ id: 'O', conditions: { phase: { label: 'stationary' } } })), false);
});

test('an owner judgement overrides the rule; a conditional one only where checkable', () => {
  const a = dataset({ id: 'A', row: 3 });
  const far = dataset({ id: 'B', row: 40, conditions: { lightIntensity: { lo: 60, hi: 60 } } });
  const share = [{ a: { studyId: 'A', row: 3 }, b: { studyId: 'B', row: 40 }, call: 'share' }];
  const separate = [{ a: { studyId: 'B', row: 40 }, b: { studyId: 'A', row: 3 }, call: 'separate' }];
  assert.equal(comparable(a, far, { judgements: share }), true);
  assert.equal(comparable(a, dataset({ id: 'B', row: 40 }), { judgements: separate }), false, 'order of the pair does not matter');
  assert.equal(comparable(a, dataset({ id: 'B', row: 40 }), { judgements: [{ ...separate[0], call: 'undecided' }] }), false);
  const conditional = [{ ...share[0], call: 'conditional' }];
  assert.equal(comparable(a, far, { judgements: conditional }), true, 'both continuous: the condition holds');
  const noKind = dataset({ id: 'B', row: 40, conditions: { lightIntensity: { lo: 60, hi: 60 }, lightRegime: { kind: null } } });
  assert.equal(comparable(a, noKind, { judgements: conditional }), false, 'not checkable: back to the rule, which fails on light');
});

test('subgroups are complete-linkage sets, and a group splits only when there is something to split', () => {
  const a = dataset({ id: 'A' }); const b = dataset({ id: 'B' });
  const c = dataset({ id: 'C', conditions: { temperature: { lo: 37, hi: 37 } }, group: 'standard' });
  const { sets, singles } = subgroups([a, b, c]);
  assert.deepEqual(sets.map((s) => s.map((d) => d.id)), [['A.1', 'B.1']]);
  assert.deepEqual(singles.map((d) => d.id), ['C.1']);
  const groups = groupDatasets([a, b, c]);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].id, 'standard');
  assert.equal(groups[0].split, true);
  assert.equal(groups[0].selectAll, true);
  assert.equal(summariseSet(groups[0].sets[0]), '30 °C · 40 µmol · 1 % CO₂ · continuous light');
  const one = groupDatasets([a, b]);
  assert.equal(one[0].split, false, 'one comparable set covering the group needs no subgroup header');
  const none = groupDatasets([a, c]);
  assert.equal(none[0].split, false, 'all singles need no subgroup header either');
  const other = groupDatasets([dataset({ id: 'X', group: 'other' })]);
  assert.equal(other[0].selectAll, false);
  assert.equal(DATASET_GROUPS.length, 7);
});

test('formatRange and summariseSet read the records as reported', () => {
  assert.equal(formatRange([30, 30], '°C'), '30 °C');
  assert.equal(formatRange([5, 30], 'µmol'), '5–30 µmol');
  assert.equal(summariseSet([dataset({ conditions: { temperature: unreported, lightIntensity: unreported, co2: unreported, lightRegime: { kind: null } } })]), '');
});

test('studyColors assigns hues in a fixed order and folds the ninth study to neutral', () => {
  const sets = Array.from({ length: 9 }, (_, i) => dataset({ id: `S${i}` }));
  const colors = studyColors([...sets, dataset({ id: 'S0', row: 2 })]);
  assert.equal(colors.size, 9);
  assert.equal(colors.get('S0'), '#2a78d6');
  assert.equal(colors.get('S8'), '#8b9199');
});

test('filters keep what they say and treat a missing range value as the reader asks', () => {
  const warm = dataset({ id: 'A', conditions: { temperature: { lo: 37, hi: 37 } } });
  const cool = dataset({ id: 'B' });
  const silent = dataset({ id: 'C', conditions: { temperature: unreported } });
  const range = { ...emptyFilter('temperature'), min: 36, max: 40 };
  assert.deepEqual([warm, cool, silent].filter((d) => passesFilters(d, [range])).map((d) => d.id), ['A.1']);
  assert.deepEqual([warm, cool, silent].filter((d) => passesFilters(d, [{ ...range, includeMissing: true }])).map((d) => d.id), ['A.1', 'C.1']);
  assert.equal(passesFilters(cool, [{ ...emptyFilter('strain'), values: ['UTEX 2973'] }]), false);
  assert.equal(passesFilters(cool, [emptyFilter('strain')]), true, 'no value chosen keeps everything');
  assert.equal(passesFilters(cool, [{ ...emptyFilter('study'), query: 'b set' }]), true);
  assert.equal(passesFilters(cool, [{ ...emptyFilter('study'), query: 'zzz' }]), false);
  assert.equal(passesFilters(cool, [{ ...emptyFilter('treatment'), values: ['none recorded'] }]), true);
  assert.equal(passesFilters(cool, [{ field: 'unknown' }]), true, 'an unknown field filters nothing');
  assert.equal(emptyFilter('unknown'), null);
  assert.deepEqual(emptyFilter('regime'), { field: 'regime', values: [] });
});

test('the default selection is the standard group plus the two legacy metrics, and bad lists fall back to it', () => {
  const shipped = dataset({ id: 'GSE205444', group: 'biofilm', metricKey: 'expression' });
  const tan = dataset({ id: 'TAN', group: 'other', metricKey: 'tssInitiation' });
  const std = dataset({ id: 'STD', group: 'standard' });
  const extra = dataset({ id: 'EXTRA', group: 'diel' });
  const all = [shipped, tan, std, extra];
  assert.deepEqual(defaultSelection(all), ['GSE205444.1', 'STD.1', 'TAN.1']);
  assert.deepEqual(normalizeSelection(['EXTRA.1', 'nope', 'EXTRA.1'], all), ['EXTRA.1']);
  assert.deepEqual(normalizeSelection([], all), defaultSelection(all));
  assert.deepEqual(normalizeSelection('junk', all), defaultSelection(all));
  assert.equal(isDefaultSelection(['TAN.1', 'STD.1', 'GSE205444.1'], all), true);
  assert.equal(isDefaultSelection(['EXTRA.1'], all), false);
  assert.deepEqual([...selectedMetricKeys(['EXTRA.1'], all)], ['mEXTRA1']);
  assert.equal(dataTypeOfMetric('expression', all), 'transcriptomics');
  assert.equal(dataTypeOfMetric('cai', all), null);
  assert.equal(dataTypeOfMetric('type.transcriptomics.rna-seq.abundance', all), 'transcriptomics', 'the colour menu offers type keys');
  assert.equal(dataTypeOfMetric('type.proteomics.lc-ms-ms.abundance', all), null, 'no dataset of that type');
});

test('an engineered strain is listed in its own group, before Other, with select-all', () => {
  const ids = DATASET_GROUPS.map((group) => group.id);
  assert.ok(ids.indexOf('engineered') > ids.indexOf('standard'));
  assert.equal(ids.indexOf('engineered'), ids.indexOf('other') - 1);
  assert.match(DATASET_GROUPS.find((group) => group.id === 'engineered').rule, /rather than the wild type/);
  assert.ok(!NO_SELECT_ALL_GROUPS.includes('engineered'));
  const grouped = groupDatasets([dataset({ id: 'ENG', group: 'engineered' })]);
  assert.ok(grouped.some((group) => group.id === 'engineered' && group.datasets.length === 1));
});

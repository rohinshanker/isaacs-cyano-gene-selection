/**
 * The strain-fitness layer: its fail-closed schema, and the two exports.
 *
 * The layer's whole purpose is to carry measurements whose row unit is not a
 * gene without letting them be read as anything else, so these tests are about
 * refusals as much as about values: a file in the wrong data directory, a unit
 * the file did not declare, a no-growth row with a doubling time, a `"0"` where
 * a number belongs, and a strain label used twice.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import {
  EXPORT_MISSING, GROWTH_COLUMNS, GROWTH_STATUS, WELL_COLUMNS, growthSummary, growthTsv,
  selectGrowth, selectWells, selectionLabels, validateStrainFitness, wellsTsv,
} from '../../site/js/core/strain-fitness.js';
import {
  DEFAULT_ORGANISM, STUDY_LAYER_KEYS, organismById,
} from '../../site/js/core/organisms.js';
import {
  DATA_FILES, DATA_FILE_BY_KEY, FILE_STATE, TIER_LABELS, publishesFile,
} from '../../site/js/core/data-files.js';
import { loadDatasetStaged } from '../../site/js/core/dataset.js';
import { buildFixture } from '../fixtures/make_fixture.mjs';
import { memoryDirectory } from './helpers.mjs';

const DATA_URL = 'https://example.test/site/data/';

const FIXTURE_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../fixtures/data-strain-fitness');

/** The generator's layer, parsed afresh for each test that mutates it. */
function raw() {
  return JSON.parse(buildFixture({ genes: 40, strainFitness: true })
    .files['strain_fitness.json']);
}

/** The dataset fields the validator reads: the organism and the assembly. */
function host(organism = DEFAULT_ORGANISM) {
  return { organism, meta: { genome: { accession: organism.genome.accession } } };
}

function load(mutate = () => {}) {
  const document = raw();
  mutate(document);
  return validateStrainFitness(document, host());
}

/** `mutate` must be refused, with a message that names the file. */
function refuses(message, mutate) {
  assert.throws(() => load(mutate), (error) => {
    assert.match(error.message, /^strain_fitness\.json /);
    assert.match(error.message, message);
    return true;
  }, String(message));
}

// --- Identity -------------------------------------------------------------

test('the file declares whose data it is, and is refused when that is not this dataset', () => {
  const layer = load();
  assert.equal(layer.organismId, DEFAULT_ORGANISM.id);
  assert.equal(layer.genome.accession, DEFAULT_ORGANISM.genome.accession);
  // The layer is organism-neutral, so nothing but this check stands between a
  // file dropped into the wrong data directory and one organism's strains drawn
  // under another organism's labels.
  const ecoli = organismById('ecoli-k12-mg1655');
  assert.throws(() => validateStrainFitness(raw(), host(ecoli)),
    /declares organism utex2973, not ecoli-k12-mg1655/);
  refuses(/declares assembly GCF_000000000\.0, not GCF_000817325\.1/, (document) => {
    document.genome.accession = 'GCF_000000000.0';
  });
  refuses(/declares assembly none/, (document) => { delete document.genome; });
  refuses(/declares schema version 2, not 1/, (document) => { document.schemaVersion = 2; });
  for (const notAFile of [null, 'text', [], 42]) {
    assert.throws(() => validateStrainFitness(notAFile, host()), /is not an object/,
      JSON.stringify(notAFile));
  }
});

test('a file with no declared provenance class does not load', () => {
  assert.equal(load().provenanceClass, 'synthetic-test-fixture');
  refuses(/declares provenance class none/, (document) => { delete document.provenanceClass; });
  refuses(/declares provenance class real/, (document) => { document.provenanceClass = 'real'; });
});

test('the source is cited, pinned by checksum, and dated', () => {
  const { source } = load();
  assert.match(source.sourceFileSha256, /^[0-9a-f]{64}$/);
  assert.equal(source.retrieved, '2026-10-07');
  assert.equal(source.studyId, 'FIXTURE_STRAIN_FITNESS');
  refuses(/has no source citation/, (document) => { document.source.citation = ''; });
  refuses(/has no SHA-256 for its source file/, (document) => {
    document.source.sourceFileSha256 = 'abc';
  });
  refuses(/has no ISO retrieval date/, (document) => { document.source.retrieved = 'last week'; });
  refuses(/has no source block/, (document) => { document.source = null; });
});

// --- Units ----------------------------------------------------------------

test('nothing loads without the unit, reference and normalization the file declares', () => {
  const layer = load();
  assert.equal(layer.growth.units.doublingTime, 'minutes');
  // Deliberately not an OD scale: this build asserts nothing about what a
  // Biolog value is, and the source's own words are what a reader is shown.
  assert.match(layer.biolog.units.value, /arbitrary units/);
  assert.match(layer.biolog.units.reference, /unmodified parent/);
  refuses(/has no declared doubling-time unit/, (document) => {
    delete document.growth.units.doublingTime;
  });
  refuses(/has no declared maximum-OD600 unit/, (document) => {
    document.growth.units.maximumOd600 = '   ';
  });
  refuses(/has no declared biolog value unit/, (document) => { delete document.biolog.units.value; });
  refuses(/has no declared biolog value reference/, (document) => {
    delete document.biolog.units.reference;
  });
  refuses(/has no declared biolog normalization/, (document) => {
    delete document.biolog.units.normalization;
  });
  refuses(/has no growth units/, (document) => { document.growth.units = null; });
  refuses(/has no growth metadata/, (document) => { document.growth.metadata = {}; });
  refuses(/has no biolog metadata/, (document) => { delete document.biolog.metadata; });
});

// --- Strains, schemes and conditions --------------------------------------

test('every strain names its scheme explicitly, native included', () => {
  const layer = load();
  const native = layer.strains.find((strain) => strain.id === 'parent');
  // An unmodified parent is a labelled arm of the experiment, not a blank cell.
  assert.deepEqual(native.scheme, { label: 'native', recoded: false, segments: null });
  const recoded = layer.strains.find((strain) => strain.id === 'seg-b');
  assert.equal(recoded.scheme.recoded, true);
  assert.equal(recoded.scheme.segments, '70-81');
  refuses(/has no scheme for strain parent/, (document) => { delete document.strains[0].scheme; });
  refuses(/has no recoded flag for strain parent/, (document) => {
    delete document.strains[0].scheme.recoded;
  });
  refuses(/has no scheme label for strain parent/, (document) => {
    document.strains[0].scheme.label = '';
  });
});

test('two strains or conditions cannot share one label, and none may go unmeasured', () => {
  refuses(/repeats the strain label/, (document) => {
    document.strains[1].label = document.strains[0].label;
  });
  refuses(/repeats strain id parent/, (document) => { document.strains[1].id = 'parent'; });
  refuses(/repeats the condition label/, (document) => {
    document.conditions[1].label = document.conditions[0].label;
  });
  // A declared label nobody measures would sit in the filters as a choice that
  // matches nothing.
  refuses(/declares strain unused and measures it nowhere/, (document) => {
    document.strains.push({
      id: 'unused', label: 'Never measured', scheme: { label: 'native', recoded: false, segments: null },
    });
  });
  refuses(/declares condition spare and measures it nowhere/, (document) => {
    document.conditions.push({ id: 'spare', label: 'Never measured', description: null });
  });
  refuses(/names unknown strain ghost/, (document) => {
    document.growth.records[0].strainId = 'ghost';
  });
  refuses(/names unknown condition ghost/, (document) => {
    document.biolog.records[0].conditionId = 'ghost';
  });
  refuses(/names unknown plate PM9/, (document) => { document.biolog.records[0].plateId = 'PM9'; });
});

// --- The two distinctions the layer exists to protect ---------------------

test('no growth has no doubling time, and never a doubling time of zero minutes', () => {
  const layer = load();
  const stalled = layer.growth.records.find(
    (record) => record.growthStatus === GROWTH_STATUS.NO_GROWTH,
  );
  assert.equal(stalled.doublingTimeMinutes, null);
  assert.equal(stalled.doublingTimeSdMinutes, null);
  refuses(/reports no growth and a doubling time/, (document) => {
    document.growth.records[5].doublingTimeMinutes = 120;
  });
  // Zero minutes would read, and plot, as infinitely fast growth.
  refuses(/has a doubling time for record g-parent-rich that is not above zero/, (document) => {
    document.growth.records[0].doublingTimeMinutes = 0;
  });
  refuses(/has a negative doubling-time SD for record g-parent-rich/, (document) => {
    document.growth.records[0].doublingTimeSdMinutes = -1;
  });
  refuses(/has a doubling-time SD with no doubling time/, (document) => {
    document.growth.records[0].doublingTimeMinutes = null;
  });
  refuses(/has no reported or no_growth_detected growth status/, (document) => {
    document.growth.records[0].growthStatus = 'slow';
  });
});

test('a measured zero is kept, an unmeasured value stays null, and a numeric string is refused', () => {
  const layer = load();
  const stalled = layer.growth.records.find(
    (record) => record.growthStatus === GROWTH_STATUS.NO_GROWTH,
  );
  // One row holds both: a real 0 among the replicates and a layer-wide rule
  // that null means unmeasured.
  assert.deepEqual(stalled.maximumOd600Replicates.map((entry) => entry.value), [0, 0.05, 0.04]);
  const unmeasured = layer.growth.records.find((record) => record.id === 'g-seg-a-minimal');
  assert.equal(unmeasured.maximumOd600, null);
  assert.deepEqual(unmeasured.maximumOd600Replicates, []);
  // A spreadsheet export that wrote "0" for "no value" must not enter as a
  // measurement, so a string is refused however numeric it looks.
  refuses(/has a non-numeric maximum OD600 for record g-parent-rich/, (document) => {
    document.growth.records[0].maximumOd600 = '0';
  });
  refuses(/has a non-numeric biolog value/, (document) => { document.biolog.records[0].value = '0'; });
  refuses(/has a negative maximum OD600/, (document) => {
    document.growth.records[0].maximumOd600 = -0.2;
  });
  refuses(/has a maximum-OD600 SD with no maximum OD600/, (document) => {
    document.growth.records[0].maximumOd600 = null;
  });
});

test('Biolog values keep their sign and their exact well, and no well is measured twice', () => {
  const layer = load();
  const values = layer.biolog.records.map((record) => record.value);
  assert.ok(values.some((value) => value < 0), 'a value below its reference is a real result');
  assert.ok(values.some((value) => value === 0));
  assert.ok(values.some((value) => value === null));
  refuses(/has no 96-well plate position/, (document) => { document.biolog.records[0].well = 'A1'; });
  refuses(/has no 96-well plate position/, (document) => { document.biolog.records[0].well = 'I01'; });
  refuses(/has no 96-well plate position/, (document) => { document.biolog.records[0].well = 'A13'; });
  refuses(/measures parent\/biolog-48h\/PM1\/A01 twice/, (document) => {
    document.biolog.records[1].well = 'A01';
  });
  refuses(/has no substrate for record/, (document) => {
    document.biolog.records[0].substrate = '';
  });
  refuses(/repeats record id b-parent-PM1-A01/, (document) => {
    document.growth.records[0].id = 'b-parent-PM1-A01';
  });
});

test('replicate numbers are explicit, so a gap cannot be read as a renumbering', () => {
  const sparse = load().growth.records.find((record) => record.id === 'g-seg-a-minimal');
  assert.deepEqual(sparse.doublingTimeReplicates,
    [{ replicate: 1, value: 90.2 }, { replicate: 3, value: 102.6 }]);
  refuses(/repeats replicate 1 in the doubling-time replicates of record g-parent-rich/,
    (document) => { document.growth.records[0].doublingTimeReplicates[1].replicate = 1; });
  refuses(/has an entry with no positive replicate number in the doubling-time replicates/,
    (document) => { document.growth.records[0].doublingTimeReplicates[0].replicate = 0; });
  refuses(/has a maximum-OD600 replicates of record g-parent-rich that is not an array/,
    (document) => { document.growth.records[0].maximumOd600Replicates = {}; });
  refuses(/has a non-numeric replicate in the maximum-OD600 replicates/, (document) => {
    document.growth.records[0].maximumOd600Replicates[0].value = '1.8';
  });
});

test('a file with neither layer, or with neither records array, does not load', () => {
  refuses(/carries neither a growth nor a biolog layer/, (document) => {
    document.growth = null;
    document.biolog = null;
  });
  refuses(/has a growth block with no records array/, (document) => { document.growth.records = {}; });
  refuses(/has a biolog block with no records array/, (document) => { delete document.biolog.records; });
  // Either layer alone is a complete file: the real source's growth table
  // covers many more strains than its Biolog plates do. Its Biolog-only
  // condition goes with it, because a condition nothing measures is refused.
  const growthOnly = load((document) => {
    document.biolog = null;
    document.conditions = document.conditions.filter((entry) => entry.id !== 'biolog-48h');
  });
  assert.equal(growthOnly.biolog, null);
  assert.equal(growthOnly.growth.records.length, 6);
});

// --- Selection ------------------------------------------------------------

test('a selection narrows by strain and condition, and counts rather than averages', () => {
  const layer = load();
  assert.equal(selectGrowth(layer).length, 6);
  assert.equal(selectGrowth(layer, { strainId: 'seg-b' }).length, 2);
  assert.equal(selectGrowth(layer, { conditionId: 'rich-37' }).length, 3);
  assert.equal(selectGrowth(layer, { strainId: 'seg-b', conditionId: 'minimal-37' }).length, 1);
  const summary = growthSummary(selectGrowth(layer));
  assert.deepEqual(summary,
    { records: 6, strains: 3, conditions: 2, noGrowth: 1, withDoublingTime: 5 });
  assert.equal(selectWells(layer).length, 24);
  assert.equal(selectWells(layer, { strainId: 'parent' }).length, 8);
  assert.equal(selectWells(layer, { query: 'glucose' }).length, 3);
  assert.equal(selectWells(layer, { query: 'PM2' }).length, 12);
  assert.equal(selectWells(layer, { query: 'A01' }).length, 6);
  assert.equal(selectWells(layer, { query: 'no such thing' }).length, 0);
  // Biolog records belong to their own condition, so a growth condition selects
  // no wells rather than silently selecting all of them.
  assert.equal(selectWells(layer, { conditionId: 'rich-37' }).length, 0);
  assert.deepEqual(selectionLabels(layer, {}),
    { strain: 'All strains', scheme: 'All schemes', segments: null, condition: 'All conditions' });
  assert.deepEqual(selectionLabels(layer, { strainId: 'seg-b', conditionId: 'minimal-37' }), {
    strain: 'Segment set B (synthetic)',
    scheme: 'seven-codon recoding (synthetic)',
    segments: '70-81',
    condition: 'Minimal medium, 37 C, shaking (synthetic)',
  });
});

// --- Export ---------------------------------------------------------------

function parse(text) {
  const lines = text.replace(/\n$/, '').split('\n');
  const meta = new Map(lines.filter((line) => line.startsWith('# '))
    .map((line) => line.slice(2).split('\t')));
  const body = lines.filter((line) => !line.startsWith('# '));
  return { meta, header: body[0].split('\t'), rows: body.slice(1).map((line) => line.split('\t')) };
}

test('an export names its source, units and selection, and is the same bytes every time', () => {
  const layer = load();
  const selection = { strainId: 'seg-b', conditionId: 'minimal-37' };
  const text = growthTsv(layer, selection);
  assert.equal(text, growthTsv(layer, selection), 'deterministic');
  assert.ok(text.endsWith('\n'));
  const { meta, header, rows } = parse(text);
  assert.deepEqual(header, [...GROWTH_COLUMNS]);
  assert.equal(meta.get('organism'), 'utex2973 GCF_000817325.1');
  assert.equal(meta.get('provenance'), 'synthetic-test-fixture');
  assert.equal(meta.get('source'), 'Synthetic strain-fitness fixture, not a publication');
  assert.match(meta.get('sourceFileSha256'), /^[0-9a-f]{64}$/);
  assert.equal(meta.get('sourceRetrieved'), '2026-10-07');
  assert.equal(meta.get('sourceSheet'), 'generated by tests/fixtures/make_fixture.mjs');
  // A field the file leaves null is NA here too, never an empty line.
  assert.equal(meta.get('sourceDoi'), 'NA');
  assert.equal(meta.get('doublingTimeUnit'), 'minutes');
  // The file says which slice of the layer it is, because a filtered table
  // that did not would read as the whole of it.
  assert.equal(meta.get('selectedStrain'), 'Segment set B (synthetic)');
  assert.equal(meta.get('selectedSegments'), '70-81');
  assert.equal(meta.get('selectedCondition'), 'Minimal medium, 37 C, shaking (synthetic)');
  assert.equal(meta.get('rows'), '1');
  assert.equal(rows.length, 1);
  const row = Object.fromEntries(GROWTH_COLUMNS.map((name, i) => [name, rows[0][i]]));
  // The one row carries its own strain, scheme, condition, unit and source.
  assert.equal(row.strain, 'Segment set B (synthetic)');
  assert.equal(row.scheme, 'seven-codon recoding (synthetic)');
  assert.equal(row.recoded, 'true');
  assert.equal(row.condition, 'Minimal medium, 37 C, shaking (synthetic)');
  assert.equal(row.growthStatus, 'no_growth_detected');
  assert.equal(row.doublingTimeUnit, 'minutes');
  assert.equal(row.source, 'FIXTURE_STRAIN_FITNESS');
  // NA, not an empty cell, and not a zero.
  assert.equal(row.doublingTime, EXPORT_MISSING);
  assert.equal(row.doublingTimeSd, EXPORT_MISSING);
  assert.equal(row.doublingTimeReplicates, EXPORT_MISSING);
  assert.equal(row.maximumOd600, '0.03');
  assert.equal(row.maximumOd600Replicates, '1=0;2=0.05;3=0.04');
});

test('an export orders its rows by what they are, not by where they sat in the file', () => {
  const layer = load();
  const shuffled = validateStrainFitness({
    ...raw(),
    growth: { ...raw().growth, records: [...raw().growth.records].reverse() },
    biolog: { ...raw().biolog, records: [...raw().biolog.records].reverse() },
  }, host());
  assert.equal(growthTsv(shuffled), growthTsv(layer));
  assert.equal(wellsTsv(shuffled), wellsTsv(layer));
  const { rows } = parse(growthTsv(layer));
  assert.deepEqual(rows.map((row) => `${row[0]}|${row[4]}`), [
    'Segment set A (synthetic)|Minimal medium, 37 C, shaking (synthetic)',
    'Segment set A (synthetic)|Rich medium, 37 C, shaking (synthetic)',
    'Segment set B (synthetic)|Minimal medium, 37 C, shaking (synthetic)',
    'Segment set B (synthetic)|Rich medium, 37 C, shaking (synthetic)',
    'Unmodified parent (synthetic)|Minimal medium, 37 C, shaking (synthetic)',
    'Unmodified parent (synthetic)|Rich medium, 37 C, shaking (synthetic)',
  ]);
});

test('a Biolog export repeats the declared unit, reference and normalization on every row', () => {
  const layer = load();
  const { meta, header, rows } = parse(wellsTsv(layer, { query: 'glucose' }));
  assert.deepEqual(header, [...WELL_COLUMNS]);
  assert.equal(meta.get('substrateQuery'), 'glucose');
  assert.equal(meta.get('valueUnit'), layer.biolog.units.value);
  assert.equal(meta.get('valueReference'), layer.biolog.units.reference);
  assert.equal(meta.get('valueNormalization'), layer.biolog.units.normalization);
  assert.equal(meta.get('rows'), '3');
  const named = rows.map((row) => Object.fromEntries(WELL_COLUMNS.map((name, i) => [name, row[i]])));
  assert.deepEqual(named.map((row) => row.strain), [
    'Segment set A (synthetic)', 'Segment set B (synthetic)', 'Unmodified parent (synthetic)',
  ]);
  for (const row of named) {
    assert.equal(row.valueUnit, layer.biolog.units.value);
    assert.equal(row.valueReference, layer.biolog.units.reference);
    assert.equal(row.valueNormalization, layer.biolog.units.normalization);
    assert.equal(row.well, 'A02');
    assert.equal(row.substrate, 'D-glucose');
  }
  assert.deepEqual(named.map((row) => row.value), ['0.84', '0.52', '0.91']);
  // A measured zero is a 0 in the same column a null writes NA in, so the two
  // can be told apart by a reader and by whatever parses the file.
  const zero = parse(wellsTsv(layer, { strainId: 'parent', query: 'Negative control' }));
  assert.equal(zero.rows[0][WELL_COLUMNS.indexOf('value')], '0');
  const nulls = parse(wellsTsv(layer, { strainId: 'seg-a', query: 'acetate' }));
  assert.equal(nulls.rows[0][WELL_COLUMNS.indexOf('value')], EXPORT_MISSING);
});

test('a tab or newline inside a source label cannot break a row apart', () => {
  const layer = load((document) => {
    document.strains[0].label = 'Parent\twith a tab\nand a newline';
  });
  const { rows } = parse(growthTsv(layer, { strainId: 'parent' }));
  assert.equal(rows.length, 2);
  for (const row of rows) {
    assert.equal(row.length, GROWTH_COLUMNS.length);
    assert.equal(row[0], 'Parent with a tab and a newline');
  }
});

// --- The fixture on disk --------------------------------------------------

test('the fixture directory the rendered checks read holds the layer the generator builds', async () => {
  const onDisk = await readFile(`${FIXTURE_DIR}/strain_fitness.json`, 'utf8');
  assert.equal(onDisk, buildFixture({ strainFitness: true }).files['strain_fitness.json']);
  const layer = validateStrainFitness(JSON.parse(onDisk), host());
  // Loud enough that no screenshot of it can be mistaken for evidence.
  assert.equal(layer.provenanceClass, 'synthetic-test-fixture');
  assert.ok(layer.strains.every((strain) => strain.label.includes('synthetic')));
});

// --- Through the loader ---------------------------------------------------

/** The fixture as an in-memory data directory, with `strain_fitness.json` replaced. */
function directory(replacement) {
  const files = buildFixture({ genes: 40, strainFitness: true }).files;
  if (replacement === undefined) delete files['strain_fitness.json'];
  else files['strain_fitness.json'] = replacement;
  return memoryDirectory(DATA_URL, files);
}

async function loadWith(replacement) {
  const { fetchImpl, requested } = directory(replacement);
  const staged = loadDatasetStaged({ baseUrl: DATA_URL, fetchImpl, organism: DEFAULT_ORGANISM });
  const dataset = await staged.core;
  await staged.settled;
  return { dataset, requested };
}

test('the layer is asked for whatever the organism is, and joins nothing onto a gene', async () => {
  const { dataset, requested } = await loadWith();
  // Organism-neutral: no record declares this layer, so the request is made for
  // every organism and the file itself is what says whose data it is.
  assert.ok(requested.includes('strain_fitness.json'));
  const { dataset: loaded } = await loadWith(
    buildFixture({ genes: 40, strainFitness: true }).files['strain_fitness.json'],
  );
  assert.equal(loaded.files.strainFitness.state, FILE_STATE.READY);
  assert.equal(loaded.strainFitness.growth.records.length, 6);
  assert.ok(loaded.genes.every((gene) => !('strainFitness' in gene)),
    'no gene carries a strain measurement');
  // A release that does not publish it is absent, not failed, and the layer is
  // null rather than an empty table.
  assert.equal(dataset.files.strainFitness.state, FILE_STATE.ABSENT);
  assert.equal(dataset.strainFitness, null);
});

test('a malformed layer fails on its own and leaves the gene dataset usable', async () => {
  for (const [name, body] of [
    ['invalid JSON', '{not json'],
    ['a wrong organism', JSON.stringify({ ...raw(), organismId: 'ecoli-k12-mg1655' })],
    ['a no-growth row with a doubling time', JSON.stringify((() => {
      const document = raw();
      document.growth.records[5].doublingTimeMinutes = 90;
      return document;
    })())],
  ]) {
    const { dataset } = await loadWith(body);
    assert.equal(dataset.files.strainFitness.state, FILE_STATE.FAILED, name);
    assert.equal(dataset.strainFitness, null, name);
    assert.equal(dataset.files.strainFitness.blockedBy, null, name);
    // The whole point of the tier: nothing the map or the gene detail draws
    // waits on this file, so a file that cannot be read costs only its own tab.
    assert.equal(dataset.genes.length, 40, name);
    assert.equal(dataset.files.genes.state, FILE_STATE.READY, name);
    for (const key of ['meta', 'codonPca', 'excluded']) {
      assert.equal(dataset.files[key].state, FILE_STATE.READY, `${name}: ${key}`);
    }
  }
});

test('the layer is last in the loading order and has a tier name of its own', () => {
  const file = DATA_FILE_BY_KEY.strainFitness;
  assert.equal(file.name, 'strain_fitness.json');
  assert.equal(file.required, false);
  assert.deepEqual([...file.needs], [], 'it reads no other file');
  assert.equal(file.tier, Math.max(...DATA_FILES.map((entry) => entry.tier)));
  assert.equal(TIER_LABELS[file.tier], 'strain fitness');
  // It must never be mistaken for a study-bound layer: those are skipped for an
  // organism whose record does not declare them, which would make the file
  // unreachable, since no record declares this one.
  assert.ok(!STUDY_LAYER_KEYS.includes('strainFitness'));
  assert.equal(publishesFile(DEFAULT_ORGANISM, file), true);
  assert.equal(publishesFile(organismById('ecoli-k12-mg1655'), file), true);
});


test('replicates enforce measurement bounds and categorical no-growth absence', () => {
  const row = (d) => d.growth.records.find((r) => r.growthStatus === GROWTH_STATUS.NO_GROWTH);
  refuses(/no growth and a measured doubling-time replicate/, (d) => {
    row(d).doublingTimeReplicates = [{ replicate: 1, value: 24 }];
  });
  for (const value of [0, -1]) {
    refuses(/not above zero/, (d) => {
      d.growth.records[0].doublingTimeReplicates = [{ replicate: 1, value }];
    });
  }
  refuses(/negative/, (d) => {
    d.growth.records[0].maximumOd600Replicates = [{ replicate: 1, value: -0.1 }];
  });
  const layer = load((d) => {
    row(d).doublingTimeReplicates = [{ replicate: 1, value: null }];
    d.growth.records[0].maximumOd600Replicates = [{ replicate: 1, value: 0 }];
  });
  assert.equal(layer.growth.records[0].maximumOd600Replicates[0].value, 0);
});

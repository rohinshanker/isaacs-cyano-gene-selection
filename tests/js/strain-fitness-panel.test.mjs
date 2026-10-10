/**
 * The Strain fitness tab's rendering.
 *
 * What these hold is that no number reaches the screen without the words that
 * make it readable — its unit, its strain, its scheme, its condition and its
 * source — and that the three states the layer can be in are three different
 * sentences: absent, still loading, and failed.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  STRAIN_FITNESS_TAB, StrainFitnessPanel, UNAVAILABLE_TEXT,
} from '../../site/js/ui/strain-fitness.js';
import { validateStrainFitness } from '../../site/js/core/strain-fitness.js';
import { DEFAULT_ORGANISM } from '../../site/js/core/organisms.js';
import { MISSING } from '../../site/js/ui/format.js';
import { FILE_STATE } from '../../site/js/core/data-files.js';
import { buildFixture } from '../fixtures/make_fixture.mjs';
import { withFakeDocument } from './fake-dom.mjs';

const raw = JSON.parse(buildFixture({ genes: 40, strainFitness: true })
  .files['strain_fitness.json']);
const catalogue = Object.freeze([Object.freeze({
  id: 'fixture-fitness', label: 'Fixture whole-strain fitness', file: 'strain_fitness.json',
})]);

function model(layer, pending = null, overrides = {}) {
  if (!layer && !pending) return { catalogue: [], selection: null, resource: null };
  return {
    catalogue,
    selection: {
      dataset: catalogue[0], origin: 'local', originIds: ['fixture-fitness'],
      ambiguousIds: [], showLocalSelector: true,
      ...overrides.selection,
    },
    resource: layer
      ? { state: FILE_STATE.READY, data: layer, error: null }
      : { state: pending, data: null, error: pending === FILE_STATE.FAILED ? new Error('fixture failed') : null },
  };
}

function layerFor(mutate = () => {}) {
  const document = JSON.parse(JSON.stringify(raw));
  mutate(document);
  return validateStrainFitness(document, {
    organism: DEFAULT_ORGANISM,
    meta: { genome: { accession: DEFAULT_ORGANISM.genome.accession } },
  });
}

/** Mount the panel and return the host plus a few conveniences. */
function mount(document, layer, pending = null, options = {}) {
  const host = document.createElement('div');
  document.body.append(host);
  const panel = new StrainFitnessPanel(host, { organism: DEFAULT_ORGANISM, ...options });
  panel.update(model(layer, pending));
  return { host, panel };
}

/** The rows of the nth table, each as an array of cell texts. */
function rowsOf(host, index) {
  const table = host.querySelectorAll('table.fitness-table')[index];
  return table.querySelectorAll('tr').slice(1)
    .map((row) => row.children.map((cell) => cell.textContent));
}

function headersOf(host, index) {
  return host.querySelectorAll('table.fitness-table')[index]
    .querySelectorAll('th').filter((cell) => cell.scope === 'col')
    .map((cell) => cell.textContent);
}

test('the tab says in its own blurb that these rows are not genes', () => {
  assert.equal(STRAIN_FITNESS_TAB.id, 'strain-fitness');
  assert.match(STRAIN_FITNESS_TAB.blurb, /whole strain/);
  assert.match(STRAIN_FITNESS_TAB.blurb, /none of them colours the map/);
});

test('dataset identity, local choice, external origin, and ambiguity are explicit', async () => {
  await withFakeDocument((document) => {
    const chosen = [];
    const second = Object.freeze({
      id: 'fixture-fitness-b', label: 'Fixture fitness B', file: 'b.json',
    });
    const host = document.createElement('div');
    const panel = new StrainFitnessPanel(host, { onDatasetSelect: (id) => chosen.push(id) });
    panel.update({
      catalogue: [catalogue[0], second],
      selection: {
        dataset: catalogue[0], origin: 'local', originIds: ['fixture-fitness'],
        ambiguousIds: [], showLocalSelector: true,
      },
      resource: { state: FILE_STATE.READY, data: layerFor(), error: null },
    });
    assert.match(host.querySelector('.fitness-dataset-context').textContent,
      /Active dataset: Fixture whole-strain fitness.*Local Strain fitness selector/);
    panel.datasetSelect.value = second.id;
    panel.datasetSelect.dispatch('change');
    assert.deepEqual(chosen, [second.id]);

    panel.datasetSelect.focus();
    const settledLayer = layerFor();
    const localModel = {
      catalogue: [catalogue[0], second],
      selection: {
        dataset: catalogue[0], origin: 'local', originIds: ['fixture-fitness'],
        ambiguousIds: [], showLocalSelector: true,
      },
      resource: { state: FILE_STATE.READY, data: settledLayer, error: null },
    };
    panel.update(localModel);
    assert.equal(document.activeElement, panel.datasetSelect,
      'the local selector keeps focus when its dataset finishes loading');
    panel.query.value = 'glucose';
    panel.query.dispatch('input');
    panel.query.focus();
    panel.update(localModel);
    assert.equal(document.activeElement, panel.query,
      'the query keeps focus through an unrelated app rerender');
    assert.equal(panel.query.value, 'glucose');

    panel.update({
      catalogue: [catalogue[0], second],
      selection: {
        dataset: second, origin: 'external', originIds: ['fixture-fitness-b'],
        ambiguousIds: [], showLocalSelector: false,
      },
      resource: { state: FILE_STATE.READY, data: layerFor(), error: null },
    });
    assert.equal(panel.datasetSelect, null);
    assert.match(host.querySelector('.fitness-dataset-context').textContent,
      /Shared Data Sources selection \(fixture-fitness-b\)/);

    panel.update({
      catalogue: [catalogue[0], second],
      selection: {
        dataset: catalogue[0], origin: 'local', originIds: ['fixture-fitness'],
        ambiguousIds: ['fixture-fitness', 'fixture-fitness-b'], showLocalSelector: true,
      },
      resource: { state: FILE_STATE.READY, data: layerFor(), error: null },
    });
    assert.match(host.querySelector('.fitness-dataset-ambiguity').textContent,
      /matches multiple whole-strain datasets/);
    assert.ok(panel.datasetSelect);
  });
});

test('absent, loading and failed are three different sentences', async () => {
  await withFakeDocument((document) => {
    const { host, panel } = mount(document, null);
    assert.equal(host.textContent, UNAVAILABLE_TEXT);
    assert.match(UNAVAILABLE_TEXT, /unavailable in this dataset/);

    // Loading is unknown, not absent, and must not borrow the absent wording.
    panel.update(model(null, FILE_STATE.LOADING));
    assert.ok(host.textContent.includes('Loading strain fitness measurements…'));
    assert.equal(host.querySelector('p[data-pending="loading"]').dataset.pending, 'loading');

    // A malformed file is a layer that exists and could not be read. The gene
    // app is untouched: this panel is the only thing that says so.
    panel.update(model(null, FILE_STATE.FAILED));
    assert.ok(host.textContent.includes('Strain fitness measurements could not be loaded.'));
    assert.equal(host.querySelector('p[data-pending="failed"]').dataset.pending, 'failed');
    assert.ok(host.textContent.includes('Retry this dataset'));

    panel.update(model(layerFor()));
    assert.ok(host.textContent.includes('Strain fitness'));
    assert.ok(!host.textContent.includes(UNAVAILABLE_TEXT));
  });
});

test('a synthetic file is labelled as one, and a published file is not', async () => {
  await withFakeDocument((document) => {
    const { host } = mount(document, layerFor());
    const warning = host.querySelector('p.provenance-warning');
    assert.match(warning.textContent, /synthetic test data, not measurements/);
    const { host: published } = mount(document,
      layerFor((file) => { file.provenanceClass = 'published'; }));
    assert.equal(published.querySelector('p.provenance-warning'), null);
  });
});

test('retry retains a stable focus target through loading, repeated failure and success', async () => {
  await withFakeDocument((document) => {
    const { host, panel } = mount(document, null, FILE_STATE.FAILED, {
      onRetry: () => panel.update(model(null, FILE_STATE.LOADING)),
    });
    const retry = host.querySelector('[data-fitness-focus="retry"]');
    retry.focus();
    retry.dispatch('click');
    const focusedHeading = () => {
      const heading = host.querySelector('[data-fitness-focus="heading"]');
      assert.equal(document.activeElement, heading);
      assert.equal(heading.getAttribute('tabindex'), '-1');
    };
    focusedHeading();
    panel.update(model(null, FILE_STATE.FAILED));
    focusedHeading();
    panel.update(model(layerFor()));
    focusedHeading();
    const outside = document.createElement('button');
    document.body.append(outside);
    outside.focus();
    panel.update(model(layerFor()));
    assert.equal(document.activeElement, outside, 'a background load never steals focus');
  });
});

test('the source, its checksum and its comparison are on screen', async () => {
  await withFakeDocument((document) => {
    const { host } = mount(document, layerFor());
    const text = host.querySelector('div.fitness-source').textContent;
    assert.ok(text.includes('Synthetic strain-fitness fixture, not a publication'));
    assert.ok(text.includes(raw.source.sourceFileSha256));
    assert.ok(text.includes('retrieved 2026-10-07'));
    assert.ok(text.includes('compares these strains against Unmodified parent (synthetic)'));
    // A DOI becomes a link; a file without one states the citation as text.
    assert.equal(host.querySelector('div.fitness-source').querySelector('a'), null);
    const { host: withDoi } = mount(document,
      layerFor((file) => { file.source.doi = '10.1000/example'; }));
    assert.equal(withDoi.querySelector('div.fitness-source').querySelector('a').href,
      'https://doi.org/10.1000/example');
  });
});

test('every declared unit and metadata field is reachable, and nothing supplies a default', async () => {
  await withFakeDocument((document) => {
    const { host } = mount(document, layerFor());
    const definitions = host.querySelector('dl.fitness-definitions').textContent;
    assert.ok(definitions.includes('minutes'));
    assert.ok(definitions.includes(raw.growth.units.maximumOd600));
    // The Biolog scale is the source's words, never an OD scale this build
    // assumed on its behalf.
    assert.ok(definitions.includes(raw.biolog.units.value));
    assert.ok(definitions.includes(raw.biolog.units.reference));
    assert.ok(definitions.includes(raw.biolog.units.normalization));
    assert.ok(definitions.includes(raw.growth.metadata.replicateDefinition));
    assert.ok(definitions.includes(String(raw.biolog.metadata.incubationHours)));
    // The file's own keys, split at their humps: the words are the source's.
    assert.ok(definitions.includes('Replicate definition'));
    assert.ok(definitions.includes('Incubation hours'));
    assert.ok(!definitions.includes('incubationHours'));
    // The unit rides under its own column name, so a row read on its own has it.
    assert.deepEqual(headersOf(host, 0), [
      'Strain and scheme', 'Condition', 'Status', `Doubling time${'minutes'}`,
      'Doubling-time replicates', `Maximum OD600${raw.growth.units.maximumOd600}`,
      'Maximum-OD600 replicates',
    ]);
    assert.ok(headersOf(host, 1).includes(`Value${raw.biolog.units.value}`));
    // Every column has a width, so none can collapse to its own content.
    for (const index of [0, 1]) {
      const table = host.querySelectorAll('table.fitness-table')[index];
      const widths = table.querySelector('colgroup').children.map((column) => column.style.width);
      assert.equal(widths.length, headersOf(host, index).length);
      assert.ok(widths.every((width) => /^\d+%$/.test(width)), widths.join(' '));
      assert.equal(widths.reduce((total, width) => total + Number.parseInt(width, 10), 0), 100);
    }
  });
});

test('a no-growth row shows no doubling time, and never a zero', async () => {
  await withFakeDocument((document) => {
    const { host } = mount(document, layerFor());
    const rows = rowsOf(host, 0);
    const stalled = rows.find((row) => row[2] === 'No growth detected');
    assert.equal(stalled[0], 'Segment set B (synthetic) — seven-codon recoding (synthetic) (70-81)');
    assert.equal(stalled[3], MISSING, 'a missing doubling time is the missing mark');
    assert.notEqual(stalled[3], '0');
    // The same row's maximum OD600 is a real small reading with a measured zero
    // among its replicates: null and zero are not shown the same way.
    assert.equal(stalled[5], '0.030 ± 0.020');
    assert.equal(stalled[6], '1: 0 · 2: 0.050 · 3: 0.040');
    const unmeasured = rows.find((row) => row[0].startsWith('Segment set A') && row[1].startsWith('Minimal'));
    assert.equal(unmeasured[5], MISSING, 'an unmeasured maximum OD600 is not a zero either');
    assert.equal(unmeasured[6], MISSING);
    // Replicate numbers are shown, so a series missing replicate 2 reads as one.
    assert.equal(unmeasured[4], '1: 90.2 · 3: 102.6');
  });
});

test('every row names its strain, scheme and condition, and the context line names the source', async () => {
  await withFakeDocument((document) => {
    const { host } = mount(document, layerFor());
    for (const row of [...rowsOf(host, 0), ...rowsOf(host, 1)]) {
      assert.match(row[0], /\(synthetic\)/, 'the strain label');
      assert.match(row[0], / — /, 'and its scheme, in the same cell');
      assert.ok(row[1].length > 0, 'the condition');
    }
    const context = host.querySelector('p.fitness-context').textContent;
    assert.equal(context, 'Strain: All strains · Scheme: All schemes · '
      + 'Condition: All conditions · Dataset: Fixture whole-strain fitness (fixture-fitness) · '
      + 'Selected by: Local Strain fitness selector · Source: FIXTURE_STRAIN_FITNESS');
    assert.equal(host.querySelector('p.fitness-context').getAttribute('role'), 'status');
    assert.equal(host.querySelector('p.length-summary').textContent,
      '6 growth records, 3 growth strains, 1 with no growth detected, 24 Biolog wells.');
  });
});

test('filtering by strain and condition narrows both tables and the context line', async () => {
  await withFakeDocument((document) => {
    const { host, panel } = mount(document, layerFor());
    panel.strain.value = 'seg-b';
    panel.strain.dispatch('change');
    assert.equal(rowsOf(host, 0).length, 2);
    assert.equal(rowsOf(host, 1).length, 8);
    assert.equal(host.querySelector('p.fitness-context').textContent,
      'Strain: Segment set B (synthetic) · Scheme: seven-codon recoding (synthetic) (70-81) · '
      + 'Condition: All conditions · Dataset: Fixture whole-strain fitness (fixture-fitness) · '
      + 'Selected by: Local Strain fitness selector · Source: FIXTURE_STRAIN_FITNESS');

    panel.condition.value = 'minimal-37';
    panel.condition.dispatch('change');
    assert.equal(rowsOf(host, 0).length, 1);
    // One of a thing is counted as one of it, not as "1 records".
    assert.equal(host.querySelector('p.length-summary').textContent,
      '1 growth record, 1 growth strain, 1 with no growth detected, 0 Biolog wells.');
    // The Biolog wells belong to their own condition, so a growth condition
    // empties that table rather than showing wells it did not select.
    assert.equal(host.querySelectorAll('table.fitness-table').length, 1);
    assert.ok(host.textContent.includes('No environment matches this selection.'));

    panel.strain.value = 'all';
    panel.strain.dispatch('change');
    panel.condition.value = 'biolog-48h';
    panel.condition.dispatch('change');
    assert.ok(host.textContent.includes('No growth record matches this selection.'));
    assert.equal(rowsOf(host, 0).length, 24, 'the well table is the only one left');

    panel.condition.value = 'all';
    panel.condition.dispatch('change');
    panel.query.value = 'glucose';
    panel.query.dispatch('input');
    assert.equal(rowsOf(host, 1).length, 3);
    assert.ok(host.querySelector('p.length-summary').textContent.includes('3 Biolog wells'));
  });
});

test('the well table pages, and the page is a reading convenience and not a result', async () => {
  await withFakeDocument((document) => {
    // Twenty-four wells over a page size of forty fit on one page, so the
    // boundary is forced rather than waited for.
    const { host, panel } = mount(document, layerFor());
    assert.equal(host.querySelector('div.fitness-paging').querySelectorAll('button')[0].disabled,
      true);
    panel.page = 0;
    const paging = host.querySelector('div.fitness-paging');
    assert.match(paging.textContent, /Page 1 of 1, 24 wells/);
    // The export covers the whole selection, which is why its row count is the
    // selection's and not the page's.
    const [downloadRow] = host.querySelectorAll('div.fitness-export');
    assert.ok(downloadRow.textContent.includes('Download growth summary (TSV)'));
    assert.ok(host.querySelectorAll('div.fitness-export')[1].textContent
      .includes('Download Biolog values (TSV)'));
  });
});

test('a download names its file, its rows and its provenance, and is announced', async () => {
  await withFakeDocument(async (document) => {
    const downloads = [];
    const announced = [];
    const originalUrl = globalThis.URL;
    globalThis.URL = Object.assign(
      function FakeURL(...args) { return new originalUrl(...args); },
      originalUrl,
      {
        createObjectURL: (blob) => {
          downloads.push(blob);
          return 'blob:fitness';
        },
        revokeObjectURL: () => {},
      },
    );
    try {
      const { host, panel } = mount(document, layerFor(), null,
        { onAnnounce: (message) => announced.push(message) });
      panel.strain.value = 'seg-b';
      panel.strain.dispatch('change');
      const growthExport = host.querySelectorAll('div.fitness-export')[0];
      growthExport.querySelector('button').click();
      assert.equal(downloads.length, 1);
      assert.equal(downloads[0].type, 'text/tab-separated-values;charset=utf-8');
      const text = await downloads[0].text();
      assert.match(text, /^# table\tstrain fitness — growth\n/);
      assert.match(text, /# provenance\tsynthetic-test-fixture\n/);
      assert.match(text, /# selectedStrain\tSegment set B \(synthetic\)\n/);
      assert.match(text, /# rows\t2\n/);
      const status = growthExport.querySelector('p.panel-note').textContent;
      assert.equal(status, 'Downloaded strain-fitness_fixture-fitness_growth_seg-b_all.tsv with 2 rows, '
        + 'its units and its source provenance.');
      assert.deepEqual(announced, [status]);
    } finally {
      globalThis.URL = originalUrl;
    }
  });
});

test('a file with only one layer draws that layer and says the other is not published', async () => {
  await withFakeDocument((document) => {
    const growthOnly = layerFor((file) => {
      file.biolog = null;
      file.conditions = file.conditions.filter((entry) => entry.id !== 'biolog-48h');
    });
    const { host } = mount(document, growthOnly);
    assert.ok(host.textContent.includes('This source publishes no Biolog environment layer.'));
    assert.equal(host.querySelectorAll('table.fitness-table').length, 1);
    // With no wells there is nothing to search for, so the control is not there.
    assert.equal(host.querySelector('div.fitness-controls').querySelectorAll('input').length, 0);
    assert.ok(!host.querySelector('p.length-summary').textContent.includes('Biolog'));
  });
});

test('a second layer replaces the first rather than filtering it through a stale selection', async () => {
  await withFakeDocument((document) => {
    const { host, panel } = mount(document, layerFor());
    panel.strain.value = 'seg-b';
    panel.strain.dispatch('change');
    assert.equal(rowsOf(host, 0).length, 2);
    // A reload or an organism switch hands over a different layer, whose strain
    // ids need not be the layer the selection was made against.
    panel.update(model(layerFor((file) => {
      file.strains = file.strains.filter((entry) => entry.id !== 'seg-b');
      file.growth.records = file.growth.records.filter((entry) => entry.strainId !== 'seg-b');
      file.biolog.records = file.biolog.records.filter((entry) => entry.strainId !== 'seg-b');
    })));
    assert.equal(panel.selection.strainId, 'all');
    assert.equal(rowsOf(host, 0).length, 4);
    assert.ok(host.querySelector('p.fitness-context').textContent.includes('Strain: All strains'));
  });
});


test('metadata preserves source acronyms while expanding camel-case keys', async () => {
  await withFakeDocument((document) => {
    const { host } = mount(document, layerFor((file) => {
      file.growth.metadata.SD = 'Population SD';
      file.growth.metadata.OD600 = 'Source wavelength';
    }));
    const labels = host.querySelector('dl.fitness-definitions').querySelectorAll('dt').map((e) => e.textContent);
    assert.ok(labels.includes('SD'));
    assert.ok(labels.includes('OD600'));
    assert.ok(labels.includes('Replicate definition'));
  });
});

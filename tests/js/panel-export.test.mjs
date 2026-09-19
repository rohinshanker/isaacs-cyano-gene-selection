/**
 * A panel export must rebuild the panel, not just name it.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeLiveMetrics } from '../../site/js/core/live-metrics.js';
import { compileScheme } from '../../site/js/core/scheme.js';
import { buildMetricRegistry } from '../../site/js/core/metric-registry.js';
import { parseCsv, schemeIdOf } from '../../site/js/core/export-manifest.js';
import { buildPanelSpace } from '../../site/js/core/panel-features.js';
import { designPanel } from '../../site/js/core/panel-design.js';
import {
  buildPanelExport, readPanelDesign, describeSchemes, buildSchemeMatrix,
  PANEL_COLUMNS, PANEL_DESIGN_VERSION,
} from '../../site/js/core/panel-export.js';
import { expressionFixtureDataset } from './helpers.mjs';

const SYN61 = { TCG: 'AGC', TCA: 'AGT', TAG: 'TAA' };
const AMBER = { TAG: 'TAA' };
const WHEN = new Date('2026-09-18T20:00:00Z');

let cached = null;
async function context(schemeList = [{ name: 'Syn61-style', map: SYN61 }]) {
  if (!cached) {
    const dataset = await expressionFixtureDataset();
    const live = computeLiveMetrics(dataset, compileScheme({}, dataset.table)).fields;
    cached = { dataset, registry: buildMetricRegistry(dataset.meta, dataset.genes, live) };
  }
  const { dataset, registry } = cached;
  const schemes = describeSchemes(schemeList);
  const schemeFields = new Map(schemes.map((scheme) => [
    scheme.schemeId,
    computeLiveMetrics(
      dataset, compileScheme(scheme.map, dataset.table), { baseline: dataset.baseline },
    ).fields,
  ]));
  const space = buildPanelSpace({ dataset, registry, schemes, schemeFields });
  return { dataset, registry, schemes, schemeFields, space };
}

test('scheme descriptors dedupe by identity and always name at least one scheme', () => {
  assert.deepEqual(describeSchemes([]).map((entry) => entry.schemeId), [schemeIdOf({})]);
  const twice = describeSchemes([{ name: 'a', map: SYN61 }, { name: 'b', map: { ...SYN61 } }]);
  assert.equal(twice.length, 1);
  assert.equal(twice[0].name, 'a');
});

test('the design round-trips through its manifest and rebuilds the same panel', async () => {
  const { dataset, registry, space, schemes } = await context();
  const config = {
    size: 9,
    seeds: [dataset.genes[4].id],
    exclude: [dataset.genes[7].id],
    ranges: { cai: { min: 0.1, includeMissing: false }, lengthCodons: { max: 5000 } },
  };
  const design = designPanel({ dataset, registry, space, config });
  const result = buildPanelExport({
    dataset, registry, design, space, schemes, generatedAt: WHEN,
  });

  const manifest = JSON.parse(result.files.find((file) => file.name.endsWith('.json')).content);
  const restored = readPanelDesign(manifest);

  assert.equal(manifest.panelDesign.panelDesignVersion, PANEL_DESIGN_VERSION);
  assert.equal(manifest.panelDesign.eligibleGeneCount, design.eligibility.pool.length);
  assert.deepEqual(restored.selected, design.selected);
  assert.equal(restored.config.size, 9);
  assert.deepEqual(restored.config.seeds, config.seeds);
  assert.deepEqual(restored.config.exclude, config.exclude);
  assert.deepEqual(restored.config.ranges.cai, { min: 0.1, max: null, includeMissing: false });
  assert.deepEqual(restored.config.ranges.lengthCodons, { min: null, max: 5000, includeMissing: true });
  assert.deepEqual(restored.features, space.keys);
  assert.deepEqual(restored.schemes.map((entry) => entry.schemeId), schemes.map((entry) => entry.schemeId));

  // Rebuilt from the manifest alone, the design is the same panel in the same order.
  const rebuilt = designPanel({ dataset, registry, space, config: restored.config });
  assert.deepEqual(rebuilt.selected, design.selected);
  assert.deepEqual(
    rebuilt.genes.map((gene) => [gene.id, gene.nearestId]),
    design.genes.map((gene) => [gene.id, gene.nearestId]),
  );
});

test('the manifest carries the dataset identity, the objective, and the caveat', async () => {
  const { dataset, registry, space, schemes } = await context();
  const design = designPanel({ dataset, registry, space, config: { size: 6 } });
  const { manifest } = buildPanelExport({
    dataset, registry, design, space, schemes, generatedAt: WHEN,
  });
  assert.equal(manifest.dataset.schemaVersion, dataset.meta.schemaVersion);
  assert.deepEqual(manifest.dataset.sourceChecksums, dataset.meta.sourceChecksums ?? {});
  assert.equal(manifest.dataset.loadedGeneCount, dataset.genes.length);
  assert.equal(manifest.panelDesign.objective, 'constrained-stratified-maximin');
  assert.equal(manifest.panelDesign.selectionOrder[0], 'reaches more quantile bins no selected gene occupies');
  assert.match(manifest.panelDesign.scaling, /percentile/);
  assert.ok(manifest.caveats.some((line) => /not a prediction of recoded fitness/.test(line)));
  assert.match(manifest.manifestId, /^[0-9a-f]{16}$/);
});

test('every metric value in the CSV matches the live value for that scheme', async () => {
  const { dataset, registry, space, schemes, schemeFields } = await context([
    { name: 'Syn61-style', map: SYN61 }, { name: 'Amber only', map: AMBER },
  ]);
  const design = designPanel({ dataset, registry, space, config: { size: 8 } });
  const result = buildPanelExport({
    dataset, registry, design, space, schemes, generatedAt: WHEN,
  });
  const { rows } = parseCsv(result.csv);
  assert.equal(rows.length, design.selected.length * schemes.length);

  const live = registry.metrics.filter((metric) => metric.source === 'live');
  for (const row of rows) {
    const index = dataset.indexById.get(row.id);
    const fields = schemeFields.get(row.schemeId);
    for (const metric of live) {
      const expected = fields[metric.key][index];
      if (!Number.isFinite(expected)) {
        assert.equal(row[metric.key], '', `${row.id} ${metric.key} should be blank, never 0`);
        continue;
      }
      assert.ok(Math.abs(Number(row[metric.key]) - expected) < 1e-12);
    }
  }
});

test('a multi-scheme export is one row per gene and scheme, each naming its scheme', async () => {
  const { dataset, registry, space, schemes } = await context([
    { name: 'Syn61-style', map: SYN61 }, { name: 'Amber only', map: AMBER },
  ]);
  const design = designPanel({ dataset, registry, space, config: { size: 6 } });
  const result = buildPanelExport({
    dataset, registry, design, space, schemes, generatedAt: WHEN,
  });
  const { rows, header } = parseCsv(result.csv);
  for (const column of PANEL_COLUMNS) assert.ok(header.includes(column));
  const ids = new Set(rows.map((row) => row.id));
  const schemeIds = new Set(rows.map((row) => row.schemeId));
  assert.equal(ids.size, 6);
  assert.equal(schemeIds.size, 2);
  assert.equal(rows.length, 12);
  for (const row of rows) {
    assert.equal(row.manifestId, result.manifest.manifestId);
    assert.ok(row.schemeId.startsWith('scheme:'));
    assert.ok(Number(row.panelOrder) >= 1 && Number(row.panelOrder) <= 6);
  }
  assert.match(result.baseName, /^gene-panel_6-genes_2-schemes_.*_[0-9a-f]{10}$/);
});

test('two designs are distinguishable without reading the filename', async () => {
  const { dataset, registry, space, schemes } = await context();
  const six = designPanel({ dataset, registry, space, config: { size: 6 } });
  const seven = designPanel({ dataset, registry, space, config: { size: 7 } });
  const a = buildPanelExport({ dataset, registry, design: six, space, schemes, generatedAt: WHEN });
  const b = buildPanelExport({ dataset, registry, design: seven, space, schemes, generatedAt: WHEN });
  assert.notEqual(a.manifest.manifestId, b.manifest.manifestId);
  assert.notEqual(a.manifest.contentDigest, b.manifest.contentDigest);
  assert.notEqual(a.baseName, b.baseName);
});

test('a blocked constraint is recorded in the manifest, not forgotten', async () => {
  const { dataset, registry, space, schemes } = await context();
  const design = designPanel({
    dataset, registry, space, config: { size: 6, requireMeasuredExpression: true },
  });
  const { manifest } = buildPanelExport({
    dataset, registry, design, space, schemes, generatedAt: WHEN,
  });
  const blocked = manifest.panelDesign.constraintsBlocked;
  assert.equal(blocked.length, 1);
  assert.equal(blocked[0].id, 'requireMeasuredExpression');
  assert.match(blocked[0].reason, /borrowed expression/);
});

test('a manifest without a panel design, or from another version, is refused', () => {
  assert.throws(() => readPanelDesign({}), /carries no panel design/);
  assert.throws(
    () => readPanelDesign({ panelDesign: { panelDesignVersion: 99 } }),
    /version 99 is not version/,
  );
});

test('the gene-by-scheme matrix has one cell per gene and scheme', async () => {
  const { dataset, registry, space, schemes, schemeFields } = await context([
    { name: 'Syn61-style', map: SYN61 }, { name: 'Amber only', map: AMBER },
  ]);
  const design = designPanel({ dataset, registry, space, config: { size: 6 } });
  const matrix = buildSchemeMatrix({
    dataset, registry, ids: design.selected, schemes, schemeFields,
  });
  assert.equal(matrix.rows.length, 6);
  assert.deepEqual(matrix.rows.map((row) => row.id), design.selected);
  for (const row of matrix.rows) {
    assert.equal(row.cells.length, 2);
    for (const cell of row.cells) {
      assert.equal(cell.values.length, matrix.metrics.length);
      const expected = schemeFields.get(cell.schemeId).targetCount[row.index];
      assert.equal(cell.values[0], expected);
    }
  }
  // Amber touches fewer codons than Syn61, which the matrix must show per scheme.
  const totals = matrix.schemes.map((scheme, column) => matrix.rows
    .reduce((sum, row) => sum + row.cells[column].values[0], 0));
  assert.ok(totals[0] > totals[1]);
});

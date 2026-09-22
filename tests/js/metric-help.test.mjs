import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildMetricRegistry } from '../../site/js/core/metric-registry.js';
import { LIVE_METRICS } from '../../site/js/core/live-metrics.js';
import { metricHelp, methodKeys } from '../../site/js/core/metric-help.js';
import { projectionHelp } from '../../site/js/core/projection-help.js';
import { renderMetricHelp, renderProjectionHelp } from '../../site/js/ui/metric-help.js';

const file = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url)));
const meta = file('../../site/data/meta.json');
const genes = file('../../site/data/genes.json');
const codonPca = file('../../site/data/codon_pca.json');
const citations = file('../../site/data/citations.json');
const citationIds = new Set(citations.sections.flatMap((section) =>
  section.items.map((item) => item.id)));
const live = Object.fromEntries(LIVE_METRICS.map((metric) =>
  [metric.key, new Float64Array(genes.length)]));
const registry = buildMetricRegistry(meta, genes, live);
const dataset = { meta, genes, codonPca };

test('all 53 selectable metrics have a calculation, origin, missingness and real citations', () => {
  assert.equal(registry.metrics.length, 53);
  assert.deepEqual(new Set(methodKeys()), new Set(registry.metrics.map((metric) => metric.key)));
  for (const metric of registry.metrics) {
    const explanation = metricHelp(metric, dataset);
    for (const field of ['title', 'summary', 'method', 'unit', 'origin', 'coverage']) {
      assert.ok(explanation[field], `${metric.key} missing ${field}`);
    }
    assert.ok(explanation.citations.length > 0, `${metric.key} has no citation`);
    assert.ok(explanation.citations.every((id) => citationIds.has(id)),
      `${metric.key} has an unknown citation`);
  }
  assert.equal(metricHelp(null, dataset), null);
});

test('priority conventions and measured-source boundaries are explicit', () => {
  const help = (key) => metricHelp(registry.byKey.get(key), dataset);
  assert.match(help('rareFraction').method, /strictly below 0\.1/);
  assert.match(help('cai').method, /71-locus.*0\.5/);
  assert.match(help('tai').method, /tRNA copy counts.*wobble/);
  assert.match(help('minLocalTai').method, /arithmetic mean/);
  assert.match(help('expression').origin, /PCC 7942/);
  assert.match(help('tssInitiation').origin, /UTEX 2973/);
  assert.match(help('targetFraction').method, /stop edit/);
  assert.match(help('encExpected').method, /2 \+ s \+ 29/);
  assert.doesNotMatch(help('encExpected').summary, /20 to 61/);
  assert.match(help('lengthCodons').summary, /target fraction\./);
  assert.match(help('lengthCodons').summary, /Targets per kilobase instead uses full CDS length/);
  assert.match(help('targetPerKb').method, /full CDS length in nt/);
});

test('map help lists the actual distinct feature matrices', () => {
  const lengths = Object.fromEntries(['native', 'risk', 'umap', 'perturbation']
    .map((panel) => [panel, projectionHelp(panel, dataset, registry).features.length]));
  assert.deepEqual(lengths, { native: 59, risk: 18, umap: 17, perturbation: 10 });
  assert.equal(projectionHelp('risk', dataset, registry).features.some((row) =>
    row.key === 'targetFraction'), true);
  assert.equal(projectionHelp('umap', dataset, registry).features.some((row) =>
    row.key === 'targetFraction'), false);
  assert.equal(projectionHelp('unknown', dataset, registry), null);
  for (const panel of ['risk', 'perturbation']) {
    assert.deepEqual(projectionHelp(panel, dataset, registry).citations, ['ncbi-utex-2973']);
  }
});

test('explicit-axis help names both selected metric methods and their sources', () => {
  const help = projectionHelp('axes', dataset, registry, { x: 'lengthNt', y: 'cai' });
  assert.deepEqual(help.features.map((feature) => feature.key), ['lengthNt', 'cai']);
  assert.match(help.features[0].label, /^X: .*nt/);
  assert.match(help.features[1].label, /^Y: CAI/);
  assert.match(help.features[1].role, /71-locus/);
  assert.ok(help.citations.every((id) => citationIds.has(id)));
  assert.match(help.summary, /not standardized or fitted by PCA/);
});

class FakeElement {
  constructor(tagName) {
    this.tagName = tagName;
    this.children = [];
  }

  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this.children = children; }
  querySelector(selector) { return selector === 'summary' ? this.summary : this.body; }
}

function detailsElement() {
  const details = new FakeElement('details');
  details.summary = new FakeElement('summary');
  details.body = new FakeElement('div');
  details.open = true;
  return details;
}

test('help renderers preserve open disclosure and update selected content', () => {
  const previous = globalThis.document;
  globalThis.document = { createElement: (tag) => new FakeElement(tag) };
  try {
    const details = detailsElement();
    renderMetricHelp(details, metricHelp(registry.byKey.get('cai'), dataset), citations);
    assert.equal(details.open, true);
    assert.match(details.summary.textContent, /CAI explanation/);
    assert.equal(details.body.children.length, 2);
    renderMetricHelp(details, metricHelp(registry.byKey.get('tai'), dataset), citations);
    assert.equal(details.open, true);
    assert.match(details.summary.textContent, /tAI explanation/);
    renderProjectionHelp(details, projectionHelp('native', dataset, registry), citations);
    assert.equal(details.summary.textContent, 'Features used (59)');
    assert.equal(details.body.children[1].children.length, 59);
    renderProjectionHelp(details, null, citations);
    assert.equal(details.hidden, true);
  } finally {
    globalThis.document = previous;
  }
});

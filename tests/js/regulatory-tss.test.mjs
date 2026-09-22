import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateRegulatoryTss, searchRegulatoryTss } from '../../site/js/core/regulatory-tss.js';
import { RegulatorySitesPanel } from '../../site/js/ui/regulatory-sites.js';

const data = JSON.parse(readFileSync(new URL('../../site/data/regulatory_tss.json', import.meta.url)));
const genes = JSON.parse(readFileSync(new URL('../../site/data/genes.json', import.meta.url)));

test('published regulatory rows reconcile and remain feature-level records', () => {
  assert.equal(validateRegulatoryTss(data, genes), data);
  assert.equal(data.rows.length, 2333);
  assert.equal(data.potentialTargets.length, 101);
  assert.deepEqual(data.sourceDiscrepancies.map((entry) => entry.tssId), ['aTSS-320358']);
  assert.deepEqual(data.sourceWarnings.map((entry) => entry.tssId),
    ['aTSS-320358', 'iTSS+320358']);
  assert.equal(searchRegulatoryTss(data.rows, { type: 'nTSS' }).length, 229);
  assert.deepEqual(searchRegulatoryTss(data.rows, { query: 'nTSS+1471309' })
    .map((row) => [row.tss_id, row.mapping_status]), [['nTSS+1471309', 'unassociated']]);
  assert.equal(searchRegulatoryTss(data.rows, { query: 'M744_RS08610', type: 'aTSS' })
    .some((row) => row.tss_id === 'aTSS-1705677'), true);
  assert.equal(searchRegulatoryTss(data.rows, { query: 'no such feature' }).length, 0);
  assert.equal(searchRegulatoryTss(data.rows, { mapping: 'unassociated' }).length, 180);
  assert.equal(searchRegulatoryTss(data.rows, {
    potential: 'only', targetSiteIds: new Set(data.potentialTargets.map((row) => row.tss_id)),
  }).length, 96);
});

test('loader rejects a fabricated exact-locus match and incomplete rows', () => {
  const wrongLink = structuredClone(data);
  wrongLink.rows[0].mapped_locus_tag = 'M744_RS99999';
  assert.throws(() => validateRegulatoryTss(wrongLink, genes), /invalid exact-locus/);
  const incomplete = structuredClone(data);
  incomplete.rows.pop();
  assert.throws(() => validateRegulatoryTss(incomplete, genes), /does not reconcile/);
  const falseTarget = structuredClone(data);
  falseTarget.potentialTargets[0].potential_target_locus = 'M744_RS99999';
  assert.throws(() => validateRegulatoryTss(falseTarget, genes), /invalid potential-target/);
  const noWarning = structuredClone(data);
  noWarning.sourceDiscrepancies = [];
  assert.throws(() => validateRegulatoryTss(noWarning, genes), /unexpected Table S1\/S8/);
  const falseWarning = structuredClone(data);
  falseWarning.rows.find((row) => row.tss_id === 'iTSS+320358').dark_1 = '0';
  assert.throws(() => validateRegulatoryTss(falseWarning, genes), /warning has changed evidence/);
  const falseUnmapped = structuredClone(data);
  const unmapped = falseUnmapped.rows.find((row) => row.mapping_status === 'unmapped');
  unmapped.source_locus_tag = genes[0].id;
  assert.throws(() => validateRegulatoryTss(falseUnmapped, genes), /invalid mapping status/);
});

class FakeElement {
  constructor(tagName) {
    this.tagName = tagName;
    this.children = [];
    this.listeners = new Map();
    this.value = '';
    this.disabled = false;
  }

  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this.children = children; }
  addEventListener(name, callback) { this.listeners.set(name, callback); }
}

test('search and paging keep controls stable and expose unmapped sites', () => {
  const previous = globalThis.document;
  globalThis.document = { createElement: (tag) => new FakeElement(tag) };
  try {
    const host = new FakeElement('div');
    const panel = new RegulatorySitesPanel(host, { onShowGene: () => {} });
    panel.update(data);
    const search = panel.search;
    assert.equal(panel.list.children.length, 30);
    assert.equal(panel.previous.disabled, true);
    assert.equal(panel.next.disabled, false);
    panel.next.listeners.get('click')();
    assert.equal(panel.page, 1);
    search.value = 'nTSS+1471309';
    search.listeners.get('input')();
    assert.equal(panel.page, 0);
    assert.equal(panel.list.children.length, 1);
    assert.match(panel.count.textContent, /^1 of 2,333/);
    assert.equal(panel.next.disabled, true);
    panel.type.value = 'aTSS';
    panel.type.listeners.get('change')();
    assert.match(panel.list.children[0].textContent, /No start sites/);
    assert.equal(panel.search, search);
    panel.mapping.value = 'unassociated';
    panel.mapping.listeners.get('change')();
    assert.match(panel.count.textContent, /^0 of 2,333/);
    panel.mapping.value = 'all';
    panel.mapping.listeners.get('change')();
    panel.potential.value = 'only';
    panel.potential.listeners.get('change')();
    assert.match(panel.count.textContent, /^0 of 2,333/);
    panel.potential.value = 'any';
    panel.potential.listeners.get('change')();
    panel.type.value = 'all';
    panel.type.listeners.get('change')();
    search.value = 'aTSS+1886911';
    search.listeners.get('input')();
    assert.equal(panel.list.children.length, 1);
    assert.equal(panel.list.children[0].children.some((child) =>
      child.textContent?.includes('potential target')), true);
    search.value = 'aTSS-320358';
    search.listeners.get('input')();
    assert.equal(panel.list.children[0].children.some((child) =>
      child.textContent?.includes('Source caution')), true);
    search.value = 'iTSS+320358';
    search.listeners.get('input')();
    assert.equal(panel.list.children[0].children.some((child) =>
      child.textContent?.includes('Source caution')), true);
  } finally {
    globalThis.document = previous;
  }
});

test('missing regulatory inventory renders its unavailable reason', () => {
  const previous = globalThis.document;
  globalThis.document = { createElement: (tag) => new FakeElement(tag) };
  try {
    const host = new FakeElement('div');
    const panel = new RegulatorySitesPanel(host, { onShowGene: () => {} });
    panel.update(null);
    assert.match(host.children[0].textContent, /unavailable/);
  } finally {
    globalThis.document = previous;
  }
});

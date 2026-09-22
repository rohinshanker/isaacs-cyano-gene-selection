import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LengthExplorer } from '../../site/js/ui/length-explorer.js';

class FakeElement {
  constructor(tagName) {
    this.tagName = tagName;
    this.children = [];
    this.listeners = new Map();
    this.attributes = {};
    this.value = '';
    this.validity = { badInput: false };
  }

  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this.children = children; }
  setAttribute(key, value) { this.attributes[key] = value; }
  addEventListener(name, callback) { this.listeners.set(name, callback); }
  setCustomValidity(message) { this.customValidity = message; }
  reportValidity() { this.reportedValidity = true; }
}

function fakeDocument() {
  return {
    createElement: (name) => new FakeElement(name),
    createElementNS: (_namespace, name) => new FakeElement(name),
  };
}

const inventory = {
  qc: { shortCdsBelowNt: 75 },
  records: [
    { id: 'a', biotype: 'protein_coding', geneSpanNt: 1123, cdsLengthNt: 1122, refseqProteinRecord: true },
    { id: 'b', biotype: 'protein_coding', geneSpanNt: 201, cdsLengthNt: 201, refseqProteinRecord: true },
    { id: 'c', biotype: 'pseudogene', geneSpanNt: 78, cdsLengthNt: null, refseqProteinRecord: false },
  ],
};

test('length controls survive updates, preserving keyboard focus targets', async () => {
  const previousDocument = globalThis.document;
  globalThis.document = fakeDocument();
  try {
    const host = new FakeElement('div');
    const events = [];
    let cohort = 'cds';
    let range = { min: null, max: null };
    const explorer = new LengthExplorer(host, {
      onCohortChange: (value) => {
        cohort = value;
        events.push(['cohort', value]);
        explorer.update({ inventory, cohortId: cohort, range, mapPassing: 2, mapCount: 2 });
      },
      onRangeChange: (bound, value) => {
        range = { ...range, [bound]: value };
        events.push([bound, value]);
        explorer.update({ inventory, cohortId: cohort, range, mapPassing: 2, mapCount: 2 });
      },
    });
    explorer.update({ inventory, cohortId: cohort, range, mapPassing: 2, mapCount: 2 });
    const originalSelect = explorer.select;
    const originalMin = explorer.inputs.min;
    const originalMax = explorer.inputs.max;
    originalMin.value = '201';
    originalMin.listeners.get('change')();
    await new Promise((resolve) => setTimeout(resolve, 5));
    assert.deepEqual(events, [['min', 201]]);
    assert.equal(explorer.select, originalSelect);
    assert.equal(explorer.inputs.min, originalMin);
    assert.equal(explorer.inputs.max, originalMax);
    assert.equal(originalMin.value, 201);

    originalMax.value = '-1';
    originalMax.listeners.get('change')();
    assert.match(originalMax.customValidity, /nonnegative/);
    assert.equal(originalMax.reportedValidity, true);
    assert.deepEqual(events, [['min', 201]]);

    originalMax.value = '';
    originalMax.validity.badInput = true;
    originalMax.reportedValidity = false;
    originalMax.listeners.get('change')();
    assert.match(originalMax.customValidity, /nonnegative/);
    assert.equal(originalMax.reportedValidity, true);
    assert.deepEqual(events, [['min', 201]]);
    originalMax.validity.badInput = false;

    originalSelect.value = 'pseudogene';
    originalSelect.listeners.get('change')();
    await new Promise((resolve) => setTimeout(resolve, 5));
    assert.deepEqual(events.at(-1), ['cohort', 'pseudogene']);
    assert.equal(explorer.select, originalSelect);
  } finally {
    globalThis.document = previousDocument;
  }
});

test('missing inventory has a visible empty state', () => {
  const previousDocument = globalThis.document;
  globalThis.document = fakeDocument();
  try {
    const host = new FakeElement('div');
    const explorer = new LengthExplorer(host, {
      onCohortChange: () => {},
      onRangeChange: () => {},
    });
    explorer.update({ inventory: null, cohortId: 'annotated', range: null, mapPassing: 0, mapCount: 0 });
    assert.match(host.children[0].textContent, /unavailable/);
  } finally {
    globalThis.document = previousDocument;
  }
});

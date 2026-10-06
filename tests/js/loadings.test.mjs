import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderLoadings } from '../../site/js/ui/loadings.js';
import { MISSING } from '../../site/js/ui/format.js';
import { withFakeDocument } from './fake-dom.mjs';

test('a loading with a missing component ranks as unknown and draws as missing', async () => {
  await withFakeDocument((document) => {
    const host = document.createElement('div');
    renderLoadings(host, {
      loadingNote: 'Codons that pull genes along each axis.',
      loadings: [
        { label: 'AAA', pc: [null, 0.9] },
        { label: 'CCC', pc: [0.01, 0.01] },
        { label: 'GGG', pc: [0.5, 0.1] },
      ],
    });
    const rows = host.querySelectorAll('tbody')[0].children;
    // The strongest known loading leads; the one with a hole ranks after every known one.
    assert.deepEqual(rows.map((row) => row.children[0].textContent), ['GGG', 'CCC', 'AAA']);
    const unknown = rows[2];
    const [first, second] = unknown.children.slice(1);
    assert.equal(first.querySelector('span.loading-value').textContent, MISSING);
    assert.equal(first.querySelector('span.loading-bar').children.length, 0);
    assert.equal(second.querySelector('span.loading-value').textContent, '0.90');
    assert.equal(second.querySelector('span.loading-bar').children.length, 1);
    assert.doesNotMatch(unknown.textContent, /0\.00/);
  });
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { parseDotBracket, compareFoldingWindow } from '../../site/js/core/folding-comparison.js';
import { FoldingPanel } from '../../site/js/ui/folding-panel.js';
import { withFakeDocument } from './fake-dom.mjs';

const window = (wildStructure = '(..).', recodedStructure = '(...)', extras = {}) => ({
  wildSequence: 'ACGUU', recodedSequence: 'ACGUU', length: 5,
  wildStructure, recodedStructure, wildMfe: -1, recodedMfe: -2, delta: -1, ...extras,
});

test('strict parser returns sorted exact pairs and 1-based partners', () => {
  assert.deepEqual(parseDotBracket('((..).)'), { pairs: [[1, 7], [2, 5]], partners: [7, 5, 0, 0, 2, 0, 1] });
  assert.deepEqual(parseDotBracket('...'), { pairs: [], partners: [0, 0, 0] });
  for (const invalid of [null, undefined, 3, '', ' ', '[]', '{..}', '(x)', '(.', '.)', ')(', '...\n']) {
    assert.throws(() => parseDotBracket(invalid));
  }
});

test('identity and entirely unpaired structures yield genuine zeros', () => {
  const identity = compareFoldingWindow(window('(..).', '(..).'));
  assert.deepEqual(identity.retained, [[1, 4]]);
  assert.deepEqual(identity.lost, []);
  assert.deepEqual(identity.gained, []);
  assert.equal(identity.distance, 0);
  assert.deepEqual(identity.pairingChanged, []);
  assert.deepEqual(identity.sequenceChanged, []);
  assert.equal(compareFoldingWindow(window('.....', '.....')).distance, 0);
});

test('a preserved opening symbol with a different partner counts as pairing changed', () => {
  const result = compareFoldingWindow(window());
  assert.deepEqual(result.lost, [[1, 4]]);
  assert.deepEqual(result.gained, [[1, 5]]);
  assert.deepEqual(result.retained, []);
  assert.equal(result.distance, 2);
  assert.deepEqual(result.pairingChanged, [1, 4, 5]);
  assert.deepEqual(result.sequenceChanged, []);
});

test('retained, gained, and lost pairs use exact indices', () => {
  const result = compareFoldingWindow(window('((..)..)', '(..(..))', {
    wildSequence: 'ACGUACGU', recodedSequence: 'ACGUACGU', length: 8,
  }));
  assert.deepEqual(result.retained, [[1, 8]]);
  assert.deepEqual(result.lost, [[2, 5]]);
  assert.deepEqual(result.gained, [[4, 7]]);
  assert.deepEqual(result.pairingChanged, [2, 4, 5, 7]);
  assert.equal(compareFoldingWindow(window('.....', '(...)')).distance, 1);
  assert.equal(compareFoldingWindow(window('(...)', '.....')).distance, 1);
});

test('nucleotide edits remain independent from pairing changes', () => {
  const result = compareFoldingWindow(window('(..).', '(..).', { recodedSequence: 'AAGUA' }));
  assert.deepEqual(result.sequenceChanged, [2, 5]);
  assert.deepEqual(result.pairingChanged, []);
  assert.equal(result.distance, 0);
});

test('missing, malformed, mismatched, or non-RNA output is unavailable', () => {
  for (const value of [undefined, null, {}, ...[
    { wildSequence: undefined }, { recodedSequence: undefined },
    { wildSequence: [] }, { recodedSequence: 123 },
    { wildSequence: '' }, { recodedSequence: '' },
    { wildSequence: 'ACGU\n' }, { wildSequence: 'ACGUT' }, { recodedSequence: 'acguu' },
    { recodedSequence: 'ACGU' }, { length: 4 }, { length: undefined },
    { wildStructure: undefined }, { recodedStructure: undefined },
    { wildStructure: '(..)' }, { recodedStructure: '....' },
    { wildStructure: '(....' }, { recodedStructure: '....)' },
    { wildStructure: '[...]' }, { recodedStructure: '.....\n' },
  ].map((extras) => window('(..).', '(...)', extras))]) {
    assert.equal(compareFoldingWindow(value), null);
  }
});

test('panel renders both windows, exact positions, text markers and explicit unavailable output', () => {
  withFakeDocument((document) => {
    const results = document.createElement('div');
    const panel = { results, rosetta: { setFoldResults() {} } };
    const render = (values) => FoldingPanel.prototype.renderResults.call(panel, values);
    render([{ id: '<gene>', cached: true, windows: {
      start: window(), first100: window('.....', '.....', { recodedSequence: 'AAGUU', delta: 1, recodedMfe: 0 }),
    } }]);
    assert.equal(results.querySelector('pre'), null, 'collapsed details do not build per-base DOM');
    for (const details of results.querySelectorAll('details')) {
      details.dispatch('toggle'); // Closed toggle does no work.
      details.open = true;
      details.dispatch('toggle');
      const alignment = details.querySelector('pre');
      details.open = false;
      details.dispatch('toggle');
      details.open = true;
      details.dispatch('toggle');
      assert.equal(details.querySelector('pre'), alignment, 'reopening reuses the alignment');
      assert.equal(details.querySelectorAll('pre').length, 1);
    }
    assert.match(results.textContent, /<gene> · cached/);
    assert.match(results.textContent, /Δ \+1.00 kcal/);
    assert.match(results.textContent, /0 retained · 1 lost · 1 gained/);
    assert.match(results.textContent, /Pairing-changed positions: 1, 4, 5/);
    assert.match(results.textContent, /Nucleotide-edited positions: 2/);
    assert.match(results.textContent, /1-based within this window, not genomic/);
    assert.equal(results.querySelectorAll('details').length, 2);
    assert.match(results.querySelector('.folding-pair-change').title, /WT partner 4, recoded partner 5/);
    assert.ok(results.querySelector('.folding-sequence-edit'));
    assert.equal(results.querySelector('pre').getAttribute('role'), 'region');
    render([{ id: 'bad', windows: { start: window('.....', '[...]'), first100: {} } }]);
    assert.equal(results.querySelectorAll('details').length, 0);
    assert.match(results.textContent, /Structure comparison unavailable/);
    assert.match(results.textContent, /energy unavailable/);
    assert.doesNotMatch(results.textContent, /distance 0/);
    render([{ id: 'missing' }, { id: 'error', error: 'Unavailable engine' }]);
    assert.match(results.textContent, /Unavailable engine/);
    assert.match(results.textContent, /Structure comparison unavailable/);
  });
});

/**
 * The spread controls in the recoding editor.
 *
 * These exercise the two methods that build and change a distribution, because
 * the rest of the row is unchanged. The invariant they protect is that no
 * control in this panel can produce a scheme the validator would reject: the
 * user is editing a constrained set, and the editor keeps it valid rather than
 * letting it break and then reporting an error.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SchemeEditor } from '../../site/js/ui/scheme-editor.js';
import { validateSchemeMap, ROTATION_SIZE, PRESETS } from '../../site/js/core/scheme.js';
import { withFakeDocument } from './fake-dom.mjs';
import { standardTable } from './helpers.mjs';

const table = standardTable();

/** A partial editor carrying only what the spread methods read. */
function editor(map, { onChange = () => {} } = {}) {
  const view = Object.create(SchemeEditor.prototype);
  view.currentMap = map;
  view.handlers = { onChange };
  view.dataset = { table };
  view.codonOccurrences = new Map(table.codons.map((codon) => [codon, 1000]));
  return view;
}

const SERINE = table.synonymsOf('TCG');

test('splitDestinations turns one replacement into a valid two-way spread', () => {
  const view = editor({ TCG: 'AGC' });
  const next = view.splitDestinations('TCG', [{ codon: 'AGC', share: ROTATION_SIZE }], SERINE);
  assert.equal(Array.isArray(next), true);
  assert.equal(next.length, 2);
  assert.equal(next[0].codon, 'AGC', 'the existing replacement is kept');
  assert.equal(next[0].share + next[1].share, ROTATION_SIZE);
  assert.equal(validateSchemeMap({ TCG: next }, table).ok, true);
});

test('splitDestinations never picks a codon the scheme already removes', () => {
  // Every serine synonym except AGC and TCT is itself a target, so TCT is the
  // only legal partner. Picking any other would make the scheme invalid.
  const map = { TCG: 'AGC', TCA: 'TCT', TCC: 'TCT', AGT: 'TCT' };
  const view = editor(map);
  const next = view.splitDestinations('TCG', [{ codon: 'AGC', share: ROTATION_SIZE }], SERINE);
  assert.equal(Array.isArray(next), true);
  const partner = next[1].codon;
  assert.equal(Object.keys(map).includes(partner), false, `${partner} must not be a target`);
  assert.equal(validateSchemeMap({ ...map, TCG: next }, table).ok, true);
});

test('splitDestinations falls back to the single replacement when nothing is free', () => {
  // With every other synonym taken as a target there is no partner to split to,
  // so the target stays single rather than becoming a one-entry distribution.
  const map = Object.fromEntries(
    SERINE.filter((codon) => codon !== 'AGC').map((codon) => [codon, 'AGC']),
  );
  map.TCG = 'AGC';
  const view = editor(map);
  const next = view.splitDestinations('TCG', [{ codon: 'AGC', share: ROTATION_SIZE }], SERINE);
  assert.equal(next, 'AGC');
  assert.equal(validateSchemeMap({ ...map, TCG: next }, table).ok, true);
});

test('a share edit is rebalanced to a valid scheme, never rejected', async () => {
  await withFakeDocument(() => {
    const destinations = [
      { codon: 'TCT', share: 40 }, { codon: 'TCC', share: 35 }, { codon: 'AGC', share: 25 },
    ];
    let latest = null;
    const view = editor({ TCG: destinations }, { onChange: (map) => { latest = map; } });
    const wrapper = view.shareRows('TCG', destinations, SERINE);
    const inputs = [...wrapper.querySelectorAll('input')];
    assert.equal(inputs.length, 3, 'one share field per destination');

    for (const requested of ['5', '95', '0', '1000', '-4']) {
      inputs[0].value = requested;
      inputs[0].dispatch('change');
      assert.equal(
        validateSchemeMap({ TCG: latest.TCG }, table).ok, true,
        `share ${requested} must still give a valid scheme`,
      );
      const total = latest.TCG.reduce((sum, d) => sum + d.share, 0);
      assert.equal(total, ROTATION_SIZE);
    }
  });
});

test('a destination dropdown offers no codon the scheme removes or already uses', async () => {
  await withFakeDocument(() => {
    const destinations = [{ codon: 'TCT', share: 60 }, { codon: 'TCC', share: 40 }];
    const view = editor({ TCG: destinations, AGT: 'AGC' });
    const wrapper = view.shareRows('TCG', destinations, SERINE);
    const selects = [...wrapper.querySelectorAll('select')];
    const offered = [...selects[0].querySelectorAll('option')].map((o) => o.value);
    assert.equal(offered.includes('TCC'), false, 'the sibling destination is not offered');
    assert.equal(offered.includes('AGT'), false, 'another target is not offered');
    assert.equal(offered.includes('TCT'), true, 'this row keeps its own codon');
  });
});

test('removing a destination from a two-way spread collapses it to a single', async () => {
  await withFakeDocument(() => {
    const destinations = [{ codon: 'TCT', share: 60 }, { codon: 'TCC', share: 40 }];
    let latest = null;
    const view = editor({ TCG: destinations }, { onChange: (map) => { latest = map; } });
    const wrapper = view.shareRows('TCG', destinations, SERINE);
    wrapper.querySelectorAll('.share-remove')[0].dispatch('click');
    assert.equal(latest.TCG, 'TCC', 'the survivor becomes the single replacement');
    assert.equal(validateSchemeMap(latest, table).ok, true);
  });
});

test('removing from a three-way spread keeps the shares summing to a hundred', async () => {
  await withFakeDocument(() => {
    const destinations = [
      { codon: 'TCT', share: 40 }, { codon: 'TCC', share: 35 }, { codon: 'AGC', share: 25 },
    ];
    let latest = null;
    const view = editor({ TCG: destinations }, { onChange: (map) => { latest = map; } });
    const wrapper = view.shareRows('TCG', destinations, SERINE);
    wrapper.querySelectorAll('.share-remove')[2].dispatch('click');
    assert.equal(latest.TCG.length, 2);
    assert.equal(latest.TCG.reduce((sum, d) => sum + d.share, 0), ROTATION_SIZE);
    assert.equal(validateSchemeMap(latest, table).ok, true);
  });
});

test('adding a replacement takes its share from the largest and stays valid', async () => {
  await withFakeDocument(() => {
    const destinations = [{ codon: 'TCT', share: 60 }, { codon: 'TCC', share: 40 }];
    let latest = null;
    const view = editor({ TCG: destinations }, { onChange: (map) => { latest = map; } });
    const wrapper = view.shareRows('TCG', destinations, SERINE);
    const add = [...wrapper.querySelectorAll('button')].find(
      (button) => button.textContent === 'Add a replacement',
    );
    add.dispatch('click');
    assert.equal(latest.TCG.length, 3);
    assert.equal(latest.TCG.reduce((sum, d) => sum + d.share, 0), ROTATION_SIZE);
    assert.equal(validateSchemeMap(latest, table).ok, true);
  });
});

test('the share panel states the totals rule and the per-gene order', async () => {
  await withFakeDocument(() => {
    const destinations = [{ codon: 'TCT', share: 60 }, { codon: 'TCC', share: 40 }];
    const view = editor({ TCG: destinations });
    const wrapper = view.shareRows('TCG', destinations, SERINE);
    const total = wrapper.querySelector('.target-share-total');
    assert.match(total.textContent, /Shares total 100%\./);
    assert.equal(total.className.includes('warn'), false);
    // The note has to say the two things a reader cannot infer from the numbers.
    const note = wrapper.querySelector('.target-share-note').textContent;
    assert.match(note, /start of each gene/);
    assert.match(note, /keeps the amino acid/);
  });
});

test('a share total that is not a hundred is called out rather than hidden', async () => {
  await withFakeDocument(() => {
    const destinations = [{ codon: 'TCT', share: 60 }, { codon: 'TCC', share: 30 }];
    const view = editor({ TCG: destinations });
    const wrapper = view.shareRows('TCG', destinations, SERINE);
    const total = wrapper.querySelector('.target-share-total');
    assert.match(total.textContent, /total 90%, and must total 100%/);
    assert.equal(total.className.includes('warn'), true);
  });
});


test('published presets apply declared shares without genome-frequency substitution', () => {
  for (const preset of PRESETS.filter((p) => p.map)) {
    let result;
    let name;
    const view = editor({}, { onChange: (map) => { result = map; } });
    view.handlers.onNameChange = (value) => { name = value; };
    view.nameInput = {};
    view.presetNote = {};
    view.applyPreset(preset);
    assert.deepEqual(result, preset.map);
    assert.notEqual(result, preset.map);
    assert.equal(name, preset.name);
    assert.equal(view.presetNote.textContent, preset.note);
    assert.equal(view.presetNote.hidden, false);
    if (Array.isArray(result.AGC)) {
      result.AGC[0].share = 1;
      assert.equal(preset.map.AGC[0].share, 54, 'editing does not mutate the shared preset');
    }
  }
});

test('target-only presets still use the active genome prefill', () => {
  let result;
  const view = editor({}, { onChange: (map) => { result = map; } });
  view.handlers.onNameChange = () => {};
  view.nameInput = {};
  view.presetNote = {};
  view.highExpressed = { checked: false };
  view.dataset.meta = { codonCounts: {} };
  view.applyPreset(PRESETS.find((p) => p.id === 'amber'));
  assert.equal(validateSchemeMap(result, table).ok, true);
  assert.equal(Object.keys(result).join(), 'TAG');
});

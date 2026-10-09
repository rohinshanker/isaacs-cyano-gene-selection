import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withFakeDocument } from './fake-dom.mjs';
import { dataset } from './data-sources-fixture.mjs';
import { DataSourcesPanel, HIDDEN_STORAGE_KEY, arrangePeekBody, conditionAxis, conditionTrack } from '../../site/js/ui/data-sources.js';

const unreported = { status: 'not reported', lo: null, hi: null, where: '' };

function fixtureDatasets() {
  return [
    dataset({ id: 'GSE205444', datasetId: 'GSE205444', metricKey: 'expression', group: 'biofilm', treatments: ['biofilm assay'] }),
    dataset({ id: 'TAN', datasetId: 'TAN2018_TSS', metricKey: 'tssInitiation', group: 'other', conditions: { co2: unreported } }),
    dataset({ id: 'GSE9', row: 5, group: 'standard' }),
    dataset({ id: 'GSE9', row: 6, group: 'standard', conditions: { lightIntensity: { lo: 42, hi: 42 } } }),
    dataset({ id: 'ARR', group: 'standard', platform: 'array' }),
    dataset({ id: 'PXD1', group: 'standard', dataType: 'proteomics', platform: 'LC-MS/MS' }),
  ];
}

function memoryStorage(initial = {}) {
  const store = { ...initial };
  return { getItem: (k) => store[k] ?? null, setItem: (k, v) => { store[k] = v; }, store };
}

function mount(document, { onChange = () => {}, storage = memoryStorage() } = {}) {
  const host = document.createElement('div');
  document.body.append(host);
  const panel = new DataSourcesPanel(host, { datasets: fixtureDatasets(), onChange, storage });
  return { host, panel, storage };
}

const rowsOf = (document) => document.querySelectorAll('tr').filter((row) => row.dataset.id);
const rowBoxes = (document) => rowsOf(document).map((row) => row.querySelector('input'));

test('the section lists the selection by data type and marks the colouring source', async () => {
  await withFakeDocument(async (document) => {
    const { host, panel } = mount(document);
    assert.equal(host.querySelector('summary').textContent, 'Data Sources (6 selected)');
    panel.update({ selection: ['GSE205444', 'PXD1.1'], colorMetricKey: 'expression' });
    assert.equal(host.querySelector('summary').textContent, 'Data Sources (2 selected)');
    const items = host.querySelectorAll('li.data-sources-item');
    assert.deepEqual(items.map((item) => item.dataset.id), ['GSE205444', 'PXD1.1']);
    assert.ok(items[0].textContent.includes('colouring the map'));
    assert.ok(!items[1].textContent.includes('colouring the map'));
    assert.deepEqual(host.querySelectorAll('li.data-sources-type').map((li) => li.textContent), ['Transcriptomics', 'Proteomics']);
  });
});

test('an organism with no measured source has no Data Sources section', async () => {
  await withFakeDocument(async (document) => {
    const host = document.createElement('div');
    document.body.append(host);
    new DataSourcesPanel(host, { datasets: [], onChange: () => {}, storage: memoryStorage() });
    assert.equal(host.hidden, true);
    const { host: shown, panel } = mount(document);
    panel.update({ colorMetricKey: 'expression' });
    assert.equal(shown.hidden, false);
  });
});

test('the section opens closed, and is shown only where a data selection informs the colour', async () => {
  await withFakeDocument(async (document) => {
    const { host, panel } = mount(document);
    const details = host.querySelector('details');
    assert.equal(details.open, false, 'closed at the start, by owner decision of 2026-10-06');
    // A computed metric has no data selection behind it.
    panel.update({ colorMetricKey: 'gc3' });
    assert.equal(host.hidden, true);
    // A dataset metric does.
    panel.update({ colorMetricKey: 'tssInitiation' });
    assert.equal(host.hidden, false);
    assert.equal(details.open, false, 'a colour change does not open it');
    // So does the type metric the colour menu offers, which is what the app passes.
    panel.update({ colorMetricKey: 'gc3' });
    panel.update({ colorMetricKey: 'type.transcriptomics.rna-seq.abundance' });
    assert.equal(host.hidden, false, 'a type key names the data type behind the colour');
    panel.update({ colorMetricKey: 'type.fitness.rb-tnseq.fitness' });
    assert.equal(host.hidden, true, 'a type with no dataset has nothing to choose among');
  });
});

test('function-category colouring puts the annotation-source toggles in the section', async () => {
  await withFakeDocument(async (document) => {
    const { host, panel } = mount(document);
    const toggled = [];
    const toggles = [
      { id: 'utex-2973', label: 'UTEX 2973' }, { id: 'pcc-7942', label: 'PCC 7942' }, { id: 'go-iea', label: 'GO IEA' },
    ];
    panel.update({ colorMetricKey: 'functionCategory', annotation: {
      toggles, sources: ['utex-2973', 'go-iea'], onToggle: (id, on) => toggled.push([id, on]),
      explanation: 'UTEX 2973 wins before PCC 7942 and GO IEA; conflicts remain named.',
    } });
    assert.equal(host.hidden, false);
    assert.equal(host.querySelector('summary').textContent, 'Data Sources (UTEX 2973, GO IEA)');
    const boxes = host.querySelectorAll('input').filter((input) => input.type === 'checkbox');
    assert.deepEqual(boxes.map((box) => [box.dataset.sourceId, box.checked]),
      [['utex-2973', true], ['pcc-7942', false], ['go-iea', true]]);
    assert.equal(host.querySelector('div.data-sources-actions').hidden, true, 'no dataset peek to open');
    const explanation = host.querySelector('.data-sources-annotation-explanation');
    assert.equal(explanation.hidden, false);
    assert.match(explanation.textContent, /conflicts remain named/);
    assert.equal(explanation.parentNode, host.querySelector('details'),
      'the explanation exists only inside the expandable section');
    boxes[1].checked = true;
    boxes[1].dispatch('change');
    assert.deepEqual(toggled, [['pcc-7942', true]]);
    // Back to a dataset metric: the list returns and the toggles go.
    panel.update({ colorMetricKey: 'expression', annotation: null });
    assert.equal(host.querySelectorAll('input').filter((input) => input.type === 'checkbox').length, 0);
    assert.equal(explanation.hidden, true, 'non-annotation metrics expose no stale explanation');
    assert.equal(host.querySelector('div.data-sources-actions').hidden, false);
    assert.match(host.querySelector('summary').textContent, /selected\)$/);
  });
});

test('hiding the section is remembered as a convenience, not as link state', async () => {
  await withFakeDocument(async (document) => {
    const { host, storage } = mount(document);
    const hide = host.querySelector('button.data-sources-hide');
    assert.equal(hide.textContent, 'Hide');
    hide.dispatch('click');
    assert.equal(host.querySelector('details').hidden, true);
    assert.equal(hide.textContent, 'Show Data Sources');
    assert.equal(hide.getAttribute('aria-expanded'), 'false');
    assert.equal(storage.store[HIDDEN_STORAGE_KEY], '1');
    const { host: again } = mount(document, { storage: memoryStorage({ [HIDDEN_STORAGE_KEY]: '1' }) });
    assert.equal(again.querySelector('details').hidden, true);
  });
});

test('opening the peek dims and inerts the page, traps focus, and Escape returns it to the opener', async () => {
  await withFakeDocument(async (document) => {
    const { host, panel } = mount(document);
    const opener = host.querySelector('button.data-sources-change');
    opener.focus();
    const promise = panel.open({ opener });
    const backdrop = document.querySelector('.peek-backdrop');
    assert.equal(backdrop.hidden, false);
    assert.equal(document.querySelector('.peek').getAttribute('aria-modal'), 'true');
    assert.equal(host.getAttribute('inert'), '');
    assert.equal(host.getAttribute('aria-hidden'), 'true');
    assert.equal(backdrop.getAttribute('inert'), null);
    assert.equal(document.activeElement.className, 'chip-button peek-close');
    const dialog = document.querySelector('.peek');
    document.querySelector('button.peek-tab').focus();
    dialog.dispatch('keydown', { key: 'Tab', shiftKey: true, preventDefault() {} });
    assert.equal(document.activeElement.className, 'chip-button active peek-done', 'Shift+Tab from the first control wraps to the last');
    dialog.dispatch('keydown', { key: 'Tab', shiftKey: false, preventDefault() {} });
    assert.equal(document.activeElement.className, 'chip-button peek-tab active', 'Tab from the last wraps to the first');
    dialog.dispatch('keydown', { key: 'Escape', preventDefault() {} });
    assert.equal(await promise, null);
    assert.equal(backdrop.hidden, true);
    assert.equal(host.getAttribute('inert'), null);
    assert.equal(document.activeElement, opener);
  });
});

test('the list groups the current type, splits a group into comparable sets, and omits select-all where the owner said', async () => {
  await withFakeDocument(async (document) => {
    const { panel } = mount(document);
    panel.open({ dataType: 'transcriptomics' });
    const groups = document.querySelectorAll('tr.ds-group');
    assert.deepEqual(groups.map((row) => row.querySelector('.ds-group-name').textContent),
      ['Biofilm, bioreactor and co-culture', 'Standard photoautotrophic growth', 'Other']);
    assert.ok(groups[0].querySelector('input'), 'a group has a select-all box');
    assert.equal(groups[2].querySelector('input'), null, 'the Other group has none');
    assert.equal(rowsOf(document).length, 4, 'array datasets are hidden until asked for');
    const subgroups = document.querySelectorAll('tr.ds-subgroup');
    assert.equal(subgroups.length, 0, 'two comparable rows need no subgroup header');
    const tabs = document.querySelectorAll('button.peek-tab');
    assert.deepEqual(tabs.map((tab) => tab.textContent), ['Transcriptomics (5)', 'Proteomics (1)', 'Fitness screen (0)']);
    tabs[1].dispatch('click');
    assert.equal(rowsOf(document).length, 1);
    assert.equal(rowsOf(document)[0].dataset.id, 'PXD1.1');
    panel.peek.settle(null);
  });
});

test('the array toggle, the flat view, select-all and the filters reshape the list', async () => {
  await withFakeDocument(async (document) => {
    const { panel } = mount(document);
    panel.open({ dataType: 'transcriptomics' });
    const bar = document.querySelector('.peek-bar');
    const [arrays, flat] = bar.querySelectorAll('input');
    arrays.checked = true; arrays.dispatch('change');
    assert.equal(rowsOf(document).length, 5);
    flat.checked = true; flat.dispatch('change');
    assert.equal(document.querySelectorAll('tr.ds-group').length, 0);
    const add = document.querySelector('select.peek-add-filter');
    add.value = 'temperature'; add.dispatch('change');
    const chip = document.querySelector('span.peek-filter');
    const [min, max, missing] = chip.querySelectorAll('input');
    min.value = '36'; min.dispatch('input');
    assert.equal(rowsOf(document).length, 0);
    assert.equal(document.querySelector('td.ds-empty').textContent, 'No dataset matches the filters.');
    max.value = ''; max.dispatch('input');
    missing.checked = true; missing.dispatch('change');
    assert.equal(rowsOf(document).length, 0, 'every fixture reports a temperature');
    chip.querySelector('button.peek-filter-remove').dispatch('click');
    assert.equal(rowsOf(document).length, 5);
    add.value = 'strain'; add.dispatch('change');
    const choice = document.querySelector('span.peek-filter').querySelectorAll('input')[0];
    choice.checked = true; choice.dispatch('change');
    assert.equal(rowsOf(document).length, 5, 'the one strain present keeps every row');
    add.value = 'study'; add.dispatch('change');
    const text = document.querySelectorAll('span.peek-filter')[1].querySelector('input');
    text.value = 'GSE9'; text.dispatch('input');
    assert.equal(rowsOf(document).length, 2);
    const buttons = bar.querySelectorAll('button.chip-button');
    const selectAll = buttons.find((b) => b.textContent === 'Select all shown');
    const clear = buttons.find((b) => b.textContent === 'Clear selection');
    clear.dispatch('click');
    assert.equal(panel.peek.state.selected.size, 0);
    selectAll.dispatch('click');
    assert.deepEqual([...panel.peek.state.selected].sort(), ['GSE9.5', 'GSE9.6']);
    assert.ok(document.querySelector('.peek-count').textContent.startsWith('2 of 5'));
    panel.peek.settle(null);
  });
});

test('Done hands the edited selection out and re-renders the section', async () => {
  await withFakeDocument(async (document) => {
    const changes = [];
    const { host, panel } = mount(document, { onChange: (ids) => changes.push(ids) });
    const promise = panel.open({ dataType: 'transcriptomics' });
    const box = rowBoxes(document).find((input) => input.getAttribute('aria-label').startsWith('Show TAN'));
    box.checked = false; box.dispatch('change');
    document.querySelector('button.peek-done').dispatch('click');
    const result = await promise;
    assert.deepEqual(result, ['ARR.1', 'GSE205444', 'GSE9.5', 'GSE9.6', 'PXD1.1']);
    assert.deepEqual(changes, [result]);
    assert.equal(host.querySelector('summary').textContent, 'Data Sources (5 selected)');
  });
});

test('single mode offers radios and resolves to the chosen metric key', async () => {
  await withFakeDocument(async (document) => {
    const { panel } = mount(document);
    const promise = panel.open({ mode: 'single', dataType: 'transcriptomics', current: 'GSE205444', title: 'Pick one' });
    assert.equal(document.querySelector('.peek-title').textContent, 'Pick one');
    assert.equal(document.querySelector('button.peek-done').textContent, 'Use this source');
    const boxes = rowBoxes(document);
    assert.ok(boxes.every((input) => input.getAttribute('type') === 'radio'));
    assert.equal(document.querySelectorAll('tr.ds-group').find((row) => row.textContent.startsWith(' Biofilm')), undefined, 'no select-all in single mode');
    boxes[2].checked = true; boxes[2].dispatch('change');
    assert.equal(panel.peek.state.selected.size, 1);
    document.querySelector('button.peek-done').dispatch('click');
    assert.equal(await promise, 'mGSE96');
  });
});

test('the info button shows every axis as reported with its quote, the replicates, and a linked citation', async () => {
  await withFakeDocument(async (document) => {
    const { panel } = mount(document);
    panel.open({ dataType: 'transcriptomics' });
    rowsOf(document)[0].querySelector('button.ds-info').dispatch('click');
    const side = document.querySelector('.peek-side');
    assert.ok(side.textContent.includes('Conditions as the source reports them'));
    const rows = side.querySelectorAll('tr');
    assert.equal(rows.length, 8, 'seven axes and the replicates');
    assert.ok(side.querySelector('q'), 'quotes are shown');
    const links = side.querySelectorAll('a');
    assert.equal(links[0].getAttribute('href'), 'https://doi.org/10.1/x');
    assert.equal(links[0].getAttribute('rel'), 'noopener');
    assert.ok(links[1].textContent.startsWith('Open the archive record'));
    side.querySelector('button').dispatch('click');
    assert.ok(side.querySelector('.ds-side-title').textContent.startsWith('Compare selected'));
    panel.peek.settle(null);
  });
});

test('the comparison pane lays the selection on shared axes and names what is unreported', async () => {
  await withFakeDocument(async (document) => {
    const { panel } = mount(document);
    panel.open({ dataType: 'transcriptomics' });
    const side = document.querySelector('.peek-side');
    assert.equal(side.querySelector('.ds-side-title').textContent, 'Compare selected (5)');
    const spreads = side.querySelectorAll('p.ds-spread').map((p) => p.textContent);
    assert.equal(spreads[0], '30 °C across 5');
    assert.equal(spreads[2], '1 % across 4; not reported for 1');
    assert.ok(side.querySelectorAll('svg').length >= 3 + 5 * 2, 'an axis and a track per row for each reported axis');
    panel.peek.settle(null);
  });
});

test('a track carries its ticks and bands and names the value, and the axis labels the shared scale', async () => {
  await withFakeDocument(async (document) => {
    const track = conditionTrack('temperature', [30, 30], '30 °C');
    assert.equal(track.getAttribute('aria-label'), '30 °C. As reported: 30 °C');
    const tags = track.children.map((child) => child.tagName);
    assert.equal(tags.filter((tag) => tag === 'rect').length, 2, 'two regime bands');
    assert.equal(tags.filter((tag) => tag === 'line').length, 6, 'five ticks and the baseline');
    assert.ok(tags.includes('circle'));
    const range = conditionTrack('co2', [1, 3], '1–3%');
    assert.ok(range.children.some((child) => child.tagName === 'rect' && child.getAttribute('rx') === '5'), 'a range is a bar');
    const light = conditionTrack('lightIntensity', [600, 600], 'x');
    assert.ok(light.children.some((child) => child.getAttribute('stroke-dasharray') === '2 2'), 'the 400 µmol rule is drawn');
    assert.equal(light.children.find((c) => c.tagName === 'circle').getAttribute('fill'), '#eb6834');
    const axis = conditionAxis('lightIntensity');
    const labels = axis.children.filter((child) => child.tagName === 'text').map((t) => t.textContent);
    assert.deepEqual(labels, ['10', '100', '1000']);
    assert.equal(axis.children.filter((child) => child.tagName === 'text').at(-1).getAttribute('text-anchor'), 'end');
  });
});

test('the colouring type lists every dataset of it, with inclusion, a pooled row and an alone-informs radio', async () => {
  await withFakeDocument(async (document) => {
    const { host, panel } = mount(document);
    const informed = []; const selected = [];
    let chosenId = 'GSE9.5';
    let selection = ['GSE9.5', 'GSE9.6', 'PXD1.1'];
    const typeKey = (d) => `type.${d.record.dataType}.${d.record.platform}`;
    const informing = {
      typeOf: (d) => ({ key: typeKey(d), label: `${d.record.dataType} (${d.record.platform})` }),
      chosen: (key) => panel.datasets.find((d) => typeKey(d) === key && d.id === chosenId) ?? null,
      onInform: (key, id) => { informed.push([key, id]); chosenId = id; },
      colorTypeKey: 'type.transcriptomics.RNA-seq',
      allOfType: (key) => panel.datasets.filter((d) => typeKey(d) === key),
      isSelected: (id) => selection.includes(id),
      onSelect: (id, on) => { selected.push([id, on]); selection = on ? [...selection, id] : selection.filter((x) => x !== id); },
    };
    panel.update({ selection, colorMetricKey: 'type.transcriptomics.RNA-seq', informing });
    // Every RNA-seq dataset of the fixture is listed, included or not.
    const items = host.querySelectorAll('li.data-sources-item');
    const includes = host.querySelectorAll('input').filter((input) => input.type === 'checkbox');
    assert.deepEqual(includes.map((box) => [box.id, box.checked]), [
      ['ds-include-GSE205444', false], ['ds-include-TAN2018_TSS', false],
      ['ds-include-GSE9.5', true], ['ds-include-GSE9.6', true],
    ], 'unselected datasets of the type are offered with an unchecked box');
    assert.match(host.querySelector('summary').textContent, /2 of 4 for transcriptomics \(RNA-seq\); 3 selected in all/);
    const radios = host.querySelectorAll('input').filter((input) => input.type === 'radio');
    assert.deepEqual(radios.map((r) => [r.id, r.checked]), [
      ['ds-inform-type.transcriptomics.RNA-seq-pooled', false],
      ['ds-inform-type.transcriptomics.RNA-seq-GSE9.5', true],
      ['ds-inform-type.transcriptomics.RNA-seq-GSE9.6', false],
    ], 'only included datasets get an alone-informs radio');
    assert.ok(items[0].textContent.includes('Pooled: transcriptomics (RNA-seq) over 2 datasets'));
    assert.ok(host.querySelectorAll('li.data-sources-type').some((li) => li.textContent.includes('Also selected: Proteomics')));
    // Including another dataset goes through the selection.
    includes[0].checked = true;
    includes[0].dispatch('change');
    assert.deepEqual(selected, [['GSE205444', true]]);
    // Naming one, then pooling again.
    radios[2].checked = true;
    radios[2].dispatch('change');
    assert.deepEqual(informed, [['type.transcriptomics.RNA-seq', 'GSE9.6']]);
    radios[0].checked = true;
    radios[0].dispatch('change');
    assert.deepEqual(informed.at(-1), ['type.transcriptomics.RNA-seq', null]);
    chosenId = null;
    panel.update({ selection, informing });
    assert.ok(host.querySelectorAll('li.data-sources-item')[0].textContent.includes('colouring the map'));
    // A computed colour lists the selection plainly, with no controls.
    panel.update({ selection, colorMetricKey: 'gc3', informing: { ...informing, colorTypeKey: null } });
    assert.equal(host.querySelectorAll('input').length, 0);
    assert.match(host.querySelector('summary').textContent, /\(\d+ selected\)$/);
  });
});

test('tab, row, group and filter replacement keeps focus inside the data selection dialog', async () => {
  await withFakeDocument((document) => {
    const { panel } = mount(document);
    panel.open();
    const tabs = document.querySelectorAll('.peek-tab');
    tabs[1].focus();
    tabs[1].dispatch('click');
    assert.equal(document.activeElement.textContent, 'Proteomics (1)');
    assert.equal(document.activeElement.isConnected, true);
    const box = rowBoxes(document)[0];
    box.focus();
    box.checked = true;
    box.dispatch('change');
    assert.equal(document.activeElement.getAttribute('aria-label'), box.getAttribute('aria-label'));
    assert.equal(document.activeElement.isConnected, true);
    const group = document.querySelector('.ds-group').querySelector('input');
    group.focus(); group.checked = false; group.dispatch('change');
    assert.equal(document.activeElement.getAttribute('aria-label'), group.getAttribute('aria-label'));
    const add = document.querySelector('.peek-add-filter');
    add.focus(); add.value = 'study'; add.dispatch('change');
    assert.equal(document.activeElement.getAttribute('aria-label'), 'Add a filter');
    const remove = document.querySelector('.peek-filter-remove');
    remove.focus(); remove.dispatch('click');
    assert.equal(document.activeElement.getAttribute('aria-label'), 'Add a filter');
    const info = document.querySelector('.ds-info');
    info.focus(); info.dispatch('click');
    const back = document.querySelector('.peek-side').querySelector('button');
    back.focus(); back.dispatch('click');
    assert.equal(document.activeElement, info);
    info.dispatch('click');
    panel.renderList();
    document.querySelector('.peek-side').querySelector('button').dispatch('click');
    assert.equal(document.activeElement, panel.peek.close, 'detached info opener falls back inside the dialog');
    panel.peek.settle(null);
  });
});

test('data type tabs use arrow, Home and End keys with one keyboard tab stop', async () => {
  await withFakeDocument((document) => {
    const { panel } = mount(document);
    panel.open();
    let prevented = 0;
    const key = (key) => document.querySelectorAll('.peek-tab').find((tab) => tab.hasClass('active')).dispatch('keydown', { key, preventDefault() { prevented++; } });
    key('ArrowRight'); assert.equal(panel.peek.state.type, 'proteomics');
    key('End'); assert.equal(panel.peek.state.type, 'fitness');
    key('ArrowRight'); assert.equal(panel.peek.state.type, 'transcriptomics');
    key('ArrowLeft'); assert.equal(panel.peek.state.type, 'fitness');
    key('Home'); assert.equal(panel.peek.state.type, 'transcriptomics');
    key('Enter'); assert.equal(prevented, 5);
    assert.equal(document.activeElement, document.querySelectorAll('.peek-tab').find((tab) => tab.hasClass('active')));
    assert.deepEqual(document.querySelectorAll('.peek-tab').map((tab) => tab.getAttribute('tabindex')), ['0', '-1', '-1']);
    // A selected row removed by a filter falls back to a remaining dialog control.
    const box = rowBoxes(document)[0]; box.focus();
    panel.peek.state.filters = [{ field: 'study', query: 'no-such-study' }];
    panel.renderList();
    assert.equal(document.activeElement, panel.peek.close);
    panel.peek.settle(null);
  });
});

test('responsive pane order follows the layout and preserves the focused control', async () => {
  await withFakeDocument((document) => {
    const body = document.createElement('div');
    const list = document.createElement('div');
    const foot = document.createElement('div');
    const side = document.createElement('div');
    const control = document.createElement('button');
    side.append(control); body.append(list, foot, side); document.body.append(body);
    control.focus();
    arrangePeekBody(body, { list, foot, side }, true);
    assert.deepEqual(body.children, [list, side, foot]);
    assert.equal(document.activeElement, control);
    const children = body.children;
    arrangePeekBody(body, { list, foot, side }, true);
    assert.equal(body.children, children, 'unchanged layout does not detach its nodes');
    arrangePeekBody(body, { list, foot, side }, false);
    assert.deepEqual(body.children, [list, foot, side]);
    assert.equal(document.activeElement, control);
    document.body.focus();
    arrangePeekBody(body, { list, foot, side }, true);
    assert.equal(document.activeElement, document.body, 'outside focus is not stolen');
  });
});

test('a breakpoint reflow keeps focused content inside its own scroll pane', async () => {
  await withFakeDocument((document) => {
    const body = document.createElement('div');
    const list = document.createElement('div');
    const foot = document.createElement('div');
    const side = document.createElement('div');
    const control = document.createElement('button');
    side.append(control); body.append(list, foot, side); document.body.append(body);
    list.scrollTop = 250;
    side.scrollTop = 50; side.scrollLeft = 50;
    side.clientTop = 1; side.clientLeft = 1; side.clientHeight = 68; side.clientWidth = 68;
    side.getBoundingClientRect = () => ({ top: 30, bottom: 100, left: 30, right: 100 });
    control.getBoundingClientRect = () => ({ top: 10, bottom: 20, left: 10, right: 20 });
    control.focus();
    arrangePeekBody(body, { list, foot, side }, true);
    assert.equal(side.scrollTop, 28); assert.equal(side.scrollLeft, 28);
    assert.equal(list.scrollTop, 250, 'the other pane retains its position');
    control.getBoundingClientRect = () => ({ top: 90, bottom: 125, left: 90, right: 125 });
    arrangePeekBody(body, { list, foot, side }, false);
    assert.equal(side.scrollTop, 55); assert.equal(side.scrollLeft, 55);
    control.getBoundingClientRect = () => ({ top: 50, bottom: 60, left: 50, right: 60 });
    arrangePeekBody(body, { list, foot, side }, true);
    assert.equal(side.scrollTop, 55); assert.equal(side.scrollLeft, 55, 'visible focus does not scroll');
    assert.equal(document.activeElement, control);
  });
});


test('focused list controls stay below the opaque sticky header after reflow', async () => {
  await withFakeDocument((document) => {
    const body = document.createElement('div'), list = document.createElement('div');
    const foot = document.createElement('div'), side = document.createElement('div');
    const head = document.createElement('thead'), th = document.createElement('th');
    const control = document.createElement('input');
    head.append(th); list.append(head, control); body.append(list, side, foot); document.body.append(body);
    list.scrollTop = 600; list.scrollLeft = 0;
    list.getBoundingClientRect = () => ({ top: 167.2, bottom: 498, left: 20, right: 1000 });
    th.getBoundingClientRect = () => ({ bottom: 235.2 });
    control.getBoundingClientRect = () => ({ top: 221.4, bottom: 234.4, left: 30, right: 43 });
    control.focus(); arrangePeekBody(body, { list, foot, side }, false);
    assert.equal(list.scrollTop, 585, 'scrolls sufficiently past the header despite integer rounding');
    assert.equal(document.activeElement, control);
  });
});


test('focus scrolling exposes row context when it fits, and the control for oversized rows', async () => {
  await withFakeDocument((document) => {
    const body = document.createElement('div'), list = document.createElement('div');
    const foot = document.createElement('div'), side = document.createElement('div');
    const row = document.createElement('tr'), control = document.createElement('input');
    row.append(control); list.append(row); body.append(list, side, foot); document.body.append(body);
    list.scrollTop = 600; list.scrollLeft = 0;
    list.getBoundingClientRect = () => ({ top: 235, bottom: 500, left: 20, right: 1000 });
    control.getBoundingClientRect = () => ({ top: 250, bottom: 263, left: 30, right: 43 });
    control.closest = () => row;
    row.getBoundingClientRect = () => ({ top: 220, bottom: 295, height: 75 });
    control.focus(); arrangePeekBody(body, { list, foot, side }, false);
    assert.equal(list.scrollTop, 584, 'the accession and row content clear the header too');
    row.getBoundingClientRect = () => ({ top: 100, bottom: 800, height: 700 });
    arrangePeekBody(body, { list, foot, side }, true);
    assert.equal(list.scrollTop, 584, 'an oversized row does not hide its already visible control');
  });
});

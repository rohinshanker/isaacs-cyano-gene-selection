/**
 * A compendium study collapses to one row, and its subset is chosen in a grid
 * peek stacked over the data selection (owner decision, 2026-10-07).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withFakeDocument } from './fake-dom.mjs';
import { dataset } from './data-sources-fixture.mjs';
import { DataSourcesPanel } from '../../site/js/ui/data-sources.js';
import { COMPENDIUM_MIN_SETS, compendiumStudies, conditionGrid } from '../../site/js/core/data-sources.js';

/** A compendium of `n` dosed conditions over three compounds, plus a control. */
function compendium(n = 20) {
  const compounds = ['Rifampicin', 'Sodium Chloride', 'Zinc sulfate'];
  const out = [];
  for (let i = 0; i < n - 1; i += 1) {
    const compound = compounds[i % compounds.length];
    const dose = (i + 1) / 8;
    out.push(dataset({
      id: 'FB', row: i + 1, datasetId: `FB.${i + 1}`, metricKey: `fb${i + 1}`,
      group: 'stress', dataType: 'fitness', platform: 'RB-TnSeq',
      conditionSet: `${compound} at ${dose} mM`,
    }));
  }
  out.push(dataset({
    id: 'FB', row: n, datasetId: `FB.${n}`, metricKey: `fb${n}`,
    group: 'standard', dataType: 'fitness', platform: 'RB-TnSeq',
    conditionSet: 'BG-11 with no added compound',
  }));
  return out;
}

/** The first input anywhere under a node; fake-dom has no descendant selectors. */
function boxOf(node) {
  if (!node) return null;
  const found = node.descendants().find((child) => child.tagName === 'input');
  return found ?? null;
}

const ordinary = () => [
  dataset({ id: 'GSE1', row: 1, datasetId: 'GSE1.1', metricKey: 'm1', group: 'standard' }),
  dataset({ id: 'GSE2', row: 1, datasetId: 'GSE2.1', metricKey: 'm2', group: 'stress' }),
];

function mount(document, datasets) {
  const host = document.createElement('div');
  document.body.append(host);
  const panel = new DataSourcesPanel(host, { datasets, onChange: () => {}, storage: null });
  return { host, panel };
}

test('a study under the threshold is not a compendium, and one at it is', () => {
  assert.equal(compendiumStudies(compendium(COMPENDIUM_MIN_SETS - 1)).size, 0);
  const found = compendiumStudies(compendium(COMPENDIUM_MIN_SETS));
  assert.deepEqual([...found.keys()], ['FB']);
  assert.equal(found.get('FB').length, COMPENDIUM_MIN_SETS);
});

test('the grid is compound by dose, ascending, with undosed sets kept aside', () => {
  const layout = conditionGrid(compendium(20));
  assert.deepEqual(layout.compounds.map((row) => row.compound),
    ['Rifampicin', 'Sodium Chloride', 'Zinc sulfate'], 'compounds read in order');
  for (const row of layout.compounds) {
    const doses = row.cells.map((cell) => Number.parseFloat(cell.dose));
    assert.deepEqual(doses, [...doses].sort((a, b) => a - b), `${row.compound} doses ascend`);
  }
  assert.deepEqual(layout.loose.map((d) => d.record.conditionSet), ['BG-11 with no added compound'],
    'a set naming no dose is never forced into a cell');
  const cells = layout.compounds.reduce((n, row) => n + row.cells.length, 0) + layout.loose.length;
  assert.equal(cells, 20, 'every condition set is placed exactly once');
  assert.equal(layout.width, Math.max(...layout.compounds.map((r) => r.cells.length)));
});

test('the peek shows one row for the compendium and ordinary rows for the rest', async () => {
  await withFakeDocument(async (document) => {
    const datasets = [...ordinary(), ...compendium(20)];
    const { panel } = mount(document, datasets);
    panel.open({ dataType: 'fitness' });
    const collapsed = document.querySelectorAll('tr.ds-compendium');
    assert.equal(collapsed.length, 1, 'ninety-style studies collapse to a single row');
    assert.equal(collapsed[0].dataset.study, 'FB');
    assert.ok(collapsed[0].textContent.includes('20 condition sets, pooled'));
    const perDataset = document.querySelectorAll('tr').filter((row) => row.dataset.id?.startsWith('FB.'));
    assert.equal(perDataset.length, 0, 'no member is drawn as its own row');
  });
});

test('the row checkbox takes the whole compendium in or out', async () => {
  await withFakeDocument(async (document) => {
    const datasets = [...ordinary(), ...compendium(20)];
    const { panel } = mount(document, datasets);
    panel.open({ dataType: 'fitness' });
    const ids = datasets.filter((d) => d.record.studyId === 'FB').map((d) => d.id);
    const box = boxOf(document.querySelector('tr.ds-compendium'));
    box.checked = false;
    box.dispatch('change');
    assert.ok(ids.every((id) => !panel.peek.state.selected.has(id)), 'clearing removes every member');
    const again = boxOf(document.querySelector('tr.ds-compendium'));
    again.checked = true;
    again.dispatch('change');
    assert.ok(ids.every((id) => panel.peek.state.selected.has(id)), 'checking takes every member');
  });
});

test('choosing conditions opens a second peek stacked over the first', async () => {
  await withFakeDocument(async (document) => {
    const datasets = [...ordinary(), ...compendium(20)];
    const { panel } = mount(document, datasets);
    panel.open({ dataType: 'fitness' });
    assert.equal(panel.modals.length, 1);
    document.querySelector('button.ds-choose').dispatch('click');
    assert.equal(panel.modals.length, 2, 'the grid stacks rather than replacing the selection');
    assert.ok(panel.isTopModal(panel.gridPeek), 'the grid is on top');
    assert.equal(panel.peek.backdrop.hidden, false, 'the selection stays on screen underneath');
    assert.equal(panel.peek.dialog.getAttribute('inert'), '', 'the selection beneath is inert');
    assert.equal(panel.gridPeek.dialog.getAttribute('inert'), null, 'the grid is live');
    const rows = document.querySelectorAll('div.cg-row');
    assert.equal(rows.length, 4, 'three compounds and the undosed control');
    assert.equal(document.querySelectorAll('label.cg-cell').length, 20, 'one checkbox per condition');
  });
});

test('closing the grid hands the reader back to the selection, still open', async () => {
  await withFakeDocument(async (document) => {
    const { panel } = mount(document, [...ordinary(), ...compendium(20)]);
    panel.open({ dataType: 'fitness' });
    document.querySelector('button.ds-choose').dispatch('click');
    panel.gridPeek.close.dispatch('click');
    assert.equal(panel.modals.length, 1, 'only the selection is left open');
    assert.equal(panel.gridPeek.backdrop.hidden, true);
    assert.equal(panel.peek.dialog.getAttribute('inert'), null, 'the selection is live again');
    assert.ok(panel.isTopModal(panel.peek));
  });
});

test('the grid returns the subset and the row reports it', async () => {
  await withFakeDocument(async (document) => {
    const datasets = [...ordinary(), ...compendium(20)];
    const { panel } = mount(document, datasets);
    panel.open({ dataType: 'fitness' });
    document.querySelector('button.ds-choose').dispatch('click');
    const clear = document.querySelector('div.cg-bar').children.find((b) => b.textContent === 'Clear all');
    clear.dispatch('click');
    assert.equal(panel.gridPeek.state.chosen.size, 0);
    const first = boxOf(document.querySelector('label.cg-cell'));
    first.checked = true;
    first.dispatch('change');
    assert.equal(panel.gridPeek.state.chosen.size, 1, 'one cell selects one condition');
    assert.ok(panel.gridPeek.count.textContent.includes('1 of 20'));
    panel.gridPeek.done.dispatch('click');
    await Promise.resolve();
    await Promise.resolve();
    const selected = [...panel.peek.state.selected].filter((id) => id.startsWith('FB.'));
    assert.equal(selected.length, 1, 'Done narrows the selection to the chosen subset');
  });
});

test('a compound row box takes every dose of that compound', async () => {
  await withFakeDocument(async (document) => {
    const { panel } = mount(document, [...ordinary(), ...compendium(20)]);
    panel.open({ dataType: 'fitness' });
    document.querySelector('button.ds-choose').dispatch('click');
    document.querySelector('div.cg-bar').children.find((b) => b.textContent === 'Clear all')
      .dispatch('click');
    const head = boxOf(document.querySelector('div.cg-rowhead'));
    head.checked = true;
    head.dispatch('change');
    const layout = conditionGrid(compendium(20));
    assert.equal(panel.gridPeek.state.chosen.size, layout.compounds[0].cells.length,
      'the row box covers exactly that compound every dose');
  });
});

test('the Data Sources section shows the compendium as one row, not ninety', async () => {
  await withFakeDocument(async (document) => {
    const datasets = [...ordinary(), ...compendium(20)];
    const { host, panel } = mount(document, datasets);
    const members = datasets.filter((d) => d.record.studyId === 'FB');
    const typeKey = 'type.fitness.RB-TnSeq.fitness';
    panel.update({
      selection: members.map((d) => d.id),
      colorMetricKey: typeKey,
      informing: {
        colorTypeKey: typeKey,
        allOfType: () => members,
        typeOf: () => ({ key: typeKey, label: 'Gene fitness (RB-TnSeq)' }),
        chosen: () => null,
        onInform: () => {},
        onSelect: () => {},
      },
    });
    const rows = host.querySelectorAll('li.data-sources-compendium');
    assert.equal(rows.length, 1, 'one row stands for the whole compendium');
    assert.ok(rows[0].textContent.includes('20 condition sets, pooled'));
    assert.ok(rows[0].textContent.includes('all conditions'), 'and says the whole pool is in');
    const perDataset = host.querySelectorAll('li.data-sources-item').filter((li) => li.dataset.id?.startsWith('FB.'));
    assert.equal(perDataset.length, 0, 'no member is listed separately');
  });
});

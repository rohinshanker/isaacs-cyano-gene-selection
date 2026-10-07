import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withFakeDocument } from './fake-dom.mjs';
import { ConditionGuides, guideGeometry } from '../../site/js/ui/condition-guides.js';
import { DataSourcesPanel, conditionAxis } from '../../site/js/ui/data-sources.js';
import { dataset } from './data-sources-fixture.mjs';

const rect = (left, top, width, height) => ({ left, top, width, height, right: left + width, bottom: top + height });

function mount(document) {
  const dialog = document.createElement('div');
  const list = document.createElement('div');
  const count = document.createElement('span');
  dialog.append(list, count);
  document.body.append(dialog);
  list.getBoundingClientRect = () => rect(10, 20, 500, 200);
  count.getBoundingClientRect = () => rect(20, 450, 280, 30);
  const headers = ['temperature', 'lightIntensity', 'co2'].map((axis, index) => {
    const header = document.createElement('th');
    header.className = 'ds-axis-header';
    header.setAttribute('data-condition-axis', axis);
    const track = conditionAxis(axis);
    header.getBoundingClientRect = () => rect(20 + index * 120, 20, 120, 40);
    track.getBoundingClientRect = () => rect(27 + index * 120, 40, 104, 20);
    header.append(track);
    list.append(header);
    return header;
  });
  const events = new Map();
  const viewport = {
    addEventListener: (name, handler) => events.set(name, handler),
    removeEventListener: (name) => events.delete(name),
  };
  const observed = [];
  let callback;
  let disconnected = 0;
  class Observer {
    constructor(next) { callback = next; }
    observe(node) { observed.push(node); }
    disconnect() { disconnected++; }
  }
  const guides = new ConditionGuides({ dialog, list, count, viewport, Observer });
  return { guides, list, count, headers, events, observed, resize: () => callback(), disconnected: () => disconnected };
}

test('guide geometry follows rendered tick scaling, clips horizontally, and ends at the count', () => {
  assert.deepEqual(guideGeometry({ list: rect(10, 20, 100, 200), track: rect(-10, 30, 208, 20),
    count: rect(10, 400, 100, 32), ticks: [0, 7, 40, 70, 104], axisWidth: 104 }),
  { left: 10, top: 49, width: 100, height: 383, ticks: [60] });
  const args = { list: rect(0, 0, 100, 200), track: rect(0, 0, 104, 20),
    count: rect(0, 200, 100, 20), ticks: [7], axisWidth: 104 };
  assert.equal(guideGeometry({ ...args, list: rect(0, 0, 0, 200) }), null);
  assert.equal(guideGeometry({ ...args, track: rect(0, 0, 0, 20) }), null);
  assert.equal(guideGeometry({ ...args, axisWidth: 0 }), null);
  assert.equal(guideGeometry({ ...args, count: rect(0, 0, 100, 10) }), null);
});

test('entry, column movement, switching, exit, and touch preserve a decorative overlay', async () => {
  await withFakeDocument((document) => {
    const { guides, list, observed, events, disconnected } = mount(document);
    const overlay = guides.overlay;
    assert.equal(overlay.getAttribute('hidden'), '');
    assert.equal(overlay.getAttribute('aria-hidden'), 'true');
    list.dispatch('pointerover', { clientX: 70, clientY: 30, pointerType: 'mouse' });
    assert.equal(guides.axis, 'temperature');
    assert.equal(overlay.getAttribute('hidden'), null);
    assert.equal(overlay.querySelectorAll('line').length, 5);
    assert.equal(overlay.style.height, '421px', 'ends at count bottom 480, from header tick end 59');
    assert.ok(overlay.querySelectorAll('line').every((line) => line.getAttribute('y2') === '421'));
    assert.equal(observed.length, 3);
    list.dispatch('pointermove', { clientX: 80, clientY: 200 });
    assert.equal(guides.axis, 'temperature', 'row and group boundaries do not interrupt a column');
    list.dispatch('pointermove', { clientX: 190, clientY: 200 });
    assert.equal(guides.axis, 'lightIntensity');
    list.dispatch('pointermove', { clientX: 310, clientY: 200 });
    assert.equal(guides.axis, 'co2');
    list.dispatch('pointerleave');
    assert.equal(overlay.getAttribute('hidden'), '');
    assert.equal(overlay.children.length, 0);
    assert.equal(disconnected(), 1);
    assert.equal(events.size, 0);
    list.dispatch('pointerover', { clientX: 70, clientY: 30, pointerType: 'touch' });
    assert.equal(guides.axis, null);
    list.dispatch('scroll');
    assert.equal(guides.axis, null);
  });
});

test('scrolling and resizing use current header and count geometry, clearing unavailable columns', async () => {
  await withFakeDocument((document) => {
    const { guides, list, count, headers, events, resize } = mount(document);
    list.dispatch('pointerover', { clientX: 70, clientY: 100 });
    const firstX = guides.overlay.querySelector('line').getAttribute('x1');
    headers[0].querySelector('svg').getBoundingClientRect = () => rect(17, 40, 104, 20);
    list.dispatch('scroll');
    assert.equal(Number(guides.overlay.querySelector('line').getAttribute('x1')), Number(firstX) - 10);
    count.getBoundingClientRect = () => rect(20, 600, 280, 50);
    events.get('resize')();
    assert.equal(guides.overlay.style.height, '591px');
    count.getBoundingClientRect = () => rect(20, 700, 280, 30);
    resize();
    assert.equal(guides.overlay.style.height, '671px');
    headers[0].getBoundingClientRect = () => rect(-500, 20, 120, 40);
    list.dispatch('scroll');
    assert.equal(guides.axis, null);
    list.dispatch('pointerover', { clientX: 190, clientY: 221 });
    assert.equal(guides.axis, null, 'outside the scroll list');
    list.dispatch('pointerover', { clientX: 190, clientY: 100 });
    count.getBoundingClientRect = () => rect(20, 0, 100, 1);
    list.dispatch('scroll');
    assert.equal(guides.axis, null, 'unavailable footer geometry');
    list.replaceChildren();
    list.dispatch('pointerover', { clientX: 70, clientY: 100 });
    assert.equal(guides.axis, null);
  });
});

test('panel replacement and popup closure clear stale guides', async () => {
  await withFakeDocument((document) => {
    const host = document.createElement('div');
    document.body.append(host);
    const panel = new DataSourcesPanel(host, { datasets: [dataset()], onChange() {} });
    panel.open();
    const { guides } = panel.peek;
    guides.axis = 'temperature';
    guides.overlay.removeAttribute('hidden');
    panel.renderList();
    assert.equal(guides.axis, null);
    assert.equal(guides.overlay.getAttribute('hidden'), '');
    guides.axis = 'co2';
    guides.overlay.removeAttribute('hidden');
    panel.peek.settle(null);
    assert.equal(guides.axis, null);
    assert.equal(guides.overlay.getAttribute('hidden'), '');
  });
});

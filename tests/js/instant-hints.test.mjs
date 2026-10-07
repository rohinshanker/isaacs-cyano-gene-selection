import assert from 'node:assert/strict';
import test from 'node:test';
import { FakeElement, fakeDocument } from './fake-dom.mjs';
import { hintPosition, installInstantHints } from '../../site/js/ui/instant-hints.js';

class FakeObserver {
  static instance = null;

  constructor(callback) {
    this.callback = callback;
    FakeObserver.instance = this;
  }

  observe(target, options) {
    this.target = target;
    this.options = options;
  }

  disconnect() { this.disconnected = true; }

  send(...mutations) { this.callback(mutations); }
}

function eventTarget(target) {
  const listeners = new Map();
  target.addEventListener = (type, listener) => {
    if (!listeners.has(type)) listeners.set(type, []);
    listeners.get(type).push(listener);
  };
  target.removeEventListener = (type, listener) => {
    listeners.set(type, (listeners.get(type) ?? []).filter((entry) => entry !== listener));
  };
  target.emit = (type, event = {}) => {
    for (const listener of listeners.get(type) ?? []) listener({ type, ...event });
  };
  return target;
}

function box(element, { left = 20, top = 20, width = 100, height = 30 } = {}) {
  element.getBoundingClientRect = () => ({ left, top, right: left + width,
    bottom: top + height, width, height });
  element.getClientRects = () => element.hidden ? [] : [element.getBoundingClientRect()];
  return element;
}

function fixture() {
  const page = eventTarget(fakeDocument());
  globalThis.document = page;
  const originalCreate = page.createElement;
  page.createElement = (tag) => box(originalCreate(tag));
  page.body = box(page.body, { width: 600, height: 400 });
  const view = eventTarget({ innerWidth: 600, innerHeight: 400 });
  FakeObserver.instance = null;
  return { page, view };
}

function titleMutation(target) {
  return { type: 'attributes', attributeName: 'title', target };
}

test('pointer positioning prefers the opposite side at viewport edges and clamps long hints', () => {
  assert.deepEqual(hintPosition({ clientX: 100, clientY: 80 }, { width: 120, height: 40 },
    { width: 500, height: 300 }), { left: 112, top: 92 });
  assert.deepEqual(hintPosition({ clientX: 495, clientY: 295 }, { width: 180, height: 90 },
    { width: 500, height: 300 }), { left: 303, top: 193 });
  assert.deepEqual(hintPosition({ clientX: 2, clientY: 2 }, { width: 900, height: 600 },
    { width: 500, height: 300 }), { left: 8, top: 8 });
});

test('static HTML and SVG titles become exact instant hints without native duplicates', () => {
  const { page, view } = fixture();
  const button = box(new FakeElement('button'));
  button.setAttribute('title', 'Exact punctuation: 12.50 µmol photons m⁻² s⁻¹.');
  button.setAttribute('aria-describedby', 'existing-note');
  const svg = box(new FakeElement('svg', 'http://www.w3.org/2000/svg'));
  svg.setAttribute('aria-label', '0–250 µmol photons m⁻² s⁻¹. As reported: 250');
  const title = new FakeElement('title', 'http://www.w3.org/2000/svg');
  title.textContent = svg.getAttribute('aria-label');
  svg.append(title);
  page.body.append(button, svg);

  const hints = installInstantHints(page, view, FakeObserver);
  assert.equal(button.getAttribute('title'), null);
  assert.equal(svg.querySelector('title'), null);
  assert.match(button.getAttribute('aria-describedby'), /^existing-note instant-hint-description-/);
  assert.equal(svg.getAttribute('aria-describedby'), null, 'an identical aria-label is not repeated');

  page.emit('pointerover', { target: button, relatedTarget: null, clientX: 30, clientY: 40,
    pointerType: 'mouse' });
  assert.equal(hints.tooltip.hidden, false);
  assert.equal(hints.tooltip.textContent, 'Exact punctuation: 12.50 µmol photons m⁻² s⁻¹.');
  assert.equal(hints.tooltip.style.left, '42px');
  hints.destroy();
  assert.equal(FakeObserver.instance.disconnected, true);
});

test('movement follows immediately, click suppresses until exit, and underlying clicks are untouched', () => {
  const { page, view } = fixture();
  const trigger = box(new FakeElement('button'));
  trigger.setAttribute('title', 'Move me');
  page.body.append(trigger);
  const hints = installInstantHints(page, view, FakeObserver);

  page.emit('pointerover', { target: trigger, relatedTarget: null, clientX: 10, clientY: 20,
    pointerType: 'mouse' });
  page.emit('pointermove', { target: trigger, clientX: 80, clientY: 90, pointerType: 'mouse' });
  assert.equal(hints.tooltip.style.left, '92px');
  assert.equal(hints.tooltip.style.top, '102px');

  let prevented = false;
  const click = { target: trigger, preventDefault() { prevented = true; } };
  page.emit('click', click);
  assert.equal(hints.tooltip.hidden, true);
  assert.equal(prevented, false);
  page.emit('pointermove', { target: trigger, clientX: 120, clientY: 130, pointerType: 'mouse' });
  page.emit('click', click);
  assert.equal(hints.tooltip.hidden, true, 'movement, waiting, and another click do not restore it');

  page.emit('pointerout', { target: trigger, relatedTarget: null });
  page.emit('pointerover', { target: trigger, relatedTarget: null, clientX: 20, clientY: 30,
    pointerType: 'mouse' });
  assert.equal(hints.tooltip.hidden, false, 'exit and re-entry starts a new visit');
});

test('switching triggers, keyboard focus, touch, scroll, and navigation share cleanup behavior', () => {
  const { page, view } = fixture();
  const first = box(new FakeElement('button'), { left: 40, top: 50 });
  const second = box(new FakeElement('button'), { left: 180, top: 60 });
  first.setAttribute('title', 'First');
  second.setAttribute('title', 'Second');
  page.body.append(first, second);
  const hints = installInstantHints(page, view, FakeObserver);

  page.emit('pointerover', { target: first, relatedTarget: null, clientX: 50, clientY: 60 });
  page.emit('pointerover', { target: second, relatedTarget: first, clientX: 200, clientY: 70 });
  assert.equal(hints.tooltip.textContent, 'Second');
  page.emit('focusin', { target: first });
  assert.equal(hints.tooltip.textContent, 'First');
  page.emit('focusout', { target: first, relatedTarget: second });
  assert.equal(hints.tooltip.hidden, true);

  page.emit('pointerdown', { target: second, pointerType: 'touch', clientX: 210, clientY: 80 });
  assert.equal(hints.tooltip.hidden, false, 'touch exposes the same text before activation');
  page.emit('scroll');
  assert.equal(hints.tooltip.hidden, true);
  page.emit('focusin', { target: second });
  view.emit('scroll');
  assert.equal(hints.tooltip.hidden, true);
  page.emit('focusin', { target: second });
  view.emit('hashchange');
  assert.equal(hints.tooltip.hidden, true);
});

test('dynamic titles update exactly, clear their own description only, and removed popups leave no hint', () => {
  const { page, view } = fixture();
  const popup = box(new FakeElement('div'));
  const trigger = box(new FakeElement('span'));
  trigger.setAttribute('aria-describedby', 'kept');
  popup.append(trigger);
  page.body.append(popup);
  const hints = installInstantHints(page, view, FakeObserver);

  trigger.setAttribute('title', 'Dynamic\nvalue: 0.0070');
  FakeObserver.instance.send(titleMutation(trigger));
  assert.equal(trigger.getAttribute('title'), null);
  page.emit('pointerover', { target: trigger, relatedTarget: null, clientX: 25, clientY: 25 });
  assert.equal(hints.tooltip.textContent, 'Dynamic\nvalue: 0.0070');

  trigger.setAttribute('title', 'Changed exactly — no suffix');
  FakeObserver.instance.send(titleMutation(trigger));
  assert.equal(hints.tooltip.textContent, 'Changed exactly — no suffix');
  trigger.setAttribute('title', '');
  FakeObserver.instance.send(titleMutation(trigger));
  assert.equal(trigger.getAttribute('aria-describedby'), 'kept');
  assert.equal(hints.tooltip.hidden, true);

  trigger.setAttribute('title', 'Back');
  FakeObserver.instance.send(titleMutation(trigger));
  page.emit('pointerover', { target: trigger, relatedTarget: null, clientX: 25, clientY: 25 });
  popup.remove();
  FakeObserver.instance.send({ type: 'childList', target: page.body, addedNodes: [],
    removedNodes: [popup] });
  assert.equal(hints.tooltip.hidden, true);
  assert.equal(hints.records.size, 0);
});

test('an SVG title added after render is converted and hidden ancestors dismiss active hints', () => {
  const { page, view } = fixture();
  const popup = box(new FakeElement('div'));
  const svg = box(new FakeElement('svg', 'http://www.w3.org/2000/svg'));
  popup.append(svg);
  page.body.append(popup);
  const hints = installInstantHints(page, view, FakeObserver);
  const title = new FakeElement('title', 'http://www.w3.org/2000/svg');
  title.textContent = 'Late SVG value';
  svg.append(title);
  FakeObserver.instance.send({ type: 'childList', target: svg, addedNodes: [title],
    removedNodes: [] });
  assert.equal(svg.querySelector('title'), null);
  page.emit('pointerover', { target: svg, relatedTarget: null, clientX: 40, clientY: 40 });
  assert.equal(hints.tooltip.textContent, 'Late SVG value');
  svg.hidden = true;
  FakeObserver.instance.send({ type: 'attributes', attributeName: 'hidden', target: svg });
  assert.equal(hints.tooltip.hidden, true);
});

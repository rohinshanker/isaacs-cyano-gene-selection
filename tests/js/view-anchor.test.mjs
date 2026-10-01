import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RELEASE_EVENTS, holdInPlace } from '../../site/js/ui/view-anchor.js';

/**
 * A window whose scroll moves the anchor, as a real page does: scrolling down by
 * `n` moves every element up by `n`.
 */
function scene({ anchorTop }) {
  const state = { scrollY: 0, layoutTop: anchorTop, scrolls: [], listeners: new Map() };
  const anchor = { getBoundingClientRect: () => ({ top: state.layoutTop - state.scrollY }) };
  const view = {
    scrollBy: (options) => {
      state.scrolls.push(options);
      state.scrollY += options.top;
    },
    addEventListener: (type, listener, options) => state.listeners.set(type, { listener, options }),
    removeEventListener: (type) => state.listeners.delete(type),
  };
  const frames = [];
  let clock = 0;
  return {
    state, anchor, view, frames,
    options: (durationMs) => ({
      durationMs, view, now: () => clock, requestFrame: (callback) => frames.push(callback),
    }),
    tick: (ms) => {
      clock += ms;
      const callback = frames.shift();
      if (callback) callback();
    },
  };
}

test('the map is brought back to where the grid stood, at once', () => {
  // The grid stood at 167 px; the map landed at 747 px.
  const { state, anchor, view, options } = scene({ anchorTop: 747 });
  holdInPlace(anchor, 167, options(0));
  assert.deepEqual(state.scrolls, [{ top: 580, behavior: 'instant' }]);
  assert.equal(anchor.getBoundingClientRect().top, 167);
  // A single correction: no listeners, no frames, which is what reduced motion gets.
  assert.equal(state.listeners.size, 0);
  // Already in place means nothing to do.
  const still = scene({ anchorTop: 167.4 });
  holdInPlace(still.anchor, 167, still.options(0));
  assert.deepEqual(still.state.scrolls, []);
  // With no options at all it corrects once against the real window's shape.
  const bare = scene({ anchorTop: 300 });
  const previous = globalThis.window;
  globalThis.window = bare.view;
  try {
    holdInPlace(bare.anchor, 100);
  } finally {
    globalThis.window = previous;
  }
  assert.equal(bare.state.scrollY, 200);
  assert.ok(view);
});

test('it keeps correcting while the text above is still changing height', () => {
  const { state, anchor, frames, options, tick } = scene({ anchorTop: 549 });
  holdInPlace(anchor, 167, options(1000));
  assert.equal(anchor.getBoundingClientRect().top, 167);
  assert.deepEqual([...state.listeners.keys()].sort(), [...RELEASE_EVENTS].sort());
  assert.ok([...state.listeners.values()].every((entry) => entry.options.passive === true));
  // The tab row wraps onto another line as its labels type in: the map sinks.
  state.layoutTop += 36;
  tick(300);
  assert.equal(anchor.getBoundingClientRect().top, 167, 'the sink is taken back out');
  state.layoutTop += 162;
  tick(300);
  assert.equal(anchor.getBoundingClientRect().top, 167);
  assert.equal(state.scrollY, 549 - 167 + 36 + 162);
  // The hold ends when its time is up, and takes its listeners with it.
  tick(500);
  assert.equal(frames.length, 0, 'no frame is requested after the hold ends');
  assert.equal(state.listeners.size, 0);
  state.layoutTop += 50;
  assert.equal(anchor.getBoundingClientRect().top, 217, 'later movement is the page\'s own');
});

test('the visitor scrolling ends the hold at once', () => {
  for (const type of RELEASE_EVENTS) {
    const { state, anchor, frames, options, tick } = scene({ anchorTop: 549 });
    const release = holdInPlace(anchor, 167, options(1000));
    state.listeners.get(type).listener();
    assert.equal(state.listeners.size, 0, `${type} removes every listener`);
    state.layoutTop += 100;
    tick(100);
    assert.equal(anchor.getBoundingClientRect().top, 267, `${type}: the page is theirs`);
    assert.equal(frames.length, 0);
    release();
    release();
  }
});

test('the default frame function is called the way a browser allows', () => {
  const previous = { raf: globalThis.requestAnimationFrame, performance: globalThis.performance };
  const queued = [];
  globalThis.requestAnimationFrame = function browserOnly(callback) {
    if (this !== undefined && this !== globalThis) throw new TypeError('Illegal invocation');
    queued.push(callback);
    return 1;
  };
  let clock = 0;
  Object.defineProperty(globalThis, 'performance', { value: { now: () => clock }, configurable: true });
  try {
    const { anchor, view, state } = scene({ anchorTop: 400 });
    const release = holdInPlace(anchor, 100, { durationMs: 50, view });
    assert.equal(queued.length, 1);
    clock = 60;
    queued.shift()();
    assert.equal(queued.length, 0);
    assert.equal(state.listeners.size, 0);
    release();
  } finally {
    globalThis.requestAnimationFrame = previous.raf;
    Object.defineProperty(globalThis, 'performance', { value: previous.performance, configurable: true });
  }
});

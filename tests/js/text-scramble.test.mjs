import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SCRAMBLE_LETTERS, TextScramble, collectScrambleNodes, flipInterval, scrambleProgress,
} from '../../site/js/ui/text-scramble.js';
import { LOAD_TIMING } from '../../site/js/ui/load-timing.js';
import { FakeNode, withFakeDocument } from './fake-dom.mjs';

/**
 * A letter every ten milliseconds, four letters of lag, and flip waits of 10 ms
 * and 50 ms, so every front position and every flip falls on a round number.
 */
const TIMING = {
  lagLetters: 4, lettersPerSecond: 100, maxDurationMs: 10000, flipFastMs: 10, flipSlowMs: 50,
};

/** The same, a letter every millisecond, for the tests that only watch the fronts. */
const FAST = { ...TIMING, lettersPerSecond: 1000 };

/**
 * A frame queue and a clock the test moves by hand, in place of
 * `requestAnimationFrame` and `performance.now`.
 */
function frameClock() {
  let time = 0;
  let next = 1;
  const pending = new Map();
  const cancelled = [];
  let requested = 0;
  return {
    now: () => time,
    requestFrame(callback) {
      requested += 1;
      const id = next;
      next += 1;
      pending.set(id, callback);
      return id;
    },
    cancelFrame(id) { cancelled.push(id); pending.delete(id); },
    /** Move time on and run the frame that was waiting for it. */
    advance(ms) {
      time += ms;
      for (const [, callback] of [...pending]) {
        pending.clear();
        callback();
      }
    },
    get requested() { return requested; },
    get cancelled() { return cancelled; },
    get waiting() { return pending.size; },
  };
}

/** Draws that cycle A, T, G, C, so each flip is predictable and visible. */
function cyclingRandom() {
  const draws = [0, 0.3, 0.6, 0.9];
  let at = 0;
  return () => {
    const value = draws[at % draws.length];
    at += 1;
    return value;
  };
}

/** What a node should show when every draw is the first letter, A. */
function allA(original, front, resolved) {
  let shown = original.slice(0, resolved);
  for (let index = resolved; index < front; index += 1) {
    shown += /\s/.test(original[index]) ? original[index] : 'A';
  }
  return shown;
}

/** A paragraph of `text` under the body, and its one text node. */
function mount(document, text, { tag = 'p' } = {}) {
  const root = document.createElement('div');
  const block = document.createElement(tag);
  block.append(document.createTextNode(text));
  root.append(block);
  document.body.append(root);
  return { root, block, node: block.children[0] };
}

/** Count what is written to a text node, which is the per-frame budget. */
function countWrites(node) {
  const base = Object.getOwnPropertyDescriptor(FakeNode.prototype, 'data');
  let writes = 0;
  Object.defineProperty(node, 'data', {
    configurable: true,
    get: () => base.get.call(node),
    set: (value) => { writes += 1; base.set.call(node, value); },
  });
  return () => writes;
}

test('the fronts advance a letter at a time, the resolve front trailing by the lag', () => {
  // A letter a millisecond, so elapsed milliseconds are letters travelled.
  const length = 10;
  const at = (ms) => scrambleProgress(length, ms, FAST);
  assert.deepEqual(at(0), { front: 0, resolved: 0, done: false });
  assert.deepEqual(at(1), { front: 1, resolved: 0, done: false });
  assert.deepEqual(at(4), { front: 4, resolved: 0, done: false });
  // Five letters typed, the first one resolved: the lag is four.
  assert.deepEqual(at(5), { front: 5, resolved: 1, done: false });
  assert.deepEqual(at(10), { front: 10, resolved: 6, done: false });
  // The typing front has reached the end; the resolve front keeps the same speed.
  assert.deepEqual(at(12), { front: 10, resolved: 8, done: false });
  assert.deepEqual(at(14), { front: 10, resolved: 10, done: true });
  // And it stays done, however long the caller keeps asking.
  assert.deepEqual(at(10000), { front: 10, resolved: 10, done: true });
  // Time never runs backwards, but a negative elapsed must not run the text back.
  assert.deepEqual(at(-50), { front: 0, resolved: 0, done: false });
});

test('a text too long for the maximum duration speeds up to fit inside it', () => {
  const timing = LOAD_TIMING.scramble;
  const length = 1000;
  // At 110 letters a second this text plus its lag would take over nine seconds.
  assert.ok((length + timing.lagLetters) / timing.lettersPerSecond * 1000 > timing.maxDurationMs);
  assert.equal(scrambleProgress(length, timing.maxDurationMs, timing).done, true,
    'the whole animation, typing and trailing lag, is over by the maximum');
  assert.equal(scrambleProgress(length, timing.maxDurationMs - 1, timing).done, false,
    'and not before it');
  // Halfway through the time is halfway through the distance, lag included.
  const half = scrambleProgress(length, timing.maxDurationMs / 2, timing);
  assert.equal(half.front, Math.floor((length + timing.lagLetters) / 2));
  assert.equal(half.front - half.resolved, timing.lagLetters);

  // A short text keeps the stated speed rather than being stretched to the maximum.
  const short = scrambleProgress(20, 1000, timing);
  assert.deepEqual(short, { front: 20, resolved: 20, done: true });
});

test('a length or a duration of zero resolves at once instead of dividing by zero', () => {
  for (const timing of [TIMING, { ...TIMING, maxDurationMs: 0 }, { ...TIMING, lagLetters: 0 }]) {
    for (const elapsed of [0, 10]) {
      const progress = scrambleProgress(0, elapsed, timing);
      assert.deepEqual(progress, { front: 0, resolved: 0, done: true }, JSON.stringify(timing));
    }
  }
  // A real text with the duration tuned to nothing is simply already finished.
  assert.deepEqual(scrambleProgress(6, 0, { ...TIMING, maxDurationMs: 0 }),
    { front: 6, resolved: 6, done: true });
  // Letters per second of zero leaves the maximum duration as the only speed.
  const stalled = { ...TIMING, lettersPerSecond: 0, maxDurationMs: 5000 };
  assert.deepEqual(scrambleProgress(10, 5000, stalled), { front: 10, resolved: 10, done: true });
  // Halfway through that duration is halfway through the ten letters and the lag.
  assert.deepEqual(scrambleProgress(10, 2500, stalled), { front: 7, resolved: 3, done: false });
});

test('a letter flips fast when just typed and slows as its resolution approaches', () => {
  assert.equal(flipInterval(TIMING.lagLetters, TIMING), TIMING.flipFastMs);
  assert.equal(flipInterval(TIMING.lagLetters + 5, TIMING), TIMING.flipFastMs,
    'a letter ahead of the lag is no faster than just-typed');
  assert.equal(flipInterval(0, TIMING), TIMING.flipSlowMs);
  assert.equal(flipInterval(-2, TIMING), TIMING.flipSlowMs, 'and no slower than that');
  assert.equal(flipInterval(2, TIMING), 30, 'halfway along the lag is halfway between the waits');
  let previous = TIMING.flipFastMs - 1;
  for (let remaining = TIMING.lagLetters; remaining >= 0; remaining -= 1) {
    const wait = flipInterval(remaining, TIMING);
    assert.ok(wait > previous, `the wait grows as the front closes: ${remaining}`);
    previous = wait;
  }
  // With no lag a letter resolves as soon as it is typed, so it never slows.
  assert.equal(flipInterval(0, { ...TIMING, lagLetters: 0 }), TIMING.flipFastMs);
});

test('the nodes collected are the visible prose, in document order', async () => {
  await withFakeDocument((document) => {
    const root = document.createElement('div');
    root.append(document.createTextNode('first'));
    const inner = document.createElement('p');
    inner.append(document.createTextNode('second'), document.createElement('br'));
    const deep = document.createElement('strong');
    deep.append(document.createTextNode('third'));
    inner.append(deep);
    root.append(inner, document.createTextNode('\n  '));
    assert.deepEqual(collectScrambleNodes(root).map((node) => node.data),
      ['first', 'second', 'third'], 'whitespace between tags has nothing to reveal');
  });
});

test('collection passes over scripts, hidden elements and anything opted out', async () => {
  await withFakeDocument((document) => {
    const root = document.createElement('div');
    const add = (tag, text, prepare = () => {}) => {
      const element = document.createElement(tag);
      element.append(document.createTextNode(text));
      prepare(element);
      root.append(element);
      return element;
    };
    for (const tag of ['script', 'style', 'noscript', 'textarea', 'option', 'title', 'svg', 'canvas']) {
      add(tag, `inside ${tag}`);
    }
    add('p', 'attribute hidden', (element) => element.setAttribute('hidden', ''));
    add('p', 'property hidden', (element) => { element.hidden = true; });
    add('p', 'screen reader only', (element) => element.classList.add('visually-hidden'));
    add('p', 'opted out by attribute', (element) => element.setAttribute('data-no-scramble', ''));
    add('p', 'opted out by dataset', (element) => { element.dataset.noScramble = ''; });
    const nested = add('div', '', (element) => element.setAttribute('data-no-scramble', ''));
    const child = document.createElement('span');
    child.append(document.createTextNode('inside an opted-out container'));
    nested.append(child);
    add('p', 'the only prose');

    assert.deepEqual(collectScrambleNodes(root).map((node) => node.data), ['the only prose']);
    // A root is the caller's choice and is never tested itself.
    const hiddenRoot = document.createElement('div');
    hiddenRoot.setAttribute('hidden', '');
    hiddenRoot.append(document.createTextNode('still animated'));
    assert.deepEqual(collectScrambleNodes(hiddenRoot).map((node) => node.data), ['still animated']);
    // A node with no children at all is simply empty.
    assert.deepEqual(collectScrambleNodes(document.createElement('div')), []);
  });
});

test('the text grows left to right out of base letters and settles into itself', async () => {
  await withFakeDocument(async (document) => {
    const text = 'Gene map';
    const { root, node } = mount(document, text);
    const clock = frameClock();
    const scramble = new TextScramble({ timing: FAST, random: () => 0, ...clock });
    const run = scramble.run([root]);

    assert.equal(scramble.active, true);
    assert.equal(node.data, '', 'the real text is never shown for even one frame');
    const seen = [''];
    for (let step = 0; step < 12; step += 1) {
      clock.advance(1);
      const { front, resolved } = scrambleProgress(text.length, step + 1, FAST);
      assert.equal(node.data.length, front, 'exactly the typed letters are visible');
      assert.equal(node.data.slice(0, resolved), text.slice(0, resolved),
        'and the resolved ones are the real characters');
      for (const letter of node.data.slice(resolved)) {
        assert.ok(SCRAMBLE_LETTERS.includes(letter) || /\s/.test(letter),
          `an unresolved position shows a base letter: ${JSON.stringify(node.data)}`);
      }
      assert.equal(node.data, allA(text, front, resolved));
      seen.push(node.data);
    }
    await run;
    assert.deepEqual(seen, [
      '', 'A', 'AA', 'AAA', 'AAAA', 'GAAA ', 'GeAA A', 'GenA AA',
      'Gene AAA', 'Gene AAA', 'Gene mAA', 'Gene maA', 'Gene map',
    ], 'the space holds its place from the moment the front passes it');
    assert.equal(node.data, text);
    assert.equal(scramble.active, false);
  });
});

test('a flipping letter holds still between flips and waits longer as it nears resolving', async () => {
  await withFakeDocument(async (document) => {
    const { root, node } = mount(document, 'abcdefghij');
    const clock = frameClock();
    const scramble = new TextScramble({ timing: TIMING, random: cyclingRandom(), ...clock });
    const run = scramble.run([root]);

    // A letter every ten milliseconds; the first is drawn as A with a 20 ms wait,
    // because the resolve front is three letters of travel away from it.
    clock.advance(10);
    assert.equal(node.data, 'A');
    clock.advance(10);
    assert.equal(node.data, 'AT', 'the first letter holds while the second is typed');
    clock.advance(10);
    assert.equal(node.data, 'GTC', 'at twenty-one milliseconds old the first letter flips');
    // Its wait has now grown to forty milliseconds, one letter of travel from
    // resolving, so it holds through the next frame rather than flipping again.
    clock.advance(10);
    assert.equal(node.data[0], 'G');
    clock.advance(10);
    assert.equal(node.data[0], 'a', 'and then it settles into the real character');

    scramble.cancel();
    await run;
    assert.equal(node.data, 'abcdefghij');
  });
});

test('one frame loop drives every node, writing a node at most once a frame', async () => {
  await withFakeDocument(async (document) => {
    const frames = [];
    for (const count of [1, 6]) {
      const clock = frameClock();
      const root = document.createElement('div');
      for (let index = 0; index < count; index += 1) {
        const block = document.createElement('p');
        block.append(document.createTextNode('Gene map'));
        root.append(block);
      }
      document.body.append(root);
      const nodes = collectScrambleNodes(root);
      assert.equal(nodes.length, count);
      const writes = countWrites(nodes[0]);
      const scramble = new TextScramble({ timing: FAST, random: () => 0, ...clock });
      const run = scramble.run(root);
      while (scramble.active) clock.advance(1);
      await run;
      assert.equal(clock.waiting, 0, 'no frame is left pending');
      // Thirteen frames cover the text, and twelve of them changed its visible
      // string: the frame where the resolving space replaced a flipping space
      // left the node alone.
      assert.equal(writes(), 12);
      frames.push(clock.requested);
    }
    assert.equal(frames[0], frames[1], 'six nodes cost the same frames as one');
  });
});

test('a frame that changes nothing writes nothing', async () => {
  await withFakeDocument(async (document) => {
    const { root, node } = mount(document, 'Gene map');
    const clock = frameClock();
    const scramble = new TextScramble({ timing: TIMING, random: () => 0, ...clock });
    const run = scramble.run(root);
    const writes = countWrites(node);
    clock.advance(10);
    assert.equal(writes(), 1);
    // Still the same letter, the same front, and nothing due to flip.
    clock.advance(1);
    assert.equal(writes(), 1, 'the node is left alone between changes');
    scramble.cancel();
    await run;
  });
});

test('while running a root is busy and hidden, and gets back exactly what it had', async () => {
  await withFakeDocument(async (document) => {
    const { root } = mount(document, 'Gene map');
    const other = document.createElement('section');
    other.setAttribute('aria-hidden', 'true');
    other.append(document.createTextNode('Lengths'));
    document.body.append(other);

    const clock = frameClock();
    const scramble = new TextScramble({ timing: FAST, random: () => 0, ...clock });
    const run = scramble.run([root, other]);
    for (const element of [root, other]) {
      assert.equal(element.getAttribute('aria-busy'), 'true');
      assert.equal(element.getAttribute('aria-hidden'), 'true');
    }
    while (scramble.active) clock.advance(1);
    await run;
    assert.equal(root.getAttribute('aria-busy'), null);
    assert.equal(root.getAttribute('aria-hidden'), null, 'an attribute it never had is removed');
    assert.equal(other.getAttribute('aria-busy'), null);
    assert.equal(other.getAttribute('aria-hidden'), 'true', 'one it already had is left as it was');
    other.remove();
  });
});

test('cancelling mid-flight restores every text at once, and cancelling again does nothing', async () => {
  await withFakeDocument(async (document) => {
    const { root, node } = mount(document, 'Gene map');
    const second = document.createElement('p');
    second.append(document.createTextNode('Lengths'));
    root.append(second);
    const clock = frameClock();
    const scramble = new TextScramble({ timing: FAST, random: () => 0, ...clock });
    const run = scramble.run(root);
    clock.advance(3);
    assert.equal(node.data, 'AAA');

    scramble.cancel();
    assert.equal(node.data, 'Gene map');
    assert.equal(second.children[0].data, 'Lengths');
    assert.equal(root.getAttribute('aria-busy'), null);
    assert.equal(scramble.active, false);
    assert.deepEqual(clock.cancelled, [clock.requested], 'the pending frame was cancelled');
    await run;

    const writes = countWrites(node);
    scramble.cancel();
    assert.equal(writes(), 0, 'a second cancel has nothing to undo');
    assert.deepEqual(clock.cancelled, [clock.requested]);
  });
});

test('a node taken out of the document is restored once and then left alone', async () => {
  await withFakeDocument(async (document) => {
    const { root, block, node } = mount(document, 'Gene map');
    const kept = document.createElement('p');
    kept.append(document.createTextNode('Lengths'));
    root.append(kept);
    const clock = frameClock();
    const scramble = new TextScramble({ timing: FAST, random: () => 0, ...clock });
    const run = scramble.run(root);
    clock.advance(3);
    assert.equal(node.data, 'AAA');

    // The app re-renders the panel while the scramble is running.
    block.remove();
    clock.advance(1);
    assert.equal(node.data, 'Gene map', 'no stray base letter is left behind');
    const writes = countWrites(node);
    while (scramble.active) clock.advance(1);
    await run;
    assert.equal(writes(), 0, 'the dropped node is never written to again');
    assert.equal(kept.children[0].data, 'Lengths', 'the nodes still in the document finish');
  });
});

test('a node someone else rewrote is dropped rather than overwritten', async () => {
  await withFakeDocument(async (document) => {
    const { root, node } = mount(document, 'Gene map');
    const clock = frameClock();
    const scramble = new TextScramble({ timing: FAST, random: () => 0, ...clock });
    const run = scramble.run(root);
    clock.advance(3);

    node.data = 'Gene map, 2,789 genes';
    clock.advance(1);
    assert.equal(node.data, 'Gene map, 2,789 genes');
    while (scramble.active) clock.advance(1);
    await run;
    assert.equal(node.data, 'Gene map, 2,789 genes', 'the stale original is never put back');
  });
});

test('with nothing to animate the run is over at once and no root is touched', async () => {
  await withFakeDocument(async (document) => {
    const root = document.createElement('div');
    root.append(document.createTextNode('\n  '), document.createElement('canvas'));
    document.body.append(root);
    const clock = frameClock();
    const scramble = new TextScramble({ timing: FAST, random: () => 0, ...clock });
    await scramble.run([root, null]);
    assert.equal(scramble.active, false);
    assert.equal(clock.requested, 0, 'not even one frame is asked for');
    assert.equal(root.getAttribute('aria-busy'), null);
    assert.equal(root.getAttribute('aria-hidden'), null);
  });
});

test('starting a run cancels the one already going', async () => {
  await withFakeDocument(async (document) => {
    const { root, node } = mount(document, 'Gene map');
    const second = mount(document, 'Lengths');
    const clock = frameClock();
    const scramble = new TextScramble({ timing: FAST, random: () => 0, ...clock });
    const first = scramble.run(root);
    clock.advance(3);
    assert.equal(node.data, 'AAA');

    const next = scramble.run(second.root);
    await first;
    assert.equal(node.data, 'Gene map', 'the abandoned run put its text back');
    assert.equal(root.getAttribute('aria-busy'), null);
    assert.equal(second.node.data, '');
    while (scramble.active) clock.advance(1);
    await next;
    assert.equal(second.node.data, 'Lengths');
    second.root.remove();
  });
});

test('left to itself the scramble uses the browser clock, frames and randomness', async () => {
  const saved = {
    requestAnimationFrame: globalThis.requestAnimationFrame,
    cancelAnimationFrame: globalThis.cancelAnimationFrame,
  };
  const pending = [];
  const cancelled = [];
  let nextFrame = 0;
  globalThis.requestAnimationFrame = (callback) => {
    nextFrame += 1;
    pending.push({ id: nextFrame, callback });
    return nextFrame;
  };
  globalThis.cancelAnimationFrame = (id) => cancelled.push(id);
  try {
    await withFakeDocument(async (document) => {
      // A duration of nothing is already over, so this run needs no frame at all.
      const instant = mount(document, 'Gene map');
      await new TextScramble({ timing: { ...FAST, maxDurationMs: 0 } }).run(instant.root);
      assert.equal(instant.node.data, 'Gene map');
      assert.equal(pending.length, 0);

      // A lag far wider than the front can reach keeps every visible letter
      // unresolved, so timer jitter cannot change what this expects.
      const text = 'Gene map and the lengths of every coding sequence. '.repeat(40);
      const { root, node } = mount(document, text);
      const scramble = new TextScramble({ timing: { ...FAST, lagLetters: 2000 } });
      const run = scramble.run(root);
      assert.equal(node.data, '');
      assert.equal(pending.length, 1, 'the frame came from the browser');

      await new Promise((resolve) => { setTimeout(resolve, 20); });
      pending.pop().callback();
      assert.ok(node.data.length > 0 && node.data.length < text.length,
        `the real clock moved the front along: ${JSON.stringify(node.data)}`);
      for (const letter of node.data) {
        assert.ok(SCRAMBLE_LETTERS.includes(letter) || /\s/.test(letter), 'drawn by Math.random');
      }

      scramble.cancel();
      assert.deepEqual(cancelled, [nextFrame], 'the browser cancelled the frame still pending');
      assert.equal(node.data, text);
      await run;
    });
  } finally {
    Object.assign(globalThis, saved);
  }
});

/**
 * A browser refuses to run `requestAnimationFrame` as a method of anything but
 * its own window ("Illegal invocation"). Passing the function itself as the
 * default and calling it as `this.requestFrame(...)` did exactly that: every
 * test injected its own frame queue, so only the real page found it, and the
 * run died after frame zero had already taken the text off the screen.
 */
test('the default frame functions are called the way a browser allows', async () => {
  const previous = {
    requestAnimationFrame: globalThis.requestAnimationFrame,
    cancelAnimationFrame: globalThis.cancelAnimationFrame,
    performance: globalThis.performance,
  };
  const queue = [];
  let clock = 0;
  const strict = (name, body) => function browserOnly(...args) {
    if (this !== undefined && this !== globalThis) throw new TypeError(`Illegal invocation of ${name}`);
    return body(...args);
  };
  globalThis.requestAnimationFrame = strict('requestAnimationFrame', (callback) => queue.push(callback));
  globalThis.cancelAnimationFrame = strict('cancelAnimationFrame', () => { queue.length = 0; });
  Object.defineProperty(globalThis, 'performance', { value: { now: () => clock }, configurable: true });
  try {
    await withFakeDocument(async (document) => {
      const root = document.createElement('p');
      root.append('Recoding');
      document.body.append(root);
      const timing = {
        lagLetters: 2, lettersPerSecond: 1000, maxDurationMs: 1000, flipFastMs: 1, flipSlowMs: 2,
      };
      const scramble = new TextScramble({ timing, random: () => 0 });
      const done = scramble.run(root);
      assert.equal(scramble.active, true, 'the run survived its first frame request');
      while (queue.length > 0) {
        clock += 5;
        queue.shift()();
      }
      await done;
      assert.equal(root.textContent, 'Recoding');
      // Cancelling goes through the default cancel function the same way.
      const again = scramble.run(root);
      scramble.cancel();
      await again;
      assert.equal(root.textContent, 'Recoding');
    });
  } finally {
    globalThis.requestAnimationFrame = previous.requestAnimationFrame;
    globalThis.cancelAnimationFrame = previous.cancelAnimationFrame;
    Object.defineProperty(globalThis, 'performance', { value: previous.performance, configurable: true });
  }
});

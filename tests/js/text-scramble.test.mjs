import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  SCRAMBLE_LETTERS, TextScramble, collectScrambleNodes, collectScrambleTargets,
  flipInterval, scrambleDuration, scrambleProgress,
} from '../../site/js/ui/text-scramble.js';
import { LOAD_TIMING } from '../../site/js/ui/load-timing.js';
import { FakeElement, FakeNode, withFakeDocument } from './fake-dom.mjs';

/**
 * A letter locks every ten milliseconds, the trail starts four letters ahead and
 * runs half again as fast, and the flip waits are 10 ms and 50 ms, so every flip
 * falls on a round number: the wait is 50 - 10 x remaining.
 */
const TIMING = {
  leadLetters: 4,
  lockLettersPerSecond: 100,
  trailRatio: 1.5,
  maxDurationMs: 10000,
  flipFastMs: 10,
  flipSlowMs: 50,
};

/**
 * The same, a letter locked every millisecond and a trail at twice that, for the
 * tests that watch the fronts rather than the flipping.
 */
const FAST = { ...TIMING, lockLettersPerSecond: 1000, trailRatio: 2 };

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

/** What a string should show when every draw is the first letter, A. */
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

/** The same budget for an element's text, which is how an option is written. */
function countTextWrites(element) {
  const base = Object.getOwnPropertyDescriptor(FakeElement.prototype, 'textContent');
  let writes = 0;
  Object.defineProperty(element, 'textContent', {
    configurable: true,
    get: () => base.get.call(element),
    set: (value) => { writes += 1; base.set.call(element, value); },
  });
  return () => writes;
}

/** And for an attribute, which is how a placeholder is written. */
function countAttributeWrites(element, name) {
  const base = element.setAttribute.bind(element);
  let writes = 0;
  element.setAttribute = (attribute, value) => {
    if (attribute === name) writes += 1;
    base(attribute, value);
  };
  return () => writes;
}

/** The three attributes an owner carries while its own text is flipping. */
function holdAttributes(element) {
  return ['aria-busy', 'aria-hidden', 'inert'].map((name) => element.getAttribute(name));
}

test('the trail starts ahead of the lock, leads it, and finishes first', () => {
  // A letter locked a millisecond, a trail at twice that, four letters of lead.
  const length = 10;
  const at = (ms) => scrambleProgress(length, ms, FAST);
  assert.deepEqual(at(0), { front: 4, resolved: 0, done: false },
    'the trail already shows the lead, and nothing is locked');
  assert.deepEqual(at(1), { front: 6, resolved: 1, done: false });
  assert.deepEqual(at(2), { front: 8, resolved: 2, done: false });
  // The trail is at the end with seven letters still to lock behind it.
  assert.deepEqual(at(3), { front: 10, resolved: 3, done: false });
  assert.deepEqual(at(9), { front: 10, resolved: 9, done: false });
  assert.deepEqual(at(10), { front: 10, resolved: 10, done: true });
  // And it stays done, however long the caller keeps asking.
  assert.deepEqual(at(10000), { front: 10, resolved: 10, done: true });
  // Time never runs backwards, but a negative elapsed must not run the text back.
  assert.deepEqual(at(-50), { front: 4, resolved: 0, done: false });
  // The trail leads by the lead letters plus the distance it has gained.
  for (let ms = 0; ms <= 10; ms += 1) {
    const { front, resolved } = at(ms);
    assert.ok(front >= resolved, `the trail is never behind the lock at ${ms}`);
    assert.equal(front, Math.min(length, 4 + 2 * ms));
  }
});

test('a text shorter than the lead is all flipping from the first frame', () => {
  const { front, resolved, done } = scrambleProgress(2, 0, FAST);
  assert.deepEqual({ front, resolved, done }, { front: 2, resolved: 0, done: false },
    'the trail cannot lead past the end of the text');
  assert.deepEqual(scrambleProgress(2, 1, FAST), { front: 2, resolved: 1, done: false });
  assert.deepEqual(scrambleProgress(2, 2, FAST), { front: 2, resolved: 2, done: true });
});

test('a trail ratio of less than one still never falls behind the lock', () => {
  for (const trailRatio of [0.5, 0, -1]) {
    const timing = { ...FAST, trailRatio };
    for (const ms of [0, 5, 20, 60]) {
      const { front, resolved } = scrambleProgress(100, ms, timing);
      assert.ok(front >= resolved, `ratio ${trailRatio} at ${ms}: ${front} < ${resolved}`);
    }
    // The lock is unaffected by the trail: it is what sets the pace.
    assert.equal(scrambleProgress(100, 40, timing).resolved, 40);
  }
});

test('a text too long for the maximum duration locks its last letter exactly then', () => {
  const timing = LOAD_TIMING.scramble;
  const length = 1000;
  // At fifty letters a second this text would take twenty seconds to lock.
  assert.ok((length / timing.lockLettersPerSecond) * 1000 > timing.maxDurationMs);
  assert.equal(scrambleProgress(length, timing.maxDurationMs, timing).done, true,
    'the lock front reaches the end at the maximum');
  assert.equal(scrambleProgress(length, timing.maxDurationMs - 1, timing).done, false,
    'and not before it');
  // Halfway through the time is halfway through the letters, with the trail
  // ahead by its lead plus the ground its extra speed has gained.
  const half = scrambleProgress(length, timing.maxDurationMs / 2, timing);
  assert.equal(half.resolved, length / 2);
  assert.equal(half.front, Math.floor(timing.leadLetters + timing.trailRatio * (length / 2)));

  // A short text keeps the stated speed rather than being stretched to the maximum.
  const naturalMs = (20 / timing.lockLettersPerSecond) * 1000;
  assert.deepEqual(scrambleProgress(20, naturalMs, timing), { front: 20, resolved: 20, done: true });
  assert.equal(scrambleProgress(20, naturalMs - 1, timing).done, false);
});

test('the default reveal keeps short text at 50 letters per second and caps longer text at 2.5 seconds', () => {
  for (const length of [1, 20, 124, 125, 126, 200, 1000]) {
    const duration = Math.min((length / 50) * 1000, 2500);
    assert.equal(scrambleProgress(length, duration - 1, LOAD_TIMING.scramble).done, false,
      `${length} characters are still locking just before their deadline`);
    assert.deepEqual(scrambleProgress(length, duration, LOAD_TIMING.scramble),
      { front: length, resolved: length, done: true },
      `${length} characters finish at their natural duration or the 2.5-second cap`);
  }
});

test('the balanced review curve hits every anchor, interpolates, and caps at one second', () => {
  const timing = {
    ...TIMING,
    durationAnchors: [[1, 250], [12, 350], [40, 600], [160, 1000]],
  };
  for (const [length, duration] of timing.durationAnchors) {
    assert.equal(scrambleDuration(length, timing), duration);
    assert.equal(scrambleProgress(length, duration - 1, timing).done, false);
    assert.equal(scrambleProgress(length, duration, timing).done, true);
  }
  assert.equal(scrambleDuration(26, timing), 475);
  assert.equal(scrambleDuration(1000, timing), 1000);
});

test('inline fragments share one coherent review deadline and late replacements do not restart it', async () => {
  await withFakeDocument(async (document) => {
    const clock = frameClock();
    const timing = {
      ...FAST,
      leadLetters: 0,
      durationAnchors: [[1, 250], [12, 350], [40, 600], [160, 1000]],
    };
    const root = document.createElement('div');
    const paragraph = document.createElement('p');
    const first = document.createTextNode('Alpha ');
    const strong = document.createElement('strong');
    const second = document.createTextNode('beta');
    strong.append(second);
    paragraph.append(first, strong);
    root.append(paragraph);
    document.body.append(root);
    const scramble = new TextScramble({
      timing, random: () => 0, now: clock.now,
      requestFrame: clock.requestFrame, cancelFrame: clock.cancelFrame,
    });
    const done = scramble.run(root);
    assert.equal(first.data, '', 'the coherent block starts at its first inline fragment');
    assert.equal(second.data, '', 'a later inline fragment waits for the shared front');
    clock.advance(100);
    assert.ok(first.data.length > 0);
    assert.equal(second.data, '', 'inline fragments do not animate as unrelated simultaneous strings');

    const replacement = document.createElement('p');
    replacement.append('Alpha ');
    const replacementStrong = document.createElement('strong');
    replacementStrong.append('beta');
    replacement.append(replacementStrong);
    root.replaceChildren(replacement);
    scramble.refresh(root);
    clock.advance(300);
    await done;
    assert.equal(replacement.textContent, 'Alpha beta', 'unchanged replacement inherits the first deadline');
    assert.equal(scramble.active, false);
  });
});

test('new landing content gets one local reveal after the page reveal has finished', async () => {
  await withFakeDocument(async (document) => {
    const clock = frameClock();
    const timing = {
      ...FAST,
      durationAnchors: [[1, 250], [12, 350], [40, 600], [160, 1000]],
    };
    const { root, node } = mount(document, 'Ready');
    const scramble = new TextScramble({
      timing, random: () => 0, now: clock.now,
      requestFrame: clock.requestFrame, cancelFrame: clock.cancelFrame,
    });
    const initial = scramble.run(root);
    clock.advance(400);
    await initial;
    assert.equal(scramble.active, false);

    node.data = 'New evidence ready';
    scramble.refresh(root);
    assert.equal(scramble.active, true, 'new content starts a bounded local run');
    assert.notEqual(node.data, 'New evidence ready');
    clock.advance(1000);
    assert.equal(node.data, 'New evidence ready');
    assert.equal(scramble.active, false);

    scramble.refresh(root);
    assert.equal(scramble.active, false, 'the same generation is not decorated twice');
  });
});

test('production landings cannot refresh the review-only scramble', async () => {
  const app = await readFile(new URL('../../site/js/app.js', import.meta.url), 'utf8');
  const flush = app.slice(app.indexOf('function flushLandings()'),
    app.indexOf('/** Ask again for one later file'));
  assert.match(flush, /if \(loadReview && revealed && !reducedMotion\) \{/,
    'without an explicit review selector, a late landing cannot make controls busy or inert');
});

test('run and refresh batch unique geometry reads before writes and reserve effective flow boxes', async () => {
  await withFakeDocument(async (document) => {
    const clock = frameClock();
    const timing = { ...FAST, durationAnchors: [[1, 250], [160, 1000]] };
    const events = [];
    const trackedStyle = (name, initial) => new Proxy(initial, {
      set(target, property, value) {
        if (property === 'minHeight' || property === 'minWidth') events.push(`write:${name}`);
        target[property] = value;
        return true;
      },
    });
    const rectangle = (name, width, height) => () => {
      events.push(`read:${name}`);
      return { width, height };
    };

    const root = document.createElement('main');
    root.style.display = 'block';
    const paragraph = document.createElement('p');
    paragraph.style = trackedStyle('paragraph', { display: 'block', minHeight: '2rem' });
    paragraph.getBoundingClientRect = rectangle('paragraph', 300, 42);
    paragraph.append('Evidence ');
    const link = document.createElement('a');
    link.style.display = 'inline';
    link.getBoundingClientRect = rectangle('link', 80, 18);
    link.append('details');
    paragraph.append(link);

    const table = document.createElement('table');
    table.style = trackedStyle('table', { display: 'table', minHeight: '3rem' });
    table.getBoundingClientRect = rectangle('table', 300, 56);
    const row = document.createElement('tr'); row.style.display = 'table-row';
    const cell = document.createElement('th'); cell.style.display = 'table-cell';
    cell.getBoundingClientRect = rectangle('cell', 120, 28);
    cell.append('Metric'); row.append(cell); table.append(row);
    root.append(paragraph, table); document.body.append(root);

    const scramble = new TextScramble({ timing, now: clock.now,
      requestFrame: clock.requestFrame, cancelFrame: clock.cancelFrame });
    scramble.run(root);
    assert.deepEqual(events, [
      'read:paragraph', 'read:table', 'write:paragraph', 'write:table',
    ], 'duplicate and ineffective groups resolve before one read phase and one write phase');
    assert.equal(link.style.minHeight, undefined, 'display:inline does not receive an ineffective minimum');
    assert.equal(cell.style.minHeight, undefined, 'table-* boxes do not receive ineffective minimums');
    assert.equal(paragraph.style.minHeight, '42px');
    assert.equal(table.style.minHeight, '56px');
    scramble.cancel();
    assert.equal(paragraph.style.minHeight, '2rem');
    assert.equal(table.style.minHeight, '3rem');

    paragraph.children[0].data = 'New evidence ';
    cell.children[0].data = 'Updated metric';
    events.length = 0;
    scramble.refresh(root);
    assert.deepEqual(events, [
      'read:paragraph', 'read:table', 'write:paragraph', 'write:table',
    ], 'a landing refresh uses the same batched reservation pass');
    scramble.cancel();
    assert.equal(paragraph.style.minHeight, '2rem');
    assert.equal(table.style.minHeight, '3rem');
  });
});

test('review geometry reservations adapt to the container and restore existing styles', async () => {
  await withFakeDocument(async (document) => {
    const clock = frameClock();
    const timing = { ...FAST, durationAnchors: [[1, 250], [160, 1000]] };
    const { root, block } = mount(document, 'Long control label', { tag: 'button' });
    block.style = { minWidth: '2rem' };
    block.getBoundingClientRect = () => ({ width: 301, height: 30 });
    const paragraph = document.createElement('p'); paragraph.append('Long paragraph');
    paragraph.style = { minHeight: '1rem' };
    paragraph.getBoundingClientRect = () => ({ width: 301, height: 55 });
    root.append(paragraph);
    const scramble = new TextScramble({ timing, now: clock.now,
      requestFrame: clock.requestFrame, cancelFrame: clock.cancelFrame });
    const done = scramble.run(root);
    assert.equal(block.style.minWidth, 'min(301px, 100%)');
    assert.equal(paragraph.style.minHeight, '55px');
    clock.advance(1000); await done;
    assert.equal(block.style.minWidth, '2rem');
    assert.equal(paragraph.style.minHeight, '1rem');
    scramble.run(root); scramble.cancel();
    assert.equal(block.style.minWidth, '2rem', 'cancellation also restores the reservation');
  });
});

test('a length or a duration of zero resolves at once instead of dividing by zero', () => {
  const edges = [
    TIMING,
    { ...TIMING, maxDurationMs: 0 },
    { ...TIMING, leadLetters: 0 },
    { ...TIMING, lockLettersPerSecond: 0 },
    { ...TIMING, lockLettersPerSecond: 0, maxDurationMs: 0 },
    { ...TIMING, trailRatio: 0 },
  ];
  for (const timing of edges) {
    for (const elapsed of [0, 10]) {
      const progress = scrambleProgress(0, elapsed, timing);
      assert.deepEqual(progress, { front: 0, resolved: 0, done: true }, JSON.stringify(timing));
    }
  }
  // A real text with the duration tuned to nothing is simply already finished.
  assert.deepEqual(scrambleProgress(6, 0, { ...TIMING, maxDurationMs: 0 }),
    { front: 6, resolved: 6, done: true });
  // A lock speed of zero leaves the maximum duration as the only speed.
  const stalled = { ...TIMING, lockLettersPerSecond: 0, maxDurationMs: 5000 };
  assert.deepEqual(scrambleProgress(10, 5000, stalled), { front: 10, resolved: 10, done: true });
  assert.deepEqual(scrambleProgress(10, 2500, stalled), { front: 10, resolved: 5, done: false });
});

test('a letter flips fast while the lock is far behind and slows as it closes in', () => {
  assert.equal(flipInterval(TIMING.leadLetters, TIMING), TIMING.flipFastMs);
  assert.equal(flipInterval(TIMING.leadLetters + 5, TIMING), TIMING.flipFastMs,
    'a letter further ahead than the lead is no faster than one just at it');
  assert.equal(flipInterval(0, TIMING), TIMING.flipSlowMs);
  assert.equal(flipInterval(-2, TIMING), TIMING.flipSlowMs, 'and no slower than that');
  assert.equal(flipInterval(2, TIMING), 30, 'halfway along the lead is halfway between the waits');
  let previous = TIMING.flipFastMs - 1;
  for (let remaining = TIMING.leadLetters; remaining >= 0; remaining -= 1) {
    const wait = flipInterval(remaining, TIMING);
    assert.ok(wait > previous, `the wait grows as the lock closes: ${remaining}`);
    previous = wait;
  }
  // With no lead a letter locks as soon as it appears, so it never slows.
  assert.equal(flipInterval(0, { ...TIMING, leadLetters: 0 }), TIMING.flipFastMs);
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
    // Each text node is held by the element it sits in, not by the root.
    assert.deepEqual(collectScrambleTargets(root).map((target) => target.owner),
      [root, inner, deep]);
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
    assert.deepEqual(collectScrambleTargets(root).map((target) => target.kind), ['text']);
    // A root is the caller's choice and is never tested itself.
    const hiddenRoot = document.createElement('div');
    hiddenRoot.setAttribute('hidden', '');
    hiddenRoot.append(document.createTextNode('still animated'));
    assert.deepEqual(collectScrambleNodes(hiddenRoot).map((node) => node.data), ['still animated']);
    // A node with no children at all is simply empty.
    assert.deepEqual(collectScrambleTargets(document.createElement('div')), []);
  });
});

test('placeholders and the option a dropdown shows are collected too', async () => {
  await withFakeDocument((document) => {
    const root = document.createElement('div');
    const label = document.createElement('label');
    label.append(document.createTextNode('Search'));
    const input = document.createElement('input');
    input.setAttribute('placeholder', 'Gene or locus');
    const area = document.createElement('textarea');
    area.setAttribute('placeholder', 'Paste a list');
    area.append(document.createTextNode('its content is never animated'));
    const blank = document.createElement('input');
    blank.setAttribute('placeholder', '');
    const spaces = document.createElement('input');
    spaces.setAttribute('placeholder', '   ');
    const plain = document.createElement('input');
    const select = document.createElement('select');
    const chosen = document.createElement('option');
    chosen.append(document.createTextNode('By length'));
    chosen.selected = true;
    const other = document.createElement('option');
    other.append(document.createTextNode('By position'));
    select.append(other, chosen);
    root.append(label, input, area, blank, spaces, plain, select);
    document.body.append(root);

    const targets = collectScrambleTargets(root);
    assert.deepEqual(targets.map((target) => [target.kind, target.read()]), [
      ['text', 'Search'],
      ['placeholder', 'Gene or locus'],
      ['placeholder', 'Paste a list'],
      ['option', 'By length'],
    ], 'in document order, with nothing to reveal left out');
    assert.deepEqual(targets.map((target) => target.owner), [label, input, area, select],
      'a control holds its own placeholder, and a select its shown option');
    // The option a reader cannot see is never collected, by either walk.
    assert.deepEqual(collectScrambleNodes(root).map((node) => node.data), ['Search']);

    // With nothing selected the first option is the one on show, and a select
    // that opts out, or whose option does, animates neither.
    chosen.selected = false;
    assert.equal(collectScrambleTargets(root)[2 + 1].read(), 'By position');
    chosen.selected = true;
    chosen.setAttribute('data-no-scramble', '');
    assert.equal(collectScrambleTargets(root).length, 3);
    chosen.removeAttribute('data-no-scramble');
    select.setAttribute('hidden', '');
    assert.equal(collectScrambleTargets(root).length, 3);
    // A select with no options at all has nothing to show.
    select.removeAttribute('hidden');
    select.replaceChildren();
    assert.equal(collectScrambleTargets(root).length, 3);
    root.remove();
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
    assert.equal(node.data, 'AAAA', 'the real text is never shown for even one frame');
    const seen = [node.data];
    for (let step = 0; step < 8; step += 1) {
      clock.advance(1);
      const { front, resolved } = scrambleProgress(text.length, step + 1, FAST);
      assert.equal(node.data.length, front, 'exactly the letters the trail has reached are visible');
      assert.equal(node.data.slice(0, resolved), text.slice(0, resolved),
        'and the locked ones are the real characters');
      for (const letter of node.data.slice(resolved)) {
        assert.ok(SCRAMBLE_LETTERS.includes(letter) || /\s/.test(letter),
          `an unlocked position shows a base letter: ${JSON.stringify(node.data)}`);
      }
      assert.equal(node.data, allA(text, front, resolved));
      seen.push(node.data);
    }
    await run;
    assert.deepEqual(seen, [
      'AAAA', 'GAAA A', 'GeAA AAA', 'GenA AAA', 'Gene AAA', 'Gene AAA',
      'Gene mAA', 'Gene maA', 'Gene map',
    ], 'the space holds its place from the moment the trail passes it');
    assert.equal(node.data, text);
    assert.equal(scramble.active, false);
  });
});

test('a flipping letter holds still between flips and waits longer as it nears locking', async () => {
  await withFakeDocument(async (document) => {
    const { root, node } = mount(document, 'abcdefghij');
    const clock = frameClock();
    const scramble = new TextScramble({ timing: TIMING, random: cyclingRandom(), ...clock });
    const run = scramble.run(root);

    // Four letters of lead, drawn A, T, G, C. The nearest the lock gets the
    // slowest wait, fifty milliseconds, and the furthest the fastest, ten.
    assert.equal(node.data, 'ATGC');
    clock.advance(10);
    assert.equal(node.data, 'aTGCA', 'the first letter locked and the trail took a fifth');
    clock.advance(10);
    assert.equal(node.data, 'abGTAGC', 'the letter that was due flipped, the new ones were drawn');

    // The seventh letter: drawn at twenty with ten milliseconds to wait, then
    // twenty, then forty, each wait longer than the last as the lock closes on
    // it, and the lock reaches it before that last wait is up.
    assert.equal(node.data[6], 'C');
    clock.advance(10);
    assert.equal(node.data[6], 'T', 'ten milliseconds later it flipped');
    clock.advance(10);
    assert.equal(node.data[6], 'T', 'and then held, its wait now twice as long');
    clock.advance(10);
    assert.equal(node.data[6], 'C', 'fifty milliseconds in, its third flip');
    clock.advance(10);
    assert.equal(node.data[6], 'C', 'and it holds through a wait of forty');
    clock.advance(10);
    assert.equal(node.data[6], 'g', 'which the lock cut short by locking it');

    scramble.cancel();
    await run;
    assert.equal(node.data, 'abcdefghij');
  });
});

test('one frame loop drives every target, writing each at most once a frame', async () => {
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
      // Nine frames cover the text, and eight of them changed its visible
      // string: the frame where the locking space replaced a flipping space
      // left the node alone.
      assert.equal(writes(), 8);
      frames.push(clock.requested);
      root.remove();
    }
    assert.equal(frames[0], frames[1], 'six nodes cost the same frames as one');
  });
});

test('a frame that changes nothing writes nothing, whatever the target kind', async () => {
  await withFakeDocument(async (document) => {
    const root = document.createElement('div');
    const block = document.createElement('p');
    block.append(document.createTextNode('Gene map'));
    const input = document.createElement('input');
    input.setAttribute('placeholder', 'Gene map');
    const select = document.createElement('select');
    const option = document.createElement('option');
    option.append(document.createTextNode('Gene map'));
    select.append(option);
    root.append(block, input, select);
    document.body.append(root);

    const clock = frameClock();
    const scramble = new TextScramble({ timing: TIMING, random: () => 0, ...clock });
    const run = scramble.run(root);
    const counts = [
      countWrites(block.children[0]),
      countAttributeWrites(input, 'placeholder'),
      countTextWrites(option),
    ];
    clock.advance(10);
    for (const writes of counts) assert.equal(writes(), 1, 'a letter locked, so each one wrote');
    // Still the same letters, the same fronts, and nothing due to flip.
    clock.advance(1);
    for (const writes of counts) assert.equal(writes(), 1, 'the target is left alone between changes');
    scramble.cancel();
    await run;
    root.remove();
  });
});

test('an owner is held only while its own text is still flipping', async () => {
  await withFakeDocument(async (document) => {
    const root = document.createElement('div');
    const button = document.createElement('button');
    button.append(document.createTextNode('Map'));
    const paragraph = document.createElement('p');
    paragraph.setAttribute('aria-busy', 'false');
    paragraph.append(document.createTextNode('Gene map and every coding sequence'));
    root.append(button, paragraph);
    document.body.append(root);

    const clock = frameClock();
    const scramble = new TextScramble({ timing: FAST, random: () => 0, ...clock });
    const run = scramble.run(root);
    assert.deepEqual(holdAttributes(root), [null, null, null],
      'a root that holds no text of its own is never touched');
    assert.deepEqual(holdAttributes(button), ['true', 'true', 'true']);
    assert.deepEqual(holdAttributes(paragraph), ['true', 'true', 'true']);

    // Three letters at a letter a millisecond: the button is usable at once.
    clock.advance(3);
    assert.equal(button.textContent, 'Map');
    assert.deepEqual(holdAttributes(button), [null, null, null],
      'released the moment its own label locked');
    assert.deepEqual(holdAttributes(paragraph), ['true', 'true', 'true'],
      'while the long text is still typing');
    assert.equal(scramble.active, true);

    while (scramble.active) clock.advance(1);
    await run;
    assert.deepEqual(holdAttributes(paragraph), ['false', null, null],
      'an attribute it already had is put back, one it never had is removed');
    assert.equal(paragraph.textContent, 'Gene map and every coding sequence');
    root.remove();
  });
});

test('an owner with two texts waits for the later of them', async () => {
  await withFakeDocument(async (document) => {
    const root = document.createElement('div');
    const paragraph = document.createElement('p');
    const emphasis = document.createElement('em');
    emphasis.append(document.createTextNode('Map'));
    paragraph.append(document.createTextNode('ab'), emphasis, document.createTextNode('abcdef'));
    root.append(paragraph);
    document.body.append(root);

    const clock = frameClock();
    const scramble = new TextScramble({ timing: FAST, random: () => 0, ...clock });
    const run = scramble.run(root);
    // Two milliseconds locks the paragraph's own first text, 'ab', and nothing else.
    clock.advance(2);
    for (const element of [paragraph, emphasis]) {
      assert.deepEqual(holdAttributes(element), ['true', 'true', 'true'], element.tagName);
    }
    clock.advance(1);
    assert.deepEqual(holdAttributes(emphasis), [null, null, null],
      'the emphasis is free as soon as its own three letters locked');
    assert.deepEqual(holdAttributes(paragraph), ['true', 'true', 'true'],
      'while the paragraph waits for the six letters that follow it');
    while (scramble.active) clock.advance(1);
    await run;
    assert.deepEqual(holdAttributes(paragraph), [null, null, null]);
    assert.equal(paragraph.textContent, 'abMapabcdef');
    root.remove();
  });
});

test('a placeholder and a dropdown animate like prose and come back exactly', async () => {
  await withFakeDocument(async (document) => {
    const root = document.createElement('div');
    const input = document.createElement('input');
    input.setAttribute('placeholder', 'Gene or\tlocus');
    const select = document.createElement('select');
    const chosen = document.createElement('option');
    chosen.append(document.createTextNode('By length'));
    chosen.selected = true;
    const unseen = document.createElement('option');
    unseen.append(document.createTextNode('By position'));
    select.append(chosen, unseen);
    root.append(input, select);
    document.body.append(root);

    const clock = frameClock();
    const scramble = new TextScramble({ timing: FAST, random: () => 0, ...clock });
    const run = scramble.run(root);
    assert.equal(input.getAttribute('placeholder'), 'AAAA');
    assert.equal(chosen.textContent, 'AA A', 'the space in the option keeps its place');
    assert.equal(unseen.textContent, 'By position', 'an option nobody can see is left alone');
    assert.deepEqual(holdAttributes(input), ['true', 'true', 'true']);
    assert.deepEqual(holdAttributes(select), ['true', 'true', 'true']);
    assert.deepEqual(holdAttributes(chosen), [null, null, null],
      'the select is the owner, not the option');

    // Seven letters locked, and the trail is at the end of both strings by now.
    clock.advance(7);
    assert.equal(input.getAttribute('placeholder'), 'Gene or\tAAAAA',
      'the tab keeps its place, as a space does in prose');
    assert.equal(chosen.textContent, 'By lengAA', 'and the option locks at the same speed');
    assert.deepEqual(holdAttributes(select), ['true', 'true', 'true']);

    clock.advance(2);
    assert.equal(chosen.textContent, 'By length');
    assert.deepEqual(holdAttributes(select), [null, null, null],
      'the dropdown is usable as soon as its own text locked');
    while (scramble.active) clock.advance(1);
    await run;
    assert.equal(input.getAttribute('placeholder'), 'Gene or\tlocus');
    assert.deepEqual(holdAttributes(input), [null, null, null]);
    assert.equal(unseen.textContent, 'By position');
    root.remove();
  });
});

test('cancelling mid-flight restores every string and every owner at once', async () => {
  await withFakeDocument(async (document) => {
    const root = document.createElement('div');
    const block = document.createElement('p');
    block.append(document.createTextNode('Gene map'));
    const second = document.createElement('p');
    second.append(document.createTextNode('Lengths'));
    const input = document.createElement('input');
    input.setAttribute('placeholder', 'Gene or locus');
    const select = document.createElement('select');
    const option = document.createElement('option');
    option.append(document.createTextNode('By length'));
    select.append(option);
    root.append(block, second, input, select);
    document.body.append(root);
    const node = block.children[0];

    const clock = frameClock();
    const scramble = new TextScramble({ timing: FAST, random: () => 0, ...clock });
    const run = scramble.run(root);
    clock.advance(3);
    assert.equal(node.data, 'GenA AAA');

    scramble.cancel();
    assert.equal(node.data, 'Gene map');
    assert.equal(second.children[0].data, 'Lengths');
    assert.equal(input.getAttribute('placeholder'), 'Gene or locus');
    assert.equal(option.textContent, 'By length');
    for (const element of [block, second, input, select]) {
      assert.deepEqual(holdAttributes(element), [null, null, null], element.tagName);
    }
    assert.equal(scramble.active, false);
    assert.deepEqual(clock.cancelled, [clock.requested], 'the pending frame was cancelled');
    await run;

    const writes = countWrites(node);
    scramble.cancel();
    assert.equal(writes(), 0, 'a second cancel has nothing to undo');
    assert.deepEqual(clock.cancelled, [clock.requested]);
    root.remove();
  });
});

test('a target taken out of the document is restored once, freeing its owner', async () => {
  await withFakeDocument(async (document) => {
    const root = document.createElement('div');
    const block = document.createElement('p');
    block.append(document.createTextNode('Gene map'));
    const select = document.createElement('select');
    const option = document.createElement('option');
    option.append(document.createTextNode('By length'));
    select.append(option);
    const kept = document.createElement('p');
    kept.append(document.createTextNode('Lengths and every coding sequence'));
    root.append(block, select, kept);
    document.body.append(root);
    const node = block.children[0];

    const clock = frameClock();
    const scramble = new TextScramble({ timing: FAST, random: () => 0, ...clock });
    const run = scramble.run(root);
    clock.advance(3);
    assert.equal(node.data, 'GenA AAA');

    // The app re-renders the panel and the dropdown while the scramble runs.
    block.remove();
    select.remove();
    clock.advance(1);
    assert.equal(node.data, 'Gene map', 'no stray base letter is left behind');
    assert.equal(option.textContent, 'By length');
    assert.deepEqual(holdAttributes(block), [null, null, null], 'the owner it left with is restored');
    assert.deepEqual(holdAttributes(select), [null, null, null]);
    const writes = countWrites(node);
    while (scramble.active) clock.advance(1);
    await run;
    assert.equal(writes(), 0, 'the dropped node is never written to again');
    assert.equal(kept.children[0].data, 'Lengths and every coding sequence',
      'the targets still in the document finish');
    root.remove();
  });
});

test('a string someone else rewrote is dropped rather than overwritten', async () => {
  await withFakeDocument(async (document) => {
    const root = document.createElement('div');
    const block = document.createElement('p');
    block.append(document.createTextNode('Gene map'));
    const input = document.createElement('input');
    input.setAttribute('placeholder', 'Gene or locus');
    root.append(block, input);
    document.body.append(root);
    const node = block.children[0];

    const clock = frameClock();
    const scramble = new TextScramble({ timing: FAST, random: () => 0, ...clock });
    const run = scramble.run(root);
    clock.advance(3);

    node.data = 'Gene map, 2,789 genes';
    input.setAttribute('placeholder', 'Locus tag');
    clock.advance(1);
    assert.equal(node.data, 'Gene map, 2,789 genes');
    assert.equal(input.getAttribute('placeholder'), 'Locus tag');
    assert.deepEqual(holdAttributes(block), [null, null, null], 'the owner of a dropped text is freed');
    assert.deepEqual(holdAttributes(input), [null, null, null]);
    while (scramble.active) clock.advance(1);
    await run;
    assert.equal(node.data, 'Gene map, 2,789 genes', 'the stale original is never put back');
    assert.equal(input.getAttribute('placeholder'), 'Locus tag');
    root.remove();
  });
});

test('with nothing to animate the run is over at once and no element is touched', async () => {
  await withFakeDocument(async (document) => {
    const root = document.createElement('div');
    const blank = document.createElement('input');
    blank.setAttribute('placeholder', '');
    root.append(document.createTextNode('\n  '), document.createElement('canvas'), blank);
    document.body.append(root);
    const clock = frameClock();
    const scramble = new TextScramble({ timing: FAST, random: () => 0, ...clock });
    await scramble.run([root, null]);
    assert.equal(scramble.active, false);
    assert.equal(clock.requested, 0, 'not even one frame is asked for');
    assert.deepEqual(holdAttributes(root), [null, null, null]);
    assert.deepEqual(holdAttributes(blank), [null, null, null]);
    root.remove();
  });
});

test('starting a run cancels the one already going', async () => {
  await withFakeDocument(async (document) => {
    const { root, block, node } = mount(document, 'Gene map');
    const second = mount(document, 'Lengths');
    const clock = frameClock();
    const scramble = new TextScramble({ timing: FAST, random: () => 0, ...clock });
    const first = scramble.run(root);
    clock.advance(3);
    assert.equal(node.data, 'GenA AAA');

    const next = scramble.run(second.root);
    await first;
    assert.equal(node.data, 'Gene map', 'the abandoned run put its text back');
    assert.deepEqual(holdAttributes(block), [null, null, null]);
    assert.equal(second.node.data, 'AAAA');
    while (scramble.active) clock.advance(1);
    await next;
    assert.equal(second.node.data, 'Lengths');
    assert.deepEqual(holdAttributes(second.block), [null, null, null]);
    root.remove();
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
      instant.root.remove();

      // A trail far faster than the lock, over a text whose first letter cannot
      // lock for five minutes: after any plausible frame delay the trail has
      // moved and nothing has locked, so timer jitter cannot change what this
      // expects.
      const text = 'Gene map and the lengths of every coding sequence. '.repeat(40);
      const { root, node } = mount(document, text);
      const timing = {
        ...TIMING, lockLettersPerSecond: 0.1, trailRatio: 100, maxDurationMs: 600000,
      };
      const scramble = new TextScramble({ timing });
      const run = scramble.run(root);
      assert.equal(node.data.length, timing.leadLetters, 'the lead is on screen at once');
      assert.equal(pending.length, 1, 'the frame came from the browser');

      await new Promise((resolve) => { setTimeout(resolve, 20); });
      pending.pop().callback();
      assert.ok(node.data.length > timing.leadLetters && node.data.length < text.length,
        `the real clock moved the trail along: ${JSON.stringify(node.data)}`);
      for (const letter of node.data) {
        assert.ok(SCRAMBLE_LETTERS.includes(letter) || /\s/.test(letter), 'drawn by Math.random');
      }

      scramble.cancel();
      assert.deepEqual(cancelled, [nextFrame], 'the browser cancelled the frame still pending');
      assert.equal(node.data, text);
      await run;
      root.remove();
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
        leadLetters: 2,
        lockLettersPerSecond: 1000,
        trailRatio: 1.5,
        maxDurationMs: 1000,
        flipFastMs: 1,
        flipSlowMs: 2,
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
      root.remove();
    });
  } finally {
    globalThis.requestAnimationFrame = previous.requestAnimationFrame;
    globalThis.cancelAnimationFrame = previous.cancelAnimationFrame;
    Object.defineProperty(globalThis, 'performance', { value: previous.performance, configurable: true });
  }
});

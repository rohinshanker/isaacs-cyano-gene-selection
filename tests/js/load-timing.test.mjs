import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  LOAD_TIMING, LOAD_TIMING_PARAMETERS, MAX_OVERRIDE, prefersReducedMotion, resolveLoadTiming,
} from '../../site/js/ui/load-timing.js';

test('the defaults are the owner\'s stated times', () => {
  assert.equal(LOAD_TIMING.minimumBarMs, 1000, 'the bar stays at least one second');
  assert.equal(LOAD_TIMING.scramble.lagLetters, 8, 'letters resolve eight behind the front');
  assert.equal(LOAD_TIMING.mapIntro.colourMs, 2000, 'the map colours itself in about two seconds');
  assert.ok(LOAD_TIMING.mapIntro.appearMs < LOAD_TIMING.mapIntro.colourMs,
    'points appear before they colour');
  assert.ok(LOAD_TIMING.scramble.flipFastMs < LOAD_TIMING.scramble.flipSlowMs,
    'flipping slows towards the point a letter resolves');
  assert.ok(Object.isFrozen(LOAD_TIMING) && Object.isFrozen(LOAD_TIMING.scramble)
    && Object.isFrozen(LOAD_TIMING.mapIntro));
});

test('with no overrides the resolved timing equals the defaults and is a fresh copy', () => {
  for (const search of ['', '?', '?data=other/', undefined]) {
    const timing = resolveLoadTiming(search);
    assert.deepEqual(timing, {
      minimumBarMs: LOAD_TIMING.minimumBarMs,
      scramble: { ...LOAD_TIMING.scramble },
      mapIntro: { ...LOAD_TIMING.mapIntro },
    });
    assert.notEqual(timing.scramble, LOAD_TIMING.scramble);
  }
});

test('every tunable has an address-bar override', () => {
  const search = '?load-min=1500&load-lag=4&load-letters=90&load-text-max=2500'
    + '&load-flip-fast=20&load-flip-slow=300&load-map-appear=1000&load-map-colour=3000';
  assert.deepEqual(resolveLoadTiming(search), {
    minimumBarMs: 1500,
    scramble: {
      lagLetters: 4, lettersPerSecond: 90, maxDurationMs: 2500, flipFastMs: 20, flipSlowMs: 300,
    },
    mapIntro: { appearMs: 1000, colourMs: 3000 },
  });
  assert.deepEqual([...LOAD_TIMING_PARAMETERS].sort(), [
    'load-flip-fast', 'load-flip-slow', 'load-lag', 'load-letters', 'load-map-appear',
    'load-map-colour', 'load-min', 'load-text-max',
  ]);
  // The leading question mark is optional, and zero is a legitimate value.
  assert.equal(resolveLoadTiming('load-min=0').minimumBarMs, 0);
});

test('an override that is not a usable number leaves the default in place', () => {
  for (const bad of ['abc', '', ' ', '-1', 'Infinity', 'NaN', String(MAX_OVERRIDE + 1)]) {
    assert.equal(resolveLoadTiming(`?load-min=${encodeURIComponent(bad)}`).minimumBarMs,
      LOAD_TIMING.minimumBarMs, JSON.stringify(bad));
  }
  assert.equal(resolveLoadTiming(`?load-min=${MAX_OVERRIDE}`).minimumBarMs, MAX_OVERRIDE);
});

test('reduced motion is read from the media query, and its absence means no preference', () => {
  assert.equal(prefersReducedMotion({ matchMedia: () => ({ matches: true }) }), true);
  assert.equal(prefersReducedMotion({ matchMedia: () => ({ matches: false }) }), false);
  assert.equal(prefersReducedMotion({}), false);
  assert.equal(prefersReducedMotion(null), false);
  const asked = [];
  prefersReducedMotion({ matchMedia: (query) => { asked.push(query); return { matches: false }; } });
  assert.deepEqual(asked, ['(prefers-reduced-motion: reduce)']);
});

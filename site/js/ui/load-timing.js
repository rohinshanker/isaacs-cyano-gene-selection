/**
 * Every duration of the loading presentation, in one place.
 *
 * The owner tunes these by eye, so nothing else in the site carries a loading
 * duration of its own, and each one can be overridden from the address bar for
 * a visual test without editing a file:
 *
 *   ?load-min=2000&load-letters=70&load-map-colour=2000
 *
 * An override is read once at start-up and is never written to the URL hash,
 * which is analysis state and stays unchanged.
 */

/** The defaults, as the owner set them on 2026-09-30. All times are milliseconds. */
export const LOAD_TIMING = Object.freeze({
  /** The chromosome loading bar takes at least this long, however fast the data. */
  minimumBarMs: 1500,
  scramble: Object.freeze({
    /** How far ahead of the locking text the flipping trail starts, in letters. */
    leadLetters: 10,
    /** How fast readable text locks in, in letters per second. */
    lockLettersPerSecond: 50,
    /** The trail runs this many times faster than the lock, so it finishes first. */
    trailRatio: 1.5,
    /** A long text speeds up so that no single text takes longer than this. */
    maxDurationMs: 10000,
    /** How often a letter flips while it is far ahead of the lock. */
    flipFastMs: 40,
    /** How often it flips just before it locks; flipping slows towards this. */
    flipSlowMs: 170,
  }),
  mapIntro: Object.freeze({
    /** The map's points have all appeared after this long. */
    appearMs: 700,
    /** The map's points have all taken their colour after this long. */
    colourMs: 1200,
  }),
});

/** Query parameter for each tunable, and where it lands. */
const OVERRIDES = Object.freeze([
  ['load-min', null, 'minimumBarMs'],
  ['load-lead', 'scramble', 'leadLetters'],
  ['load-letters', 'scramble', 'lockLettersPerSecond'],
  ['load-trail', 'scramble', 'trailRatio'],
  ['load-text-max', 'scramble', 'maxDurationMs'],
  ['load-flip-fast', 'scramble', 'flipFastMs'],
  ['load-flip-slow', 'scramble', 'flipSlowMs'],
  ['load-map-appear', 'mapIntro', 'appearMs'],
  ['load-map-colour', 'mapIntro', 'colourMs'],
]);

/** The largest value an override may take, so a typo cannot hang the page. */
export const MAX_OVERRIDE = 60000;

/** The query parameters that tune the loading presentation, for documentation and tests. */
export const LOAD_TIMING_PARAMETERS = Object.freeze(OVERRIDES.map(([name]) => name));

/**
 * The timings in effect, with any address-bar overrides applied.
 *
 * An override is used only when it is a finite number from 0 to
 * `MAX_OVERRIDE`; anything else leaves the default in place rather than
 * producing a duration of `NaN`.
 *
 * @param {string} [search] `location.search`, with or without its question mark.
 * @returns {{minimumBarMs: number, scramble: object, mapIntro: object}}
 */
export function resolveLoadTiming(search = '') {
  const parameters = new URLSearchParams(search);
  const timing = {
    minimumBarMs: LOAD_TIMING.minimumBarMs,
    scramble: { ...LOAD_TIMING.scramble },
    mapIntro: { ...LOAD_TIMING.mapIntro },
  };
  for (const [name, group, key] of OVERRIDES) {
    const raw = parameters.get(name);
    if (raw === null || raw.trim() === '') continue;
    const value = Number(raw);
    if (!Number.isFinite(value) || value < 0 || value > MAX_OVERRIDE) continue;
    if (group) timing[group][key] = value;
    else timing[key] = value;
  }
  return timing;
}

/**
 * Whether the reader has asked for reduced motion. The scramble, the map
 * fill-in, and the minimum bar time are all presentation, so all three are
 * skipped when this is true and the page shows its final state at once.
 *
 * @param {{matchMedia?: (query: string) => {matches: boolean}}} [view]
 */
export function prefersReducedMotion(view = globalThis) {
  return Boolean(view?.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches);
}

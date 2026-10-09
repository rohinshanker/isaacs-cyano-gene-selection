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

/** The owner-selected defaults. All times are milliseconds. */
export const LOAD_TIMING = Object.freeze({
  /** Truthful byte progress has no timer-driven minimum. */
  minimumBarMs: 0,
  scramble: Object.freeze({
    /** How far ahead of the locking text the flipping trail starts, in letters. */
    leadLetters: 10,
    /** How fast readable text locks in, in letters per second. */
    lockLettersPerSecond: 50,
    /** The trail runs this many times faster than the lock, so it finishes first. */
    trailRatio: 1.5,
    /** A long text speeds up so that no single text takes longer than this. */
    maxDurationMs: 2500,
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

/** The owner-selected production presentation: readiness, then a short visible hold. */
export const DEFAULT_LOAD_PRESENTATION = Object.freeze({
  name: 'B', reveal: 'ready', holdMs: 500, progress: 'continuous',
});

/** Query-only loading variants prepared for owner review. */
export const LOAD_REVIEW = Object.freeze({
  variants: Object.freeze({
    a: Object.freeze({ reveal: 'ready', holdMs: 0 }),
    b: Object.freeze({ reveal: 'ready', holdMs: 500 }),
    c: Object.freeze({ reveal: 'half', holdMs: 0 }),
  }),
  progressModes: Object.freeze(['grouped', 'continuous']),
  /** Balanced coherent-block deadlines: 1/12/40/160 characters. */
  scrambleAnchors: Object.freeze([
    Object.freeze([1, 250]),
    Object.freeze([12, 350]),
    Object.freeze([40, 600]),
    Object.freeze([160, 1000]),
  ]),
});

/**
 * Resolve an explicitly requested owner-review comparison.
 *
 * No selector means no query override: the caller uses
 * {@link DEFAULT_LOAD_PRESENTATION} for production.
 */
export function resolveLoadReview(search = '') {
  const parameters = new URLSearchParams(search);
  const name = parameters.get('load-review')?.toLowerCase() ?? '';
  const variant = LOAD_REVIEW.variants[name];
  if (!variant) return null;
  const requestedMode = parameters.get('load-progress')?.toLowerCase() ?? '';
  const progress = LOAD_REVIEW.progressModes.includes(requestedMode)
    ? requestedMode : LOAD_REVIEW.progressModes[0];
  return Object.freeze({ name: name.toUpperCase(), progress, ...variant });
}

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
  const review = resolveLoadReview(search);
  const timing = {
    minimumBarMs: review ? 0 : LOAD_TIMING.minimumBarMs,
    scramble: {
      ...LOAD_TIMING.scramble,
      durationAnchors: LOAD_REVIEW.scrambleAnchors.map(([length, ms]) => [length, ms]),
    },
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

/**
 * Every duration of the loading presentation, in one place.
 *
 * The owner tunes these by eye, so nothing else in the site carries a loading
 * duration of its own, and each one can be overridden from the address bar for
 * a visual test without editing a file:
 *
 *   ?load-min=1500&load-letters=90&load-map-colour=3000
 *
 * An override is read once at start-up and is never written to the URL hash,
 * which is analysis state and stays unchanged.
 */

/** The defaults. All times are milliseconds. */
export const LOAD_TIMING = Object.freeze({
  /** The chromosome loading bar stays at least this long, however fast the data. */
  minimumBarMs: 1000,
  scramble: Object.freeze({
    /** Letters between the typing front and the point where they resolve. */
    lagLetters: 8,
    /** How fast the typing front moves. */
    lettersPerSecond: 110,
    /** A long text speeds up so that no single text takes longer than this. */
    maxDurationMs: 1600,
    /** How often a letter flips just after it is typed. */
    flipFastMs: 40,
    /** How often it flips just before it resolves; flipping slows towards this. */
    flipSlowMs: 170,
  }),
  mapIntro: Object.freeze({
    /** The map's points have all appeared after this long. */
    appearMs: 700,
    /** The map's points have all taken their colour after this long. */
    colourMs: 2000,
  }),
  /**
   * Whether the map is held where the loading grid stood through the reveal.
   * Not a duration, but tuned by eye with the rest: `?load-anchor=0` lets the
   * page stay at its top instead, with the map wherever the layout puts it.
   */
  anchorView: true,
});

/** Query parameter for each tunable, and where it lands. */
const OVERRIDES = Object.freeze([
  ['load-min', null, 'minimumBarMs'],
  ['load-lag', 'scramble', 'lagLetters'],
  ['load-letters', 'scramble', 'lettersPerSecond'],
  ['load-text-max', 'scramble', 'maxDurationMs'],
  ['load-flip-fast', 'scramble', 'flipFastMs'],
  ['load-flip-slow', 'scramble', 'flipSlowMs'],
  ['load-map-appear', 'mapIntro', 'appearMs'],
  ['load-map-colour', 'mapIntro', 'colourMs'],
]);

/** The one switch among the tunables: `0` or `1`, anything else is ignored. */
export const ANCHOR_PARAMETER = 'load-anchor';

/** The largest value an override may take, so a typo cannot hang the page. */
export const MAX_OVERRIDE = 60000;

/** The query parameters that tune the loading presentation, for documentation and tests. */
export const LOAD_TIMING_PARAMETERS = Object.freeze(
  [...OVERRIDES.map(([name]) => name), ANCHOR_PARAMETER],
);

/**
 * The timings in effect, with any address-bar overrides applied.
 *
 * An override is used only when it is a finite number from 0 to
 * `MAX_OVERRIDE`; anything else leaves the default in place rather than
 * producing a duration of `NaN`.
 *
 * @param {string} [search] `location.search`, with or without its question mark.
 * @returns {{minimumBarMs: number, scramble: object, mapIntro: object, anchorView: boolean}}
 */
export function resolveLoadTiming(search = '') {
  const parameters = new URLSearchParams(search);
  const timing = {
    minimumBarMs: LOAD_TIMING.minimumBarMs,
    scramble: { ...LOAD_TIMING.scramble },
    mapIntro: { ...LOAD_TIMING.mapIntro },
    anchorView: LOAD_TIMING.anchorView,
  };
  const anchor = parameters.get(ANCHOR_PARAMETER);
  if (anchor === '0' || anchor === '1') timing.anchorView = anchor === '1';
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

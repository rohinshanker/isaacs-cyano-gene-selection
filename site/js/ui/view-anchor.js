/**
 * Hold an element at one height in the viewport while the page above it grows.
 *
 * The loading shell shows an empty grid high in the page, in view. At the
 * reveal the map takes the grid's place, but the tabs, the blurb and the
 * toolbar reappear above it, and on a narrow screen the controls column returns
 * above the whole map card, so the map lands far below where the grid stood:
 * off screen on a phone, and mostly below the fold on a laptop. The fill-in the
 * visitor was waiting for would then play out of sight.
 *
 * This scrolls the page by exactly the distance the element has moved, so it
 * stays where the eye already is, and keeps correcting for as long as the text
 * above it is still typing in and changing height. It lets go the moment the
 * visitor scrolls, clicks, touches, or presses a key: the page is theirs.
 */

/** Input that means the visitor has taken over the scroll position. */
export const RELEASE_EVENTS = Object.freeze(['wheel', 'touchstart', 'pointerdown', 'keydown']);

/**
 * @param {Element} anchor the element to hold.
 * @param {number} top where its top edge should stay, in viewport pixels.
 * @param {{durationMs?: number, view?: Window, now?: () => number,
 *   requestFrame?: (callback: () => void) => number}} [options]
 *   `durationMs` of 0 corrects once and stops, which is what reduced motion
 *   asks for: nothing above the element is going to move again.
 * @returns {() => void} release the hold early. Idempotent.
 */
export function holdInPlace(anchor, top, {
  durationMs = 0,
  view = window,
  now = () => performance.now(),
  requestFrame = (callback) => requestAnimationFrame(callback),
} = {}) {
  let held = true;
  const correct = () => {
    const drift = anchor.getBoundingClientRect().top - top;
    // `instant` so a page that scrolls smoothly elsewhere does not animate this.
    if (Math.abs(drift) >= 1) view.scrollBy({ top: drift, behavior: 'instant' });
  };
  const release = () => {
    if (!held) return;
    held = false;
    for (const type of RELEASE_EVENTS) view.removeEventListener(type, release);
  };
  correct();
  if (!(durationMs > 0)) {
    held = false;
    return release;
  }
  for (const type of RELEASE_EVENTS) view.addEventListener(type, release, { passive: true });
  const until = now() + durationMs;
  const step = () => {
    if (!held) return;
    correct();
    if (now() >= until) release();
    else requestFrame(step);
  };
  requestFrame(step);
  return release;
}

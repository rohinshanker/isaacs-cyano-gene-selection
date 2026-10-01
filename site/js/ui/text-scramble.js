/**
 * The base-pair scramble that reveals the site's text once the data has landed.
 *
 * Every text node under the given roots types out left to right as random base
 * letters, A, T, G and C, that keep flipping. Eight letters behind the typing
 * front — `timing.lagLetters` — a second front follows and each letter settles
 * into the character it is really meant to be. A letter flips quickly just after
 * it is typed and more and more slowly as the resolving front closes on it, so
 * the eye can follow the moment each one lands.
 *
 * Two things make it safe to run over the real document rather than over a
 * decorative copy:
 *
 * - The real text is in the document the whole time. The scramble only rewrites
 *   the `data` of text nodes that are already there, and the original string is
 *   put back exactly when the run finishes or is cancelled, so no stray base
 *   letter can survive into the loaded page.
 * - While a root is animating it carries `aria-busy` and `aria-hidden`, and the
 *   attributes it had before are restored afterwards. A screen reader therefore
 *   reads the final text once and never the flipping letters.
 *
 * Whitespace is never scrambled: a space, a tab or a newline shows as itself the
 * moment the typing front passes it, so words keep their shape and lines keep
 * their breaks while the letters inside them are still unsettled.
 *
 * One `requestAnimationFrame` loop drives every node, each node's `data` is
 * written at most once per frame and only when its visible string changed, and a
 * node that the app re-renders or rewrites underneath the run is dropped rather
 * than fought over. That is what makes it affordable over the few hundred text
 * nodes the loaded page has.
 *
 * ## CSS for the coordinator to add
 *
 * The animation itself needs no CSS. One consequence of it does: a node shows
 * only `front` characters, so a paragraph starts empty and grows, and a
 * container sized by its text will jump as lines appear. Reserve the height of
 * anything that scrambles, which is the same no-layout-shift rule the shell
 * already follows:
 *
 *     [aria-busy="true"] { min-height: var(--loading-text-min-height, 1lh); }
 *
 * The opt-outs are attributes and a class that already exist, so nothing new is
 * needed for them: `hidden`, `.visually-hidden`, and `data-no-scramble` on any
 * element whose text should appear at once.
 */

/** The letters a not-yet-resolved position flips between. */
export const SCRAMBLE_LETTERS = 'ATGC';

/** Element contents that are not prose, or are not meant to be seen animating. */
const SKIP_ELEMENTS = new Set([
  'script', 'style', 'noscript', 'textarea', 'option', 'title', 'svg', 'canvas',
]);

/**
 * The attributes a root carries while it animates, so no reader follows along.
 *
 * `aria-hidden` alone hides a region from assistive technology and leaves its
 * controls in the tab order, so a keyboard could land on a button that is not
 * announced. `inert` takes the region out of the tab order and away from the
 * pointer for the same second and a half, which is what makes hiding it honest.
 */
const BUSY_ATTRIBUTES = ['aria-busy', 'aria-hidden', 'inert'];

/** An element that asks for its text to appear at once. */
const SKIP_CLASS = 'visually-hidden';
const SKIP_ATTRIBUTE = 'data-no-scramble';

const ELEMENT_NODE = 1;
const TEXT_NODE = 3;

const clamp = (value, low, high) => Math.min(high, Math.max(low, value));

/** Whether a character keeps its own shape rather than flipping. */
const WHITESPACE = /\s/;
const isWhitespace = (character) => WHITESPACE.test(character);

/**
 * The typing front and the resolve front at a moment, in letters.
 *
 * `front` is how many leading letters have been typed, 0 to `length`, and
 * `resolved` how many of those show their final character. The resolve front
 * trails the typing front by `timing.lagLetters` while the typing front is still
 * moving, and keeps advancing at the same speed after the typing front has
 * reached the end, until it reaches the end too.
 *
 * Both fronts come from one distance travelled, `length + lagLetters` letters in
 * all, which is what makes a long text speed up as one piece: a text that would
 * take longer than `timing.maxDurationMs` at `timing.lettersPerSecond` is
 * covered in exactly `maxDurationMs` instead, typing and trailing lag together.
 *
 * @param {number} length Characters in the text.
 * @param {number} elapsedMs Milliseconds since the run started.
 * @param {{lagLetters: number, lettersPerSecond: number, maxDurationMs: number}} timing
 * @returns {{front: number, resolved: number, done: boolean}}
 */
export function scrambleProgress(length, elapsedMs, timing) {
  const total = Math.max(0, Math.trunc(length));
  const lag = Math.max(0, Math.trunc(timing.lagLetters));
  const distance = total + lag;
  const naturalMs = (distance / timing.lettersPerSecond) * 1000;
  const durationMs = Math.min(naturalMs, Math.max(0, timing.maxDurationMs));
  // An empty text, or a duration tuned to nothing, has already arrived; dividing
  // by that zero is the one way this arithmetic could produce NaN.
  const travelled = durationMs > 0
    ? Math.floor((Math.max(0, elapsedMs) / durationMs) * distance)
    : distance;
  const resolved = clamp(travelled - lag, 0, total);
  return { front: clamp(travelled, 0, total), resolved, done: resolved === total };
}

/**
 * How long a flipping letter waits before its next flip, in milliseconds.
 *
 * `remaining` is how many letters the resolve front still has to travel to reach
 * this letter, so `timing.lagLetters` or more means the letter has just been
 * typed and flips at `timing.flipFastMs`; zero means it is about to settle and
 * flips at `timing.flipSlowMs`. In between the wait grows in proportion, which
 * is the slowing-down the reader sees.
 *
 * @param {number} remaining Letters of travel left before this one resolves.
 * @param {{lagLetters: number, flipFastMs: number, flipSlowMs: number}} timing
 */
export function flipInterval(remaining, timing) {
  const lag = Math.max(0, Math.trunc(timing.lagLetters));
  // With no lag a letter resolves as soon as it is typed and never slows down.
  if (lag === 0) return timing.flipFastMs;
  const nearness = clamp(remaining / lag, 0, 1);
  return timing.flipSlowMs + (timing.flipFastMs - timing.flipSlowMs) * nearness;
}

/** An element whose text appears at once, along with everything inside it. */
function skipsScramble(element) {
  if (SKIP_ELEMENTS.has(element.tagName.toLowerCase())) return true;
  // `hidden` is read both ways because the site sets it as a property and
  // writes it as an attribute in the markup.
  if (element.hidden === true || element.getAttribute('hidden') !== null) return true;
  if (element.classList.contains(SKIP_CLASS)) return true;
  return element.getAttribute(SKIP_ATTRIBUTE) !== null || element.dataset.noScramble !== undefined;
}

/**
 * Every text node under `root` that should animate, in document order.
 *
 * A node holding only whitespace is left out: it has nothing to reveal, and
 * animating the indentation between two tags would only make the layout jump.
 * The root itself is never tested — the caller chose it — but anything inside a
 * skipped element is passed over whole.
 *
 * @param {Element} root
 * @returns {Array} the text nodes, in document order
 */
export function collectScrambleNodes(root) {
  const found = [];
  const walk = (element) => {
    for (const node of element.childNodes) {
      if (node.nodeType === TEXT_NODE) {
        if (/\S/.test(node.data)) found.push(node);
      } else if (node.nodeType === ELEMENT_NODE && !skipsScramble(node)) {
        walk(node);
      }
    }
  };
  walk(root);
  return found;
}

/**
 * One run of the scramble over a set of roots.
 *
 * Time, randomness and the frame loop are all injected, so the animation is
 * exactly reproducible under test and the module needs no globals of its own.
 */
export class TextScramble {
  constructor({
    timing,
    random = Math.random,
    now = () => performance.now(),
    // Wrapped, not passed by reference: a browser refuses to run
    // `requestAnimationFrame` as a method of anything but its own window, and
    // these are called as `this.requestFrame(...)`.
    requestFrame = (callback) => requestAnimationFrame(callback),
    cancelFrame = (handle) => cancelAnimationFrame(handle),
  }) {
    this.timing = timing;
    this.random = random;
    this.now = now;
    this.requestFrame = requestFrame;
    this.cancelFrame = cancelFrame;
    /** Roots carrying the busy attributes, with what they carried before. */
    this.roots = [];
    /** One per animating text node. */
    this.records = [];
    this.frame = null;
    this.startedAt = 0;
    /** The running promise's resolve; holding one is what makes a run active. */
    this.settle = null;
  }

  /** Whether a run is on. */
  get active() {
    return this.settle !== null;
  }

  /**
   * Animate every eligible text node under the given roots, replacing any run
   * already going.
   *
   * @param {object|Array} roots One root or several.
   * @returns {Promise<void>} resolved when every node has resolved, or on cancel.
   */
  run(roots) {
    if (this.active) this.cancel();
    const marked = [];
    const records = [];
    for (const root of (Array.isArray(roots) ? roots : [roots]).filter(Boolean)) {
      const nodes = collectScrambleNodes(root);
      // A root with nothing to animate is left alone rather than made busy.
      if (nodes.length === 0) continue;
      marked.push({
        element: root,
        saved: BUSY_ATTRIBUTES.map((name) => [name, root.getAttribute(name)]),
      });
      for (const node of nodes) {
        const original = node.data;
        records.push({
          node,
          original,
          /** What each position shows while it is still flipping. */
          letters: new Array(original.length),
          /** When each flipping position is next due to flip, in elapsed ms. */
          flipAt: new Array(original.length),
          // No frame has rendered yet, so the first one always writes, which is
          // what takes the real text off the screen before it is revealed.
          front: -1,
          resolved: -1,
          written: original,
          live: true,
        });
      }
    }
    if (records.length === 0) return Promise.resolve();

    this.records = records;
    this.roots = marked;
    for (const { element } of marked) {
      for (const name of BUSY_ATTRIBUTES) element.setAttribute(name, 'true');
    }
    const promise = new Promise((resolve) => { this.settle = resolve; });
    this.startedAt = this.now();
    // Frame zero runs now, so the full text is never on screen for a frame.
    this.step();
    return promise;
  }

  /** Stop now and restore every node's final text. Idempotent. */
  cancel() {
    if (!this.active) return;
    if (this.frame !== null) this.cancelFrame(this.frame);
    this.conclude();
  }

  /** One frame for every node, then either another frame or the end of the run. */
  step() {
    this.frame = null;
    const elapsedMs = this.now() - this.startedAt;
    let pending = 0;
    for (const record of this.records) {
      if (record.live && this.advance(record, elapsedMs)) pending += 1;
    }
    if (pending === 0) this.conclude();
    else this.frame = this.requestFrame(() => this.step());
  }

  /**
   * Bring one node up to `elapsedMs`.
   *
   * @returns {boolean} whether this node still needs frames.
   */
  advance(record, elapsedMs) {
    const { node, original } = record;
    // Someone else now owns this text: a stale original would undo their work.
    if (node.data !== record.written) {
      record.live = false;
      return false;
    }
    // Re-rendered out of the document: put the real text back, in case the node
    // is shown again, and then never touch it.
    if (node.isConnected === false) {
      this.restore(record);
      return false;
    }

    const { front, resolved, done } = scrambleProgress(original.length, elapsedMs, this.timing);
    let changed = front !== record.front || resolved !== record.resolved;
    record.front = front;
    record.resolved = resolved;
    // Where the resolve front is, counted so that it can still be short of the
    // start of the text: that distance is what a letter's flip speed reads.
    const reach = front < original.length ? front - this.lagLetters() : resolved;
    for (let index = resolved; index < front; index += 1) {
      if (record.letters[index] === undefined) {
        record.letters[index] = isWhitespace(original[index]) ? original[index] : this.draw();
        record.flipAt[index] = elapsedMs + flipInterval(index - reach, this.timing);
        changed = true;
      } else if (!isWhitespace(original[index]) && elapsedMs >= record.flipAt[index]) {
        record.letters[index] = this.draw();
        record.flipAt[index] = elapsedMs + flipInterval(index - reach, this.timing);
        changed = true;
      }
    }
    if (changed) this.write(record);
    if (done) record.live = false;
    return !done;
  }

  /** The lag in letters, as the fronts count it. */
  lagLetters() {
    return Math.max(0, Math.trunc(this.timing.lagLetters));
  }

  /** One base letter. */
  draw() {
    const index = Math.floor(this.random() * SCRAMBLE_LETTERS.length);
    return SCRAMBLE_LETTERS[clamp(index, 0, SCRAMBLE_LETTERS.length - 1)];
  }

  /**
   * The node's visible string: the resolved characters, then the flipping ones.
   * Nothing is written when the string has not changed.
   */
  write(record) {
    const { original, resolved, front } = record;
    const text = original.slice(0, resolved) + record.letters.slice(resolved, front).join('');
    if (text === record.written) return;
    record.node.data = text;
    record.written = text;
  }

  /** Put a node's original text back and stop animating it. */
  restore(record) {
    // Only when this run is still the last writer: a stale original would
    // otherwise undo whatever replaced it.
    if (record.node.data === record.written) {
      record.node.data = record.original;
      record.written = record.original;
    }
    record.live = false;
  }

  /** End the run: every text its own again, every root as it was, promise kept. */
  conclude() {
    this.frame = null;
    for (const record of this.records) if (record.live) this.restore(record);
    for (const { element, saved } of this.roots) {
      for (const [name, value] of saved) {
        if (value === null) element.removeAttribute(name);
        else element.setAttribute(name, value);
      }
    }
    const settle = this.settle;
    this.settle = null;
    this.records = [];
    this.roots = [];
    settle();
  }
}

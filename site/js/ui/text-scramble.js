/**
 * The base-pair scramble that reveals the site's text once the data has landed.
 *
 * Every text node under the given roots, and the text a form control shows — an
 * `input` or `textarea` placeholder, the option a dropdown is displaying — flips
 * through random base letters, A, T, G and C, and locks into what it is really
 * meant to be from left to right. Two fronts cross each string:
 *
 * - The **lock front** is the readable text. It advances at
 *   `timing.lockLettersPerSecond`, so prose locks in at a steady reading speed
 *   however much of it there is; a text long enough that this would take longer
 *   than `timing.maxDurationMs` locks faster, so that it finishes exactly then.
 * - The **trail front** is the flipping edge. It starts `timing.leadLetters`
 *   ahead of the lock and travels `timing.trailRatio` times faster, so it leads
 *   the whole way, reaches the end of the string first, and leaves the lock to
 *   catch up. A letter flips quickly while the lock is far behind it and more
 *   and more slowly as the lock closes on it, so the eye can follow the moment
 *   each one lands.
 *
 * Three things make it safe to run over the real document rather than over a
 * decorative copy:
 *
 * - The real text is in the document the whole time. The scramble only rewrites
 *   the `data` of text nodes, a `placeholder` attribute and the selected
 *   option's text, and the original string is put back exactly when the run
 *   finishes or is cancelled, so no stray base letter can survive into the
 *   loaded page.
 * - While its own text is still flipping, each **owner element** — a text node's
 *   parent, or the control whose placeholder or dropdown text is animating —
 *   carries `aria-busy`, `aria-hidden` and `inert`, and gets back exactly the
 *   attributes it had the moment the last of its own text locks. Assistive
 *   technology therefore reads the final text once and never the flipping
 *   letters, and the keyboard cannot land on a control that is hidden from it.
 *   The hold is per element and not per root because a text may now take up to
 *   `timing.maxDurationMs`: a button with a short label is usable in a fraction
 *   of a second while a long paragraph elsewhere is still typing.
 * - Whitespace is never scrambled: a space, a tab or a newline shows as itself
 *   the moment the trail front passes it, so words keep their shape and lines
 *   keep their breaks while the letters inside them are still unsettled.
 *
 * One `requestAnimationFrame` loop drives every target, each one is written at
 * most once per frame and only when its visible string changed, and a target the
 * app re-renders or rewrites underneath the run is dropped rather than fought
 * over. That is what makes it affordable over the few hundred text nodes the
 * loaded page has.
 *
 * ## CSS for the coordinator to consider
 *
 * The animation itself needs no CSS. One consequence of it does: a string shows
 * only `front` characters, so a long paragraph starts as a short flipping trail
 * and grows, and a container sized by its text will jump as lines appear.
 * Reserve the height of the containers that hold long prose, which is the same
 * no-layout-shift rule the shell already follows. Do not key that height off
 * `[aria-busy="true"]`: the hold is now per owner element, so that selector
 * matches every button, label and control that is animating, and a minimum
 * height on those would be worse than the shift it prevents.
 *
 * The opt-outs are attributes and a class that already exist, so nothing new is
 * needed for them: `hidden`, `.visually-hidden`, and `data-no-scramble` on any
 * element whose text should appear at once.
 */

/** The letters a not-yet-locked position flips between. */
export const SCRAMBLE_LETTERS = 'ATGC';

/** Element contents that are not prose, or are not meant to be seen animating. */
const SKIP_ELEMENTS = new Set([
  'script', 'style', 'noscript', 'textarea', 'option', 'title', 'svg', 'canvas',
]);

/** Inline descendants of these elements reveal as one readable block. */
const COHERENT_BLOCKS = new Set([
  'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'label', 'legend', 'li', 'dt', 'dd',
  'button', 'a', 'summary', 'figcaption', 'th', 'td',
]);

/**
 * The attributes an owner element carries while its own text flips, so no reader
 * follows along.
 *
 * `aria-hidden` alone hides an element from assistive technology and leaves its
 * controls in the tab order, so a keyboard could land on a button that is not
 * announced. `inert` takes it out of the tab order and away from the pointer for
 * exactly as long, which is what makes hiding it honest.
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

/** Whether a string has anything to reveal, rather than being empty or blank. */
const hasText = (value) => typeof value === 'string' && /\S/.test(value);

/** A tag name as this module compares it, whatever case the document uses. */
const tagOf = (element) => element.tagName.toLowerCase();

/**
 * The trail front and the lock front at a moment, in letters.
 *
 * `resolved` is the lock front: how many leading characters show their final
 * character, 0 to `length`. `front` is the trail front: how many characters are
 * visible at all, the ones past `resolved` still flipping. At elapsed 0 the
 * trail already shows `min(timing.leadLetters, length)` flipping letters and
 * nothing is locked; it then pulls further ahead at `timing.trailRatio` times
 * the lock speed, reaches the end first, and the lock catches up.
 *
 * The lock speed is `timing.lockLettersPerSecond`, raised just enough that a
 * text which would otherwise outlast `timing.maxDurationMs` locks its last
 * character exactly then.
 *
 * @param {number} length Characters in the text.
 * @param {number} elapsedMs Milliseconds since the run started.
 * @param {{leadLetters: number, lockLettersPerSecond: number, trailRatio: number,
 *   maxDurationMs: number}} timing
 * @returns {{front: number, resolved: number, done: boolean}}
 */
export function scrambleDuration(length, timing) {
  const total = Math.max(0, Math.trunc(length));
  const anchors = timing.durationAnchors;
  if (Array.isArray(anchors) && anchors.length > 0) {
    if (total <= 0) return 0;
    const points = anchors
      .map(([characters, milliseconds]) => [Number(characters), Number(milliseconds)])
      .filter(([characters, milliseconds]) => characters > 0 && milliseconds >= 0)
      .sort((a, b) => a[0] - b[0]);
    if (points.length === 0) return 0;
    if (total <= points[0][0]) return points[0][1];
    for (let index = 1; index < points.length; index += 1) {
      const [rightLength, rightMs] = points[index];
      if (total > rightLength) continue;
      const [leftLength, leftMs] = points[index - 1];
      const share = (total - leftLength) / (rightLength - leftLength);
      return leftMs + share * (rightMs - leftMs);
    }
    return points.at(-1)[1];
  }
  const naturalMs = timing.lockLettersPerSecond > 0
    ? (total / timing.lockLettersPerSecond) * 1000 : Infinity;
  return Math.min(naturalMs, Math.max(0, timing.maxDurationMs));
}

export function scrambleProgress(length, elapsedMs, timing) {
  const total = Math.max(0, Math.trunc(length));
  const lead = Math.max(0, Math.trunc(timing.leadLetters));
  const durationMs = scrambleDuration(total, timing);
  // An empty text, or a duration tuned to nothing, has already arrived; dividing
  // by that zero is the one way this arithmetic could produce NaN.
  if (!(durationMs > 0)) return { front: total, resolved: total, done: true };

  const elapsed = Math.max(0, elapsedMs);
  const lockPerMs = total / durationMs;
  // At the duration the lock is at the end by definition, whatever the floating
  // point of `total / durationMs * durationMs` makes of it.
  const locked = elapsed >= durationMs ? total : Math.floor(lockPerMs * elapsed);
  const resolved = clamp(locked, 0, total);
  // Clamped up to the lock front, so a trail ratio below one still leads it.
  const front = clamp(Math.floor(lead + timing.trailRatio * lockPerMs * elapsed), resolved, total);
  return { front, resolved, done: resolved === total };
}

/**
 * How long a flipping letter waits before its next flip, in milliseconds.
 *
 * `remaining` is how many letters lie between this one and the lock front, so
 * `timing.leadLetters` or more means the lock is still far behind and the letter
 * flips at `timing.flipFastMs`; zero means it is about to lock and flips at
 * `timing.flipSlowMs`. In between the wait grows in proportion, which is the
 * slowing-down the reader sees.
 *
 * @param {number} remaining Letters between this one and the lock front.
 * @param {{leadLetters: number, flipFastMs: number, flipSlowMs: number}} timing
 */
export function flipInterval(remaining, timing) {
  const lead = Math.max(0, Math.trunc(timing.leadLetters));
  // With no lead a letter locks as soon as it appears and never slows down.
  if (lead === 0) return timing.flipFastMs;
  const nearness = clamp(remaining / lead, 0, 1);
  return timing.flipSlowMs + (timing.flipFastMs - timing.flipSlowMs) * nearness;
}

/** An element whose text appears at once, along with everything inside it. */
function skipsScramble(element) {
  if (SKIP_ELEMENTS.has(tagOf(element))) return true;
  return optsOutOfScramble(element);
}

/** An element the markup asks to be left alone, contents and all. */
function optsOutOfScramble(element) {
  // `hidden` is read both ways because the site sets it as a property and
  // writes it as an attribute in the markup.
  if (element.hidden === true || element.getAttribute('hidden') !== null) return true;
  if (element.classList.contains(SKIP_CLASS)) return true;
  return element.getAttribute(SKIP_ATTRIBUTE) !== null || element.dataset.noScramble !== undefined;
}

/**
 * The option a `select` is showing, which is the only one a reader can see.
 *
 * A single `select` in a document always has one option selected, so the
 * fall back to the first matters only for a detached or multiple select that
 * has none.
 *
 * @param {Element} select
 * @returns {Element|null}
 */
function shownOption(select) {
  const options = [];
  const gather = (element) => {
    for (const child of element.childNodes) {
      if (child.nodeType !== ELEMENT_NODE) continue;
      if (tagOf(child) === 'option') options.push(child);
      else gather(child);
    }
  };
  gather(select);
  return options.find((option) => option.selected === true) ?? options[0] ?? null;
}

/**
 * One animating string: how to read it, how to write it, whether it is still in
 * the document, and the element that holds the busy attributes while it flips.
 *
 * @typedef {{kind: string, owner: Element, read: () => string|null,
 *   write: (text: string) => void, connected: () => boolean}} ScrambleTarget
 */

/** A text node, animated in place, held by the element it sits in. */
function textTarget(node, owner, group) {
  return {
    kind: 'text',
    node,
    owner,
    group,
    read: () => node.data,
    write: (text) => { node.data = text; },
    connected: () => node.isConnected !== false,
  };
}

/** An `input` or `textarea` placeholder, animated in the attribute itself. */
function placeholderTarget(control) {
  return {
    kind: 'placeholder',
    owner: control,
    group: control,
    read: () => control.getAttribute('placeholder'),
    write: (text) => control.setAttribute('placeholder', text),
    connected: () => control.isConnected !== false,
  };
}

/** The text of the option a dropdown is showing, held by the `select`. */
function optionTarget(select, option) {
  return {
    kind: 'option',
    owner: select,
    group: select,
    read: () => option.textContent,
    write: (text) => { option.textContent = text; },
    connected: () => option.isConnected !== false,
  };
}

/**
 * Every string under `root` that should animate, in document order.
 *
 * A string of nothing but whitespace is left out whatever kind it is: it has
 * nothing to reveal, and animating the indentation between two tags would only
 * make the layout jump. The root itself is never tested — the caller chose it —
 * but anything inside a skipped element is passed over whole. A `select` is
 * entered only for the option it is showing, so option text never reaches the
 * ordinary text-node walk and the options a reader cannot see stay untouched.
 *
 * @param {Element} root
 * @returns {Array<ScrambleTarget>}
 */
export function collectScrambleTargets(root) {
  const found = [];
  const walk = (element, coherent = COHERENT_BLOCKS.has(tagOf(element)) ? element : null) => {
    for (const node of element.childNodes) {
      if (node.nodeType === TEXT_NODE) {
        if (hasText(node.data)) found.push(textTarget(node, element, coherent ?? element));
        continue;
      }
      if (node.nodeType !== ELEMENT_NODE || optsOutOfScramble(node)) continue;
      const tag = tagOf(node);
      if (tag === 'input' || tag === 'textarea') {
        if (hasText(node.getAttribute('placeholder'))) found.push(placeholderTarget(node));
      }
      if (tag === 'select') {
        const option = shownOption(node);
        if (option && !optsOutOfScramble(option) && hasText(option.textContent)) {
          found.push(optionTarget(node, option));
        }
        continue;
      }
      if (!skipsScramble(node)) {
        walk(node, COHERENT_BLOCKS.has(tag) ? node : coherent);
      }
    }
  };
  walk(root);
  return found;
}

/**
 * Every text node under `root` that should animate, in document order.
 *
 * The prose half of {@link collectScrambleTargets}, which is what a caller that
 * only wants to know which text will move should ask for.
 *
 * @param {Element} root
 * @returns {Array} the text nodes, in document order
 */
export function collectScrambleNodes(root) {
  return collectScrambleTargets(root)
    .filter((target) => target.kind === 'text')
    .map((target) => target.node);
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
    /** One hold per owner element: what it carried before, and how many of its
     * own targets have still to lock. */
    this.holds = [];
    /** One per animating target. */
    this.records = [];
    this.frame = null;
    this.startedAt = 0;
    /** Reservations keep final prose/control geometry while visual text is short. */
    this.reservations = new Map();
    /** Structural identities let landing-driven replacements inherit deadlines. */
    this.generations = new Map();
    /** The running promise's resolve; holding one is what makes a run active. */
    this.settle = null;
  }

  /** Whether a run is on. */
  get active() {
    return this.settle !== null;
  }

  /**
   * Animate every eligible string under the given roots, replacing any run
   * already going.
   *
   * @param {object|Array} roots One root or several.
   * @returns {Promise<void>} resolved when everything has locked, or on cancel.
   */
  run(roots) {
    if (this.active) this.cancel();
    this.generations.clear();
    const holds = new Map();
    const records = [];
    const startedAt = this.now();
    const list = (Array.isArray(roots) ? roots : [roots]).filter(Boolean);
    list.forEach((root, rootIndex) => {
      const targets = collectScrambleTargets(root);
      const groups = this.groupTargets(targets);
      for (const group of groups) {
        let offset = 0;
        for (const target of group.targets) {
        const original = target.read();
        let hold = holds.get(target.owner);
        if (hold === undefined) {
          hold = {
            element: target.owner,
            saved: BUSY_ATTRIBUTES.map((name) => [name, target.owner.getAttribute(name)]),
            pending: 0,
            released: false,
          };
          holds.set(target.owner, hold);
        }
        hold.pending += 1;
        records.push({
          target,
          hold,
          original,
          key: this.targetKey(target, root, rootIndex),
          group: { length: group.length, startedAt },
          offset,
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
        offset += original.length;
        }
        this.reserve(group.element);
      }
    });
    if (records.length === 0) return Promise.resolve();

    this.records = records;
    this.holds = [...holds.values()];
    for (const record of records) {
      this.generations.set(record.key, {
        original: record.original, startedAt: record.group.startedAt,
      });
    }
    for (const { element } of this.holds) {
      for (const name of BUSY_ATTRIBUTES) element.setAttribute(name, 'true');
    }
    const promise = new Promise((resolve) => { this.settle = resolve; });
    this.startedAt = startedAt;
    // Frame zero runs now, so the full text is never on screen for a frame.
    this.step();
    return promise;
  }

  /**
   * Animate content replaced by a data landing without restarting the page.
   * Unchanged structural targets keep their original deadline; genuinely new
   * content receives one bounded local reveal beginning now.
   */
  refresh(roots) {
    const wasActive = this.active;
    if (wasActive) {
      for (const record of this.records) {
        if (record.live && !record.target.connected()) this.restore(record);
      }
    }
    const list = (Array.isArray(roots) ? roots : [roots]).filter(Boolean);
    const liveKeys = new Set(this.records.filter((record) => record.live).map((record) => record.key));
    const added = [];
    const now = this.now();
    list.forEach((root, rootIndex) => {
      for (const group of this.groupTargets(collectScrambleTargets(root))) {
        let groupOffset = 0;
        const candidates = group.targets.map((target) => {
          const original = target.read();
          const candidate = {
            target, original, key: this.targetKey(target, root, rootIndex), offset: groupOffset,
          };
          groupOffset += original.length;
          return candidate;
        }).filter(({ key, original }) => {
          if (liveKeys.has(key)) return false;
          const previous = this.generations.get(key);
          return wasActive || previous?.original !== original;
        });
        if (candidates.length === 0) continue;
        const inherited = candidates.map(({ key, original }) => {
          const previous = this.generations.get(key);
          return previous?.original === original ? previous.startedAt : null;
        });
        const groupStartedAt = inherited.every((value) => value !== null)
          ? Math.min(...inherited) : now;
        for (const candidate of candidates) {
          const hold = this.holdFor(candidate.target.owner);
          hold.pending += 1;
          const record = {
            ...candidate,
            hold,
            group: { length: group.length, startedAt: groupStartedAt },
            letters: new Array(candidate.original.length),
            flipAt: new Array(candidate.original.length),
            front: -1, resolved: -1, written: candidate.original, live: true,
          };
          this.generations.set(candidate.key, {
            original: candidate.original, startedAt: groupStartedAt,
          });
          this.records.push(record);
          added.push(record);
        }
        this.reserve(group.element);
      }
    });
    if (added.length > 0) {
      if (!wasActive) {
        // This local landing run is intentionally independent of the already
        // completed page reveal; callers do not need to await decoration.
        new Promise((resolve) => { this.settle = resolve; });
      }
      if (this.frame !== null) this.cancelFrame(this.frame);
      this.step();
    }
  }

  /** Coherent blocks in review mode; legacy timing retains per-target behavior. */
  groupTargets(targets) {
    if (!Array.isArray(this.timing.durationAnchors)) {
      return targets.map((target) => ({
        element: target.owner, targets: [target], length: target.read().length,
      }));
    }
    const groups = new Map();
    for (const target of targets) {
      const group = groups.get(target.group) ?? { element: target.group, targets: [], length: 0 };
      group.targets.push(target);
      group.length += target.read().length;
      groups.set(target.group, group);
    }
    return [...groups.values()];
  }

  /** Stable enough across render replacement, scoped to one reveal root. */
  targetKey(target, root, rootIndex) {
    const node = target.kind === 'text' ? target.node : target.owner;
    const parts = [];
    let current = node;
    while (current && current !== root) {
      const parent = current.parentNode;
      if (!parent) break;
      parts.push(Array.prototype.indexOf.call(parent.childNodes, current));
      current = parent;
    }
    return `${rootIndex}:${target.kind}:${parts.reverse().join('.')}`;
  }

  holdFor(element) {
    let hold = this.holds.find((candidate) => candidate.element === element && !candidate.released);
    if (hold) return hold;
    hold = {
      element,
      saved: BUSY_ATTRIBUTES.map((name) => [name, element.getAttribute(name)]),
      pending: 0,
      released: false,
    };
    this.holds.push(hold);
    for (const name of BUSY_ATTRIBUTES) element.setAttribute(name, 'true');
    return hold;
  }

  reserve(element) {
    if (!Array.isArray(this.timing.durationAnchors) || this.reservations.has(element)
      || typeof element.getBoundingClientRect !== 'function' || !element.style) return;
    const rect = element.getBoundingClientRect();
    const control = ['input', 'textarea', 'select', 'button'].includes(tagOf(element));
    const property = control ? 'minWidth' : 'minHeight';
    const value = element.style[property] ?? '';
    if ((control ? rect.width : rect.height) > 0) {
      element.style[property] = `${control ? rect.width : rect.height}px`;
      this.reservations.set(element, { property, value });
    }
  }

  /** Stop now and restore every string and every owner. Idempotent. */
  cancel() {
    if (!this.active) return;
    if (this.frame !== null) this.cancelFrame(this.frame);
    this.conclude();
  }

  /** One frame for every target, then another frame or the end of the run. */
  step() {
    this.frame = null;
    const now = this.now();
    let pending = 0;
    for (const record of this.records) {
      if (record.live && this.advance(record, now - record.group.startedAt)) pending += 1;
    }
    if (pending === 0) this.conclude();
    else this.frame = this.requestFrame(() => this.step());
  }

  /**
   * Bring one target up to `elapsedMs`.
   *
   * @returns {boolean} whether this target still needs frames.
   */
  advance(record, elapsedMs) {
    const { target, original } = record;
    // Someone else now owns this string: a stale original would undo their work.
    if (target.read() !== record.written) {
      this.stop(record);
      return false;
    }
    // Re-rendered out of the document: put the real text back, in case it is
    // shown again, release its owner, and then never touch either.
    if (!target.connected()) {
      this.restore(record);
      return false;
    }

    const progress = scrambleProgress(record.group.length, elapsedMs, this.timing);
    const front = clamp(progress.front - record.offset, 0, original.length);
    const resolved = clamp(progress.resolved - record.offset, 0, original.length);
    const done = resolved === original.length;
    let changed = front !== record.front || resolved !== record.resolved;
    record.front = front;
    record.resolved = resolved;
    for (let index = resolved; index < front; index += 1) {
      // How far the lock front still has to travel to reach this letter, which
      // is what its flip speed reads.
      const remaining = index - resolved;
      if (record.letters[index] === undefined) {
        record.letters[index] = isWhitespace(original[index]) ? original[index] : this.draw();
        record.flipAt[index] = elapsedMs + flipInterval(remaining, this.timing);
        changed = true;
      } else if (!isWhitespace(original[index]) && elapsedMs >= record.flipAt[index]) {
        record.letters[index] = this.draw();
        record.flipAt[index] = elapsedMs + flipInterval(remaining, this.timing);
        changed = true;
      }
    }
    if (changed) this.write(record);
    // Locking the last character writes the original string, so a finished
    // target needs no restoring; its owner is free from this moment.
    if (done) this.stop(record);
    return !done;
  }

  /** One base letter. */
  draw() {
    const index = Math.floor(this.random() * SCRAMBLE_LETTERS.length);
    return SCRAMBLE_LETTERS[clamp(index, 0, SCRAMBLE_LETTERS.length - 1)];
  }

  /**
   * The target's visible string: the locked characters, then the flipping ones.
   * Nothing is written when the string has not changed.
   */
  write(record) {
    const { original, resolved, front } = record;
    const text = original.slice(0, resolved) + record.letters.slice(resolved, front).join('');
    if (text === record.written) return;
    record.target.write(text);
    record.written = text;
  }

  /** Put a target's original string back and stop animating it. */
  restore(record) {
    // Only when this run is still the last writer: a stale original would
    // otherwise undo whatever replaced it.
    if (record.target.read() === record.written) {
      record.target.write(record.original);
      record.written = record.original;
    }
    this.stop(record);
  }

  /** Stop animating one target, and free its owner if it was the last. */
  stop(record) {
    if (!record.live) return;
    record.live = false;
    record.hold.pending -= 1;
    if (record.hold.pending === 0) this.free(record.hold);
  }

  /** Give one owner back exactly the attributes it had before the run. */
  free(hold) {
    if (hold.released) return;
    hold.released = true;
    for (const [name, value] of hold.saved) {
      if (value === null) hold.element.removeAttribute(name);
      else hold.element.setAttribute(name, value);
    }
  }

  /** End the run: every string its own again, every owner as it was, promise kept. */
  conclude() {
    this.frame = null;
    for (const record of this.records) if (record.live) this.restore(record);
    // A hold whose targets all locked is already free; cancelling is what can
    // leave one standing, and no owner may keep these attributes after a run.
    for (const hold of this.holds) this.free(hold);
    for (const [element, { property, value }] of this.reservations) {
      element.style[property] = value;
    }
    const settle = this.settle;
    this.settle = null;
    this.records = [];
    this.holds = [];
    this.reservations.clear();
    settle();
  }
}

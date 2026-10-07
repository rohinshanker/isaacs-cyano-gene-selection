/**
 * A minimal document for rendering UI modules under Node.
 *
 * It models only what the renderers under test touch: element creation,
 * children, text, classes, data attributes, attributes, listeners, inline
 * styles, a recording 2-D canvas context, and a small query subset (tag,
 * `.class`, `tag.class`, and `tag[data-x="y"]`). Anything else throws, so a
 * renderer that grows a new DOM dependency fails loudly.
 */

/**
 * Whether `node` is still in the document, with real `isConnected` semantics.
 *
 * Each step up is checked against the parent's current children, so a node that
 * `replaceChildren` or a new `textContent` dropped reports itself disconnected
 * even though it still remembers the parent it used to be under.
 */
function isAttached(node) {
  let current = node;
  while (current.parentNode) {
    if (!current.parentNode.children.includes(current)) return false;
    current = current.parentNode;
  }
  return current === globalThis.document?.body;
}

export class FakeNode {
  constructor(text) {
    this.nodeType = 3;
    this.parentNode = null;
    this.textContent = text;
  }

  /** A text node's own text, which is what a DOM caller writes. */
  get data() { return this.textContent; }
  set data(text) { this.textContent = String(text); }

  get isConnected() { return isAttached(this); }
}

export class FakeElement {
  constructor(tagName, namespace = null) {
    this.nodeType = 1;
    this.tagName = tagName;
    this.namespace = namespace;
    this.children = [];
    this.attributes = {};
    this.dataset = {};
    this.listeners = {};
    this.parent = null;
    this.className = '';
    this.style = {};
    this.classList = {
      add: (...names) => { for (const name of names) if (!this.hasClass(name)) this.className = `${this.className} ${name}`.trim(); },
      remove: (...names) => { this.className = this.classes().filter((name) => !names.includes(name)).join(' '); },
      toggle: (name, force) => {
        const on = force === undefined ? !this.hasClass(name) : force;
        if (on) this.classList.add(name); else this.classList.remove(name);
        return on;
      },
      contains: (name) => this.hasClass(name),
    };
  }

  classes() { return this.className.split(/\s+/).filter(Boolean); }
  hasClass(name) { return this.classes().includes(name); }

  /** Every child, text nodes included, which is what a DOM walk reads. */
  get childNodes() { return this.children; }

  get parentNode() { return this.parent; }

  get isConnected() { return isAttached(this); }

  get textContent() {
    return this.children.map((child) => child.textContent).join('');
  }

  set textContent(text) {
    this.children = [];
    if (text !== '') this.append(String(text));
  }

  append(...nodes) {
    for (const node of nodes) {
      const child = typeof node === 'string' ? new FakeNode(node) : node;
      if (child instanceof FakeElement) child.parent = this;
      else child.parentNode = this;
      this.children.push(child);
    }
  }

  replaceChildren(...nodes) {
    this.children = [];
    this.append(...nodes);
  }

  insertBefore(node, reference) {
    if (reference !== null && !this.children.includes(reference)) {
      throw new Error('insertBefore reference is not a child');
    }
    if (node === reference) return node;
    const previous = node.parentNode;
    if (previous) previous.children = previous.children.filter((child) => child !== node);
    if (node instanceof FakeElement) node.parent = this;
    else node.parentNode = this;
    const index = reference === null ? this.children.length : this.children.indexOf(reference);
    this.children.splice(index, 0, node);
    return node;
  }

  /**
   * A 2-D context that records its fills, so a caller drawing a ramp can be
   * checked against the buckets it was given. Any other element, or any other
   * context kind, throws: a renderer that starts drawing somewhere new fails.
   */
  getContext(kind) {
    if (this.tagName !== 'canvas') throw new Error(`getContext on <${this.tagName}>`);
    if (kind !== '2d') throw new Error(`fake-dom has no ${kind} context`);
    const fills = [];
    this.fills = fills;
    let fillStyle = '';
    return {
      setTransform: () => {},
      clearRect: () => { fills.length = 0; },
      get fillStyle() { return fillStyle; },
      set fillStyle(value) { fillStyle = value; },
      fillRect: (x, y, width, height) => fills.push({ x, y, width, height, fill: fillStyle }),
    };
  }

  remove() {
    if (!this.parent) return;
    this.parent.children = this.parent.children.filter((child) => child !== this);
    this.parent = null;
  }

  setAttribute(name, value) { this.attributes[name] = String(value); }
  getAttribute(name) { return this.attributes[name] ?? null; }
  removeAttribute(name) { delete this.attributes[name]; }
  addEventListener(type, listener) { (this.listeners[type] ??= []).push(listener); }
  dispatch(type, event = {}) { for (const listener of this.listeners[type] ?? []) listener(event); }
  focus() {
    this.focused = true;
    // A modal's whole contract is where focus goes, so the fake tracks the
    // active element rather than discarding the call.
    if (globalThis.document && 'activeElement' in globalThis.document) {
      globalThis.document.activeElement = this;
    }
  }

  contains(node) {
    if (!node) return false;
    if (node === this) return true;
    return this.children.some((child) => child instanceof FakeElement && child.contains(node));
  }

  /** Every descendant element, depth first. */
  descendants() {
    return this.children.flatMap((child) => (child instanceof FakeElement
      ? [child, ...child.descendants()] : []));
  }

  querySelectorAll(selector) {
    return this.descendants().filter((node) => node.matches(selector));
  }

  querySelector(selector) {
    return this.querySelectorAll(selector)[0] ?? null;
  }

  matches(selector) {
    const match = /^([a-z]*)(?:\.([\w-]+))?(?:\[data-([\w-]+)="([^"]*)"\])?$/i.exec(selector);
    if (!match) throw new Error(`fake-dom cannot match selector ${selector}`);
    const [, tag, className, dataKey, dataValue] = match;
    if (tag && this.tagName !== tag) return false;
    if (className && !this.hasClass(className)) return false;
    if (dataKey) {
      const key = dataKey.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
      if (this.dataset[key] !== dataValue) return false;
    }
    return true;
  }
}

/** A `document` for `globalThis`; install it for the duration of a test. */
export function fakeDocument() {
  const document = {
    activeElement: null,
    body: new FakeElement('body'),
    createElement: (tag) => new FakeElement(tag),
    createElementNS: (namespace, tag) => new FakeElement(tag, namespace),
    createTextNode: (text) => new FakeNode(String(text)),
    querySelector: (selector) => document.body.querySelector(selector),
    querySelectorAll: (selector) => document.body.querySelectorAll(selector),
  };
  return document;
}

/**
 * Run `body` with a fake `document` and `window` installed, restoring whatever
 * was there. The window carries only `devicePixelRatio`, which is what a
 * renderer sizing a canvas backing store reads; `devicePixelRatio: 2` is the
 * interesting case, because a backing store that ignored it would still look
 * right at 1.
 */
export async function withFakeDocument(body, { devicePixelRatio = 1 } = {}) {
  const previous = { document: globalThis.document, window: globalThis.window };
  const document = fakeDocument();
  globalThis.document = document;
  globalThis.window = { devicePixelRatio };
  try {
    return await body(document);
  } finally {
    globalThis.document = previous.document;
    globalThis.window = previous.window;
  }
}

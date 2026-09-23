/**
 * A minimal document for rendering UI modules under Node.
 *
 * It models only what the renderers under test touch: element creation,
 * children, text, classes, data attributes, attributes, listeners, and a small
 * query subset (tag, `.class`, `tag.class`, and `tag[data-x="y"]`). Anything
 * else throws, so a renderer that grows a new DOM dependency fails loudly.
 */
export class FakeNode {
  constructor(text) {
    this.nodeType = 3;
    this.textContent = text;
  }
}

export class FakeElement {
  constructor(tagName, namespace = null) {
    this.tagName = tagName;
    this.namespace = namespace;
    this.children = [];
    this.attributes = {};
    this.dataset = {};
    this.listeners = {};
    this.parent = null;
    this.className = '';
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

  get textContent() {
    return this.children.map((child) => child.textContent).join('');
  }

  set textContent(text) {
    this.children = text === '' ? [] : [new FakeNode(String(text))];
  }

  append(...nodes) {
    for (const node of nodes) {
      const child = typeof node === 'string' ? new FakeNode(node) : node;
      if (child instanceof FakeElement) child.parent = this;
      this.children.push(child);
    }
  }

  replaceChildren(...nodes) {
    this.children = [];
    this.append(...nodes);
  }

  remove() {
    if (!this.parent) return;
    this.parent.children = this.parent.children.filter((child) => child !== this);
    this.parent = null;
  }

  setAttribute(name, value) { this.attributes[name] = String(value); }
  getAttribute(name) { return this.attributes[name] ?? null; }
  addEventListener(type, listener) { (this.listeners[type] ??= []).push(listener); }
  dispatch(type, event = {}) { for (const listener of this.listeners[type] ?? []) listener(event); }
  focus() { this.focused = true; }

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
  return {
    activeElement: null,
    createElement: (tag) => new FakeElement(tag),
    createElementNS: (namespace, tag) => new FakeElement(tag, namespace),
    createTextNode: (text) => new FakeNode(String(text)),
  };
}

/** Run `body` with a fake document installed, restoring whatever was there. */
export async function withFakeDocument(body) {
  const previous = globalThis.document;
  const document = fakeDocument();
  globalThis.document = document;
  try {
    return await body(document);
  } finally {
    globalThis.document = previous;
  }
}

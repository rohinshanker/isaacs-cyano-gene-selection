/** Instant, delegated replacements for native HTML and SVG title hints. */

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';
const POINTER_OFFSET = 12;
const VIEWPORT_EDGE = 8;

/** Every element below `root`, including `root` when it is an element. */
function* elementsIn(root) {
  if (root?.nodeType === 1) yield root;
  for (const child of root?.children ?? []) yield* elementsIn(child);
}

function isSvgTitle(node) {
  return node?.nodeType === 1
    && String(node.tagName).toLowerCase() === 'title'
    && (node.parentNode?.namespaceURI === SVG_NAMESPACE
      || node.parentNode?.namespace === SVG_NAMESPACE);
}

function describedByTokens(element) {
  return (element.getAttribute('aria-describedby') ?? '').split(/\s+/).filter(Boolean);
}

/** Clamp a mouse-following hint beside the pointer and inside the viewport. */
export function hintPosition(pointer, size, viewport) {
  const right = pointer.clientX + POINTER_OFFSET;
  const below = pointer.clientY + POINTER_OFFSET;
  const left = pointer.clientX - POINTER_OFFSET - size.width;
  const above = pointer.clientY - POINTER_OFFSET - size.height;
  return {
    left: Math.max(VIEWPORT_EDGE,
      Math.min(right + size.width <= viewport.width - VIEWPORT_EDGE ? right : left,
        viewport.width - size.width - VIEWPORT_EDGE)),
    top: Math.max(VIEWPORT_EDGE,
      Math.min(below + size.height <= viewport.height - VIEWPORT_EDGE ? below : above,
        viewport.height - size.height - VIEWPORT_EDGE)),
  };
}

/**
 * One body-level hint and one set of delegated listeners for the whole page.
 *
 * Existing renderers keep writing their title text. A mutation observer moves
 * that text into this controller immediately after each render, preventing a
 * second, delayed platform tooltip without duplicating any wording here.
 */
export class InstantHints {
  constructor(page = document, view = window, Observer = MutationObserver) {
    this.page = page;
    this.view = view;
    this.Observer = Observer;
    this.records = new Map();
    this.nativeRemovalPending = new WeakSet();
    this.suppressed = new WeakSet();
    this.active = null;
    this.hovered = null;
    this.sequence = 0;
    this.listeners = [];
  }

  install() {
    this.tooltip = this.page.createElement('div');
    this.tooltip.className = 'instant-hint';
    this.tooltip.setAttribute('role', 'tooltip');
    this.tooltip.hidden = true;
    this.page.body.append(this.tooltip);

    this.scan(this.page.body);
    this.observer = new this.Observer((mutations) => this.changed(mutations));
    this.observer.observe(this.page.body, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeOldValue: true,
      attributeFilter: ['title', 'hidden', 'class', 'style', 'open', 'aria-hidden'],
    });

    this.listen(this.page, 'pointerover', (event) => this.pointerOver(event));
    this.listen(this.page, 'pointermove', (event) => this.pointerMove(event));
    this.listen(this.page, 'pointerout', (event) => this.pointerOut(event));
    this.listen(this.page, 'pointerdown', (event) => this.pointerDown(event));
    this.listen(this.page, 'pointercancel', () => this.hide());
    this.listen(this.page, 'click', (event) => this.click(event), true);
    this.listen(this.page, 'focusin', (event) => this.focusIn(event));
    this.listen(this.page, 'focusout', (event) => this.focusOut(event));
    this.listen(this.page, 'keydown', (event) => {
      if (event.key === 'Escape') this.hide();
    });
    this.listen(this.page, 'scroll', () => this.hide(), true);
    this.listen(this.view, 'scroll', () => this.hide(), true);
    this.listen(this.view, 'resize', () => this.hide());
    this.listen(this.view, 'hashchange', () => this.hide());
    this.listen(this.view, 'popstate', () => this.hide());
    this.listen(this.page, 'visibilitychange', () => {
      if (this.page.hidden) this.hide();
    });
    return this;
  }

  listen(target, type, listener, options = false) {
    target.addEventListener(type, listener, options);
    this.listeners.push({ target, type, listener, options });
  }

  destroy() {
    this.hide();
    this.observer?.disconnect();
    for (const { target, type, listener, options } of this.listeners) {
      target.removeEventListener(type, listener, options);
    }
    this.listeners = [];
    for (const trigger of [...this.records.keys()]) this.forget(trigger);
    this.tooltip?.remove();
  }

  scan(root) {
    for (const element of elementsIn(root)) {
      if (element.getAttribute?.('title') !== null) this.convertHtmlTitle(element);
      if (isSvgTitle(element)) this.convertSvgTitle(element);
    }
  }

  convertHtmlTitle(trigger) {
    const text = trigger.getAttribute('title');
    if (text) this.remember(trigger, text);
    else this.forget(trigger);
    this.nativeRemovalPending.add(trigger);
    trigger.removeAttribute('title');
  }

  convertSvgTitle(title) {
    const trigger = title.parentNode;
    if (title.textContent) this.remember(trigger, title.textContent);
    else this.forget(trigger);
    title.remove();
  }

  remember(trigger, text) {
    const existing = this.records.get(trigger);
    if (existing?.text === text) return;
    const activePointer = this.active?.trigger === trigger ? this.active.pointer : null;
    if (existing?.description) {
      const tokens = describedByTokens(trigger).filter((id) => id !== existing.description.id);
      if (tokens.length > 0) trigger.setAttribute('aria-describedby', tokens.join(' '));
      else trigger.removeAttribute('aria-describedby');
      existing.description.remove();
    }

    const alreadyExposed = trigger.getAttribute('aria-label') === text
      || trigger.getAttribute('aria-description') === text;
    let description = null;
    if (!alreadyExposed) {
      description = this.page.createElement('span');
      description.className = 'instant-hint-description';
      description.id = `instant-hint-description-${++this.sequence}`;
      description.textContent = text;
      description.hidden = true;
      this.page.body.append(description);
      const tokens = describedByTokens(trigger);
      if (!tokens.includes(description.id)) tokens.push(description.id);
      trigger.setAttribute('aria-describedby', tokens.join(' '));
    }
    this.records.set(trigger, { text, description });
    if (activePointer) this.show(trigger, activePointer);
  }

  forget(trigger) {
    const record = this.records.get(trigger);
    if (!record) return;
    if (this.active?.trigger === trigger) this.hide();
    if (record.description) {
      const tokens = describedByTokens(trigger).filter((id) => id !== record.description.id);
      if (tokens.length > 0) trigger.setAttribute('aria-describedby', tokens.join(' '));
      else trigger.removeAttribute('aria-describedby');
      record.description.remove();
    }
    this.records.delete(trigger);
    this.suppressed.delete(trigger);
    if (this.hovered === trigger) this.hovered = null;
  }

  changed(mutations) {
    for (const mutation of mutations) {
      if (mutation.type === 'attributes' && mutation.attributeName === 'title') {
        const trigger = mutation.target;
        if (trigger.getAttribute('title') === null && this.nativeRemovalPending.has(trigger)) {
          this.nativeRemovalPending.delete(trigger);
        } else if (trigger.getAttribute('title') !== null) {
          this.convertHtmlTitle(trigger);
        } else {
          this.forget(trigger);
        }
      } else if (mutation.type === 'childList') {
        for (const node of mutation.addedNodes ?? []) this.scan(node);
        for (const node of mutation.removedNodes ?? []) this.cleanupRemoved(node);
        if (isSvgTitle(mutation.target)) this.convertSvgTitle(mutation.target);
      } else if (mutation.type === 'characterData' && isSvgTitle(mutation.target.parentNode)) {
        this.convertSvgTitle(mutation.target.parentNode);
      }
    }
    this.reconcileActive();
  }

  cleanupRemoved(root) {
    for (const trigger of [...this.records.keys()]) {
      if (!trigger.isConnected && (root === trigger || root.contains?.(trigger))) this.forget(trigger);
    }
  }

  reconcileActive() {
    if (this.active && (!this.active.trigger.isConnected || !this.visible(this.active.trigger))) {
      this.hide();
    }
  }

  visible(trigger) {
    if (trigger.hidden) return false;
    if (typeof trigger.getClientRects !== 'function') return true;
    return trigger.getClientRects().length > 0;
  }

  triggerAt(node) {
    for (let current = node; current; current = current.parentNode) {
      if (this.records.has(current)) return current;
    }
    return null;
  }

  pointerOver(event) {
    const trigger = this.triggerAt(event.target);
    if (!trigger) return;
    if (event.relatedTarget && trigger.contains(event.relatedTarget)) return;
    this.hovered = trigger;
    if (!this.suppressed.has(trigger)) this.show(trigger, event);
  }

  pointerMove(event) {
    const trigger = this.triggerAt(event.target);
    if (!trigger || this.suppressed.has(trigger)) return;
    this.hovered = trigger;
    this.show(trigger, event);
  }

  pointerOut(event) {
    const trigger = this.triggerAt(event.target);
    if (!trigger || (event.relatedTarget && trigger.contains(event.relatedTarget))) return;
    this.suppressed.delete(trigger);
    if (this.hovered === trigger) this.hovered = null;
    if (this.active?.trigger === trigger) this.hide();
  }

  pointerDown(event) {
    if (event.pointerType === 'mouse') return;
    const trigger = this.triggerAt(event.target);
    if (trigger && !this.suppressed.has(trigger)) this.show(trigger, event);
  }

  click(event) {
    const trigger = this.triggerAt(event.target);
    if (!trigger || this.active?.trigger !== trigger) return;
    this.suppressed.add(trigger);
    this.hide();
  }

  focusIn(event) {
    const trigger = this.triggerAt(event.target);
    if (trigger && !this.suppressed.has(trigger)) this.show(trigger, this.elementPointer(trigger));
  }

  focusOut(event) {
    const trigger = this.triggerAt(event.target);
    if (!trigger || (event.relatedTarget && trigger.contains(event.relatedTarget))) return;
    if (this.hovered !== trigger) this.suppressed.delete(trigger);
    if (this.active?.trigger === trigger) this.hide();
  }

  elementPointer(trigger) {
    const bounds = trigger.getBoundingClientRect();
    return { clientX: bounds.left + bounds.width / 2, clientY: bounds.bottom };
  }

  show(trigger, pointer) {
    if (!this.visible(trigger)) return;
    const record = this.records.get(trigger);
    if (!record) return;
    this.tooltip.textContent = record.text;
    this.tooltip.hidden = false;
    this.active = {
      trigger,
      pointer: { clientX: pointer.clientX, clientY: pointer.clientY },
    };
    this.position(this.active.pointer);
  }

  position(pointer) {
    const bounds = this.tooltip.getBoundingClientRect?.() ?? {
      width: this.tooltip.offsetWidth, height: this.tooltip.offsetHeight,
    };
    const position = hintPosition(pointer, bounds, {
      width: this.view.innerWidth, height: this.view.innerHeight,
    });
    this.tooltip.style.left = `${position.left}px`;
    this.tooltip.style.top = `${position.top}px`;
  }

  hide() {
    if (!this.tooltip) return;
    this.tooltip.hidden = true;
    this.active = null;
  }
}

/** Install the site's single delegated hint controller. */
export function installInstantHints(page = document, view = window,
  Observer = MutationObserver) {
  return new InstantHints(page, view, Observer).install();
}

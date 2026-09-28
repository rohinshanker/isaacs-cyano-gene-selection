/**
 * Collapsing and reordering for the controls column.
 *
 * The order and the collapsed set are view state, so they live in the URL like
 * everything else the page shows: a colleague opening a shared link sees the
 * column arranged the way it was arranged for them. The rules themselves are in
 * `core/left-panels.js`; this file is only the DOM.
 *
 * Reordering works from buttons as well as from a drag. A drag alone would put
 * the feature out of reach of a keyboard, and the buttons are also what the
 * tests exercise, since a synthetic drag proves much less than a real one.
 */
import {
  LEFT_PANELS, normalizePanelOrder, normalizeCollapsed, movePanel, reorderPanel,
  toggleCollapsed, panelTitle,
} from '../core/left-panels.js';

function caret() {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'panel-caret');
  svg.setAttribute('viewBox', '0 0 12 8');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', 'M1 1.5 6 6.5 11 1.5');
  path.setAttribute('fill', 'none');
  path.setAttribute('stroke', 'currentColor');
  path.setAttribute('stroke-width', '1.6');
  path.setAttribute('stroke-linecap', 'round');
  path.setAttribute('stroke-linejoin', 'round');
  svg.append(path);
  return svg;
}

function moveButton(direction, title) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `panel-move panel-move-${direction}`;
  button.dataset.move = direction;
  button.textContent = direction === 'up' ? '↑' : '↓';
  button.setAttribute('aria-label', `Move ${title} ${direction}`);
  button.title = `Move ${title} ${direction}`;
  return button;
}

export class LeftPanels {
  /**
   * @param {HTMLElement} column the controls column.
   * @param {{onChange: (layout: {order: string[], collapsed: string[]}) => void,
   *          announce?: (message: string) => void}} handlers
   */
  constructor(column, handlers = {}) {
    this.column = column;
    this.handlers = handlers;
    this.order = [];
    this.collapsed = [];
    this.drag = null;
    this.cards = new Map();
    for (const panel of LEFT_PANELS) {
      const card = column.querySelector(`[data-panel-id="${panel.id}"]`);
      if (card) this.cards.set(panel.id, this.decorate(card, panel));
    }
  }

  /** Wrap one existing card with its collapse control and move buttons. */
  decorate(card, panel) {
    const heading = card.querySelector('h2');
    const body = card.querySelector('[data-panel-body]');
    const head = document.createElement('div');
    head.className = 'panel-head';

    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'panel-toggle';
    toggle.id = `panel-toggle-${panel.id}`;
    toggle.setAttribute('aria-controls', body.id);
    const title = document.createElement('span');
    title.className = 'panel-title';
    title.textContent = panel.title;
    toggle.append(caret(), title);
    toggle.addEventListener('click', () => this.setCollapsed(panel.id, !this.isCollapsed(panel.id)));

    const controls = document.createElement('div');
    controls.className = 'panel-controls';
    const up = moveButton('up', panel.title);
    const down = moveButton('down', panel.title);
    up.addEventListener('click', () => this.move(panel.id, -1));
    down.addEventListener('click', () => this.move(panel.id, 1));
    const grip = document.createElement('span');
    grip.className = 'panel-grip';
    grip.setAttribute('aria-hidden', 'true');
    grip.title = `Drag to reorder ${panel.title}`;
    controls.append(grip, up, down);

    head.append(toggle, controls);
    if (heading) heading.remove();
    card.prepend(head);
    card.setAttribute('aria-labelledby', toggle.id);
    this.installDrag(card, grip, panel.id);
    return {
      card, head, toggle, body, up, down, grip, title: panel.title,
    };
  }

  isCollapsed(id) {
    return this.collapsed.includes(id);
  }

  /** Apply an order and collapsed set from state, without emitting a change. */
  apply({ order, collapsed }) {
    this.order = normalizePanelOrder(order);
    this.collapsed = normalizeCollapsed(collapsed);
    this.render();
  }

  render() {
    for (const id of this.order) {
      const entry = this.cards.get(id);
      if (!entry) continue;
      // Appending in order is what reorders the column: each append moves the
      // existing node rather than copying it, so listeners and focus survive.
      this.column.append(entry.card);
    }
    const positions = this.order.filter((id) => this.cards.has(id));
    positions.forEach((id, index) => {
      const entry = this.cards.get(id);
      const collapsed = this.isCollapsed(id);
      entry.card.classList.toggle('panel-collapsed', collapsed);
      entry.toggle.setAttribute('aria-expanded', String(!collapsed));
      entry.body.hidden = collapsed;
      entry.up.disabled = index === 0;
      entry.down.disabled = index === positions.length - 1;
      entry.card.dataset.panelPosition = String(index + 1);
      entry.toggle.title = collapsed ? `Expand ${entry.title}` : `Collapse ${entry.title}`;
    });
  }

  emit() {
    this.handlers.onChange?.({ order: [...this.order], collapsed: [...this.collapsed] });
  }

  setCollapsed(id, collapsed) {
    this.collapsed = toggleCollapsed(this.collapsed, id, collapsed);
    this.render();
    this.emit();
  }

  move(id, delta) {
    const next = movePanel(this.order, id, delta);
    if (next.every((value, i) => value === this.order[i])) return;
    this.order = next;
    this.render();
    this.emit();
    const entry = this.cards.get(id);
    // Keep focus on the control that was pressed. It may now be disabled at an
    // end of the column, in which case focus moves to its partner rather than
    // being lost to the document.
    const button = delta < 0 ? entry.up : entry.down;
    const fallback = delta < 0 ? entry.down : entry.up;
    (button.disabled ? fallback : button).focus({ preventScroll: true });
    const position = this.order.indexOf(id) + 1;
    this.handlers.announce?.(`${entry.title} moved to position ${position} of ${this.order.length}.`);
  }

  /**
   * Pointer reordering, as an alternative to the move buttons.
   *
   * The move and release listeners live on the window, not on the grip.
   * Reordering re-appends the dragged card, and moving an element in the DOM
   * drops its pointer capture, so a grip-bound release would simply never
   * arrive: the drag would hang with the card still marked and the new order
   * never saved. That was observed, not theorised.
   */
  installDrag(card, grip, id) {
    const onMove = (event) => {
      if (this.drag?.pointerId !== event.pointerId) return;
      const target = this.indexAt(event.clientY);
      if (target === null) return;
      const next = reorderPanel(this.order, id, target);
      if (next.every((value, i) => value === this.order[i])) return;
      this.order = next;
      this.render();
    };
    const finish = (event) => {
      if (this.drag?.pointerId !== event.pointerId) return;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', finish);
      window.removeEventListener('pointercancel', finish);
      card.classList.remove('panel-dragging');
      const moved = this.drag.startOrder.some((value, i) => value !== this.order[i]);
      this.drag = null;
      if (moved) this.emit();
    };
    grip.addEventListener('pointerdown', (event) => {
      if (event.button !== 0 || this.drag) return;
      event.preventDefault();
      this.drag = { id, pointerId: event.pointerId, startOrder: [...this.order] };
      card.classList.add('panel-dragging');
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', finish);
      window.addEventListener('pointercancel', finish);
    });
  }

  /** Which slot a pointer at `clientY` is over, by card midpoints. */
  indexAt(clientY) {
    const visible = this.order.filter((id) => this.cards.has(id));
    for (let i = 0; i < visible.length; i += 1) {
      const box = this.cards.get(visible[i]).card.getBoundingClientRect();
      if (clientY < box.top + box.height / 2) return i;
    }
    return visible.length - 1;
  }

  /** The host a panel's content is rendered into. */
  bodyFor(id) {
    return this.cards.get(id)?.body ?? null;
  }
}

export { panelTitle };

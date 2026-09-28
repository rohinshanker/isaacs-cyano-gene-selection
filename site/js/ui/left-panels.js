/**
 * Collapsing and reordering for the controls column.
 *
 * The order and the collapsed set are view state, so they live in the URL like
 * everything else the page shows: a colleague opening a shared link sees the
 * column arranged the way it was arranged for them. The rules themselves are in
 * `core/left-panels.js`; this file is only the DOM.
 *
 * Reordering is by button only. The buttons work from a keyboard, announce
 * where the panel landed, and say at a glance which moves are available by
 * disabling themselves at the ends of the column.
 */
import {
  LEFT_PANELS, normalizePanelOrder, normalizeCollapsed, movePanel,
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
    controls.append(up, down);

    head.append(toggle, controls);
    if (heading) heading.remove();
    card.prepend(head);
    card.setAttribute('aria-labelledby', toggle.id);
    return {
      card, head, toggle, body, up, down, title: panel.title,
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

  /** The host a panel's content is rendered into. */
  bodyFor(id) {
    return this.cards.get(id)?.body ?? null;
  }
}

export { panelTitle };

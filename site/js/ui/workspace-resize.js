/** Pointer and keyboard resizing for the desktop analysis workspace. */

export const PANEL_WIDTH_STORAGE_KEY = 'cyano.panel-widths.v1';
export const PANEL_MIN_WIDTH = 260;
export const MAP_MIN_WIDTH = 400;

/** Clamp saved or requested rail widths while reserving a usable map. */
export function clampPanelWidths(requested, innerWidth, columns, gap = 16) {
  if (columns !== 2 && columns !== 3) return null;
  const available = innerWidth - (columns - 1) * gap;
  const defaultLeft = columns === 3 ? 280 : 300;
  const minimumRight = columns === 3 ? PANEL_MIN_WIDTH : 0;
  const leftMaximum = Math.max(PANEL_MIN_WIDTH, available - MAP_MIN_WIDTH - minimumRight);
  const numberOr = (value, fallback) => Number.isFinite(value) ? value : fallback;
  const clamp = (value, low, high) => Math.round(Math.min(high, Math.max(low, value)));
  const left = clamp(numberOr(requested?.left, defaultLeft), PANEL_MIN_WIDTH, leftMaximum);
  if (columns === 2) {
    return { left, leftMaximum, right: null, rightMaximum: null };
  }
  const rightMaximum = Math.max(PANEL_MIN_WIDTH, available - left - MAP_MIN_WIDTH);
  const right = clamp(numberOr(requested?.right, 320), PANEL_MIN_WIDTH, rightMaximum);
  return { left, leftMaximum, right, rightMaximum };
}

/** Determine which desktop handles exist for the current view and viewport. */
export function workspaceColumns(width, classList) {
  if (classList.contains('citations-active') || classList.contains('regulatory-active')) return 0;
  if (width < 960) return 0;
  if (width < 1240 || classList.contains('lengths-active')) return 2;
  return 3;
}

export class WorkspaceResizer {
  /** @param {HTMLElement} layout @param {object} controls DOM and storage adapter. */
  constructor(layout, { leftHandle, rightHandle, resetButton, storage }) {
    this.layout = layout;
    this.leftHandle = leftHandle;
    this.rightHandle = rightHandle;
    this.resetButton = resetButton;
    this.storage = storage;
    const saved = storage.read(PANEL_WIDTH_STORAGE_KEY, null);
    this.requested = saved && typeof saved === 'object' && !Array.isArray(saved)
      ? { left: saved.left, right: saved.right } : { left: null, right: null };
    this.drag = null;
    this.boundUpdate = () => this.update();
    window.addEventListener('resize', this.boundUpdate);
    this.observer = new ResizeObserver(this.boundUpdate);
    this.observer.observe(layout);
    this.installHandle(leftHandle, 'left');
    this.installHandle(rightHandle, 'right');
    resetButton.addEventListener('click', () => this.reset());
    this.update();
  }

  /** Width inside the layout padding, matching the CSS grid's available space. */
  innerWidth() {
    const style = getComputedStyle(this.layout);
    return this.layout.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
  }

  gap() {
    // Read the rendered track: --gap is a rem value, not a pixel value.
    return this.leftHandle.getBoundingClientRect().width || 16;
  }

  /** Recompute clamps on viewport, tab, and stored-width changes. */
  update() {
    const columns = workspaceColumns(window.innerWidth, this.layout.classList);
    this.leftHandle.hidden = columns < 2;
    this.rightHandle.hidden = columns < 3;
    this.resetButton.hidden = columns < 2;
    if (!columns) {
      this.layout.style.removeProperty('--controls-width');
      this.layout.style.removeProperty('--detail-width');
      this.widths = null;
      return;
    }
    const widths = clampPanelWidths(this.requested, this.innerWidth(), columns, this.gap());
    this.widths = widths;
    this.layout.style.setProperty('--controls-width', `${widths.left}px`);
    if (columns === 3) this.layout.style.setProperty('--detail-width', `${widths.right}px`);
    else this.layout.style.removeProperty('--detail-width');
    this.leftHandle.setAttribute('aria-valuemin', String(PANEL_MIN_WIDTH));
    this.leftHandle.setAttribute('aria-valuemax', String(widths.leftMaximum));
    this.leftHandle.setAttribute('aria-valuenow', String(widths.left));
    this.leftHandle.setAttribute('aria-valuetext', `Controls ${widths.left} pixels wide`);
    if (columns === 3) {
      this.rightHandle.setAttribute('aria-valuemin', String(PANEL_MIN_WIDTH));
      this.rightHandle.setAttribute('aria-valuemax', String(widths.rightMaximum));
      this.rightHandle.setAttribute('aria-valuenow', String(widths.right));
      this.rightHandle.setAttribute('aria-valuetext', `Gene detail ${widths.right} pixels wide`);
    }
  }

  /** Save only a completed pointer or keyboard adjustment. */
  save() {
    if (!this.widths) return;
    this.requested = {
      left: this.widths.left,
      right: this.widths.right ?? this.requested.right,
    };
    this.storage.write(PANEL_WIDTH_STORAGE_KEY, this.requested);
  }

  reset() {
    this.requested = { left: null, right: null };
    this.storage.write(PANEL_WIDTH_STORAGE_KEY, null);
    this.update();
  }

  installHandle(handle, side) {
    handle.addEventListener('pointerdown', (event) => {
      if (event.button !== 0 || handle.hidden || !this.widths) return;
      event.preventDefault();
      handle.setPointerCapture(event.pointerId);
      handle.classList.add('dragging');
      this.drag = {
        side,
        pointerId: event.pointerId,
        startX: event.clientX,
        startWidth: side === 'left' ? this.widths.left : this.widths.right,
        previous: { ...this.requested },
      };
    });
    handle.addEventListener('pointermove', (event) => {
      if (!this.drag || this.drag.side !== side || this.drag.pointerId !== event.pointerId) return;
      const delta = event.clientX - this.drag.startX;
      this.requested[side] = this.drag.startWidth + (side === 'left' ? delta : -delta);
      this.update();
    });
    const finish = (event, canceled) => {
      if (!this.drag || this.drag.side !== side || this.drag.pointerId !== event.pointerId) return;
      handle.classList.remove('dragging');
      if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId);
      if (canceled) {
        this.requested = this.drag.previous;
        this.update();
      } else {
        this.save();
      }
      this.drag = null;
    };
    handle.addEventListener('pointerup', (event) => finish(event, false));
    handle.addEventListener('pointercancel', (event) => finish(event, true));
    handle.addEventListener('keydown', (event) => {
      if (handle.hidden || !this.widths) return;
      const width = side === 'left' ? this.widths.left : this.widths.right;
      const maximum = side === 'left' ? this.widths.leftMaximum : this.widths.rightMaximum;
      const step = event.shiftKey ? 48 : 16;
      let next;
      if (event.key === 'Home') next = PANEL_MIN_WIDTH;
      else if (event.key === 'End') next = maximum;
      else if (event.key === 'ArrowRight') next = width + (side === 'left' ? step : -step);
      else if (event.key === 'ArrowLeft') next = width + (side === 'left' ? -step : step);
      else return;
      event.preventDefault();
      this.requested[side] = next;
      this.update();
      this.save();
    });
  }
}

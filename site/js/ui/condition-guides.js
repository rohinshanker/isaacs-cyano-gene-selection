/** Decorative column guides, aligned to the rendered header ticks and footer. */
const SVG = 'http://www.w3.org/2000/svg';

/** Convert header SVG coordinates to the visible list's viewport coordinates. */
export function guideGeometry({ list, track, count, ticks, axisWidth }) {
  const top = Math.max(list.top, track.bottom - 1);
  const height = count.bottom - top;
  if (list.width <= 0 || track.width <= 0 || axisWidth <= 0 || height <= 0) return null;
  return {
    left: list.left, top, width: list.width, height,
    ticks: ticks.map((x) => track.left - list.left + x * track.width / axisWidth)
      .filter((x) => x >= 0 && x <= list.width),
  };
}

/** One non-interactive overlay per data selection dialog; no timers or animation. */
export class ConditionGuides {
  constructor({ dialog, list, count, viewport = globalThis.window,
    Observer = globalThis.ResizeObserver }) {
    this.list = list;
    this.count = count;
    this.viewport = viewport;
    this.Observer = Observer;
    this.axis = null;
    this.pointer = null;
    this.overlay = document.createElementNS(SVG, 'svg');
    this.overlay.setAttribute('class', 'ds-column-guides');
    this.overlay.setAttribute('aria-hidden', 'true');
    this.overlay.setAttribute('hidden', '');
    dialog.append(this.overlay);
    this.refresh = () => this.update();
    const move = (event) => {
      if (event.pointerType === 'touch') return;
      this.pointer = { x: event.clientX, y: event.clientY };
      this.update();
    };
    list.addEventListener('pointerover', move);
    list.addEventListener('pointermove', move);
    list.addEventListener('pointerleave', () => this.clear());
    list.addEventListener('scroll', this.refresh);
  }

  clear() {
    this.axis = null;
    this.pointer = null;
    this.overlay.setAttribute('hidden', '');
    this.overlay.replaceChildren();
    this.observer?.disconnect();
    this.observer = null;
    this.viewport?.removeEventListener?.('resize', this.refresh);
  }

  update() {
    if (!this.pointer) return;
    const list = this.list.getBoundingClientRect();
    const { x, y } = this.pointer;
    const header = [...this.list.querySelectorAll('.ds-axis-header')].find((node) => {
      const rect = node.getBoundingClientRect();
      return x >= rect.left && x < rect.right;
    });
    if (!header || x < list.left || x >= list.right || y < list.top || y >= list.bottom) {
      this.clear();
      return;
    }
    const track = header.querySelector('svg');
    const geometry = guideGeometry({
      list, track: track.getBoundingClientRect(), count: this.count.getBoundingClientRect(),
      ticks: [...track.querySelectorAll('line')].map((line) => Number(line.getAttribute('x1'))),
      axisWidth: Number(track.getAttribute('width')),
    });
    if (!geometry) { this.clear(); return; }
    this.axis = header.getAttribute('data-condition-axis');
    this.overlay.setAttribute('data-condition-axis', this.axis);
    this.overlay.setAttribute('viewBox', `0 0 ${geometry.width} ${geometry.height}`);
    Object.assign(this.overlay.style, {
      left: `${geometry.left}px`, top: `${geometry.top}px`,
      width: `${geometry.width}px`, height: `${geometry.height}px`,
    });
    this.overlay.replaceChildren(...geometry.ticks.map((x) => {
      const line = document.createElementNS(SVG, 'line');
      for (const [name, value] of Object.entries({ x1: x, x2: x, y1: 0, y2: geometry.height })) {
        line.setAttribute(name, String(value));
      }
      return line;
    }));
    this.overlay.removeAttribute('hidden');
    if (!this.observer && this.Observer) {
      this.observer = new this.Observer(this.refresh);
      for (const node of [this.list, this.count, header]) this.observer.observe(node);
    }
    this.viewport?.addEventListener?.('resize', this.refresh);
  }
}

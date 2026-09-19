/**
 * Canvas scatter plot for the gene maps.
 *
 * One canvas draws every gene. At a few thousand points a DOM node per gene is
 * far too slow to pan, so points are batched by quantized colour and drawn as
 * rectangles, and hit testing is a linear scan in screen space, which costs
 * microseconds at this size.
 */
import { GHOST_COLOR, MISSING_COLOR } from './colors.js';

const PADDING = { left: 58, right: 18, top: 18, bottom: 46 };
export const MIN_ZOOM = 0.4;
export const MAX_ZOOM = 200;

/** Keep a zoom factor inside the range the plot can actually render. */
export function clampZoom(zoom) {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
}

/** Whether a projection has the coordinates needed for navigation and zoom. */
export function projectionCanZoom(projection) {
  return Boolean(projection?.available && projection.x && projection.y);
}

/**
 * Which gene Enter pins: only the one the keyboard has explicitly made
 * active. An arrow key never silently pins anything on its own, so a user
 * who has only ever hovered or landed on a gene by chance cannot pin it by
 * accident; they first have to move to it with the keyboard.
 */
export function enterTarget(active) {
  return active >= 0 ? active : -1;
}

/**
 * Which gene S adds to or removes from the shortlist: the keyboard-active
 * gene if there is one, otherwise the pinned gene. This is "the documented
 * candidate" the map-input-accessibility contract refers to.
 */
export function shortlistTarget(active, pinned) {
  return active >= 0 ? active : pinned;
}

/**
 * Nearest point from `from` in a compass direction, in screen space. Pure
 * geometry: takes the projection, an optional filter mask, and a screen
 * transform directly, so it needs no canvas or DOM to test. Points behind
 * the direction of travel are excluded, and lateral offset is penalised, so
 * repeated presses walk across the map instead of circling.
 * @param {{x: Float64Array, y: Float64Array}} projection
 * @param {Uint8Array|null} mask
 * @param {{k: number, cx: number, cy: number, ox: number, oy: number}} transform
 * @param {number} from
 * @param {'left'|'right'|'up'|'down'} direction
 */
export function findNeighbor(projection, mask, transform, from, direction) {
  const { x, y } = projection;
  const { k, cx, cy, ox, oy } = transform;
  if (from < 0) {
    for (let i = 0; i < x.length; i += 1) {
      if ((!mask || mask[i]) && Number.isFinite(x[i])) return i;
    }
    return -1;
  }
  const originX = ox + (x[from] - cx) * k;
  const originY = oy - (y[from] - cy) * k;
  let best = -1;
  let bestScore = Infinity;
  for (let i = 0; i < x.length; i += 1) {
    if (i === from) continue;
    if (mask && !mask[i]) continue;
    if (!Number.isFinite(x[i]) || !Number.isFinite(y[i])) continue;
    const dx = ox + (x[i] - cx) * k - originX;
    const dy = oy - (y[i] - cy) * k - originY;
    const along = direction === 'right' ? dx : direction === 'left' ? -dx
      : direction === 'up' ? -dy : dy;
    if (along <= 0.5) continue;
    const lateral = direction === 'left' || direction === 'right' ? Math.abs(dy) : Math.abs(dx);
    const score = along + lateral * 2.5;
    if (score < bestScore) {
      bestScore = score;
      best = i;
    }
  }
  return best;
}

/** Shorten text with an ellipsis until it fits `maxWidth`. */
function fitText(context, text, maxWidth) {
  if (context.measureText(text).width <= maxWidth) return text;
  let candidate = text;
  while (candidate.length > 1 && context.measureText(`${candidate}…`).width > maxWidth) {
    candidate = candidate.slice(0, -1);
  }
  return `${candidate}…`;
}

/** Tick positions that land on readable numbers. */
function niceTicks(low, high, target = 6) {
  if (!Number.isFinite(low) || !Number.isFinite(high) || low === high) return [];
  const span = high - low;
  const roughStep = span / target;
  const magnitude = 10 ** Math.floor(Math.log10(roughStep));
  const normalized = roughStep / magnitude;
  const step = (normalized >= 5 ? 5 : normalized >= 2 ? 2 : 1) * magnitude;
  const first = Math.ceil(low / step) * step;
  const ticks = [];
  for (let value = first; value <= high + step * 1e-6; value += step) {
    ticks.push(Math.abs(value) < step * 1e-6 ? 0 : value);
  }
  return ticks;
}

export class ScatterPlot {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {{onHover: (index: number) => void, onPreview: (index: number) => void,
   *   onSelect: (index: number) => void, onShortlistToggle: (index: number) => void,
   *   onEnterWithNothingActive: () => void, onViewChange: () => void}} handlers
   */
  constructor(canvas, handlers = {}) {
    this.canvas = canvas;
    this.context = canvas.getContext('2d');
    this.handlers = handlers;
    this.projection = null;
    this.mask = null;
    this.colors = null;
    this.buckets = null;
    this.pinned = -1;
    this.hovered = -1;
    // Distinct from `pinned`: where the keyboard has moved to, previewed but
    // not committed. Arrow keys move it; Enter is what promotes it to pinned.
    this.active = -1;
    this.shortlist = new Set();
    this.showHidden = true;
    this.zoom = 1;
    this.panX = 0;
    this.panY = 0;
    this.frameTimes = [];
    this.width = 0;
    this.height = 0;
    this.pendingFrame = 0;

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas.parentElement ?? canvas);
    this.bindEvents();
    this.resize();
  }

  resize() {
    const ratio = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    this.width = rect.width;
    this.height = rect.height;
    this.canvas.width = Math.round(rect.width * ratio);
    this.canvas.height = Math.round(rect.height * ratio);
    this.context.setTransform(ratio, 0, 0, ratio, 0, 0);
    // The fit depends on the plot rectangle, so a resize invalidates it.
    this.invalidate();
    this.draw();
  }

  /**
   * @param {{x: Float64Array, y: Float64Array, xLabel: string, yLabel: string,
   *   available: boolean, message?: string}} projection
   */
  setProjection(projection, { keepView = false } = {}) {
    this.projection = projection;
    this.fit = null;
    this.buckets = null;
    if (!keepView) this.resetView();
    else this.draw();
  }

  /** @param {{values: Float64Array, scale: object}|null} colors */
  setColor(colors) {
    this.colors = colors;
    this.buckets = null;
    this.draw();
  }

  /** @param {Uint8Array|null} mask 1 where a gene passes the filters. */
  setMask(mask) {
    this.mask = mask;
    this.buckets = null;
    this.draw();
  }

  /**
   * Group point indices by quantized colour once, so panning and zooming only
   * replay the groups instead of re-bucketing every gene on every frame.
   */
  rebuildBuckets() {
    const { x, y } = this.projection;
    const scale = this.colors?.scale;
    const values = this.colors?.values;
    const lists = scale ? scale.buckets.map(() => []) : [];
    const missing = [];
    const hidden = [];
    for (let i = 0; i < x.length; i += 1) {
      if (!Number.isFinite(x[i]) || !Number.isFinite(y[i])) continue;
      if (this.mask && !this.mask[i]) {
        hidden.push(i);
        continue;
      }
      if (!scale || !values) continue;
      const bucket = scale.bucketOf(values[i]);
      if (bucket < 0) missing.push(i);
      else lists[bucket].push(i);
    }
    this.buckets = {
      lists: lists.map((list) => Int32Array.from(list)),
      missing: Int32Array.from(missing),
      hidden: Int32Array.from(hidden),
    };
    return this.buckets;
  }

  setMarks({
    pinned = this.pinned, hovered = this.hovered, active = this.active, shortlist = this.shortlist,
  }) {
    this.pinned = pinned;
    this.hovered = hovered;
    this.active = active;
    this.shortlist = shortlist;
    this.draw();
  }

  setShowHidden(value) {
    this.showHidden = value;
    this.draw();
  }

  /** Discard cached geometry when the canvas is resized. */
  invalidate() {
    this.fit = null;
    this.buckets = null;
  }

  resetView() {
    this.zoom = 1;
    this.panX = 0;
    this.panY = 0;
    this.draw();
    this.handlers.onViewChange?.();
  }

  get plotRect() {
    return {
      left: PADDING.left,
      top: PADDING.top,
      width: Math.max(10, this.width - PADDING.left - PADDING.right),
      height: Math.max(10, this.height - PADDING.top - PADDING.bottom),
    };
  }

  computeFit() {
    if (this.fit) return this.fit;
    const { x, y } = this.projection;
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (let i = 0; i < x.length; i += 1) {
      if (!Number.isFinite(x[i]) || !Number.isFinite(y[i])) continue;
      if (x[i] < minX) minX = x[i];
      if (x[i] > maxX) maxX = x[i];
      if (y[i] < minY) minY = y[i];
      if (y[i] > maxY) maxY = y[i];
    }
    if (!Number.isFinite(minX)) {
      minX = -1; maxX = 1; minY = -1; maxY = 1;
    }
    const spanX = (maxX - minX) || 1;
    const spanY = (maxY - minY) || 1;
    const rect = this.plotRect;
    const scale = Math.min(rect.width / (spanX * 1.08), rect.height / (spanY * 1.08));
    this.fit = { cx: (minX + maxX) / 2, cy: (minY + maxY) / 2, scale };
    return this.fit;
  }

  /**
   * The current data-to-screen transform as plain numbers.
   * Hot loops use this instead of {@link toScreen} so that panning a few
   * thousand points allocates nothing.
   */
  transform() {
    const fit = this.computeFit();
    const rect = this.plotRect;
    const k = fit.scale * this.zoom;
    return {
      k,
      cx: fit.cx,
      cy: fit.cy,
      ox: rect.left + rect.width / 2 + this.panX,
      oy: rect.top + rect.height / 2 + this.panY,
    };
  }

  toScreen(dataX, dataY) {
    const { k, cx, cy, ox, oy } = this.transform();
    return { x: ox + (dataX - cx) * k, y: oy - (dataY - cy) * k };
  }

  toData(screenX, screenY) {
    const fit = this.computeFit();
    const rect = this.plotRect;
    const k = fit.scale * this.zoom;
    return {
      x: (screenX - rect.left - rect.width / 2 - this.panX) / k + fit.cx,
      y: -(screenY - rect.top - rect.height / 2 - this.panY) / k + fit.cy,
    };
  }

  /** Visible data range, used for axis ticks. */
  visibleRange() {
    const rect = this.plotRect;
    const topLeft = this.toData(rect.left, rect.top);
    const bottomRight = this.toData(rect.left + rect.width, rect.top + rect.height);
    return { minX: topLeft.x, maxX: bottomRight.x, minY: bottomRight.y, maxY: topLeft.y };
  }

  /** Nearest gene to a screen position within `limit` pixels, or -1. */
  hitTest(screenX, screenY, limit = 14) {
    if (!this.projection?.available) return -1;
    const { x, y } = this.projection;
    const { k, cx, cy, ox, oy } = this.transform();
    let best = -1;
    let bestDistance = limit * limit;
    for (let i = 0; i < x.length; i += 1) {
      if (this.mask && !this.mask[i] && !this.showHidden) continue;
      if (!Number.isFinite(x[i]) || !Number.isFinite(y[i])) continue;
      const dx = ox + (x[i] - cx) * k - screenX;
      const dy = oy - (y[i] - cy) * k - screenY;
      const distance = dx * dx + dy * dy;
      // A visible gene wins ties against one hidden by a filter.
      const penalty = this.mask && !this.mask[i] ? 40 : 0;
      if (distance + penalty < bestDistance) {
        bestDistance = distance + penalty;
        best = i;
      }
    }
    return best;
  }

  /**
   * Nearest gene from `from` in a compass direction, for keyboard navigation.
   * See {@link findNeighbor} for the geometry.
   */
  neighbor(from, direction) {
    if (!this.projection?.available) return -1;
    return findNeighbor(this.projection, this.mask, this.transform(), from, direction);
  }

  bindEvents() {
    const canvas = this.canvas;
    canvas.addEventListener('pointermove', (event) => {
      const rect = canvas.getBoundingClientRect();
      const px = event.clientX - rect.left;
      const py = event.clientY - rect.top;
      if (this.dragging) {
        this.panX += px - this.dragging.x;
        this.panY += py - this.dragging.y;
        this.dragging = { x: px, y: py, moved: true };
        this.draw();
        this.handlers.onViewChange?.();
        return;
      }
      const index = this.hitTest(px, py);
      canvas.style.cursor = index >= 0 ? 'pointer' : 'grab';
      this.handlers.onHover?.(index);
    });
    canvas.addEventListener('pointerleave', () => this.handlers.onHover?.(-1));
    canvas.addEventListener('pointerdown', (event) => {
      const rect = canvas.getBoundingClientRect();
      this.dragging = { x: event.clientX - rect.left, y: event.clientY - rect.top, moved: false };
      canvas.setPointerCapture(event.pointerId);
      canvas.style.cursor = 'grabbing';
    });
    canvas.addEventListener('pointerup', (event) => {
      const rect = canvas.getBoundingClientRect();
      const px = event.clientX - rect.left;
      const py = event.clientY - rect.top;
      const wasDrag = this.dragging?.moved;
      this.dragging = null;
      canvas.releasePointerCapture?.(event.pointerId);
      canvas.style.cursor = 'grab';
      if (!wasDrag) {
        const index = this.hitTest(px, py);
        if (index >= 0) this.handlers.onSelect?.(index);
      }
    });
    canvas.addEventListener('wheel', (event) => {
      if (!projectionCanZoom(this.projection)) return;
      event.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const px = event.clientX - rect.left;
      const py = event.clientY - rect.top;
      this.zoomAt(px, py, Math.exp(-event.deltaY * 0.0016));
    }, { passive: false });
    canvas.addEventListener('dblclick', () => this.resetView());
    canvas.addEventListener('keydown', (event) => this.onKeyDown(event));
  }

  zoomAt(screenX, screenY, factor) {
    if (!projectionCanZoom(this.projection)) return false;
    const before = this.toData(screenX, screenY);
    this.zoom = clampZoom(this.zoom * factor);
    const after = this.toScreen(before.x, before.y);
    this.panX += screenX - after.x;
    this.panY += screenY - after.y;
    this.draw();
    this.handlers.onViewChange?.();
    return true;
  }

  /** Zoom by `factor` about the centre of the plot, for buttons and touch. */
  zoomStep(factor) {
    const rect = this.plotRect;
    this.zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, factor);
  }

  onKeyDown(event) {
    if (!this.projection?.available) return;
    const rect = this.plotRect;
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const directions = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' };
    const direction = directions[event.key];
    if (direction) {
      event.preventDefault();
      if (event.shiftKey) {
        const step = 60;
        this.panX += direction === 'left' ? step : direction === 'right' ? -step : 0;
        this.panY += direction === 'up' ? step : direction === 'down' ? -step : 0;
        this.draw();
        this.handlers.onViewChange?.();
        return;
      }
      // Arrow keys move and preview the active gene; they never pin on their
      // own, so landing on a gene by accident cannot silently commit it.
      const from = this.active >= 0 ? this.active : this.pinned;
      const next = this.neighbor(from, direction);
      if (next >= 0) {
        this.active = next;
        this.draw();
        this.handlers.onPreview?.(next);
      }
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      const target = enterTarget(this.active);
      if (target >= 0) this.handlers.onSelect?.(target);
      else this.handlers.onEnterWithNothingActive?.();
      return;
    }
    if (event.key === '+' || event.key === '=') {
      event.preventDefault();
      this.zoomAt(centerX, centerY, 1.25);
    } else if (event.key === '-' || event.key === '_') {
      event.preventDefault();
      this.zoomAt(centerX, centerY, 0.8);
    } else if (event.key === '0') {
      event.preventDefault();
      this.resetView();
    } else if (event.key.toLowerCase() === 's') {
      const target = shortlistTarget(this.active, this.pinned);
      if (target >= 0) {
        event.preventDefault();
        this.handlers.onShortlistToggle?.(target);
      }
    }
  }

  /**
   * Frame times over the recent draws, in milliseconds. The median describes
   * what dragging feels like; the mean is skewed by the first frames, which run
   * before the engine has optimised anything.
   */
  frameStats() {
    if (this.frameTimes.length === 0) {
      return { median: NaN, mean: NaN, worst: NaN, frames: 0 };
    }
    const sorted = [...this.frameTimes].sort((a, b) => a - b);
    const sum = sorted.reduce((a, b) => a + b, 0);
    return {
      median: sorted[Math.floor(sorted.length / 2)],
      mean: sum / sorted.length,
      worst: sorted[sorted.length - 1],
      frames: sorted.length,
    };
  }

  resetFrameStats() {
    this.frameTimes = [];
  }

  /**
   * Request a redraw. Several state changes in one update collapse into one
   * frame, so applying a scheme does not draw the same canvas five times.
   */
  draw() {
    if (this.pendingFrame) return;
    this.pendingFrame = requestAnimationFrame(() => {
      this.pendingFrame = 0;
      this.renderNow();
    });
  }

  renderNow() {
    const context = this.context;
    if (!context || this.width === 0) return;
    const started = performance.now();
    context.clearRect(0, 0, this.width, this.height);

    if (!this.projection?.available) {
      this.drawMessage(this.projection?.message ?? 'No projection available.');
      return;
    }
    this.drawAxes();

    const { x, y } = this.projection;
    const rect = this.plotRect;
    const { k, cx, cy, ox, oy } = this.transform();
    context.save();
    context.beginPath();
    context.rect(rect.left, rect.top, rect.width, rect.height);
    context.clip();

    const radius = Math.min(4.2, Math.max(1.8, 2.3 * Math.sqrt(this.zoom)));
    const size = radius * 2;
    const buckets = this.buckets ?? this.rebuildBuckets();
    const scale = this.colors?.scale;

    if (this.showHidden) {
      context.fillStyle = GHOST_COLOR;
      for (let n = 0; n < buckets.hidden.length; n += 1) {
        const i = buckets.hidden[n];
        context.fillRect(
          ox + (x[i] - cx) * k - 1.2, oy - (y[i] - cy) * k - 1.2, 2.4, 2.4,
        );
      }
    }

    if (scale) {
      for (let bucket = 0; bucket < buckets.lists.length; bucket += 1) {
        const list = buckets.lists[bucket];
        if (list.length === 0) continue;
        context.fillStyle = scale.buckets[bucket];
        for (let n = 0; n < list.length; n += 1) {
          const i = list[n];
          context.fillRect(
            ox + (x[i] - cx) * k - radius, oy - (y[i] - cy) * k - radius, size, size,
          );
        }
      }
      // Genes with no value for this metric are drawn as open markers, so the
      // difference does not depend on telling one grey from another.
      context.strokeStyle = MISSING_COLOR;
      context.lineWidth = 1.2;
      for (let n = 0; n < buckets.missing.length; n += 1) {
        const i = buckets.missing[n];
        context.beginPath();
        context.arc(ox + (x[i] - cx) * k, oy - (y[i] - cy) * k, radius + 0.4, 0, Math.PI * 2);
        context.stroke();
      }
    }

    context.strokeStyle = '#1b2733';
    context.lineWidth = 1.6;
    for (const i of this.shortlist) {
      if (!Number.isFinite(x[i]) || !Number.isFinite(y[i])) continue;
      const pointX = ox + (x[i] - cx) * k;
      const pointY = oy - (y[i] - cy) * k;
      const r = radius + 3.4;
      context.beginPath();
      context.moveTo(pointX, pointY - r);
      context.lineTo(pointX + r, pointY);
      context.lineTo(pointX, pointY + r);
      context.lineTo(pointX - r, pointY);
      context.closePath();
      context.stroke();
    }

    if (this.hovered >= 0 && this.hovered !== this.pinned) {
      this.drawFocus(this.hovered, '#4a5568', false);
    }
    // The active ring is a distinct colour from both hover and pinned, and
    // never carries the "pinned" label: it is a preview, not a commitment.
    if (this.active >= 0 && this.active !== this.hovered && this.active !== this.pinned) {
      this.drawFocus(this.active, '#2f6f8f', false);
    }
    if (this.pinned >= 0) {
      this.drawFocus(this.pinned, '#b3261e', true);
    }
    context.restore();

    const elapsed = performance.now() - started;
    this.frameTimes.push(elapsed);
    if (this.frameTimes.length > 240) this.frameTimes.shift();
  }

  drawFocus(index, color, withLabel) {
    const context = this.context;
    const { x, y } = this.projection;
    if (!Number.isFinite(x[index]) || !Number.isFinite(y[index])) return;
    const point = this.toScreen(x[index], y[index]);
    context.strokeStyle = color;
    context.lineWidth = 2;
    context.beginPath();
    context.arc(point.x, point.y, 8, 0, Math.PI * 2);
    context.stroke();
    if (!withLabel) return;
    context.beginPath();
    context.moveTo(point.x - 13, point.y);
    context.lineTo(point.x - 9, point.y);
    context.moveTo(point.x + 9, point.y);
    context.lineTo(point.x + 13, point.y);
    context.moveTo(point.x, point.y - 13);
    context.lineTo(point.x, point.y - 9);
    context.moveTo(point.x, point.y + 9);
    context.lineTo(point.x, point.y + 13);
    context.stroke();
    const full = this.projection.labels?.[index];
    if (!full) return;
    context.font = '600 12px system-ui, sans-serif';
    // The label is drawn inside the clipped plot area, so it must fit there.
    const rect = this.plotRect;
    const label = fitText(context, full, rect.width - 16);
    const width = context.measureText(label).width;
    const boxX = Math.min(rect.left + rect.width - width - 6, point.x + 12);
    const boxY = Math.max(rect.top + 14, point.y - 12);
    context.fillStyle = 'rgba(255, 255, 255, 0.92)';
    context.fillRect(boxX - 4, boxY - 12, width + 8, 17);
    context.strokeStyle = color;
    context.lineWidth = 1;
    context.strokeRect(boxX - 4, boxY - 12, width + 8, 17);
    context.fillStyle = '#1b2733';
    context.fillText(label, boxX, boxY);
  }

  drawAxes() {
    const context = this.context;
    const rect = this.plotRect;
    const range = this.visibleRange();
    context.save();
    context.strokeStyle = '#e3e8ee';
    context.fillStyle = '#4a5568';
    context.lineWidth = 1;
    context.font = '11px system-ui, sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'top';

    for (const tick of niceTicks(range.minX, range.maxX)) {
      const { x } = this.toScreen(tick, 0);
      if (x < rect.left || x > rect.left + rect.width) continue;
      context.beginPath();
      context.moveTo(x, rect.top);
      context.lineTo(x, rect.top + rect.height);
      context.stroke();
      context.fillText(String(Number(tick.toPrecision(4))), x, rect.top + rect.height + 6);
    }
    context.textAlign = 'right';
    context.textBaseline = 'middle';
    for (const tick of niceTicks(range.minY, range.maxY)) {
      const { y } = this.toScreen(0, tick);
      if (y < rect.top || y > rect.top + rect.height) continue;
      context.beginPath();
      context.moveTo(rect.left, y);
      context.lineTo(rect.left + rect.width, y);
      context.stroke();
      context.fillText(String(Number(tick.toPrecision(4))), rect.left - 8, y);
    }

    context.strokeStyle = '#98a2b3';
    context.strokeRect(rect.left, rect.top, rect.width, rect.height);

    context.fillStyle = '#1b2733';
    context.font = '600 12px system-ui, sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'bottom';
    context.fillText(
      fitText(context, this.projection.xLabel ?? '', rect.width),
      rect.left + rect.width / 2,
      this.height - 4,
    );
    context.save();
    context.translate(12, rect.top + rect.height / 2);
    context.rotate(-Math.PI / 2);
    context.textBaseline = 'top';
    context.fillText(fitText(context, this.projection.yLabel ?? '', rect.height), 0, 0);
    context.restore();
    context.restore();
  }

  drawMessage(message) {
    const context = this.context;
    const rect = this.plotRect;
    context.save();
    context.setLineDash([6, 5]);
    context.strokeStyle = '#98a2b3';
    context.strokeRect(rect.left, rect.top, rect.width, rect.height);
    context.setLineDash([]);
    context.fillStyle = '#4a5568';
    context.font = '14px system-ui, sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    const words = message.split(' ');
    const lines = [];
    let line = '';
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (context.measureText(candidate).width > rect.width - 60 && line) {
        lines.push(line);
        line = word;
      } else {
        line = candidate;
      }
    }
    if (line) lines.push(line);
    lines.forEach((text, i) => {
      context.fillText(
        text,
        rect.left + rect.width / 2,
        rect.top + rect.height / 2 - ((lines.length - 1) * 19) / 2 + i * 19,
      );
    });
    context.restore();
  }
}

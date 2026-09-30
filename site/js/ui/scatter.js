/**
 * Canvas scatter plot for the gene maps.
 *
 * One canvas draws every gene. At a few thousand points a DOM node per gene is
 * far too slow to pan, so points are batched by quantized colour and drawn as
 * paths, and hit testing is a linear scan in screen space, which costs
 * microseconds at this size.
 */
import {
  ACTIVE_FOCUS_COLOR, CATEGORY_UNKNOWN_COLOR, DERIVED_MARKER_FILL, GHOST_BORDER, GHOST_COLOR,
  HOVER_FOCUS_COLOR, MISSING_COLOR, PINNED_COLOR, REVIEWED_MARKER_BORDER,
  SHORTLIST_COLOR,
} from './colors.js';
import {
  DEFAULT_DRAW_DIRECTION, normalizeDrawDirection, paintBatchOrder,
} from '../core/paint-priority.js';

const PADDING = { left: 66, right: 18, top: 18, bottom: 46 };
export const MIN_ZOOM = 0.4;
export const MAX_ZOOM = 200;
export const SQUARE_TO_CIRCLE_RADIUS = Math.sqrt(4 / Math.PI);

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

/** Clicking an already pinned point clears its pin; another point becomes pinned. */
export function togglePinTarget(clicked, pinned) {
  return clicked === pinned ? -1 : clicked;
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
 * @param {{k?: number, kx?: number, ky?: number, cx: number, cy: number,
 *   ox: number, oy: number}} transform
 * @param {number} from
 * @param {'left'|'right'|'up'|'down'} direction
 */
export function findNeighbor(projection, mask, transform, from, direction) {
  const { x, y } = projection;
  const { cx, cy, ox, oy } = transform;
  const kx = transform.kx ?? transform.k;
  const ky = transform.ky ?? transform.k;
  if (from < 0) {
    for (let i = 0; i < x.length; i += 1) {
      if ((!mask || mask[i]) && Number.isFinite(x[i])) return i;
    }
    return -1;
  }
  const originX = ox + (x[from] - cx) * kx;
  const originY = oy - (y[from] - cy) * ky;
  let best = -1;
  let bestScore = Infinity;
  for (let i = 0; i < x.length; i += 1) {
    if (i === from) continue;
    if (mask && !mask[i]) continue;
    if (!Number.isFinite(x[i]) || !Number.isFinite(y[i])) continue;
    const dx = ox + (x[i] - cx) * kx - originX;
    const dy = oy - (y[i] - cy) * ky - originY;
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

/**
 * Shorten an axis title without ever truncating `suffix` (the ", log10" /
 * ", percentile" / " (unit)" tail): a title that loses its scale suffix
 * misstates what the plotted numbers are. `fullText` is `name + suffix`;
 * only `name` is ever shortened. `suffix` empty falls back to plain `fitText`.
 *
 * Three tiers, each narrower than the last: the name shortened down to
 * `…, suffix`; when even that does not fit, the bare suffix with no ellipsis;
 * when the suffix alone does not fit either, an empty string, so the canvas
 * draws nothing rather than clip a scale claim into a false one. A caller
 * that draws an empty title must still state the scale elsewhere (the axis
 * note), since this function only ever chooses what the canvas can hold.
 */
export function fitAxisTitle(context, fullText, suffix, maxWidth) {
  if (context.measureText(fullText).width <= maxWidth) return fullText;
  if (!suffix) return fitText(context, fullText, maxWidth);
  const name = fullText.slice(0, fullText.length - suffix.length);
  let candidate = name;
  while (candidate.length > 0 && context.measureText(`${candidate}…${suffix}`).width > maxWidth) {
    candidate = candidate.slice(0, -1);
  }
  const shortest = `${candidate}…${suffix}`;
  if (context.measureText(shortest).width <= maxWidth) return shortest;
  if (context.measureText(suffix).width <= maxWidth) return suffix;
  return '';
}

/** Decimal places that write `step` exactly, so no two ticks round together. */
function decimalsForStep(step) {
  if (!Number.isFinite(step) || step <= 0) return 0;
  for (let decimals = 0; decimals < 6; decimals += 1) {
    const scaled = step * 10 ** decimals;
    if (Math.abs(scaled - Math.round(scaled)) < 1e-9 * Math.max(1, Math.abs(scaled))) {
      return decimals;
    }
  }
  return 6;
}

/** `value` with `decimals` places, trailing zeros trimmed. */
function fixed(value, decimals) {
  return String(Number(value.toFixed(Math.min(20, decimals))));
}

/**
 * Tick text that stays inside the axis gutter and still tells two ticks apart.
 *
 * A metric measured in raw counts reaches six figures, and "300000" beside the
 * rotated axis title collides with it, so thousands and millions are
 * abbreviated. The abbreviation carries exactly the decimals the tick spacing
 * needs: zoomed in far enough that ticks are 200 apart, labels read 161.2k and
 * 161.4k rather than rounding several neighbours to the same 161k. When the
 * spacing is finer than the abbreviation can show in one decimal, the plain
 * number is used instead, because a label that repeats its neighbour is worse
 * than a longer one.
 *
 * @param {number} value the tick value.
 * @param {number} [step] spacing between neighbouring ticks; 0 when unknown.
 */
export function formatTick(value, step = 0) {
  if (!Number.isFinite(value)) return '';
  const magnitude = Math.abs(value);
  const spacing = Number.isFinite(step) && step > 0 ? step : 0;
  for (const [unit, suffix, floor] of [[1e6, 'M', 1e6], [1e3, 'k', 1e4]]) {
    if (magnitude < floor) continue;
    const decimals = spacing > 0 ? decimalsForStep(spacing / unit) : 0;
    // Two decimals in an abbreviation ("161.05k") is longer than the plain
    // number and no clearer, so the next unit down, and finally the plain
    // number, takes over.
    if (spacing > 0 && decimals > 1) continue;
    const scaled = spacing > 0 ? fixed(value / unit, decimals)
      : String(Number((value / unit).toPrecision(3)));
    return `${scaled}${suffix}`;
  }
  if (spacing > 0) return fixed(value, decimalsForStep(spacing));
  return String(Number(value.toPrecision(4)));
}

/**
 * How many ticks an axis of this pixel length can label without its text
 * running together. A phone-width plot gets a handful; a desktop plot gets the
 * usual six.
 *
 * @param {number} pixels the axis length in CSS pixels.
 * @param {number} perTick pixels one label needs to stay separate.
 */
export function tickTarget(pixels, perTick) {
  if (!Number.isFinite(pixels) || !Number.isFinite(perTick) || perTick <= 0) return 6;
  return Math.max(2, Math.min(6, Math.floor(pixels / perTick)));
}

/**
 * The marker treatments this map batches by, and the paint-order state every
 * point in one of them shares. `core/paint-priority.js` reads exactly these
 * fields, so naming them here is the whole of what the map has to say about its
 * own order — the sequence comes back from the rule.
 *
 * `missing` is the open marker for a point with no value for the selected
 * colour, and its body is a ring rather than a disc: nothing is painted inside
 * it. That is why `filled` is here and not only in the drawing code — a pointer
 * inside an open ring is over the background, not over that point.
 */
export const MARKER_KINDS = Object.freeze({
  hiddenMissing: { code: 0, passes: false, hasValue: false, filled: true },
  hidden: { code: 1, passes: false, hasValue: true, filled: true },
  missing: { code: 2, passes: true, hasValue: false, filled: false },
  derived: { code: 3, passes: true, hasValue: true, derived: true, filled: true },
  colored: { code: 4, passes: true, hasValue: true, derived: false, filled: true },
});

/** Marker kind by its code, for reading a point's kind back out of an array. */
const KIND_BY_CODE = Object.freeze(Object.fromEntries(
  Object.entries(MARKER_KINDS).map(([name, kind]) => [kind.code, { name, ...kind }]),
));

/**
 * Every batch this map can issue, in the order `core/paint-priority.js` puts
 * them in.
 *
 * The map batches by quantized colour because a path per point cannot hold a
 * frame rate at a few thousand points, so it cannot sort points one at a time.
 * It does not have to: a batch is a set of points that share every field the
 * rule compares, so describing the batch is enough to price it, and
 * {@link paintBatchOrder} returns the sequence. The rule has one home, and this
 * map's pass order is no longer a second opinion about it.
 *
 * The declared order below is the tie-break, and the one place this map's answer
 * can differ from a view that sorts marks: two categories of equal evidence tie
 * on every field, and the rule's last word — the earlier locus — cannot apply to
 * a batch. They are issued by bucket, which is the order the legend lists them
 * in. The drawing contract states it:
 * `docs/validation/viewer-interaction-state.md`, "Which mark is seen where they
 * overlap".
 *
 * @param {{categorical?: boolean}|null|undefined} scale
 * @param {number} bucketCount how many colour buckets the scale has.
 * @param {string} direction the reader's draw direction.
 * @returns {{kind: string, bucket: number}[]} first issued first.
 */
export function paintBatches(scale, bucketCount, direction = DEFAULT_DRAW_DIRECTION) {
  const declared = [
    { kind: 'hiddenMissing', bucket: -1 },
    { kind: 'hidden', bucket: -1 },
    { kind: 'missing', bucket: -1 },
  ];
  for (const kind of ['derived', 'colored']) {
    for (let bucket = 0; bucket < bucketCount; bucket += 1) declared.push({ kind, bucket });
  }
  // `bucketOf` is monotonic in value, so the bucket index is a representative
  // value: ordering the batches by it is ordering them by value, and reversing
  // that is the whole of "lowest on top".
  const order = paintBatchOrder(
    declared.map((batch) => ({ ...MARKER_KINDS[batch.kind], value: batch.bucket })),
    { categorical: Boolean(scale?.categorical), direction: normalizeDrawDirection(direction) },
  );
  return order.map((position) => declared[position]);
}

/**
 * The order the colour batches of *valued* points are issued in, as bucket
 * indices. Taken out of {@link paintBatches} so the two cannot disagree.
 *
 * @param {number} count how many colour buckets the scale has.
 * @param {{categorical?: boolean}|null|undefined} scale
 * @param {string} direction the reader's draw direction.
 * @returns {Int32Array} bucket indices, first drawn first.
 */
export function bucketDrawOrder(count, scale, direction = DEFAULT_DRAW_DIRECTION) {
  return Int32Array.from(paintBatches(scale, count, direction)
    .filter((batch) => batch.kind === 'colored')
    .map((batch) => batch.bucket));
}

/** The point list one batch draws, out of the grouped buckets. */
export function batchList(buckets, batch) {
  if (batch.kind === 'derived') return buckets.derivedLists[batch.bucket];
  if (batch.kind === 'colored') return buckets.lists[batch.bucket];
  return buckets[batch.kind];
}

/**
 * Group finite plotted points by marker treatment, and record the order the
 * batches are issued in and where each point lands in the finished picture.
 *
 * In category mode, an excluded unknown stays distinct from an excluded
 * classified category so the canvas and legend can use different ghost shapes
 * without changing category filtering or export semantics, and a point whose
 * colour is source-derived (`derived[i]` set) is grouped apart from a reviewed
 * one so it draws with the hollow derived treatment in the same colour.
 *
 * Points are collected back to front within a batch, so the *earlier* locus is
 * the last one painted there — the rule's own tie-break, applied inside a batch
 * as well as between them. Every point in a batch shares its colour, so this
 * changes no pixel; it is what lets a hit test answer with the same gene the
 * rule would name for two points that coincide exactly.
 *
 * `rank` is that finished order, point index to its place from the bottom up,
 * and -1 for a point this colour draws nothing for. It is built once with the
 * batches — on a colour, mask, or direction change — so a pointer move reads it
 * instead of sorting anything.
 */
export function buildMarkerBuckets(x, y, mask, scale, values, derived = null,
  direction = DEFAULT_DRAW_DIRECTION) {
  const lists = scale ? scale.buckets.map(() => []) : [];
  const derivedLists = scale ? scale.buckets.map(() => []) : [];
  const missing = [];
  const hidden = [];
  const hiddenMissing = [];
  const kinds = new Int8Array(x.length).fill(-1);
  for (let i = x.length - 1; i >= 0; i -= 1) {
    if (!Number.isFinite(x[i]) || !Number.isFinite(y[i])) continue;
    const bucket = scale && values ? scale.bucketOf(values[i]) : -1;
    if (mask && !mask[i]) {
      if (scale?.categorical && bucket < 0) {
        hiddenMissing.push(i);
        kinds[i] = MARKER_KINDS.hiddenMissing.code;
      } else {
        hidden.push(i);
        kinds[i] = MARKER_KINDS.hidden.code;
      }
      continue;
    }
    if (!scale || !values) continue;
    if (bucket < 0) {
      missing.push(i);
      kinds[i] = MARKER_KINDS.missing.code;
    } else if (derived && derived[i]) {
      derivedLists[bucket].push(i);
      kinds[i] = MARKER_KINDS.derived.code;
    } else {
      lists[bucket].push(i);
      kinds[i] = MARKER_KINDS.colored.code;
    }
  }
  const buckets = {
    lists: lists.map((list) => Int32Array.from(list)),
    derivedLists: derivedLists.map((list) => Int32Array.from(list)),
    missing: Int32Array.from(missing),
    hidden: Int32Array.from(hidden),
    hiddenMissing: Int32Array.from(hiddenMissing),
    kinds,
    order: bucketDrawOrder(lists.length, scale, direction),
    batches: paintBatches(scale, lists.length, direction),
  };
  const rank = new Int32Array(x.length).fill(-1);
  let next = 0;
  for (const batch of buckets.batches) {
    for (const index of batchList(buckets, batch)) {
      rank[index] = next;
      next += 1;
    }
  }
  buckets.rank = rank;
  return buckets;
}

/**
 * How far each marker kind's own paint reaches from its point's centre, at a
 * given base radius, and whether that reach is filled.
 *
 * One reading of the marker geometry, used by the frame that draws it and by
 * the hit test that has to agree with the frame. A hit test with its own copy
 * of these numbers would drift the moment a marker's size changed.
 *
 * @param {number} radius the base radius the frame is drawing at.
 * @param {{categorical?: boolean}|null|undefined} scale
 */
export function markerBodies(radius, scale) {
  const categorical = Boolean(scale?.categorical);
  const squareHalfSize = categorical ? radius + 1.5 : radius;
  const colored = squareHalfSize * SQUARE_TO_CIRCLE_RADIUS;
  const ghost = Math.min(5, Math.max(3.5, radius * 2 * 0.8)) / 2;
  return {
    [MARKER_KINDS.hiddenMissing.code]: ghost,
    [MARKER_KINDS.hidden.code]: ghost,
    [MARKER_KINDS.missing.code]: categorical ? Math.max(1.4, radius * 0.7) : radius + 0.4,
    [MARKER_KINDS.derived.code]: colored,
    [MARKER_KINDS.colored.code]: colored,
  };
}

/** Whether a marker kind's body is painted rather than open. */
export function markerIsFilled(code) {
  return Boolean(KIND_BY_CODE[code]?.filled);
}

/** Radius of the centre dot inside a hollow derived marker of radius `radius`. */
export function derivedDotRadius(radius) {
  return Math.max(0.9, radius * 0.42);
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
    this.drawOnTop = DEFAULT_DRAW_DIRECTION;
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

  /**
   * @param {{values: Float64Array|Int16Array, scale: object,
   *   derived?: Uint8Array|null}|null} colors `derived` marks category-mode
   *   points whose colour is source-derived rather than reviewed.
   */
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
   * Which of two overlapping points is seen: the higher value or the lower one.
   *
   * Dropping the buckets is what keeps panning free of this. The order is
   * decided with them — once per colour, mask, or direction change — and a frame
   * only replays the batches in the order already recorded, so reversing the
   * direction costs one rebuild and nothing per frame.
   *
   * @param {string} direction the reader's draw direction.
   */
  setDrawDirection(direction) {
    const next = normalizeDrawDirection(direction);
    if (next === this.drawOnTop) return;
    this.drawOnTop = next;
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
    this.buckets = buildMarkerBuckets(
      x, y, this.mask, scale, values, this.colors?.derived ?? null, this.drawOnTop,
    );
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
    const scaleX = rect.width / (spanX * 1.08);
    const scaleY = rect.height / (spanY * 1.08);
    const commonScale = Math.min(scaleX, scaleY);
    this.fit = {
      cx: (minX + maxX) / 2,
      cy: (minY + maxY) / 2,
      scaleX: this.projection.independentAxes ? scaleX : commonScale,
      scaleY: this.projection.independentAxes ? scaleY : commonScale,
    };
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
    const kx = fit.scaleX * this.zoom;
    const ky = fit.scaleY * this.zoom;
    return {
      k: kx,
      kx,
      ky,
      cx: fit.cx,
      cy: fit.cy,
      ox: rect.left + rect.width / 2 + this.panX,
      oy: rect.top + rect.height / 2 + this.panY,
    };
  }

  toScreen(dataX, dataY) {
    const { kx, ky, cx, cy, ox, oy } = this.transform();
    return { x: ox + (dataX - cx) * kx, y: oy - (dataY - cy) * ky };
  }

  toData(screenX, screenY) {
    const fit = this.computeFit();
    const rect = this.plotRect;
    const kx = fit.scaleX * this.zoom;
    const ky = fit.scaleY * this.zoom;
    return {
      x: (screenX - rect.left - rect.width / 2 - this.panX) / kx + fit.cx,
      y: -(screenY - rect.top - rect.height / 2 - this.panY) / ky + fit.cy,
    };
  }

  /** Visible data range, used for axis ticks. */
  visibleRange() {
    const rect = this.plotRect;
    const topLeft = this.toData(rect.left, rect.top);
    const bottomRight = this.toData(rect.left + rect.width, rect.top + rect.height);
    return { minX: topLeft.x, maxX: bottomRight.x, minY: bottomRight.y, maxY: topLeft.y };
  }

  /** The radius a point's marker is drawn at, at the current zoom. */
  markerRadius() {
    return Math.min(4.2, Math.max(1.8, 2.3 * Math.sqrt(this.zoom)));
  }

  /**
   * The gene a pointer selects: the one painted on top where the pointer is on
   * a drawn marker, and the nearest centre within `limit` where it is on none.
   *
   * Following the picture is the point. At 1280 px on the native map with
   * "lowest on top", `M744_RS00045`'s centre is covered by `M744_RS13045`, half
   * a pixel away: the pixel under the pointer is the covering gene's colour, and
   * a nearest-centre answer pinned the covered one, so the reader selected a CDS
   * whose colour was nowhere on the screen. Where painted bodies overlap the
   * topmost wins; only a pointer over none of them reaches for the nearest
   * centre, which is what a click in empty space needs.
   *
   * Still one linear scan, and still no sort. The rank comes from the batches,
   * built once per colour, mask, or direction change, and an open marker is not
   * a body at all — nothing is painted inside the ring for a gene with no value.
   */
  hitTest(screenX, screenY, limit = 14) {
    if (!this.projection?.available) return -1;
    const { x, y } = this.projection;
    const { kx, ky, cx, cy, ox, oy } = this.transform();
    const buckets = this.buckets ?? this.rebuildBuckets();
    const bodies = markerBodies(this.markerRadius(), this.colors?.scale);
    let onTop = -1;
    let onTopRank = -1;
    let nearest = -1;
    let nearestDistance = limit * limit;
    for (let i = 0; i < x.length; i += 1) {
      const excluded = Boolean(this.mask) && !this.mask[i];
      if (excluded && !this.showHidden) continue;
      if (!Number.isFinite(x[i]) || !Number.isFinite(y[i])) continue;
      const dx = ox + (x[i] - cx) * kx - screenX;
      const dy = oy - (y[i] - cy) * ky - screenY;
      const distance = dx * dx + dy * dy;
      const code = buckets.kinds[i];
      const reach = bodies[code];
      if (markerIsFilled(code) && distance <= reach * reach && buckets.rank[i] > onTopRank) {
        onTopRank = buckets.rank[i];
        onTop = i;
      }
      // A visible gene wins ties against one hidden by a filter.
      const penalty = excluded ? 40 : 0;
      if (distance + penalty < nearestDistance) {
        nearestDistance = distance + penalty;
        nearest = i;
      }
    }
    return onTop >= 0 ? onTop : nearest;
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
    const { kx, ky, cx, cy, ox, oy } = this.transform();
    context.save();
    context.beginPath();
    context.rect(rect.left, rect.top, rect.width, rect.height);
    context.clip();

    const radius = this.markerRadius();
    const buckets = this.buckets ?? this.rebuildBuckets();
    const scale = this.colors?.scale;
    const bodies = markerBodies(radius, scale);
    const at = { x, y, kx, ky, cx, cy, ox, oy };

    // Every batch, in the order the shared rule put them in when the buckets
    // were built. A frame replays that sequence; it never decides it, and it
    // never sorts. A gene with no value is under every valued point in both
    // colour modes and both directions because the rule says absence is not a
    // low value — these open markers used to be issued last, so a valueless
    // ring crossed the centre of a top-percentile point and read back as the
    // missing-value grey.
    for (const batch of buckets.batches) {
      const list = batchList(buckets, batch);
      if (list.length === 0) continue;
      if (batch.kind === 'hiddenMissing' || batch.kind === 'hidden') {
        if (this.showHidden) this.paintGhostBatch(batch.kind, list, at, bodies);
      } else if (batch.kind === 'missing') {
        this.paintMissingBatch(list, at, scale, bodies);
      } else if (batch.kind === 'derived') {
        this.paintDerivedBatch(list, at, scale, batch.bucket, bodies);
      } else {
        this.paintColoredBatch(list, at, scale, batch.bucket, bodies);
      }
    }

    context.strokeStyle = SHORTLIST_COLOR;
    context.lineWidth = 1.6;
    for (const i of this.shortlist) {
      if (!Number.isFinite(x[i]) || !Number.isFinite(y[i])) continue;
      const pointX = ox + (x[i] - cx) * kx;
      const pointY = oy - (y[i] - cy) * ky;
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
      this.drawFocus(this.hovered, HOVER_FOCUS_COLOR, false);
    }
    // The active ring is a distinct colour from both hover and pinned, and
    // never carries the "pinned" label: it is a preview, not a commitment.
    if (this.active >= 0 && this.active !== this.hovered && this.active !== this.pinned) {
      this.drawFocus(this.active, ACTIVE_FOCUS_COLOR, false);
    }
    if (this.pinned >= 0) {
      this.drawFocus(this.pinned, PINNED_COLOR, true);
    }
    context.restore();

    const elapsed = performance.now() - started;
    this.frameTimes.push(elapsed);
    if (this.frameTimes.length > 240) this.frameTimes.shift();
  }

  /**
   * One ghost batch: the squares for a filtered-out point with a value, and the
   * small circles for a filtered-out unknown category, which the legend gives
   * different shapes so category filtering reads as itself.
   */
  paintGhostBatch(kind, list, at, bodies) {
    const context = this.context;
    const reach = bodies[MARKER_KINDS[kind].code];
    const { x, y, kx, ky, cx, cy, ox, oy } = at;
    if (kind === 'hiddenMissing') {
      context.fillStyle = CATEGORY_UNKNOWN_COLOR;
      for (let n = 0; n < list.length; n += 1) {
        const i = list[n];
        context.beginPath();
        context.arc(ox + (x[i] - cx) * kx, oy - (y[i] - cy) * ky, reach, 0, Math.PI * 2);
        context.fill();
      }
      return;
    }
    context.fillStyle = GHOST_COLOR;
    context.strokeStyle = GHOST_BORDER;
    context.lineWidth = 1;
    for (let n = 0; n < list.length; n += 1) {
      const i = list[n];
      const left = ox + (x[i] - cx) * kx - reach;
      const top = oy - (y[i] - cy) * ky - reach;
      context.fillRect(left, top, reach * 2, reach * 2);
      context.strokeRect(left, top, reach * 2, reach * 2);
    }
  }

  /** The open marker for a point with no value for the selected colour. */
  paintMissingBatch(list, at, scale, bodies) {
    const context = this.context;
    const { x, y, kx, ky, cx, cy, ox, oy } = at;
    context.strokeStyle = scale.categorical ? CATEGORY_UNKNOWN_COLOR : MISSING_COLOR;
    context.lineWidth = scale.categorical ? 0.9 : 1.2;
    const reach = bodies[MARKER_KINDS.missing.code];
    for (let n = 0; n < list.length; n += 1) {
      const i = list[n];
      context.beginPath();
      context.arc(ox + (x[i] - cx) * kx, oy - (y[i] - cy) * ky, reach, 0, Math.PI * 2);
      context.stroke();
    }
  }

  /**
   * One bucket of source-derived category colour: white disc, category-colour
   * ring, and a centre dot in the same colour. Same area as a reviewed circle,
   * visibly different fill, never mistaken for lab review.
   */
  paintDerivedBatch(list, at, scale, bucket, bodies) {
    const context = this.context;
    const { x, y, kx, ky, cx, cy, ox, oy } = at;
    const reach = bodies[MARKER_KINDS.derived.code];
    context.fillStyle = DERIVED_MARKER_FILL;
    context.strokeStyle = scale.buckets[bucket];
    context.lineWidth = 1.3;
    context.beginPath();
    for (let n = 0; n < list.length; n += 1) {
      const i = list[n];
      context.moveTo(ox + (x[i] - cx) * kx + reach, oy - (y[i] - cy) * ky);
      context.arc(ox + (x[i] - cx) * kx, oy - (y[i] - cy) * ky, reach, 0, Math.PI * 2);
    }
    context.fill();
    context.stroke();
    const dotRadius = derivedDotRadius(reach);
    context.fillStyle = scale.buckets[bucket];
    context.beginPath();
    for (let n = 0; n < list.length; n += 1) {
      const i = list[n];
      context.moveTo(ox + (x[i] - cx) * kx + dotRadius, oy - (y[i] - cy) * ky);
      context.arc(ox + (x[i] - cx) * kx, oy - (y[i] - cy) * ky, dotRadius, 0, Math.PI * 2);
    }
    context.fill();
  }

  /**
   * One bucket of ordinary colour. Circles are the included-point convention in
   * every colour mode, at the same area as the square they replaced.
   */
  paintColoredBatch(list, at, scale, bucket, bodies) {
    const context = this.context;
    const { x, y, kx, ky, cx, cy, ox, oy } = at;
    const reach = bodies[MARKER_KINDS.colored.code];
    context.fillStyle = scale.buckets[bucket];
    context.beginPath();
    for (let n = 0; n < list.length; n += 1) {
      const i = list[n];
      context.moveTo(ox + (x[i] - cx) * kx + reach, oy - (y[i] - cy) * ky);
      context.arc(ox + (x[i] - cx) * kx, oy - (y[i] - cy) * ky, reach, 0, Math.PI * 2);
    }
    context.fill();
    if (!scale.categorical) return;
    context.strokeStyle = REVIEWED_MARKER_BORDER;
    context.lineWidth = 0.8;
    context.stroke();
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

    const xTicks = niceTicks(range.minX, range.maxX, tickTarget(rect.width, 74));
    const xStep = xTicks.length > 1 ? xTicks[1] - xTicks[0] : 0;
    for (const tick of xTicks) {
      const { x } = this.toScreen(tick, 0);
      if (x < rect.left || x > rect.left + rect.width) continue;
      context.beginPath();
      context.moveTo(x, rect.top);
      context.lineTo(x, rect.top + rect.height);
      context.stroke();
      context.fillText(formatTick(tick, xStep), x, rect.top + rect.height + 6);
    }
    context.textAlign = 'right';
    context.textBaseline = 'middle';
    const yTicks = niceTicks(range.minY, range.maxY, tickTarget(rect.height, 34));
    const yStep = yTicks.length > 1 ? yTicks[1] - yTicks[0] : 0;
    for (const tick of yTicks) {
      const { y } = this.toScreen(0, tick);
      if (y < rect.top || y > rect.top + rect.height) continue;
      context.beginPath();
      context.moveTo(rect.left, y);
      context.lineTo(rect.left + rect.width, y);
      context.stroke();
      context.fillText(formatTick(tick, yStep), rect.left - 8, y);
    }

    context.strokeStyle = '#98a2b3';
    context.strokeRect(rect.left, rect.top, rect.width, rect.height);

    context.fillStyle = '#1b2733';
    context.font = '600 12px system-ui, sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'bottom';
    context.fillText(
      fitAxisTitle(context, this.projection.xLabel ?? '', this.projection.xLabelSuffix ?? '', rect.width),
      rect.left + rect.width / 2,
      this.height - 4,
    );
    context.save();
    context.translate(12, rect.top + rect.height / 2);
    context.rotate(-Math.PI / 2);
    context.textBaseline = 'top';
    context.fillText(
      fitAxisTitle(context, this.projection.yLabel ?? '', this.projection.yLabelSuffix ?? '', rect.height),
      0,
      0,
    );
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

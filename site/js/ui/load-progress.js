/**
 * The loading presentation's one progress surface.
 *
 * The chromosome bar begins over the empty grid, then the same DOM presentation
 * moves to the top of the map card when the usable page is revealed. Later
 * tiers and independently fetched resources therefore continue the same load
 * instead of apparently starting a second one. Failed files remain below it
 * with Retry controls, so one failed request does not cost the visit.
 *
 * The genes on the bar are decoration with a real meaning: how many are lit is
 * the fraction loaded. They are not the release's genes, which have not
 * arrived when the bar first draws, so nothing about them can be read as data.
 */
import { CATEGORICAL } from './colors.js';
import { DATA_FILES, FILE_STATE, TIER_LABELS, dataFileLabel } from '../core/data-files.js';
import { formatCount } from './format.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

/** The bar's drawing box, in SVG units; it stretches to the width it is given. */
export const LOAD_BAR_VIEW = Object.freeze({ width: 600, height: 44, axisY: 22, laneHeight: 15, gap: 1 });

/** Genes drawn along the bar. */
export const LOAD_BAR_GENES = 132;

/** The full bar is held this long before the page replaces it, so it is seen. */
export const FULL_HOLD_MS = 150;

/** A small deterministic generator, so the bar is the same picture on every load. */
function lcg(seed) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

/** Keep a progress value inside the range the bar can represent. */
function clampFraction(value) {
  return Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
}

/**
 * The uneven steps a bar would take if all its data were already available.
 *
 * @returns {{atMs: number, fraction: number}[]}
 */
export function loadSchedule(minimumMs, seed = 2973) {
  if (!Number.isFinite(minimumMs) || minimumMs <= 0) return [];
  const random = lcg(seed);
  const count = 7 + Math.floor(random() * 6);
  const weightedSteps = (largeShare, smallShare) => {
    const large = Math.floor(random() * count);
    let small = Math.floor(random() * (count - 1));
    if (small >= large) small += 1;
    const weights = Array.from({ length: count }, () => 0);
    weights[large] = largeShare;
    weights[small] = smallShare;
    const ordinary = weights.map((weight, index) => (
      index === large || index === small ? 0 : 0.45 + random()
    ));
    const ordinaryTotal = ordinary.reduce((sum, weight) => sum + weight, 0);
    const remainder = 1 - largeShare - smallShare;
    return weights.map((weight, index) => weight || (ordinary[index] / ordinaryTotal) * remainder);
  };

  // One conspicuous jump and one small advance make the blocks readable. The
  // time weights likewise guarantee one long pause rather than a metronome.
  const fractions = weightedSteps(0.22, 0.035);
  const pauses = weightedSteps(0.27, 0.035);
  const lastAt = minimumMs * (0.9 + random() * 0.1);
  let atMs = 0;
  let fraction = 0;
  return fractions.map((step, index) => {
    atMs += pauses[index] * lastAt;
    fraction += step;
    return {
      atMs: index === count - 1 ? lastAt : atMs,
      fraction: index === count - 1 ? 1 : fraction,
    };
  });
}

/** The largest scheduled block that time and real progress have both reached. */
export function displayedFraction(real, elapsedMs, schedule) {
  if (schedule.length === 0) return real;
  const available = real;
  let displayed = 0;
  for (const step of schedule) {
    if (step.atMs > elapsedMs || step.fraction > available) break;
    displayed = step.fraction;
  }
  return displayed;
}

/**
 * The genes along the bar: position, width, strand lane, and colour.
 *
 * Deterministic, tiled left to right with small gaps so the bar reads as a
 * gene-dense track, and each gene's right edge is the fraction at which it
 * lights.
 *
 * @returns {{x: number, width: number, lane: 'above'|'below', color: string, at: number}[]}
 */
export function loadBarGenes(count = LOAD_BAR_GENES, seed = 2973) {
  const random = lcg(seed);
  const weights = Array.from({ length: count }, () => 0.35 + random());
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  const usable = LOAD_BAR_VIEW.width - LOAD_BAR_VIEW.gap * (count - 1);
  const genes = [];
  let x = 0;
  for (let i = 0; i < count; i += 1) {
    const width = (weights[i] / total) * usable;
    genes.push({
      x,
      width,
      lane: random() < 0.52 ? 'above' : 'below',
      color: CATEGORICAL[Math.floor(random() * CATEGORICAL.length)],
      at: (x + width) / LOAD_BAR_VIEW.width,
    });
    x += width + LOAD_BAR_VIEW.gap;
  }
  return genes;
}

/**
 * How far along a load is, from 0 to 1.
 *
 * Bytes against the manifest's sizes when it supplied them; otherwise files
 * settled against files requested, which is coarser but never claims a size it
 * does not know.
 */
export function loadFraction(snapshot, keys = null) {
  if (!snapshot) return 0;
  if (keys !== null) {
    const records = keys.map((key) => snapshot.files?.[key] ?? null);
    const totalBytes = records.reduce((sum, record) => sum + (record?.bytes ?? 0), 0);
    const fraction = snapshot.exact && totalBytes > 0
      ? records.reduce((sum, record) => sum + (record?.receivedBytes ?? 0), 0) / totalBytes
      : (keys.length > 0 ? records.filter((record) => record?.settled).length / keys.length : 0);
    return clampFraction(fraction);
  }
  const fraction = snapshot.exact && snapshot.totalBytes > 0
    ? snapshot.receivedBytes / snapshot.totalBytes
    : (snapshot.totalFiles > 0 ? snapshot.settledFiles / snapshot.totalFiles : 0);
  return clampFraction(fraction);
}

/** The release and its size, once `meta.json` has landed; empty before. */
export function describeIdentity(identity) {
  if (!identity) return '';
  const parts = [];
  if (identity.releaseId) parts.push(`Release ${identity.releaseId}`);
  if (Number.isFinite(identity.geneCount)) parts.push(`${formatCount(identity.geneCount)} genes`);
  return parts.join(', ');
}

/** What the bar says to assistive technology: the tier in plain words, and how far. */
export function describeLoad(snapshot, identity = null, keys = null, tierLabels = TIER_LABELS) {
  const percent = Math.round(loadFraction(snapshot, keys) * 100);
  const tier = snapshot?.currentTier ? tierLabels[snapshot.currentTier] : null;
  const what = snapshot?.currentLabel
    ? `Loading ${snapshot.currentLabel}` : (tier ? `Loading ${tier}` : 'Loading complete');
  const who = describeIdentity(identity);
  return `${what}, ${percent}%.${who ? ` ${who}.` : ''}`;
}

/**
 * One gene's `rect` attributes, the same whether the page ships the mark or
 * this module builds it. The colour is a custom property rather than `fill`, so
 * the stylesheet can draw an unlit gene as a faint neutral and a lit one in its
 * own colour.
 */
export function loadGeneAttributes(gene) {
  const { axisY, laneHeight } = LOAD_BAR_VIEW;
  return {
    class: 'load-gene',
    x: gene.x.toFixed(2),
    y: gene.lane === 'above' ? axisY - 3 - laneHeight : axisY + 3,
    width: gene.width.toFixed(2),
    height: laneHeight,
    style: `--gene: ${gene.color}`,
  };
}

function svg(name, attributes = {}) {
  const node = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attributes)) {
    node.setAttribute(key, String(value));
    // The browser owns an SVG element's `className`; the test DOM matches on a string.
    if (key === 'class' && typeof node.className === 'string') node.className = String(value);
  }
  return node;
}

export class LoadProgress {
  /**
   * @param {{stage: HTMLElement, presentation?: HTMLElement, bar: HTMLElement,
   *   status?: HTMLElement, tail: HTMLElement}} elements the loading stage,
   *   the movable chromosome presentation, its progressbar and stage text, and
   *   the host that receives that same presentation after the reveal.
   * @param {{onRetry?: (key: string) => void}} handlers
   * @param {{minimumMs?: number, now?: () => number, requestFrame?: Function,
   *   tierLabels?: Record<number, string>, organism?: object}} [options]
   *   `tierLabels` and `organism` word the tiers and the files for the organism
   *   on screen; both default to the default organism's.
   */
  constructor({ stage, presentation = null, bar, status = null, tail }, handlers = {}, {
    minimumMs = 0,
    now = () => performance.now(),
    requestFrame = (callback) => requestAnimationFrame(callback),
    tierLabels = TIER_LABELS,
    organism = undefined,
  } = {}) {
    this.tierLabels = tierLabels;
    this.organism = organism;
    this.stage = stage;
    this.presentation = presentation ?? bar;
    this.bar = bar;
    this.status = status;
    this.tail = tail;
    this.handlers = handlers;
    this.minimumMs = Number.isFinite(minimumMs) ? Math.max(0, minimumMs) : 0;
    this.now = now;
    this.requestFrame = requestFrame;
    this.schedule = loadSchedule(this.minimumMs);
    this.blockingKeys = null;
    this.identity = null;
    this.revealed = false;
    this.snapshot = null;
    this.resources = new Map();
    this.resourceOnly = false;
    this.retryLabel = null;
    this.framePending = false;
    this.frameVersion = 0;
    this.cycle = 0;
    this.startedAt = 0;
    this.genes = loadBarGenes();
    this.buildBar();
    if (!this.status) {
      this.status = document.createElement('p');
      this.status.className = 'load-progress-status';
      this.presentation.append(this.status);
    }
    this.status.setAttribute('role', 'status');
    this.buildTail();
    this.startCycle(0);
  }

  buildBar() {
    // The page ships the whole track, so it is there from the first paint and
    // not a bare axis until this module arrives. Those marks are adopted; a
    // host without them, as in a test, gets the same track built here.
    const shipped = this.bar.querySelectorAll('rect.load-gene');
    if (shipped.length === this.genes.length) {
      this.marks = shipped;
    } else {
      const { width, height, axisY } = LOAD_BAR_VIEW;
      const root = svg('svg', {
        class: 'load-chromosome', viewBox: `0 0 ${width} ${height}`, preserveAspectRatio: 'none',
        'aria-hidden': 'true', focusable: 'false',
      });
      root.append(svg('line', { class: 'load-chromosome-axis', x1: 0, x2: width, y1: axisY, y2: axisY }));
      this.marks = this.genes.map((gene) => {
        const mark = svg('rect', loadGeneAttributes(gene));
        root.append(mark);
        return mark;
      });
      this.bar.replaceChildren(root);
    }
    this.bar.setAttribute('role', 'progressbar');
    this.bar.setAttribute('aria-label', 'Loading the gene data');
    this.bar.setAttribute('aria-valuemin', '0');
    this.bar.setAttribute('aria-valuemax', '100');
    this.setFraction(0);
    this.setAria(0, describeLoad(null));
  }

  buildTail() {
    this.failures = document.createElement('ul');
    this.failures.className = 'load-failures';
    this.tail.replaceChildren(this.failures);
    this.tail.hidden = true;
  }

  /** Light every gene whose right edge the fraction has passed. */
  setFraction(fraction) {
    this.fraction = fraction;
    // The last gene's edge is the full width, so floating-point rounding must
    // not leave it dark at 100%.
    const reached = fraction >= 1 ? Infinity : fraction;
    this.marks.forEach((mark, i) => mark.classList.toggle('is-on', this.genes[i].at <= reached));
  }

  /** Report real progress even when the decorative genes are deliberately behind it. */
  setAria(fraction, text) {
    this.bar.setAttribute('aria-valuenow', String(Math.round(fraction * 100)));
    this.bar.setAttribute('aria-valuetext', text);
  }

  /** Begin one independently finishable presentation cycle. */
  startCycle(startedAt) {
    this.cycle += 1;
    this.frameVersion += 1;
    this.startedAt = startedAt;
    this.framePending = false;
    this.finishScheduled = false;
    this.completeHeld = false;
    this.readyPromise = new Promise((resolve) => {
      if (this.minimumMs === 0) resolve();
      else setTimeout(resolve, this.minimumMs);
    });
    this.finishedPromise = new Promise((resolve) => { this.resolveFinished = resolve; });
    this.requestNextFrame();
  }

  /** Promise fulfilled once the presentation minimum has elapsed. */
  ready() {
    return this.readyPromise;
  }

  /** Promise fulfilled after this cycle has shown and held its complete bar. */
  finished() {
    return this.finishedPromise;
  }

  requestNextFrame() {
    if (this.minimumMs === 0 || this.revealed || this.fraction >= 1 || this.framePending) return;
    const cycle = this.cycle;
    const version = this.frameVersion;
    this.framePending = true;
    this.requestFrame(() => {
      if (cycle !== this.cycle || version !== this.frameVersion) return;
      this.framePending = false;
      if (this.revealed) return;
      this.renderStage();
      this.requestNextFrame();
    });
  }

  renderStage() {
    const combined = this.combinedSnapshot();
    const real = loadFraction(combined);
    const elapsed = this.now() - this.startedAt;
    const displayed = displayedFraction(real, elapsed, this.schedule);
    this.setFraction(displayed);
    const description = describeLoad(combined, this.identity, null, this.tierLabels);
    this.setAria(real, description);
    const stage = combined?.currentLabel
      ?? (combined?.currentTier ? this.tierLabels[combined.currentTier] : null);
    this.status.textContent = stage ? `Loading ${stage}` : (real >= 1 ? 'Loading complete' : 'Loading data');
    if (displayed < 1) return;
    // There may be a callback already queued when an update reaches full.
    // Invalidate it so reaching full stops the loop immediately.
    this.frameVersion += 1;
    this.framePending = false;
    if (this.minimumMs === 0) {
      this.completeHeld = true;
      this.resolveFinished();
      if (this.revealed) this.renderTail();
      return;
    }
    if (this.finishScheduled) return;
    this.finishScheduled = true;
    const cycle = this.cycle;
    // The minimum is a floor, not a target the schedule happens to approach.
    // The last block lands a little short of it, by a share that grows with the
    // minimum, so the full bar is held for whichever is longer: the hold that
    // lets it be seen, or the rest of the minimum.
    const remaining = this.startedAt + this.minimumMs - this.now();
    setTimeout(() => {
      if (cycle === this.cycle) {
        this.completeHeld = true;
        this.resolveFinished();
        if (this.revealed) this.renderTail();
      }
    }, Math.max(FULL_HOLD_MS, remaining));
  }

  /**
   * Fold independently fetched work into the active cycle.
   *
   * A resource begun after a completed cycle starts a fresh presentation. The
   * initial source ledger is begun before dataset progress arrives and joins
   * that first cycle.
   */
  beginResource(key, { label, totalBytes = null, reportFailure = true } = {}) {
    const active = [...this.resources.values()].some((resource) => !resource.settled);
    if ((this.completeHeld && !active) || this.fraction >= 1) {
      this.resourceOnly = this.completeHeld && !active;
      this.blockingKeys = null;
      this.startCycle(this.now());
      this.setFraction(0);
    }
    this.resources.set(key, {
      key, label: label ?? key, totalBytes: Number.isFinite(totalBytes) ? totalBytes : null,
      receivedBytes: 0, settled: false, state: FILE_STATE.LOADING, error: null,
      reportFailure, cycle: this.cycle,
    });
    this.renderStage();
    if (this.revealed) this.renderTail();
  }

  updateResource(key, { receivedBytes, totalBytes } = {}) {
    const resource = this.resources.get(key);
    if (!resource) return;
    if (Number.isFinite(receivedBytes)) resource.receivedBytes = Math.max(0, receivedBytes);
    if (Number.isFinite(totalBytes)) resource.totalBytes = Math.max(0, totalBytes);
    this.renderStage();
    if (this.revealed) this.renderTail();
  }

  settleResource(key, state = FILE_STATE.READY, error = null) {
    const resource = this.resources.get(key);
    if (!resource) return;
    resource.state = state;
    resource.error = error;
    resource.settled = true;
    if (resource.totalBytes !== null) resource.receivedBytes = resource.totalBytes;
    this.renderStage();
    this.requestNextFrame();
    if (this.revealed) this.renderTail();
  }

  /** The loader and the resources in this presentation cycle as one snapshot. */
  combinedSnapshot() {
    const resources = [...this.resources.values()].filter((resource) => resource.cycle === this.cycle);
    const base = this.resourceOnly ? null : this.snapshot;
    if (!base && resources.length === 0) return null;
    const baseFraction = loadFraction(base, this.blockingKeys);
    const baseFiles = base ? (this.blockingKeys?.length ?? base.totalFiles ?? 1) : 0;
    const resourceFraction = (resource) => {
      if (resource.settled) return 1;
      if (resource.totalBytes > 0) return clampFraction(resource.receivedBytes / resource.totalBytes);
      return 0;
    };
    const totalFiles = baseFiles + resources.length;
    const settledFiles = (baseFiles * baseFraction)
      + resources.reduce((sum, resource) => sum + resourceFraction(resource), 0);
    const pendingResource = resources.find((resource) => !resource.settled);
    return {
      receivedBytes: settledFiles,
      totalBytes: totalFiles,
      exact: false,
      settledFiles,
      totalFiles,
      currentTier: base?.currentTier ?? null,
      currentLabel: base?.currentTier ? null : pendingResource?.label
        ?? (baseFraction < 1 ? this.retryLabel : null),
      files: base?.files ?? {},
    };
  }

  /** The release's name and gene count, reported once tier 1 has been built. */
  setIdentity(identity) {
    this.identity = identity;
    if (!this.revealed) this.renderStage();
  }

  /** Limit the stage bar to the files that must land before the reveal. */
  setBlocking(keys) {
    this.blockingKeys = keys === null ? null : [...keys];
    if (!this.revealed) {
      this.renderStage();
      this.requestNextFrame();
    }
  }

  /** Start a new visible cycle for one or more loader files being retried. */
  beginRetry(keys, label = 'data') {
    this.resourceOnly = false;
    this.retryLabel = label;
    this.blockingKeys = [...keys];
    this.startCycle(this.now());
    this.setFraction(0);
    this.renderStage();
    if (this.revealed) this.renderTail();
  }

  /**
   * Report a loader snapshot. Before the reveal it drives the chromosome bar;
   * after it, the tail.
   */
  update(snapshot) {
    this.snapshot = snapshot;
    if (!this.revealed) {
      this.renderStage();
      this.requestNextFrame();
    }
    if (this.revealed) this.renderTail();
  }

  /** The empty shell gives way to the page; later files continue under the tail. */
  reveal() {
    this.revealed = true;
    this.frameVersion += 1;
    this.framePending = false;
    this.presentation.remove();
    this.failures.remove();
    this.tail.append(this.presentation, this.failures);
    this.stage.hidden = true;
    this.renderTail();
  }

  /** Put the stage back for a whole-dataset retry. */
  restart() {
    this.revealed = false;
    this.snapshot = null;
    this.resources.clear();
    this.resourceOnly = false;
    this.retryLabel = null;
    this.presentation.remove();
    this.stage.append(this.presentation);
    this.stage.hidden = false;
    this.tail.hidden = true;
    this.setFraction(0);
    this.setAria(0, describeLoad(null));
    this.startCycle(this.now());
  }

  /**
   * The files that failed, as the tail lists them.
   * @param {object} files the loader's per-file records.
   */
  setFiles(files) {
    this.files = files;
    if (this.revealed) this.renderTail();
  }

  renderTail() {
    const snapshot = this.combinedSnapshot();
    const failed = DATA_FILES.filter((file) => this.files?.[file.key]?.state === FILE_STATE.FAILED);
    const resourceFailures = [...this.resources.values()].filter((resource) => (
      resource.state === FILE_STATE.FAILED && resource.reportFailure
    ));
    const loading = loadFraction(snapshot) < 1 || !this.completeHeld;
    this.tail.hidden = false;
    this.tail.classList.toggle('has-failures', failed.length + resourceFailures.length > 0);
    this.presentation.hidden = !loading;
    if (this.tail.hidden) return;
    if (loading) this.renderStage();
    this.failures.replaceChildren(
      ...failed.map((file) => this.failureRow(file)),
      ...resourceFailures.map((resource) => this.resourceFailureRow(resource)),
    );
  }

  resourceFailureRow(resource) {
    const row = document.createElement('li');
    row.className = 'load-failure';
    row.dataset.fileKey = resource.key;
    const text = document.createElement('span');
    text.textContent = `${resource.label}: ${resource.error?.message ?? 'could not be loaded'}`;
    row.append(text);
    const retry = document.createElement('button');
    retry.type = 'button';
    retry.className = 'chip-button';
    retry.textContent = 'Retry';
    retry.setAttribute('aria-label', `Retry loading ${resource.label}`);
    retry.addEventListener('click', () => this.handlers.onRetry?.(resource.key));
    row.append(retry);
    return row;
  }

  failureRow(file) {
    const record = this.files[file.key];
    const row = document.createElement('li');
    row.className = 'load-failure';
    row.dataset.fileKey = file.key;
    const text = document.createElement('span');
    const label = document.createElement('strong');
    const name = dataFileLabel(file, this.organism);
    label.textContent = `${name.charAt(0).toUpperCase()}${name.slice(1)}: `;
    text.append(label, record.error?.message ?? 'could not be loaded');
    row.append(text);
    // A file that failed only because another did is retried by retrying that one.
    if (!record.blockedBy) {
      const retry = document.createElement('button');
      retry.type = 'button';
      retry.className = 'chip-button';
      retry.textContent = 'Retry';
      retry.setAttribute('aria-label', `Retry loading ${name}`);
      retry.addEventListener('click', () => this.handlers.onRetry?.(file.key));
      row.append(retry);
    }
    return row;
  }
}

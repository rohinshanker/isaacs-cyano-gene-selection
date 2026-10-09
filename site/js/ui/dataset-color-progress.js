/** Truthful, selection-scoped loading feedback over the active map canvas. */

import { FILE_STATE } from '../core/data-files.js';
import { formatLoadBytes } from './load-progress.js';

export class DatasetColorProgress {
  constructor({ onRetry = null, requestFrame = (callback) => requestAnimationFrame(callback) } = {}) {
    this.onRetry = onRetry;
    this.requestFrame = requestFrame;
    this.token = 0;
    this.fileKeys = [];
    this.retryFileKey = null;
    this.metricLabel = '';
    this.snapshot = null;

    this.root = document.createElement('div');
    this.root.className = 'dataset-color-progress';
    this.root.hidden = true;
    this.root.setAttribute('role', 'status');
    this.root.setAttribute('aria-live', 'polite');

    this.label = document.createElement('p');
    this.label.className = 'dataset-color-progress-label';
    this.meter = document.createElement('div');
    this.meter.className = 'dataset-color-progress-meter';
    this.meter.setAttribute('role', 'progressbar');
    this.meter.setAttribute('aria-valuemin', '0');
    this.meter.setAttribute('aria-valuemax', '100');
    this.fill = document.createElement('span');
    this.fill.className = 'dataset-color-progress-fill';
    this.meter.append(this.fill);
    this.retry = document.createElement('button');
    this.retry.type = 'button';
    this.retry.className = 'chip-button dataset-color-progress-retry';
    this.retry.textContent = 'Retry';
    this.retry.hidden = true;
    this.retry.addEventListener('click', () => {
      if (this.retryFileKey) this.onRetry?.(this.retryFileKey);
    });
    this.root.append(this.label, this.meter, this.retry);
  }

  /** Show feedback only for a selected metric whose required files are unresolved. */
  begin({ fileKeys = [], metricLabel, host, snapshot }) {
    this.token += 1;
    this.fileKeys = [...new Set(fileKeys)].filter((fileKey) => {
      const state = snapshot?.files?.[fileKey]?.state;
      return state === FILE_STATE.LOADING || state === FILE_STATE.FAILED;
    });
    this.metricLabel = metricLabel ?? 'selected dataset';
    this.snapshot = snapshot;
    if (this.fileKeys.length === 0) {
      this.hide();
      return { token: this.token, pending: false };
    }
    if (!host) {
      this.hide();
      return { token: this.token, pending: false };
    }
    if ((this.root.parentElement ?? this.root.parent) !== host) {
      this.root.remove();
      host.append(this.root);
    }
    this.root.hidden = false;
    this.render();
    return { token: this.token, pending: true };
  }

  update(snapshot) {
    this.snapshot = snapshot;
    if (this.root.hidden || this.fileKeys.length === 0) return;
    this.render();
  }

  moveTo(host) {
    if (!this.root.hidden && host && (this.root.parentElement ?? this.root.parent) !== host) {
      this.root.remove();
      host.append(this.root);
    }
  }

  render() {
    const records = this.fileKeys
      .map((fileKey) => ({ fileKey, record: this.snapshot?.files?.[fileKey] }))
      .filter(({ record }) => record);
    if (records.length === 0) return;
    const failed = records.find(({ record }) => record.state === FILE_STATE.FAILED) ?? null;
    const filenames = records.map(({ fileKey, record }) => record.label ?? fileKey);
    const sourceText = formatFilenameList(filenames);
    this.retryFileKey = failed?.fileKey ?? null;
    this.root.classList.toggle('is-activity', !failed);
    this.root.classList.toggle('is-error', Boolean(failed));
    this.retry.hidden = !failed;
    if (failed) {
      const filename = failed.record.label ?? failed.fileKey;
      this.label.textContent = `Could not load ${filename} for ${this.metricLabel}.`;
      this.retry.setAttribute('aria-label', `Retry loading ${filename} for ${this.metricLabel}`);
      this.meter.removeAttribute('aria-valuenow');
      this.meter.setAttribute('aria-valuetext', this.label.textContent);
      return;
    }
    const known = records.every(({ record }) => Number.isFinite(record.bytes) && record.bytes > 0);
    const total = known ? records.reduce((sum, { record }) => sum + record.bytes, 0) : 0;
    const received = records.reduce((sum, { record }) => (
      sum + Math.max(0, record.actualReceivedBytes ?? record.receivedBytes ?? 0)
    ), 0);
    const fraction = known ? Math.min(1, received / total) : null;
    const preparing = records.every(({ record }) => isUsableLanding(record)
      || (record.settled !== true && Number.isFinite(record.bytes) && record.bytes > 0
        && (record.actualReceivedBytes ?? record.receivedBytes ?? 0) >= record.bytes));
    if (preparing) {
      this.label.textContent = `Preparing ${this.metricLabel} from ${sourceText}`;
      this.fill.style.transform = 'scaleX(1)';
      this.meter.removeAttribute('aria-valuenow');
      this.meter.setAttribute('aria-valuetext', `${this.label.textContent}; transfer complete.`);
      return;
    }
    if (fraction === null) {
      this.label.textContent = `Loading ${this.metricLabel} from ${sourceText} · size unavailable`;
      this.fill.style.transform = 'scaleX(0)';
      this.meter.removeAttribute('aria-valuenow');
    } else {
      const receivedText = formatLoadBytes(received);
      const totalText = formatLoadBytes(total);
      this.label.textContent = `Loading ${this.metricLabel} from ${sourceText} · `
        + `${receivedText} of ${totalText}`;
      this.fill.style.transform = `scaleX(${fraction})`;
      this.meter.setAttribute('aria-valuenow', String(Math.floor(fraction * 100)));
    }
    this.meter.setAttribute('aria-valuetext', this.label.textContent);
  }

  /** Keep the preparation state until the selected colours have reached a painted frame. */
  applied(token) {
    if (token !== this.token) return;
    const records = this.fileKeys.map((fileKey) => this.snapshot?.files?.[fileKey]);
    // A loader landing is also emitted for failure. Keep its actionable Retry
    // visible, including when failure arrives during the two-frame paint wait.
    if (records.length === 0 || records.some((record) => !isUsableLanding(record))) return;
    this.hide();
  }

  hide() {
    this.root.hidden = true;
    this.root.classList.remove('is-activity', 'is-error');
    this.fileKeys = [];
    this.retryFileKey = null;
  }

  /** Two frames guarantee the overlay can paint before selection work begins. */
  waitForPaint(token) {
    return new Promise((resolve) => this.requestFrame(() => this.requestFrame(() => {
      resolve(token === this.token);
    })));
  }
}

function formatFilenameList(names) {
  if (names.length <= 1) return names[0] ?? '';
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(', ')}, and ${names.at(-1)}`;
}

function isUsableLanding(record) {
  return record?.state === FILE_STATE.READY || record?.state === FILE_STATE.ABSENT;
}

/** Truthful, selection-scoped loading feedback over the active map canvas. */

import { FILE_STATE } from '../core/data-files.js';
import { formatLoadBytes } from './load-progress.js';

export class DatasetColorProgress {
  constructor({ onRetry = null, requestFrame = (callback) => requestAnimationFrame(callback) } = {}) {
    this.onRetry = onRetry;
    this.requestFrame = requestFrame;
    this.token = 0;
    this.fileKey = null;
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
      if (this.fileKey) this.onRetry?.(this.fileKey);
    });
    this.root.append(this.label, this.meter, this.retry);
  }

  /** Show feedback only for a selected metric whose published file is unresolved. */
  begin({ fileKey, metricLabel, host, snapshot }) {
    this.token += 1;
    this.fileKey = fileKey ?? null;
    this.metricLabel = metricLabel ?? 'selected dataset';
    this.snapshot = snapshot;
    const record = fileKey ? snapshot?.files?.[fileKey] : null;
    if (!record || (record.state !== FILE_STATE.LOADING && record.state !== FILE_STATE.FAILED)) {
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
    this.render(record);
    return { token: this.token, pending: true };
  }

  update(snapshot) {
    this.snapshot = snapshot;
    if (this.root.hidden || !this.fileKey) return;
    const record = snapshot?.files?.[this.fileKey];
    if (!record) return;
    this.render(record);
  }

  moveTo(host) {
    if (!this.root.hidden && host && (this.root.parentElement ?? this.root.parent) !== host) {
      this.root.remove();
      host.append(this.root);
    }
  }

  render(record) {
    const failed = record.state === FILE_STATE.FAILED;
    const known = Number.isFinite(record.bytes) && record.bytes > 0;
    const received = Math.max(0, record.actualReceivedBytes ?? record.receivedBytes ?? 0);
    const fraction = known ? Math.min(1, received / record.bytes) : null;
    const filename = record.label ?? this.fileKey;
    const preparing = !failed && record.settled !== true && fraction === 1;
    this.root.classList.toggle('is-activity', !failed);
    this.root.classList.toggle('is-error', failed);
    this.retry.hidden = !failed;
    if (failed) {
      this.label.textContent = `Could not load ${filename} for ${this.metricLabel}.`;
      this.retry.setAttribute('aria-label', `Retry loading ${filename} for ${this.metricLabel}`);
      this.meter.removeAttribute('aria-valuenow');
      this.meter.setAttribute('aria-valuetext', this.label.textContent);
      return;
    }
    if (preparing || record.state === FILE_STATE.READY) {
      this.label.textContent = `Preparing ${this.metricLabel} from ${filename}`;
      this.fill.style.transform = 'scaleX(1)';
      this.meter.removeAttribute('aria-valuenow');
      this.meter.setAttribute('aria-valuetext', `${this.label.textContent}; transfer complete.`);
      return;
    }
    if (fraction === null) {
      this.label.textContent = `Loading ${this.metricLabel} from ${filename} · size unavailable`;
      this.fill.style.transform = 'scaleX(0)';
      this.meter.removeAttribute('aria-valuenow');
    } else {
      const receivedText = formatLoadBytes(received);
      const totalText = formatLoadBytes(record.bytes);
      this.label.textContent = `Loading ${this.metricLabel} from ${filename} · `
        + `${receivedText} of ${totalText}`;
      this.fill.style.transform = `scaleX(${fraction})`;
      this.meter.setAttribute('aria-valuenow', String(Math.floor(fraction * 100)));
    }
    this.meter.setAttribute('aria-valuetext', this.label.textContent);
  }

  /** Keep the preparation state until the selected colours have reached a painted frame. */
  applied(token) {
    if (token !== this.token) return;
    this.hide();
  }

  hide() {
    this.root.hidden = true;
    this.root.classList.remove('is-activity', 'is-error');
    this.fileKey = null;
  }

  /** Two frames guarantee the overlay can paint before selection work begins. */
  waitForPaint(token) {
    return new Promise((resolve) => this.requestFrame(() => this.requestFrame(() => {
      resolve(token === this.token);
    })));
  }
}

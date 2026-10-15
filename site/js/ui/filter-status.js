/**
 * The collapsed Filter status disclosure, shared by the map and chromosome views.
 *
 * Built once per view and updated in place, so its open state, the toggle's
 * focus and a screen reader's place survive every redraw. The status sentence
 * is a live region; the toggle is an ordinary checkbox so it works from the
 * keyboard and reads its own state.
 */
import {
  TURN_FILTERS_OFF_LABEL, filterStatusTitle,
} from '../core/filter-bypass.js';

export class FilterStatus {
  /**
   * @param {HTMLDetailsElement} details an existing `details.tan-disclosure`.
   * @param {{idPrefix: string, onBypassChange: (bypassed: boolean) => void}} options
   */
  constructor(details, { idPrefix, onBypassChange }) {
    this.details = details;
    this.summary = details.querySelector('summary');
    if (!this.summary) {
      this.summary = document.createElement('summary');
      details.append(this.summary);
    }
    this.content = details.querySelector('.filter-banner');
    if (!this.content) {
      this.content = document.createElement('p');
      this.content.className = 'filter-banner active';
      this.content.id = `${idPrefix}-content`;
      this.content.setAttribute('role', 'status');
      details.append(this.content);
    }
    const row = document.createElement('span');
    row.className = 'checkbox-row filter-bypass-row';
    this.toggle = document.createElement('input');
    this.toggle.type = 'checkbox';
    this.toggle.id = `${idPrefix}-bypass`;
    this.toggle.className = 'filter-bypass';
    this.toggle.addEventListener('change', () => onBypassChange(this.toggle.checked));
    const label = document.createElement('label');
    label.htmlFor = this.toggle.id;
    label.textContent = TURN_FILTERS_OFF_LABEL;
    row.append(this.toggle, label);
    details.append(row);
  }

  /** @param {{visible: boolean, bypassed: boolean, text: string}} model */
  update({ visible, bypassed, text }) {
    const title = filterStatusTitle(bypassed);
    if (this.summary.textContent !== title) this.summary.textContent = title;
    this.toggle.checked = Boolean(bypassed);
    if (this.content.textContent !== text) this.content.textContent = text;
    this.details.classList.toggle('filters-bypassed', Boolean(bypassed));
    // A hidden section is closed, so it does not reappear open and unasked.
    if (!visible && this.details.open) this.details.open = false;
    this.details.hidden = !visible;
  }
}

/** A fresh, closed, hidden disclosure for a view that has none in its markup. */
export function filterStatusElement(id) {
  const details = document.createElement('details');
  details.className = 'tan-disclosure filter-disclosure';
  details.id = id;
  details.hidden = true;
  return details;
}

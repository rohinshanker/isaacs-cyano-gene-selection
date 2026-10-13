import { parseOverlapLengthFilter, overlapLengthFilterActive } from '../core/overlap-length.js';

/** Stable controls preserve focus and invalid drafts through unrelated app renders. */
export class OverlapLengthFilter {
  constructor(onChange) {
    this.onChange = onChange;
    this.element = document.createElement('fieldset');
    this.element.className = 'flag-filter overlap-length-filter';
    const legend = document.createElement('legend');
    legend.textContent = 'Overlap length';
    const row = document.createElement('div');
    row.className = 'field-row';
    const label = document.createElement('label');
    label.htmlFor = 'overlap-length-end';
    label.textContent = 'Transcriptional end';
    this.end = document.createElement('select');
    this.end.id = label.htmlFor;
    for (const [value, text] of [['5prime', '5′ overlap length'], ['3prime', '3′ overlap length']]) {
      const option = document.createElement('option');
      option.value = value; option.textContent = text; this.end.append(option);
    }
    row.append(label, this.end);
    const inputs = document.createElement('div');
    inputs.className = 'filter-inputs';
    this.fields = {};
    for (const [bound, text] of [['min', 'Minimum (bp)'], ['max', 'Maximum (bp)']]) {
      const wrapper = document.createElement('span'); wrapper.className = 'filter-input';
      const boundLabel = document.createElement('label');
      boundLabel.htmlFor = `overlap-length-${bound}`; boundLabel.textContent = text;
      const input = document.createElement('input');
      // Text preserves malformed/fractional entries that number inputs can erase.
      input.type = 'text'; input.inputMode = 'numeric'; input.id = boundLabel.htmlFor;
      input.setAttribute('aria-describedby', 'overlap-length-error overlap-length-status');
      input.addEventListener('input', () => this.commit());
      this.fields[bound] = input; wrapper.append(boundLabel, input); inputs.append(wrapper);
    }
    this.error = document.createElement('p'); this.error.id = 'overlap-length-error';
    this.error.className = 'panel-note'; this.error.setAttribute('role', 'alert');
    this.note = document.createElement('p'); this.note.id = 'overlap-length-status';
    this.note.className = 'panel-note'; this.note.setAttribute('role', 'status');
    this.clear = document.createElement('button'); this.clear.type = 'button';
    this.clear.className = 'chip-button'; this.clear.textContent = 'Clear overlap length';
    this.clear.addEventListener('click', () => {
      this.reset(); this.onChange(null); this.fields.min.focus();
    });
    this.end.addEventListener('change', () => this.commit());
    this.element.append(legend, row, inputs, this.error, this.note, this.clear);
    this.reset();
  }

  reset(filter = null) {
    this.applied = JSON.stringify(filter);
    this.end.value = filter?.end ?? '5prime';
    for (const bound of ['min', 'max']) {
      this.fields[bound].value = filter?.[bound] == null ? '' : String(filter[bound]);
      this.fields[bound].setAttribute('aria-invalid', 'false');
    }
    this.error.textContent = ''; this.error.hidden = true;
    this.clear.disabled = !filter;
  }

  commit() {
    const parsed = parseOverlapLengthFilter(this.end.value, this.fields.min.value, this.fields.max.value);
    this.error.textContent = parsed.error ? `${parsed.error} The last valid range remains applied.` : '';
    this.error.hidden = !parsed.error;
    for (const input of Object.values(this.fields)) input.setAttribute('aria-invalid', String(Boolean(parsed.error)));
    this.clear.disabled = !parsed.error && !overlapLengthFilterActive(parsed.value);
    this.onDraftChange?.();
    if (parsed.error) return;
    this.applied = JSON.stringify(parsed.value);
    this.onChange(parsed.value);
  }

  update({ filter = null, available, pending }) {
    if (this.applied !== JSON.stringify(filter)) this.reset(filter);
    const active = overlapLengthFilterActive(filter);
    this.note.textContent = available
      ? 'Inclusive bounds; blank means unbounded. Counts contiguous shared bases inward from this end, stopping at the first uncovered base or real coding gap. 0 bp means no end overlap. Unavailable lengths stay visible. Color by is independent.'
      : `Overlap lengths ${pending === 'failed' ? 'could not be loaded' : pending === 'loading'
        ? 'are still loading' : 'are unavailable'}. ${active ? 'The saved range is paused and hides no genes until the layer is ready. ' : ''}Unavailable is not 0 bp; you can edit or clear the range.`;
  }
}

/**
 * A two-thumb range slider built from two native range inputs.
 *
 * Each thumb is its own `<input type="range">`, so each is keyboard-operable,
 * has its own accessible name and value text, and takes pointer capture the
 * way the browser already does; a filled bar between them draws the kept
 * range. A thumb at its outer end means "no bound": the slider reports `null`
 * there, which is how the filters say the same thing, and the paired number
 * fields show blank.
 *
 * Two kinds of event leave it. `onInput` fires on every movement, pointer or
 * key, with the values the thumbs are at; the page uses it to update what is
 * drawn without rebuilding anything. `onCommit` fires once the gesture ends
 * (the browser's `change`), with the same values; the page uses it to record
 * the state. The thumbs cannot cross: a thumb dragged past the other is held
 * at it. The slider never rebuilds itself while a thumb is active; `setRange`
 * moves thumbs that are not being held.
 *
 * A native range input snaps any value set on it to its step grid, so the
 * bounds are kept here exactly as given and only the bound whose thumb moved
 * is read back from the input: dragging one end never nudges the other.
 */

/** Steps across the track; fine enough that a drag reads as continuous. */
const STEPS = 500;

/** The smallest spread a slider is drawn for: below it the thumbs would sit on top of each other. */
export function hasUsableSpread(lo, hi) {
  return Number.isFinite(lo) && Number.isFinite(hi) && hi - lo > 0;
}

export class RangeSlider {
  /**
   * @param {{lo: number, hi: number, integer?: boolean, idPrefix: string, label: string,
   *   format: (value: number) => string, onInput: (range: {min: number|null, max: number|null}) => void,
   *   onCommit: (range: {min: number|null, max: number|null}) => void}} options
   */
  constructor({ lo, hi, integer = false, idPrefix, label, format, onInput, onCommit }) {
    this.lo = lo;
    this.hi = hi;
    this.integer = integer;
    this.format = format;
    this.onInput = onInput;
    this.onCommit = onCommit;
    this.active = null;
    this.bounds = { min: null, max: null };
    const step = integer ? Math.max(1, Math.ceil((hi - lo) / STEPS)) : (hi - lo) / STEPS;
    this.step = step;

    this.element = document.createElement('div');
    this.element.className = 'range-slider';
    this.element.setAttribute('role', 'group');
    this.element.setAttribute('aria-label', `${label} range`);
    this.fill = document.createElement('div');
    this.fill.className = 'range-slider-fill';
    this.fill.setAttribute('aria-hidden', 'true');
    this.element.append(this.fill);

    this.thumbs = {};
    for (const [bound, name] of [['min', 'At least'], ['max', 'At most']]) {
      const input = document.createElement('input');
      input.type = 'range';
      input.className = `range-slider-thumb range-slider-${bound}`;
      input.id = `${idPrefix}-${bound}-thumb`;
      input.min = String(lo);
      input.max = String(hi);
      input.step = String(step);
      input.setAttribute('aria-label', `${name}: ${label}`);
      input.addEventListener('pointerdown', () => { this.active = bound; });
      input.addEventListener('focus', () => { this.active = bound; });
      input.addEventListener('blur', () => { if (this.active === bound) this.active = null; });
      input.addEventListener('input', () => {
        this.take(bound);
        this.reflect();
        this.onInput?.(this.range());
      });
      input.addEventListener('change', () => {
        this.take(bound);
        this.reflect();
        this.onCommit?.(this.range());
      });
      this.thumbs[bound] = input;
      this.element.append(input);
    }
  }

  /**
   * Read the moved thumb into its bound. A thumb dragged past the other is held
   * at it, so the kept range is never empty; the other bound is left exactly
   * as it was.
   */
  take(moved) {
    const other = moved === 'min' ? 'max' : 'min';
    let value = Number(this.thumbs[moved].value);
    const limit = this.bounds[other] ?? (other === 'min' ? this.lo : this.hi);
    if (moved === 'min' && value > limit) value = limit;
    if (moved === 'max' && value < limit) value = limit;
    this.thumbs[moved].value = String(value);
    if (this.integer) value = Math.round(value);
    const open = moved === 'min' ? value <= this.lo : value >= this.hi;
    this.bounds[moved] = open ? null : value;
  }

  /** The filter range the thumbs stand for: null at an outer end. */
  range() {
    return { min: this.bounds.min, max: this.bounds.max };
  }

  /**
   * Place the thumbs for a filter range, leaving a thumb the reader is holding
   * where it is. Null means the outer end.
   */
  setRange({ min, max }) {
    const clamp = (value) => Math.min(this.hi, Math.max(this.lo, value));
    const open = (bound, value) => (value === null
      || (bound === 'min' ? value <= this.lo : value >= this.hi));
    if (this.active !== 'min') {
      this.bounds.min = open('min', min) ? null : clamp(min);
      this.thumbs.min.value = String(clamp(min ?? this.lo));
    }
    if (this.active !== 'max') {
      this.bounds.max = open('max', max) ? null : clamp(max);
      this.thumbs.max.value = String(clamp(max ?? this.hi));
    }
    this.reflect();
  }

  /** The filled bar and the value texts follow the thumbs. */
  reflect() {
    const span = this.hi - this.lo || 1;
    const min = Number(this.thumbs.min.value);
    const max = Number(this.thumbs.max.value);
    const left = ((min - this.lo) / span) * 100;
    const right = ((this.hi - max) / span) * 100;
    this.fill.style.left = `${left}%`;
    this.fill.style.right = `${right}%`;
    const { min: lower, max: upper } = this.range();
    this.thumbs.min.setAttribute('aria-valuetext',
      lower === null ? 'no lower bound' : `at least ${this.format(lower)}`);
    this.thumbs.max.setAttribute('aria-valuetext',
      upper === null ? 'no upper bound' : `at most ${this.format(upper)}`);
  }
}

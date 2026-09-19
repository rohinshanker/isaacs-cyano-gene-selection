/** Value formatting. A missing value is an em-space, never a zero. */
import { describeExpressionSource } from '../core/metric-registry.js';

/** What a null or non-finite metric renders as, per the data contract. */
export const MISSING = ' ';

/** Format a metric value for display, using the metric's own shape. */
export function formatValue(metric, value) {
  if (value === null || value === undefined || !Number.isFinite(value)) return MISSING;
  if (metric?.integer) return Math.round(value).toLocaleString('en-US');
  const magnitude = Math.abs(value);
  if (magnitude === 0) return '0';
  if (magnitude >= 1000) return value.toLocaleString('en-US', { maximumFractionDigits: 0 });
  if (magnitude >= 10) return value.toFixed(1);
  if (magnitude >= 1) return value.toFixed(2);
  if (magnitude >= 0.001) return value.toFixed(3);
  return value.toExponential(1);
}

/** Signed format, so a delta reads as a change rather than a value. */
export function formatDelta(metric, value) {
  if (!Number.isFinite(value)) return MISSING;
  const text = formatValue(metric, Math.abs(value));
  if (value > 0) return `+${text}`;
  if (value < 0) return `−${text}`;
  return '0';
}

/**
 * The English ordinal suffix for a whole number: 1st, 2nd, 3rd, 4th, and the
 * eleven-to-thirteen exceptions that take "th" despite their last digit.
 */
export function ordinalSuffix(value) {
  const n = Math.abs(Math.round(value));
  if (n % 100 >= 11 && n % 100 <= 13) return 'th';
  if (n % 10 === 1) return 'st';
  if (n % 10 === 2) return 'nd';
  if (n % 10 === 3) return 'rd';
  return 'th';
}

/** A percentile as a plain-language rank. */
export function formatPercentile(fraction) {
  if (!Number.isFinite(fraction)) return MISSING;
  const percent = fraction * 100;
  if (percent >= 99.5) return 'top 1%';
  if (percent <= 0.5) return 'bottom 1%';
  const whole = Number(percent.toFixed(0));
  return `${whole}${ordinalSuffix(whole)} pct`;
}

/** Whole numbers with thousands separators. */
export function formatCount(value) {
  return Number(value).toLocaleString('en-US');
}

/** Expression provenance copy with coverage counts formatted for the interface. */
export function formatExpressionSource(source) {
  return describeExpressionSource(source, formatCount);
}

/** Genome coordinates as `812,345-813,100 (+)`. */
export function formatSpan(start, end, strand) {
  return `${formatCount(start)}–${formatCount(end)} (${strand})`;
}

/** Escape a CSV field. */
export function csvField(value) {
  if (value === null || value === undefined) return '';
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

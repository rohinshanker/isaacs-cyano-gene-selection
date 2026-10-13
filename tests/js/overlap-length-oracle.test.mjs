import { test } from 'node:test';
import assert from 'node:assert/strict';
import { endOverlapLengths } from '../../site/js/core/overlap-length.js';

function gene(segments, strand = '+') {
  return {
    id: 'focal', seqid: 'chr', strand,
    start: segments[0][0], end: segments.at(-1)[1], cdsSegments: segments,
  };
}

function partner(intervals, id = 'partner') {
  return {
    id, seqid: 'chr', strand: '-', biotype: 'tRNA', selectable: false,
    sharedIntervals: intervals.map(([from, to]) => ({ from, to })),
  };
}

function occupied(segments) {
  const result = new Set();
  for (const [from, to] of segments) {
    for (let base = from; base <= to; base += 1) result.add(base);
  }
  return result;
}

// Deliberately expands the tiny genome and walks one base at a time; does not
// share the production interval arithmetic or transcription-piece helper.
function oracle(focal, partners, length) {
  if (!partners || !['+', '-'].includes(focal.strand)) return null;
  const segments = focal.cdsSegments ?? [[focal.start, focal.end]];
  const own = occupied(segments);
  const wraps = segments.length > 1 && own.has(1) && own.has(length);
  if (wraps && segments.length > 2) return null;
  const first = wraps ? segments.at(-1)[0] : segments[0][0];
  const last = wraps ? segments[0][1] : segments.at(-1)[1];
  const shared = new Set(partners.flatMap(({ sharedIntervals }) =>
    [...occupied(sharedIntervals.map(({ from, to }) => [from, to]))]));
  const walk = (start, step) => {
    let base = start;
    let count = 0;
    while (count < own.size && own.has(base) && shared.has(base)) {
      count += 1;
      base += step;
      if (base > length) base = 1;
      if (base < 1) base = length;
    }
    return count;
  };
  const left = walk(first, 1);
  const right = walk(last, -1);
  const fivePrimeNt = focal.strand === '+' ? left : right;
  const threePrimeNt = focal.strand === '+' ? right : left;
  return { fivePrimeNt, threePrimeNt, totalNt: fivePrimeNt + threePrimeNt };
}

test('end lengths union partners but exclude internal-only coverage and real CDS gaps', () => {
  const focal = gene([[10, 30]]);
  const partners = [partner([[10, 12]], 'A'), partner([[12, 15]], 'B'),
    partner([[18, 22]], 'C'), partner([[29, 30]], 'D')];
  assert.deepEqual(endOverlapLengths(focal, partners, 100),
    { fivePrimeNt: 6, threePrimeNt: 2, totalNt: 8 });
  assert.deepEqual(endOverlapLengths({ ...focal, strand: '-' }, partners, 100),
    { fivePrimeNt: 2, threePrimeNt: 6, totalNt: 8 });
  const split = gene([[10, 15], [20, 30]]);
  assert.deepEqual(endOverlapLengths(split, [partner([[10, 15], [20, 30]])], 100),
    { fivePrimeNt: 6, threePrimeNt: 11, totalNt: 17 });
  const onePiece = { ...focal, cdsSegments: null };
  assert.deepEqual(endOverlapLengths(onePiece, [partner([[18, 22]])], 100),
    { fivePrimeNt: 0, threePrimeNt: 0, totalNt: 0 });
});

test('origin crossing is continuous and complete coverage contributes to both ends', () => {
  for (const strand of ['+', '-']) {
    const focal = gene([[1, 5], [95, 100]], strand);
    const full = [partner([[1, 5], [95, 100]])];
    assert.deepEqual(endOverlapLengths(focal, full, 100),
      { fivePrimeNt: 11, threePrimeNt: 11, totalNt: 22 });
    const partial = [partner([[1, 2], [95, 100]]), partner([[5, 5]], 'last')];
    assert.deepEqual(endOverlapLengths(focal, partial, 100), oracle(focal, partial, 100));
  }
  assert.deepEqual(endOverlapLengths(gene([[7, 7]]), [partner([[7, 7]])], 100),
    { fivePrimeNt: 1, threePrimeNt: 1, totalNt: 2 });
});

test('unavailable orientation, layer and origin order never become measured zeros', () => {
  const focal = gene([[10, 30]]);
  assert.equal(endOverlapLengths(focal, undefined, 100), null);
  assert.equal(endOverlapLengths(focal, null, 100), null);
  assert.equal(endOverlapLengths({ ...focal, strand: null }, [], 100), null);
  assert.equal(endOverlapLengths(gene([[1, 5], [40, 45], [95, 100]]), [], 100), null);
  assert.deepEqual(endOverlapLengths(focal, [], 100),
    { fivePrimeNt: 0, threePrimeNt: 0, totalNt: 0 });
});

test('3,000 seeded segment unions agree with an independent per-base oracle', () => {
  let seed = 2973;
  const random = (max) => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return (seed >>> 8) % max;
  };
  const intervals = (bases) => {
    const result = [];
    for (const base of [...bases].sort((a, b) => a - b)) {
      const previous = result.at(-1);
      if (previous && previous[1] === base - 1) previous[1] = base;
      else result.push([base, base]);
    }
    return result;
  };
  for (let trial = 0; trial < 3000; trial += 1) {
    const length = 8 + random(40);
    const own = new Set(Array.from({ length }, (_, index) => index + 1)
      .filter(() => random(7) < 5));
    if (!own.size) own.add(1 + random(length));
    const focal = gene(intervals(own), random(2) ? '+' : '-');
    const partners = Array.from({ length: random(5) }, (_, index) =>
      partner(intervals(new Set([...own].filter(() => random(4) < 3))), `P${index}`))
      .filter((entry) => entry.sharedIntervals.length > 0);
    const expected = oracle(focal, partners, length);
    assert.deepEqual(endOverlapLengths(focal, partners, length), expected,
      JSON.stringify({ trial, length, focal, partners }));
    assert.deepEqual(endOverlapLengths(focal, [...partners].reverse(), length), expected);
    if (partners.length) {
      assert.deepEqual(endOverlapLengths(focal, [...partners, partners[0]], length), expected);
    }
  }
});

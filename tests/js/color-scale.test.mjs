/**
 * The colour ramp under a chosen value scale: which scale each metric of the
 * shipped release opens on, that the logarithmic default actually spreads the
 * skewed measurements across the ramp, that a diverging metric keeps zero at its
 * centre under every scale it is offered, and that the legend labels the ramp in
 * the metric's own units at the positions the scale puts them.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { loadDataset } from '../../site/js/core/dataset.js';
import {
  buildMetricRegistry, metricValues, metricsInDisplayOrder,
} from '../../site/js/core/metric-registry.js';
import {
  VALUE_SCALES, defaultValueScale, valueScaleAvailability, valueScaleTransform,
} from '../../site/js/core/value-scales.js';
import {
  RAMP_BUCKET_COUNT, buildColorScale, isDivergingRamp,
} from '../../site/js/ui/colors.js';
import {
  describeValueScale, rampScaleLabel, rampTicks, renderLegend,
} from '../../site/js/ui/legend.js';
import { formatValue } from '../../site/js/ui/format.js';
import { fileFetch } from './helpers.mjs';
import { withFakeDocument } from './fake-dom.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const SITE_DATA_DIR = resolve(HERE, '../../site/data');

let cached = null;
/** The shipped release, loaded once: this file's subject is that release. */
async function shipped() {
  if (!cached) {
    const dataset = await loadDataset({
      baseUrl: `file://${SITE_DATA_DIR}/`, fetchImpl: fileFetch(),
    });
    cached = {
      dataset,
      registry: buildMetricRegistry(dataset.meta, dataset.genes, dataset.baseline),
    };
  }
  return cached;
}

/** A metric's whole column, its ramp family, and the scale it opens on. */
async function columnOf(key) {
  const { dataset, registry } = await shipped();
  const metric = registry.byKey.get(key);
  assert.ok(metric, `the shipped release must publish ${key}`);
  const values = metricValues(metric, dataset.genes.length);
  const centred = isDivergingRamp(values, metric.scale);
  return { metric, values, centred, options: { label: metric.label, centred } };
}

/** The ramp built over `key` under `scale`, exactly as `colorModel` builds it. */
async function rampOf(key, scale) {
  const { metric, values } = await columnOf(key);
  return {
    metric,
    values,
    scale: buildColorScale(values, {
      scale: metric.scale, transform: valueScaleTransform(scale, values),
    }),
  };
}

/** How the valued genes fall across the ramp's buckets, read from the ramp. */
function bucketOccupancy(values, scale) {
  const counts = new Array(RAMP_BUCKET_COUNT).fill(0);
  let valued = 0;
  for (let index = 0; index < values.length; index += 1) {
    const bucket = scale.bucketOf(values[index]);
    if (bucket < 0) continue;
    counts[bucket] += 1;
    valued += 1;
  }
  return {
    valued,
    occupied: counts.filter((count) => count > 0).length,
    biggestShare: Math.max(...counts) / valued,
  };
}

/**
 * The default rule is a rule and not a list, so what has to be pinned is which
 * metrics it selects on the data that actually ships. A change in the data that
 * moves a metric across the 90% line is then seen here, in review, rather than
 * discovered in the picture.
 */
test('the shipped release opens logarithmic on thirteen metrics, symmetric log on seven, linear on the rest', async () => {
  const { dataset, registry } = await shipped();
  const chosen = new Map();
  for (const metric of metricsInDisplayOrder(registry)) {
    const values = metricValues(metric, dataset.genes.length);
    const centred = isDivergingRamp(values, metric.scale);
    chosen.set(metric.key, defaultValueScale(values, { centred }));
  }
  const keysFor = (scale) => [...chosen]
    .filter(([, value]) => value === scale).map(([key]) => key).sort();

  // Every ingested PCC 7942 layer is skewed enough for the rule. Eleven are
  // strictly positive and open logarithmic; the other five (GSE222067 control,
  // GSE327989, the three GSE89999 layers) report zeros, so they open symmetric log.
  assert.deepEqual(keysFor('log10'), [
    'exprGse104203ClearDay', 'exprGse104203HighLightPulse', 'exprGse104203LowLight', 'exprGse104203ShadePulse',
    'exprGse222067Salt', 'exprGse288532Day', 'exprGse288532Night',
    'exprGse79726Control', 'exprGse79726NMinus', 'exprGse79726NPlus',
    'expression', 'protPxd062851Dia', 'tssInitiation',
  ]);
  assert.deepEqual(keysFor('symlog'), [
    'exprGse222067Control', 'exprGse327989Wt',
    'exprGse89999Dark', 'exprGse89999Dawn', 'exprGse89999Dusk',
    'neighborDownstreamNt', 'neighborUpstreamNt',
  ]);
  assert.deepEqual(keysFor('sqrt'), []);
  assert.deepEqual(keysFor('percentile'), []);
  // Rare codon count is the near miss: 76% of its genes fall in the lowest tenth
  // of its range, under the 90% the rule asks for, so it opens linear and the
  // reader can still choose otherwise.
  assert.equal(chosen.get('rareCount'), 'linear');
  assert.equal(chosen.get('gc3'), 'linear');
  // Everything else, including every recoding-scheme metric, opens linear.
  const nonLinear = new Set([...keysFor('log10'), ...keysFor('symlog')]);
  for (const metric of registry.metrics) {
    if (nonLinear.has(metric.key)) continue;
    assert.equal(chosen.get(metric.key), 'linear', `${metric.key} should open linear`);
  }
});

test('the logarithmic default is what spreads the skewed measurements across the ramp', async () => {
  // The measured evidence for the owner's ask: on a linear ramp one bucket in 48
  // holds six genes in seven, and no more than a third of the ramp is used at
  // all. Under the default logarithmic scale no bucket holds more than a
  // twelfth, and nearly every bucket is in play.
  for (const key of ['tssInitiation', 'expression']) {
    const linear = await rampOf(key, 'linear');
    const logarithmic = await rampOf(key, 'log10');
    const flat = bucketOccupancy(linear.values, linear.scale);
    const spread = bucketOccupancy(logarithmic.values, logarithmic.scale);

    assert.equal(flat.valued, spread.valued, 'a scale never changes which genes have a value');
    assert.ok(flat.biggestShare > 0.8, `${key} linear should crowd one bucket`);
    assert.ok(spread.biggestShare <= 0.08,
      `${key} logarithmic should hold no bucket above 8%, got ${spread.biggestShare}`);
    assert.ok(spread.occupied >= 40,
      `${key} logarithmic should use most of the ramp, got ${spread.occupied}`);
    assert.ok(spread.occupied > flat.occupied * 2);
  }
});

test('a scale changes the colour a value takes and never the value', async () => {
  const { values } = await columnOf('tssInitiation');
  const raw = [...values];
  const scales = ['linear', 'log10', 'percentile', 'sqrt', 'symlog'];
  const colours = new Set();
  for (const name of scales) {
    const { scale } = await rampOf('tssInitiation', name);
    assert.deepEqual([...values], raw, `${name} must not touch the column it reads`);
    colours.add(scale.color(828));
    // A gene with no value is never given a ramp colour under any scale.
    assert.equal(scale.bucketOf(NaN), -1);
  }
  assert.equal(colours.size, scales.length, 'each scale paints the median a different colour');
});

test('a diverging metric stays centred on zero under every scale offered for it', async () => {
  const { metric, values, options } = await columnOf('neighborDownstreamNt');
  const availability = valueScaleAvailability(values, options);
  assert.equal(options.centred, true);
  // The two scales this metric cannot take are refused, not approximated.
  assert.equal(availability.get('log10').available, false);
  assert.equal(availability.get('sqrt').available, false);

  for (const name of ['linear', 'percentile', 'symlog']) {
    assert.equal(availability.get(name).available, true, name);
    const scale = buildColorScale(values, {
      scale: metric.scale, transform: valueScaleTransform(name, values),
    });
    assert.equal(scale.diverging, true, name);
    assert.equal(scale.scaleName, name);
    // Zero sits exactly at the ramp's midpoint, so grey means zero and the sign
    // of a colour is the sign of the value.
    assert.ok(Math.abs(scale.normalize(0) - 0.5) < 1e-12, `${name} centres zero`);
    assert.equal(scale.mid, 0);
    // And the sign of a colour is the sign of the value: the same distance below
    // and above zero lands on opposite arms of the ramp.
    assert.ok(scale.normalize(-1000) < 0.5, name);
    assert.ok(scale.normalize(1000) > 0.5, name);
  }
});

test('the symmetric-log default reaches the neighbour distances a linear ramp flattens', async () => {
  for (const key of ['neighborDownstreamNt', 'neighborUpstreamNt']) {
    const linear = await rampOf(key, 'linear');
    const symmetric = await rampOf(key, 'symlog');
    // One deterministic threshold per metric, from the median non-zero magnitude.
    assert.equal(symmetric.scale.scaleTransition, 10);
    const flat = bucketOccupancy(linear.values, linear.scale);
    const spread = bucketOccupancy(symmetric.values, symmetric.scale);
    assert.ok(flat.biggestShare > 0.7, `${key} linear should crowd one bucket`);
    assert.ok(spread.biggestShare < 0.15, `${key} symmetric log should not, got ${spread.biggestShare}`);
    assert.ok(spread.occupied > flat.occupied * 2);
  }
});

test('a ramp asked for a scale its column cannot take falls back and says which scale it drew', async () => {
  // What a hand-edited link can produce: `csc=log10` on a metric with a zero.
  const { metric, values } = await columnOf('rareCount');
  const scale = buildColorScale(values, {
    scale: metric.scale, transform: valueScaleTransform('log10', values),
  });
  assert.equal(scale.scaleName, 'linear', 'the ramp names the scale it actually drew');
  assert.equal(rampScaleLabel(scale), 'Linear');
  assert.equal(scale.min, 0);
});

test('the legend labels the ramp in the metric units at the positions the scale puts them', async () => {
  const logarithmic = await rampOf('tssInitiation', 'log10');
  const ticks = rampTicks(logarithmic.scale, logarithmic.metric);
  assert.equal(ticks.length, 3);
  assert.equal(ticks[0].position, 0);
  assert.equal(ticks[2].position, 1);
  // The ends are the metric's own extremes, not logarithms of them.
  assert.ok(Math.abs(ticks[0].value - 77.375) < 1e-6);
  assert.ok(Math.abs(ticks[2].value - 323995.75) < 1e-6);
  // The middle label is a decade, and it sits where that decade actually falls —
  // well past halfway, which is exactly the fact a linear reading would get
  // wrong.
  assert.equal(ticks[1].value, 10000);
  assert.ok(ticks[1].position > 0.55 && ticks[1].position < 0.62, String(ticks[1].position));

  // Linear keeps the three evenly spaced ticks it always had.
  const linear = await rampOf('gc3', 'linear');
  assert.deepEqual(rampTicks(linear.scale, linear.metric).map((tick) => tick.position), [0, 0.5, 1]);
  assert.equal(rampTicks(linear.scale, linear.metric)[1].value, linear.scale.mid);

  // A diverging ramp labels its centre zero under a nonlinear scale too.
  const symmetric = await rampOf('neighborDownstreamNt', 'symlog');
  assert.deepEqual(rampTicks(symmetric.scale, symmetric.metric)[1],
    { value: 0, position: 0.5, text: '0', row: 0 });

  // Percentile labels a value some gene really has, at the rank it really holds.
  const ranked = await rampOf('tssInitiation', 'percentile');
  const middle = rampTicks(ranked.scale, ranked.metric)[1];
  assert.equal(middle.position, 0.5);
  assert.ok(middle.value > 800 && middle.value < 860, `median-ish value, got ${middle.value}`);
  assert.ok(ranked.values.includes(middle.value), 'the label is a value in the cohort');
});

/**
 * The property the legend rests on, over everything that ships: a tick sits
 * exactly where the scale puts its own value. It is what makes a label unable to
 * disagree with the colour beside it, and it is checked by construction rather
 * than metric by metric, because the failures it replaces were all in the gap
 * between an approximate inverse and the ramp position a value really takes.
 */
test('every tick of every shipped metric sits at normalize(its own value)', async () => {
  const { dataset, registry } = await shipped();
  let checked = 0;
  for (const metric of metricsInDisplayOrder(registry)) {
    const values = metricValues(metric, dataset.genes.length);
    const centred = isDivergingRamp(values, metric.scale);
    const availability = valueScaleAvailability(values, { label: metric.label, centred });
    for (const name of VALUE_SCALES) {
      if (!availability.get(name).available) continue;
      const scale = buildColorScale(values, {
        scale: metric.scale, transform: valueScaleTransform(name, values),
      });
      const ticks = rampTicks(scale, metric);
      assert.ok(ticks.length > 0, `${metric.key} ${name} labels its ramp`);
      for (const tick of ticks) {
        assert.equal(tick.position, scale.normalize(tick.value),
          `${metric.key} ${name}: ${tick.value} is labelled at ${tick.position} `
            + `but coloured at ${scale.normalize(tick.value)}`);
        assert.equal(tick.text, formatValue(metric, tick.value));
        checked += 1;
      }
      // Ticks read left to right, and no two labels overlap: a crowded one takes
      // the second row rather than being nudged off its own position.
      for (let index = 1; index < ticks.length; index += 1) {
        assert.ok(ticks[index].position >= ticks[index - 1].position, `${metric.key} ${name} order`);
      }
      const rows = new Map();
      for (const tick of ticks) {
        const row = rows.get(tick.row) ?? [];
        row.push(tick);
        rows.set(tick.row, row);
      }
      for (const row of rows.values()) {
        for (let index = 1; index < row.length; index += 1) {
          const gap = (row[index].position - row[index - 1].position) * 196;
          assert.ok(gap > 4, `${metric.key} ${name} crowds two labels ${gap}px apart`);
        }
      }
    }
  }
  // The sweep is the evidence, so it has to have swept something.
  assert.ok(checked > 600, `only ${checked} ticks checked`);
});

/**
 * A padded arm can bring two labels within a few pixels of each other, and the
 * answer is never to move one along the ramp: the upstream distance's lowest
 * value sits at 43% and zero at 50%, so zero drops to a second row at its own
 * position and both readings survive.
 */
test('two crowded tick labels stack rather than one moving off its position', async () => {
  const upstream = await rampOf('neighborUpstreamNt', 'percentile');
  const ticks = rampTicks(upstream.scale, upstream.metric);
  assert.deepEqual(ticks.map((tick) => [tick.text, tick.row]),
    [['-103', 0], ['0', 1], ['6,375', 0]]);
  for (const tick of ticks) {
    assert.equal(tick.position, upstream.scale.normalize(tick.value));
  }

  // And the rendered row says so, so the second line has somewhere to go.
  await withFakeDocument((document) => {
    const host = document.createElement('div');
    renderLegend(host, {
      metric: upstream.metric,
      scale: upstream.scale,
      missingCount: 0,
      hiddenCount: 0,
      showHidden: false,
      provenanceNote: null,
    });
    const row = host.querySelector('.legend-ticks');
    assert.ok(row.className.includes('stacked'), 'the row is given room for two lines');
    assert.deepEqual(row.children.map((tick) => tick.className),
      ['', 'below', 'at-end']);
    assert.deepEqual(row.children.map((tick) => tick.style.left),
      ['43.46%', '50.00%', '100.00%']);
  });
});

/**
 * The three readings an independent review found wrong, pinned as values. Each
 * came from inverting an interpolated quantile under a rank convention that is
 * not the one `apply` uses, so the label named a value whose colour was
 * somewhere else on the ramp.
 */
test('percentile labels no longer name a value the colour beside them is not', async () => {
  // A padded diverging arm: -116 is the lowest value there is, and it takes the
  // colour at 38.7% of the ramp, not the one at the very start.
  const downstream = await rampOf('neighborDownstreamNt', 'percentile');
  const [lowest] = rampTicks(downstream.scale, downstream.metric);
  assert.equal(lowest.value, -116);
  assert.ok(Math.abs(lowest.position - 0.3872) < 1e-3, String(lowest.position));
  assert.equal(lowest.position, downstream.scale.normalize(-116));
  // Zero still gets its label at the centre, which is what makes the diverging
  // centre readable.
  const zero = rampTicks(downstream.scale, downstream.metric)
    .find((tick) => tick.value === 0);
  assert.deepEqual(zero, { value: 0, position: 0.5, text: '0', row: 0 });

  // A heavily tied column: the middle label is a size some operon really has,
  // where that size is actually coloured.
  const operons = await rampOf('operonSize', 'percentile');
  const middle = rampTicks(operons.scale, operons.metric)[1];
  assert.equal(middle.value, 2);
  assert.ok(Math.abs(middle.position - 0.3521) < 1e-3, String(middle.position));
  assert.equal(middle.position, operons.scale.normalize(2));

  // A long upper tail: the top label is the maximum, which is what takes the end
  // colour, and not the midpoint between the two largest values.
  const initiation = await rampOf('tssInitiation', 'percentile');
  const highest = rampTicks(initiation.scale, initiation.metric).at(-1);
  assert.ok(Math.abs(highest.value - 323995.75) < 1e-6, String(highest.value));
  assert.equal(highest.position, 1);
  assert.equal(initiation.scale.max, highest.value);
});

/**
 * The end ticks are the metric's own extremes, because the extreme genes take the
 * end colours. Under Percentile they were neither: `invert` interpolated between
 * two ranks, so the lowest label was a value between the two smallest genes and
 * the highest a value between the two largest — TSS initiation read 79.0 and
 * 221,305 against a true 77.375 and 323,995.75, and rare codons read 149 against
 * a true 169. An inverse that returns the cohort's own value at a rank cannot do
 * that, and this sweeps every metric a ramp does not pad rather than the three
 * that were measured.
 */
test('the end ticks are the column\'s own minimum and maximum under every scale', async () => {
  const { dataset, registry } = await shipped();
  let checked = 0;
  for (const metric of metricsInDisplayOrder(registry)) {
    const values = metricValues(metric, dataset.genes.length);
    // A diverging ramp pads the shorter of its arms to keep zero at the centre,
    // so its extreme values are labelled where they truly fall rather than at
    // the ramp's ends; that case is pinned above, on the downstream distance.
    if (isDivergingRamp(values, metric.scale)) continue;
    let low = Infinity;
    let high = -Infinity;
    for (let index = 0; index < values.length; index += 1) {
      const value = values[index];
      if (!Number.isFinite(value)) continue;
      if (value < low) low = value;
      if (value > high) high = value;
    }
    if (!Number.isFinite(low) || low === high) continue;
    const availability = valueScaleAvailability(values, { label: metric.label });
    for (const name of VALUE_SCALES) {
      if (!availability.get(name).available) continue;
      const scale = buildColorScale(values, {
        scale: metric.scale, transform: valueScaleTransform(name, values),
      });
      const ticks = rampTicks(scale, metric);
      // A transform and its inverse are exact in the reals and not in binary
      // floating point — 10 ** Math.log10(77.375) is 77.37499999999999 — so the
      // claim here is that the end tick's value is the extreme to well within a
      // last bit. That the label is that value's own formatting is the sweep
      // above, which asserts `text === formatValue(metric, value)` for every
      // tick; the two together are what a reader reads at the end of the ramp.
      const same = (tick, extreme) => {
        assert.ok(Math.abs(tick.value - extreme) <= 1e-9 * Math.max(1, Math.abs(extreme)),
          `${metric.key} ${name}: ${tick.value} is not the extreme ${extreme}`);
      };
      same(ticks[0], low);
      same(ticks.at(-1), high);
      // And at the ramp's ends, to the same dust: `rampTicks` pins a label
      // inside the ramp within 1e-6 of an end rather than assuming 0 or 1.
      assert.ok(Math.abs(ticks[0].position) < 1e-6, String(ticks[0].position));
      assert.ok(Math.abs(ticks.at(-1).position - 1) < 1e-6, String(ticks.at(-1).position));
      checked += 1;
    }
  }
  assert.ok(checked > 40, `only ${checked} metric-scale pairs checked`);

  // The two readings the rendered inspection measured, as values.
  const initiation = await rampOf('tssInitiation', 'percentile');
  const ends = rampTicks(initiation.scale, initiation.metric);
  assert.ok(Math.abs(ends[0].value - 77.375) < 1e-6, String(ends[0].value));
  assert.ok(Math.abs(ends.at(-1).value - 323995.75) < 1e-6, String(ends.at(-1).value));
  const rare = await rampOf('rareCount', 'percentile');
  const rareEnds = rampTicks(rare.scale, rare.metric);
  assert.deepEqual(rareEnds.map((tick) => tick.value).filter((_, index, all) => index === 0
    || index === all.length - 1), [0, 169]);
});

test('the legend note names the scale, and states what each scale needs explaining', async () => {
  const symmetric = await rampOf('neighborDownstreamNt', 'symlog');
  const note = describeValueScale(symmetric.metric, symmetric.scale);
  assert.match(note, /^Scale: Symmetric log\./);
  assert.match(note,
    /read Downstream-neighbor distance in its own units, at the positions this scale puts them/);
  assert.match(note, /no stored value changes/);
  // The wording promises what the formula actually does: approximately linear
  // near zero, logarithmic far from it, and no exact linear interval anywhere.
  assert.match(note, /approximately linear for values well inside ±10 nt of zero/);
  assert.match(note, /logarithmic for values well outside it/);
  assert.match(note, /turning from one into the other around ±10 nt/);
  assert.match(note, /no exact linear interval and no kink in the colour/);
  assert.equal(/read linearly/.test(note), false);

  const ranked = await rampOf('tssInitiation', 'percentile');
  assert.match(describeValueScale(ranked.metric, ranked.scale), /^Scale: Percentile\./);
  assert.match(describeValueScale(ranked.metric, ranked.scale),
    /rank against every gene that has a value/);

  const logarithmic = await rampOf('tssInitiation', 'log10');
  const plain = describeValueScale(logarithmic.metric, logarithmic.scale);
  assert.match(plain, /^Scale: Logarithmic\./);
  // Only a scale with something extra to explain says more than its name.
  assert.equal(plain.includes('linear'), false);
});

test('the rendered legend puts the scale beside the ramp and each tick at its own position', async () => {
  const logarithmic = await rampOf('tssInitiation', 'log10');
  await withFakeDocument((document) => {
    const host = document.createElement('div');
    renderLegend(host, {
      metric: logarithmic.metric,
      scale: logarithmic.scale,
      missingCount: 988,
      hiddenCount: 0,
      showHidden: false,
      provenanceNote: null,
    });

    // The name reads beside the ramp, in the same row as the canvas.
    const row = host.querySelector('.legend-ramp-row');
    assert.ok(row, 'the ramp and its scale name share a row');
    assert.equal(row.querySelector('canvas.legend-ramp') !== null, true);
    assert.equal(row.querySelector('.legend-scale-name').textContent, 'Logarithmic');
    assert.match(row.querySelector('canvas').getAttribute('aria-label'),
      /^Logarithmic colour scale from 77\.4 to 323,996 summed mean TSS counts$/);

    // Every tick carries its own left offset, and only the ends are pulled back
    // inside the ramp's width.
    const ticks = host.querySelector('.legend-ticks').children;
    assert.equal(ticks.length, 3);
    assert.deepEqual(ticks.map((tick) => tick.textContent), ['77.4', '10,000', '323,996']);
    assert.deepEqual(ticks.map((tick) => tick.style.left), ['0.00%', '58.29%', '100.00%']);
    assert.deepEqual(ticks.map((tick) => tick.className), ['at-start', '', 'at-end']);

    // The note below the ramp names the scale as well, for a reader who is
    // reading rather than glancing.
    assert.match(host.querySelector('.legend-scale-note').textContent, /^Scale: Logarithmic\./);
    // The ramp is painted from the ramp's own buckets, in ramp order.
    const { fills } = row.querySelector('canvas');
    assert.equal(fills.length, 196);
    assert.equal(fills[0].fill, logarithmic.scale.buckets[0]);
    assert.equal(fills.at(-1).fill, logarithmic.scale.buckets.at(-1));
  });
});

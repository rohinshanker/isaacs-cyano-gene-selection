import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  FULL_HOLD_MS, LOAD_BAR_GENES, LOAD_BAR_VIEW, LoadProgress, describeIdentity, describeLoad,
  displayedFraction, loadBarGenes, loadFraction, loadGeneAttributes, loadSchedule,
} from '../../site/js/ui/load-progress.js';
import { DATA_FILES, FILE_STATE } from '../../site/js/core/data-files.js';
import { CATEGORICAL } from '../../site/js/ui/colors.js';
import { withFakeDocument } from './fake-dom.mjs';

const IDENTITY = { releaseId: 'GCF_000817325.1-RS_2026_05_13', geneCount: 2715 };

function snapshot(overrides = {}) {
  return {
    receivedBytes: 0, totalBytes: 1000, exact: true, settledFiles: 0, totalFiles: 13,
    currentTier: 1, tiers: {}, elapsedMs: 0, ...overrides,
  };
}

function mount(document, handlers = {}, options = {}) {
  const stage = document.createElement('div');
  const bar = document.createElement('div');
  const tail = document.createElement('div');
  stage.append(bar);
  return { stage, bar, tail, progress: new LoadProgress({ stage, bar, tail }, handlers, options) };
}

/** A frame and timeout queue advanced by hand. */
function clock() {
  let time = 0;
  let requested = 0;
  let frames = [];
  let timers = [];
  return {
    now: () => time,
    requestFrame(callback) { requested += 1; frames.push(callback); },
    setTimeout(callback, delay) { timers.push({ callback, at: time + delay }); },
    advance(ms) {
      time += ms;
      const readyFrames = frames;
      frames = [];
      for (const callback of readyFrames) callback();
      const readyTimers = timers.filter((timer) => timer.at <= time);
      timers = timers.filter((timer) => timer.at > time);
      for (const timer of readyTimers) timer.callback();
    },
    get time() { return time; },
    get requested() { return requested; },
    get waiting() { return frames.length; },
  };
}

/** Per-file records as the loader keeps them, all ready unless overridden. */
function records(overrides = {}) {
  const files = {};
  for (const file of DATA_FILES) files[file.key] = { state: FILE_STATE.READY, error: null, blockedBy: null };
  return { ...files, ...overrides };
}

test('the bar\'s genes tile the track left to right and are the same on every load', () => {
  const genes = loadBarGenes();
  assert.equal(genes.length, LOAD_BAR_GENES);
  assert.deepEqual(loadBarGenes(), genes, 'deterministic, so the bar never flickers between loads');
  assert.notDeepEqual(loadBarGenes(LOAD_BAR_GENES, 7), genes, 'the seed is what decides the picture');
  assert.equal(genes[0].x, 0);
  for (let i = 1; i < genes.length; i += 1) {
    assert.ok(Math.abs(genes[i].x - (genes[i - 1].x + genes[i - 1].width + LOAD_BAR_VIEW.gap)) < 1e-9);
    assert.ok(genes[i].at > genes[i - 1].at, 'each gene lights after the one before it');
  }
  const last = genes.at(-1);
  assert.ok(Math.abs(last.x + last.width - LOAD_BAR_VIEW.width) < 1e-6, 'the last gene ends the track');
  assert.ok(Math.abs(last.at - 1) < 1e-9);
  assert.ok(genes.every((gene) => gene.width > 0 && CATEGORICAL.includes(gene.color)));
  assert.ok(genes.some((gene) => gene.lane === 'above') && genes.some((gene) => gene.lane === 'below'));
  assert.equal(loadBarGenes(5).length, 5);
});

test('the loading schedule is deterministic, uneven, and fills near the minimum', () => {
  assert.deepEqual(loadSchedule(1500), loadSchedule(1500));
  assert.notDeepEqual(loadSchedule(1500), loadSchedule(1500, 7));
  assert.deepEqual(loadSchedule(0), []);
  assert.deepEqual(loadSchedule(-1), []);
  for (const seed of [1, 7, 2973, 9999]) {
    const schedule = loadSchedule(1500, seed);
    assert.ok(schedule.length >= 7 && schedule.length <= 12);
    assert.ok(schedule[0].atMs > 0);
    assert.equal(schedule.at(-1).fraction, 1);
    assert.ok(schedule.at(-1).atMs >= 1350 && schedule.at(-1).atMs <= 1500);
    for (let index = 1; index < schedule.length; index += 1) {
      assert.ok(schedule[index].atMs > schedule[index - 1].atMs);
      assert.ok(schedule[index].fraction > schedule[index - 1].fraction);
    }
    const fractions = schedule.map((step, index) => step.fraction - (schedule[index - 1]?.fraction ?? 0));
    assert.ok(Math.max(...fractions) >= 0.2, 'there is a visible jump');
    assert.ok(Math.min(...fractions) <= 0.05, 'and a visibly small block');
    const pauses = schedule.map((step, index) => step.atMs - (schedule[index - 1]?.atMs ?? 0));
    const median = [...pauses].sort((a, b) => a - b)[Math.floor(pauses.length / 2)];
    assert.ok(Math.max(...pauses) > median * 1.5, 'one pause is noticeably longer than the median');
  }
});

test('displayed progress obeys both time and data without moving backwards', () => {
  const schedule = loadSchedule(1500);
  assert.equal(displayedFraction(0.42, 10, []), 0.42, 'no minimum shows real progress');
  let previous = 0;
  for (let index = 0; index <= 60; index += 1) {
    const real = index / 60;
    const displayed = displayedFraction(real, index * 30, schedule);
    assert.ok(displayed <= real);
    assert.ok(displayed >= previous);
    previous = displayed;
  }
  const largestBlock = Math.max(...schedule.map((step, index) => (
    step.fraction - (schedule[index - 1]?.fraction ?? 0)
  )));
  for (let real = 0.01; real <= 1; real += 0.01) {
    const displayed = displayedFraction(real, 1500, schedule);
    assert.ok(real - displayed <= largestBlock + 1e-12,
      'once time is no constraint, a slow load trails by no more than one block');
  }
});

test('progress is bytes against the manifest, or files when sizes are unknown', () => {
  assert.equal(loadFraction(null), 0);
  assert.equal(loadFraction(snapshot({ receivedBytes: 250 })), 0.25);
  assert.equal(loadFraction(snapshot({ receivedBytes: 2000 })), 1, 'never past full');
  assert.equal(loadFraction(snapshot({ receivedBytes: -5 })), 0);
  // Without a manifest no size is known in advance, so the bar counts files.
  assert.equal(loadFraction(snapshot({ exact: false, settledFiles: 13 })), 1);
  assert.ok(Math.abs(loadFraction(snapshot({ exact: false, settledFiles: 4 })) - 4 / 13) < 1e-12);
  assert.equal(loadFraction(snapshot({ exact: true, totalBytes: 0, settledFiles: 13 })), 1);
  assert.equal(loadFraction(snapshot({ exact: false, totalFiles: 0 })), 0);

  const files = {
    genes: { receivedBytes: 80, bytes: 100, settled: false },
    meta: { receivedBytes: 50, bytes: 50, settled: true },
  };
  assert.equal(loadFraction(snapshot({ files }), ['genes', 'meta']), 130 / 150);
  assert.equal(loadFraction(snapshot({ exact: false, files }), ['genes', 'meta']), 0.5);
  assert.equal(loadFraction(snapshot({ files }), ['missing']), 0,
    'an absent key contributes neither bytes nor a settled file');
  assert.equal(loadFraction(snapshot({ files }), []), 0);
  assert.equal(loadFraction(snapshot({ files: { genes: { receivedBytes: 200, bytes: 100 } } }), ['genes']), 1);
});

test('the bar says which tier is loading, how far, and what the release is', () => {
  assert.equal(describeLoad(null), 'Loading complete, 0%.');
  assert.equal(describeLoad(snapshot({ receivedBytes: 430 })), 'Loading genes, 43%.');
  assert.equal(describeLoad(snapshot({ receivedBytes: 900, currentTier: 3 }), IDENTITY),
    'Loading per-gene evidence, 90%. Release GCF_000817325.1-RS_2026_05_13, 2,715 genes.');
  assert.equal(describeLoad(snapshot({ receivedBytes: 1000, currentTier: null })),
    'Loading complete, 100%.');
  assert.equal(describeIdentity(null), '');
  assert.equal(describeIdentity({ releaseId: null, geneCount: 12 }), '12 genes');
  assert.equal(describeIdentity({ releaseId: 'R1', geneCount: NaN }), 'Release R1');
  assert.equal(describeLoad(snapshot({
    receivedBytes: 900,
    files: { genes: { receivedBytes: 10, bytes: 100, settled: false } },
  }), null, ['genes']), 'Loading genes, 10%.');
});

test('an instant load advances in blocks and finishes only after the full hold', async () => {
  await withFakeDocument(async (document) => {
    const manual = clock();
    const previousTimeout = globalThis.setTimeout;
    globalThis.setTimeout = (callback, delay) => manual.setTimeout(callback, delay);
    try {
      const { bar, progress } = mount(document, {}, {
        minimumMs: 1500, now: manual.now, requestFrame: manual.requestFrame,
      });
      const marks = bar.querySelectorAll('rect.load-gene');
      const lit = () => marks.filter((mark) => mark.hasClass('is-on')).length;
      progress.update(snapshot({ receivedBytes: 1000, currentTier: null }));
      const done = progress.finished();
      assert.equal(done, progress.finished(), 'one cycle always returns the same promise');
      let finished = false;
      done.then(() => { finished = true; });
      const seen = new Set([lit()]);
      for (const step of loadSchedule(1500)) {
        manual.advance(step.atMs - manual.time + 0.001);
        seen.add(lit());
      }
      assert.ok(seen.size >= 6, 'several visibly distinct blocks crossed the bar');
      assert.equal(lit(), LOAD_BAR_GENES);
      assert.equal(manual.waiting, 0, 'the frame loop stops at full');
      await Promise.resolve();
      assert.equal(finished, false);
      manual.advance(FULL_HOLD_MS - 1);
      await Promise.resolve();
      assert.equal(finished, false);
      manual.advance(1);
      await done;
      assert.equal(finished, true);
    } finally {
      globalThis.setTimeout = previousTimeout;
    }
  });
});

test('the minimum is a floor: a longer one holds the full bar until it has passed', async () => {
  // The schedule's last block lands a little short of the minimum, by a share
  // that grows with it. With a two-second minimum the bar was full at about
  // 1.81 s and the page would have been revealed at 1.96 s, before the minimum.
  await withFakeDocument(async (document) => {
    const manual = clock();
    const previousTimeout = globalThis.setTimeout;
    globalThis.setTimeout = (callback, delay) => manual.setTimeout(callback, delay);
    try {
      const { progress } = mount(document, {}, {
        minimumMs: 2000, now: manual.now, requestFrame: manual.requestFrame,
      });
      progress.update(snapshot({ receivedBytes: 1000, currentTier: null }));
      let finished = false;
      const done = progress.finished();
      done.then(() => { finished = true; });
      const last = loadSchedule(2000).at(-1).atMs;
      assert.ok(last + FULL_HOLD_MS < 2000, 'the hold alone would end before the minimum');
      for (const step of loadSchedule(2000)) manual.advance(step.atMs - manual.time + 0.001);
      manual.advance(FULL_HOLD_MS);
      await Promise.resolve();
      assert.equal(finished, false, 'not before the minimum, however full the bar');
      manual.advance(2000 - manual.time - 1);
      await Promise.resolve();
      assert.equal(finished, false);
      manual.advance(1);
      await done;
      assert.equal(finished, true);
    } finally {
      globalThis.setTimeout = previousTimeout;
    }
  });
});

test('the genes lag while assistive technology reports real blocking progress', async () => {
  await withFakeDocument((document) => {
    const manual = clock();
    const { bar, progress } = mount(document, {}, {
      minimumMs: 1500, now: manual.now, requestFrame: manual.requestFrame,
    });
    progress.update(snapshot({ receivedBytes: 750 }));
    assert.equal(bar.getAttribute('aria-valuenow'), '75');
    assert.equal(bar.getAttribute('aria-valuetext'), 'Loading genes, 75%.');
    assert.equal(bar.querySelectorAll('rect.load-gene').filter((mark) => mark.hasClass('is-on')).length, 0);
    manual.advance(loadSchedule(1500)[0].atMs + 0.001);
    const lit = bar.querySelectorAll('rect.load-gene').filter((mark) => mark.hasClass('is-on')).length;
    assert.ok(lit > 0 && lit < LOAD_BAR_GENES * 0.75);
    assert.equal(bar.getAttribute('aria-valuenow'), '75', 'the accessible value is never paced');
  });
});

test('blocking files fill the stage while the tail continues to measure everything', async () => {
  await withFakeDocument(async (document) => {
    const { bar, tail, progress } = mount(document);
    progress.setBlocking(['genes', 'meta']);
    progress.update(snapshot({
      receivedBytes: 250,
      files: {
        genes: { receivedBytes: 100, bytes: 100, settled: true },
        meta: { receivedBytes: 50, bytes: 50, settled: true },
        later: { receivedBytes: 100, bytes: 850, settled: false },
      },
    }));
    assert.equal(bar.getAttribute('aria-valuenow'), '100');
    assert.equal(bar.querySelectorAll('rect.load-gene').every((mark) => mark.hasClass('is-on')), true);
    await progress.finished();
    progress.reveal();
    assert.equal(tail.querySelector('div.load-tail-fill').style.width, '25.0%',
      'the post-reveal tail remains whole-load progress');
  });
});

test('zero minimum requests no frames and finishes with real progress immediately', async () => {
  await withFakeDocument(async (document) => {
    const manual = clock();
    const { progress } = mount(document, {}, {
      minimumMs: 0, now: manual.now, requestFrame: manual.requestFrame,
    });
    assert.equal(manual.requested, 0);
    progress.update(snapshot({ receivedBytes: 1000, currentTier: null }));
    await progress.finished();
    assert.equal(manual.requested, 0);
  });
});

test('reveal stops the frame loop, and restart creates a new timed cycle', async () => {
  await withFakeDocument((document) => {
    const manual = clock();
    const { progress } = mount(document, {}, {
      minimumMs: 1500, now: manual.now, requestFrame: manual.requestFrame,
    });
    const first = progress.finished();
    assert.equal(manual.requested, 1);
    progress.reveal();
    manual.advance(100);
    assert.equal(manual.requested, 1, 'the queued callback requested no successor after reveal');
    progress.restart();
    assert.notEqual(progress.finished(), first);
    assert.equal(manual.requested, 2);
    progress.update(snapshot({ receivedBytes: 1000, currentTier: null }));
    manual.advance(loadSchedule(1500).at(-1).atMs - 1);
    assert.ok(progress.fraction < 1, 'restart measures its minimum from the restart time');
  });
});

test('the default frame function keeps the browser receiver', async () => {
  const previous = {
    requestAnimationFrame: globalThis.requestAnimationFrame,
    performance: globalThis.performance,
    setTimeout: globalThis.setTimeout,
  };
  const queue = [];
  let time = 0;
  const browserOnly = function browserOnly(callback) {
    if (this !== undefined && this !== globalThis) throw new TypeError('Illegal invocation');
    queue.push(callback);
  };
  globalThis.requestAnimationFrame = browserOnly;
  globalThis.setTimeout = (callback) => callback();
  Object.defineProperty(globalThis, 'performance', { value: { now: () => time }, configurable: true });
  try {
    await withFakeDocument(async (document) => {
      const { progress } = mount(document, {}, { minimumMs: 10 });
      progress.update(snapshot({ receivedBytes: 1000, currentTier: null }));
      while (queue.length > 0) {
        time += 2;
        queue.shift()();
      }
      await progress.finished();
    });
  } finally {
    globalThis.requestAnimationFrame = previous.requestAnimationFrame;
    globalThis.setTimeout = previous.setTimeout;
    Object.defineProperty(globalThis, 'performance', { value: previous.performance, configurable: true });
  }
});

test('the bar is a progressbar whose genes light from left to right as data arrives', async () => {
  await withFakeDocument((document) => {
    const { bar, tail, progress } = mount(document);
    assert.equal(bar.getAttribute('role'), 'progressbar');
    assert.equal(bar.getAttribute('aria-valuemin'), '0');
    assert.equal(bar.getAttribute('aria-valuemax'), '100');
    assert.equal(bar.getAttribute('aria-valuenow'), '0');
    assert.equal(bar.getAttribute('aria-label'), 'Loading the gene data');
    assert.equal(bar.querySelector('svg').getAttribute('aria-hidden'), 'true');
    assert.ok(bar.querySelector('line.load-chromosome-axis'), 'the axis is there before any gene');
    const marks = bar.querySelectorAll('rect.load-gene');
    assert.equal(marks.length, LOAD_BAR_GENES);
    assert.equal(marks.filter((mark) => mark.hasClass('is-on')).length, 0);
    assert.equal(tail.hidden, true);

    const lit = () => marks.map((mark) => mark.hasClass('is-on'));
    let before = 0;
    for (const received of [100, 400, 400, 750]) {
      progress.update(snapshot({ receivedBytes: received }));
      const now = lit();
      const count = now.filter(Boolean).length;
      assert.ok(count >= before);
      // Lit genes are a prefix: everything left of the front, nothing right of it.
      assert.equal(now.indexOf(false), count);
      before = count;
    }
    assert.ok(before > 0 && before < LOAD_BAR_GENES);
    assert.equal(bar.getAttribute('aria-valuenow'), '75');
    assert.equal(bar.getAttribute('aria-valuetext'), 'Loading genes, 75%.');

    progress.setIdentity(IDENTITY);
    progress.update(snapshot({ receivedBytes: 1000, currentTier: null }));
    assert.equal(lit().every(Boolean), true, 'every gene is lit at 100%');
    assert.match(bar.getAttribute('aria-valuetext'), /Release GCF_000817325\.1-RS_2026_05_13, 2,715 genes\./);
  });
});

test('after the reveal the tail reports later files without blocking, then leaves', async () => {
  await withFakeDocument((document) => {
    const { stage, tail, progress } = mount(document);
    progress.setIdentity(IDENTITY);
    progress.update(snapshot({ receivedBytes: 600, currentTier: 2 }));
    assert.equal(tail.hidden, true, 'the tail waits for the reveal');
    progress.setFiles(records());
    progress.reveal();
    assert.equal(stage.hidden, true, 'the stage gives way to the map');
    assert.equal(tail.hidden, false);
    assert.ok(!tail.hasClass('has-failures'), 'loading alone, the tail overlays and moves nothing');
    assert.equal(tail.querySelector('p').textContent,
      'Release GCF_000817325.1-RS_2026_05_13, 2,715 genes. Still loading function categories and filters.');
    assert.equal(tail.querySelector('p').getAttribute('role'), 'status');
    assert.equal(tail.querySelector('div.load-tail-fill').style.width, '60.0%');
    progress.update(snapshot({ receivedBytes: 900, currentTier: 4 }));
    assert.match(tail.querySelector('p').textContent, /Still loading regulatory sites\.$/);
    progress.update(snapshot({ receivedBytes: 1000, currentTier: null }));
    assert.equal(tail.hidden, true, 'everything landed and nothing failed');
  });
});

test('a file that could not be loaded stays listed with a Retry, and a blocked one without', async () => {
  await withFakeDocument((document) => {
    const retried = [];
    const { tail, progress } = mount(document, { onRetry: (key) => retried.push(key) });
    progress.update(snapshot({ receivedBytes: 1000, currentTier: null }));
    progress.reveal();
    assert.equal(tail.hidden, true);
    progress.setFiles(records({
      candidateEvidence: {
        state: FILE_STATE.FAILED, error: new Error('could not read candidate_evidence.json: HTTP 502'),
        blockedBy: null,
      },
      sourceDerivedCategories: {
        state: FILE_STATE.FAILED,
        error: new Error('source-derived-categories-v1.json is waiting on candidate_evidence.json, which could not be loaded'),
        blockedBy: 'candidateEvidence',
      },
      excluded: { state: FILE_STATE.FAILED, error: null, blockedBy: null },
    }));
    assert.equal(tail.hidden, false);
    assert.ok(tail.hasClass('has-failures'), 'a failure takes room in the flow for its Retry');
    assert.equal(tail.querySelector('p').textContent, '3 data files could not be loaded.');
    assert.equal(tail.querySelector('div.load-tail-meter').hidden, true);
    const rows = tail.querySelectorAll('li.load-failure');
    assert.deepEqual(rows.map((row) => row.dataset.fileKey),
      ['candidateEvidence', 'sourceDerivedCategories', 'excluded']);
    assert.equal(rows[0].querySelector('span').textContent,
      'Candidate evidence: could not read candidate_evidence.json: HTTP 502');
    assert.equal(rows[2].querySelector('span').textContent, 'Excluded loci: could not be loaded');
    const buttons = rows.map((row) => row.querySelector('button'));
    assert.equal(buttons[0].getAttribute('aria-label'), 'Retry loading candidate evidence');
    assert.equal(buttons[1], null, 'a file blocked by another is retried by retrying that one');
    buttons[0].dispatch('click');
    assert.deepEqual(retried, ['candidateEvidence']);

    // One failure reads in the singular; with none left the tail goes away.
    progress.setFiles(records({ excluded: { state: FILE_STATE.FAILED, error: null, blockedBy: null } }));
    assert.equal(tail.querySelector('p').textContent, '1 data file could not be loaded.');
    progress.setFiles(records());
    assert.equal(tail.hidden, true);
    assert.ok(!tail.hasClass('has-failures'));
  });
});

test('a whole-dataset retry puts the stage back at empty', async () => {
  await withFakeDocument((document) => {
    const { stage, bar, tail, progress } = mount(document);
    progress.update(snapshot({ receivedBytes: 500, currentTier: 2 }));
    progress.setFiles(records());
    progress.reveal();
    progress.restart();
    assert.equal(stage.hidden, false);
    assert.equal(tail.hidden, true);
    assert.equal(bar.getAttribute('aria-valuenow'), '0');
    assert.equal(bar.querySelectorAll('rect.load-gene').filter((mark) => mark.hasClass('is-on')).length, 0);
    // Before the reveal a file list changes nothing on screen.
    progress.setFiles(records({ excluded: { state: FILE_STATE.FAILED, error: null, blockedBy: null } }));
    assert.equal(tail.hidden, true);
  });
});

test('the track is shipped in the page, and the script adopts it instead of rebuilding', async () => {
  // Built by the script alone, the bar was a bare axis until the module graph
  // had arrived: the first second and a half of the wait on a slow connection.
  const { PAGE, END_MARK, START_MARK, loadBarBlock, withLoadBarBlock } = await import('../../tools/build_load_bar.mjs');
  const { readFile } = await import('node:fs/promises');
  const html = await readFile(PAGE, 'utf8');
  assert.equal(withLoadBarBlock(html), html,
    'index.html is out of date; run: node tools/build_load_bar.mjs');
  const shipped = [...html.matchAll(/<rect class="load-gene" ([^>]*)>/g)];
  assert.equal(shipped.length, LOAD_BAR_GENES);
  const genes = loadBarGenes();
  assert.match(shipped[0][1], new RegExp(`style="--gene: ${genes[0].color}"`));
  assert.ok(!/fill=/.test(shipped[0][1]), 'the colour is a custom property, so CSS can dim an unlit gene');
  assert.throws(() => withLoadBarBlock('<svg></svg>'), /has no .*load-bar:start/);
  assert.equal(withLoadBarBlock(`${START_MARK}old${END_MARK}`, genes.slice(0, 1)),
    loadBarBlock(genes.slice(0, 1)));

  await withFakeDocument((document) => {
    const stage = document.createElement('div');
    const bar = document.createElement('div');
    const tail = document.createElement('div');
    // The page's own marks, as the script finds them.
    const shippedMarks = genes.map((gene) => {
      const mark = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      mark.className = 'load-gene';
      for (const [name, value] of Object.entries(loadGeneAttributes(gene))) mark.setAttribute(name, value);
      bar.append(mark);
      return mark;
    });
    const progress = new LoadProgress({ stage, bar, tail });
    assert.deepEqual(progress.marks, shippedMarks, 'the shipped marks are the ones that light');
    progress.update(snapshot({ receivedBytes: 1000, currentTier: null }));
    assert.ok(shippedMarks.every((mark) => mark.hasClass('is-on')));
    // A host with a different number of marks is rebuilt rather than half adopted.
    const partial = document.createElement('div');
    partial.append(shippedMarks[0]);
    const rebuilt = new LoadProgress({ stage, bar: partial, tail });
    assert.equal(rebuilt.marks.length, LOAD_BAR_GENES);
    assert.equal(rebuilt.marks[0].getAttribute('style'), `--gene: ${genes[0].color}`);
  });
});

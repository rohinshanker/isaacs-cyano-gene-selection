import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  LOAD_BAR_GENES, LOAD_BAR_VIEW, LoadProgress, describeIdentity, describeLoad, loadBarGenes,
  loadFraction,
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

function mount(document, handlers = {}) {
  const stage = document.createElement('div');
  const bar = document.createElement('div');
  const tail = document.createElement('div');
  stage.append(bar);
  return { stage, bar, tail, progress: new LoadProgress({ stage, bar, tail }, handlers) };
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

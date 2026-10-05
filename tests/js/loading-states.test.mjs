/**
 * Loading is not missing.
 *
 * A file that has not landed has unknown content. Every view that reads a later
 * file is checked here for the one thing that matters while it is in flight:
 * that it says the evidence is loading, or could not be loaded, and never the
 * sentence it uses when the evidence is absent, and never a zero.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FILE_STATE, pendingState } from '../../site/js/core/data-files.js';
import { pendingNote, pendingNoteFor, pendingText } from '../../site/js/ui/loading-note.js';
import {
  CATEGORY_PENDING_LABELS, pendingFunctionCategories,
} from '../../site/js/core/source-derived-categories.js';
import {
  CATEGORICAL, MULTIPLE_FUNCTION_COLOR, PENDING_CATEGORY_COLOR, buildCategoryColorScale,
} from '../../site/js/ui/colors.js';
import { tssInitiationBasis } from '../../site/js/core/tss-evidence.js';
import { functionCategoryHelp } from '../../site/js/core/metric-help.js';
import { renderCategoryLegend } from '../../site/js/ui/legend.js';
import { describeGeneView, renderGeneViewer } from '../../site/js/ui/gene-viewer.js';
import { geneViewModel } from '../../site/js/core/gene-view-model.js';
import { pendingSection } from '../../site/js/ui/side-panel.js';
import { FilterPanel } from '../../site/js/ui/filters.js';
import { LengthExplorer } from '../../site/js/ui/length-explorer.js';
import { RegulatorySitesPanel } from '../../site/js/ui/regulatory-sites.js';
import { renderLoadings } from '../../site/js/ui/loadings.js';
import { ChromosomeView } from '../../site/js/ui/chromosome-view.js';
import { MARKER_KINDS, ScatterPlot } from '../../site/js/ui/scatter.js';
import { TextScramble } from '../../site/js/ui/text-scramble.js';
import { GeneSearchResults } from '../../site/js/ui/gene-search-results.js';
import { ShortlistPanel } from '../../site/js/ui/shortlist.js';
import { PanelDesigner } from '../../site/js/ui/panel-designer.js';
import {
  EXPORT_FILE_KEYS, buildExport, exportBlockedReason,
} from '../../site/js/core/export-manifest.js';
import { withFakeDocument } from './fake-dom.mjs';

const LOADING = FILE_STATE.LOADING;
const FAILED = FILE_STATE.FAILED;

/** A dataset whose named files are in the given states and whose others are settled. */
function datasetWith(states) {
  return { files: Object.fromEntries(Object.entries(states).map(([key, state]) => [key, { state }])) };
}

const GENE = {
  id: 'M744_RS00025', name: null, product: 'YheT family hydrolase', seqid: 'NZ_CP006471.1',
  strand: '+', start: 4314, end: 5318, lengthNt: 1005, lengthCodons: 334, terminalStop: 'TGA',
  cdsSegments: null, translationalException: null,
};

const REVIEWED = {
  categoryIds: ['photosynthesis', 'translation'],
  labels: ['Photosynthesis', 'Translation'],
  multipleLabel: 'Multiple functions',
  assignmentsById: new Map(),
  reviewedCount: 13,
  source: { provenance: { annotationRelease: 'GCF_000817325.1-RS_2026_05_13', userReview: { date: '2026-09-18' } } },
};

test('a pending state is loading or failed, and anything settled is neither', () => {
  const dataset = datasetWith({ a: LOADING, b: FAILED, c: FILE_STATE.READY, d: FILE_STATE.ABSENT });
  assert.equal(pendingState(dataset, 'a'), 'loading');
  assert.equal(pendingState(dataset, 'b'), 'failed');
  assert.equal(pendingState(dataset, 'c'), null);
  assert.equal(pendingState(dataset, 'd'), null);
  assert.equal(pendingState(dataset, 'unknown'), null);
  assert.equal(pendingState(null, 'a'), null);
  assert.equal(pendingState({}, 'a'), null, 'a dataset built without the loader is settled');
});

test('the pending note says loading or could not be loaded, and nothing else', async () => {
  assert.equal(pendingText(LOADING, 'the length inventory'), 'Loading the length inventory…');
  assert.equal(pendingText(FAILED, 'the length inventory'), 'The length inventory could not be loaded.');
  await withFakeDocument(() => {
    const note = pendingNote(LOADING, 'candidate evidence');
    assert.equal(note.tagName, 'p');
    assert.ok(note.hasClass('evidence-pending'));
    assert.equal(note.dataset.pending, 'loading');
    assert.equal(note.getAttribute('role'), 'status');
    assert.equal(note.textContent, 'Loading candidate evidence…');
    assert.equal(pendingNote(FAILED, 'candidate evidence').dataset.pending, 'failed');
    const dataset = datasetWith({ annotations: FILE_STATE.READY, goTerms: FAILED, tssEvidence: LOADING });
    assert.equal(pendingNoteFor(dataset, ['annotations'], 'x'), null);
    assert.equal(pendingNoteFor(dataset, ['annotations', 'goTerms'], 'annotation evidence').textContent,
      'Annotation evidence could not be loaded.');
    assert.equal(pendingNoteFor(dataset, ['tssEvidence'], 'start sites').textContent,
      'Loading start sites…');
  });
});

test('while categories load every CDS is one neutral colour, and nothing is counted', () => {
  const genes = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  for (const pending of [LOADING, FAILED]) {
    const model = pendingFunctionCategories({ reviewed: REVIEWED, genes, sources: ['utex-2973'], pending });
    assert.equal(model.pending, pending);
    assert.equal(model.pendingBucket, 3, 'one past the multiple-functions bucket');
    assert.deepEqual([...model.values], [3, 3, 3]);
    assert.deepEqual([...model.derived], [0, 0, 0], 'no CDS is drawn as derived');
    assert.deepEqual([...model.counts], [0, 0]);
    // Not unknown: an unknown CDS is a claim that no source assigns a category.
    assert.equal(model.unknownCount, 0);
    assert.equal(model.colouredCount, 0);
    assert.equal(model.reviewedCount, 0);
    assert.equal(model.hasDerivedData, false);
    assert.deepEqual(model.sources, ['utex-2973']);
    assert.equal(model.labels, REVIEWED.labels, 'the vocabulary is the reviewed one, unchanged');
    const scale = buildCategoryColorScale(model.labels.length, { pending: true });
    assert.equal(scale.bucketOf(model.values[0]), 3, 'the pending bucket is a drawn bucket');
    assert.equal(scale.buckets[3], PENDING_CATEGORY_COLOR);
  }
  assert.ok(!CATEGORICAL.includes(PENDING_CATEGORY_COLOR));
  assert.notEqual(PENDING_CATEGORY_COLOR, MULTIPLE_FUNCTION_COLOR);
  // Settled, the scale has no such bucket and the pending value is not drawable.
  const settled = buildCategoryColorScale(2);
  assert.equal(settled.buckets.length, 3);
  assert.equal(settled.bucketOf(3), -1);
  assert.ok(CATEGORY_PENDING_LABELS.loading && CATEGORY_PENDING_LABELS.failed);
});

test('a start-site layer that is not loaded is not a count of zero', () => {
  const metric = { provenance: { id: 'tan2018' } };
  const siteSource = { pooledScoreSourceId: 'tan2018' };
  const scored = tssInitiationBasis({ id: 'g' }, { metric, siteSource, value: 12.5 });
  assert.equal(scored.basis, 'measured');
  assert.equal(scored.siteCount, null, 'unknown, not zero');
  assert.equal(scored.short, 'pooled score; Table S1 sites not loaded');
  assert.match(scored.text, /has a value for this locus\. The Table S1 site layer is not loaded/);
  assert.ok(!/no gTSS row/.test(scored.text), 'it must not claim that no site maps');
  const unscored = tssInitiationBasis({ id: 'g' }, { metric, siteSource, value: null });
  assert.equal(unscored.basis, 'none');
  assert.equal(unscored.siteCount, null);
  assert.equal(unscored.short, 'no pooled score; Table S1 sites not loaded');
  assert.ok(!/Neither/.test(unscored.text));
  // Joined with no rows is a known zero, and still says so.
  const joined = tssInitiationBasis({ tssEvidence: [] }, { metric, siteSource, value: 12.5 });
  assert.equal(joined.siteCount, 0);
  assert.match(joined.short, /no exact Table S1 site/);
});

test('the colour explanation does not describe a resolution that has not happened', () => {
  for (const [pending, phrase] of [[LOADING, 'are still loading'], [FAILED, 'could not be loaded']]) {
    const help = functionCategoryHelp({
      reviewed: REVIEWED, derived: null,
      categories: pendingFunctionCategories({ reviewed: REVIEWED, genes: [], sources: [], pending }),
    });
    assert.equal(help.title, 'Function category');
    assert.match(help.method, new RegExp(`The function categories ${phrase}`));
    assert.match(help.method, /not loaded, not unknown/);
    assert.equal(help.coverage, `Not counted: the function categories ${phrase}.`);
    assert.ok(!/0 by a derived source/.test(help.coverage));
    assert.ok(!/never assign a category colour by themselves/.test(help.method));
  }
});

test('the legend shows one row for pending categories: no counts, no rows, no toggles', async () => {
  await withFakeDocument((document) => {
    const host = document.createElement('div');
    for (const pending of [LOADING, FAILED]) {
      renderCategoryLegend(host, {
        ...pendingFunctionCategories({ reviewed: REVIEWED, genes: [{ id: 'a' }], sources: [], pending }),
        scale: buildCategoryColorScale(2, { pending: true }),
        hiddenReviewedCount: 0, hiddenUnknownCount: 0, showHidden: false,
      });
      assert.equal(host.querySelector('p.legend-title').textContent, 'Function categories');
      const rows = host.querySelectorAll('li');
      assert.equal(rows.length, 1);
      assert.equal(rows[0].dataset.pending, pending);
      assert.equal(rows[0].getAttribute('role'), 'status');
      assert.match(rows[0].textContent, new RegExp(CATEGORY_PENDING_LABELS[pending]));
      assert.equal(host.querySelectorAll('div.category-legend-row').length, 0);
      assert.equal(host.querySelectorAll('input').length, 0, 'no source toggles');
      assert.ok(!/Unknown or unclassified/.test(host.textContent));
      assert.ok(!/\(\d/.test(host.textContent), 'no counts');
    }
  });
});

test('the gene visualizer says start sites are loading instead of that none maps', async () => {
  const model = geneViewModel(GENE);
  assert.match(describeGeneView(model), /No Tan 2018 start site maps to this locus/);
  assert.match(describeGeneView(model, LOADING), /start sites are still loading, so none is drawn yet/);
  assert.match(describeGeneView(model, FAILED), /start sites could not be loaded, so none is drawn/);
  assert.ok(!/No Tan 2018 start site maps/.test(describeGeneView(model, LOADING)));
  // The recorded-absence statement rests on Tan 2018 being the one admitted
  // start-site data set, so it waits for the file too rather than standing
  // beside the loading wording and contradicting it.
  assert.ok(!/is admitted for this strain/.test(describeGeneView(model, LOADING)));
  assert.ok(!/is admitted for this strain/.test(describeGeneView(model, FAILED)));
  assert.match(describeGeneView(model), /is admitted for this strain or its admitted sister strains/);
  // Sites that have landed are described as usual, whatever the flag says.
  const withSite = geneViewModel({ ...GENE, tssEvidence: [{ id: 'T1', sourceStartDistanceNt: 40 }] });
  assert.match(describeGeneView(withSite, LOADING), /1 Tan 2018 start site upstream at 40 nt/);
  await withFakeDocument((document) => {
    const host = document.createElement('div');
    renderGeneViewer(host, GENE, { tssPending: LOADING });
    assert.equal(host.querySelector('p.evidence-pending').textContent, 'Loading the Tan 2018 start sites…');
    assert.match(host.querySelector('svg').getAttribute('aria-label'), /still loading/);
    renderGeneViewer(host, GENE);
    assert.equal(host.querySelector('p.evidence-pending'), null);
    assert.match(host.querySelector('svg').getAttribute('aria-label'), /No Tan 2018 start site maps/);
  });
});

test('a gene detail section whose file has not landed is replaced by a note, not left out', async () => {
  await withFakeDocument(() => {
    const dataset = datasetWith({
      candidateEvidence: FILE_STATE.READY, goIeaEssentiality: LOADING, annotations: FAILED,
    });
    assert.equal(pendingSection(dataset, ['candidateEvidence'], 'Candidate evidence', 'x'), null);
    const loading = pendingSection(dataset, ['candidateEvidence', 'goIeaEssentiality'],
      'Candidate evidence', 'candidate evidence');
    assert.ok(loading.hasClass('evidence-pending-section'));
    assert.equal(loading.querySelector('strong').textContent, 'Candidate evidence');
    assert.equal(loading.querySelector('p.evidence-pending').textContent, 'Loading candidate evidence…');
    const failed = pendingSection(dataset, ['annotations', 'goTerms'],
      'Annotation evidence and recoding context', 'annotation evidence');
    assert.equal(failed.querySelector('p.evidence-pending').dataset.pending, 'failed');
    assert.equal(failed.querySelector('p.evidence-pending').textContent,
      'Annotation evidence could not be loaded.');
  });
});

test('the protein filter says it is waiting rather than disappearing', async () => {
  await withFakeDocument((document) => {
    const panel = { proteinHost: document.createElement('div') };
    const render = (state) => FilterPanel.prototype.renderProteinFilter.call(panel, state);
    render({ proteinEvidence: null, proteinEvidencePending: LOADING });
    assert.equal(panel.proteinHost.querySelector('legend').textContent, 'Protein evidence');
    assert.equal(panel.proteinHost.querySelector('p.evidence-pending').textContent,
      'Loading the protein evidence filter…');
    assert.equal(panel.proteinHost.querySelectorAll('input').length, 0);
    render({ proteinEvidence: null, proteinEvidencePending: FAILED });
    assert.equal(panel.proteinHost.querySelector('p.evidence-pending').dataset.pending, 'failed');
    // Settled and absent: this dataset has no such filter, as before.
    render({ proteinEvidence: null, proteinEvidencePending: null });
    assert.equal(panel.proteinHost.children.length, 0);
  });
});

test('the Lengths and Regulatory sites tabs say loading rather than unavailable', async () => {
  await withFakeDocument((document) => {
    const lengthHost = document.createElement('div');
    const explorer = new LengthExplorer(lengthHost, { onCohortChange() {}, onRangeChange() {} });
    const base = { inventory: null, cohortId: 'annotated', range: null, mapPassing: 0, mapCount: 0 };
    explorer.update({ ...base, pending: LOADING });
    assert.equal(lengthHost.textContent, 'Loading the length inventory…');
    explorer.update({ ...base, pending: FAILED });
    assert.equal(lengthHost.textContent, 'The length inventory could not be loaded.');
    explorer.update(base);
    assert.equal(lengthHost.textContent, 'The pinned length inventory is unavailable in this dataset.');

    const regulatoryHost = document.createElement('div');
    const panel = new RegulatorySitesPanel(regulatoryHost, { onShowGene() {} });
    panel.update(null, LOADING);
    assert.equal(regulatoryHost.textContent, 'Loading the regulatory start-site table…');
    panel.update(null, FAILED);
    assert.equal(regulatoryHost.textContent, 'The regulatory start-site table could not be loaded.');
    panel.update(null);
    assert.equal(regulatoryHost.textContent,
      'The regulatory start-site table is unavailable in this dataset.');
  });
});

test('axis loadings that have not landed are not an empty table', async () => {
  await withFakeDocument((document) => {
    const host = document.createElement('div');
    const projection = { loadingNote: 'Codons that pull genes along each axis.', loadings: [] };
    renderLoadings(host, projection, { pending: LOADING });
    assert.equal(host.textContent, 'Loading the axis loadings…');
    renderLoadings(host, projection, { pending: FAILED });
    assert.equal(host.textContent, 'The axis loadings could not be loaded.');
    renderLoadings(host, projection);
    assert.equal(host.textContent, 'Codons that pull genes along each axis.');
    // Loadings that are present draw, whatever the flag says.
    renderLoadings(host, { ...projection, loadings: [{ label: 'GCT', pc: [0.5, 0.1] }] }, { pending: LOADING });
    assert.equal(host.querySelector('p.evidence-pending'), null);
  });
});

test('the chromosome note does not promise start sites that have not been loaded', () => {
  const model = {
    colors: { values: null, scale: null }, mask: null, genes: [], showHidden: false, tssPending: null,
  };
  const note = (tssPending) => ChromosomeView.prototype.markerConventions.call({ model: { ...model, tssPending } });
  assert.match(note(null), /Tan 2018 gene-linked start sites on the tick row above each axis, appear once/);
  assert.match(note(LOADING), /start sites are still loading, so the tick row above each axis is empty for now/);
  assert.match(note(FAILED), /start sites could not be loaded, so the tick row above each axis is empty\./);
  for (const pending of [LOADING, FAILED]) {
    assert.ok(!/drawn where that study published them/.test(note(pending)));
    assert.match(note(pending), /Operon brackets .* fill in as you zoom/);
  }
});

test('a GO search that misses while GO annotations load is not reported as a miss', async () => {
  await withFakeDocument((document) => {
    const genes = [{ id: 'M744_RS00005', name: 'dnaA', product: 'chromosomal replication initiator' }];
    const message = (dataset) => {
      const host = document.createElement('div');
      const results = new GeneSearchResults(host, {
        onPin() {}, onShortlist() {}, isShortlisted: () => false, isPinned: () => false,
      });
      results.setGenes(genes, null, dataset);
      results.search('GO:0003677');
      return host.querySelector('p.search-status').textContent;
    };
    assert.match(message(datasetWith({ annotations: LOADING })),
      /GO annotations are still loading, so GO IDs and GO term names cannot match yet\.$/);
    assert.match(message(datasetWith({ annotations: FILE_STATE.READY, goTerms: LOADING })),
      /still loading/);
    assert.match(message(datasetWith({ annotations: FAILED })),
      /GO annotations could not be loaded, so GO IDs and GO term names cannot match\.$/);
    assert.match(message(datasetWith({ annotations: FILE_STATE.READY, goTerms: FILE_STATE.READY })),
      /name the annotation uses\.$/);
    // A query that does match something is still not the whole list while GO loads.
    const matched = (dataset) => {
      const host = document.createElement('div');
      const results = new GeneSearchResults(host, {
        onPin() {}, onShortlist() {}, isShortlisted: () => false, isPinned: () => false,
      });
      results.setGenes(genes, null, dataset);
      results.search('dnaA');
      return host.querySelector('p.search-status').textContent;
    };
    assert.equal(matched(datasetWith({ annotations: LOADING })),
      '1 gene matches “dnaA”. GO annotations are still loading, so GO IDs and GO term names cannot match yet.');
    assert.equal(matched(datasetWith({ annotations: FILE_STATE.READY })), '1 gene matches “dnaA”.');
  });
});

test('an export is refused, with its reason, until every file it reads has landed', async () => {
  assert.equal(exportBlockedReason({ files: {} }), null);
  assert.equal(exportBlockedReason(null), null);
  const loading = datasetWith({ sourceDerivedCategories: FILE_STATE.READY, tssEvidence: LOADING });
  assert.equal(exportBlockedReason(loading),
    'The export is waiting on the Tan 2018 start sites, which is still loading.');
  const failed = datasetWith({ annotations: FAILED });
  assert.match(exportBlockedReason(failed),
    /^The export cannot be written because the annotation evidence could not be loaded\./);
  // Every file an export reads a field from is gated, and nothing it does not read.
  for (const key of EXPORT_FILE_KEYS) {
    assert.ok(exportBlockedReason(datasetWith({ [key]: LOADING })), key);
  }
  for (const key of ['lengthCohorts', 'codonPca', 'excluded', 'regulatoryTss']) {
    assert.equal(exportBlockedReason(datasetWith({ [key]: LOADING })), null, key);
  }
  // The builder itself refuses, so no caller can write a partial manifest.
  assert.throws(() => buildExport({ dataset: loading, registry: {}, ids: [], schemes: [] }),
    /waiting on the Tan 2018 start sites/);

  await withFakeDocument((document) => {
    const shortlist = { state: { dataset: loading }, status: document.createElement('p') };
    ShortlistPanel.prototype.exportCsv.call(shortlist);
    assert.match(shortlist.status.textContent, /waiting on the Tan 2018 start sites/);
    const designer = {
      state: { dataset: failed, registry: {}, colorSources: [] },
      exportStatus: document.createElement('p'),
    };
    PanelDesigner.prototype.exportPanel.call(designer);
    assert.match(designer.exportStatus.textContent, /annotation evidence could not be loaded/);
  });
});

test('a point whose category has not loaded carries no reviewed border', () => {
  const calls = [];
  const context = {
    beginPath: () => calls.push('beginPath'), moveTo() {}, arc() {},
    fill: () => calls.push(`fill:${context.fillStyle}`),
    stroke: () => calls.push(`stroke:${context.strokeStyle}`),
  };
  const at = { x: [0, 1], y: [0, 1], kx: 1, ky: 1, cx: 0, cy: 0, ox: 0, oy: 0 };
  const bodies = { [MARKER_KINDS.colored.code]: 3 };
  const paint = (scale, bucket) => {
    calls.length = 0;
    ScatterPlot.prototype.paintColoredBatch.call({ context }, [0, 1], at, scale, bucket, bodies);
    return [...calls];
  };
  const pending = buildCategoryColorScale(2, { pending: true });
  // The dark border means lab-reviewed. Not loaded yet has no evidence tier.
  assert.deepEqual(paint(pending, 3), ['beginPath', `fill:${PENDING_CATEGORY_COLOR}`]);
  const reviewed = paint(pending, 0);
  assert.equal(reviewed.length, 3);
  assert.match(reviewed[2], /^stroke:/, 'a real category still takes its border');
  // A value ramp never had the border.
  assert.equal(paint({ categorical: false, buckets: ['#111'] }, 0).length, 2);
});

test('the chromosome note does not report a resolved zero while categories are pending', () => {
  const scale = buildCategoryColorScale(2, { pending: true });
  const model = (pending) => ({
    colors: {
      values: [3, 3], scale,
      categories: pending
        ? pendingFunctionCategories({ reviewed: REVIEWED, genes: [{}, {}], sources: [], pending })
        : null,
    },
    mask: null, genes: [{}, {}], showHidden: false, tssPending: null,
  });
  const note = (pending) => ChromosomeView.prototype.markerConventions.call({ model: model(pending) });
  // Every CDS sits in the not-loaded bucket, which is a drawn value; counting
  // them as valued said "0 CDSs have no value" beside a legend that said not loaded.
  assert.match(note(LOADING), /The function categories are still loading, so every CDS draws in one neutral colour that means not loaded, not unknown\./);
  assert.match(note(FAILED), /The function categories could not be loaded, so every CDS/);
  for (const pending of [LOADING, FAILED]) assert.ok(!/have no value for this colour/.test(note(pending)));
  assert.match(note(null), /0 CDSs have no value for this colour/);
});

test('the text reveal holds each element only while its own text is flipping', async () => {
  // `aria-hidden` alone left the header's buttons tabbable but unannounced, and
  // holding a whole region would leave the page unusable for as long as its
  // longest text takes, which is up to five seconds.
  await withFakeDocument(async (document) => {
    const root = document.createElement('div');
    root.setAttribute('aria-busy', 'false');
    const button = document.createElement('button');
    button.append('Jump to map');
    const paragraph = document.createElement('p');
    const prose = 'Every coding sequence in the release, with its length.';
    paragraph.append(prose);
    root.append(button, paragraph);
    document.body.append(root);
    const queue = [];
    let clock = 0;
    const scramble = new TextScramble({
      timing: {
        leadLetters: 2,
        lockLettersPerSecond: 1000,
        trailRatio: 1.5,
        maxDurationMs: 100,
        flipFastMs: 1,
        flipSlowMs: 2,
      },
      random: () => 0,
      now: () => clock,
      requestFrame: (callback) => queue.push(callback), cancelFrame: () => { queue.length = 0; },
    });
    const done = scramble.run(root);
    for (const name of ['aria-busy', 'aria-hidden', 'inert']) {
      assert.equal(button.getAttribute(name), 'true', `${name} while the label animates`);
      assert.equal(paragraph.getAttribute(name), 'true', `${name} while the prose animates`);
    }
    assert.equal(root.getAttribute('inert'), null, 'the region itself is never held');
    assert.equal(root.getAttribute('aria-busy'), 'false');

    // A letter a millisecond: the eleven-letter label is done inside one frame,
    // the fifty-three-letter paragraph is not.
    clock = 20;
    queue.shift()();
    assert.equal(button.textContent, 'Jump to map');
    assert.equal(button.getAttribute('inert'), null,
      'the button is usable as soon as its own label locked');
    assert.equal(button.getAttribute('aria-hidden'), null);
    assert.equal(button.getAttribute('aria-busy'), null);
    assert.equal(paragraph.getAttribute('inert'), 'true', 'while the longer text is still typing');

    while (queue.length > 0) {
      clock += 20;
      queue.shift()();
    }
    await done;
    assert.equal(paragraph.getAttribute('inert'), null, 'inert is lifted when the text has settled');
    assert.equal(paragraph.getAttribute('aria-hidden'), null);
    assert.equal(paragraph.textContent, prose);
    assert.equal(root.getAttribute('aria-busy'), 'false', 'and the region is exactly as it was');
  });
});

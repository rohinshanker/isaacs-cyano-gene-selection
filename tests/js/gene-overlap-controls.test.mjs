/**
 * The OG tag where a reader meets it: the badge and compact strip in the
 * smaller gene visualizer, the three-state filter, and the categorical colour
 * key. The overlap model itself is `tests/js/gene-overlaps.test.mjs`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderGeneViewer, overlapSentence, MIN_OVERLAP_WIDTH } from '../../site/js/ui/gene-viewer.js';
import { geneViewModel } from '../../site/js/core/gene-view-model.js';
import { FilterPanel } from '../../site/js/ui/filters.js';
import { renderOverlapLegend } from '../../site/js/ui/legend.js';
import { buildOverlapColorScale, OVERLAP_CLASS_COLORS } from '../../site/js/ui/colors.js';
import {
  OVERLAP_CLASSES, OVERLAP_CLASS_IDS, overlapFilterOf, overlapSelectionFor,
} from '../../site/js/core/gene-overlaps.js';
import { withFakeDocument } from './fake-dom.mjs';
import { standardTable } from './helpers.mjs';

const GENE = {
  id: 'M744_RS00025', name: null, product: 'YheT family hydrolase', seqid: 'NZ_CP006471.1',
  strand: '+', start: 4314, end: 5318, lengthNt: 1005, lengthCodons: 334, terminalStop: 'TGA',
  cdsSegments: null, translationalException: null,
};

function partner(id, from, to, options = {}) {
  return {
    id,
    name: null,
    biotype: 'protein_coding',
    seqid: 'NZ_CP006471.1',
    strand: '+',
    segments: [{ from, to }],
    segmentSource: 'child',
    pseudo: false,
    selectable: true,
    geneIndex: 3,
    relation: 'same',
    containment: 'partial',
    sharedIntervals: [{ from, to }],
    sharedBases: to - from + 1,
    ...options,
  };
}

const badge = (host) => host.querySelector('span.gene-view-og-badge');
const marks = (host) => host.querySelectorAll('g.gene-view-overlap');
const arrows = (host) => host.querySelectorAll('path.gene-view-overlap-arrow');
const partnerItems = (host) => host.querySelector('ul.gene-view-partners')?.children ?? [];

test('the OG badge counts the partners and expands its own abbreviation', async () => {
  await withFakeDocument((document) => {
    const host = document.createElement('div');
    document.body.append(host);
    renderGeneViewer(host, { ...GENE, overlapPartners: [], overlapClass: 'no-overlap' });
    assert.equal(badge(host).textContent, 'OG 0');
    assert.match(badge(host).title, /^OG stands for overlapping genes/);
    assert.match(badge(host).title, /None does\./);
    assert.ok(badge(host).hasClass('none'));
    assert.equal(badge(host).getAttribute('aria-label'), badge(host).title);

    renderGeneViewer(host, {
      ...GENE,
      overlapPartners: [partner('A', 5300, 5318), partner('B', 4314, 4320, { strand: '-', relation: 'opposite' })],
      overlapClass: 'overlap-both-strands',
    });
    assert.equal(badge(host).textContent, 'OG 2');
    assert.match(badge(host).title, /2 do\./);
    assert.equal(badge(host).dataset.overlapClass, 'overlap-both-strands');

    // Nothing read: a third state, and not a count of zero.
    renderGeneViewer(host, GENE);
    assert.equal(badge(host).textContent, 'OG ?');
    assert.ok(badge(host).hasClass('unavailable'));
    assert.match(badge(host).title, /has not been read/);
    assert.match(badge(host).title, /not an absence of overlaps/);
  });
});

test('the compact strip marks the shared bases with a direction arrow each', async () => {
  await withFakeDocument((document) => {
    const host = document.createElement('div');
    document.body.append(host);
    renderGeneViewer(host, {
      ...GENE,
      overlapPartners: [
        partner('SAME', 5300, 5318),
        partner('AGAINST', 4314, 4320, { strand: '-', relation: 'opposite' }),
      ],
      overlapClass: 'overlap-both-strands',
    });
    assert.equal(marks(host).length, 2);
    assert.equal(arrows(host).length, 2, 'one arrow per partner');
    const drawn = marks(host);
    assert.equal(drawn[0].getAttribute('data-overlap-partner'), 'AGAINST');
    assert.ok(drawn[0].hasClass('gene-view-overlap-against'));
    assert.ok(drawn[1].hasClass('gene-view-overlap-with'));
    // Every mark is inspectable by pointer, touch and keyboard, and names its
    // partner rather than only showing a colour.
    for (const mark of drawn) {
      assert.equal(mark.getAttribute('tabindex'), '0');
      assert.match(mark.getAttribute('aria-label'), /sharing \d+ base/);
      assert.match(mark.getAttribute('aria-label'), /Shared bases drawn from/);
    }
    // A one-base overlap is widened so it can be seen and hit at all.
    renderGeneViewer(host, {
      ...GENE,
      overlapPartners: [partner('ONE', 5318, 5318)],
      overlapClass: 'overlap-same-strand',
    });
    assert.equal(marks(host).length, 1);
    const tail = marks(host)[0].querySelector('line.gene-view-overlap-tail');
    assert.ok(Number(tail.getAttribute('x2')) - Number(tail.getAttribute('x1'))
      < MIN_OVERLAP_WIDTH, 'the tail keeps the exact proportional one-base width');
    assert.equal(arrows(host).length, 1, 'the fixed-size head supplies visibility separately');

    // A partner whose strand the release does not record gets no arrow, because
    // an arrow would assert a direction nobody annotated.
    renderGeneViewer(host, {
      ...GENE,
      overlapPartners: [partner('UNKNOWN', 5300, 5318, { strand: null, relation: 'unknown' })],
      overlapClass: 'overlap-strand-unrecorded',
    });
    assert.equal(marks(host).length, 1);
    assert.equal(arrows(host).length, 0);
  });
});

test('the compact disclosure exposes exact strand-aware bases and explicit unknowns', async () => {
  const table = standardTable();
  const pack = (codons) => table.encode(codons.map((codon) => table.indexOf(codon)));
  await withFakeDocument((document) => {
    const host = document.createElement('div');
    document.body.append(host);
    const selected = {
      ...GENE,
      start: 100, end: 108, lengthNt: 9, lengthCodons: 2,
      codons: pack(['ATG', 'GCT']), terminalStop: 'TAG',
      overlapPartners: [partner('ANTI', 106, 108, {
        strand: '-', relation: 'opposite', sharedIntervals: [{ from: 106, to: 108 }],
        segments: [{ from: 106, to: 108 }], sharedBases: 3,
      })],
      overlapClass: 'overlap-opposite-strand',
    };
    renderGeneViewer(host, selected, { table });
    const details = host.querySelector('details.gene-view-overlap-bases');
    assert.match(details.querySelector('summary').textContent, /Inspect exact shared bases for ANTI/);
    assert.deepEqual(details.querySelectorAll('code').map((node) => node.textContent), ['TAG', 'ATC']);
    const block = details.querySelector('.gene-view-overlap-base-block');
    assert.equal(block.tabIndex, 0, 'long base rows can receive keyboard scroll focus');
    assert.equal(block.getAttribute('role'), 'group');
    assert.match(block.getAttribute('aria-label'), /Shared native bases with ANTI/);
    const grid = details.querySelector('.gene-view-overlap-base-grid');
    assert.deepEqual(grid.children.map((node) => node.textContent), [
      'Selected', '5′', 'TAG', '3′', 'ANTI', '3′', 'ATC', '5′',
    ], 'both sequences occupy the same grid column regardless of label length');

    renderGeneViewer(host, {
      ...selected,
      overlapPartners: [partner('UNKNOWN', 106, 108, {
        strand: null, relation: 'unknown', sharedIntervals: [{ from: 106, to: 108 }],
        segments: [{ from: 106, to: 108 }], sharedBases: 3,
      })],
      overlapClass: 'overlap-strand-unrecorded',
    }, { table });
    assert.equal(host.querySelectorAll('code').length, 0);
    assert.match(host.querySelector('details.gene-view-overlap-bases').textContent,
      /strand.*unknown|unknown.*strand/i);

    renderGeneViewer(host, { ...selected, codons: undefined }, { table });
    assert.match(host.querySelector('details.gene-view-overlap-bases').textContent,
      /Exact shared bases are unavailable/);

    renderGeneViewer(host, {
      ...selected,
      end: 203,
      cdsSegments: [[100, 104], [200, 203]],
      overlapPartners: [partner('ACROSS_GAP', 100, 203, {
        strand: '+', relation: 'same',
        sharedIntervals: [{ from: 100, to: 104 }, { from: 200, to: 203 }],
        segments: [{ from: 100, to: 203 }], sharedBases: 9,
      })],
      overlapClass: 'overlap-same-strand',
    }, { table });
    const blocks = host.querySelectorAll('.gene-view-overlap-base-block');
    assert.equal(blocks.length, 2, 'a genomic gap stays two exact-base disclosures');
    assert.match(blocks[0].textContent, /Genomic 100 → 104 in selected-gene order/);
    assert.match(blocks[1].textContent, /Genomic 200 → 203 in selected-gene order/);
  });
});

test('every partner keeps a row, with a route only where the map plots it', async () => {
  const opened = [];
  await withFakeDocument((document) => {
    const host = document.createElement('div');
    document.body.append(host);
    renderGeneViewer(host, {
      ...GENE,
      overlapPartners: [
        partner('PLOTTED', 5300, 5318),
        partner('TRNA', 4314, 4320, {
          biotype: 'tRNA', strand: '-', relation: 'opposite', selectable: false, geneIndex: -1,
        }),
      ],
      overlapClass: 'overlap-both-strands',
    }, { onOpenPartner: (id, index) => opened.push([id, index]) });
    const items = partnerItems(host);
    assert.equal(items.length, 2);
    const buttons = host.querySelectorAll('button.gene-view-open-partner');
    assert.equal(buttons.length, 1);
    assert.equal(buttons[0].textContent, 'Open PLOTTED');
    buttons[0].click();
    assert.deepEqual(opened, [['PLOTTED', 3]]);
    const trna = items.find((item) => item.textContent.includes('TRNA'));
    assert.match(trna.textContent, /a tRNA gene on the reverse strand \(opposite strand\)/);
    assert.match(trna.textContent, /Not plotted on this map/);

    // No partner, and no layer, are two different notes and neither is empty.
    renderGeneViewer(host, { ...GENE, overlapPartners: [], overlapClass: 'no-overlap' });
    assert.equal(partnerItems(host).length, 0);
    assert.match(host.querySelector('p.gene-view-overlap-heading').textContent,
      /OG — no overlapping gene/);
    renderGeneViewer(host, GENE);
    assert.match(host.querySelector('div.gene-view-overlap-list').textContent,
      /has not been read/);
  });
});

test('the OG sentence is in the picture’s description and counts directions', () => {
  const withBoth = geneViewModel({
    ...GENE,
    overlapPartners: [
      partner('A', 5300, 5318),
      partner('B', 4314, 4320, { strand: '-', relation: 'opposite' }),
    ],
    overlapClass: 'overlap-both-strands',
  });
  const sentence = overlapSentence(withBoth);
  assert.match(sentence, /2 annotated genes share 26 bases with this one/);
  assert.match(sentence, /1 reads the same way as this gene, 1 reads against it/);
  assert.match(sentence, /arrow for each partner/);
  const one = overlapSentence(geneViewModel({
    ...GENE, overlapPartners: [partner('A', 5318, 5318)], overlapClass: 'overlap-same-strand',
  }));
  assert.match(one, /1 annotated gene shares 1 base with this one/);
  assert.match(overlapSentence(geneViewModel({
    ...GENE, overlapPartners: [], overlapClass: 'no-overlap',
  })), /no annotated gene shares a base with this one/);
  assert.match(overlapSentence(geneViewModel(GENE)), /has not been read/);
  // The strip's own key appears only where the picture draws a mark.
  assert.ok(overlapSentence(withBoth).includes('OG (overlapping genes)'));
});

test('the filter offers all, OG-only and non-overlapping-only, with whole-set counts', async () => {
  const chosen = [];
  await withFakeDocument((document) => {
    const host = document.createElement('div');
    document.body.append(host);
    const panel = new FilterPanel(host, {
      onChange: () => {},
      onOverlapFilterChange: (mode) => chosen.push(mode),
      onExceptionFilterChange: () => {},
      onExpressionFilterChange: () => {},
      onProteinFilterChange: () => {},
      onClear: () => {},
    });
    const state = {
      registry: { metrics: [], byKey: new Map(), families: [] },
      filters: {},
      count: 2715,
      passing: 100,
      missingHidden: new Map(),
      exceptionFilter: 'any',
      exceptionCount: 0,
      expressionFilter: 'any',
      basisCounts: null,
      trafficKey: null,
      proteinFilter: 'any',
      proteinEvidence: null,
      proteinEvidencePending: null,
      categoryFilter: [],
      overlapClassFilter: [],
      overlapCounts: { overlapping: 714, nonOverlapping: 2001 },
    };
    panel.update(state);
    const fieldset = host.querySelector('div.overlap-filter').querySelector('fieldset');
    const labels = fieldset.querySelectorAll('label').map((node) => node.textContent);
    assert.deepEqual(labels, [
      'Show all genes',
      'Only overlapping genes (714)',
      'Only non-overlapping genes (2,001)',
    ]);
    const radios = fieldset.querySelectorAll('input');
    assert.deepEqual(radios.map((node) => node.checked), [true, false, false]);
    radios[1].dispatch('change', {});
    assert.deepEqual(chosen, ['only']);
    assert.match(fieldset.querySelector('p').textContent,
      /714 of 2,715 plotted genes carry the tag and 2,001 share no base with one/);
    assert.match(fieldset.querySelector('p').textContent,
      /tRNA, rRNA and pseudogene rows included/);

    // The three options and the colour key write one selection, so the panel
    // shows which one is in force — and says so when it is neither.
    panel.update({ ...state, overlapClassFilter: overlapSelectionFor('only') });
    assert.deepEqual(
      host.querySelector('div.overlap-filter').querySelectorAll('input')
        .map((node) => node.checked),
      [false, true, false],
    );
    panel.update({ ...state, overlapClassFilter: ['overlap-opposite-strand'] });
    const custom = host.querySelector('div.overlap-filter').querySelector('fieldset');
    assert.deepEqual(custom.querySelectorAll('input').map((node) => node.checked),
      [false, false, false]);
    assert.match(custom.textContent, /A class selection from the OG colour key is in force/);
    assert.match(custom.textContent, /Overlaps on the opposite strand/);

    // Nothing read: the two narrowing options cannot act and say so.
    const pending = host.querySelector('div.overlap-filter');
    panel.update({ ...state, overlapCounts: null });
    assert.deepEqual(pending.querySelectorAll('input').map((node) => node.disabled),
      [false, true, true]);
    assert.match(pending.textContent, /has not been read/);
    assert.doesNotMatch(pending.textContent, /filter is paused/);
    for (const selection of [
      ['overlap-same-strand'], ['no-overlap'], overlapSelectionFor('only'),
    ]) {
      panel.update({ ...state, overlapCounts: null, overlapClassFilter: selection });
      assert.match(pending.textContent, /saved OG filter is paused/);
      assert.match(pending.textContent, /not applied to the displayed genes/);
      assert.doesNotMatch(pending.textContent, /is in force/);
      assert.deepEqual(pending.querySelectorAll('input').map((node) => node.disabled),
        [false, true, true]);
    }
    panel.update({ ...state, overlapClassFilter: ['overlap-same-strand'] });
    assert.doesNotMatch(pending.textContent, /filter is paused/);
    assert.match(pending.textContent, /is in force/);
  });
});

test('OG filter rebuilds preserve the focused option without stealing outside focus', async () => {
  await withFakeDocument((document) => {
    const panel = Object.create(FilterPanel.prototype);
    panel.overlapHost = document.createElement('div');
    panel.handlers = {};
    document.body.append(panel.overlapHost);
    const state = { count: 10, overlapCounts: { overlapping: 4, nonOverlapping: 6 } };
    panel.renderOverlapFilter({ ...state, overlapClassFilter: [] });
    for (const value of ['only', 'none', 'any']) {
      panel.overlapHost.querySelectorAll('input').find((node) => node.value === value).focus();
      panel.renderOverlapFilter({ ...state, overlapClassFilter: overlapSelectionFor(value) });
      const selected = panel.overlapHost.querySelectorAll('input').find((node) => node.value === value);
      assert.equal(document.activeElement, selected);
      assert.equal(selected.checked, true);
    }
    panel.overlapHost.querySelectorAll('input')[1].focus();
    panel.renderOverlapFilter({ ...state, overlapCounts: null, overlapClassFilter: overlapSelectionFor('only') });
    assert.equal(document.activeElement, panel.overlapHost.querySelectorAll('input')[0],
      'if the focused choice becomes unavailable, keep focus on the enabled clear option');
    const outside = document.createElement('button');
    document.body.append(outside);
    outside.focus();
    panel.renderOverlapFilter({ ...state, overlapClassFilter: [] });
    assert.equal(document.activeElement, outside, 'unrelated updates never steal focus');
  });
});

test('the OG colour key names every class, its count, and a short rule', async () => {
  const toggled = [];
  await withFakeDocument((document) => {
    const host = document.createElement('div');
    document.body.append(host);
    const index = {
      state: 'ready',
      definition: {
        features: 'every gene or pseudogene row with a locus tag',
        extent: 'the gene’s annotated child segments',
        overlap: 'at least one shared genomic base on the same replicon, on either strand',
        excluded: 'regulatory and misc_feature rows',
      },
      release: { accession: 'GCF_000817325.1', gff: 'x.gff.gz', sha256: 'c'.repeat(64) },
      coverage: {
        annotatedGenes: 2776,
        byBiotype: { protein_coding: 2715, tRNA: 44, rRNA: 6, pseudogene: 7, ncRNA: 4 },
        childlessGenes: 0,
        overlappingGenes: 717,
        overlappingPairs: 402,
        pairwiseSharedBases: 5236,
        maxPartners: 2,
        selectableGenes: 2715,
        selectableOverlapping: 714,
        partnersNotSelectable: 3,
      },
    };
    renderOverlapLegend(host, {
      scale: buildOverlapColorScale(),
      counts: [2001, 473, 212, 29, 0],
      index,
      selected: ['overlap-opposite-strand'],
      onToggleCategory: (id) => toggled.push(id),
    });
    const rows = host.querySelectorAll('div.category-legend-row');
    assert.equal(rows.length, 5);
    assert.deepEqual(rows.map((row) => row.dataset.categoryId), OVERLAP_CLASS_IDS);
    assert.match(rows[0].textContent, /No overlapping gene \(2,001\)/);
    assert.match(rows[3].textContent, /Overlaps on both strands \(29\)/);
    assert.match(rows[4].textContent, /Overlaps a gene of unrecorded strand \(0\)/);
    assert.equal(rows[2].getAttribute('aria-checked'), 'true');
    rows[1].click();
    assert.deepEqual(toggled, ['overlap-same-strand']);
    assert.ok(rows.every((row, position) => row.title === OVERLAP_CLASSES[position].note));
    // The key carries one short rule; the full definition, the field names
    // behind it and the census belong to the colour explanation.
    assert.match(host.textContent, /OG marks overlapping genes/);
    assert.ok(!/segmentSource/.test(host.textContent), 'no internal field tokens in the key');
    assert.ok(!/2,776 gene records/.test(host.textContent), 'the census is not in the key');
    assert.match(host.textContent, /full definition and what it covers are in the colour explanation/);
    assert.match(host.textContent, /does not change when a filter hides a partner/);
    // One distinguishable filled colour per class, none of them the neutral an
    // unread layer takes.
    assert.equal(new Set(OVERLAP_CLASS_COLORS).size, OVERLAP_CLASSES.length);
    assert.ok(!OVERLAP_CLASS_COLORS.includes(
      buildOverlapColorScale({ pending: true }).buckets[OVERLAP_CLASSES.length]));
  });
});

test('while the OG layer is unread the key shows one neutral and no class rows', async () => {
  await withFakeDocument((document) => {
    const host = document.createElement('div');
    document.body.append(host);
    renderOverlapLegend(host, {
      scale: buildOverlapColorScale({ pending: true }),
      counts: new Int32Array(OVERLAP_CLASSES.length),
      index: null,
      pending: 'loading',
      selected: ['no-overlap'],
    });
    assert.equal(host.querySelectorAll('div.category-legend-row').length, 0,
      'no class rows, because no class has been resolved');
    assert.match(host.textContent, /Overlap context not loaded/);
    assert.match(host.textContent, /not an absence of overlaps/);
    // A selection held while nothing is known is suspended, and says so,
    // rather than being presented as a satisfied result.
    assert.match(host.textContent, /cannot act until the layer is read, so no gene is hidden/);
    assert.equal(overlapFilterOf([]), 'any');
  });
});

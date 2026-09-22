import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  clearedFilterState, trafficThresholdLabel, trafficThresholdReadout,
} from '../../site/js/ui/filters.js';
import { foldInputsInvalidateResult } from '../../site/js/ui/folding-panel.js';
import { metricFamilyStartsOpen } from '../../site/js/ui/side-panel.js';
import { DELTA_COLUMNS } from '../../site/js/ui/compare.js';

const compareSource = await readFile(new URL('../../site/js/ui/compare.js', import.meta.url), 'utf8');
const panelDesignerSource = await readFile(
  new URL('../../site/js/ui/panel-designer.js', import.meta.url), 'utf8',
);
const sidePanelSource = await readFile(
  new URL('../../site/js/ui/side-panel.js', import.meta.url), 'utf8',
);
const appCss = await readFile(new URL('../../site/css/app.css', import.meta.url), 'utf8');
const appHtml = await readFile(new URL('../../site/index.html', import.meta.url), 'utf8');
const legendSource = await readFile(new URL('../../site/js/ui/legend.js', import.meta.url), 'utf8');

test('activity threshold copy preserves metric capitalization and avoids calling proxies measured', () => {
  const metric = { label: 'CAI', unit: 'index', integer: false };
  assert.equal(trafficThresholdLabel(metric), 'Hide genes below: CAI (index)');
  assert.equal(
    trafficThresholdReadout(metric, 0.348, 2715, 2715),
    '0.348 index — keeps 2,715 of 2,715 genes with a value',
  );
});

test('marker legends use decorative SVGs and distinguish excluded category buckets', () => {
  assert.match(legendSource, /document\.createElementNS\(SVG_NS, 'svg'\)/);
  assert.match(legendSource, /setAttribute\('aria-hidden', 'true'\)/);
  assert.match(legendSource, /Excluded, reviewed category: grey outlined square/);
  assert.match(legendSource, /Excluded, unknown: grey dot/);
  for (const shape of ['ghost-square', 'filled-dot', 'open-circle', 'diamond', 'pin', 'filled-circle']) {
    assert.match(legendSource, new RegExp(`['\"]${shape}['\"]`), shape);
  }
  assert.match(appHtml, /<label for="show-hidden">Show filtered-out genes<\/label>/);
  assert.doesNotMatch(appHtml, /Show filtered-out genes as grey outlined squares/);
});

test('clear all filters resets numeric and categorical channels together', () => {
  assert.deepEqual(clearedFilterState(), {
    filters: {},
    categoryFilter: [],
    exceptionFilter: 'any',
    expressionFilter: 'any',
    trafficKey: null,
    proteinFilter: 'any',
  });
});

test('folding inputs are not called stale before the first folding request', () => {
  assert.equal(foldInputsInvalidateResult('[[],""]', '[["gene"],""]', false), false);
  assert.equal(foldInputsInvalidateResult(undefined, '[["gene"],""]', true), false);
  assert.equal(foldInputsInvalidateResult('[[],""]', '[["gene"],""]', true), true);
});

test('scheme-only metric families stay collapsed until a scheme is active', () => {
  assert.equal(metricFamilyStartsOpen('Size', false), true);
  assert.equal(metricFamilyStartsOpen('Expression', false), true);
  assert.equal(metricFamilyStartsOpen('Translation', false), true);
  assert.equal(metricFamilyStartsOpen('Recoding load', false), false);
  assert.equal(metricFamilyStartsOpen('Change from wild type', false), false);
  assert.equal(metricFamilyStartsOpen('Recoding load', true), true);
  assert.equal(metricFamilyStartsOpen('Change from wild type', true), true);
});

test('wide comparison tables keep their complete guidance outside the horizontal scroller', () => {
  assert.match(compareSource, /captionNote\.className = 'table-caption'/);
  assert.match(compareSource, /caption\.className = 'visually-hidden'/);
  assert.match(compareSource, /setAttribute\('aria-describedby', captionNote\.id\)/);
  assert.equal(
    [...compareSource.matchAll(/tableScroll\.append\(table\);\s*this\.(?:deltaTableHost|tableHost)\.append\(captionNote, tableScroll\)/g)].length,
    2,
    'both comparison tables keep their guidance outside the scrolling child',
  );
  assert.doesNotMatch(compareSource, /this\.(?:deltaTableHost|tableHost)\.append\(captionNote, table\)/);
  assert.match(appCss, /\.table-caption\s*\{/);
  assert.doesNotMatch(appCss, /\.data-table caption\s*\{/);
});

test('axis loadings use the shared internal table scroller', () => {
  assert.match(appHtml, /<div id="loadings" class="table-scroll"><\/div>/);
});

test('completed export statuses wrap their collision-resistant identifiers', () => {
  assert.match(appCss, /#shortlist > \.panel-note\[role="status"\],\s*\.panel-export > \.panel-note\[role="status"\]\s*\{\s*overflow-wrap: anywhere;\s*\}/);
});

test('pairwise comparison leads with the signed result and keeps raw values available', () => {
  assert.deepEqual(
    DELTA_COLUMNS.map(({ key, label }) => [key, label]),
    [
      ['metric', 'Metric'],
      ['difference', 'A − B'],
      ['magnitude', 'Relative size'],
      ['a', 'A'],
      ['b', 'B'],
    ],
  );
  assert.match(
    compareSource,
    /Signed differences come first; on narrow screens, scroll right for the raw A and B values\./,
  );
  assert.match(appCss, /\.delta-data-table \.delta-column-metric\s*\{/);
});

test('panel results announce concise status instead of the entire generated result', () => {
  assert.doesNotMatch(panelDesignerSource, /resultHost\.setAttribute\(['"]aria-live['"]/);
  assert.match(panelDesignerSource, /stale\.setAttribute\('role', 'status'\)/);
  assert.match(panelDesignerSource, /alert\.setAttribute\('role', design\.feasible \? 'status' : 'alert'\)/);
  assert.match(panelDesignerSource, /this\.handlers\.onAnnounce\(this\.design\.feasible/);
});

test('a long measured unit cannot squeeze the metric description into a ribbon', () => {
  // The value column is capped and the unit wraps inside it, so a phrase unit
  // such as "summed mean TSS counts" cannot take the detail rail.
  assert.match(appCss, /grid-template-columns: minmax\(0, 1fr\) minmax\(0, 8rem\);/);
  assert.match(appCss, /\.metric-table td\.numeric \.row-unit \{ white-space: normal; \}/);
  // The number itself still never breaks across lines.
  assert.match(appCss, /\.numeric \{[^}]*white-space: nowrap;/);
});

test('the comparison region carries its measurement limits on every tab', () => {
  // The note is built for the delta tab from the table's own metrics, and for
  // the chart tabs from the axes, so no view promotes a measurement silently.
  assert.match(compareSource, /this\.measurementNote\.className = 'panel-note measurement-limits'/);
  assert.match(compareSource, /this\.renderMeasurementNote\(\);/);
  assert.match(compareSource, /if \(this\.tab !== 'delta'\) shown\.push\(\.\.\.this\.activeAxes\(\)\);/);
  assert.match(compareSource, /measurementLimitNote\(shown, this\.state\.dataset\)/);
});

test('measured UTEX evidence opens with the gene detail, before the codon-usage indices', () => {
  // Tan 2018 initiation counts and DESeq2 comparisons are the first evidence a
  // candidate is read on, so their disclosure is not collapsed by default.
  assert.match(
    sidePanelSource,
    /details\.className = 'metric-group tss-evidence';[\s\S]{0,600}?details\.open = model\.count > 0;/,
  );
  // Both low-replicate caveats stay beside the evidence rather than replacing it.
  assert.match(sidePanelSource, /only two biological cultures per condition/);
  assert.match(sidePanelSource, /allele- and condition-specific/);
  // Family groups are listed measured-evidence first, inside a family as well as across them.
  assert.match(sidePanelSource, /orderMeasuredFirst\(\s*state\.registry\.metrics\.filter/);
});

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const html = await readFile(new URL('../../site/index.html', import.meta.url), 'utf8');
const app = await readFile(new URL('../../site/js/app.js', import.meta.url), 'utf8');
const css = await readFile(new URL('../../site/css/app.css', import.meta.url), 'utf8');

test('analysis panels keep a logical source order inside one center column', () => {
  const analysisStart = html.search(/<div\b[^>]*class="column analysis"[^>]*>/);
  const map = html.indexOf('id="map-section"', analysisStart);
  const comparison = html.indexOf('id="compare-section"', map);
  const designer = html.indexOf('id="panel-section"', comparison);
  const shortlist = html.indexOf('class="card shortlist-card"', designer);
  const provenance = html.indexOf('id="provenance-card"', shortlist);
  const detail = html.indexOf('id="detail"', provenance);

  assert.notEqual(analysisStart, -1);
  assert.ok(analysisStart < map);
  assert.ok(map < comparison, 'comparison follows the map without a sidebar boundary');
  assert.ok(comparison < designer, 'guided design follows the candidate comparison');
  assert.ok(designer < shortlist, 'shortlist follows the workflow that can populate it');
  assert.ok(shortlist < provenance, 'dataset help follows the active workflow');
  assert.ok(provenance < detail, 'gene detail remains last in the single-column source order');
  assert.ok(html.indexOf('id="detail-jump"', map) < comparison,
    'the mobile selected-detail shortcut stays with the map that creates the selection');
});

/**
 * Owner decision, 2026-09-29: Colour by shares a row with Scale, the colour
 * explanation is directly beneath that row, and Find a gene has the row after it
 * to itself. DOM order is keyboard order, so this order is the tab order. The
 * note naming any scale this metric cannot take belongs to the colour row, so it
 * comes between the row and the explanation.
 */
test('the map toolbar puts colour with its scale, then its explanation, then gene search alone', () => {
  const toolbar = html.slice(html.indexOf('<div class="map-toolbar">'), html.indexOf('id="gene-search-hint"'));
  const at = (needle) => {
    const index = toolbar.indexOf(needle);
    assert.notEqual(index, -1, `${needle} is missing from the map toolbar`);
    return index;
  };
  const axisRow = at('id="axis-chooser"');
  const colourBy = at('id="color-by"');
  const colourScale = at('id="color-scale"');
  const notice = at('id="color-scale-notice"');
  const explanation = at('id="colour-help"');
  const search = at('id="gene-search"');
  const buttons = at('id="reset-view"');

  assert.ok(axisRow < colourBy, 'the axis chooser stays above the colour row');
  assert.ok(colourBy < colourScale, 'Scale follows Colour by on the same row');
  assert.ok(colourScale < notice, 'the unavailable-scale reasons are beneath that row');
  assert.ok(notice < explanation, 'and the colour explanation follows them');
  assert.ok(explanation < search, 'Find a gene follows the explanation');
  assert.ok(search < buttons, 'and the view buttons come last');

  // Colour by and Scale share one row, and Find a gene is alone on the next.
  const rows = toolbar.split('<div class="map-toolbar-row');
  const colourRow = rows.find((row) => row.includes('id="color-by"'));
  assert.ok(colourRow.includes('id="color-scale"'), 'Colour by and Scale share a row');
  assert.equal(colourRow.includes('id="gene-search"'), false);
  const searchRow = rows.find((row) => row.includes('id="gene-search"'));
  assert.equal((searchRow.match(/<select|<input/g) ?? []).length, 1,
    'Find a gene is the only control on its row');
  assert.match(searchRow, /class="field-row field-row-grow"/,
    'and it grows into the whole width at every breakpoint');
  assert.match(css, /\.map-toolbar \.field-row-grow \{ flex: 3 1 14rem; \}/);

  // That row is two columns of one row at every width, the toolbar's one
  // exception to stacking, and the two fields cannot take different label
  // placements because neither is allowed to wrap.
  assert.match(colourRow, /^ colour-scale-row">/,
    'the colour row carries the shared two-column rule');
  const grid = css.slice(css.indexOf('.map-toolbar .colour-scale-row,'));
  assert.match(grid, /^\.map-toolbar \.colour-scale-row,\n\.chromosome-toolbar \.colour-scale-row \{\n  display: grid;/,
    'one rule lays out both toolbars\' colour row');
  assert.match(grid, /grid-template-columns: minmax\(0, 1fr\) minmax\(0, 1fr\);/,
    'an even split where there is no spare width to give');
  assert.match(grid, /@media \(min-width: 560px\) \{[\s\S]*?grid-template-columns: minmax\(0, 1fr\) minmax\(0, auto\);/,
    'and from 560 px up Scale is sized to its own longest option');
  // One label placement per width, and it is the same for both fields, because
  // one rule sets it for both: stacked while the row is narrow, inline from the
  // same breakpoint the columns change at.
  assert.match(grid, /\.colour-scale-row > \.field-row \{\n  flex-direction: column;/);
  assert.match(grid, /@media \(min-width: 560px\) \{[\s\S]*?\.colour-scale-row > \.field-row \{\n    flex-direction: row;\n    flex-wrap: nowrap;/);
  assert.equal((css.match(/\.colour-scale-row > \.field-row \{/g) ?? []).length, 2,
    'nothing else can give the two fields different label placements');
  assert.match(css, /\.colour-scale-row > \.field-row > label \{ white-space: nowrap; \}/);

  // The Scale control explains itself where a screen reader will find it: the
  // visible reasons first, then the long standing description of the control.
  assert.match(html, /<select id="color-scale"\s+aria-describedby="color-scale-notice color-scale-hint"><\/select>/);
  assert.match(html, /id="color-scale-hint"/);
  assert.match(html, /<p class="panel-note scale-notice" id="color-scale-notice" hidden><\/p>/,
    'and it starts empty and hidden, so it occupies nothing until it says something');
  assert.match(css, /\.scale-notice \{ margin: 0; \}/);
});

/**
 * The scale is one value. Both toolbars and the legend read it, and the two
 * accessible descriptions state it, so nothing on screen can claim a scale that
 * is not the one being drawn.
 */
test('the colour scale is resolved once and named in both accessible descriptions', () => {
  assert.equal((app.match(/function resolveColorScale\(\)/g) ?? []).length, 1,
    'one function resolves the scale in effect');
  assert.equal((app.match(/state\.colorScale = scale;/g) ?? []).length, 2,
    'it is written by that resolver and by the map toolbar handler');
  const model = app.slice(app.indexOf('function colorModel()'), app.indexOf('function colorScaleClause('));
  assert.match(model, /const resolved = resolveColorScale\(\);/,
    'the colour model reads the resolved scale rather than resolving its own');
  assert.match(model, /transform: valueScaleTransform\(resolved\.scale, values\),/);
  // The Scale control's whole state — options, the scale in effect, and whether
  // the control itself is disabled — is decided once, in the module that defines
  // the scales. What the two toolbars receive is that one object, which is why
  // neither can be left enabled while the other is disabled. The states
  // themselves are checked in tests/js/scale-select.test.mjs, through the very
  // functions named here.
  assert.match(model, /scaleControl: scaleControlState\(resolved\),/);
  assert.equal((app.match(/scaleControlState\(/g) ?? []).length, 1,
    'nothing else builds a Scale control state');
  assert.equal((app.match(/colors\.scaleControl/g) ?? []).length, 2,
    'the map selector and the chromosome model read that same object');

  // The scatter canvas names the scale beside the metric it scales.
  const map = app.slice(app.indexOf('function renderMap()'), app.indexOf('function selectedCategoryLabels()'));
  assert.match(map, /const scaleClause = colorScaleClause\(colors\);/);
  assert.match(map, /coloured by `\s*\+ `\$\{metric\.label\}\$\{scaleClause \? ` \$\{scaleClause\}` : ''\}\./);
  // And the chromosome canvas is handed the same clause.
  const chromosome = app.slice(app.indexOf('function renderChromosomeView()'));
  assert.match(chromosome.slice(0, chromosome.indexOf('renderColorHelp(')),
    /colorScaleControl: colors\.scaleControl,\s*colorScaleClause: colorScaleClause\(colors\),/);
});

test('the chromosome tab is a registered tab with its own tabpanel container', () => {
  assert.match(app,
    /const ALL_TABS = \[\s*\.\.\.PANELS\.slice\(0, 2\), CHROMOSOME_TAB, \.\.\.PANELS\.slice\(2\),\s*LENGTH_TAB, REGULATORY_TAB, CITATIONS_TAB,\s*\];/,
    'the chromosome view is the third selectable tab in the shared tablist');
  assert.match(html,
    /<div id="chromosome-view" role="tabpanel" aria-labelledby="panel-tab-chromosome" hidden><\/div>/);
  assert.equal((html.match(/id="chromosome-view"/g) ?? []).length, 1);
  // The map tabpanel and this one are never both on screen.
  assert.match(app, /element\('chromosome-view'\)\.hidden = !chromosomeActive;/);
  assert.match(app, /element\('map-view'\)\.hidden = !mapActive;/);
  assert.match(app, /classList\.toggle\('chromosome-active', chromosomeActive\)/);
});

/**
 * Colour and Show filtered-out genes are one piece of state behind two sets of
 * controls, the map's and the chromosome view's, and only one of the two is on
 * screen at a time. `app.js` boots on import, so this checks the wiring in the
 * source, as the other app-level wiring checks here do; the cross-tab
 * behaviour itself is a rendered check in chromosome-view.md.
 */
test('the chromosome toolbar writes colour and visibility through the shared control sync', () => {
  assert.match(app, /function syncSharedControls\(\) \{\s*element\('color-by'\)\.value = state\.colorBy;\s*syncColorScaleControl\(colorModel\(\)\);\s*element\('show-hidden'\)\.checked = state\.showHidden;\s*\}/,
    'one function points all three shared controls at the state they describe');
  // Nowhere else writes either control, so neither can be left behind. The
  // colour scale goes through one function for the same reason, and that
  // function is the only place the map's Scale selector is written.
  assert.equal((app.match(/element\('color-by'\)\.value =/g) ?? []).length, 1);
  assert.equal((app.match(/element\('show-hidden'\)\.checked =/g) ?? []).length, 1);
  assert.equal((app.match(/function syncColorScaleControl\(/g) ?? []).length, 1);
  assert.equal((app.match(/element\('color-scale'\)/g) ?? []).length, 2,
    'the Scale selector is read once to wire it and once to point it at the state');
  assert.match(app, /syncScaleSelect\(element\('color-scale'\), colors\.scaleControl, element\('color-scale-notice'\)\);/,
    'and the visible reasons beneath it are written by that same call');
  assert.equal((app.match(/element\('color-scale-notice'\)/g) ?? []).length, 1,
    'nothing else writes the note, so it cannot fall out of step with the selector');

  const toolbar = app.slice(app.indexOf('chromosomeView = new ChromosomeView('));
  const colorChange = toolbar.slice(toolbar.indexOf('onColorChange:'), toolbar.indexOf('onColorScaleChange:'));
  const showHiddenChange = toolbar.slice(toolbar.indexOf('onShowHiddenChange:'), toolbar.indexOf('onDetailJump:'));
  assert.match(colorChange, /state\.colorBy = key;[\s\S]*?state\.colorScale = null;\s*syncSharedControls\(\);/,
    'choosing a colour on the chromosome tab moves the map selector with it, and opens '
      + "the new metric on its own default scale");
  const scaleChange = toolbar.slice(toolbar.indexOf('onColorScaleChange:'), toolbar.indexOf('onShowHiddenChange:'));
  assert.match(scaleChange, /state\.colorScale = scale;\s*syncSharedControls\(\);/,
    'and choosing a scale there moves the map selector with it too');
  assert.match(showHiddenChange, /state\.showHidden = value;\s*syncSharedControls\(\);/,
    'and so does unchecking Show filtered-out genes');

  // A link pasted into the address bar changes the same state behind both.
  const live = app.slice(app.indexOf('function applyLiveHash()'), app.indexOf('async function boot()'));
  assert.match(live, /syncSharedControls\(\);/);
});

/**
 * The chromosome view's accessible description is the whole view for anyone not
 * looking at it, so it has to name the categories the filter is restricted to.
 * `app.js` boots on import, so the wiring is checked in the source here; the
 * sentence itself is tested against `describeChromosomeView`.
 */
test('the chromosome view is handed the selected category names, not a count', () => {
  assert.match(app, /function selectedCategoryLabels\(\) \{[\s\S]*?state\.categoryFilter\.map\(\(id\) => categoryLabelFor\(categories, id\)\)/,
    'the names come from the same label lookup the legend and detail panel use');
  const render = app.slice(app.indexOf('function renderChromosomeView()'));
  assert.match(render.slice(0, render.indexOf('renderColorHelp(')),
    /categoryFilterLabels: selectedCategoryLabels\(\),/,
    'and the chromosome render hands them to the view');
  assert.equal((app.match(/categoryFilterCount/g) ?? []).length, 0,
    'nothing still passes a bare count');
});

test('relocated support panels use compact native disclosures', () => {
  assert.match(html, /<details class="workflow-help">/);
  assert.match(html, /<details class="panel-workflow">/);
  assert.match(html, /<details class="provenance-disclosure">/);
  assert.equal((html.match(/id="compare-section"/g) ?? []).length, 1);
  assert.equal((html.match(/id="shortlist"/g) ?? []).length, 1);
  assert.equal((html.match(/id="provenance"/g) ?? []).length, 1);
});

test('the header offers a visible direct route past the long control column', () => {
  assert.match(html,
    /<button type="button" class="chip-button header-link map-jump" aria-controls="map-section">Jump to map<\/button>/);
  assert.match(html,
    /<button type="button" class="skip-link map-jump" aria-controls="map-section">Skip to the map<\/button>/);
  assert.doesNotMatch(html, /class="[^"]*map-jump[^"]*"[^>]*href=/,
    'map-jump controls cannot replace application state before JavaScript loads');
  assert.match(app, /document\.querySelectorAll\('\.map-jump'\)/);
  assert.match(app, /event\.preventDefault\(\)/,
    'map jumps must not replace the URL hash that carries live application state');
  const install = app.lastIndexOf('installMapJumps();');
  const boot = app.lastIndexOf('boot();');
  assert.ok(install >= 0 && install < boot,
    'map-jump interception is installed synchronously before dataset loading begins');
  assert.match(app, /if \(pendingMapJump\) jumpToMap\(\)/,
    'a map jump requested while loading completes once the map is visible');
});

test('the selected-detail shortcut remains until detail becomes a sticky side rail', () => {
  const tabletStart = css.indexOf('@media (min-width: 960px)');
  const wideStart = css.indexOf('@media (min-width: 1240px)');
  assert.ok(tabletStart >= 0 && wideStart > tabletStart);
  assert.doesNotMatch(css.slice(tabletStart, wideStart), /\.detail-jump\s*\{[^}]*display:\s*none/);
  assert.match(css.slice(wideStart), /\.detail-jump\s*\{[^}]*display:\s*none/);
});

test('legend marker SVGs scale with their text without CSS shape substitutions', () => {
  assert.match(css, /\.legend-marker \{ width: 1\.1em; height: 1\.1em;/);
  assert.doesNotMatch(css, /\.legend-swatch-box/);
});

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

test('the chromosome tab is a registered tab with its own tabpanel container', () => {
  assert.match(app, /const ALL_TABS = \[\.\.\.PANELS, CHROMOSOME_TAB, LENGTH_TAB, REGULATORY_TAB, CITATIONS_TAB\];/,
    'the chromosome view is a selectable tab in the shared tablist');
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
  assert.match(app, /function syncSharedControls\(\) \{\s*element\('color-by'\)\.value = state\.colorBy;\s*element\('show-hidden'\)\.checked = state\.showHidden;\s*\}/,
    'one function points both shared controls at the state they describe');
  // Nowhere else writes either control, so neither can be left behind.
  assert.equal((app.match(/element\('color-by'\)\.value =/g) ?? []).length, 1);
  assert.equal((app.match(/element\('show-hidden'\)\.checked =/g) ?? []).length, 1);

  const toolbar = app.slice(app.indexOf('chromosomeView = new ChromosomeView('));
  const colorChange = toolbar.slice(toolbar.indexOf('onColorChange:'), toolbar.indexOf('onShowHiddenChange:'));
  const showHiddenChange = toolbar.slice(toolbar.indexOf('onShowHiddenChange:'), toolbar.indexOf('onDetailJump:'));
  assert.match(colorChange, /state\.colorBy = key;\s*syncSharedControls\(\);/,
    'choosing a colour on the chromosome tab moves the map selector with it');
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

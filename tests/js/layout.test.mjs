import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const html = await readFile(new URL('../../site/index.html', import.meta.url), 'utf8');
const app = await readFile(new URL('../../site/js/app.js', import.meta.url), 'utf8');
const css = await readFile(new URL('../../site/css/app.css', import.meta.url), 'utf8');

test('analysis panels keep a logical source order inside one center column', () => {
  const analysisStart = html.indexOf('<div class="column analysis">');
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
    /<a class="chip-button header-link map-jump" href="#map-section">Jump to map<\/a>/);
  assert.match(html, /<a class="skip-link map-jump" href="#map-section">Skip to the map<\/a>/);
  assert.match(app, /document\.querySelectorAll\('\.map-jump'\)/);
  assert.match(app, /event\.preventDefault\(\)/,
    'map jumps must not replace the URL hash that carries live application state');
});

test('the selected-detail shortcut remains until detail becomes a sticky side rail', () => {
  const tabletStart = css.indexOf('@media (min-width: 960px)');
  const wideStart = css.indexOf('@media (min-width: 1240px)');
  assert.ok(tabletStart >= 0 && wideStart > tabletStart);
  assert.doesNotMatch(css.slice(tabletStart, wideStart), /\.detail-jump\s*\{[^}]*display:\s*none/);
  assert.match(css.slice(wideStart), /\.detail-jump\s*\{[^}]*display:\s*none/);
});

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const html = await readFile(new URL('../../site/index.html', import.meta.url), 'utf8');

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

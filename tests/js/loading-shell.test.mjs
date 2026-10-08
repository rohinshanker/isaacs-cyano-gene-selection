/**
 * The loading shell, read from the published page, stylesheet and entry module.
 *
 * Nothing executes `boot()` under Node, so the parts of the loading presentation
 * that live in markup, CSS and the order of calls are held here by reading
 * them, the way `layout.test.mjs` holds the workspace.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../../site/${path}`, import.meta.url), 'utf8');

test('the page opens as an empty shell with the stage in the map frame', async () => {
  const html = await read('index.html');
  assert.match(html, /<body class="is-loading">/);
  // The workspace is in the document from the first paint; what waits is its text.
  assert.match(html, /<main class="layout" id="main">/);
  assert.ok(!/<main[^>]*\shidden/.test(html));
  for (const id of ['compare-section', 'panel-section', 'site-footer']) {
    assert.match(html, new RegExp(`id="${id}"[^>]*\\shidden`), `${id} waits for the reveal`);
  }
  const stage = html.indexOf('id="load-stage"');
  const mapSection = html.indexOf('id="map-section"');
  const tabs = html.indexOf('id="panel-tabs"');
  assert.ok(mapSection < stage && stage < tabs, 'the stage is inside the map card, ahead of its content');
  assert.match(html, /<div class="load-grid" aria-hidden="true"><\/div>/);
  assert.match(html, /id="load-progress" class="load-progress" role="progressbar"\s+aria-label="Loading the gene data" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"\s+aria-valuetext="Loading genes, 0%\."/,
    'the bar has a value text before any script runs');
  assert.match(html, /id="load-progress-status" class="load-progress-status" role="status">Loading genes<\/p>/,
    'concise visible stage text ships with the bar');
  assert.match(html, /<line class="load-chromosome-axis"/, 'the axis is drawn before any script runs');
  assert.match(html, /<div id="load-tail" class="load-tail" hidden><\/div>/);
  // The shell shows no text, so its status line is for assistive technology
  // until it has a failure to report.
  assert.match(html, /<p id="load-status" class="load-status visually-hidden" role="status">Loading gene data…<\/p>/);
});

test('the stylesheet hides text, not structure, while loading', async () => {
  const css = await read('css/app.css');
  const block = css.slice(css.indexOf('/* Loading shell'), css.indexOf('/* After the reveal'));
  assert.match(block, /\.is-loading \.site-header > \*,\s*\.is-loading \.column\.controls > \.card > \*,\s*\.is-loading \.column\.detail > \* \{ visibility: hidden; \}/);
  assert.match(block, /\.is-loading #map-section > :not\(#load-stage\) \{ display: none; \}/);
  assert.match(block, /\.is-loading \.analysis > :not\(#map-section\)/);
  // On one column the grid leads, so it is within view on a phone.
  assert.match(block, /@media \(max-width: 959px\) \{\s*\.is-loading \.analysis \{ order: -1; \}/);
  // The stage is the map canvas's own box.
  const canvasHost = /\.canvas-host \{[^}]*height: (clamp\([^;]+\));/.exec(css)[1];
  assert.ok(block.includes(`height: ${canvasHost};`), 'the grid stands where the map will');
  assert.ok(!/load-tail-(?:meter|fill)/.test(css), 'there is no secondary progress meter');
  // A segment just appears: the owner asked for no expand animation, since
  // easing each one in made the blocky load read as fluid again.
  const genes = [...css.matchAll(/\.load-gene(?:\.is-on)? \{[^}]*\}/g)]
    .map((match) => match[0]).join('\n');
  assert.match(genes, /\.load-gene \{ fill: #dfe5ea; \}\s*\.load-gene\.is-on \{ fill: var\(--gene\); \}/);
  assert.ok(!/transition|transform|animation/.test(genes), 'no segment is eased, grown, or faded in');
  const track = /\.load-chromosome \{[^}]*\}/.exec(css)[0];
  assert.ok(!/transition|transform|animation/.test(track), 'the ordinary track has no activity animation');
  assert.match(css, /\.load-progress\.is-activity \.load-chromosome \{ animation: load-activity-pulse/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{\s*\.load-progress\.is-activity \.load-chromosome \{ animation: none/);
});

test('the reveal waits for its own files while the one bar measures the whole cycle', async () => {
  const source = await read('js/app.js');
  const progressSource = await read('js/ui/load-progress.js');
  const boot = source.slice(source.indexOf('async function boot()'));
  // Presentation is skipped under reduced motion: the bar has no minimum then.
  assert.match(boot, /minimumMs: reducedMotion \? 0 : loadTiming\.minimumBarMs,/);
  // The link is read under the organism the address names, while progress is
  // explicitly whole-cycle and includes the independently fetched ledger.
  assert.match(boot, /const requested = defaultState\(organism\);\s*applyDecoded\(requested, decodeState\(window\.location\.hash, organism\), organism\);\s*const promoted = promotedFileKeys\(requested\);\s*loadProgress\.setBlocking\(null\);\s*loadProgress\.beginResource\('citations'/);
  // Review C adds a measured-byte latch but cannot bypass the same readiness
  // promise. Production retains its approved presentation minimum.
  assert.match(boot, /const ready = load\.when\(promoted\);/);
  assert.match(boot, /loadReview\?\.reveal === 'half'[\s\S]*Promise\.all\(\[ready, loadProgress\.whenTransferAtLeast\(0\.5\)\]\)/);
  assert.match(boot, /if \(!loadReview\) await loadProgress\.ready\(\);/);
  assert.match(boot, /await cleanRevealFrame\(\);\s*revealPage\(\);/);
  assert.match(progressSource, /this\.tail\.append\(this\.presentation, this\.failures\)/);
  const order = ['renderAll();\n  loadProgress.completePreparation(\'initial-view\');\n  booted = true;', 'flushLandings();', 'revealPage();',
    'if (pendingMapJump) jumpToMap();'];
  let from = 0;
  for (const step of order) {
    const at = boot.indexOf(step, from);
    assert.ok(at >= from, `${step} comes in order`);
    from = at;
  }
  const reveal = source.slice(source.indexOf('function revealPage()'), source.indexOf('function mapTabActive()'));
  assert.match(reveal, /document\.body\.classList\.remove\('is-loading'\);/);
  // The status line said the data was loading. Left in the settled page it
  // told a screen reader that a finished load was still in progress.
  assert.match(reveal, /element\('load-status'\)\.hidden = true;/);
  // The visit starts at the top of the page, by owner decision: the shell may
  // have been scrolled, and nothing holds the map in view.
  assert.match(reveal, /window\.scrollTo\(\{ top: 0, behavior: 'instant' \}\);\s*startMapIntro/);
  assert.ok(!/holdInPlace|view-anchor/.test(source));
  assert.match(reveal, /startMapIntro\(loadTiming\.mapIntro\);\s*startTextReveal\(\);/);
  assert.match(source, /function startMapIntro\(\{ appearMs, colourMs \}\) \{\s*if \(reducedMotion \|\| !mapTabActive\(\)\) return;/);
  assert.match(source, /function startTextReveal\(\) \{\s*if \(reducedMotion\) return;/);
  assert.match(source, /textScramble\.refresh\(scrambleRoots\(\)\)/,
    'landing replacements join the active reveal without restarting it');
});

test('a link is opened onto its own data: what each view promotes', async () => {
  const source = await read('js/app.js');
  const promoted = source.slice(source.indexOf('function promotedFileKeys(view)'),
    source.indexOf('/** A later file settled.'));
  assert.match(promoted, /view\.categoryFilter\.length > 0\) keys\.add\('sourceDerivedCategories'\)/);
  assert.match(promoted, /view\.proteinFilter !== 'any' \|\| view\.panel === LENGTH_TAB\.id\) keys\.add\('lengthCohorts'\)/);
  assert.match(promoted, /view\.panel === REGULATORY_TAB\.id\) keys\.add\('regulatoryTss'\)/);
  assert.match(promoted, /view\.panel === STRAIN_FITNESS_TAB\.id\) keys\.add\('strainFitness'\)/);
  for (const key of ['sourceDerivedCategories', 'annotations', 'candidateEvidence',
    'goIeaEssentiality', 'goTerms', 'tssEvidence']) {
    assert.ok(promoted.includes(`'${key}'`), `a pinned gene waits for ${key}`);
  }
});

test('nothing computed once at start-up is left stale when its file lands', async () => {
  const source = await read('js/app.js');
  const flush = source.slice(source.indexOf('function flushLandings()'),
    source.indexOf('/** Ask again for one later file'));
  assert.match(flush, /keys\.has\('lengthCohorts'\)\) \{\s*refreshProteinRecords\(\);/);
  // Dropped only once the inventory is known not to be published: a failed
  // request may be retried, and the link's filter must still be there when it is.
  assert.match(flush, /if \(!dataset\.lengthCohorts && !pendingState\(dataset, 'lengthCohorts'\)\) \{\s*state\.proteinFilter = 'any';/);
  assert.match(flush, /keys\.has\('codonPca'\)\) context\.projections\.clear\(\);/);
  assert.match(flush, /searchResults\?\.setGenes\(dataset\.genes, dataset\.goTerms\?\.terms, dataset\);/);
  assert.match(flush, /keys\.has\('excluded'\)\) renderProvenance\(\);/);
  assert.match(flush, /renderAll\(\);/);
  // A link's protein filter survives while the inventory is still loading.
  assert.match(source, /!context\.dataset\.lengthCohorts && !pendingState\(context\.dataset, 'lengthCohorts'\)/);
});

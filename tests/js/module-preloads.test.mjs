import { test } from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import {
  END_MARK, SITE_ROOT, START_MARK, preloadBlock, staticModuleGraph, withPreloadBlock,
} from '../../tools/build_module_preloads.mjs';

test('the page preloads exactly the modules its entry statically imports', async () => {
  const modules = await staticModuleGraph();
  assert.equal(modules[0], 'js/app.js', 'the entry leads');
  assert.deepEqual(modules.slice(1), [...modules.slice(1)].sort());
  assert.equal(new Set(modules).size, modules.length);
  for (const path of modules) await access(new URL(path, SITE_ROOT));
  // Loaded on demand, so preloading them would spend start-up bandwidth for nothing.
  assert.ok(!modules.some((path) => path.includes('workers/')), 'no worker module');
  // The loading path itself is in the graph.
  for (const path of ['js/core/dataset.js', 'js/core/data-files.js', 'js/core/early-data.js',
    'js/ui/load-progress.js', 'js/ui/load-timing.js', 'js/ui/text-scramble.js']) {
    assert.ok(modules.includes(path), path);
  }
  const html = await readFile(new URL('index.html', SITE_ROOT), 'utf8');
  assert.equal(withPreloadBlock(html, modules), html,
    'index.html is out of date; run: node tools/build_module_preloads.mjs');
  assert.ok(html.indexOf(END_MARK) < html.indexOf('</head>'), 'the preloads are in the head');
});

test('the preload block is replaced whole, and a page without one is refused', () => {
  const block = preloadBlock(['js/app.js', 'js/core/a.js']);
  assert.equal(block, [
    START_MARK,
    '<link rel="modulepreload" href="js/app.js">',
    '<link rel="modulepreload" href="js/core/a.js">',
    END_MARK,
  ].join('\n'));
  const html = `<head>\n${START_MARK}\nstale\n${END_MARK}\n</head>`;
  const next = withPreloadBlock(html, ['js/app.js']);
  assert.equal(next, `<head>\n${preloadBlock(['js/app.js'])}\n</head>`);
  assert.equal(withPreloadBlock(next, ['js/app.js']), next, 'a current block is a fixed point');
  assert.throws(() => withPreloadBlock('<head></head>', []), /has no .*modulepreload:start/);
  assert.throws(() => withPreloadBlock(`${END_MARK}${START_MARK}`, []), /has no/);
});

test('only static imports are followed', async () => {
  // The published graph has both shapes, so it is the evidence: the folding
  // worker is reached only through `new Worker(...)` and must be absent.
  const modules = await staticModuleGraph();
  const source = await readFile(new URL('js/core/folding-client.js', SITE_ROOT), 'utf8');
  assert.match(source, /new\s+Worker\s*\(/, 'the folding client starts a worker');
  assert.ok(!modules.includes('js/workers/folding-worker.js'));
});

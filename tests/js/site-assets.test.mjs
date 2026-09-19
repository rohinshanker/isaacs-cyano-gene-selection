import assert from 'node:assert/strict';
import { readdir, readFile, stat } from 'node:fs/promises';
import test from 'node:test';

const siteRoot = new URL('../../site/', import.meta.url);
const moduleRootPath = new URL('js/', siteRoot).pathname;

async function assertFile(url, context) {
  const info = await stat(url).catch(() => null);
  assert.ok(info?.isFile(), `${context} resolves to a file: ${url.pathname}`);
}

function localReference(reference) {
  return !reference.startsWith('#')
    && !reference.startsWith('data:')
    && !/^[a-z][a-z+.-]*:/i.test(reference);
}

test('HTML and CSS references resolve inside the published site', async () => {
  const htmlUrl = new URL('index.html', siteRoot);
  const html = await readFile(htmlUrl, 'utf8');
  const htmlReferences = [...html.matchAll(/\b(?:href|src)="([^"]+)"/g)]
    .map((match) => match[1])
    .filter(localReference);
  for (const reference of htmlReferences) {
    await assertFile(new URL(reference, htmlUrl), `index.html reference ${reference}`);
  }

  const cssUrl = new URL('css/app.css', siteRoot);
  const css = await readFile(cssUrl, 'utf8');
  const cssReferences = [...css.matchAll(/url\((?:['"])?([^)'"\s]+)(?:['"])?\)/g)]
    .map((match) => match[1])
    .filter(localReference);
  for (const reference of cssReferences) {
    await assertFile(new URL(reference, cssUrl), `app.css reference ${reference}`);
  }
});

test('the complete JavaScript module and worker graph resolves locally', async () => {
  const pending = [new URL('js/app.js', siteRoot)];
  const visited = new Set();
  while (pending.length > 0) {
    const url = pending.pop();
    if (visited.has(url.href)) continue;
    visited.add(url.href);
    await assertFile(url, 'JavaScript dependency');
    const source = await readFile(url, 'utf8');
    const references = [
      ...source.matchAll(/(?:from\s+|import\s*\()(['"])(.+?)\1/g),
      ...source.matchAll(/new\s+(?:Shared)?Worker\s*\(\s*new\s+URL\s*\(\s*(['"])(.+?)\1/g),
    ].map((match) => match[2]).filter(localReference);
    for (const reference of references) {
      const dependency = new URL(reference, url);
      await assertFile(dependency, `${url.pathname} reference ${reference}`);
      if (dependency.pathname.startsWith(moduleRootPath) && dependency.pathname.endsWith('.js')) {
        pending.push(dependency);
      }
    }
  }

  const publishedModules = [];
  async function collect(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const url = new URL(entry.name + (entry.isDirectory() ? '/' : ''), directory);
      if (entry.isDirectory()) await collect(url);
      else if (entry.name.endsWith('.js')) publishedModules.push(url.href);
    }
  }
  await collect(new URL('js/', siteRoot));
  assert.deepEqual([...visited].sort(), publishedModules.sort(),
    'every published JavaScript module is reachable from the site entry point');
});

test('required publication and runtime assets are present', async () => {
  for (const path of [
    '.nojekyll',
    'data/meta.json',
    'data/genes.json',
    'data/codon_pca.json',
    'data/excluded.json',
    'data/annotations.json',
    'vendor/viennarna/vienna.js',
    'vendor/viennarna/vienna.wasm',
    'vendor/viennarna/PROVENANCE.md',
  ]) await assertFile(new URL(path, siteRoot), `required asset ${path}`);
});

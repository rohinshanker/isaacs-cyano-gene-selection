#!/usr/bin/env node
/**
 * Write or check the module preload list in site/index.html.
 *
 * The site ships unbundled ES modules. Left alone, the browser discovers them a
 * level at a time: it fetches js/app.js, parses it, finds its imports, fetches
 * those, and so on, a round trip per level. A `<link rel="modulepreload">` for
 * every statically imported module flattens that into one round of requests, so
 * the page's script is ready sooner on a slow connection.
 *
 * Only static imports are listed. A module reached through `import()` or a
 * Worker is loaded on demand and would be wasted bandwidth at start-up.
 *
 * Usage:
 *   node tools/build_module_preloads.mjs          rewrite the block
 *   node tools/build_module_preloads.mjs --check  exit 1 if it is out of date
 */
import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

export const SITE_ROOT = new URL('../site/', import.meta.url);
export const START_MARK = '<!-- modulepreload:start -->';
export const END_MARK = '<!-- modulepreload:end -->';

const STATIC_IMPORT = /^\s*(?:import|export)\s[^'"]*?from\s+(['"])(\.{1,2}\/[^'"]+)\1|^\s*import\s+(['"])(\.{1,2}\/[^'"]+)\3/gm;

/**
 * Every module statically reachable from the entry, as paths relative to the
 * site root, entry first and the rest sorted.
 */
export async function staticModuleGraph(siteRoot = SITE_ROOT, entry = 'js/app.js') {
  const entryUrl = new URL(entry, siteRoot);
  const pending = [entryUrl];
  const seen = new Set();
  while (pending.length > 0) {
    const url = pending.pop();
    if (seen.has(url.href)) continue;
    seen.add(url.href);
    const source = await readFile(url, 'utf8');
    for (const match of source.matchAll(STATIC_IMPORT)) {
      pending.push(new URL(match[2] ?? match[4], url));
    }
  }
  const relative = (href) => href.slice(siteRoot.href.length);
  const rest = [...seen].filter((href) => href !== entryUrl.href).map(relative).sort();
  return [relative(entryUrl.href), ...rest];
}

/** The preload block for a list of module paths, markers included. */
export function preloadBlock(modules) {
  return [START_MARK, ...modules.map((path) => `<link rel="modulepreload" href="${path}">`), END_MARK]
    .join('\n');
}

/** `html` with its preload block replaced. Throws when the markers are missing. */
export function withPreloadBlock(html, modules) {
  const start = html.indexOf(START_MARK);
  const end = html.indexOf(END_MARK);
  if (start < 0 || end < start) {
    throw new Error(`index.html has no ${START_MARK} ... ${END_MARK} block`);
  }
  return html.slice(0, start) + preloadBlock(modules) + html.slice(end + END_MARK.length);
}

async function main(argv) {
  const htmlUrl = new URL('index.html', SITE_ROOT);
  const html = await readFile(htmlUrl, 'utf8');
  const next = withPreloadBlock(html, await staticModuleGraph());
  if (argv.includes('--check')) {
    if (next === html) {
      console.log('site/index.html module preloads match the import graph');
      return 0;
    }
    console.error('error: site/index.html module preloads are out of date. '
      + 'Run: node tools/build_module_preloads.mjs');
    return 1;
  }
  if (next !== html) await writeFile(htmlUrl, next);
  console.log(`site/index.html lists ${next.split('rel="modulepreload"').length - 1} module preloads`);
  return 0;
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  process.exitCode = await main(process.argv.slice(2));
}

#!/usr/bin/env node
/**
 * Write or check the chromosome loading bar's genes in site/index.html.
 *
 * The bar is the first thing a visitor sees, and its genes used to be added by
 * the page's script, which arrives after the whole module graph: on a slow
 * connection the bar was a bare axis for the first second and a half. The
 * track is therefore shipped in the page itself. It is generated from the same
 * `loadBarGenes` the script uses, so the shipped marks are the ones the script
 * adopts and lights.
 *
 * Usage:
 *   node tools/build_load_bar.mjs          rewrite the block
 *   node tools/build_load_bar.mjs --check  exit 1 if it is out of date
 */
import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { loadBarGenes, loadGeneAttributes } from '../site/js/ui/load-progress.js';

export const PAGE = new URL('../site/index.html', import.meta.url);
export const START_MARK = '<!-- load-bar:start -->';
export const END_MARK = '<!-- load-bar:end -->';
const INDENT = '            ';

/** The shipped marks, markers included. */
export function loadBarBlock(genes = loadBarGenes()) {
  const marks = genes.map((gene) => {
    const attributes = Object.entries(loadGeneAttributes(gene))
      .map(([name, value]) => `${name}="${value}"`).join(' ');
    return `${INDENT}<rect ${attributes}></rect>`;
  });
  return [START_MARK, ...marks, `${INDENT}${END_MARK}`].join('\n');
}

/** `html` with its load-bar block replaced. Throws when the markers are missing. */
export function withLoadBarBlock(html, genes = loadBarGenes()) {
  const start = html.indexOf(START_MARK);
  const end = html.indexOf(END_MARK);
  if (start < 0 || end < start) {
    throw new Error(`index.html has no ${START_MARK} ... ${END_MARK} block`);
  }
  return html.slice(0, start) + loadBarBlock(genes) + html.slice(end + END_MARK.length);
}

async function main(argv) {
  const html = await readFile(PAGE, 'utf8');
  const next = withLoadBarBlock(html);
  if (argv.includes('--check')) {
    if (next === html) {
      console.log('site/index.html loading bar matches ui/load-progress.js');
      return 0;
    }
    console.error('error: the loading bar in site/index.html is out of date. '
      + 'Run: node tools/build_load_bar.mjs');
    return 1;
  }
  if (next !== html) await writeFile(PAGE, next);
  console.log(`site/index.html ships ${loadBarGenes().length} loading-bar genes`);
  return 0;
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  process.exitCode = await main(process.argv.slice(2));
}

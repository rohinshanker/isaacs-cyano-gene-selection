/**
 * Every module constant a published module names is one it can actually reach.
 *
 * `app.js` went on naming `CATEGORICAL_SCALE_REASON` after that constant moved
 * into `ui/scale-select.js` without gaining the import. Nothing failed until a
 * reader chose Function category in a browser: an unresolved identifier is a
 * JavaScript runtime error, raised only when its line runs, and a name that no
 * module in the graph exports raises it no differently from a typo. This is the
 * static half of the guard — the handler tests run the lines, and this reads the
 * published modules and fails on a constant used where nothing binds it.
 *
 * Scope is UPPER_SNAKE_CASE identifiers, which in this codebase are module
 * constants and nothing else: never a parameter, a loop variable or a destructured
 * field. That is what makes the check decidable without a parser and without a new
 * dependency — a bare mention the file neither imports nor declares is a defect,
 * with no further analysis needed. A camelCase function referenced the same way is
 * out of scope here; those are reached by the tests that call them.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';

const MODULE_ROOT = new URL('../../site/js/', import.meta.url);
const CONSTANT = /^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*$/;

/** Every published module, depth first. */
async function modulePaths(directory = MODULE_ROOT) {
  const paths = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const url = new URL(entry.name + (entry.isDirectory() ? '/' : ''), directory);
    if (entry.isDirectory()) paths.push(...await modulePaths(url));
    else if (entry.name.endsWith('.js')) paths.push(url);
  }
  return paths;
}

/**
 * `source` with the contents of every comment, string, template literal and
 * regular expression replaced by spaces, so a name is counted only where it is
 * code. Offsets and line breaks are preserved, which keeps a reported line number
 * honest.
 *
 * A template literal's `${...}` holes are code and are kept; a regular expression
 * is recognised from the token before it, which is the only way to tell `/` apart
 * from division without parsing.
 */
function codeOnly(source) {
  const out = [];
  let index = 0;
  let previous = '';
  const blank = (text) => text.replace(/[^\n]/g, ' ');
  const takeUntil = (start, end) => {
    let at = start;
    while (at < source.length) {
      if (source[at] === '\\') at += 2;
      else if (source.startsWith(end, at)) return at + end.length;
      else at += 1;
    }
    return source.length;
  };
  while (index < source.length) {
    const char = source[index];
    if (char === '/' && source[index + 1] === '/') {
      const stop = source.indexOf('\n', index);
      const end = stop === -1 ? source.length : stop;
      out.push(blank(source.slice(index, end)));
      index = end;
    } else if (char === '/' && source[index + 1] === '*') {
      const end = Math.min(source.length, source.indexOf('*/', index) + 2 || source.length);
      out.push(blank(source.slice(index, end)));
      index = end;
    } else if (char === '\'' || char === '"') {
      const end = takeUntil(index + 1, char);
      out.push(char + blank(source.slice(index + 1, end - 1)) + source[end - 1]);
      index = end;
    } else if (char === '`') {
      // Blank the literal text but keep every `${...}` hole, which is code.
      let at = index + 1;
      out.push('`');
      while (at < source.length && source[at] !== '`') {
        if (source[at] === '\\') { out.push('  '); at += 2; continue; }
        if (source.startsWith('${', at)) {
          let depth = 1;
          let hole = at + 2;
          while (hole < source.length && depth > 0) {
            if (source[hole] === '{') depth += 1;
            else if (source[hole] === '}') depth -= 1;
            hole += 1;
          }
          out.push(source.slice(at, hole));
          at = hole;
          continue;
        }
        out.push(source[at] === '\n' ? '\n' : ' ');
        at += 1;
      }
      out.push(at < source.length ? '`' : '');
      index = at + 1;
    } else if (char === '/' && /[=(,:[!&|?{};+\-*%~^]|return|typeof|case/.test(previous)) {
      const end = takeUntil(index + 1, '/');
      out.push(blank(source.slice(index, end)));
      index = end;
    } else {
      out.push(char);
      if (!/\s/.test(char)) previous = /[\w$]/.test(char) ? `${previous}${char}` : char;
      index += 1;
    }
  }
  return out.join('');
}

/** The local names an import statement binds, `as` aliases included. */
function importedNames(clause) {
  return [...clause.matchAll(/([\w$]+)\s*(?:,|\}|$)/g)]
    .map((match) => match[1])
    .filter((name) => name !== 'from');
}

test('every UPPER_SNAKE constant a module names is imported or declared there', async () => {
  const paths = await modulePaths();
  const sources = new Map();
  const exported = new Map();
  for (const url of paths) {
    const code = codeOnly(await readFile(url, 'utf8'));
    sources.set(url.href, code);
    for (const match of code.matchAll(/export\s+const\s+([A-Z][A-Z0-9_]*)\b/g)) {
      exported.set(match[1], url.href.slice(MODULE_ROOT.href.length));
    }
  }
  assert.ok(exported.has('CATEGORICAL_SCALE_REASON'),
    'the constants this check knows about are the ones the modules export');

  const unresolved = [];
  for (const [href, code] of sources) {
    // Import clauses name the exporting module's own binding, which is not a
    // reference in this file; the local binding it introduces is collected instead.
    const bound = new Set();
    let body = code;
    for (const statement of code.matchAll(/import\s+([^;]*?)\s*from\s*['"][^'"]*['"]\s*;/g)) {
      for (const name of importedNames(statement[1])) bound.add(name);
      body = body.replace(statement[0], (text) => text.replace(/[^\n]/g, ' '));
    }
    for (const match of body.matchAll(/\b(?:const|let|var|function|class)\s+([A-Z][A-Z0-9_]*)\b/g)) {
      bound.add(match[1]);
    }
    for (const match of body.matchAll(/(\.?)\b([A-Z][A-Z0-9_]*)\b\s*(:?)/g)) {
      const [, property, name, key] = match;
      // A property access and an object-literal key are not references to a
      // binding of that name; a lone identifier is.
      if (property || key || bound.has(name) || !CONSTANT.test(name)) continue;
      if (!exported.has(name)) continue;
      const line = body.slice(0, match.index).split('\n').length;
      unresolved.push(`${href.slice(MODULE_ROOT.href.length)}:${line} names ${name}, `
        + `exported by ${exported.get(name)}, without importing or declaring it`);
    }
  }
  assert.deepEqual(unresolved, []);
});

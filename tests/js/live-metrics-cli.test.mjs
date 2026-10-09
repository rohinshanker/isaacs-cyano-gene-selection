import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const run = promisify(execFile);
const script = fileURLToPath(new URL('../../tools/check_live_metrics.mjs', import.meta.url));

test('the live-metric CLI validates Syn61 with its declared parent-reference layer', async () => {
  const { stdout, stderr } = await run(process.execPath,
    [script, '--organism', 'ecoli-syn61-delta3-ev5'], { timeout: 60_000 });
  assert.equal(stderr, '');
  assert.match(stdout, /PASS  dataset loads every gene: 3549 of 3549/);
  assert.match(stdout, /failed=0\s*$/);
});

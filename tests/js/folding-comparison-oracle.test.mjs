import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { compareFoldingWindow } from '../../site/js/core/folding-comparison.js';
import { loadFoldingEngine } from '../../site/js/core/folding-engine.js';

const references = JSON.parse(await readFile(new URL('../fixtures/rna-folding.json', import.meta.url)));

test('real WASM structure comparisons agree with native ViennaRNA over every genomic fixture', async () => {
  const binary = await readFile(new URL('../../site/vendor/viennarna/vienna.wasm', import.meta.url));
  const fold = await loadFoldingEngine({ fetchImpl: async () => ({
    ok: true,
    arrayBuffer: async () => binary.buffer.slice(binary.byteOffset, binary.byteOffset + binary.byteLength),
  }) });
  let changed = 0;
  let unchanged = 0;
  for (const sample of references.cases) {
    for (const [name, expected] of Object.entries(sample.windows)) {
      const context = `${sample.gene.id}/${JSON.stringify(sample.map)}/${name}`;
      fold(expected.wild);
      const wildStructure = fold.lastStructure;
      fold(expected.recoded);
      const recodedStructure = fold.lastStructure;
      assert.equal(wildStructure, expected.wildStructure, `${context}: original structure`);
      assert.equal(recodedStructure, expected.recodedStructure, `${context}: recoded structure`);
      const comparison = compareFoldingWindow({
        length: expected.wild.length,
        wildSequence: expected.wild,
        recodedSequence: expected.recoded,
        wildStructure,
        recodedStructure,
      });
      assert.ok(comparison, `${context}: available comparison`);
      assert.equal(comparison.distance, expected.basePairDistance, `${context}: native RNA.bp_distance`);
      assert.equal(comparison.lost.length + comparison.gained.length, comparison.distance, context);
      if (comparison.distance === 0) unchanged += 1;
      else changed += 1;
    }
  }
  assert.equal(unchanged, 22);
  assert.equal(changed, 42);
});

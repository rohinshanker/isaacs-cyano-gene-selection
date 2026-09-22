import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  formatTssStatistic, tssEvidenceModel, tssInitiationBasis,
} from '../../site/js/core/tss-evidence.js';

const completeEntry = {
  id: 'TSS_1', type: 'primary', replicon: 'chromosome', strand: '+', position: 123,
  sourceStartDistanceNt: 22,
  rawReads: {
    control: [10, 20], dark: [30, 40], highLight: [50, 60], highTemperature: [70, 80],
  },
  differential: {
    dark: { log2FoldChange: -1.5, padj: 0.01 },
    highLight: { log2FoldChange: 2.25, padj: 0.02 },
    highTemperature: { log2FoldChange: 0, padj: 1 },
  },
};

test('zero TSS entries stay explicit and do not invent evidence', () => {
  assert.deepEqual(tssEvidenceModel({ tssEvidence: [] }), { count: 0, entries: [] });
  assert.deepEqual(tssEvidenceModel({}), { count: 0, entries: [] });
});

test('initiation basis explains both mismatch directions without filling either layer', () => {
  const siteOnly = tssInitiationBasis({ tssInitiation: null, tssEvidence: [completeEntry] });
  assert.equal(siteOnly.basis, 'none');
  assert.equal(siteOnly.siteCount, 1);
  assert.match(siteOnly.short, /1 mapped site; pooled score absent/);
  assert.match(siteOnly.text, /exact locus tag/);
  assert.match(siteOnly.text, /do not backfill/);

  const scoreOnly = tssInitiationBasis({ tssInitiation: 12.5, tssEvidence: [] });
  assert.equal(scoreOnly.basis, 'measured');
  assert.equal(scoreOnly.siteCount, 0);
  assert.match(scoreOnly.short, /pooled score; no exact Table S1 site/);
  assert.match(scoreOnly.text, /exact locus tag/);
});

test('one TSS retains both biological cultures and each condition comparison', () => {
  const model = tssEvidenceModel({ tssEvidence: [completeEntry] });
  assert.equal(model.count, 1);
  assert.equal(model.entries[0].sourceStartDistanceNt, 22);
  assert.deepEqual(model.entries[0].rawReads.map((row) => row.cultures), [
    [10, 20], [30, 40], [50, 60], [70, 80],
  ]);
  assert.deepEqual(model.entries[0].differential.map((row) => row.log2FoldChange),
    [-1.5, 2.25, 0]);
  assert.equal('geneFoldChange' in model, false);
  assert.equal('geneFoldChange' in model.entries[0], false);
});

test('multiple TSS entries preserve source order and independent measurements', () => {
  const second = structuredClone(completeEntry);
  second.id = 'TSS_2';
  second.position = 456;
  second.rawReads.control = [2, 4];
  second.differential.dark.log2FoldChange = 3;
  const model = tssEvidenceModel({ tssEvidence: [completeEntry, second] });
  assert.deepEqual(model.entries.map((entry) => entry.id), ['TSS_1', 'TSS_2']);
  assert.deepEqual(model.entries.map((entry) => entry.position), [123, 456]);
  assert.deepEqual(model.entries.map((entry) => entry.differential[0].log2FoldChange), [-1.5, 3]);
});

test('missing and invalid measurements remain unknown rather than becoming zero', () => {
  const model = tssEvidenceModel({ tssEvidence: [{
    id: 'TSS_missing', rawReads: { control: [null] },
    differential: { dark: { log2FoldChange: null, padj: Number.NaN } },
  }] });
  const entry = model.entries[0];
  assert.deepEqual(entry.rawReads[0].cultures, [null, null]);
  assert.deepEqual(entry.rawReads.slice(1).map((row) => row.cultures), [
    [null, null], [null, null], [null, null],
  ]);
  assert.deepEqual(entry.differential[0], {
    key: 'dark', label: 'Dark', log2FoldChange: null, padj: null,
  });
  assert.ok(entry.differential.every((row) => row.log2FoldChange === null));
});

test('tiny adjusted p-values stay legible and nonzero', () => {
  assert.equal(formatTssStatistic(6.0420381406449e-98), '6.042e-98');
  assert.equal(formatTssStatistic(6.56e-11), '6.560e-11');
  assert.equal(formatTssStatistic(0), '0');
  assert.equal(formatTssStatistic(-2.3185), '-2.319');
  assert.equal(formatTssStatistic(null), 'Unknown');
});

test('the detail panel labels missing TSS values as unknown and states the safe semantics', async () => {
  const source = await readFile(new URL('../../site/js/ui/side-panel.js', import.meta.url), 'utf8');
  assert.match(source, /: 'Unknown'/);
  assert.match(source, /Missing DESeq2 results are unknown, not zero/);
  assert.match(source, /only two biological cultures per condition/);
  assert.match(source, /site can fall inside the current CDS/);
  assert.match(source, /no gene-level.*fold-change aggregate is calculated/s);
  assert.match(source, /caption\.className = 'visually-hidden'/);
  assert.doesNotMatch(source, /high light[^'\n]*\b(?:min|hour|h)\b/i);
});

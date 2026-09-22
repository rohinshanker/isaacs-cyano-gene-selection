import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  geneIdentity, geneIdentityDescription, geneMapLabel,
} from '../../site/js/core/gene-identity.js';

test('KaiA uses its annotated product without inventing a gene symbol', () => {
  const gene = {
    id: 'M744_RS10050', name: null, product: 'circadian clock protein KaiA',
  };
  assert.deepEqual(geneIdentity(gene), {
    kind: 'Product', text: 'circadian clock protein KaiA',
  });
  assert.equal(geneIdentityDescription(gene), 'Product: circadian clock protein KaiA');
  assert.equal(geneMapLabel(gene), 'M744_RS10050 circadian clock protein KaiA');
});

test('a direct symbol wins over product text for KaiB and KaiC', () => {
  for (const [id, symbol] of [
    ['M744_RS10055', 'kaiB'], ['M744_RS10060', 'kaiC'],
  ]) {
    const gene = { id, name: symbol, product: `circadian clock protein ${symbol}` };
    assert.deepEqual(geneIdentity(gene), { kind: 'Gene symbol', text: symbol });
    assert.equal(geneMapLabel(gene), `${id} ${symbol}`);
  }
});

test('hypothetical and absent product annotations stay explicit', () => {
  const hypothetical = { id: 'M744_RS00030', name: null, product: 'hypothetical protein' };
  assert.equal(geneIdentityDescription(hypothetical), 'Product: hypothetical protein');
  const unknown = { id: 'M744_RS00000', name: '', product: null };
  assert.equal(geneIdentity(unknown), null);
  assert.equal(geneIdentityDescription(unknown), 'No gene symbol or product annotated');
  assert.equal(geneMapLabel(unknown), unknown.id);
});

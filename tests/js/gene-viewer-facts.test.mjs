import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderGeneViewer } from '../../site/js/ui/gene-viewer.js';
import { MISSING } from '../../site/js/ui/format.js';
import { withFakeDocument } from './fake-dom.mjs';

const GENE = {
  id: 'M744_RS00025', name: null, product: 'YheT family hydrolase', seqid: 'NZ_CP006471.1',
  strand: '+', start: 4314, end: 5318, lengthNt: 1005, lengthCodons: 334, terminalStop: 'TGA',
  cdsSegments: null, translationalException: null,
};

/** The facts list's value for one term, as a reader sees it. */
function fact(host, term) {
  const children = host.querySelector('dl.gene-view-facts').children;
  const index = children.findIndex((child) => child.tagName === 'dt' && child.textContent === term);
  return children[index + 1].textContent;
}

test('a missing codon count renders as missing, never as zero sense codons', async () => {
  await withFakeDocument((document) => {
    const host = document.createElement('div');
    renderGeneViewer(host, GENE);
    assert.equal(fact(host, 'Length'), '1,005 nt, 334 sense codons');
    renderGeneViewer(host, { ...GENE, lengthCodons: null });
    assert.equal(fact(host, 'Length'), `1,005 nt, ${MISSING} sense codons`);
    assert.doesNotMatch(fact(host, 'Length'), /0 sense codons/);
  });
});

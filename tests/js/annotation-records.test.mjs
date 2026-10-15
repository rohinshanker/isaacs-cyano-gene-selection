/**
 * Owner decision D10, 2026-10-14: noncoding genes and pseudogenes are found and
 * opened as annotation records, never as CDSs; hypothetical proteins are CDSs of
 * unknown function, never noncoding.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { withFakeDocument } from './fake-dom.mjs';
import { ORGANISMS, DEFAULT_ORGANISM } from '../../site/js/core/organisms.js';
import { validateGeneOverlaps } from '../../site/js/core/gene-overlaps.js';
import {
  annotationRecordsOf, searchAnnotationRecords, biotypeLabel, hasUnknownFunction, functionStatusNote,
  UNKNOWN_FUNCTION_NOTE,
} from '../../site/js/core/annotation-records.js';
import { GeneSearchResults, searchRowModel, annotationRecordsNote } from '../../site/js/ui/gene-search-results.js';
import { annotationRecordFacts, annotationRecordLead, renderAnnotationRecord } from '../../site/js/ui/annotation-record.js';

async function shipped(organism) {
  const base = new URL(`../../site/${organism.dataDirectory}/`, import.meta.url);
  const [genes, payload] = await Promise.all(['genes.json', 'gene_overlaps.json'].map(async (name) =>
    JSON.parse(await readFile(new URL(name, base), 'utf8'))));
  return { genes, payload, index: validateGeneOverlaps(payload, genes, organism) };
}

test('every organism offers exactly its non-CDS catalogue records, none of them a plotted CDS', async () => {
  for (const organism of ORGANISMS) {
    const { genes, payload, index } = await shipped(organism);
    const { status, records } = annotationRecordsOf({ geneOverlaps: index });
    assert.equal(status, 'ready', organism.id);
    const cdsIds = new Set(genes.map((gene) => gene.id));
    const expected = [...payload.features, ...payload.contextFeatures].filter((f) => !cdsIds.has(f.id));
    assert.equal(records.length, expected.length, organism.id);
    assert.ok(records.every((record) => !cdsIds.has(record.id) && record.selectable === false), organism.id);
  }
});

test('UTEX 2973: 61 records found by locus tag, name and kind', async () => {
  const { index } = await shipped(DEFAULT_ORGANISM);
  const { records } = annotationRecordsOf({ geneOverlaps: index });
  assert.equal(records.length, 61);
  const count = (query) => searchAnnotationRecords(records, query, { limit: 100 }).total;
  assert.equal(count('tRNA'), 44);
  assert.equal(count('rRNA'), 6);
  assert.equal(count('pseudogene'), 7);
  assert.equal(count('noncoding'), 54, 'every RNA gene, no pseudogene');
  const trna = records.find((record) => record.biotype === 'tRNA');
  const exact = searchAnnotationRecords(records, trna.id);
  assert.equal(exact.shown[0].record.id, trna.id);
  assert.equal(exact.shown[0].matchedOn, 'locus tag');
  assert.equal(searchAnnotationRecords(records, 'dnaA').total, 0, 'a CDS name finds no record');
  assert.equal(searchAnnotationRecords(records, '  ').total, 0);
  assert.equal(searchAnnotationRecords(records, '!!!').total, 0, 'punctuation alone matches nothing (R6)');
});

test('labels and facts say what the release says', () => {
  assert.equal(biotypeLabel({ biotype: 'tRNA', pseudo: false }), 'tRNA gene');
  assert.equal(biotypeLabel({ biotype: 'pseudogene', pseudo: true }), 'pseudogene');
  assert.equal(biotypeLabel({ biotype: 'tRNA', pseudo: true }), 'tRNA gene, pseudogene');
  assert.equal(biotypeLabel({ biotype: 'misc_RNA', pseudo: false }), 'misc_RNA gene');
  const facts = Object.fromEntries(annotationRecordFacts({
    id: 'X', biotype: 'rRNA', pseudo: false, seqid: 'NZ_A.1', strand: '-', segmentSource: 'child',
    segments: [{ from: 1200, to: 2690 }],
  }));
  assert.equal(facts['Gene type'], 'rRNA gene');
  assert.equal(facts.Pseudogene, 'no');
  assert.equal(facts.Strand, 'minus');
  assert.equal(facts.Segment, '1,200–2,690 (1-based inclusive, from child features)');
});

test('unknown function is read from the annotation conventions only, per organism', async () => {
  for (const product of ['hypothetical protein', 'Hypothetical protein', 'uncharacterized protein YaeQ',
    'putative uncharacterized protein YabP', 'uncharacterized protein', 'Uncharacterized design CDS']) {
    assert.equal(hasUnknownFunction({ product }), true, product);
  }
  for (const product of ['hypothetical protein with a DUF domain', 'conserved protein of unknown function',
    'photosystem II protein D1', '', null, 'tRNA-Gly']) {
    assert.equal(hasUnknownFunction({ product }), false, String(product));
  }
  assert.equal(functionStatusNote({ product: 'hypothetical protein' }), UNKNOWN_FUNCTION_NOTE);
  assert.match(UNKNOWN_FUNCTION_NOTE, /protein-coding/);
  assert.match(UNKNOWN_FUNCTION_NOTE, /not a noncoding gene/);
  const { genes } = await shipped(DEFAULT_ORGANISM);
  assert.equal(genes.filter(hasUnknownFunction).length, 394);
});

function fakeIndex() {
  const record = { id: 'R_TRNA1', name: null, biotype: 'tRNA', pseudo: false, seqid: 'NZ_A.1', strand: '+',
    segmentSource: 'child', segments: [{ from: 100, to: 172 }], selectable: false, geneIndex: -1 };
  const pseudo = { ...record, id: 'R_PSEUDO', biotype: 'pseudogene', pseudo: true, segments: [{ from: 400, to: 900 }] };
  const cds = { ...record, id: 'C1', name: 'abcD', biotype: 'protein_coding', selectable: true, geneIndex: 0,
    segments: [{ from: 150, to: 600 }] };
  const partnersById = new Map([['R_TRNA1', [{ ...cds, sharedBases: 23 }]], ['R_PSEUDO', []]]);
  return { catalogue: [record, pseudo, cds], partnersById, neighbours: { get: () => null } };
}

test('search lists records apart from CDSs; Open shows a read-only card and offers no pin', async () => {
  await withFakeDocument((document) => {
    const host = document.createElement('div');
    document.body.append(host);
    const calls = { pin: [], partner: [], trna: [] };
    const results = new GeneSearchResults(host, {
      onPin: (i) => calls.pin.push(i), onShortlist() {}, isShortlisted: () => false, isPinned: () => false,
      onOpenPartner: (id, index) => calls.partner.push([id, index]), onShowTrna: (id) => calls.trna.push(id),
    });
    const genes = [{ id: 'C1', name: 'abcD', product: 'hypothetical protein' }];
    results.setGenes(genes, null, { genes, geneOverlaps: fakeIndex() });
    const result = results.search('R_');
    assert.equal(result.total, 0);
    assert.equal(result.records.total, 2);
    assert.match(host.querySelector('p.search-status').textContent, /No plotted CDS matches/);
    const recordList = host.querySelector('ul.search-records');
    assert.ok(recordList);
    assert.match(host.textContent, /2 annotated genes outside the plotted CDS set match\. These are annotation records/);
    const buttons = () => host.querySelectorAll('button');
    assert.ok(!buttons().some((b) => /^(Pin|Shortlist)$/.test(b.textContent)), 'no pin or shortlist for a record');
    const open = buttons().find((b) => b.dataset.geneId === 'R_TRNA1' && b.dataset.searchAction === 'open-record');
    assert.equal(open.getAttribute('aria-expanded'), 'false');
    open.dispatch('click');
    const card = host.querySelector('div.annotation-record');
    assert.ok(card, 'the record opens in place');
    assert.match(card.textContent, /not a CDS: no codon, protein or recoding metric/);
    assert.match(card.textContent, /tRNA gene/);
    assert.match(card.textContent, /Shares bases with 1 annotated gene/);
    assert.equal(buttons().find((b) => b.dataset.geneId === 'R_TRNA1' && b.dataset.searchAction === 'open-record')
      .getAttribute('aria-expanded'), 'true');
    buttons().find((b) => b.textContent === 'Open C1').dispatch('click');
    assert.deepEqual(calls.partner, [['C1', 0]], 'a partner CDS opens as that CDS');
    buttons().find((b) => b.textContent === 'Show in the tRNA browser').dispatch('click');
    assert.deepEqual(calls.trna, ['R_TRNA1']);
    assert.deepEqual(calls.pin, [], 'nothing was pinned');
    // The opened card survives a redraw of the same list.
    results.refresh();
    assert.ok(host.querySelector('div.annotation-record'));

    // A CDS hit carries the unknown-function note beside its product.
    results.search('abcD');
    assert.match(host.textContent, /Predicted protein-coding gene of unknown function; not a noncoding gene\./);
    const row = searchRowModel({ gene: genes[0], index: 0, matchedOn: 'gene name' },
      { isPinned: () => false, isShortlisted: () => false });
    assert.equal(row.functionLine, UNKNOWN_FUNCTION_NOTE);
  });
});

test('a catalogue in flight or failed says records cannot match yet', () => {
  assert.match(annotationRecordsNote('loading'), /still loading/);
  assert.match(annotationRecordsNote('failed'), /could not be loaded/);
  assert.equal(annotationRecordsNote('ready'), '');
  assert.match(annotationRecordsNote('unavailable'), /no annotation catalogue/);
  assert.equal(annotationRecordsOf({ files: { geneOverlaps: { state: 'loading' } } }).status, 'loading');
  assert.equal(annotationRecordsOf({ geneOverlaps: { catalogue: null } }).status, 'unavailable');
});

test('E. coli selenoproteins are coding genes outside the plotted set, never called noncoding (R1)', async () => {
  const organism = ORGANISMS.find((entry) => entry.id === 'ecoli-k12-mg1655');
  const { index } = await shipped(organism);
  const { records } = annotationRecordsOf({ geneOverlaps: index });
  const excluded = JSON.parse(await readFile(new URL(`../../site/${organism.dataDirectory}/excluded.json`, import.meta.url), 'utf8'));
  for (const name of ['fdnG', 'fdoG', 'fdhF']) {
    const record = records.find((entry) => entry.name === name);
    assert.ok(record, name);
    assert.equal(biotypeLabel(record), 'protein-coding gene, not in the plotted CDS set');
    const lead = annotationRecordLead(record, excluded.find((row) => row.id === record.id));
    assert.match(lead, /protein-coding gene that this map does not plot, because it is a selenoprotein whose in-frame TGA encodes selenocysteine/);
    assert.doesNotMatch(lead, /not a CDS/);
  }
});

test('a tRNA hand-off is offered only when its list can take it (R4)', async () => {
  await withFakeDocument(() => {
    const record = fakeIndex().catalogue[0];
    const button = (state) => renderAnnotationRecord(record, { trnaState: state, onShowTrna: () => {} })
      .querySelectorAll('button').find((b) => b.textContent === 'Show in the tRNA browser');
    assert.equal(button('ready').disabled, false);
    assert.equal(button('loading').disabled, true);
    assert.equal(button('failed').disabled, true);
    assert.equal(button('absent'), undefined);
  });
});

test('an opened card keeps its neighbour disclosure and focus across redraws (R3)', async () => {
  await withFakeDocument((document) => {
    const host = document.createElement('div');
    document.body.append(host);
    const results = new GeneSearchResults(host, {
      onPin() {}, onShortlist() {}, isShortlisted: () => false, isPinned: () => false,
    });
    const index = fakeIndex();
    results.setGenes([], null, { genes: [], geneOverlaps: index });
    results.search('R_PSEUDO');
    host.querySelectorAll('button').find((b) => b.dataset.searchAction === 'open-record').dispatch('click');
    const details = host.querySelector('div.annotation-record').querySelector('details');
    details.open = true;
    details.querySelector('summary').focus();
    results.refresh();
    const after = host.querySelector('div.annotation-record').querySelector('details');
    assert.equal(after.open, true, 'still open');
    assert.equal(document.activeElement, after.querySelector('summary'), 'focus returns to it');
    // A new overlap index rebuilds the card and carries the open state over.
    results.setGenes([], null, { genes: [], geneOverlaps: { ...index } });
    results.refresh();
    assert.equal(host.querySelector('div.annotation-record').querySelector('details').open, true);
  });
});

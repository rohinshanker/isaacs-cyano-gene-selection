/**
 * The overlapping-gene (OG) model: what the loader accepts, what it refuses,
 * and the classes, filter and geometry every view reads.
 *
 * The payloads here are written by hand so each expectation is a coordinate a
 * reader can check. `tests/test_gene_overlaps.py` holds the producer's side of
 * the same definition, against synthetic annotations.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  OVERLAPPING_CLASS_IDS, OVERLAP_CLASSES, OVERLAP_CLASS_IDS, OVERLAP_FILTERS,
  classOfPartners, containmentOf, coveredBases, describeOverlapCoverage, describeOverlapRule,
  describeOverlapDefinition, describePartner, overlapFilterActs, overlapFilterOf,
  overlapMarksInWindow, overlapSelectionFor,
  passesOverlapClassFilter, repliconOverlapMarks, sharedSegments, strandRelation,
  validateGeneOverlaps,
} from '../../site/js/core/gene-overlaps.js';
import { offsetPieces, overlapTracks } from '../../site/js/core/gene-view-model.js';
import { DATA_APPLIERS } from '../../site/js/core/dataset.js';

const ORGANISM = {
  genome: {
    accession: 'GCF_000000000.1',
    replicons: [
      { accession: 'chr1', lengthBp: 1000, primary: true, role: 'chromosome', label: 'Chromosome' },
      { accession: 'plasmid1', lengthBp: 500, primary: false, role: 'plasmid', label: 'Plasmid' },
    ],
  },
};

const DEFINITION = Object.freeze({
  features: 'every gene or pseudogene row with a locus tag',
  extent: 'the gene’s annotated child segments',
  overlap: 'at least one shared genomic base on the same replicon, on either strand',
  excluded: 'regulatory and misc_feature rows',
});

function feature(id, options = {}) {
  return {
    id,
    name: null,
    biotype: 'protein_coding',
    seqid: 'chr1',
    strand: '+',
    segments: [[100, 200]],
    segmentSource: 'child',
    pseudo: false,
    ...options,
  };
}

/**
 * A payload whose coverage block is derived from what it lists, so it loads.
 *
 * `coveredGenes` defaults to every listed feature plus every plotted gene the
 * caller names, padded to the census total, because the loader refuses a layer
 * that did not compare a plotted CDS.
 */
function payload({ features = [], pairs = [], annotatedGenes = null, byBiotype = null,
  childlessGenes = 0, replicons = null, covers = [], coveredGenes = null } = {}) {
  const pairwiseSharedBases = pairs.reduce((total, [, , pieces]) => total
    + pieces.reduce((sum, [from, to]) => sum + (to - from + 1), 0), 0);
  const degrees = new Map();
  for (const [first, second] of pairs) {
    degrees.set(first, (degrees.get(first) ?? 0) + 1);
    degrees.set(second, (degrees.get(second) ?? 0) + 1);
  }
  const named = [...new Set([...features.map((feature) => feature.id), ...covers])];
  const census = byBiotype ?? { protein_coding: annotatedGenes ?? named.length };
  const total = Object.values(census).reduce((sum, count) => sum + count, 0);
  const inventory = coveredGenes ?? [
    ...named,
    ...Array.from({ length: Math.max(0, total - named.length) }, (_, i) => `PAD${i}`),
  ].sort();
  return {
    schemaVersion: 1,
    datasetVersion: 'gene-overlaps-v1',
    origin: 'computed',
    producer: 'tools/build_gene_overlaps.py',
    definition: { ...DEFINITION },
    release: { accession: 'GCF_000000000.1', gff: 'ASM0v1_genomic.gff.gz', sha256: 'a'.repeat(64) },
    replicons: replicons ?? [
      { accession: 'chr1', lengthBp: 1000 },
      { accession: 'plasmid1', lengthBp: 500 },
    ],
    coverage: {
      annotatedGenes: total,
      byBiotype: census,
      childlessGenes,
      overlappingGenes: features.length,
      overlappingPairs: pairs.length,
      pairwiseSharedBases,
      maxPartners: Math.max(0, ...degrees.values()),
    },
    coveredGenes: inventory,
    features,
    pairs,
  };
}

/** Plotted CDS rows, the shape `genes.json` ships. */
function geneRow(id, options = {}) {
  return {
    id, seqid: 'chr1', strand: '+', start: 100, end: 200, cdsSegments: null, ...options,
  };
}

test('exact interval arithmetic: one shared base counts, abutting ends do not', () => {
  assert.deepEqual(sharedSegments([{ from: 1, to: 10 }], [{ from: 10, to: 20 }]),
    [{ from: 10, to: 10 }]);
  assert.deepEqual(sharedSegments([{ from: 1, to: 10 }], [{ from: 11, to: 20 }]), []);
  // Two shared stretches through two of the gene's own segments, merged only
  // where they really touch.
  assert.deepEqual(
    sharedSegments([{ from: 1, to: 10 }, { from: 20, to: 30 }], [{ from: 5, to: 25 }]),
    [{ from: 5, to: 10 }, { from: 20, to: 25 }],
  );
  assert.equal(coveredBases([{ from: 1, to: 10 }, { from: 20, to: 25 }]), 16);
});

test('containment is told apart from equality and from a partial overlap', () => {
  const long = [{ from: 100, to: 400 }];
  const short = [{ from: 200, to: 300 }];
  assert.equal(containmentOf(long, short), 'contains');
  assert.equal(containmentOf(short, long), 'containedBy');
  assert.equal(containmentOf(long, long), 'equal');
  assert.equal(containmentOf(long, [{ from: 300, to: 500 }]), 'partial');
});

test('the class of a gene follows the strands of every partner it has', () => {
  assert.equal(strandRelation('+', '+'), 'same');
  assert.equal(strandRelation('+', '-'), 'opposite');
  assert.equal(strandRelation('+', null), 'unknown');
  assert.equal(classOfPartners([]), 'no-overlap');
  assert.equal(classOfPartners([{ relation: 'same' }]), 'overlap-same-strand');
  assert.equal(classOfPartners([{ relation: 'opposite' }]), 'overlap-opposite-strand');
  assert.equal(classOfPartners([{ relation: 'same' }, { relation: 'opposite' }]),
    'overlap-both-strands');
  // A partner whose strand the release does not record adds no relation, and
  // naming one would invent a transcription direction. Only a gene whose
  // partners are all unrecorded falls in the class that says so.
  assert.equal(classOfPartners([{ relation: 'unknown' }]), 'overlap-strand-unrecorded');
  assert.equal(classOfPartners([{ relation: 'unknown' }, { relation: 'unknown' }]),
    'overlap-strand-unrecorded');
  assert.equal(classOfPartners([{ relation: 'same' }, { relation: 'unknown' }]),
    'overlap-same-strand');
  assert.equal(classOfPartners([{ relation: 'opposite' }, { relation: 'unknown' }]),
    'overlap-opposite-strand');
  assert.equal(
    classOfPartners([{ relation: 'same' }, { relation: 'opposite' }, { relation: 'unknown' }]),
    'overlap-both-strands',
  );
  assert.equal(OVERLAP_CLASSES.length, 5);
  assert.deepEqual(OVERLAP_CLASS_IDS, OVERLAP_CLASSES.map((entry) => entry.id));
  assert.ok(OVERLAP_CLASSES.every((entry) => entry.label && entry.note));
});

test('the filter is one channel: three named states and the class set they stand for', () => {
  assert.deepEqual(OVERLAP_FILTERS, ['any', 'only', 'none']);
  assert.deepEqual(overlapSelectionFor('only'), [...OVERLAPPING_CLASS_IDS]);
  assert.deepEqual(overlapSelectionFor('none'), ['no-overlap']);
  assert.deepEqual(overlapSelectionFor('any'), []);
  for (const state of OVERLAP_FILTERS) {
    assert.equal(overlapFilterOf(overlapSelectionFor(state)), state, state);
  }
  // A selection the three options cannot express is reported as such rather
  // than shown as one of them.
  assert.equal(overlapFilterOf(['overlap-same-strand']), null);
  assert.ok(!OVERLAPPING_CLASS_IDS.includes('no-overlap'));
});

test('a validated payload indexes partners, classes, counts and coverage', () => {
  const genes = [geneRow('A'), geneRow('B', { strand: '-', start: 190, end: 400 }),
    geneRow('C', { start: 600, end: 700 })];
  const index = validateGeneOverlaps(payload({
    features: [
      feature('A'),
      feature('B', { strand: '-', segments: [[190, 400]] }),
      // On B's own strand, so B has partners on both strands at once.
      feature('T', { biotype: 'tRNA', strand: '-', segments: [[395, 420]] }),
    ],
    pairs: [[0, 1, [[190, 200]]], [1, 2, [[395, 400]]]],
    byBiotype: { protein_coding: 9, tRNA: 1 },
    covers: ['C'],
  }), genes, ORGANISM);

  assert.equal(index.state, 'ready');
  assert.deepEqual([...index.values], [
    OVERLAP_CLASS_IDS.indexOf('overlap-opposite-strand'),
    OVERLAP_CLASS_IDS.indexOf('overlap-both-strands'),
    OVERLAP_CLASS_IDS.indexOf('no-overlap'),
  ]);
  assert.deepEqual([...index.counts], [1, 0, 1, 1, 0]);
  assert.equal(index.coverage.annotatedGenes, 10);
  assert.equal(index.coverage.selectableGenes, 3);
  assert.equal(index.coverage.selectableOverlapping, 2);
  // The tRNA is a partner the map does not plot, and it says so rather than
  // offering a route into a gene list it is not in.
  assert.equal(index.coverage.partnersNotSelectable, 1);
  const partners = index.partnersById.get('B');
  assert.deepEqual(partners.map((partner) => [partner.id, partner.relation, partner.selectable]),
    [['A', 'opposite', true], ['T', 'same', false]]);
  assert.deepEqual(partners[0].sharedIntervals, [{ from: 190, to: 200 }]);
  assert.equal(partners[0].sharedBases, 11);
  assert.equal(index.partnersById.get('T')[0].geneIndex, 1);
});

test('partners are ordered by the bases they share, so a compact strip shows the widest', () => {
  const index = validateGeneOverlaps(payload({
    features: [
      feature('A', { segments: [[100, 500]] }),
      feature('S', { strand: '-', segments: [[495, 600]] }),
      feature('W', { strand: '-', segments: [[200, 300]] }),
    ],
    pairs: [[0, 1, [[495, 500]]], [0, 2, [[200, 300]]]],
  }), [geneRow('A', { end: 500 })], ORGANISM);
  assert.deepEqual(index.partnersById.get('A').map((partner) => partner.id), ['W', 'S']);
  assert.equal(index.partnersById.get('A')[0].containment, 'contains');
});

test('the chromosome row gets one mark per shared stretch, in coordinate order', () => {
  const index = validateGeneOverlaps(payload({
    features: [
      feature('A', { segments: [[100, 200]] }),
      feature('B', { strand: '-', segments: [[190, 400]] }),
      feature('P', { seqid: 'plasmid1', segments: [[10, 60]] }),
      feature('Q', { seqid: 'plasmid1', strand: '-', segments: [[55, 90]] }),
    ],
    pairs: [[0, 1, [[190, 200]]], [2, 3, [[55, 60]]]],
  }), [], ORGANISM);
  const marks = repliconOverlapMarks(index, 'chr1');
  assert.equal(marks.length, 1);
  assert.deepEqual([marks[0].from, marks[0].to, marks[0].bases, marks[0].relation],
    [190, 200, 11, 'opposite']);
  assert.deepEqual(marks[0].genes.map((gene) => gene.id), ['A', 'B']);
  // Each replicon keeps its own marks; a plasmid coordinate never reaches the
  // chromosome row.
  assert.deepEqual(repliconOverlapMarks(index, 'plasmid1').map((mark) => mark.from), [55]);
  assert.deepEqual(repliconOverlapMarks(index, 'nothing'), []);
  assert.deepEqual(overlapMarksInWindow(marks, { from: 1, to: 100 }), []);
  assert.deepEqual(overlapMarksInWindow(marks, { from: 195, to: 196 }), marks);
});

test('the filter hides by class, and hides nothing while nothing has been read', () => {
  const genes = [geneRow('A'), geneRow('C', { start: 600, end: 700 })];
  const index = validateGeneOverlaps(payload({
    features: [feature('A'), feature('B', { strand: '-', segments: [[190, 400]] })],
    pairs: [[0, 1, [[190, 200]]]],
    covers: ['C'],
  }), genes, ORGANISM);
  assert.equal(passesOverlapClassFilter(index, genes[0], ['overlap-opposite-strand']), true);
  assert.equal(passesOverlapClassFilter(index, genes[0], ['no-overlap']), false);
  assert.equal(passesOverlapClassFilter(index, genes[1], ['no-overlap']), true);
  assert.equal(passesOverlapClassFilter(index, genes[0], []), true);
  // Nothing read: the filter must not turn a file in flight into a claim.
  assert.equal(passesOverlapClassFilter(null, genes[0], ['no-overlap']), true);
  assert.equal(passesOverlapClassFilter({ state: 'loading' }, genes[0], ['no-overlap']), true);
});

test('the shared intervals are re-derived, so a payload cannot invent a shared base', () => {
  const genes = [geneRow('A')];
  const refuse = (change, pattern) => assert.throws(
    () => validateGeneOverlaps(change, genes, ORGANISM), pattern,
  );
  refuse(payload({
    features: [feature('A'), feature('B', { strand: '-', segments: [[190, 400]] })],
    pairs: [[0, 1, [[150, 200]]]],
  }), /bases for A and B that their segments do not share/);
  refuse(payload({
    features: [feature('A'), feature('B', { segments: [[300, 400]] })],
    pairs: [[0, 1, [[300, 300]]]],
  }), /share no base/);
  refuse(payload({
    features: [feature('A'), feature('P', { seqid: 'plasmid1', segments: [[100, 200]] })],
    pairs: [[0, 1, [[100, 200]]]],
  }), /across two replicons/);
  refuse(payload({
    features: [feature('A'), feature('B', { segments: [[100, 200]] })],
    pairs: [[1, 0, [[100, 200]]]],
  }), /two distinct features in order/);
  refuse(payload({
    features: [feature('A'), feature('B', { segments: [[100, 200]] })],
    pairs: [[0, 0, [[100, 200]]]],
  }), /two distinct features in order/);
});

test('a payload that disagrees with its release, its replicons or genes.json is refused', () => {
  const genes = [geneRow('A')];
  const refuse = (change, pattern) => assert.throws(
    () => validateGeneOverlaps(change, genes, ORGANISM), pattern,
  );
  refuse({ ...payload(), schemaVersion: 2 }, /unknown schemaVersion/);
  refuse({ ...payload(), datasetVersion: 'gene-overlaps-v2' }, /is not gene-overlaps-v1/);
  refuse({ ...payload(), origin: 'inferred' }, /computed origin and producer/);
  refuse({ ...payload(), definition: { features: 'x' } }, /state the definition/);
  refuse({ ...payload(), release: { accession: 'GCF_999.9', gff: 'x', sha256: 'a'.repeat(64) } },
    /declares assembly GCF_999.9/);
  refuse({ ...payload(), release: { accession: 'GCF_000000000.1', gff: 'x', sha256: 'oops' } },
    /name the annotation file/);
  refuse(payload({ replicons: [{ accession: 'chr1', lengthBp: 999 }, { accession: 'plasmid1', lengthBp: 500 }] }),
    /a length this organism/);
  refuse(payload({ features: [feature('A', { segments: [[900, 1200]] })] }),
    /past the end of its replicon/);
  refuse(payload({ features: [feature('A', { segments: [[100, 200], [201, 300]] })] }),
    /not in canonical order/);
  refuse(payload({ features: [feature('A'), feature('A')] }), /lists A more than once/);
  refuse(payload({ features: [feature('A', { segmentSource: 'guess' })] }),
    /where A's segments came from/);
  // The join every other layer makes too: a layer built from another gene file
  // cannot load against this one.
  refuse(payload({ features: [feature('A', { segments: [[101, 200]] })] }),
    /disagrees with genes.json about A/);
  refuse(payload({ features: [feature('A', { strand: '-' })] }),
    /disagrees with genes.json about A/);
});

test('a coverage block the listed relations do not support is refused', () => {
  const genes = [geneRow('A')];
  const base = payload({
    features: [feature('A'), feature('B', { strand: '-', segments: [[190, 400]] })],
    pairs: [[0, 1, [[190, 200]]]],
  });
  for (const change of [
    { pairwiseSharedBases: 12 }, { overlappingGenes: 3 }, { overlappingPairs: 2 },
    { maxPartners: 2 }, { annotatedGenes: 1 }, { childlessGenes: -1 },
  ]) {
    assert.throws(
      () => validateGeneOverlaps({ ...base, coverage: { ...base.coverage, ...change } },
        genes, ORGANISM),
      /reports coverage the features and pairs it lists do not support/,
      JSON.stringify(change),
    );
  }
});

test('the applier joins every gene, so no partner is not confused with not loaded', () => {
  const genes = [geneRow('A'), geneRow('C', { start: 600, end: 700 })];
  const dataset = { genes, organism: ORGANISM };
  DATA_APPLIERS.geneOverlaps(dataset, payload({
    features: [feature('A'), feature('B', { strand: '-', segments: [[190, 400]] })],
    pairs: [[0, 1, [[190, 200]]]],
    covers: ['C'],
  }));
  assert.equal(dataset.geneOverlaps.state, 'ready');
  assert.equal(genes[0].overlapPartners.length, 1);
  assert.equal(genes[0].overlapClass, 'overlap-opposite-strand');
  // A gene with no partner carries an empty list, not nothing: an array is how
  // every consumer tells a measured absence from an unread file.
  assert.deepEqual(genes[1].overlapPartners, []);
  assert.equal(genes[1].overlapClass, 'no-overlap');

  const unread = { genes: [geneRow('A')], organism: ORGANISM };
  DATA_APPLIERS.geneOverlaps(unread, null);
  assert.equal(unread.geneOverlaps, null);
  assert.equal(unread.genes[0].overlapPartners, undefined);
  assert.equal(unread.genes[0].overlapClass, undefined);

  // Clearing a dataset that had the layer takes the joined fields with it, so
  // a retry or an organism change cannot leave an export reading the old one.
  DATA_APPLIERS.geneOverlaps(dataset, null);
  assert.equal(dataset.geneOverlaps, null);
  assert.ok(genes.every((gene) => !('overlapPartners' in gene) && !('overlapClass' in gene)));
});

test('a partner reads as a sentence that names what it is and what it shares', () => {
  const index = validateGeneOverlaps(payload({
    features: [
      feature('A', { segments: [[100, 500]] }),
      feature('T', { biotype: 'tRNA', strand: '-', segments: [[200, 300]] }),
    ],
    pairs: [[0, 1, [[200, 300]]]],
    byBiotype: { protein_coding: 2, tRNA: 1 },
  }), [geneRow('A', { end: 500 })], ORGANISM);
  const sentence = describePartner(index.partnersById.get('A')[0]);
  assert.match(sentence, /^T, a tRNA gene on the reverse strand \(opposite strand\)/);
  assert.match(sentence, /which it contains/);
  assert.match(sentence, /sharing 101 bases at 200–300/);
  assert.match(sentence, /not among the plotted CDSs/);
  // The rule and the coverage come out of the payload's own definition block.
  assert.match(describeOverlapRule(index), /OG marks overlapping genes/);
  assert.match(describeOverlapRule(index), /share at least one base on the same replicon/);
  assert.ok(!/segmentSource/.test(describeOverlapRule(index)), 'no field names in the key');
  assert.match(describeOverlapDefinition(index), /at least one shared genomic base/);
  assert.match(describeOverlapCoverage(index), /3 gene records/);
  assert.match(describeOverlapCoverage(index), /pairwise shared bases, counted once per pair/);
  assert.match(describeOverlapCoverage(index), /1 of the 1 plotted CDSs carry an OG tag/);
  assert.match(describeOverlapRule(null), /not been read/);
  assert.match(describeOverlapCoverage(null), /not been read/);
});

test('the drawn frame clips a shared stretch to one transcription piece', () => {
  // A spliced plus-strand gene: 100–149 then 200–249, so the drawn offsets skip
  // the 50 genomic bases between them.
  const gene = {
    id: 'A', seqid: 'chr1', strand: '+', start: 100, end: 249,
    cdsSegments: [[100, 149], [200, 249]],
  };
  assert.deepEqual(offsetPieces(gene), [
    { low: 100, high: 149, offset: 0, length: 50 },
    { low: 200, high: 249, offset: 100, length: 50 },
  ]);
  const [track] = overlapTracks(gene, [{
    id: 'B', name: null, biotype: 'protein_coding', strand: '-', seqid: 'chr1',
    segments: [{ from: 140, to: 400 }], segmentSource: 'child', pseudo: false,
    selectable: true, geneIndex: 1, relation: 'opposite', containment: 'partial',
    sharedIntervals: [{ from: 140, to: 149 }, { from: 200, to: 249 }], sharedBases: 60,
  }]);
  // Two drawn runs, not one bar across the splice gap.
  assert.deepEqual(track.runs, [{ from: 40, to: 49 }, { from: 100, to: 149 }]);
  assert.equal(track.shownNt, 60);
  assert.equal(track.direction, 'against');
  assert.equal(track.extendsBeyond, true);
});

test('the drawn frame counts a minus-strand gene downwards from its own start', () => {
  const gene = { id: 'A', seqid: 'chr1', strand: '-', start: 100, end: 200, cdsSegments: null };
  const [track] = overlapTracks(gene, [{
    id: 'B', name: null, biotype: 'protein_coding', strand: '-', seqid: 'chr1',
    segments: [{ from: 100, to: 110 }], segmentSource: 'child', pseudo: false,
    selectable: true, geneIndex: 1, relation: 'same', containment: 'contains',
    sharedIntervals: [{ from: 100, to: 110 }], sharedBases: 11,
  }]);
  // Base 200 is offset 0 on the minus strand, so bases 100–110 are the last
  // eleven drawn offsets, 90 to 100.
  assert.deepEqual(track.runs, [{ from: 90, to: 100 }]);
  assert.equal(track.direction, 'with');
  assert.equal(track.extendsBeyond, false);
});

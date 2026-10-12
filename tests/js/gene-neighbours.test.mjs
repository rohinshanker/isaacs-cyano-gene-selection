import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nativeNeighbours, createNeighbourIndex } from '../../site/js/core/gene-neighbours.js';
import { sharedSegments } from '../../site/js/core/gene-overlaps.js';
import { createNeighbourDisclosure, updateNeighbourDisclosure } from '../../site/js/ui/gene-neighbours.js';
import { renderGeneViewer } from '../../site/js/ui/gene-viewer.js';
import { withFakeDocument } from './fake-dom.mjs';

const feature = (id, segments, strand = '+', seqid = 'chr') => ({
  id, name: null, biotype: 'protein_coding', strand, seqid,
  segments: segments.map(([from, to]) => ({ from, to })), selectable: true, geneIndex: 0,
});
const result = (focal, others, length = 100) => nativeNeighbours(focal, [focal, ...others], length,
  others.filter((candidate) => candidate.seqid === focal.seqid
    && sharedSegments(focal.segments, candidate.segments).length));
const ids = (side) => side.neighbours.map((entry) => [entry.id, entry.gapNt]);

test('plus/minus, abutting, ties, replicon isolation and unknown strands', () => {
  const focal = feature('A', [[20, 30]]);
  const left = feature('L', [[10, 19]], null);
  const right = feature('R', [[35, 40]], '-');
  const tie = feature('T', [[35, 45]]);
  const other = feature('X', [[31, 34]], '+', 'plasmid');
  assert.deepEqual(ids(result(focal, [left, right, tie, other]).upstream), [['L', 0]]);
  assert.deepEqual(ids(result(focal, [left, right, tie, other]).downstream), [['R', 4], ['T', 4]]);
  assert.deepEqual(ids(result({ ...focal, strand: '-' }, [left, right]).upstream), [['R', 4]]);
  assert.deepEqual(ids(result({ ...focal, strand: '-' }, [left, right]).downstream), [['L', 0]]);
  assert.equal(result({ ...focal, strand: null }, [left]).upstream.status, 'unknown-strand');
  assert.equal(result(focal, []).upstream.status, 'no-flank');
  assert.equal(nativeNeighbours(null, [], 100), null);
});

test('outer bounds exclude joined gaps; only outward crossing overlaps block', () => {
  const focal = feature('A', [[20, 30], [40, 50]]);
  const inside = feature('inside-gap', [[32, 38]]);
  const contained = feature('contained', [[22, 28]]);
  const left = feature('left', [[10, 19]]);
  const right = feature('right', [[51, 60]]);
  const crossing = feature('crossing', [[48, 55]]);
  const answer = result(focal, [inside, contained, left, right, crossing]);
  assert.deepEqual(ids(answer.upstream), [['left', 0]]);
  assert.equal(answer.downstream.status, 'overlap-blocked');
  assert.deepEqual(answer.downstream.blockedBy, ['crossing']);
  assert.deepEqual(ids(result(focal, [inside, contained, left, right]).downstream), [['right', 0]]);
});

test('both origin orientations and the sole other circular gene on both sides', () => {
  for (const strand of ['+', '-']) {
    const focal = feature('wrap', [[1, 10], [90, 100]], strand);
    const other = feature('other', [[20, 80]]);
    const answer = result(focal, [other]);
    assert.deepEqual(ids(answer.upstream), [['other', 9]]);
    assert.deepEqual(ids(answer.downstream), [['other', 9]]);
    assert.equal(result(focal, [feature('block', [[5, 25]])])[strand === '+' ? 'downstream' : 'upstream'].status,
      'overlap-blocked');
  }
});

// Independent oracle: enumerate every base, mark the outer transcribed arc,
// then walk one base at a time outside it. No interval-distance formula is shared.
function oracle(focal, catalogue, length) {
  const bases = (record) => new Set(record.segments.flatMap(({ from, to }) =>
    Array.from({ length: to - from + 1 }, (_, index) => from + index)));
  const own = bases(focal);
  const sorted = [...own].sort((a, b) => a - b);
  const wraps = focal.segments.length > 1 && own.has(1) && own.has(length);
  const low = wraps ? focal.segments[1].from : sorted[0];
  const high = wraps ? focal.segments[0].to : sorted.at(-1);
  const arc = new Set();
  let bp = low;
  while (true) { arc.add(bp); if (bp === high) break; bp = bp === length ? 1 : bp + 1; }
  const partnerIds = new Set(catalogue.filter((record) => record.id !== focal.id && record.seqid === focal.seqid
    && [...bases(record)].some((base) => own.has(base))).map((record) => record.id));
  const walk = (boundary, step) => {
    let current = boundary;
    let gap = 0;
    const nextBase = (base) => { const next = base + step; return next < 1 ? length : next > length ? 1 : next; };
    const next = nextBase(boundary);
    if (arc.has(next)) return { status: 'no-flank', ids: [] };
    const blocking = catalogue.filter((record) => partnerIds.has(record.id)
      && bases(record).has(next)).map((record) => record.id).sort();
    if (blocking.length) return { status: 'overlap-blocked', blockedBy: blocking, ids: [] };
    while (true) {
      current = nextBase(current);
      if (arc.has(current)) return { status: 'no-flank', ids: [] };
      const nearest = catalogue.filter((record) => record.seqid === focal.seqid && record.id !== focal.id
        && bases(record).has(current)).map((record) => [record.id, gap])
        .sort((a, b) => a[0].localeCompare(b[0]));
      const outwardPartners = nearest.filter(([id]) => partnerIds.has(id)).map(([id]) => id);
      if (outwardPartners.length) return { status: 'overlap-blocked', ids: [], blockedBy: outwardPartners };
      if (nearest.length) return { status: 'ready', ids: nearest };
      gap += 1;
    }
  };
  return focal.strand === '+' ? { upstream: walk(low, -1), downstream: walk(high, 1) }
    : { upstream: walk(high, 1), downstream: walk(low, -1) };
}

test('2,000 seeded small-genome catalogues agree numerically with a base-walking oracle', () => {
  let seed = 2973;
  const random = (max) => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return (seed >>> 8) % max; };
  const length = 30;
  for (let trial = 0; trial < 2000; trial += 1) {
    const catalogue = Array.from({ length: 1 + random(6) }, (_, index) => {
      const occupied = Array.from({ length }, () => random(8) < 2);
      if (!occupied.some(Boolean)) occupied[random(length)] = true;
      const pieces = [];
      for (let bp = 1; bp <= length; bp += 1) {
        if (!occupied[bp - 1]) continue;
        const start = bp;
        while (bp < length && occupied[bp]) bp += 1;
        pieces.push([start, bp]);
      }
      // A >2-piece origin join lacks native outer-order evidence in this
      // segment-only schema. Keep multi-piece linear joins, and two-piece wraps.
      if (pieces.length > 2 && pieces[0][0] === 1 && pieces.at(-1)[1] === length) pieces.shift();
      return feature(`gene${index}`, pieces, random(2) ? '+' : '-', index && random(5) === 0 ? 'other' : 'chr');
    });
    const focal = catalogue[0];
    const actual = result(focal, catalogue.slice(1), length);
    const expected = oracle(focal, catalogue, length);
    for (const key of ['upstream', 'downstream']) {
      assert.equal(actual[key].status, expected[key].status, `trial ${trial} ${key}`);
      assert.deepEqual(ids(actual[key]), expected[key].ids, `trial ${trial} ${key}`);
      if (expected[key].blockedBy) assert.deepEqual(actual[key].blockedBy, expected[key].blockedBy);
    }
  }
});

test('index caches per catalogue and locus, preserves native noncoding metadata', () => {
  const focal = feature('A', [[20, 30]]);
  const rna = { ...feature('rna', [[31, 40]], null), biotype: 'tRNA', selectable: false };
  const index = createNeighbourIndex([focal, rna], new Map([['chr', 100]]), new Map());
  assert.strictEqual(index.get('A'), index.get('A'));
  assert.equal(index.get('A').downstream.neighbours[0].biotype, 'tRNA');
  assert.equal(index.get('A').downstream.neighbours[0].strand, null);
  assert.equal(index.get('absent'), null);
  assert.notStrictEqual(index.get('A'), createNeighbourIndex([focal, rna], new Map([['chr', 100]]), new Map()).get('A'));
});

test('shared disclosure keeps state/focus, late-loads, opens selectable neighbours and labels context', async () => {
  await withFakeDocument((document) => {
    const details = createNeighbourDisclosure();
    document.body.append(details);
    const focal = { ...feature('A', [[20, 30]]), start: 20, end: 30 };
    updateNeighbourDisclosure(details, focal, 'loading');
    assert.match(details.textContent, /loading/);
    const summary = details.querySelector('summary');
    details.open = true;
    summary.focus();
    const rna = { ...feature('rna', [[10, 19]], null), biotype: 'tRNA', selectable: false };
    focal.flankingNeighbours = result(focal, [rna, feature('B', [[31, 40]])]);
    let opened = null;
    updateNeighbourDisclosure(details, focal, null, (id) => { opened = id; });
    assert.equal(details.open, true);
    assert.strictEqual(document.activeElement, summary);
    assert.match(details.textContent, /gap 0 bp/);
    assert.match(details.textContent, /strand unknown/);
    assert.match(details.textContent, /not a selectable recoding candidate/);
    const button = details.querySelector('button');
    button.dispatch('click');
    assert.equal(opened, 'B');
    button.focus();
    updateNeighbourDisclosure(details, focal, null, () => {});
    assert.strictEqual(document.activeElement, button);
    delete focal.flankingNeighbours;
    updateNeighbourDisclosure(details, focal, 'failed');
    assert.match(details.textContent, /failed/);
    assert.strictEqual(document.activeElement, summary);
    updateNeighbourDisclosure(details, focal, null);
    assert.match(details.textContent, /unavailable/);
  });
});

test('compact mount preserves open disclosure and focused control on redraw', async () => {
  await withFakeDocument((document) => {
    const host = document.createElement('div');
    document.body.append(host);
    const focal = { ...feature('A', [[20, 30]]), start: 20, end: 30, cdsSegments: null };
    focal.flankingNeighbours = result(focal, [feature('B', [[31, 40]])]);
    renderGeneViewer(host, focal, { onOpenPartner() {} });
    const details = host.querySelector('details.gene-neighbours');
    details.open = true;
    const button = details.querySelector('button');
    button.focus();
    renderGeneViewer(host, focal, { onOpenPartner() {} });
    assert.strictEqual(host.querySelector('details.gene-neighbours'), details);
    assert.equal(details.open, true);
    assert.strictEqual(document.activeElement, button);
    renderGeneViewer(host, null);
    assert.strictEqual(document.activeElement, host);
  });
});


test('more than two origin pieces require native order evidence rather than a guessed cut', () => {
  for (const strand of ['+', '-']) {
    const focal = feature('ambiguous', [[1, 10], [20, 30], [90, 100]], strand);
    const answer = result(focal, [feature('outside', [[40, 50]])]);
    assert.equal(answer.upstream.status, 'unsupported-geometry');
    assert.equal(answer.downstream.status, 'unsupported-geometry');
  }
});

test('all six published catalogues reconcile, use supported origin geometry and isolate assemblies', async () => {
  const { readFile } = await import('node:fs/promises');
  const { ORGANISMS } = await import('../../site/js/core/organisms.js');
  const { validateGeneOverlaps } = await import('../../site/js/core/gene-overlaps.js');
  for (const organism of ORGANISMS) {
    const base = new URL(`../../site/${organism.dataDirectory}/`, import.meta.url);
    const [genes, payload] = await Promise.all(['genes.json', 'gene_overlaps.json'].map(async (name) =>
      JSON.parse(await readFile(new URL(name, base), 'utf8'))));
    const index = validateGeneOverlaps(payload, genes, organism);
    assert.equal(index.neighbours.resolvedGeneCount, 0);
    const catalogue = [...payload.features, ...payload.contextFeatures];
    for (const record of catalogue) {
      const length = payload.replicons.find(entry => entry.accession === record.seqid).lengthBp;
      assert.ok(!(record.segments.length > 2 && record.segments[0][0] === 1
        && record.segments.at(-1)[1] === length), `${organism.id} ${record.id} needs native order`);
    }
    const focal = genes[0];
    const context = index.neighbours.get(focal.id);
    for (const flank of Object.values(context)) {
      for (const neighbour of flank.neighbours) {
        assert.equal(neighbour.seqid, focal.seqid);
        assert.ok(payload.coveredGenes.includes(neighbour.id));
      }
    }
    assert.throws(() => validateGeneOverlaps(payload, genes,
      ORGANISMS.find(candidate => candidate.id !== organism.id)), /assembly/);
  }
});


test('joined OG outward pieces block farther flanks, including ties, on both strands', () => {
  for (const strand of ['+', '-']) {
    const focal = feature('focal', [[20, 30]], strand);
    const outward = feature('OG', [[25, 27], [40, 45]]);
    const farther = feature('far', [[50, 55]]);
    const key = strand === '+' ? 'downstream' : 'upstream';
    assert.equal(result(focal, [outward, farther])[key].status, 'overlap-blocked');
    assert.deepEqual(result(focal, [outward, farther])[key].blockedBy, ['OG']);
    const closer = feature('closer', [[35, 36]]);
    assert.deepEqual(ids(result(focal, [outward, farther, closer])[key]), [['closer', 4]]);
    const tie = feature('tie', [[40, 42]]);
    assert.deepEqual(result(focal, [outward, farther, tie])[key].blockedBy, ['OG']);
    const secondOG = feature('OG2', [[22, 24], [40, 42]]);
    assert.deepEqual(result(focal, [outward, secondOG, tie])[key].blockedBy, ['OG', 'OG2']);
  }
});


test('all OG partners on the first outward base block, including joined ties', () => {
  for (const strand of ['+', '-']) {
    const focal = feature('focal', [[20, 30]], strand);
    const crossing = feature('P', [[25, 35]]);
    const joined = feature('Q', [[22, 24], [31, 34]]);
    const separated = feature('R', [[31, 36]]);
    const key = strand === '+' ? 'downstream' : 'upstream';
    const answer = result(focal, [crossing, joined, separated])[key];
    assert.equal(answer.status, 'overlap-blocked');
    assert.deepEqual(answer.blockedBy, ['P', 'Q']);
    assert.deepEqual(answer.neighbours, []);
  }
});

test('pseudogene metadata appears once for either a biotype or a flag', async () => {
  await withFakeDocument(() => {
    for (const biotype of ['pseudogene', 'protein_coding']) {
      const details = createNeighbourDisclosure();
      const focal = feature('focal', [[20, 30]]);
      const pseudo = { ...feature('P', [[31, 40]]), biotype, pseudo: true };
      focal.flankingNeighbours = result(focal, [pseudo]);
      updateNeighbourDisclosure(details, focal, null);
      for (const row of details.querySelectorAll('.gene-view-partner-text')) {
        assert.equal(row.textContent.match(/pseudogene/g).length, 1);
      }
    }
  });
});

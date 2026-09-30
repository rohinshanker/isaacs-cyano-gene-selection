import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  GENOME_OF_RECORD, MIN_WINDOW_BP, axisUnit, cdsMark, cdsPieces, clampWindow,
  describeChromosomeView, describePaintOrder,
  formatBasePairs, fullWindow, locateIndex, navigationLanes, neighborMark, normalizeAccession,
  operonBrackets, panWindow, positionTicks, repliconScale, repliconTracks, sameReplicon,
  strandLane, tickStepBp, tssPositions, visibleMarks, wrapsOrigin, zoomWindow,
} from '../../site/js/core/chromosome-model.js';

const CHROMOSOME = 'NZ_CP006471.1';
const PLASMID_B = 'NZ_CP006472.1';
const PLASMID_C = 'NZ_CP006473.1';
const CHROMOSOME_BP = 2690418;
const PLASMID_B_BP = 46366;
const PLASMID_C_BP = 7842;

const META = { genome: { accession: 'GCF_000817325.1', taxid: 1350461, totalLength: 2744626 } };

function gene(overrides) {
  return {
    id: 'M744_RS00005',
    name: null,
    product: 'metallophosphoesterase',
    seqid: CHROMOSOME,
    start: 32,
    end: 799,
    strand: '+',
    cdsSegments: null,
    operonId: null,
    operonPosition: null,
    operonSize: null,
    ...overrides,
  };
}

/** The two real origin-crossing CDSs, exactly as `genes.json` records them. */
const WRAP_PLUS = gene({
  id: 'M744_RS13620',
  seqid: PLASMID_C,
  start: 1,
  end: PLASMID_C_BP,
  strand: '+',
  cdsSegments: [[7830, 7842], [1, 281]],
});
const WRAP_MINUS = gene({
  id: 'M744_RS13290',
  seqid: PLASMID_B,
  start: 1,
  end: PLASMID_B_BP,
  strand: '-',
  cdsSegments: [[45877, 46366], [1, 2510]],
});
/** The third discontinuous CDS, spliced mid-chromosome and not a wrap. */
const SPLICED = gene({
  id: 'M744_RS00920',
  start: 169621,
  end: 170743,
  cdsSegments: [[169621, 169692], [169694, 170743]],
  translationalException: 'ribosomal_slippage',
});

test('the declared replicon lengths are the genome of record and sum to its total', () => {
  const total = GENOME_OF_RECORD.replicons.reduce((sum, r) => sum + r.lengthBp, 0);
  assert.equal(GENOME_OF_RECORD.accession, 'GCF_000817325.1');
  assert.equal(total, META.genome.totalLength);
  assert.deepEqual(
    GENOME_OF_RECORD.replicons.map((r) => [r.accession, r.lengthBp, r.primary]),
    [[CHROMOSOME, CHROMOSOME_BP, true], [PLASMID_B, PLASMID_B_BP, false],
      [PLASMID_C, PLASMID_C_BP, false]],
  );
  assert.equal(GENOME_OF_RECORD.replicons.filter((r) => r.primary).length, 1);
});

test('RefSeq and INSDC spellings of one replicon are recognised as the same sequence', () => {
  // The Tan 2018 extract writes `CP006471`; genes.json writes `NZ_CP006471.1`.
  // Comparing the raw strings would silently drop every start site.
  assert.equal(normalizeAccession('NZ_CP006471.1'), 'CP006471');
  assert.ok(sameReplicon('CP006471', CHROMOSOME));
  assert.ok(sameReplicon('NZ_CP006471.2', CHROMOSOME));
  assert.ok(!sameReplicon('CP006472', CHROMOSOME));
  assert.ok(!sameReplicon('', CHROMOSOME));
  assert.ok(!sameReplicon(null, CHROMOSOME));
});

test('an ordinary CDS occupies exactly its annotated span', () => {
  assert.deepEqual(cdsPieces(gene({})), [{ from: 32, to: 799 }]);
  assert.ok(!wrapsOrigin(cdsPieces(gene({})), CHROMOSOME_BP));
});

test('a spliced CDS keeps its gap and is not mistaken for an origin wrap', () => {
  const pieces = cdsPieces(SPLICED);
  assert.deepEqual(pieces, [{ from: 169621, to: 169692 }, { from: 169694, to: 170743 }]);
  assert.ok(!wrapsOrigin(pieces, CHROMOSOME_BP));
  const mark = cdsMark(SPLICED, 3, CHROMOSOME_BP);
  assert.equal(mark.wraps, false);
  assert.equal(mark.coveredBp, 72 + 1050);
});

test('the two circular-origin CDSs are drawn as their segments, never past the replicon', () => {
  const plus = cdsMark(WRAP_PLUS, 10, PLASMID_C_BP);
  assert.equal(plus.wraps, true);
  assert.deepEqual(plus.pieces, [{ from: 1, to: 281 }, { from: 7830, to: 7842 }]);
  // The record's own start/end span the whole 7,842 bp plasmid; the drawn
  // pieces cover only the 294 nt the CDS actually is.
  assert.equal(plus.coveredBp, 294);
  assert.ok(plus.pieces.every((piece) => piece.from >= 1 && piece.to <= PLASMID_C_BP));

  const minus = cdsMark(WRAP_MINUS, 11, PLASMID_B_BP);
  assert.equal(minus.wraps, true);
  assert.deepEqual(minus.pieces, [{ from: 1, to: 2510 }, { from: 45877, to: 46366 }]);
  assert.equal(minus.coveredBp, 3000);
  assert.ok(minus.pieces.every((piece) => piece.from >= 1 && piece.to <= PLASMID_B_BP));
});

test('a wrapping CDS is navigated from its first transcribed base', () => {
  // Plus strand: transcription enters at the piece before the origin.
  assert.equal(cdsMark(WRAP_PLUS, 0, PLASMID_C_BP).anchorBp, 7830);
  // Minus strand: transcription enters at the high end of the later piece.
  // complement(join(45877..46366,1..2510)) is transcribed from 2,510 down to 1
  // and then from the last base down, so its first transcribed base is 2,510.
  assert.equal(cdsMark(WRAP_MINUS, 0, PLASMID_B_BP).anchorBp, 2510);
  assert.equal(cdsMark(gene({}), 0, CHROMOSOME_BP).anchorBp, 32);
});

test('a CDS starting at base 1 without reaching the end is not a wrap', () => {
  const pieces = [{ from: 1, to: 500 }, { from: 900, to: 1200 }];
  assert.ok(!wrapsOrigin(pieces, PLASMID_C_BP));
  assert.ok(!wrapsOrigin([{ from: 1, to: PLASMID_C_BP }], PLASMID_C_BP),
    'a single piece covering the replicon is not two pieces joined across the origin');
});

test('strand decides the side of the axis, and a record with none has no lane', () => {
  assert.equal(strandLane('+'), 'above');
  assert.equal(strandLane('-'), 'below');
  assert.equal(cdsMark(gene({ strand: '-' }), 0, CHROMOSOME_BP).lane, 'below');
  assert.equal(cdsMark(gene({ strand: '+' }), 0, CHROMOSOME_BP).lane, 'above');
  // No default: drawing a strandless record above the axis would assert a
  // transcription direction the annotation never reported.
  for (const strand of [null, undefined, '', '.', '?']) {
    assert.equal(strandLane(strand), null, `strandLane(${JSON.stringify(strand)})`);
    assert.equal(cdsMark(gene({ strand }), 0, CHROMOSOME_BP), null);
  }
});

test('a CDS with no strand is a named verification problem, not a silent plus', () => {
  const { tracks, verified, problems, plottedCount } = repliconTracks(
    [gene({ id: 'A' }), gene({ id: 'NOSTRAND', start: 900, end: 1500, strand: null })],
    META,
  );
  assert.ok(!verified);
  assert.equal(problems.length, 1);
  assert.match(problems[0], /NOSTRAND/);
  assert.match(problems[0], /no strand/);
  assert.match(problems[0], new RegExp(CHROMOSOME));
  // The stranded records still resolve, so the problem list says which row is
  // at fault rather than only that the view cannot be drawn.
  assert.equal(plottedCount, 1);
  assert.deepEqual(tracks[0].marks.map((mark) => mark.id), ['A']);
});

test('every CDS lands on its own replicon track, with the plotted counts split', () => {
  const genes = [
    gene({ id: 'A' }),
    gene({ id: 'B', strand: '-', start: 900, end: 1500 }),
    WRAP_MINUS,
    WRAP_PLUS,
  ];
  const { tracks, verified, problems, plottedCount } = repliconTracks(genes, META);
  assert.deepEqual(problems, []);
  assert.ok(verified);
  assert.equal(plottedCount, 4);
  assert.deepEqual(tracks.map((track) => [track.accession, track.cdsCount, track.wrapCount]),
    [[CHROMOSOME, 2, 0], [PLASMID_B, 1, 1], [PLASMID_C, 1, 1]]);
  assert.equal(tracks[0].primary, true);
  assert.equal(tracks[1].primary, false);
  assert.equal(tracks[2].primary, false);
});

test('an unverified genome of record refuses to draw rather than misplace marks', () => {
  const wrongAssembly = repliconTracks([gene({})], { genome: { accession: 'GCF_000817745.1', totalLength: 2744626 } });
  assert.equal(wrongAssembly.verified, false);
  assert.match(wrongAssembly.problems[0], /GCF_000817745\.1/);

  const wrongTotal = repliconTracks([gene({})], { genome: { accession: 'GCF_000817325.1', totalLength: 2690418 } });
  assert.equal(wrongTotal.verified, false);
  assert.match(wrongTotal.problems[0], /2,744,626 bp/);

  const missing = repliconTracks([gene({})], {});
  assert.equal(missing.verified, false);
  assert.equal(missing.problems.length, 2);
});

test('a coordinate past its replicon is reported, not drawn', () => {
  const beyond = gene({ id: 'OVER', seqid: PLASMID_C, start: 7800, end: 7900 });
  const { tracks, verified, problems } = repliconTracks([beyond], META);
  assert.equal(verified, false);
  assert.match(problems[0], /OVER occupies 7800–7900 on NZ_CP006473\.1, which is 7,842 bp long/);
  assert.equal(tracks[2].cdsCount, 0);
});

test('a CDS on a replicon the genome of record does not have is named, never hidden', () => {
  const foreign = gene({ id: 'ELSEWHERE', seqid: 'NZ_CP999999.1' });
  const { verified, problems, plottedCount } = repliconTracks([foreign], META);
  assert.equal(verified, false);
  assert.equal(plottedCount, 0);
  assert.ok(problems.some((problem) => problem.includes('NZ_CP999999.1')));
});

test('each replicon scales independently, so a plasmid never borrows the chromosome axis', () => {
  const width = 900;
  const chromosome = repliconScale(fullWindow(CHROMOSOME_BP), 16, width);
  const plasmid = repliconScale(fullWindow(PLASMID_C_BP), 16, width);
  assert.equal(chromosome.bpToX(1), 16);
  assert.equal(plasmid.bpToX(1), 16);
  // The same base-pair coordinate is a different pixel on each track: 7,842 bp
  // is the whole of one replicon and 0.3% of the other.
  assert.ok(Math.abs(chromosome.bpToX(PLASMID_C_BP) - 16) < 3);
  assert.equal(Math.round(plasmid.bpToX(PLASMID_C_BP + 1)), 916);
  assert.ok(plasmid.perBase > chromosome.perBase * 300);
});

test('a scale places base edges, so a one-base feature still has width', () => {
  const scale = repliconScale({ from: 1, to: 10 }, 0, 100);
  assert.equal(scale.bpToX(1), 0);
  assert.equal(scale.bpToX(2), 10);
  assert.equal(scale.bpToX(11), 100);
  assert.equal(scale.xToBp(50), 6);
  assert.equal(scale.span, 10);
});

test('a scale over a zoomed window maps that window across the full width', () => {
  const scale = repliconScale({ from: 1000, to: 1999 }, 20, 500);
  assert.equal(scale.bpToX(1000), 20);
  assert.equal(scale.bpToX(1500), 270);
  assert.equal(Math.round(scale.xToBp(270)), 1500);
});

test('a window cannot leave its replicon or collapse below the zoom floor', () => {
  // A window narrower than the zoom floor widens to it rather than clipping.
  assert.deepEqual(clampWindow({ from: -50, to: 100 }, CHROMOSOME_BP),
    { from: 1, to: MIN_WINDOW_BP });
  assert.deepEqual(clampWindow({ from: 1, to: 10 }, CHROMOSOME_BP),
    { from: 1, to: MIN_WINDOW_BP });
  assert.deepEqual(clampWindow({ from: 1, to: CHROMOSOME_BP + 5000 }, CHROMOSOME_BP),
    fullWindow(CHROMOSOME_BP));
  // Pushed off the right end, the window slides back rather than shrinking.
  assert.deepEqual(clampWindow({ from: PLASMID_C_BP - 10, to: PLASMID_C_BP + 990 }, PLASMID_C_BP),
    { from: PLASMID_C_BP - 1000, to: PLASMID_C_BP });
  assert.deepEqual(clampWindow({ from: 1, to: 10 }, 20, 4), { from: 1, to: 10 });
});

test('zooming keeps the anchored base under the same point on screen', () => {
  const start = fullWindow(CHROMOSOME_BP);
  const anchor = 1345209;
  const fractionBefore = (anchor - start.from) / (start.to - start.from);
  const zoomed = zoomWindow(start, 4, anchor, CHROMOSOME_BP);
  assert.equal(zoomed.to - zoomed.from + 1, Math.round(CHROMOSOME_BP / 4));
  const fractionAfter = (anchor - zoomed.from) / (zoomed.to - zoomed.from);
  assert.ok(Math.abs(fractionBefore - fractionAfter) < 1e-6);
  // Zooming back out returns to the whole replicon and stops there.
  assert.deepEqual(zoomWindow(zoomed, 1 / 100, anchor, CHROMOSOME_BP), start);
  assert.deepEqual(zoomWindow(start, 0, anchor, CHROMOSOME_BP), start);
});

test('panning slides a fixed span and stops at both ends', () => {
  const window = { from: 1000, to: 1999 };
  assert.deepEqual(panWindow(window, 500, CHROMOSOME_BP), { from: 1500, to: 2499 });
  assert.deepEqual(panWindow(window, -100000, CHROMOSOME_BP), { from: 1, to: 1000 });
  const atEnd = panWindow(window, CHROMOSOME_BP, CHROMOSOME_BP);
  assert.equal(atEnd.to, CHROMOSOME_BP);
  assert.equal(atEnd.to - atEnd.from + 1, 1000);
});

test('only the marks intersecting the window are drawn', () => {
  const marks = [
    cdsMark(gene({ id: 'A', start: 10, end: 90 }), 0, CHROMOSOME_BP),
    cdsMark(gene({ id: 'B', start: 500, end: 600 }), 1, CHROMOSOME_BP),
    cdsMark(gene({ id: 'C', start: 5000, end: 5100 }), 2, CHROMOSOME_BP),
  ];
  assert.deepEqual(visibleMarks(marks, { from: 400, to: 700 }).map((m) => m.id), ['B']);
  // A mark straddling the edge is visible, not clipped out.
  assert.deepEqual(visibleMarks(marks, { from: 550, to: 700 }).map((m) => m.id), ['B']);
  assert.deepEqual(visibleMarks(marks, { from: 1, to: 6000 }).map((m) => m.id), ['A', 'B', 'C']);
});

test('a wrapping CDS is visible from either end of its replicon', () => {
  const marks = [cdsMark(WRAP_MINUS, 0, PLASMID_B_BP)];
  assert.equal(visibleMarks(marks, { from: 1, to: 100 }).length, 1);
  assert.equal(visibleMarks(marks, { from: 46000, to: PLASMID_B_BP }).length, 1);
  assert.equal(visibleMarks(marks, { from: 10000, to: 20000 }).length, 0);
});

test('operon brackets group by operonId within one replicon and span their members', () => {
  const genes = [
    gene({ id: 'A', start: 950, end: 2170, operonId: 'op_0001', operonPosition: 1, operonSize: 2 }),
    gene({ id: 'B', start: 2259, end: 2984, operonId: 'op_0001', operonPosition: 2, operonSize: 2 }),
    gene({ id: 'C', start: 4314, end: 5318, operonId: 'op_0002', operonPosition: 1, operonSize: 1 }),
    gene({ id: 'D', start: 9000, end: 9500, operonId: null }),
    gene({ id: 'E', seqid: PLASMID_B, start: 100, end: 400, operonId: 'op_9001', operonSize: 1 }),
  ];
  const { tracks } = repliconTracks(genes, META);
  const brackets = operonBrackets(tracks[0], genes);
  assert.deepEqual(brackets.map((bracket) => [bracket.operonId, bracket.from, bracket.to, bracket.size]),
    [['op_0001', 950, 2984, 2], ['op_0002', 4314, 5318, 1]]);
  assert.equal(brackets[0].declaredSize, 2);
  assert.equal(brackets[0].lane, 'above');
  // A gene with no operon call contributes no bracket, and a plasmid operon
  // belongs to the plasmid track rather than the chromosome's.
  assert.ok(!brackets.some((bracket) => bracket.members.includes(3)));
  assert.deepEqual(operonBrackets(tracks[1], genes).map((bracket) => bracket.operonId), ['op_9001']);
  assert.deepEqual(operonBrackets(tracks[2], genes), []);
});

test('an operon bracket keeps its strand lane and reports a member that wraps', () => {
  const genes = [
    gene({ id: 'A', strand: '-', start: 7573, end: 8706, operonId: 'op_0003', operonSize: 2 }),
    gene({ id: 'B', strand: '-', start: 8800, end: 9000, operonId: 'op_0003', operonSize: 2 }),
    { ...WRAP_MINUS, operonId: 'op_9100', operonSize: 1 },
  ];
  const { tracks } = repliconTracks(genes, META);
  const chromosome = operonBrackets(tracks[0], genes);
  assert.equal(chromosome.length, 1);
  assert.equal(chromosome[0].lane, 'below');
  assert.equal(chromosome[0].strand, '-');
  assert.deepEqual([chromosome[0].from, chromosome[0].to], [7573, 9000]);
  const plasmid = operonBrackets(tracks[1], genes);
  assert.equal(plasmid[0].wraps, true);
});

test('lanes run plus then minus for each replicon, in declared order', () => {
  const genes = [
    gene({ id: 'A', start: 100, end: 200 }),
    gene({ id: 'B', strand: '-', start: 300, end: 400 }),
    gene({ id: 'C', seqid: PLASMID_B, start: 100, end: 200 }),
  ];
  const { tracks } = repliconTracks(genes, META);
  const lanes = navigationLanes(tracks);
  assert.deepEqual(lanes.map((lane) => [lane.accession, lane.strand, lane.marks.length]), [
    [CHROMOSOME, '+', 1], [CHROMOSOME, '-', 1],
    [PLASMID_B, '+', 1], [PLASMID_B, '-', 0],
    [PLASMID_C, '+', 0], [PLASMID_C, '-', 0],
  ]);
  assert.deepEqual(locateIndex(lanes, 1), { laneIndex: 1, markIndex: 0 });
  assert.equal(locateIndex(lanes, 99), null);
});

test('arrow movement walks one lane, then crosses to the nearest mark in the next', () => {
  const genes = [
    gene({ id: 'A', start: 100, end: 200 }),
    gene({ id: 'B', start: 1000, end: 1100 }),
    gene({ id: 'C', strand: '-', start: 1050, end: 1200 }),
    gene({ id: 'D', strand: '-', start: 2000000, end: 2000100 }),
  ];
  const { tracks } = repliconTracks(genes, META);
  const lanes = navigationLanes(tracks);
  const start = locateIndex(lanes, 0);
  const right = neighborMark(lanes, start, 'right');
  assert.equal(lanes[right.laneIndex].marks[right.markIndex].id, 'B');
  assert.equal(neighborMark(lanes, right, 'right'), null, 'the lane ends rather than wrapping');
  assert.equal(neighborMark(lanes, start, 'left'), null);
  const down = neighborMark(lanes, right, 'down');
  assert.equal(lanes[down.laneIndex].marks[down.markIndex].id, 'C');
  assert.equal(lanes[down.laneIndex].strand, '-');
  const back = neighborMark(lanes, down, 'up');
  assert.equal(lanes[back.laneIndex].marks[back.markIndex].id, 'B');
  assert.deepEqual(neighborMark(lanes, null, 'right'), { laneIndex: 0, markIndex: 0 });
});

test('movement skips hidden marks when filtered-out genes are not shown', () => {
  const genes = [
    gene({ id: 'A', start: 100, end: 200 }),
    gene({ id: 'B', start: 1000, end: 1100 }),
    gene({ id: 'C', start: 2000, end: 2100 }),
  ];
  const { tracks } = repliconTracks(genes, META);
  const lanes = navigationLanes(tracks);
  const allowed = (mark) => mark.id !== 'B';
  const next = neighborMark(lanes, locateIndex(lanes, 0), 'right', allowed);
  assert.equal(lanes[next.laneIndex].marks[next.markIndex].id, 'C');
});

test('crossing lanes compares replicon fractions, because the scales differ', () => {
  // The chromosome mark sits at 50% of 2.69 Mb. On the plasmid the nearer
  // candidate by fraction is the one in its middle, not the one at base 1.
  const genes = [
    gene({ id: 'MID', start: 1345209, end: 1345300 }),
    gene({ id: 'PLASMID_START', seqid: PLASMID_B, start: 1, end: 100 }),
    gene({ id: 'PLASMID_MID', seqid: PLASMID_B, start: 23183, end: 23283 }),
  ];
  const { tracks } = repliconTracks(genes, META);
  const lanes = navigationLanes(tracks);
  const down = neighborMark(lanes, locateIndex(lanes, 0), 'down');
  assert.equal(lanes[down.laneIndex].marks[down.markIndex].id, 'PLASMID_MID');
});

test('axis ticks step in round units and are labelled in genome scale', () => {
  assert.equal(tickStepBp(fullWindow(CHROMOSOME_BP), 6), 500000);
  assert.equal(tickStepBp({ from: 1, to: 1000 }, 5), 200);
  const ticks = positionTicks(fullWindow(CHROMOSOME_BP), 6);
  assert.deepEqual(ticks.map((tick) => tick.bp), [500000, 1000000, 1500000, 2000000, 2500000]);
  // One unit across the whole axis, never "500.0 kb" beside "1.00 Mb".
  assert.deepEqual(ticks.map((tick) => tick.label),
    ['0.5 Mb', '1.0 Mb', '1.5 Mb', '2.0 Mb', '2.5 Mb']);
  assert.deepEqual(positionTicks({ from: 1, to: 300 }, 6).map((tick) => tick.label),
    ['50 bp', '100 bp', '150 bp', '200 bp', '250 bp', '300 bp']);
  assert.deepEqual(axisUnit(500000), { divisor: 1e6, suffix: 'Mb', decimals: 1 });
  assert.deepEqual(axisUnit(100000), { divisor: 1e6, suffix: 'Mb', decimals: 1 });
  assert.deepEqual(axisUnit(20000), { divisor: 1e3, suffix: 'kb', decimals: 0 });
  assert.deepEqual(axisUnit(500), { divisor: 1e3, suffix: 'kb', decimals: 1 });
  assert.deepEqual(axisUnit(50), { divisor: 1, suffix: 'bp', decimals: 0 });
  // Zoomed into a 5 kb window the ticks read in kilobases, not four decimals
  // of a megabase.
  assert.deepEqual(positionTicks({ from: 1345000, to: 1350000 }, 5).map((tick) => tick.label),
    ['1,346 kb', '1,348 kb', '1,350 kb']);
  // A window narrower than one step still labels its own left edge.
  assert.equal(positionTicks({ from: 7, to: 9 }, 1).length >= 1, true);
});

test('base-pair counts read in the unit a reader expects', () => {
  assert.equal(formatBasePairs(CHROMOSOME_BP), '2.69 Mb');
  assert.equal(formatBasePairs(PLASMID_B_BP), '46.4 kb');
  assert.equal(formatBasePairs(PLASMID_C_BP), '7,842 bp');
  assert.equal(formatBasePairs(NaN), 'unknown');
});

test('gene-linked Tan 2018 start sites keep their published absolute positions', () => {
  const genes = [
    gene({
      id: 'A',
      start: 1705000,
      end: 1706000,
      tssEvidence: [
        { id: 'gTSS+1705796', replicon: 'CP006471', strand: '+', position: 1705796, sourceStartDistanceNt: 614 },
        { id: 'no-position', replicon: 'CP006471', strand: '+', position: null },
        { id: 'other-replicon', replicon: 'CP006472', strand: '+', position: 100 },
      ],
    }),
  ];
  const { tracks } = repliconTracks(genes, META);
  const sites = tssPositions(tracks[0], genes);
  assert.equal(sites.length, 1);
  assert.deepEqual(sites[0], {
    id: 'gTSS+1705796',
    geneIndex: 0,
    geneId: 'A',
    position: 1705796,
    strand: '+',
    sourceStartDistanceNt: 614,
  });
  assert.deepEqual(tssPositions(tracks[1], genes), [],
    'a site measured on another replicon never lands on this axis');
});

test('the accessible description names the tracks, the wrap, and the dosage limit', () => {
  const genes = [gene({ id: 'A' }), WRAP_MINUS, WRAP_PLUS];
  const { tracks } = repliconTracks(genes, META);
  const sentence = describeChromosomeView({
    tracks,
    window: fullWindow(CHROMOSOME_BP),
    colorLabel: 'CAI',
    passing: 3,
    total: 3,
    selected: 'M744_RS00005',
    categoryFilterLabels: ['Stress and repair', 'Transport and envelope'],
  });
  assert.match(sentence, /coloured by CAI/);
  assert.match(sentence, /2\.69 Mb chromosome/);
  assert.match(sentence, /own scale and never concatenated/);
  assert.match(sentence, /Plus-strand CDSs sit above each axis/);
  assert.match(sentence, /M744_RS13290 and M744_RS13620 cross the circular origin/);
  // Named, not counted: a count leaves a reader who cannot see the legend
  // without the one fact the filter changed.
  assert.match(sentence,
    /2 function categories are selected: Stress and repair; Transport and envelope\./);
  assert.match(sentence, /M744_RS00005 is selected/);
  assert.match(sentence, /per genome copy/);
  assert.match(sentence, /no source in this release records that copy number/);
  assert.match(
    describeChromosomeView({
      tracks, window: fullWindow(CHROMOSOME_BP), colorLabel: 'CAI', passing: 1, total: 3,
    }),
    /No CDS is selected/,
  );
  assert.match(describeChromosomeView({ tracks: [], window: fullWindow(1), colorLabel: 'x', passing: 0, total: 0 }),
    /no verified replicon/);
  const one = describeChromosomeView({
    tracks,
    window: fullWindow(CHROMOSOME_BP),
    colorLabel: 'CAI',
    passing: 3,
    total: 3,
    categoryFilterLabels: ['Photosynthetic light reactions'],
  });
  assert.match(one, /1 function category is selected: Photosynthetic light reactions\./);
  const none = describeChromosomeView({
    tracks, window: fullWindow(CHROMOSOME_BP), colorLabel: 'CAI', passing: 3, total: 3,
  });
  assert.doesNotMatch(none, /function categor/,
    'an unfiltered view says nothing about categories at all');
});

test('the shipped release places all 2,715 plotted CDSs on its three replicons', async () => {
  const root = new URL('../../site/data/', import.meta.url);
  const [genes, meta] = await Promise.all([
    readFile(new URL('genes.json', root), 'utf8').then(JSON.parse),
    readFile(new URL('meta.json', root), 'utf8').then(JSON.parse),
  ]);
  const { tracks, problems, verified, plottedCount } = repliconTracks(genes, meta);
  assert.deepEqual(problems, []);
  assert.ok(verified);
  assert.equal(plottedCount, genes.length);
  assert.equal(plottedCount, 2715);
  assert.deepEqual(tracks.map((track) => [track.accession, track.cdsCount]),
    [[CHROMOSOME, 2655], [PLASMID_B, 54], [PLASMID_C, 6]]);
  // Exactly the two documented origin-crossing CDSs, and no others.
  const wrapping = tracks.flatMap((track) => track.marks.filter((mark) => mark.wraps));
  assert.deepEqual(wrapping.map((mark) => mark.id).sort(), ['M744_RS13290', 'M744_RS13620']);
  for (const track of tracks) {
    for (const mark of track.marks) {
      for (const piece of mark.pieces) {
        assert.ok(piece.from >= 1 && piece.to <= track.lengthBp,
          `${mark.id} stays inside ${track.accession}`);
      }
    }
  }
  const operons = tracks.flatMap((track) => operonBrackets(track, genes));
  assert.ok(operons.length > 0);
  for (const bracket of operons) {
    assert.equal(bracket.size, bracket.declaredSize,
      `${bracket.operonId} draws every member the pipeline counted`);
    assert.ok(bracket.from <= bracket.to);
  }
});

/**
 * `describePaintOrder` writes the sentences for both places a reader can meet
 * them — the canvas description and the collapsed colour explanation — so they
 * are asserted here, once, rather than twice through two views.
 */
test('the paint-order sentences say what the picture did, and stop where it did not', () => {
  const columns = { occupied: 900, shared: 600, median: 2, max: 9 };
  const full = describePaintOrder({
    categorical: true,
    order: 'Where marks overlap, a lab-reviewed category draws over a source-derived one.',
    accession: 'NZ_CP006471.1',
    columns,
    alike: { derived: 1337, reviewed: 12, threshold: 3 },
  });
  assert.equal(full.length, 5, 'order, crowding, D2, D1, and nothing-is-hidden');
  assert.match(full[1], /600 of 900 occupied columns hold more than one CDS, 2 in the middle/);
  assert.match(full[2], /then the category with more CDSs in that column, then the earlier locus/);
  assert.match(full[3], /1,337 source-derived categories draw in the same solid colour as the 12/);
  assert.match(full[4], /every CDS stays selectable, reachable by the arrow keys, and counted/);

  // No shared column is its own sentence, and it is singular at one.
  const separated = describePaintOrder({
    categorical: false, order: 'ordered', accession: 'NZ_CP006471.1',
    columns: { occupied: 637, shared: 0, median: 1, max: 1 }, alike: null,
  });
  assert.match(separated[1], /each of the 637 occupied columns on NZ_CP006471.1 holds one CDS/);
  assert.equal(separated.length, 3, 'no D2 sentence in a value colour, and no D1 notice');
  const one = describePaintOrder({
    categorical: false, order: 'ordered', accession: 'X',
    columns: { occupied: 4, shared: 1, median: 1, max: 2 }, alike: null,
  });
  assert.match(one[1], /1 of 4 occupied columns holds more than one CDS/);
});

test('a caller with no columns gets the ordering alone, which is what the scatter map is', () => {
  // The map's copy of the disclosure. Its marks are discs on a projection, so
  // there is no column whose majority to settle and no sub-pixel bar to report:
  // the per-column D2 sentence must not be offered about a picture with no
  // columns in it, in a category colour or any other.
  for (const categorical of [true, false]) {
    const sentences = describePaintOrder({
      categorical, order: 'Where marks overlap, the highest value draws on top.',
      accession: null, columns: null, alike: null,
    });
    assert.deepEqual(sentences, [
      'Where marks overlap, the highest value draws on top.',
      'Nothing is hidden by this order: every CDS stays selectable, reachable by the '
        + 'arrow keys, and counted.',
    ], `categorical: ${categorical}`);
  }
  // An occupancy map that came back empty is the same case, not a sentence about
  // zero columns.
  assert.equal(describePaintOrder({
    categorical: true, order: 'ordered', accession: 'X',
    columns: { occupied: 0, shared: 0, median: 0, max: 0 }, alike: null,
  }).length, 2);
  // And a view that has not painted yet says nothing at all.
  assert.deepEqual(describePaintOrder(null), []);
});

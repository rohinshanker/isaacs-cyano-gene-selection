/**
 * The shared marker representation, and the four independent visibilities over it.
 *
 * One record shape for every admitted positional feature, so the chromosome
 * view, both gene visualizers and the sequence close-up cannot describe the
 * same site differently. What the representation has to get right is what it
 * refuses to do:
 *
 * - **It never invents a coordinate.** An interval missing one end is an
 *   unmapped interval, not a point at the end it has. A row with no native
 *   coordinate keeps an explicit unmapped state and stays in the list.
 * - **It keeps two bases apart.** A native genomic coordinate and a distance
 *   published against another gene model are different claims; the record
 *   carries the native one and the gene-relative fields sit beside it, so no
 *   consumer can read one as the other.
 * - **It separates types that measure different things.** TSS and TIS are
 *   separate entries, because transcription initiation and translation
 *   initiation are different measurements at different positions.
 * - **It admits nothing.** A type having an entry here does not put data
 *   behind it: only an organism's own record declares a layer, and only a
 *   landed layer with a row to govern can be offered a control.
 *
 * The visibility half is the owner's provisional default of 2026-10-07:
 * independent per view, every mark visible in a fresh view, carried in a link
 * and coupled to nothing else.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MARKER_GEOMETRIES, MARKER_LAYER_IDS, MARKER_TYPES, MARKER_VIEWS, MARKER_VIEW_IDS,
  availableMarkerLayers, isDefaultMarkerVisibility, markerCoversPosition, markerKey, markerKeys,
  markerLayerForKey, markerLayersOf, markerOf, markerOnReplicon, markerPaintOrder,
  markerPresentation, markerSpanNt, markerTypeOf, markerVisible, normalizeHiddenMarkers,
  withMarkerVisible,
} from '../../site/js/core/marker-layers.js';
import { DEFAULT_ORGANISM, organismById } from '../../site/js/core/organisms.js';
import { FILE_STATE } from '../../site/js/core/data-files.js';

const TAN = markerLayerForKey('tssEvidence');
const ECOLI = organismById('ecoli-k12-mg1655');

/** A shipped-shape Tan row. */
function row(overrides = {}) {
  return {
    id: 'gTSS+320187',
    type: 'gTSS',
    replicon: 'CP006471',
    strand: '+',
    position: 320187,
    sourceStartDistanceNt: 15,
    rawReads: { control: [10, 12], dark: [null, 4] },
    ...overrides,
  };
}

test('the type table separates what it must and names a geometry for each', () => {
  // The distinction the ticket requires: one type for transcription start and
  // another for translation start, never one "start site".
  assert.notEqual(MARKER_TYPES.TSS, MARKER_TYPES.TIS);
  assert.match(MARKER_TYPES.TSS.label, /transcription start site/);
  assert.match(MARKER_TYPES.TIS.label, /translation initiation site/);
  assert.equal(MARKER_TYPES.TSS.measures, 'transcription initiation');
  assert.equal(MARKER_TYPES.TIS.measures, 'translation initiation');

  // Every entry declares exactly one of the two geometries, and both are used:
  // a representation with no interval in it could not hold a promoter.
  const geometries = Object.values(MARKER_TYPES).map((type) => type.geometry);
  assert.deepEqual([...new Set(geometries)].sort(), [...MARKER_GEOMETRIES].sort());
  for (const [id, type] of Object.entries(MARKER_TYPES)) {
    assert.equal(type.id, id, `${id} knows its own id`);
    assert.ok(MARKER_GEOMETRIES.includes(type.geometry), `${id} has a declared geometry`);
    assert.ok(type.label.length > 0 && type.shortLabel.length > 0 && type.measures.length > 0);
    assert.ok(Object.isFrozen(type));
  }
  assert.equal(MARKER_TYPES.promoter.geometry, 'interval');
  assert.equal(MARKER_TYPES.gTSS.geometry, 'point');

  // The four type strings the admitted extracts publish are all representable.
  for (const id of ['gTSS', 'aTSS', 'iTSS', 'nTSS']) {
    assert.equal(markerTypeOf(id)?.id, id);
  }
  // An unknown type is null rather than a guess, and not a thrown error.
  assert.equal(markerTypeOf('promoterish'), null);
  assert.equal(markerTypeOf(undefined), null);
  assert.equal(markerTypeOf('constructor'), null, 'inherited object keys are not types');
});

test('a point row becomes a point marker with every field its own', () => {
  const marker = markerOf(row(), TAN);
  assert.equal(marker.id, 'gTSS+320187');
  assert.equal(marker.layerId, 'tss');
  assert.equal(marker.typeId, 'gTSS');
  assert.equal(marker.typeLabel, 'gene-linked transcription start site');
  assert.equal(marker.geometry, 'point');
  assert.equal(marker.strand, '+');
  assert.equal(marker.replicon, 'CP006471');
  assert.equal(marker.position, 320187);
  assert.equal(marker.endPosition, null, 'a point has no second end to publish');
  assert.equal(marker.coordinateStatus, 'mapped');
  assert.equal(marker.measurement, 'measured');
  assert.equal(marker.readCount, 3, 'only the finite counts the row carries');
  assert.equal(markerSpanNt(marker), 1);

  // The layer's statement about its own rows, and a row that speaks for itself.
  assert.equal(markerOf(row({ measurement: 'predicted' }), TAN).measurement, 'predicted');
  // No layer and no row field leaves it unrecorded, which is read as neither.
  assert.equal(markerOf(row(), null).measurement, null);
  assert.equal(markerOf(row(), null).layerId, null);
});

test('overlap priority follows explicit origin, never measurement or producer wording', () => {
  const computed = markerOf(row({
    id: 'computed', measurement: 'measured', origin: 'computed', producer: 'wet-lab sounding text',
  }), TAN);
  const sourced = markerOf(row({
    id: 'source', measurement: 'predicted', origin: 'source', producer: 'algorithm sounding text',
  }), TAN);
  assert.deepEqual(markerPresentation(computed), {
    id: 'supplementary', priority: 0, opacity: 0.62,
  });
  assert.deepEqual(markerPresentation(sourced), {
    id: 'primary', priority: 1, opacity: 1,
  });
  assert.deepEqual(markerPaintOrder([sourced, computed]).map((marker) => marker.id),
    ['computed', 'source']);
  assert.equal(computed.producer, 'wet-lab sounding text');
  assert.equal(sourced.producer, 'algorithm sounding text');
});

test('an interval needs both ends, and one end alone is unmapped rather than a point', () => {
  const span = markerOf({
    id: 'P-1', type: 'promoter', replicon: 'CP006471', strand: '-',
    position: 1000, endPosition: 1035,
  }, TAN);
  assert.equal(span.geometry, 'interval');
  assert.equal(span.coordinateStatus, 'mapped');
  assert.equal(markerSpanNt(span), 36);

  const halfOpen = markerOf({ id: 'P-2', type: 'promoter', replicon: 'CP006471', position: 1000 }, TAN);
  assert.equal(halfOpen.geometry, 'interval');
  assert.equal(halfOpen.coordinateStatus, 'unmapped',
    'the missing end is not the start and not zero');
  assert.equal(markerSpanNt(halfOpen), null);
  assert.equal(markerCoversPosition(halfOpen, 1000), false,
    'an incomplete interval covers nothing, rather than its one known base');

  // A row carrying both ends but no type is still an interval: that is what it
  // says. A row carrying one is a point.
  assert.equal(markerOf({ id: 'x', position: 5, endPosition: 9 }, TAN).geometry, 'interval');
  assert.equal(markerOf({ id: 'x', position: 5 }, TAN).geometry, 'point');
  // A point type never acquires a span from a stray second end.
  assert.equal(markerOf(row({ endPosition: 320999 }), TAN).endPosition, null);
});

test('a row with no usable coordinate is unmapped and kept, never dropped or placed', () => {
  for (const missing of [{ position: null }, { position: undefined }, { position: 'x' }, { position: NaN }]) {
    const marker = markerOf(row(missing), TAN);
    assert.equal(marker.coordinateStatus, 'unmapped');
    assert.equal(marker.position, null);
    assert.equal(markerSpanNt(marker), null);
    assert.equal(markerCoversPosition(marker, 320187), false);
    assert.equal(markerOnReplicon(marker, 'NZ_CP006471.1'), false);
    // Everything else the row did publish survives, which is what makes an
    // unmapped row distinguishable from a row nobody published.
    assert.equal(marker.id, 'gTSS+320187');
    assert.equal(marker.typeId, 'gTSS');
    assert.equal(marker.strand, '+');
  }
  // A field the row does not carry says so rather than borrowing a default.
  const bare = markerOf({}, TAN);
  assert.deepEqual(
    [bare.id, bare.typeId, bare.typeLabel, bare.strand, bare.replicon, bare.position],
    [null, null, null, null, null, null],
  );
  assert.equal(bare.coordinateStatus, 'unmapped');
  assert.equal(markerOf(undefined, TAN).coordinateStatus, 'unmapped');
  // A strand the record does not use is not recorded, not coerced to plus.
  assert.equal(markerOf(row({ strand: '.' }), TAN).strand, null);
});

test('coverage and span read the circular replicon, and never cross to another one', () => {
  const point = markerOf(row({ position: 320187 }), TAN);
  assert.ok(markerCoversPosition(point, 320187));
  assert.ok(!markerCoversPosition(point, 320188));
  assert.ok(!markerCoversPosition(point, NaN));

  const plain = markerOf({ id: 'i', type: 'promoter', replicon: 'CP006471', position: 10, endPosition: 14 }, TAN);
  assert.deepEqual([10, 11, 12, 13, 14].map((p) => markerCoversPosition(plain, p)), [true, true, true, true, true]);
  assert.ok(!markerCoversPosition(plain, 9) && !markerCoversPosition(plain, 15));

  // An interval whose end precedes its start runs across the origin of a
  // circular replicon. CP006473 is 7,842 bp, so 7,840..3 is 6 bases.
  const wrapping = markerOf({
    id: 'w', type: 'promoter', replicon: 'CP006473', position: 7840, endPosition: 3,
  }, TAN);
  assert.equal(markerSpanNt(wrapping), 6);
  assert.deepEqual([7839, 7840, 7842, 1, 3, 4].map((p) => markerCoversPosition(wrapping, p)),
    [false, true, true, true, true, false]);
  // Without a known replicon length a wrapped span is not guessed.
  const unknownLength = markerOf({
    id: 'w2', type: 'promoter', replicon: 'CP999999', position: 90, endPosition: 10,
  }, TAN);
  assert.equal(markerSpanNt(unknownLength), null);
  assert.equal(markerCoversPosition(unknownLength, 95), false);

  // Replicons are compared under either naming scheme and never by number alone.
  assert.ok(markerOnReplicon(point, 'NZ_CP006471.1'));
  assert.ok(markerOnReplicon(point, 'CP006471'));
  assert.ok(!markerOnReplicon(point, 'NZ_CP006472.1'));
  assert.ok(!markerOnReplicon(markerOf(row({ replicon: null }), TAN), 'NZ_CP006471.1'));
});

test('a layer exists for an organism only where its record declares one', () => {
  const [tan, ...rest] = markerLayersOf(DEFAULT_ORGANISM);
  assert.equal(rest.length, 0, 'one admitted marker layer today');
  assert.equal(tan.id, 'tss');
  assert.equal(tan.key, 'tssEvidence');
  assert.equal(tan.label, 'Tan 2018', 'the study name comes from the organism record');
  assert.equal(tan.citation, 'Tan et al. 2018');
  assert.deepEqual([...tan.types], ['gTSS']);
  assert.ok(Object.isFrozen(tan));
  assert.deepEqual([...MARKER_LAYER_IDS], ['tss']);

  // The organism with no such study gets no layer, so nothing can offer to
  // show or hide a feature nobody looked for there.
  assert.deepEqual(markerLayersOf(ECOLI), []);
  assert.equal(markerLayerForKey('tssEvidence').id, 'tss');
  assert.equal(markerLayerForKey('functionCategories'), null);
});

test('only a landed layer with a row to govern is available for a control', () => {
  const landed = { files: { tssEvidence: { state: FILE_STATE.READY } } };
  assert.deepEqual(availableMarkerLayers(DEFAULT_ORGANISM, landed).map((l) => l.id), ['tss']);
  // Loading and failed are not "no marks": neither can be shown or hidden yet.
  for (const state of [FILE_STATE.LOADING, FILE_STATE.FAILED]) {
    assert.deepEqual(availableMarkerLayers(DEFAULT_ORGANISM, { files: { tssEvidence: { state } } }), []);
  }
  // A landed layer with nothing in the scope the caller draws is unavailable too.
  assert.deepEqual(availableMarkerLayers(DEFAULT_ORGANISM, landed, () => false), []);
  assert.deepEqual(availableMarkerLayers(ECOLI, landed), []);
  // A dataset with no record of the file has settled, which is what a
  // hand-built receiver is.
  assert.deepEqual(availableMarkerLayers(DEFAULT_ORGANISM, {}).map((l) => l.id), ['tss']);
});

test('the four views are the four the owner named, and each holds its own choice', () => {
  assert.deepEqual([...MARKER_VIEW_IDS],
    ['chromosome', 'gene-controls', 'gene-detail', 'sequence']);
  for (const view of MARKER_VIEWS) {
    assert.ok(view.label.length > 0, `${view.id} can be named in a sentence`);
    assert.ok(Object.isFrozen(view));
  }

  // A fresh view draws every mark everywhere, which is the owner's default.
  assert.ok(isDefaultMarkerVisibility([]));
  for (const view of MARKER_VIEW_IDS) assert.ok(markerVisible([], 'tss', view));

  // Hiding one view's marks leaves the other three exactly as they were.
  const hidden = withMarkerVisible([], 'tss', 'sequence', false);
  assert.deepEqual(hidden, ['tss.sequence']);
  assert.ok(!markerVisible(hidden, 'tss', 'sequence'));
  for (const view of ['chromosome', 'gene-controls', 'gene-detail']) {
    assert.ok(markerVisible(hidden, 'tss', view), `${view} is untouched`);
  }
  assert.ok(!isDefaultMarkerVisibility(hidden));

  // Showing it again returns to the default, so a link goes back to carrying
  // no field at all.
  assert.deepEqual(withMarkerVisible(hidden, 'tss', 'sequence', true), []);
  // Hiding twice is idempotent, and the caller's own array is never mutated.
  const twice = withMarkerVisible(hidden, 'tss', 'sequence', false);
  assert.deepEqual(twice, ['tss.sequence']);
  assert.deepEqual(hidden, ['tss.sequence']);
});

test('the hidden set is canonical, so one choice writes one link', () => {
  assert.deepEqual(markerKeys(), [
    'tss.chromosome', 'tss.gene-controls', 'tss.gene-detail', 'tss.sequence',
  ]);
  assert.equal(markerKey('tss', 'sequence'), 'tss.sequence');

  // Two readers who clicked in different orders write the same field.
  const clickedOneWay = ['tss.sequence', 'tss.chromosome']
    .reduce((hidden, key) => withMarkerVisible(hidden, 'tss', key.split('.')[1], false), []);
  const clickedTheOther = ['tss.chromosome', 'tss.sequence']
    .reduce((hidden, key) => withMarkerVisible(hidden, 'tss', key.split('.')[1], false), []);
  assert.deepEqual(clickedOneWay, clickedTheOther);
  assert.deepEqual(clickedOneWay, ['tss.chromosome', 'tss.sequence']);

  // Repeats collapse and unknown names are dropped rather than kept: a hash
  // from a build with another layer cannot blank a view here, and a typo must
  // not leave one permanently empty.
  assert.deepEqual(normalizeHiddenMarkers(['tss.sequence', 'tss.sequence']), ['tss.sequence']);
  assert.deepEqual(normalizeHiddenMarkers(['tss.nowhere', 'tis.sequence', '', 'tss']), []);
  assert.deepEqual(normalizeHiddenMarkers(null), []);
  assert.deepEqual(normalizeHiddenMarkers('tss.sequence'), []);
  // An unknown key cannot hide a mark either.
  assert.ok(markerVisible(['tss.nowhere'], 'tss', 'sequence'));
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SOURCE_TOGGLES, DEFAULT_COLOR_SOURCES, ALL_SOURCES, NO_SOURCES,
  UTEX_SOURCE, PCC_SOURCE, GO_IEA_SOURCE, isAnnotationSource, annotationSourceLabel,
  normalizeAnnotationSources, parseAnnotationSources, annotationSourceId, isAllSources, hasSource,
} from '../../site/js/core/annotation-source.js';

test('exposes three colour-source toggles in precedence order, all on by default', () => {
  assert.deepEqual(SOURCE_TOGGLES.map((s) => s.id), [UTEX_SOURCE, PCC_SOURCE, GO_IEA_SOURCE]);
  assert.deepEqual([...DEFAULT_COLOR_SOURCES], [UTEX_SOURCE, PCC_SOURCE, GO_IEA_SOURCE]);
  assert.equal(isAnnotationSource('pcc-7942'), true);
  assert.equal(isAnnotationSource('all'), false);
  assert.equal(isAnnotationSource('nonsense'), false);
  assert.equal(annotationSourceLabel('pcc-7942'), 'PCC 7942');
  assert.equal(annotationSourceLabel('nonsense'), null);
});

test('normalisation accepts arrays, single ids, all, and none, and drops unknown ids', () => {
  assert.deepEqual(normalizeAnnotationSources(undefined), [UTEX_SOURCE, PCC_SOURCE, GO_IEA_SOURCE]);
  assert.deepEqual(normalizeAnnotationSources(ALL_SOURCES), [UTEX_SOURCE, PCC_SOURCE, GO_IEA_SOURCE]);
  assert.deepEqual(normalizeAnnotationSources(NO_SOURCES), []);
  assert.deepEqual(normalizeAnnotationSources(PCC_SOURCE), [PCC_SOURCE]);
  assert.deepEqual(normalizeAnnotationSources('nonsense'), [UTEX_SOURCE, PCC_SOURCE, GO_IEA_SOURCE]);
  // Canonical order, deduplicated, unknown ids dropped.
  assert.deepEqual(normalizeAnnotationSources([GO_IEA_SOURCE, 'x', UTEX_SOURCE, GO_IEA_SOURCE]),
    [UTEX_SOURCE, GO_IEA_SOURCE]);
  assert.deepEqual(normalizeAnnotationSources([]), []);
});

test('the URL field parses lists, single ids, all, and none, and refuses pure nonsense', () => {
  assert.deepEqual(parseAnnotationSources('utex-2973,go-iea'), [UTEX_SOURCE, GO_IEA_SOURCE]);
  assert.deepEqual(parseAnnotationSources('go-iea'), [GO_IEA_SOURCE]);
  assert.deepEqual(parseAnnotationSources('all'), [UTEX_SOURCE, PCC_SOURCE, GO_IEA_SOURCE]);
  assert.deepEqual(parseAnnotationSources('none'), []);
  assert.equal(parseAnnotationSources('nonsense'), null);
  assert.equal(parseAnnotationSources(''), null);
  assert.equal(parseAnnotationSources(undefined), null);
});

test('one id names the enabled set and the label reads naturally', () => {
  assert.equal(annotationSourceId([UTEX_SOURCE, PCC_SOURCE, GO_IEA_SOURCE]), 'all');
  assert.equal(annotationSourceId([]), 'none');
  assert.equal(annotationSourceId([PCC_SOURCE]), 'pcc-7942');
  assert.equal(annotationSourceId([GO_IEA_SOURCE, UTEX_SOURCE]), 'utex-2973+go-iea');
  assert.equal(annotationSourceLabel([UTEX_SOURCE, PCC_SOURCE, GO_IEA_SOURCE]), 'All sources');
  assert.equal(annotationSourceLabel([]), 'No sources');
  assert.equal(annotationSourceLabel([PCC_SOURCE, GO_IEA_SOURCE]), 'PCC 7942 + GO IEA');
  assert.equal(annotationSourceLabel('utex-2973+go-iea'), 'UTEX 2973 + GO IEA');
  assert.equal(isAllSources([GO_IEA_SOURCE, PCC_SOURCE, UTEX_SOURCE]), true);
  assert.equal(isAllSources([PCC_SOURCE]), false);
  assert.equal(hasSource([PCC_SOURCE], PCC_SOURCE), true);
  assert.equal(hasSource('all', GO_IEA_SOURCE), true);
  assert.equal(hasSource([], UTEX_SOURCE), false);
});

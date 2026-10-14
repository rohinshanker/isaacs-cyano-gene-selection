import test from 'node:test';
import assert from 'node:assert/strict';
import { goTermEvidenceState, goTermEvidenceModel, passesGoTermFilter, filterGoTerms } from '../../site/js/core/go-term-evidence.js';
import { defaultState, encodeState, decodeState, viewStateOf } from '../../site/js/core/url-state.js';
import { organismById, ORGANISMS } from '../../site/js/core/organisms.js';

const id = 'GO:0000001';
const names = { [id]: { name: 'example', isObsolete: false } };
const relation = (qualifier = 'enables', evidenceCode = 'IDA', mappingAmbiguity = '') => ({
  goId: id, qualifier, evidenceCode, mappingAmbiguity });
const gene = (...rows) => ({ annotationEvidence: { goAnnotations: rows } });

test('literal GO lookup narrows names/IDs and preserves the selected term outside a search', () => {
  const terms = { [id]: names[id], 'GO:0000002': { name: 'threonine process', isObsolete: false } };
  assert.deepEqual(filterGoTerms(terms, 'THREONINE').entries.map(([key]) => key), ['GO:0000002']);
  assert.deepEqual(filterGoTerms(terms, 'GO:0000001').entries.map(([key]) => key), [id]);
  const missing = filterGoTerms(terms, 'no-match', id);
  assert.equal(missing.count, 0);
  assert.equal(missing.selectedOutsideSearch, true);
  assert.equal(missing.entries[0][0], id);
  assert.equal(filterGoTerms(null, '', id).entries[0][1].name, 'unavailable term');
  assert.equal(filterGoTerms(terms, ' ').count, 2);
});

test('GO term states distinguish positive, NOT, conflict, unknown and withheld evidence', () => {
  assert.equal(goTermEvidenceState(gene(relation()), id, names), 'positive');
  assert.equal(goTermEvidenceState(gene(relation('NOT|enables')), id, names), 'negative');
  assert.equal(goTermEvidenceState(gene(relation(), relation('NOT|enables')), id, names), 'conflict');
  assert.equal(goTermEvidenceState(gene(), id, names), 'unknown');
  assert.equal(goTermEvidenceState({}, id, names), 'unknown');
  assert.equal(goTermEvidenceState(gene(relation('enables', 'ND')), id, names), 'unavailable');
  assert.equal(goTermEvidenceState(gene(relation('enables', 'IDA', 'ambiguous')), id, names), 'unavailable');
  assert.equal(goTermEvidenceState(gene(relation()), id, { [id]: { isObsolete: true } }), 'unavailable');
  assert.equal(goTermEvidenceState(gene(relation()), id, { [id]: { isObsolete: null } }), 'unavailable');
  assert.equal(goTermEvidenceState(gene(relation()), id, {}, false), 'unavailable');
  assert.equal(goTermEvidenceState(gene(relation()), id, names, true), 'unavailable');
});

test('colour and filter use the same evidence state; pending annotation is not a zero', () => {
  const dataset = { genes: [gene(relation()), gene(relation('NOT')), gene(relation(), relation('NOT')),
    gene(), gene(relation('', 'ND'))], goTerms: { terms: names } };
  const model = goTermEvidenceModel(dataset, id);
  assert.deepEqual([...model.values], [0, 1, 2, 3, 4]);
  assert.deepEqual(model.counts, [1, 1, 1, 1, 1]);
  assert.equal(passesGoTermFilter(model, 0, 'positive'), true);
  assert.equal(passesGoTermFilter(model, 2, 'positive'), false);
  assert.equal(passesGoTermFilter(model, 2, 'conflict'), true);
  assert.equal(passesGoTermFilter(model, 4, 'unavailable'), true);
  assert.equal(passesGoTermFilter(model, 1, 'any'), true);
  assert.equal(passesGoTermFilter(goTermEvidenceModel(dataset, ''), 0, 'positive'), true);
  dataset.files = { annotations: { state: 'loading' } };
  const pending = goTermEvidenceModel(dataset, id);
  assert.deepEqual(pending.counts, [0, 0, 0, 0, 5]);
  assert.equal(passesGoTermFilter(pending, 0, 'positive'), true);
});

test('GO term/filter/colour round-trip only for recoded organisms and survive export state', () => {
  for (const organism of ORGANISMS.filter((o) => o.functionalAnnotations)) {
    const state = { ...defaultState(organism), goTerm: id, goEvidenceFilter: 'conflict', colorBy: 'goTermEvidence' };
    const hash = encodeState(state, organism);
    assert.equal(decodeState(hash, organism).goTerm, id);
    assert.equal(decodeState(hash, organism).goEvidenceFilter, 'conflict');
    assert.equal(viewStateOf(state, organism).goTerm, id);
    assert.equal(viewStateOf(state, organism).goEvidenceFilter, 'conflict');
    assert.equal(decodeState('#gt=GO%3A0000001&gf=invalid', organism).goEvidenceFilter, undefined);
    assert.equal(decodeState('#gt=invalid&gf=positive', organism).goTerm, undefined);
  }
  for (const organism of ORGANISMS.filter((o) => !o.functionalAnnotations)) {
    assert.equal(decodeState('#gt=GO%3A0000001&gf=positive', organism).goTerm, undefined);
    assert.ok(!encodeState({ ...defaultState(organism), goTerm: id }, organism).includes('gt='));
  }
});

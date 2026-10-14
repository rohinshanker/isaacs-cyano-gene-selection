/** Exact GO relationships, never semantic categories or recoded measurements. */
export const GO_TERM_COLOR_KEY = 'goTermEvidence';
export const GO_EVIDENCE_BUCKETS = Object.freeze([
  { id: 'positive', label: 'Positive annotation' },
  { id: 'negative', label: 'Explicit NOT annotation' },
  { id: 'conflict', label: 'Conflicting positive and NOT' },
  { id: 'unknown', label: 'No positive annotation' },
  { id: 'unavailable', label: 'Unavailable, obsolete or no-data evidence' },
]);

export function goTermEvidenceState(gene, termId, terms, unavailable = false) {
  const term = terms?.[termId];
  if (unavailable || !termId || !term || term.isObsolete !== false) return 'unavailable';
  const rows = (gene.annotationEvidence?.goAnnotations ?? []).filter((r) => r.goId === termId);
  let positive = false;
  let negative = false;
  let withheld = false;
  for (const row of rows) {
    if (!row.evidenceCode || row.evidenceCode === 'ND' || row.mappingAmbiguity) {
      withheld = true;
      continue;
    }
    if ((row.qualifier ?? '').split('|').includes('NOT')) negative = true;
    else positive = true;
  }
  if (positive && negative) return 'conflict';
  if (positive) return 'positive';
  if (negative) return 'negative';
  return withheld ? 'unavailable' : 'unknown';
}

export function goTermEvidenceModel(dataset, termId) {
  const unavailable = ['annotations', 'goTerms'].some((key) =>
    ['loading', 'failed', 'absent'].includes(dataset.files?.[key]?.state));
  const terms = dataset.goTerms?.terms;
  const states = dataset.genes.map((gene) => goTermEvidenceState(gene, termId, terms, unavailable));
  const counts = GO_EVIDENCE_BUCKETS.map((bucket) => states.filter((state) => state === bucket.id).length);
  return { termId, states, counts,
    label: `GO term ${termId || '(choose a term)'}${terms?.[termId]?.name ? ` · ${terms[termId].name}` : ''}`,
    values: Uint8Array.from(states.map((state) => GO_EVIDENCE_BUCKETS.findIndex((b) => b.id === state))),
    unavailable };
}

export function passesGoTermFilter(model, index, selection) {
  return !selection || selection === 'any' || !model.termId || model.unavailable
    || model.states[index] === selection;
}

/** Literal user-directed lookup of existing IDs/names; no semantic classification. */
export function filterGoTerms(terms, query, selectedId = '') {
  const needle = String(query ?? '').trim().toLowerCase();
  const matches = Object.entries(terms ?? {}).filter(([id, term]) =>
    !needle || id.toLowerCase().includes(needle) || term.name.toLowerCase().includes(needle));
  matches.sort(([a], [b]) => a.localeCompare(b));
  const selectedOutsideSearch = selectedId && !matches.some(([id]) => id === selectedId);
  const count = matches.length;
  if (selectedOutsideSearch) matches.unshift([selectedId, terms?.[selectedId]
    ?? { name: 'unavailable term', isObsolete: null }]);
  return { entries: matches, count, selectedOutsideSearch: Boolean(selectedOutsideSearch) };
}

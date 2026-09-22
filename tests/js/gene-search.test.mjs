import { test } from 'node:test';
import assert from 'node:assert/strict';
import { searchGenes, GENE_ALIASES } from '../../site/js/core/gene-search.js';
import { searchActionState, shouldRenderSearch } from '../../site/js/ui/gene-search-results.js';

/**
 * A miniature stand-in for the real annotation, carrying the case the lab hit:
 * the enzyme is spelled out, while three other genes mention the nickname.
 */
const GENES = [
  { id: 'M744_RS09000', name: null, product: 'ribulose bisphosphate carboxylase small subunit' },
  { id: 'M744_RS09005', name: null, product: 'form I ribulose bisphosphate carboxylase large subunit' },
  { id: 'M744_RS08315', name: 'rcbX', product: 'RuBisCO chaperone RbcX' },
  { id: 'M744_RS09020', name: null, product: 'RuBisCO small subunit-like domain-containing protein' },
  { id: 'M744_RS11980', name: null, product: 'RuBisCO accumulation factor 1' },
  { id: 'M744_RS11720', name: 'rpsL', product: '30S ribosomal protein S12' },
  { id: 'M744_RS00815', name: 'psbA', product: 'photosystem II q(b) protein' },
  { id: 'M744_RS00005', name: null, product: 'metallophosphoesterase' },
];

const ids = (result) => result.shown.map((hit) => hit.gene.id);

test('a blur event for the rendered query preserves the result being clicked', () => {
  assert.equal(shouldRenderSearch('', 'rubisco', undefined), true);
  assert.equal(shouldRenderSearch('rubisco', 'rubisco', { total: 5 }), false);
  assert.equal(shouldRenderSearch('', '', null), false);
  assert.equal(shouldRenderSearch('rubisco', 'rpsL', { total: 5 }), true);
});

test('pin and shortlist search actions reverse independently', () => {
  assert.deepEqual(searchActionState(false, false), { pin: 'Pin', shortlist: 'Shortlist' });
  assert.deepEqual(searchActionState(true, false), { pin: 'Unpin', shortlist: 'Shortlist' });
  assert.deepEqual(searchActionState(false, true), { pin: 'Pin', shortlist: 'Remove' });
  assert.deepEqual(searchActionState(true, true), { pin: 'Unpin', shortlist: 'Remove' });
});

test('an exact locus tag is the first result', () => {
  const result = searchGenes(GENES, 'M744_RS09005');
  assert.equal(result.total, 1);
  assert.equal(ids(result)[0], 'M744_RS09005');
  assert.equal(result.shown[0].matchedOn, 'locus tag');
});

test('a locus tag matches whatever case it is typed in', () => {
  assert.equal(ids(searchGenes(GENES, 'm744_rs09005'))[0], 'M744_RS09005');
  assert.equal(ids(searchGenes(GENES, '  M744_RS09005  '))[0], 'M744_RS09005');
});

test('a gene name resolves, and reports that it matched the name', () => {
  const result = searchGenes(GENES, 'rpsL');
  assert.equal(result.total, 1);
  assert.equal(result.shown[0].gene.id, 'M744_RS11720');
  assert.equal(result.shown[0].matchedOn, 'gene name');
  assert.equal(result.shown[0].alias, null);
});

test('a gene symbol does not match a longer ATPase word by substring', () => {
  assert.deepEqual(ids(searchGenes(GENES, 'atpA')), []);
  const genes = [
    { id: 'GENE_1', name: 'atpA', product: 'ATP synthase subunit alpha' },
    { id: 'GENE_2', name: null, product: 'ATPase subunit I' },
  ];
  assert.deepEqual(ids(searchGenes(genes, 'atpA')), ['GENE_1']);
});

test('product text is searchable, which it was not before', () => {
  const result = searchGenes(GENES, 'chaperone');
  assert.deepEqual(ids(result), ['M744_RS08315']);
  assert.equal(result.shown[0].matchedOn, 'product');
});

test('every word of a multi-word query must match, not only the first', () => {
  // The old handler took the first token and dropped the rest, so "ribulose
  // anything" would have resolved on "ribulose" alone.
  assert.equal(searchGenes(GENES, 'ribulose bisphosphate').total, 2);
  assert.equal(searchGenes(GENES, 'ribulose nonsense').total, 0);
  // Word order in the annotation does not have to match what was typed.
  assert.equal(searchGenes(GENES, 'subunit large').total, 1);
});

test('rubisco reaches the enzyme, and ranks it above its chaperone', () => {
  // This is the reported failure. A substring search returns the chaperone, the
  // domain protein and the accumulation factor while both real subunits hide,
  // which looks like it worked.
  const result = searchGenes(GENES, 'rubisco');
  assert.equal(result.total, 5);
  assert.deepEqual(ids(result).slice(0, 2), ['M744_RS09000', 'M744_RS09005']);
  assert.deepEqual(result.aliasesUsed, ['rubisco']);
  assert.equal(result.shown[0].alias, 'rubisco');
  // The direct substring hits still appear; they are simply less specific.
  assert.ok(ids(result).includes('M744_RS08315'));
  assert.equal(result.shown[2].alias, null);
});

test('an alias is reported so a match is never passed off as a literal hit', () => {
  assert.deepEqual(searchGenes(GENES, 'psii').aliasesUsed, ['psii']);
  assert.deepEqual(searchGenes(GENES, 'photosystem ii').aliasesUsed, []);
  assert.equal(searchGenes(GENES, 'psii').shown[0].gene.id, 'M744_RS00815');
});

test('an alias fires on one word of a longer query', () => {
  const result = searchGenes(GENES, 'rubisco subunit');
  assert.ok(ids(result).includes('M744_RS09000'));
  assert.deepEqual(result.aliasesUsed, ['rubisco']);
});

test('ranking runs identifier, then gene name, then product', () => {
  const genes = [
    { id: 'GENE_0002', name: null, product: 'contains gene_0001 in its description' },
    { id: 'GENE_0003', name: 'gene_0001', product: 'unrelated' },
    { id: 'GENE_0001', name: null, product: 'unrelated' },
  ];
  assert.deepEqual(ids(searchGenes(genes, 'GENE_0001')),
    ['GENE_0001', 'GENE_0003', 'GENE_0002']);
});

test('nothing matched is an explicit result, not an empty silence', () => {
  const result = searchGenes(GENES, 'thiswordisnotinthegenome');
  assert.equal(result.total, 0);
  assert.deepEqual(result.shown, []);
  assert.equal(result.hiddenCount, 0);
  assert.deepEqual(result.aliasesUsed, []);
});

test('an empty query returns nothing rather than every gene', () => {
  for (const query of ['', '   ', null, undefined]) {
    const result = searchGenes(GENES, query);
    assert.equal(result.total, 0, `query ${JSON.stringify(query)} matched something`);
  }
});

test('the visible list is capped and the remainder is counted, never dropped', () => {
  const many = Array.from({ length: 30 }, (unused, i) => ({
    id: `GENE_${String(i).padStart(4, '0')}`, name: null, product: 'ribosomal protein',
  }));
  const result = searchGenes(many, 'ribosomal', { limit: 5 });
  assert.equal(result.total, 30);
  assert.equal(result.shown.length, 5);
  assert.equal(result.hiddenCount, 25);
});

test('a gene with no name or product does not break the search', () => {
  const sparse = [{ id: 'GENE_0001', name: null, product: null }];
  assert.equal(searchGenes(sparse, 'GENE_0001').total, 1);
  assert.equal(searchGenes(sparse, 'anything').total, 0);
});

test('GO ID and pinned term name search return labelled IEA suggestions', () => {
  const genes = [
    { id: 'M744_RS00265', name: 'psaC', product: 'ferredoxin', annotationEvidence: {
      goAnnotations: [{ goId: 'GO:0009773', evidenceCode: 'IEA', mappingAmbiguity: '' }],
    } },
    { id: 'M744_RS00030', name: null, product: 'hypothetical protein',
      annotationEvidence: { goAnnotations: [] } },
  ];
  const goTerms = { 'GO:0009773': {
    name: 'photosynthetic electron transport in photosystem I',
    namespace: 'biological_process',
  } };
  const byId = searchGenes(genes, 'go:0009773', { goTerms });
  assert.equal(byId.total, 1);
  assert.equal(byId.shown[0].matchedOn, 'GO ID');
  assert.deepEqual(byId.shown[0].goMatch, {
    id: 'GO:0009773', name: goTerms['GO:0009773'].name,
    evidenceCode: 'IEA', mappingAmbiguity: null, isObsolete: false,
  });
  const byName = searchGenes(genes, 'electron transport photosynthetic', { goTerms });
  assert.equal(byName.total, 1);
  assert.equal(byName.shown[0].matchedOn, 'GO term name');
  assert.equal(searchGenes(genes, 'photosynthetic', { goTerms: null }).total, 0);
});

test('direct gene matches keep their rank ahead of GO suggestions', () => {
  const genes = [
    { id: 'GENE_1', product: 'electron transport protein' },
    { id: 'GENE_2', product: 'ferredoxin', annotationEvidence: {
      goAnnotations: [{ goId: 'GO:0009773', evidenceCode: 'IEA', mappingAmbiguity: 'shared protein ID' }],
    } },
  ];
  const result = searchGenes(genes, 'electron transport', {
    goTerms: { 'GO:0009773': { name: 'photosynthetic electron transport' } },
  });
  assert.deepEqual(ids(result), ['GENE_1', 'GENE_2']);
  assert.equal(result.shown[0].goMatch, null);
  assert.equal(result.shown[1].goMatch.mappingAmbiguity, 'shared protein ID');
});

test('obsolete GO IDs remain searchable and carry the source warning', () => {
  const genes = [{ id: 'GENE_1', product: 'unrelated', annotationEvidence: {
    goAnnotations: [{ goId: 'GO:0006082', evidenceCode: 'IEA', mappingAmbiguity: '' }],
  } }];
  const result = searchGenes(genes, 'GO:0006082', {
    goTerms: { 'GO:0006082': { name: 'organic acid metabolic process', isObsolete: true } },
  });
  assert.equal(result.total, 1);
  assert.equal(result.shown[0].goMatch.isObsolete, true);
});

test('reviewed category search finds only assigned loci and follows direct matches', () => {
  const genes = [
    { id: 'GENE_1', product: 'light reactions protein', reviewedFunctionLabels: [] },
    { id: 'GENE_2', product: 'ferredoxin',
      reviewedFunctionLabels: ['Photosynthetic light reactions'] },
    { id: 'GENE_3', product: 'ferredoxin', annotationEvidence: {
      goAnnotations: [{ goId: 'GO:1', evidenceCode: 'IEA' }],
    } },
  ];
  const result = searchGenes(genes, 'light reactions', {
    goTerms: { 'GO:1': { name: 'light reactions' } },
  });
  assert.deepEqual(ids(result), ['GENE_1', 'GENE_2', 'GENE_3']);
  assert.equal(result.shown[1].matchedOn, 'reviewed function category');
  assert.equal(result.shown[1].categoryMatch, 'Photosynthetic light reactions');
  assert.equal(result.shown[2].categoryMatch, null);
  assert.equal(result.shown[2].goMatch.evidenceCode, 'IEA');
});

test('a PCC 7942 or GO IEA source excludes name and product matches; locus tag still works', () => {
  const genes = [{ id: 'M744_RS11720', name: 'rpsL', product: '30S ribosomal protein S12' }];
  for (const source of ['pcc-7942', 'go-iea']) {
    assert.equal(searchGenes(genes, 'rpsL', { source }).total, 0);
    assert.equal(searchGenes(genes, 'ribosomal protein', { source }).total, 0);
    assert.equal(searchGenes(genes, 'M744_RS11720', { source }).total, 1);
  }
  assert.equal(searchGenes(genes, 'rpsL', { source: 'utex-2973' }).total, 1);
  assert.equal(searchGenes(genes, 'rpsL', { source: 'all' }).total, 1);
});

test('reviewed function category suggestions are a UTEX 2973 field: silent for other sources', () => {
  const genes = [{ id: 'GENE_1', product: 'ferredoxin', reviewedFunctionLabels: ['Stress and repair'] }];
  assert.equal(searchGenes(genes, 'stress and repair', { source: 'utex-2973' }).total, 1);
  assert.equal(searchGenes(genes, 'stress and repair', { source: 'all' }).total, 1);
  for (const source of ['pcc-7942', 'go-iea']) {
    assert.equal(searchGenes(genes, 'stress and repair', { source }).total, 0);
  }
});

test('GO ID and GO term name suggestions are silent outside all sources and GO IEA', () => {
  const genes = [{ id: 'GENE_1', product: 'ferredoxin', annotationEvidence: {
    goAnnotations: [{ goId: 'GO:0009773', evidenceCode: 'IEA' }],
  } }];
  const goTerms = { 'GO:0009773': { name: 'photosynthetic electron transport' } };
  assert.equal(searchGenes(genes, 'GO:0009773', { goTerms, source: 'go-iea' }).total, 1);
  assert.equal(searchGenes(genes, 'GO:0009773', { goTerms, source: 'all' }).total, 1);
  for (const source of ['utex-2973', 'pcc-7942']) {
    assert.equal(searchGenes(genes, 'GO:0009773', { goTerms, source }).total, 0);
  }
});

test('every alias points at wording an annotation would plausibly use', () => {
  for (const [key, phrases] of Object.entries(GENE_ALIASES)) {
    assert.ok(Array.isArray(phrases) && phrases.length > 0, `${key} has no expansion`);
    for (const phrase of phrases) {
      assert.equal(typeof phrase, 'string');
      assert.ok(phrase.trim().length > 0, `${key} has an empty expansion`);
    }
  }
});

/**
 * The organism registry, and how an address names an organism.
 *
 * The page resolves its organism twice: in the classic inline script that
 * starts the first downloads before any module runs, and in the module. Both
 * must reach the same data directory, byte for byte, or the early requests are
 * not adopted and the gene file is fetched twice. The last tests here evaluate
 * the page's own script and hold it to the registry.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import {
  DATA_PARAM, DEFAULT_ORGANISM, ORGANISMS, ORGANISM_PARAM, STUDY_LAYER_KEYS,
  approximateGeneCount, canonicalSearch, fillTemplate, layerOf, organismById, organismIdentity,
  organismOf, publishesLayer, repliconByAccession, resolveDataDirectory, resolveOrganism,
  sourceIds, sourceLabels, storageKeys, switchSearch,
} from '../../site/js/core/organisms.js';
import {
  CORE_FILE_KEYS, DATA_FILES, DATA_FILE_BY_KEY, DATA_MANIFEST_NAME, TIER_LABELS, coreFileNames,
  dataFileLabel, dataRequest, normalizeManifest, publishesFile, tierLabelsFor,
} from '../../site/js/core/data-files.js';
import { loadDatasetStaged } from '../../site/js/core/dataset.js';
import { dataDirectoryPath, searchCopy } from '../../site/js/ui/organism-selector.js';

const ECOLI = organismById('ecoli-k12-mg1655');
const MDS42 = organismById('ecoli-mds42-public-reference');
const DH10B = organismById('ecoli-dh10b-public-reference');
const SYN61 = organismById('ecoli-syn61-delta3-ev5');
const PAGE = 'https://example.test/site/';
const SHA = (digit) => digit.repeat(64);

/** Every string anywhere inside a record. */
function strings(value) {
  if (typeof value === 'string') return [value];
  if (value && typeof value === 'object') return Object.values(value).flatMap(strings);
  return [];
}

test('the registry contains five frozen records, the default organism first', () => {
  assert.deepEqual(ORGANISMS.map((organism) => organism.id), [
    'utex2973', 'ecoli-k12-mg1655', 'ecoli-mds42-public-reference',
    'ecoli-dh10b-public-reference', 'ecoli-syn61-delta3-ev5',
  ]);
  assert.equal(DEFAULT_ORGANISM, ORGANISMS[0]);
  assert.deepEqual(ORGANISMS.map((organism) => organism.label), [
    'Cyanobacteria', 'E. coli', 'MDS42 public reference',
    'DH10B public reference', 'E. coli Syn61',
  ]);
  assert.equal(ORGANISM_PARAM, 'org');
  assert.equal(DATA_PARAM, 'data');
  const frozen = (value) => typeof value !== 'object' || value === null
    || (Object.isFrozen(value) && Object.values(value).every(frozen));
  assert.ok(frozen(ORGANISMS), 'no record, and nothing inside one, can be changed at run time');
  assert.equal(organismById('utex2973'), DEFAULT_ORGANISM);
  assert.equal(organismById('nothing'), null);
  assert.equal(organismById(undefined), null);
});

test('every record carries every field a view reads', () => {
  const fields = ['id', 'label', 'species', 'strain', 'shortName', 'title', 'description',
    'dataDirectory', 'storageNamespace', 'handoffStrain', 'genome', 'genomeCitation',
    'citationLabels', 'searchAliases', 'searchAliasExample', 'locusExample', 'freshAxes',
    'annotationSources', 'layers', 'recoding', 'referenceCodonPca', 'copy'];
  const copy = ['tabBlurbs', 'nativeProjectionSummary', 'coordinateEvidenceNote',
    'noAdmittedTrackData', 'directProteomicsLabel', 'goSearchNote', 'metricMethods',
    'metricReading', 'goTermsCaveat'];
  for (const organism of ORGANISMS) {
    for (const field of fields) assert.ok(organism[field] !== undefined, `${organism.id}.${field}`);
    assert.ok('exportTag' in organism);
    for (const field of copy) assert.ok(organism.copy[field], `${organism.id}.copy.${field}`);
    for (const field of ['annotationSourceHint', 'copyNumberNote', 'copyNumberSentence']) {
      assert.ok(field in organism.copy, `${organism.id}.copy.${field} is stated, even as null`);
    }
    const blurbs = ['axes', 'chromosome', 'native', 'regulatory'];
    if (organism.referenceCodonPca) blurbs.push('reference');
    assert.deepEqual(Object.keys(organism.copy.tabBlurbs).sort(), blurbs.sort());
    if (organism.referenceCodonPca) {
      assert.ok(organism.copy.referenceProjectionSummary,
        `${organism.id}.copy.referenceProjectionSummary`);
    }
    assert.deepEqual(Object.keys(organism.copy.metricReading).sort(),
      ['cai', 'expressionProxy', 'tai']);
    assert.equal(organism.genome.replicons.filter((replicon) => replicon.primary).length, 1);
    assert.ok(Object.hasOwn(organism.searchAliases, organism.searchAliasExample));
    assert.ok(organism.dataDirectory.endsWith('/'));
    assert.deepEqual(Object.keys(organism.freshAxes), ['x', 'y']);
    assert.notEqual(organism.freshAxes.x, organism.freshAxes.y, 'never a diagonal fresh view');
    // A codon-usage convention is never a fresh-view axis.
    for (const key of Object.values(organism.freshAxes)) {
      assert.ok(!['cai', 'tai', 'expressionProxy'].includes(key), key);
    }
  }
  assert.equal(new Set(ORGANISMS.map((organism) => organism.dataDirectory)).size, ORGANISMS.length);
  assert.equal(new Set(ORGANISMS.map((organism) => organism.storageNamespace)).size,
    ORGANISMS.length);
});

test('the default organism is the cyanobacterial view the site has always been', () => {
  assert.equal(DEFAULT_ORGANISM.dataDirectory, 'data/');
  assert.equal(DEFAULT_ORGANISM.title, 'Synechococcus elongatus recoding-diversity map');
  assert.equal(DEFAULT_ORGANISM.exportTag, null, 'its export files keep their names');
  assert.deepEqual(organismIdentity(DEFAULT_ORGANISM), {
    id: 'utex2973', label: 'Cyanobacteria', species: 'Synechococcus elongatus',
    strain: 'UTEX 2973', assembly: 'GCF_000817325.1',
  });
  assert.deepEqual(DEFAULT_ORGANISM.annotationSources.map((source) => source.id),
    ['utex-2973', 'pcc-7942', 'go-iea']);
  assert.deepEqual(Object.keys(DEFAULT_ORGANISM.layers).sort(), [...STUDY_LAYER_KEYS].sort(),
    'it declares every study-bound layer');
});

test('E. coli is K-12 MG1655, one circular chromosome, and no study-bound layer', () => {
  assert.equal(ECOLI.dataDirectory, 'data/organisms/ecoli-k12-mg1655/');
  assert.deepEqual(organismIdentity(ECOLI), {
    id: 'ecoli-k12-mg1655', label: 'E. coli', species: 'Escherichia coli',
    strain: 'K-12 MG1655', assembly: 'GCF_000005845.2',
  });
  assert.deepEqual(ECOLI.genome.replicons, [{
    accession: 'NC_000913.3', lengthBp: 4641652, role: 'chromosome', label: 'Chromosome',
    primary: true,
  }]);
  assert.deepEqual(ECOLI.layers, {});
  assert.deepEqual(ECOLI.annotationSources, []);
  assert.equal(ECOLI.exportTag, 'ecoli-k12-mg1655');
  assert.equal(ECOLI.copy.annotationSourceHint, null);
  for (const key of STUDY_LAYER_KEYS) {
    assert.equal(publishesLayer(ECOLI, key), false, key);
    assert.equal(layerOf(ECOLI, key), null);
    assert.equal(publishesLayer(DEFAULT_ORGANISM, key), true, key);
  }
  for (const file of DATA_FILES.filter((entry) => !STUDY_LAYER_KEYS.includes(entry.key))) {
    assert.equal(publishesLayer(ECOLI, file.key), true, `${file.key} is organism-neutral`);
  }
});

test('Syn61 delta 3 ev5 mirrors config metadata and declares only sourced recoding facts', async () => {
  const config = JSON.parse(await readFile(
    new URL('../../config/organisms.json', import.meta.url), 'utf8',
  )).organisms[SYN61.id];
  assert.deepEqual(organismIdentity(SYN61), {
    id: 'ecoli-syn61-delta3-ev5', label: 'E. coli Syn61', species: 'Escherichia coli',
    strain: config.strainIdentity, assembly: config.accession,
  });
  assert.deepEqual(SYN61.genome.replicons, [{
    accession: 'CP116771.1', lengthBp: config.expectedTotalLength,
    role: 'chromosome', label: 'Chromosome', primary: true,
  }]);
  assert.equal(SYN61.dataDirectory, `${config.outputDirectory.replace(/^site\//, '')}/`);
  assert.deepEqual(SYN61.recoding.targets, ['TCA', 'TCG', 'TAG']);
  assert.match(SYN61.recoding.replacements, /TCG → AGC, TCA → AGT, TAG → TAA/);
  assert.match(SYN61.recoding.replacementNote, /does not establish every ev5 replacement event/);
  assert.match(SYN61.copy.nativeProjectionSummary, /refitted.*surviving synonymous variation/i);
  assert.match(SYN61.copy.nativeProjectionSummary, /not parent-fixed axes/i);
  assert.equal(SYN61.referenceCodonPca.parentOrganismId, MDS42.id);
  assert.equal(SYN61.referenceCodonPca.parentSequenceAccession, 'AP012306.1');
  assert.match(SYN61.copy.referenceProjectionSummary, /not.*fitness|do not measure fitness/i);
  assert.deepEqual(SYN61.layers, {});
  assert.deepEqual(SYN61.annotationSources, []);
});

test('public parent records are assembly-pinned and refuse experimental-value claims', async () => {
  const config = JSON.parse(await readFile(
    new URL('../../config/organisms.json', import.meta.url), 'utf8',
  )).organisms;
  for (const [organism, sequence] of [[MDS42, 'AP012306.1'], [DH10B, 'CP000948.1']]) {
    assert.equal(organism.genome.accession, config[organism.id].accession);
    assert.equal(organism.dataDirectory, `${config[organism.id].outputDirectory.replace(/^site\//, '')}/`);
    assert.equal(organism.recoding, null);
    assert.equal(organism.referenceCodonPca, null);
    assert.deepEqual(organism.layers, {});
    assert.ok(strings(organism).some((value) => value.includes(sequence)));
    const copy = strings(organism.copy).join(' ');
    assert.match(copy, /public reference/i);
    assert.match(copy, /no experimental|not experimental|no 2026 experimental/i);
    assert.match(copy, /not.*stock|stock.*not/i);
  }
});

test('nothing in the E. coli record names the cyanobacterial organism or its studies', () => {
  const forbidden = /UTEX|2973|Synechococcus|elongatus|PCC|7942|Tan |GSE205444|M744|cyano|NZ_CP/i;
  for (const text of strings(ECOLI)) assert.ok(!forbidden.test(text), text);
  const reverse = /Escherichia|E\. coli|K-12|MG1655|NC_000913|GCF_000005845/;
  for (const text of strings(DEFAULT_ORGANISM)) assert.ok(!reverse.test(text), text);
});

test('an address names its organism in the query string, and no org means the default', () => {
  assert.deepEqual(resolveOrganism(''),
    { organism: DEFAULT_ORGANISM, requestedId: null, recognised: true });
  assert.deepEqual(resolveOrganism('?load-log'),
    { organism: DEFAULT_ORGANISM, requestedId: null, recognised: true });
  assert.deepEqual(resolveOrganism('?org=ecoli-k12-mg1655'),
    { organism: ECOLI, requestedId: 'ecoli-k12-mg1655', recognised: true });
  assert.deepEqual(resolveOrganism('?org=ecoli-syn61-delta3-ev5'),
    { organism: SYN61, requestedId: 'ecoli-syn61-delta3-ev5', recognised: true });
  assert.equal(resolveOrganism('?org=ecoli-mds42-public-reference').organism, MDS42);
  assert.equal(resolveOrganism('?org=ecoli-dh10b-public-reference').organism, DH10B);
  assert.deepEqual(resolveOrganism('org=ecoli-k12-mg1655&load-min=0').organism, ECOLI);
  assert.deepEqual(resolveOrganism('?org=utex2973'),
    { organism: DEFAULT_ORGANISM, requestedId: 'utex2973', recognised: true });
});

test('an org that names nothing is the default organism, and says it was not recognised', () => {
  for (const id of ['ecoli', 'ECOLI-K12-MG1655', '', 'constructor', '__proto__', 'toString',
    'utex2973 ', '../ecoli-k12-mg1655']) {
    const resolved = resolveOrganism(`?org=${encodeURIComponent(id)}`);
    assert.equal(resolved.organism, DEFAULT_ORGANISM, id);
    assert.equal(resolved.recognised, false, id);
    assert.equal(resolved.requestedId, id);
    assert.equal(resolveDataDirectory(`?org=${encodeURIComponent(id)}`), 'data/',
      'so it can never be handed another organism\'s directory');
  }
});

test('the canonical address: no org for the default, the id for any other', () => {
  // Already canonical: nothing to correct.
  assert.equal(canonicalSearch(''), null);
  assert.equal(canonicalSearch('?load-log'), null);
  assert.equal(canonicalSearch('?org=ecoli-k12-mg1655'), null);
  assert.equal(canonicalSearch('?org=ecoli-k12-mg1655&data=x/'), null);
  // The default spelled out is shortened, and keeps everything else.
  assert.equal(canonicalSearch('?org=utex2973'), '');
  assert.equal(canonicalSearch('?org=utex2973&load-min=0'), '?load-min=0');
  // An org that names nothing is removed: the page shows the default.
  assert.equal(canonicalSearch('?org=nothing'), '');
  assert.equal(canonicalSearch('?load-log=&org=nothing&data=other/'),
    '?load-log=&data=other%2F');
});

test('switching organisms keeps the page\'s other parameters and drops a data override', () => {
  assert.equal(switchSearch('', ECOLI), '?org=ecoli-k12-mg1655');
  assert.equal(switchSearch('?org=ecoli-k12-mg1655', DEFAULT_ORGANISM), '');
  assert.equal(switchSearch('?load-min=0', ECOLI), '?org=ecoli-k12-mg1655&load-min=0');
  assert.equal(switchSearch('?org=ecoli-k12-mg1655&load-min=0', DEFAULT_ORGANISM), '?load-min=0');
  // A data override was written for the organism being left.
  assert.equal(switchSearch('?data=fixtures/', ECOLI), '?org=ecoli-k12-mg1655');
  assert.equal(switchSearch('?org=ecoli-k12-mg1655&data=fixtures/', DEFAULT_ORGANISM), '');
  assert.equal(switchSearch('?org=ecoli-k12-mg1655', ECOLI), '?org=ecoli-k12-mg1655');
  assert.equal(switchSearch('?org=ecoli-k12-mg1655&data=x/', SYN61),
    '?org=ecoli-syn61-delta3-ev5');
});

test('the data directory follows the organism, and ?data= overrides it for either', () => {
  assert.equal(resolveDataDirectory(''), 'data/');
  assert.equal(resolveDataDirectory('?org=utex2973'), 'data/');
  assert.equal(resolveDataDirectory('?org=ecoli-k12-mg1655'), 'data/organisms/ecoli-k12-mg1655/');
  assert.equal(resolveDataDirectory('?org=ecoli-syn61-delta3-ev5'),
    'data/organisms/ecoli-syn61-delta3-ev5/');
  assert.equal(resolveDataDirectory('?org=ecoli-mds42-public-reference'),
    'data/organisms/ecoli-mds42-public-reference/');
  assert.equal(resolveDataDirectory('?org=ecoli-dh10b-public-reference'),
    'data/organisms/ecoli-dh10b-public-reference/');
  assert.equal(resolveDataDirectory('?data=other'), 'other/');
  assert.equal(resolveDataDirectory('?data=other/'), 'other/');
  assert.equal(resolveDataDirectory('?org=ecoli-k12-mg1655&data=../fixtures/x'), '../fixtures/x/');
  // An override changes where the files are, never which organism the page is.
  assert.equal(resolveOrganism('?org=ecoli-k12-mg1655&data=../fixtures/x').organism, ECOLI);
});

test('the cyanobacterial storage keys are the ones this browser already holds', () => {
  assert.deepEqual(storageKeys(DEFAULT_ORGANISM), {
    schemes: 'cyano.schemes.v1',
    shortlist: 'cyano.shortlist.v1',
    compareAxes: 'cyano.compare-axes.v1',
    panelWidths: 'cyano.panel-widths.v1',
    lastView: 'cyano.last-view.v1',
  });
});

test('no storage key is shared between organisms', () => {
  const keys = ORGANISMS.map((organism) => Object.values(storageKeys(organism)));
  const all = keys.flat();
  assert.equal(new Set(all).size, all.length);
  assert.deepEqual(storageKeys(ECOLI), {
    schemes: 'recoding-map.ecoli-k12-mg1655.schemes.v1',
    shortlist: 'recoding-map.ecoli-k12-mg1655.shortlist.v1',
    compareAxes: 'recoding-map.ecoli-k12-mg1655.compare-axes.v1',
    panelWidths: 'recoding-map.ecoli-k12-mg1655.panel-widths.v1',
    lastView: 'recoding-map.ecoli-k12-mg1655.last-view.v1',
  });
  // Nor is one organism's key a prefix of another's, so no scan by prefix can cross.
  for (const organismKeys of keys.slice(1)) {
    for (const key of organismKeys) {
      assert.ok(!key.startsWith(`${DEFAULT_ORGANISM.storageNamespace}.`));
    }
  }
});

test('a dataset is its stamped organism\'s, and a hand-built one is the default\'s', () => {
  assert.equal(organismOf({ organism: ECOLI }), ECOLI);
  assert.equal(organismOf({}), DEFAULT_ORGANISM);
  assert.equal(organismOf(null), DEFAULT_ORGANISM);
  assert.equal(organismOf(undefined), DEFAULT_ORGANISM);
});

test('a replicon is found by its accession across every genome of record', () => {
  assert.equal(repliconByAccession('NC_000913.3').lengthBp, 4641652);
  assert.equal(repliconByAccession('CP116771.1').lengthBp, 3977501);
  assert.equal(repliconByAccession('NZ_CP006471.1').lengthBp, 2690418);
  assert.equal(repliconByAccession('NZ_CP006473.1').lengthBp, 7842);
  assert.equal(repliconByAccession('NC_000913'), null, 'the exact accession, version included');
  assert.equal(repliconByAccession(undefined), null);
});

test('source names and ids are read by role, in precedence order', () => {
  assert.deepEqual(sourceLabels(DEFAULT_ORGANISM), {
    reviewed: 'UTEX 2973', product: 'PCC 7942', go: 'GO IEA',
    precedence: 'UTEX 2973 > PCC 7942 > GO IEA',
    sequence: 'UTEX 2973, then PCC 7942, then GO IEA',
  });
  assert.deepEqual(sourceIds(DEFAULT_ORGANISM),
    { reviewed: 'utex-2973', product: 'pcc-7942', go: 'go-iea' });
  assert.deepEqual(sourceLabels(ECOLI), { precedence: '', sequence: '' });
  assert.deepEqual(sourceIds(ECOLI), {});
  assert.deepEqual(sourceLabels(SYN61), { precedence: '', sequence: '' });
  assert.deepEqual(sourceIds(SYN61), {});
});

test('a record\'s sentence is filled by name, and an unknown name is left as written', () => {
  assert.equal(fillTemplate(' PCC locus {locus}: {status}.', { locus: 'X_1', status: 'essential' }),
    ' PCC locus X_1: essential.');
  assert.equal(fillTemplate('{rows} rows on {date}', { rows: 13 }), '13 rows on {date}');
  assert.equal(fillTemplate('{constructor}', {}), '{constructor}');
  assert.equal(fillTemplate('no slots', { a: 1 }), 'no slots');
});

test('a gene count is rounded for a genome and exact for a handful', () => {
  assert.equal(approximateGeneCount(2715), 'about 2,700');
  assert.equal(approximateGeneCount(4305), 'about 4,300');
  assert.equal(approximateGeneCount(1000), 'about 1,000');
  assert.equal(approximateGeneCount(300), '300');
  assert.equal(approximateGeneCount(NaN), 'an unknown number');
});

test('a file and a tier are named for the organism on screen', () => {
  const tss = DATA_FILE_BY_KEY.tssEvidence;
  assert.equal(dataFileLabel(tss), 'Tan 2018 start sites');
  assert.equal(dataFileLabel(tss, DEFAULT_ORGANISM), 'Tan 2018 start sites');
  assert.equal(dataFileLabel(tss, ECOLI), 'start sites');
  assert.equal(dataFileLabel(DATA_FILE_BY_KEY.genes, ECOLI), 'genes');
  assert.equal(tierLabelsFor(), TIER_LABELS);
  assert.equal(tierLabelsFor(DEFAULT_ORGANISM), TIER_LABELS);
  assert.deepEqual(tierLabelsFor(ECOLI), { ...TIER_LABELS, 2: 'annotation and filters' });
  assert.ok(!/function categor/.test(Object.values(tierLabelsFor(ECOLI)).join(' ')),
    'the bar never says it is loading a layer E. coli does not publish');
});

// --- The page's own inline script, held to the registry -----------------------

async function pageHtml() {
  return readFile(new URL('../../site/index.html', import.meta.url), 'utf8');
}

/**
 * A directory the page can be served from: each file's exact text, and the
 * content manifest whose digests those texts really have, so the loader never
 * retries an address because its body does not match the key it was asked
 * under. `extra` lists files the manifest claims and the directory does not.
 */
function directory(extra = {}) {
  const bodies = {
    'meta.json': '{"file":"meta"}',
    'genes.json': '{"file":"genes"}',
    'function-categories-v1.json': '{"file":"categories"}',
  };
  const manifest = {
    schemaVersion: 1,
    files: {
      ...Object.fromEntries(Object.entries(bodies).map(([name, text]) => [name, {
        bytes: Buffer.byteLength(text),
        sha256: createHash('sha256').update(text).digest('hex'),
      }])),
      ...extra,
    },
  };
  const serve = (url) => (url.includes(DATA_MANIFEST_NAME)
    ? new Response(JSON.stringify(manifest), { status: 200 })
    : new Response(bodies[new URL(url).pathname.split('/').pop()] ?? '{}', { status: 200 }));
  return { bodies, manifest, serve };
}

/** Run the page's early-fetch script at `href` against a fake window. */
async function runEarlyScript(href, { manifest, serve }) {
  const html = await pageHtml();
  const source = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((match) => match[1])
    .find((text) => text.includes('__cyanoEarlyData'));
  const calls = [];
  const fetchFake = (url, init) => {
    calls.push({ url, init });
    return Promise.resolve(url.endsWith(DATA_MANIFEST_NAME)
      ? new Response(JSON.stringify(manifest), { status: 200 }) : serve(url));
  };
  const location = new URL(href);
  const window = { location: { protocol: location.protocol, search: location.search } };
  const document = { baseURI: href, title: DEFAULT_ORGANISM.title };
  // eslint-disable-next-line no-new-func
  new Function('window', 'document', 'fetch', source)(window, document, fetchFake);
  if (window.__cyanoEarlyData) await window.__cyanoEarlyData.ready;
  return { early: window.__cyanoEarlyData, calls, title: document.title };
}

const MANIFEST = directory();

/**
 * What the module's loader actually asks for, for the organism `search` names.
 *
 * The real `loadDatasetStaged` under the real record, not a second reading of
 * its rules: a helper that rebuilt the list from `CORE_FILE_KEYS` would bless
 * exactly the divergence this test exists to catch. The manifest lists only
 * tier 1 files, so every later file is absent without a request and what comes
 * back is the set the inline script has to match. The stub bodies make `core`
 * reject, which says nothing about addresses, so it is caught and the walk
 * waits on `settled`.
 */
async function loaderRequests(search, { serve }) {
  const { organism } = resolveOrganism(search);
  const base = new URL(resolveDataDirectory(search), PAGE);
  const calls = [];
  const fetchImpl = (url, init) => {
    calls.push({ url, init });
    return Promise.resolve(serve(url));
  };
  const staged = loadDatasetStaged({ baseUrl: base, fetchImpl, organism });
  staged.core.catch(() => {});
  await staged.settled;
  return calls;
}

/** Both sides of one address, as a set: adoption is by exact address and option. */
function addresses(calls) {
  return calls.map(({ url, init }) => `${url} ${JSON.stringify(init)}`).sort();
}

test('the inline script and the module ask for the same addresses, for every organism', async () => {
  for (const organism of ORGANISMS) {
    for (const search of [
      organism === DEFAULT_ORGANISM ? '' : `?org=${organism.id}`,
      `?org=${organism.id}`,
      `?load-log&org=${organism.id}&load-min=0`,
    ]) {
      const { early, calls } = await runEarlyScript(`${PAGE}${search}`, MANIFEST);
      const expected = await loaderRequests(search, MANIFEST);
      const where = `${organism.id} at "${search}"`;
      // Address for address and option for option, which is what adoption needs,
      // and nothing else on either side: a request the loader never makes is one
      // nobody adopts, and a layer this organism does not publish must stay
      // absent without a request.
      assert.deepEqual(addresses(calls), addresses(expected), where);
      assert.deepEqual(Object.keys(early.responses).sort(),
        [...new Set(expected.map((call) => call.url))].sort(), where);
      assert.equal(calls[0].url, new URL(DATA_MANIFEST_NAME, `${PAGE}${organism.dataDirectory}`).href,
        'the manifest is asked for first, because it names every other address');
      assert.ok(calls.every((call) => call.url.startsWith(`${PAGE}${organism.dataDirectory}`)),
        `every early request is inside ${organism.dataDirectory}`);
      // The addresses they agree on are this organism's declared tier 1 files.
      assert.deepEqual(calls.slice(1).map((call) => new URL(call.url).pathname.split('/').pop()),
        coreFileNames(organism), where);
    }
  }
});

test('a manifest listing a layer the organism does not declare is still not fetched', async () => {
  // The E. coli record declares no reviewed function categories, so its loader
  // records that layer absent whatever its directory publishes. A deployment
  // whose manifest lists the file anyway must not make the inline script ask
  // for a download the module then ignores.
  const undeclared = STUDY_LAYER_KEYS
    .map((key) => DATA_FILE_BY_KEY[key])
    .filter((file) => !publishesFile(ECOLI, file));
  assert.ok(undeclared.some((file) => file.tier === 1),
    'the case only exists while a study-bound layer loads in tier 1');
  const overfull = directory(Object.fromEntries(undeclared.map((file, index) => (
    [file.name, { bytes: 40 + index, sha256: SHA(String(index)) }]))));
  const search = `?org=${ECOLI.id}`;
  const { calls } = await runEarlyScript(`${PAGE}${search}`, overfull);
  assert.deepEqual(addresses(calls), addresses(await loaderRequests(search, overfull)));
  for (const file of undeclared) {
    assert.ok(!calls.some((call) => call.url.includes(file.name)), file.name);
  }
  assert.deepEqual(calls.slice(1).map((call) => new URL(call.url).pathname.split('/').pop()),
    ['meta.json', 'genes.json']);
});

test('an unknown org is fetched as the default organism by both sides', async () => {
  for (const id of ['nothing', 'constructor', '__proto__', 'hasOwnProperty', '']) {
    const search = `?org=${id}`;
    const { calls, title } = await runEarlyScript(`${PAGE}${search}`, MANIFEST);
    assert.deepEqual(addresses(calls), addresses(await loaderRequests(search, MANIFEST)), id);
    assert.ok(calls.every((call) => call.url.startsWith(`${PAGE}data/`)));
    assert.ok(!calls.some((call) => call.url.includes('organisms/')));
    assert.equal(title, DEFAULT_ORGANISM.title);
  }
});

test('the tier 1 list each side holds is the loader\'s own rule, per organism', () => {
  assert.deepEqual(coreFileNames(DEFAULT_ORGANISM),
    ['meta.json', 'genes.json', 'function-categories-v1.json']);
  assert.deepEqual(coreFileNames(ECOLI), ['meta.json', 'genes.json']);
  assert.deepEqual(coreFileNames(SYN61), ['meta.json', 'genes.json']);
  assert.deepEqual(coreFileNames(MDS42), ['meta.json', 'genes.json']);
  assert.deepEqual(coreFileNames(DH10B), ['meta.json', 'genes.json']);
  assert.deepEqual(coreFileNames(), coreFileNames(DEFAULT_ORGANISM));
  // No organism: a tool reading a directory on its own terms asks for everything.
  assert.deepEqual(coreFileNames(null),
    CORE_FILE_KEYS.map((key) => DATA_FILE_BY_KEY[key].name));
  for (const file of DATA_FILES) {
    assert.equal(publishesFile(null, file), true, file.name);
    const expected = (organism) => file.required || (file.organismField
      ? Boolean(organism[file.organismField]) : publishesLayer(organism, file.key));
    assert.equal(publishesFile(DEFAULT_ORGANISM, file), expected(DEFAULT_ORGANISM), file.name);
    assert.equal(publishesFile(ECOLI, file), expected(ECOLI), file.name);
  }
  assert.equal(publishesFile(ECOLI, DATA_FILE_BY_KEY.genes), true);
  assert.equal(publishesFile(ECOLI, DATA_FILE_BY_KEY.functionCategories), false);
  assert.equal(publishesFile(ECOLI, DATA_FILE_BY_KEY.codonPca), true,
    'an organism-neutral file loads for every organism that publishes it');
  assert.equal(publishesFile(ECOLI, DATA_FILE_BY_KEY.codonPcaReference), false);
  assert.equal(publishesFile(SYN61, DATA_FILE_BY_KEY.codonPcaReference), true);
});

test('the tab is titled for the organism before any module runs', async () => {
  for (const organism of ORGANISMS) {
    const { title } = await runEarlyScript(`${PAGE}?org=${organism.id}`, MANIFEST);
    assert.equal(title, organism.title);
    // Even where the script starts no request: the title is not a download.
    const overridden = await runEarlyScript(`${PAGE}?org=${organism.id}&data=x/`, MANIFEST);
    assert.equal(overridden.title, organism.title);
    assert.equal(overridden.early, undefined, 'an overridden directory is left to the module');
    assert.equal(overridden.calls.length, 0);
  }
});

test('the static page is the default organism\'s, word for word', async () => {
  const html = await pageHtml();
  const text = (pattern) => pattern.exec(html)[1].replace(/\s+/g, ' ').trim();
  assert.equal(text(/<title>([\s\S]*?)<\/title>/), DEFAULT_ORGANISM.title);
  assert.equal(text(/<meta name="description" content="([^"]*)">/), DEFAULT_ORGANISM.description);
  assert.equal(text(/<h1 id="site-title">([\s\S]*?)<\/h1>/), DEFAULT_ORGANISM.title);
  assert.equal(text(/<i id="organism-species">([\s\S]*?)<\/i>/), DEFAULT_ORGANISM.species);
  assert.equal(text(/<span id="organism-strain">([\s\S]*?)<\/span>/), DEFAULT_ORGANISM.strain);
  assert.equal(text(/<p class="visually-hidden" id="annotation-source-hint">([\s\S]*?)<\/p>/),
    'Each checkbox enables one annotation source for function-category colouring and '
      + 'the legend counts only. The detail panel, lists, search, and export always show every source.');
  const search = searchCopy(DEFAULT_ORGANISM);
  assert.equal(text(/<p class="visually-hidden" id="gene-search-hint">([\s\S]*?)<\/p>/), search.hint);
  assert.equal(text(/id="gene-search"[\s\S]*?placeholder="([^"]*)"/), search.placeholder);
  assert.equal(text(/<span id="gene-count-phrase">([\s\S]*?)<\/span>/), approximateGeneCount(2715));
  assert.equal(text(/<code id="data-directory-path">([\s\S]*?)<\/code>/),
    dataDirectoryPath(DEFAULT_ORGANISM));
  assert.match(html, /<nav class="organism-selector" id="organism-selector" aria-label="Organism"><\/nav>/);
});

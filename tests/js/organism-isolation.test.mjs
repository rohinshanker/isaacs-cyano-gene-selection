/**
 * Nothing crosses between organisms.
 *
 * An E. coli view never shows, stores, exports, or claims anything that belongs
 * to the cyanobacterial dataset, and the reverse. Each test here holds one way
 * that could fail: a file read from the wrong directory, a study-bound layer
 * drawn for an organism that never published it, a link or a saved scheme read
 * under the wrong organism, or a sentence that names the other organism.
 *
 * The second organism's data is the generated fixture, loaded through the
 * page's own staged loader under its own registry record.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { loadDatasetStaged } from '../../site/js/core/dataset.js';
import { DATA_MANIFEST_NAME, FILE_STATE } from '../../site/js/core/data-files.js';
import {
  DEFAULT_ORGANISM, ORGANISMS, STUDY_LAYER_KEYS, storageKeys,
} from '../../site/js/core/organisms.js';
import {
  GENOME_OF_RECORD, describeChromosomeView, repliconLength, repliconTracks,
} from '../../site/js/core/chromosome-model.js';
import {
  applyDecoded, decodeState, defaultState, encodeState, viewStateOf,
} from '../../site/js/core/url-state.js';
import { computeLiveMetrics } from '../../site/js/core/live-metrics.js';
import { compileScheme } from '../../site/js/core/scheme.js';
import { buildMetricRegistry } from '../../site/js/core/metric-registry.js';
import { DEFAULT_METRIC_AXES, resolveDefaultMetricAxes } from '../../site/js/core/metric-axes.js';
import { metricHelp } from '../../site/js/core/metric-help.js';
import { projectionHelp } from '../../site/js/core/projection-help.js';
import { geneViewModel } from '../../site/js/core/gene-view-model.js';
import { searchGenes } from '../../site/js/core/gene-search.js';
import { handoffHeader } from '../../site/js/core/rosetta-handoff.js';
import {
  IDENTITY_COLUMNS, buildExport, identityColumnsFor, organismFileTag,
} from '../../site/js/core/export-manifest.js';
import { panelFileBase } from '../../site/js/core/panel-export.js';
import { panelName, panelsFor, tabBlurb } from '../../site/js/ui/panels.js';
import { CHROMOSOME_TAB, ChromosomeView } from '../../site/js/ui/chromosome-view.js';
import { LENGTH_TAB } from '../../site/js/ui/length-explorer.js';
import { REGULATORY_TAB, RegulatorySitesPanel } from '../../site/js/ui/regulatory-sites.js';
import { STRAIN_FITNESS_TAB, StrainFitnessPanel, UNAVAILABLE_TEXT }
  from '../../site/js/ui/strain-fitness.js';
import { CITATIONS_TAB } from '../../site/js/ui/citations.js';
import { TRNA_TAB } from '../../site/js/ui/trna-viewer.js';
import { describeGeneView, renderGeneViewer } from '../../site/js/ui/gene-viewer.js';
import { renderMetricHelp } from '../../site/js/ui/metric-help.js';
import { describeLoad } from '../../site/js/ui/load-progress.js';
import { tierLabelsFor } from '../../site/js/core/data-files.js';
import {
  lastViewHash, rememberView, searchCopy, switchHref,
} from '../../site/js/ui/organism-selector.js';
import { withFakeDocument } from './fake-dom.mjs';
import {
  ECOLI, ECOLI_DATA_URL, FIXTURE_DIR, ecoliAnnotatedFixtureDataset, ecoliAnnotatedFixtureFiles,
  ecoliFixtureDataset, ecoliFixtureFiles, fixtureDataset, memoryDirectory,
} from './helpers.mjs';
import { annotationEvidenceModel } from '../../site/js/core/annotation-evidence.js';

/** Anything that names the cyanobacterial organism, a sister strain, or one of its studies. */
const CYANOBACTERIAL = /UTEX|Synechococcus|elongatus|PCC|pcc-?7942|Tan (?:et al\.? )?2018|Tan et al|GSE205444|M744_|NZ_CP|cyanobacteri/i;
/** Anything that names E. coli, its strain, its assembly, or one of its loci. */
const ECOLI_TERMS = /Escherichia|E\. coli|K-12|MG1655|NC_000913|GCF_000005845|\bb\d{4}\b/;
/** A finding about a layer nobody looked for. */
const NEGATIVE_CLAIM = /No .*start site maps|no mapped TSS|No supported .* call/i;

/** A dataset with its metric registry, as the page holds them. */
function withRegistry(dataset) {
  const live = computeLiveMetrics(dataset, compileScheme({}, dataset.table)).fields;
  return { dataset, registry: buildMetricRegistry(dataset.meta, dataset.genes, live) };
}

/** An in-memory `localStorage` behind the page's degrading `store` interface. */
function memoryStore() {
  const values = new Map();
  return {
    values,
    read: (key, fallback) => (values.has(key) ? JSON.parse(values.get(key)) : fallback),
    write: (key, value) => {
      values.set(key, JSON.stringify(value));
      return true;
    },
  };
}

// --- The loader -----------------------------------------------------------

test('the second organism loads from its own directory, every optional layer absent', async () => {
  const { fetchImpl, requested } = memoryDirectory(ECOLI_DATA_URL, ecoliFixtureFiles());
  const staged = loadDatasetStaged({ baseUrl: ECOLI_DATA_URL, fetchImpl, organism: ECOLI });
  const dataset = await staged.core;
  await staged.settled;
  assert.equal(dataset.organism, ECOLI);
  assert.equal(dataset.genes.length, 120);
  assert.ok(dataset.genes.every((gene) => /^b\d{4}$/.test(gene.id)));
  assert.deepEqual([...new Set(dataset.genes.map((gene) => gene.seqid))], ['NC_000913.3']);
  assert.deepEqual(dataset.meta.genome,
    { accession: 'GCF_000005845.2', taxid: 511145, totalLength: 4641652 });
  // Exactly the files the loader has an entry for, each once, and nothing else.
  assert.deepEqual([...requested].sort(),
    [DATA_MANIFEST_NAME, 'codon_pca.json', 'excluded.json', 'genes.json', 'meta.json'].sort());
  // The RSCU payload is published and described by the manifest, and the page
  // still never asks for it: nothing in the browser reads a per-gene vector, so
  // it has no loader entry and joins no tier.
  const manifest = JSON.parse(ecoliFixtureFiles()[DATA_MANIFEST_NAME]);
  assert.ok('codon_rscu.json' in manifest.files);
  assert.ok(!requested.includes('codon_rscu.json'));
  const states = Object.fromEntries(Object.entries(dataset.files)
    .map(([key, record]) => [key, record.state]));
  for (const key of ['meta', 'genes', 'codonPca', 'excluded']) {
    assert.equal(states[key], FILE_STATE.READY, key);
  }
  for (const key of [...STUDY_LAYER_KEYS, 'annotations', 'lengthCohorts', 'goTerms']) {
    assert.equal(states[key], FILE_STATE.ABSENT, `${key} is absent, not failed and not loading`);
  }
  assert.equal(dataset.functionCategories, null);
  assert.ok(dataset.genes.every((gene) => gene.tssEvidence === undefined),
    'no start-site list is joined, so no gene can be said to have none');
});

test('a study-bound file is never requested for an organism that does not declare it', async () => {
  // The directory holds, and its manifest lists, files named like every
  // cyanobacterial study layer. They are not this organism's evidence.
  const stray = Object.fromEntries(['function-categories-v1.json', 'candidate_evidence.json',
    'source-derived-categories-v1.json', 'tss_evidence.json', 'go-iea-essentiality-v1.json',
    'regulatory_tss.json'].map((name) => [name, '{"stray": true}']));
  const files = { ...ecoliFixtureFiles(), ...stray };
  const manifest = JSON.parse(files[DATA_MANIFEST_NAME]);
  for (const name of Object.keys(stray)) {
    manifest.files[name] = { bytes: stray[name].length, sha256: 'f'.repeat(64) };
  }
  files[DATA_MANIFEST_NAME] = JSON.stringify(manifest);

  const gated = memoryDirectory(ECOLI_DATA_URL, files);
  const staged = loadDatasetStaged({
    baseUrl: ECOLI_DATA_URL, fetchImpl: gated.fetchImpl, organism: ECOLI,
  });
  const dataset = await staged.core;
  await staged.settled;
  for (const name of Object.keys(stray)) {
    assert.ok(!gated.requested.includes(name), `${name} was not asked for`);
  }
  for (const key of STUDY_LAYER_KEYS) {
    assert.equal(dataset.files[key].state, FILE_STATE.ABSENT, key);
    assert.equal(dataset.files[key].bytes, 0, `${key} is not counted in the loading bar`);
  }
  // The same directory, loaded for an organism that does declare the layers,
  // is asked for them: the gate is the organism's record and nothing else.
  const open = memoryDirectory(ECOLI_DATA_URL, files);
  const ungated = loadDatasetStaged({ baseUrl: ECOLI_DATA_URL, fetchImpl: open.fetchImpl });
  await ungated.core.catch(() => {});
  await ungated.settled;
  assert.ok(open.requested.includes('function-categories-v1.json'));
});

test('a directory that holds another organism\'s assembly is refused, in both directions', async () => {
  const cyano = async (url) => {
    const name = new URL(url).pathname.split('/').pop();
    try {
      return new Response(await readFile(`${FIXTURE_DIR}/${name}`, 'utf8'), { status: 200 });
    } catch {
      return new Response('', { status: 404 });
    }
  };
  const base = 'https://example.test/site/data/';
  // Cyanobacterial data under an address that names E. coli.
  await assert.rejects(loadDatasetStaged({ baseUrl: base, fetchImpl: cyano, organism: ECOLI }).core,
    /this data directory holds assembly GCF_000817325\.1, not GCF_000005845\.2, the genome of record for E\. coli/);
  // E. coli data under the default address.
  const ecoli = memoryDirectory(ECOLI_DATA_URL, ecoliFixtureFiles());
  const wrong = loadDatasetStaged({
    baseUrl: ECOLI_DATA_URL, fetchImpl: ecoli.fetchImpl, organism: DEFAULT_ORGANISM,
  });
  await assert.rejects(wrong.core,
    /holds assembly GCF_000005845\.2, not GCF_000817325\.1, the genome of record for Cyanobacteria/);
  assert.equal(wrong.files.meta.state, FILE_STATE.FAILED, 'a failed core load, never a drawn page');
  // A directory with no assembly at all is refused too.
  const files = { ...ecoliFixtureFiles() };
  const meta = JSON.parse(files['meta.json']);
  delete meta.genome;
  files['meta.json'] = JSON.stringify(meta);
  delete files[DATA_MANIFEST_NAME];
  const bare = memoryDirectory(ECOLI_DATA_URL, files);
  await assert.rejects(
    loadDatasetStaged({ baseUrl: ECOLI_DATA_URL, fetchImpl: bare.fetchImpl, organism: ECOLI }).core,
    /holds assembly none, not GCF_000005845\.2/,
  );
  // With no organism the loader checks nothing and stamps nothing, which is how
  // a tool loads a directory on its own terms.
  const free = loadDatasetStaged({ baseUrl: base, fetchImpl: cyano });
  assert.equal((await free.core).organism, undefined);
  await free.settled;
});

// --- The replicon model ---------------------------------------------------

test('the E. coli genome of record is one chromosome, checked against its metadata', async () => {
  const dataset = await ecoliFixtureDataset();
  const { tracks, verified, problems, plottedCount } = repliconTracks(
    dataset.genes, dataset.meta, ECOLI.genome,
  );
  assert.deepEqual(problems, []);
  assert.equal(verified, true);
  assert.equal(tracks.length, 1);
  assert.equal(tracks[0].accession, 'NC_000913.3');
  assert.equal(tracks[0].lengthBp, 4641652);
  assert.equal(tracks[0].primary, true);
  assert.equal(tracks[0].cdsCount, dataset.genes.length);
  assert.equal(plottedCount, dataset.genes.length);
  assert.equal(repliconLength('NC_000913.3'), 4641652);
  assert.equal(repliconLength('NZ_CP006471.1'), 2690418, 'the cyanobacterial lengths are unchanged');
  assert.equal(repliconLength('NC_000000.1'), null);
});

test('the replicon model refuses metadata that is not its organism\'s', async () => {
  const dataset = await ecoliFixtureDataset();
  const cyano = await fixtureDataset();
  // The wrong assembly, the wrong total, and no genome at all.
  for (const [meta, pattern] of [
    [{ genome: { accession: 'GCF_000005845.1', totalLength: 4641652 } },
      /declares assembly GCF_000005845\.1, not the GCF_000005845\.2 genome of record/],
    [{ genome: { accession: 'GCF_000005845.2', totalLength: 4639675 } },
      /total 4,641,652 bp, but this dataset reports 4,639,675 bp/],
    [{}, /declares assembly none/],
  ]) {
    const result = repliconTracks(dataset.genes, meta, ECOLI.genome);
    assert.equal(result.verified, false);
    assert.match(result.problems.join(' '), pattern);
  }
  // One organism's genes on the other's axes, each way.
  const crossed = repliconTracks(cyano.genes, cyano.meta, ECOLI.genome);
  assert.equal(crossed.verified, false);
  assert.equal(crossed.plottedCount, 0);
  assert.match(crossed.problems.join(' '), /is not a replicon of the genome of record/);
  const reverse = repliconTracks(dataset.genes, dataset.meta, GENOME_OF_RECORD);
  assert.equal(reverse.verified, false);
  assert.equal(reverse.plottedCount, 0);
  // The default argument is still the cyanobacterial genome.
  assert.deepEqual(repliconTracks(dataset.genes, dataset.meta), reverse);
});

// --- The link -------------------------------------------------------------

/** Links the cyanobacterial view has written, across its encoder versions. */
const CYANOBACTERIAL_LINKS = [
  '',
  '#ver=6&p=native&c=functionCategory&l=&t=radar',
  '#ver=6&p=axes&c=cai&s=TAG-TAA.TCG-AGC&n=Syn61&csc=linear&l=&t=radar',
  '#ver=6&p=native&c=functionCategory&l=M744_RS00005%2CM744_RS00045&g=M744_RS00045&t=table',
  '#ver=6&p=chromosome&c=tssInitiation&csc=log10&l=M744_RS00005&g=M744_RS00005&t=radar&dt=lowest',
  '#ver=6&p=native&c=functionCategory&cf=photosynthesis,translation&cs=utex-2973,go-iea&l=&t=radar',
  '#ver=6&p=native&c=functionCategory&cs=none&l=&t=radar&po=scheme,filters,gene-viewer&pc=none',
  '#ver=5&p=native&c=cai&l=&t=radar&cm=cai,tai',
  '#ver=4&p=axes&c=gc3&cs=pcc-7942&ax=lengthNt&ay=tai&xs=log10&l=&t=radar',
  '#ver=3&p=native&c=cai&as=pcc-7942&l=M744_RS00005',
  '#ver=2&p=axes&c=cai&l=',
  '#p=umap&c=tai&f=cai:0.2:0.9,lengthNt::3000:0&k=expression&e=only&m=measured&v=0&pr=refseq&lc=cds',
  '#ver=6&p=lengths&c=cai&l=&t=radar&x=1',
  '#ver=6&p=regulatory&c=cai&l=&t=radar',
];

test('every existing cyanobacterial link decodes exactly as before', () => {
  for (const link of CYANOBACTERIAL_LINKS) {
    // Naming the default organism changes nothing about how a link is read.
    assert.deepEqual(decodeState(link, DEFAULT_ORGANISM), decodeState(link), link);
    const plain = applyDecoded(defaultState(), decodeState(link));
    const named = applyDecoded(defaultState(DEFAULT_ORGANISM), decodeState(link, DEFAULT_ORGANISM),
      DEFAULT_ORGANISM);
    assert.deepEqual(named, plain, link);
    assert.equal(encodeState(named, DEFAULT_ORGANISM), encodeState(plain), link);
  }
  // Three of them pinned field by field: a scheme, a pinned gene with a
  // shortlist, and the chromosome tab.
  assert.deepEqual(decodeState(CYANOBACTERIAL_LINKS[2]), {
    version: 6, panel: 'axes', colorBy: 'cai', colorScale: 'linear',
    schemeMap: { TAG: 'TAA', TCG: 'AGC' }, schemeName: 'Syn61', shortlist: [], compareTab: 'radar',
  });
  assert.deepEqual(decodeState(CYANOBACTERIAL_LINKS[3]), {
    version: 6, panel: 'native', colorBy: 'functionCategory',
    shortlist: ['M744_RS00005', 'M744_RS00045'], pinnedId: 'M744_RS00045', compareTab: 'table',
  });
  assert.deepEqual(decodeState(CYANOBACTERIAL_LINKS[4]), {
    version: 6, panel: 'chromosome', colorBy: 'tssInitiation', colorScale: 'log10',
    shortlist: ['M744_RS00005'], pinnedId: 'M744_RS00005', compareTab: 'radar', drawOnTop: 'lowest',
  });
  assert.deepEqual(decodeState(CYANOBACTERIAL_LINKS[5]).colorSources, ['utex-2973', 'go-iea']);
  assert.deepEqual(decodeState(CYANOBACTERIAL_LINKS[6]).colorSources, []);
  assert.deepEqual(defaultState().colorSources, ['utex-2973', 'pcc-7942', 'go-iea']);
});

test('a link is read under the organism its address names', () => {
  // E. coli has no colour source, so a fresh view has none and writes none.
  const fresh = defaultState(ECOLI);
  assert.deepEqual(fresh.colorSources, []);
  assert.ok(!/(?:^|&)cs=/.test(encodeState(fresh, ECOLI)));
  assert.deepEqual(viewStateOf(fresh, ECOLI).colorSources, []);
  // A cyanobacterial source id in a link opened under E. coli names nothing.
  for (const link of ['#cs=utex-2973', '#cs=pcc-7942,go-iea', '#cs=all']) {
    const state = applyDecoded(defaultState(ECOLI), decodeState(link, ECOLI), ECOLI);
    assert.deepEqual(state.colorSources, [], link);
    assert.ok(!CYANOBACTERIAL.test(encodeState(state, ECOLI)), link);
  }
  // The reverse: nothing of E. coli's can widen the cyanobacterial source set.
  assert.deepEqual(decodeState('#cs=ecoli', DEFAULT_ORGANISM).colorSources, undefined);
  // Everything that is not an organism fact reads the same under either, and
  // an E. coli link round-trips through its own encoder unchanged.
  const link = '#ver=7&p=umap&c=cai&s=TAG-TAA&n=amber&csc=linear&l=b0001%2Cb0002&g=b0002&t=table';
  assert.deepEqual(decodeState(link, ECOLI), decodeState(link));
  assert.equal(encodeState(applyDecoded(defaultState(ECOLI), decodeState(link, ECOLI), ECOLI), ECOLI),
    link.slice(1));
});

test('each organism opens Metric X vs Y on its own axes, and a link omits only its own', async () => {
  // The default organism's are the measured pair they have always been.
  assert.deepEqual(DEFAULT_ORGANISM.freshAxes, { x: 'lengthNt', y: 'tssInitiation' });
  assert.equal(DEFAULT_METRIC_AXES, DEFAULT_ORGANISM.freshAxes);
  assert.deepEqual([defaultState().axisX, defaultState().axisY], ['lengthNt', 'tssInitiation']);
  // E. coli publishes no measurement, so its pair is two sequence facts.
  assert.deepEqual(ECOLI.freshAxes, { x: 'lengthNt', y: 'gc3' });
  const fresh = defaultState(ECOLI);
  assert.deepEqual([fresh.axisX, fresh.axisY], ['lengthNt', 'gc3']);
  assert.ok(!/(?:^|&)a[xy]=/.test(encodeState(fresh, ECOLI)), 'its own default leaves no field');
  // The other organism's default is not its default, so it is written out.
  assert.match(encodeState({ ...fresh, axisY: 'tssInitiation' }, ECOLI), /&ay=tssInitiation(?:&|$)/);
  assert.match(encodeState({ ...defaultState(), axisY: 'gc3' }), /&ay=gc3(?:&|$)/);
  // Resolved against the dataset, so a declared axis the release lacks is never drawn.
  const { registry } = withRegistry(await ecoliFixtureDataset());
  assert.deepEqual(resolveDefaultMetricAxes(registry, ECOLI.freshAxes), { x: 'lengthNt', y: 'gc3' });
  assert.ok(!registry.byKey.has('tssInitiation'));
  const fallback = resolveDefaultMetricAxes(registry);
  assert.equal(fallback.x, 'lengthNt');
  assert.ok(registry.byKey.has(fallback.y) && fallback.y !== 'tssInitiation');
});

// --- Saved state ----------------------------------------------------------

test('a scheme, a shortlist, or a metric set saved under one organism is invisible to the other', () => {
  const [cyano, ecoli] = [storageKeys(DEFAULT_ORGANISM), storageKeys(ECOLI)];
  for (const [writer, reader] of [[cyano, ecoli], [ecoli, cyano]]) {
    const store = memoryStore();
    store.write(writer.schemes, { amber: { TAG: 'TAA' } });
    store.write(writer.shortlist, ['a-locus']);
    store.write(writer.compareAxes, ['cai', 'tai']);
    store.write(writer.panelWidths, { left: 300, right: 340 });
    store.write(writer.lastView, 'ver=6&p=umap');
    // Read back through the other organism's keys: nothing, in every field.
    assert.deepEqual(store.read(reader.schemes, {}), {});
    assert.deepEqual(store.read(reader.shortlist, []), []);
    assert.equal(store.read(reader.compareAxes, null), null);
    assert.equal(store.read(reader.panelWidths, null), null);
    assert.equal(store.read(reader.lastView, ''), '');
    // And still there under its own.
    assert.deepEqual(store.read(writer.schemes, {}), { amber: { TAG: 'TAA' } });
    assert.deepEqual(store.read(writer.shortlist, []), ['a-locus']);
  }
});

test('the page keeps every stored value under its organism\'s own keys', async () => {
  const app = await readFile(new URL('../../site/js/app.js', import.meta.url), 'utf8');
  assert.match(app, /const STORAGE = storageKeys\(organism\);/);
  assert.match(app, /const STORAGE_SCHEMES = STORAGE\.schemes;/);
  assert.match(app, /const STORAGE_SHORTLIST = STORAGE\.shortlist;/);
  assert.match(app, /const STORAGE_COMPARE_AXES = STORAGE\.compareAxes;/);
  assert.match(app, /storageKey: STORAGE\.panelWidths,/);
  // No key is spelled in the page, so none can be shared by accident, and the
  // browser's storage is reached through the one `store` and nowhere else.
  assert.ok(!/['"`](?:cyano|recoding-map)\.[\w.-]+\.v\d+['"`]/.test(app));
  assert.equal(app.match(/localStorage\./g).length, 2, 'one read and one write, inside `store`');
  assert.ok(!/sessionStorage/.test(app));
  // The view an organism is left in is written as the address is, and never
  // read back by the page itself: only the selector's link carries it, so a
  // bare link opens that organism's fresh view.
  assert.match(app, /const hash = encodeState\(state, organism\);\s*\/\/[^\n]*\n\s*rememberView\(store, organism, hash\);/);
  assert.ok(!/lastViewHash|STORAGE\.lastView/.test(app));
});

test('each organism remembers its own last view, and a bare link opens fresh', () => {
  const store = memoryStore();
  const cyanoPage = { pathname: '/site/', search: '' };
  const ecoliPage = { pathname: '/site/', search: '?org=ecoli-k12-mg1655' };
  // Nothing remembered yet: switching opens the other organism's fresh view.
  assert.equal(switchHref(cyanoPage, ECOLI, store), '/site/?org=ecoli-k12-mg1655');
  assert.equal(switchHref(ecoliPage, DEFAULT_ORGANISM, store), '/site/');
  assert.equal(lastViewHash(store, ECOLI), '');

  rememberView(store, DEFAULT_ORGANISM, 'ver=6&p=chromosome&l=M744_RS00005&g=M744_RS00005');
  rememberView(store, ECOLI, '#ver=6&p=umap&l=b0001&g=b0001');
  // Each returns to its own view, and neither sees the other's.
  assert.equal(switchHref(cyanoPage, ECOLI, store),
    '/site/?org=ecoli-k12-mg1655#ver=6&p=umap&l=b0001&g=b0001');
  assert.equal(switchHref(ecoliPage, DEFAULT_ORGANISM, store),
    '/site/#ver=6&p=chromosome&l=M744_RS00005&g=M744_RS00005');
  assert.ok(!ECOLI_TERMS.test(lastViewHash(store, DEFAULT_ORGANISM)));
  assert.ok(!CYANOBACTERIAL.test(lastViewHash(store, ECOLI)));
  // Leaving a view updates only that organism's memory.
  rememberView(store, ECOLI, 'ver=6&p=native');
  assert.equal(lastViewHash(store, ECOLI), 'ver=6&p=native');
  assert.equal(lastViewHash(store, DEFAULT_ORGANISM),
    'ver=6&p=chromosome&l=M744_RS00005&g=M744_RS00005');
  // A switch keeps the page's own parameters and drops a data override.
  assert.equal(switchHref({ pathname: '/', search: '?data=x/&load-min=0' }, ECOLI, store),
    '/?org=ecoli-k12-mg1655&load-min=0#ver=6&p=native');
  // A stored value that is not a string is not a view.
  store.write(storageKeys(ECOLI).lastView, { not: 'a hash' });
  assert.equal(lastViewHash(store, ECOLI), '');
  assert.equal(switchHref(cyanoPage, ECOLI, store), '/site/?org=ecoli-k12-mg1655');
});

// --- What each view says --------------------------------------------------

/**
 * Every sentence a view of `dataset` can be made to say without a browser:
 * tab blurbs, metric and map explanations with their citations, the gene
 * visualizer and its description, the chromosome view's description and
 * conventions, the search copy, the loading bar's words, the regulatory tab,
 * a hand-off header, and a complete export with its file names.
 */
async function everythingSaid(dataset, registry, organism) {
  const said = [];
  const panels = panelsFor(organism);
  const tabs = [...panels.slice(0, 2), CHROMOSOME_TAB, TRNA_TAB, ...panels.slice(2), LENGTH_TAB, REGULATORY_TAB, STRAIN_FITNESS_TAB, CITATIONS_TAB];
  for (const tab of tabs) {
    said.push(`${panelName(tab, organism)}. ${tabBlurb(tab, organism)} ${tab.source ?? ''}`);
  }
  for (const metric of registry.metrics) said.push(JSON.stringify(metricHelp(metric, dataset)));
  for (const panel of panels) {
    said.push(JSON.stringify(projectionHelp(panel.id, dataset, registry,
      { x: 'lengthNt', y: 'cai' })));
  }
  const genes = dataset.genes.slice(0, 12);
  for (const gene of genes) said.push(describeGeneView(geneViewModel(gene), null, organism));
  const { tracks } = repliconTracks(dataset.genes, dataset.meta, organism.genome);
  said.push(describeChromosomeView({
    tracks, window: { from: 1, to: tracks[0].lengthBp }, colorLabel: 'CAI',
    passing: dataset.genes.length, total: dataset.genes.length,
    copyNumberSentence: organism.copy.copyNumberSentence,
  }));
  said.push(ChromosomeView.prototype.markerConventions.call({
    organism,
    model: {
      colors: { values: null, scale: null }, mask: null, genes: [], showHidden: true,
      tssPending: null,
    },
  }));
  said.push(organism.copy.coordinateEvidenceNote, organism.copy.copyNumberNote ?? '');
  const search = searchCopy(organism);
  said.push(search.placeholder, search.hint);
  for (const query of ['ribosome', 'rubisco', 'rnap', 'atp synthase']) {
    const result = searchGenes(dataset.genes, query, { aliases: organism.searchAliases });
    said.push(result.aliasesUsed.join(' '));
  }
  for (const tier of [1, 2, 3, 4]) {
    said.push(describeLoad({ currentTier: tier, receivedBytes: 1, totalBytes: 2 }, null, null,
      tierLabelsFor(organism)));
  }
  said.push(handoffHeader({
    locus: genes[0].id, strain: organism.handoffStrain, form: 'wildtype', schemeName: 'none',
    region: 'cds', siteVersion: dataset.meta.builtAt,
  }));
  await withFakeDocument(() => {
    for (const gene of genes) {
      const host = document.createElement('div');
      renderGeneViewer(host, gene, { organism });
      said.push(host.textContent);
      said.push(...host.querySelectorAll('svg').map((node) => node.getAttribute('aria-label')));
      said.push(...host.querySelectorAll('title').map((node) => node.textContent));
    }
    const regulatory = document.createElement('div');
    new RegulatorySitesPanel(regulatory, { onShowGene() {}, organism }).update(
      dataset.regulatoryTss ?? null, null,
    );
    said.push(regulatory.textContent);
    // An organism with no admitted whole-strain catalogue says only that the
    // measurements are unavailable; nothing is borrowed across organisms.
    const fitness = document.createElement('div');
    new StrainFitnessPanel(fitness, { organism }).update({
      catalogue: [], selection: null, resource: null,
    });
    assert.equal(fitness.textContent, UNAVAILABLE_TEXT);
    said.push(fitness.textContent);
    for (const metric of registry.metrics.slice(0, 6)) {
      const details = document.createElement('details');
      const summary = document.createElement('summary');
      const body = document.createElement('div');
      body.className = 'help-content';
      details.append(summary, body);
      renderMetricHelp(details, metricHelp(metric, dataset), null, organism);
      said.push(details.textContent);
    }
  });
  const exported = buildExport({
    dataset, registry, ids: genes.map((gene) => gene.id),
    schemes: [{ name: 'amber', map: { TAG: 'TAA' } }],
    generatedAt: new Date('2026-10-05T12:00:00Z'),
    viewState: viewStateOf(defaultState(organism), organism),
    colorSources: defaultState(organism).colorSources,
  });
  said.push(JSON.stringify(exported.manifest), exported.csv, exported.baseName,
    ...exported.files.map((file) => file.name), exported.columns.join(','));
  return { said: said.filter(Boolean), exported };
}

test('the E. coli view makes no cyanobacterial claim, in any description, key, or export', async () => {
  const { dataset, registry } = withRegistry(await ecoliFixtureDataset());
  const { said, exported } = await everythingSaid(dataset, registry, ECOLI);
  assert.ok(said.length > 100, `the sweep reaches every surface (${said.length} texts)`);
  for (const text of said) {
    const hit = CYANOBACTERIAL.exec(text);
    assert.equal(hit, null, hit ? `"${text.slice(Math.max(0, hit.index - 60), hit.index + 60)}"` : '');
    assert.ok(!NEGATIVE_CLAIM.test(text), text.slice(0, 200));
  }
  // It does say what it is.
  assert.ok(said.some((text) => /E\. coli K-12 MG1655 RefSeq release/.test(text)));
  // The export names its organism, in the manifest and in every file name.
  assert.deepEqual(exported.manifest.organism, {
    id: 'ecoli-k12-mg1655', label: 'E. coli', species: 'Escherichia coli',
    strain: 'K-12 MG1655', assembly: 'GCF_000005845.2',
  });
  assert.equal(exported.manifest.dataset.genome.accession, 'GCF_000005845.2');
  assert.match(exported.baseName, /^recoding-candidates_ecoli-k12-mg1655_amber_20261005T120000Z_[0-9a-f]{10}$/);
  assert.ok(exported.files.every((file) => file.name.startsWith('recoding-candidates_ecoli-k12-mg1655_')));
  // No column, manifest key, or caveat of a layer E. coli does not publish.
  for (const column of ['functionCategory', 'pcc7942DerivedCategory', 'goIeaDerivedCategory',
    'tssInitiationBasis', 'tssMappedSiteCount', 'pcc7942Essentiality', 'essentialityEvidenceTier',
    'annotationDiscrepancies']) {
    assert.ok(!exported.columns.includes(column), column);
    assert.ok(exported.rows.every((row) => !(column in row)), column);
  }
  for (const key of ['tssEvidenceSource', 'candidateEvidence', 'goIeaEssentiality',
    'sourceDerivedCategories', 'functionCategories']) {
    assert.ok(!(key in exported.manifest.dataset), key);
  }
  assert.ok(!('functionColourSources' in exported.manifest));
  assert.deepEqual(Object.keys(exported.manifest.genes[0]).sort(), ['cdsSegments', 'expressionBasis',
    'goAnnotations', 'id', 'name', 'product', 'terminalStop', 'translationalException']);
  assert.ok(exported.manifest.caveats.every((caveat) => !/TSS|essential|function-category/i.test(caveat)));
  assert.deepEqual(identityColumnsFor(ECOLI), exported.columns.slice(0, identityColumnsFor(ECOLI).length));
});

test('the cyanobacterial view makes no E. coli claim, and its export is the one it always wrote', async () => {
  const { dataset, registry } = withRegistry(await fixtureDataset());
  const { said, exported } = await everythingSaid(dataset, registry, DEFAULT_ORGANISM);
  for (const text of said) {
    const hit = ECOLI_TERMS.exec(text);
    assert.equal(hit, null, hit ? `"${text.slice(Math.max(0, hit.index - 60), hit.index + 60)}"` : '');
  }
  // Every identity column is still written, and the file name is unchanged.
  assert.deepEqual(identityColumnsFor(DEFAULT_ORGANISM), [...IDENTITY_COLUMNS]);
  assert.deepEqual(exported.columns.slice(0, IDENTITY_COLUMNS.length), [...IDENTITY_COLUMNS]);
  assert.match(exported.baseName, /^recoding-candidates_amber_20261005T120000Z_[0-9a-f]{10}$/);
  // The one addition: the manifest says which organism it is.
  assert.deepEqual(exported.manifest.organism, {
    id: 'utex2973', label: 'Cyanobacteria', species: 'Synechococcus elongatus',
    strain: 'UTEX 2973', assembly: 'GCF_000817325.1',
  });
  assert.ok('functionColourSources' in exported.manifest);
  for (const key of ['tssEvidenceSource', 'candidateEvidence', 'goIeaEssentiality',
    'sourceDerivedCategories', 'functionCategories']) {
    assert.ok(key in exported.manifest.dataset, key);
  }
  // It still says what it always said about a gene with no mapped start site.
  assert.ok(said.some((text) => /No Tan 2018 start site maps to this locus by exact locus tag\./.test(text)));
});

test('an export file is tagged for every organism but the default', () => {
  const manifest = (id) => ({
    organism: id ? { id } : undefined,
    schemes: [{ schemeId: 'scheme:TAG.TAA', name: null }],
    generatedAt: '2026-10-05T12:00:00.000Z', manifestId: '0123456789abcdef',
    panelDesign: { size: 8 },
  });
  assert.equal(organismFileTag(manifest('utex2973')), '');
  assert.equal(organismFileTag(manifest('ecoli-k12-mg1655')), '_ecoli-k12-mg1655');
  // A manifest written before the field existed, or naming nothing known, is untagged.
  assert.equal(organismFileTag(manifest(null)), '');
  assert.equal(organismFileTag(manifest('nothing')), '');
  assert.equal(panelFileBase(manifest('utex2973')),
    'gene-panel_8-genes_TAG+TAA_20261005T120000Z_0123456789');
  assert.equal(panelFileBase(manifest('ecoli-k12-mg1655')),
    'gene-panel_ecoli-k12-mg1655_8-genes_TAG+TAA_20261005T120000Z_0123456789');
  for (const organism of ORGANISMS) {
    assert.equal(organismFileTag({ organism: { id: organism.id } }),
      organism.exportTag ? `_${organism.exportTag}` : '');
  }
});

// --- The annotated release ------------------------------------------------
//
// The first E. coli release is sequence only. Its annotation layer is published
// next, and `annotations.json` with `go-term-names-v1.json` are the two files
// that arrive with it: organism-neutral files, so they load for any organism
// that publishes them, with no record change at all. These tests are what the
// page then does with them.

test('the annotated E. coli release loads both new files and joins them', async () => {
  const { dataset, requested } = await ecoliAnnotatedFixtureDataset();
  assert.deepEqual([...requested].sort(), [DATA_MANIFEST_NAME, 'annotations.json',
    'codon_pca.json', 'excluded.json', 'genes.json', 'go-term-names-v1.json',
    'meta.json'].sort());
  assert.equal(dataset.files.annotations.state, FILE_STATE.READY);
  assert.equal(dataset.files.goTerms.state, FILE_STATE.READY);
  // Every gene carries a record, which is what the applier requires.
  assert.ok(dataset.genes.every((gene) => gene.annotationEvidence
    && typeof gene.annotationEvidence === 'object'));
  // And every GO id joined onto a gene has a name, which is what the other
  // applier requires: the names file is derived from the ids actually used.
  const relations = dataset.genes.flatMap((gene) => gene.annotationEvidence.goAnnotations);
  assert.ok(relations.length > 50, `${relations.length} GO relationships`);
  for (const relation of relations) {
    assert.ok(dataset.goTerms.terms[relation.goId]?.name, relation.goId);
  }
  assert.equal(dataset.meta.annotationRelease.releaseId, 'GCF_000005845.2-RS_2026_05_13');
  assert.deepEqual(dataset.meta.annotationRelease.coverage, {
    siteGenes: 120,
    withAnnotationEvidence: 120,
    withGoAnnotations: dataset.genes.filter((g) => g.annotationEvidence.goAnnotations.length).length,
    goRelationships: relations.length,
  });
  // The study-bound layers are still absent: an annotation release is not one.
  for (const key of STUDY_LAYER_KEYS) {
    assert.equal(dataset.files[key].state, FILE_STATE.ABSENT, key);
  }
  // Declaring the release without the file is a load the page refuses.
  const without = { ...ecoliAnnotatedFixtureFiles() };
  delete without['annotations.json'];
  const manifest = JSON.parse(without[DATA_MANIFEST_NAME]);
  delete manifest.files['annotations.json'];
  without[DATA_MANIFEST_NAME] = JSON.stringify(manifest);
  const staged = loadDatasetStaged({
    baseUrl: ECOLI_DATA_URL, organism: ECOLI,
    fetchImpl: memoryDirectory(ECOLI_DATA_URL, without).fetchImpl,
  });
  await staged.core;
  await staged.settled;
  assert.equal(staged.files.annotations.state, FILE_STATE.FAILED);
  assert.match(staged.files.annotations.error.message,
    /annotations\.json is required by meta\.annotationRelease/);
});

test('the gene detail panel reads E. coli annotation evidence and its GO names', async () => {
  const { dataset } = await ecoliAnnotatedFixtureDataset();
  const gene = dataset.genes.find((entry) => entry.annotationEvidence.goAnnotations.length > 0);
  const model = annotationEvidenceModel(gene, dataset.meta, dataset.goTerms.terms);
  assert.equal(model.releaseId, 'GCF_000005845.2-RS_2026_05_13');
  assert.equal(model.replicon, 'chromosome');
  assert.ok(model.methods.length > 0);
  assert.ok(model.inferences.length > 0);
  assert.ok(model.go.length > 0);
  for (const relation of model.go) {
    // The name is shown beside the id, not the bare id, and the aspect is in words.
    assert.match(relation.text,
      new RegExp(`^${relation.goId} — ${dataset.goTerms.terms[relation.goId].name}`));
    assert.match(relation.text, /molecular function|biological process|cellular component/);
    assert.match(relation.text, / · IEA/);
  }
  assert.deepEqual(model.attribution, dataset.meta.annotationRelease.goAttribution);

  // An obsolete id is marked as such, which is the one thing the names file
  // says that the relationship itself cannot.
  const obsolete = Object.entries(dataset.goTerms.terms)
    .find(([, term]) => term.isObsolete)?.[0];
  assert.ok(obsolete, 'the fixture publishes one obsolete id on purpose');
  const marked = dataset.genes
    .map((entry) => annotationEvidenceModel(entry, dataset.meta, dataset.goTerms.terms))
    .flatMap((entry) => entry.go)
    .filter((relation) => relation.goId === obsolete);
  assert.ok(marked.length > 0, `${obsolete} is joined onto at least one gene`);
  assert.ok(marked.every((relation) => /\[obsolete ID in pinned GO name release\]/.test(relation.text)));

  // Nothing of the other organism, in any of it.
  for (const entry of dataset.genes.slice(0, 40)) {
    const text = JSON.stringify(annotationEvidenceModel(entry, dataset.meta, dataset.goTerms.terms));
    const hit = CYANOBACTERIAL.exec(text);
    assert.equal(hit, null, hit ? text.slice(Math.max(0, hit.index - 60), hit.index + 60) : '');
  }
});

test('a GO term name finds an E. coli gene, and the id does too', async () => {
  const { dataset } = await ecoliAnnotatedFixtureDataset();
  const terms = dataset.goTerms.terms;
  const relation = dataset.genes
    .flatMap((gene) => gene.annotationEvidence.goAnnotations)
    .find((entry) => !terms[entry.goId].isObsolete);

  const byId = searchGenes(dataset.genes, relation.goId,
    { goTerms: terms, aliases: ECOLI.searchAliases });
  assert.ok(byId.total > 0, relation.goId);
  assert.equal(byId.shown[0].matchedOn, 'GO ID');
  assert.equal(byId.shown[0].goMatch.id, relation.goId);
  assert.equal(byId.shown[0].goMatch.isObsolete, false);

  const byName = searchGenes(dataset.genes, terms[relation.goId].name,
    { goTerms: terms, aliases: ECOLI.searchAliases });
  assert.ok(byName.total > 0, terms[relation.goId].name);
  assert.equal(byName.shown[0].matchedOn, 'GO term name');
  assert.equal(byName.shown[0].goMatch.name, terms[relation.goId].name);
  assert.ok(byName.shown.every((match) => /^b\d{4}$/.test(match.gene.id)));

  // An obsolete name is found and marked obsolete, rather than quietly missing.
  const [obsoleteId, obsoleteTerm] = Object.entries(terms)
    .find(([, term]) => term.isObsolete);
  const obsolete = searchGenes(dataset.genes, obsoleteTerm.name,
    { goTerms: terms, aliases: ECOLI.searchAliases });
  assert.ok(obsolete.total > 0, obsoleteTerm.name);
  assert.equal(obsolete.shown[0].goMatch.id, obsoleteId);
  assert.equal(obsolete.shown[0].goMatch.isObsolete, true);

  // Without the names file the ids still match and the names cannot.
  assert.equal(searchGenes(dataset.genes, terms[relation.goId].name,
    { aliases: ECOLI.searchAliases }).total, 0);
  assert.ok(searchGenes(dataset.genes, relation.goId,
    { aliases: ECOLI.searchAliases }).total > 0);
});

test('an annotated E. coli export carries its release and its GO relationships', async () => {
  const { dataset } = await ecoliAnnotatedFixtureDataset();
  const { registry } = withRegistry(dataset);
  const { said, exported } = await everythingSaid(dataset, registry, ECOLI);
  // The sweep still finds nothing of the other organism now that there is more
  // to say: the annotation release is the one this dataset declares.
  for (const text of said) {
    const hit = CYANOBACTERIAL.exec(text);
    assert.equal(hit, null, hit ? `"${text.slice(Math.max(0, hit.index - 60), hit.index + 60)}"` : '');
    assert.ok(!NEGATIVE_CLAIM.test(text), text.slice(0, 200));
  }
  assert.equal(exported.manifest.dataset.annotationRelease.releaseId,
    'GCF_000005845.2-RS_2026_05_13');
  assert.ok(exported.manifest.genes.some((gene) => gene.goAnnotations?.length > 0));
  assert.ok(exported.files.every((file) => file.name.startsWith('recoding-candidates_ecoli-k12-mg1655_')));
  // The layers it still does not publish stay out of the export, release or no.
  for (const key of ['tssEvidenceSource', 'candidateEvidence', 'goIeaEssentiality',
    'sourceDerivedCategories', 'functionCategories']) {
    assert.ok(!(key in exported.manifest.dataset), key);
  }
});

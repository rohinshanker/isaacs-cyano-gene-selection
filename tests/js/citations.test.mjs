import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  CitationsPanel, CITATIONS_TAB, citationDownloadResourceKey, fetchCitationBlob,
  loadCitationsManifest, normalizeCitationsManifest,
} from '../../site/js/ui/citations.js';
import { withFakeDocument } from './fake-dom.mjs';

/** An in-test fixture standing in for `data/citations.json`, per the contract:
 * `{sections: [{id, title, description, items: [{id, citation, url, contribution,
 * downloads: [{filename, repoPath, url, kind}]}]}]}`. The production manifest
 * is validated separately against the checked-in source files, while this
 * module exercises the renderer's data contract with an in-test fixture. */
const FIXTURE = {
  sections: [
    {
      id: 'primary-data',
      title: 'Primary data',
      description: 'Datasets this genome or its measurements were built from.',
      items: [
        {
          id: 'GSE205444',
          citation: 'Smith et al. 2022, GSE205444',
          url: 'https://www.ncbi.nlm.nih.gov/geo/query/acc.cgi?acc=GSE205444',
          contribution: 'Borrowed PCC 7942 expression values used as an expression proxy.',
          downloads: [
            { filename: 'GSE205444_counts.csv', repoPath: 'data/raw/GSE205444_counts.csv', url: 'https://example.test/sources/GSE205444_counts.csv', kind: 'raw counts' },
          ],
        },
      ],
    },
    {
      id: 'software',
      title: 'Software',
      items: [
        { id: 'viennarna', citation: 'ViennaRNA 2.6', url: 'https://www.tbi.univie.ac.at/RNA/', contribution: 'Folding energy (MFE) computation.', downloads: [] },
      ],
    },
  ],
};

function fetchOf(body, { ok = true, status = 200 } = {}) {
  return async () => ({ ok, status, json: async () => body });
}

function throwingFetch(message) {
  return async () => { throw new Error(message); };
}

test('the citations tab sits after the map panels and carries a reader-facing blurb', () => {
  assert.equal(CITATIONS_TAB.id, 'citations');
  assert.ok(CITATIONS_TAB.name.length > 0);
  assert.ok(CITATIONS_TAB.blurb.length > 0);
});

test('a well-formed manifest passes through with every field intact', () => {
  const manifest = normalizeCitationsManifest(FIXTURE);
  assert.equal(manifest.sections.length, 2);
  assert.equal(manifest.sections[0].id, 'primary-data');
  assert.equal(manifest.sections[0].items[0].downloads[0].filename, 'GSE205444_counts.csv');
  assert.equal(manifest.sections[1].items[0].downloads.length, 0);
});

test('a document that is not the {sections: [...]} shape is unusable, not an empty ledger', () => {
  assert.equal(normalizeCitationsManifest(null), null);
  assert.equal(normalizeCitationsManifest(undefined), null);
  assert.equal(normalizeCitationsManifest({}), null);
  assert.equal(normalizeCitationsManifest({ sections: 'nope' }), null);
  assert.equal(normalizeCitationsManifest('citations.json'), null);
});

test('a well-formed but empty manifest is distinct from an absent one', () => {
  const manifest = normalizeCitationsManifest({ sections: [] });
  assert.deepEqual(manifest, { sections: [] });
});

test('a section missing an id or a title is dropped, not rendered with a blank heading', () => {
  const manifest = normalizeCitationsManifest({
    sections: [
      { id: 'ok', title: 'Kept', items: [] },
      { title: 'No id' },
      { id: 'no-title' },
      { id: 'bad-items', title: 'Bad items', items: 'nope' },
    ],
  });
  assert.equal(manifest.sections.length, 2);
  assert.equal(manifest.sections[0].id, 'ok');
  assert.deepEqual(manifest.sections[1].items, []);
});

test('an item missing an id or a citation is dropped, not rendered blank', () => {
  const manifest = normalizeCitationsManifest({
    sections: [{
      id: 's',
      title: 'S',
      items: [
        { id: 'kept', citation: 'Kept 2020' },
        { citation: 'No id' },
        { id: 'no-citation' },
      ],
    }],
  });
  assert.equal(manifest.sections[0].items.length, 1);
  assert.equal(manifest.sections[0].items[0].id, 'kept');
});

test('a download missing a filename or a url is dropped rather than offered broken', () => {
  const manifest = normalizeCitationsManifest({
    sections: [{
      id: 's',
      title: 'S',
      items: [{
        id: 'i',
        citation: 'C',
        downloads: [
          { filename: 'good.csv', url: 'https://example.test/good.csv' },
          { url: 'https://example.test/no-name.csv' },
          { filename: 'no-url.csv' },
          'not-an-object',
        ],
      }],
    }],
  });
  assert.equal(manifest.sections[0].items[0].downloads.length, 1);
  assert.equal(manifest.sections[0].items[0].downloads[0].filename, 'good.csv');
});

test('unsafe citation and download URLs are never offered as links', () => {
  const manifest = normalizeCitationsManifest({ sections: [{
    id: 's', title: 'S', items: [{
      id: 'i', citation: 'C', url: 'javascript:alert(1)',
      downloads: [{ filename: 'bad.tsv', url: 'javascript:alert(1)' }],
    }],
  }] });
  assert.equal(manifest.sections[0].items[0].url, null);
  assert.deepEqual(manifest.sections[0].items[0].downloads, []);
});

test('download fetch returns file bytes when the source responds successfully', async () => {
  const payload = new Blob(['locus\tvalue\nA\t1\n']);
  const download = { url: 'https://example.test/source.tsv' };
  const result = await fetchCitationBlob(download, async () => ({
    ok: true, blob: async () => payload,
  }));
  assert.equal(result, payload);
});

test('download fetch reports HTTP and network failures', async () => {
  const download = { url: 'https://example.test/source.tsv' };
  await assert.rejects(
    fetchCitationBlob(download, async () => ({ ok: false, status: 404 })),
    /HTTP 404/,
  );
  await assert.rejects(fetchCitationBlob(download, throwingFetch('offline')), /offline/);
});

test('concurrent controls for one URL receive distinct progress identities', async () => {
  assert.notEqual(
    citationDownloadResourceKey({ url: 'https://example.test/source.tsv' }, 1),
    citationDownloadResourceKey({ url: 'https://example.test/source.tsv' }, 2),
  );
  await withFakeDocument(async (document) => {
    const host = document.createElement('div');
    const requests = [];
    const panel = new CitationsPanel(host, {
      fetchDownload: async (download, requestId) => {
        requests.push({ download, requestId });
        throw new Error('held failure');
      },
    });
    const shared = { filename: 'source.tsv', url: 'https://example.test/source.tsv' };
    panel.render({ sections: [{
      id: 'same-source', title: 'Same source', items: [
        { id: 'first', citation: 'First', downloads: [shared] },
        { id: 'second', citation: 'Second', downloads: [shared] },
      ],
    }] });
    for (const button of host.querySelectorAll('button')) button.dispatch('click');
    await Promise.resolve();
    assert.deepEqual(requests.map(({ requestId }) => requestId), [1, 2]);
    assert.deepEqual(requests.map(({ download }) => download.url), [shared.url, shared.url]);
  });
});

test('optional item and download fields normalize missing values to null, not undefined', () => {
  const manifest = normalizeCitationsManifest({
    sections: [{
      id: 's',
      title: 'S',
      items: [{ id: 'i', citation: 'C' }],
    }],
  });
  const item = manifest.sections[0].items[0];
  assert.equal(item.url, null);
  assert.equal(item.contribution, null);
  assert.deepEqual(item.downloads, []);
});

test('loading the manifest sanitizes a well-formed fetch response', async () => {
  const manifest = await loadCitationsManifest({
    baseUrl: 'https://example.test/data/',
    fetchImpl: fetchOf(FIXTURE),
  });
  assert.equal(manifest.sections.length, 2);
});

test('a missing manifest (404) resolves to null, not a rejection', async () => {
  const manifest = await loadCitationsManifest({
    baseUrl: 'https://example.test/data/',
    fetchImpl: fetchOf(null, { ok: false, status: 404 }),
  });
  assert.equal(manifest, null);
});

test('a network failure resolves to null, not a rejection', async () => {
  const manifest = await loadCitationsManifest({
    baseUrl: 'https://example.test/data/',
    fetchImpl: throwingFetch('offline'),
  });
  assert.equal(manifest, null);
});

test('invalid JSON in an otherwise-ok response resolves to null', async () => {
  const manifest = await loadCitationsManifest({
    baseUrl: 'https://example.test/data/',
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      json: async () => { throw new SyntaxError('bad json'); },
    }),
  });
  assert.equal(manifest, null);
});

test('the manifest is requested from citations.json beside the other data files', async () => {
  const requested = [];
  await loadCitationsManifest({
    baseUrl: 'https://example.test/data/',
    fetchImpl: async (url) => { requested.push(url); return fetchOf(FIXTURE)(); },
  });
  assert.equal(requested.length, 1);
  assert.equal(requested[0], 'https://example.test/data/citations.json');
});

test('the published E. coli ledger is well formed and contains only used sources', async () => {
  const citationsPath = new URL(
    '../../site/data/organisms/ecoli-k12-mg1655/citations.json', import.meta.url);
  const raw = JSON.parse(await readFile(citationsPath, 'utf8'));
  const manifest = normalizeCitationsManifest(raw);
  assert.ok(manifest);
  assert.deepEqual(manifest.sections.map(({ id }) => id), ['primary-data', 'methods-and-tools']);
  const items = manifest.sections.flatMap(({ items }) => items);
  assert.ok(items.some(({ id }) => id === 'ncbi-ecoli-k12-mg1655'));
  // Until this organism published measurements, nothing here offered a
  // download. Two studies now do, and only those two: a ledger entry offers a
  // file when the site derived one from it, and otherwise offers none.
  const offering = items.filter(({ downloads }) => downloads.length > 0);
  assert.deepEqual(offering.map(({ id }) => id).sort(),
    ['caglar-2017-ag3c', 'zhang-2022-translation']);
  assert.equal(offering.reduce((n, { downloads }) => n + downloads.length, 0), 78);
  for (const { downloads } of offering) {
    for (const download of downloads) {
      // The browser saves the bytes under this name, so it must be the file's.
      assert.equal(download.repoPath.split('/').pop(), download.filename);
      assert.ok(download.repoPath.startsWith('data/expression/organisms/ecoli-k12-mg1655/'));
      assert.ok(download.url.endsWith(download.repoPath));
      assert.ok(download.kind.trim());
    }
  }
  const forbidden = ['expression', 'tss', 'essential', 'protein-evidence', 'gene-ontology', 'trrosettarna'];
  assert.ok(items.every(({ id }) => !forbidden.some((term) => id.includes(term))));

  // These checks guard duplicated prose against generated or pinned inputs. They
  // do not generate the ledger or validate the scientific claims in its entries.
  const item = (id) => items.find((candidate) => candidate.id === id);
  const metaPath = new URL(
    '../../site/data/organisms/ecoli-k12-mg1655/meta.json', import.meta.url);
  const meta = JSON.parse(await readFile(metaPath, 'utf8'));
  const caiCount = Number(item('sharp-li-cai').contribution.match(/(\d+)-gene/)[1]);
  assert.equal(caiCount, meta.caiReferenceSet.n);

  const trnaPath = new URL(
    '../../data/trna/ecoli-k12-mg1655_anticodon_gene_copies.tsv', import.meta.url);
  const trnaRows = (await readFile(trnaPath, 'utf8')).trimEnd().split('\n').slice(1);
  const ileCat = trnaRows.map((row) => row.split('\t'))
    .find(([aminoAcid, anticodon]) => aminoAcid === 'Ile' && anticodon === 'CAT');
  const countWords = new Map([
    ['zero', 0], ['one', 1], ['two', 2], ['three', 3], ['four', 4], ['five', 5],
    ['six', 6], ['seven', 7], ['eight', 8], ['nine', 9], ['ten', 10],
  ]);
  const ledgerCount = item('soma-lysidine').contribution.match(/the (\w+) Ile-CAT loci/)[1];
  assert.equal(countWords.get(ledgerCount), Number(ileCat[3]));

  const requirementsPath = new URL('../../requirements.txt', import.meta.url);
  const requirements = await readFile(requirementsPath, 'utf8');
  const pinnedVersion = requirements.match(/^ViennaRNA==([^\s]+)$/m)[1];
  const vienna = item('viennarna');
  assert.equal(vienna.citation.match(/ViennaRNA (\d+\.\d+\.\d+)/)[1], pinnedVersion);
  assert.equal(vienna.contribution.match(/compiled (\d+\.\d+\.\d+) engine/)[1], pinnedVersion);
});

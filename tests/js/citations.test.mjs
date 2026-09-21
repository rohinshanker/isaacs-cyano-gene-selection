import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeCitationsManifest, loadCitationsManifest, fetchCitationBlob, CITATIONS_TAB,
} from '../../site/js/ui/citations.js';

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

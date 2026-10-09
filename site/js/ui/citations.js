/**
 * Citations / sources tab: a reader-facing ledger of everything this site
 * cites or builds from, separated from the map's own four projections.
 *
 * The manifest (`data/citations.json`) is published with the site. If an
 * older deployment lacks it, every step here —
 * the fetch, the shape check, and the render — degrades to an explanatory
 * empty state instead of throwing, the same way the rest of the site treats
 * optional pipeline output.
 */

/** Tab descriptor, appended after the map's own panels in the shared tablist. */
export const CITATIONS_TAB = Object.freeze({
  id: 'citations',
  name: 'Citations & sources',
  blurb: 'Every source this page cites or builds from, primary data first, then the design, '
    + 'validation, methods, and software behind it. Each entry says exactly what was used.',
  source: '',
});

/**
 * The tab's introductory blurb, or nothing when there is no ledger to introduce.
 *
 * The blurb promises what every entry says; with no ledger published there are
 * no entries, and the unavailable state says the whole of what is known.
 */
export function citationsBlurb(manifest) {
  return manifest === null ? '' : CITATIONS_TAB.blurb;
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

/** Only ordinary web URLs may be placed in the site's source ledger. */
function isWebUrl(value) {
  if (!isNonEmptyString(value)) return false;
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

/** Keep only downloads that carry both a label and a place to fetch them from. */
function normalizeDownload(raw) {
  if (!raw || typeof raw !== 'object') return null;
  if (!isNonEmptyString(raw.filename) || !isWebUrl(raw.url)) return null;
  return {
    filename: raw.filename,
    url: raw.url,
    repoPath: isNonEmptyString(raw.repoPath) ? raw.repoPath : null,
    kind: isNonEmptyString(raw.kind) ? raw.kind : null,
  };
}

/** A dated upstream observation, distinct from a file retained by this project. */
export function normalizeUpstreamArtifact(raw) {
  if (!raw || typeof raw !== 'object'
    || !(isNonEmptyString(raw.filename) || (raw.sourcePage === true && isNonEmptyString(raw.label)))
    || !isWebUrl(raw.url) || !isNonEmptyString(raw.version)) return null;
  const check = raw.linkCheck;
  if (!check || !['verified', 'changed', 'unavailable'].includes(check.result)
    || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(check.checkedAt)
    || !Number.isFinite(Date.parse(check.checkedAt))
    || new Date(check.checkedAt).toISOString().slice(0, 19) !== check.checkedAt.slice(0, 19)) return null;
  const bytes = Number.isSafeInteger(raw.bytes) && raw.bytes > 0 ? raw.bytes : null;
  const sha256 = /^[a-f0-9]{64}$/.test(raw.sha256) ? raw.sha256 : null;
  const pinnedSha256 = /^[a-f0-9]{64}$/.test(raw.pinnedSha256) ? raw.pinnedSha256 : null;
  if (check.result !== 'unavailable' && (bytes === null || sha256 === null)) return null;
  if (raw.sourcePage === true && check.result !== 'unavailable') return null;
  if (check.result === 'verified' && pinnedSha256 && pinnedSha256 !== sha256) return null;
  if (check.result === 'changed' && (pinnedSha256 === null || pinnedSha256 === sha256)) return null;
  return {
    filename: isNonEmptyString(raw.filename) ? raw.filename : null,
    label: isNonEmptyString(raw.label) ? raw.label : null,
    sourcePage: raw.sourcePage === true,
    url: raw.url, version: raw.version,
    compression: ['gzip', 'zip', 'uncompressed'].includes(raw.compression) ? raw.compression : null,
    bytes: check.result === 'unavailable' ? null : bytes,
    sha256: check.result === 'unavailable' ? null : sha256,
    pinnedSha256,
    note: isNonEmptyString(raw.note) ? raw.note : null,
    linkCheck: {
      checkedAt: check.checkedAt, result: check.result,
      detail: isNonEmptyString(check.detail) ? check.detail : null,
    },
  };
}

/** Keep only items that carry an id and a citation to display. */
function normalizeItem(raw) {
  if (!raw || typeof raw !== 'object') return null;
  if (!isNonEmptyString(raw.id) || !isNonEmptyString(raw.citation)) return null;
  const downloads = Array.isArray(raw.downloads)
    ? raw.downloads.map(normalizeDownload).filter(Boolean)
    : [];
  const item = {
    id: raw.id,
    citation: raw.citation,
    url: isWebUrl(raw.url) ? raw.url : null,
    contribution: isNonEmptyString(raw.contribution) ? raw.contribution : null,
    downloads,
  };
  if (Array.isArray(raw.upstreamArtifacts)) {
    item.upstreamArtifacts = raw.upstreamArtifacts.map(normalizeUpstreamArtifact).filter(Boolean);
  }
  return item;
}

/** Keep only sections that carry an id and a title; items default to none. */
function normalizeSection(raw) {
  if (!raw || typeof raw !== 'object') return null;
  if (!isNonEmptyString(raw.id) || !isNonEmptyString(raw.title)) return null;
  const items = Array.isArray(raw.items) ? raw.items.map(normalizeItem).filter(Boolean) : [];
  return {
    id: raw.id,
    title: raw.title,
    description: isNonEmptyString(raw.description) ? raw.description : null,
    items,
  };
}

/**
 * Sanitize a parsed `citations.json` document into the shape this module
 * renders, dropping any section or item that does not carry the fields a
 * reader needs to make sense of it. `null` means the document itself is not
 * usable (missing, malformed JSON, or not the `{sections: [...]}` shape);
 * that is distinct from a well-formed document that happens to list nothing.
 *
 * @param {unknown} raw
 * @returns {{sections: object[]}|null}
 */
export function normalizeCitationsManifest(raw) {
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.sections)) return null;
  const sections = raw.sections.map(normalizeSection).filter(Boolean);
  return { sections };
}

/**
 * Fetch and sanitize the citations manifest. Every failure — no file, a
 * network error, invalid JSON, or a document that does not match the
 * contract — resolves to `null` rather than rejecting, so a missing manifest
 * never blocks the rest of the page from loading.
 *
 * @param {{baseUrl: URL|string, fetchImpl?: typeof fetch}} options
 * @returns {Promise<{sections: object[]}|null>}
 */
export async function loadCitationsManifest({ baseUrl, fetchImpl = fetch }) {
  const base = new URL(String(baseUrl), typeof document === 'undefined' ? 'file:///' : document.baseURI);
  const url = new URL('citations.json', base).href;
  let response;
  try {
    response = await fetchImpl(url, { cache: 'no-cache' });
  } catch {
    return null;
  }
  if (!response.ok) return null;
  let raw;
  try {
    raw = await response.json();
  } catch {
    return null;
  }
  return normalizeCitationsManifest(raw);
}

/** Fetch bytes rather than trusting cross-origin `download`, which browsers ignore. */
export async function fetchCitationBlob(download, fetchImpl = fetch) {
  const response = await fetchImpl(download.url);
  if (!response.ok) throw new Error(`Source download failed (HTTP ${response.status}).`);
  return response.blob();
}

/** A distinct progress identity for every click, even when two controls share a URL. */
export function citationDownloadResourceKey(download, requestId) {
  return `citation-download:${requestId}:${download.url}`;
}

/** Renders the sanitized manifest into `host`. DOM-only; kept apart from the fetch and the shape check above so those stay unit-testable without a DOM. */
export class CitationsPanel {
  /**
   * @param {HTMLElement} host
   * @param {{fetchDownload?: (download: object, requestId: number) => Promise<Blob>}} handlers
   */
  constructor(host, { fetchDownload = fetchCitationBlob } = {}) {
    this.host = host;
    this.fetchDownload = fetchDownload;
    this.downloadRequestId = 0;
  }

  /**
   * @param {{sections: object[]}|null|undefined} manifest `undefined` while
   *   the fetch is still in flight, `null` when no usable manifest is
   *   available, otherwise the sanitized document.
   */
  render(manifest) {
    this.host.replaceChildren();
    if (manifest === undefined) {
      this.host.append(this.note('Loading the source ledger…'));
      return;
    }
    if (manifest === null) {
      // A short unavailable state, as the Lengths and Regulatory sites tabs
      // give: an organism whose release publishes no ledger is not a deployment
      // to be fixed, and naming a file to publish would name one directory for
      // every organism, which is the wrong one for all but the default.
      this.host.append(this.note('The source ledger is unavailable in this dataset.'));
      return;
    }
    if (manifest.sections.length === 0) {
      this.host.append(this.note('The source ledger is published but currently lists no sources.'));
      return;
    }
    for (const section of manifest.sections) this.host.append(this.renderSection(section));
  }

  note(text) {
    const p = document.createElement('p');
    p.className = 'panel-note';
    p.textContent = text;
    return p;
  }

  renderSection(section) {
    const wrapper = document.createElement('section');
    wrapper.className = 'citation-section';
    const headingId = `citation-section-${section.id}`;
    wrapper.setAttribute('aria-labelledby', headingId);
    const heading = document.createElement('h3');
    heading.id = headingId;
    heading.textContent = section.title;
    wrapper.append(heading);
    if (section.description) wrapper.append(this.note(section.description));
    if (section.items.length === 0) {
      wrapper.append(this.note('No sources listed in this section yet.'));
      return wrapper;
    }
    const list = document.createElement('ul');
    list.className = 'citation-list';
    for (const item of section.items) list.append(this.renderItem(item));
    wrapper.append(list);
    return wrapper;
  }

  renderItem(item) {
    const row = document.createElement('li');
    row.className = 'citation-item';

    const heading = document.createElement('p');
    heading.className = 'citation-text';
    if (item.url) {
      const link = document.createElement('a');
      link.href = item.url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = item.citation;
      heading.append(link);
    } else {
      heading.textContent = item.citation;
    }
    row.append(heading);

    if (item.contribution) {
      const contribution = document.createElement('p');
      contribution.className = 'citation-contribution';
      contribution.textContent = item.contribution;
      row.append(contribution);
    }

    if (item.downloads.length > 0) {
      const downloads = document.createElement('ul');
      downloads.className = 'citation-downloads';
      for (const download of item.downloads) downloads.append(this.renderDownload(download));
      row.append(downloads);
    }

    if (item.upstreamArtifacts?.length > 0) {
      const catalogue = document.createElement('details');
      catalogue.className = 'upstream-source-catalogue';
      const summary = document.createElement('summary');
      summary.textContent = `Upstream source catalogue (${item.upstreamArtifacts.length})`;
      catalogue.append(summary);
      const list = document.createElement('ul');
      for (const artifact of item.upstreamArtifacts) list.append(this.renderUpstreamArtifact(artifact));
      catalogue.append(list);
      row.append(catalogue);
    }

    return row;
  }

  renderUpstreamArtifact(artifact) {
    const row = document.createElement('li');
    row.className = 'upstream-artifact';
    const link = document.createElement('a');
    link.href = artifact.url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = artifact.label ?? artifact.filename;
    row.append(link);
    const metadata = document.createElement('dl');
    const field = (label, value, code = false) => {
      const term = document.createElement('dt');
      term.textContent = label;
      const description = document.createElement('dd');
      if (code) {
        const text = document.createElement('code');
        text.textContent = value;
        description.append(text);
      } else description.textContent = value;
      metadata.append(term, description);
    };
    field('Source version', artifact.version);
    if (artifact.sourcePage) field('Catalogue link', 'Publisher entry; direct file URL is unverified.');
    if (artifact.compression) field('Format', artifact.compression);
    field('Last link check (UTC)', artifact.linkCheck.checkedAt);
    const results = {
      verified: 'File retrieved and its bytes/checksum recorded.',
      changed: 'Upstream file differs from the pinned input used by this release.',
      unavailable: 'File could not be retrieved; size and checksum are unverified.',
    };
    field('Check result', results[artifact.linkCheck.result]);
    if (artifact.linkCheck.detail) field('Access details', artifact.linkCheck.detail);
    if (artifact.bytes !== null) field('Checked file size', `${artifact.bytes.toLocaleString('en-US')} bytes`);
    if (artifact.sha256) field('Checked SHA-256', artifact.sha256, true);
    if (artifact.pinnedSha256) {
      if (artifact.pinnedSha256 === artifact.sha256) field('Pinned input', 'Matches the checked file’s SHA-256.');
      else field('Pinned input SHA-256', artifact.pinnedSha256, true);
    }
    if (artifact.note) field('Notes', artifact.note);
    row.append(metadata);
    return row;
  }

  renderDownload(download) {
    const entry = document.createElement('li');
    entry.className = 'citation-download';
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'chip-button citation-download-link';
    button.textContent = `Download ${download.filename}`;
    button.setAttribute('aria-label', `Download ${download.filename}`);
    const status = document.createElement('span');
    status.className = 'citation-download-status';
    status.setAttribute('role', 'status');
    button.addEventListener('click', async () => {
      button.disabled = true;
      status.textContent = `Downloading ${download.filename}…`;
      try {
        const blob = await this.fetchDownload(download, ++this.downloadRequestId);
        const objectUrl = URL.createObjectURL(blob);
        try {
          const anchor = document.createElement('a');
          anchor.href = objectUrl;
          anchor.download = download.filename;
          anchor.hidden = true;
          document.body.append(anchor);
          anchor.click();
          anchor.remove();
          status.textContent = `Saved ${download.filename}.`;
        } finally {
          // Give the browser time to begin saving before releasing the blob.
          window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
        }
      } catch {
        status.textContent = `Could not download ${download.filename}; use View source.`;
      } finally {
        button.disabled = false;
      }
    });
    const fallback = document.createElement('a');
    fallback.href = download.url;
    fallback.target = '_blank';
    fallback.rel = 'noopener noreferrer';
    fallback.textContent = 'View source';
    entry.append(button, fallback, status);
    if (download.kind) {
      const kind = document.createElement('span');
      kind.className = 'citation-download-kind';
      kind.textContent = download.kind;
      entry.append(' ', kind);
    }
    if (download.repoPath) {
      const path = document.createElement('code');
      path.className = 'citation-download-path';
      path.textContent = download.repoPath;
      entry.append(' ', path);
    }
    return entry;
  }
}

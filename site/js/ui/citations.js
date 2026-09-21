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

/** Keep only items that carry an id and a citation to display. */
function normalizeItem(raw) {
  if (!raw || typeof raw !== 'object') return null;
  if (!isNonEmptyString(raw.id) || !isNonEmptyString(raw.citation)) return null;
  const downloads = Array.isArray(raw.downloads)
    ? raw.downloads.map(normalizeDownload).filter(Boolean)
    : [];
  return {
    id: raw.id,
    citation: raw.citation,
    url: isWebUrl(raw.url) ? raw.url : null,
    contribution: isNonEmptyString(raw.contribution) ? raw.contribution : null,
    downloads,
  };
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

/** Renders the sanitized manifest into `host`. DOM-only; kept apart from the fetch and the shape check above so those stay unit-testable without a DOM. */
export class CitationsPanel {
  /** @param {HTMLElement} host */
  constructor(host) {
    this.host = host;
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
      this.host.append(this.note(
        'The source ledger is not available on this deployment. Once data/citations.json is '
        + 'published, every primary dataset, design decision, validation study, and '
        + 'software dependency this site relies on will be listed here, each with exactly what '
        + 'was used from it and, where the source file ships in this repository, a download for '
        + 'that exact file.',
      ));
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
        const blob = await fetchCitationBlob(download);
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

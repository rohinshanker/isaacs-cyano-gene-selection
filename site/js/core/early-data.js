/**
 * Adopt the requests the page's inline script started before any module ran.
 *
 * `site/index.html` asks for the content manifest and the tier 1 files as soon
 * as the document is parsed, so the gene file is already downloading while the
 * browser is still fetching the module graph. It leaves them on
 * `window.__cyanoEarlyData` as `{ ready, responses }`: `responses` maps each
 * exact address to its pending `Response`, and `ready` settles once every
 * address the script is going to ask for has been registered.
 *
 * Waiting on `ready` before looking an address up is what guarantees a file is
 * never requested twice: without it the loader could ask for the gene file in
 * the moment before the inline script had registered its own request for it.
 */

/**
 * A `fetch` that answers from the early requests where one matches.
 *
 * Each early response is handed out once. An address the script did not ask
 * for, or whose early request failed, goes to `fetchImpl` as usual.
 *
 * @param {{ready: Promise<unknown>, responses: Record<string, Promise<Response>>}|null|undefined} early
 * @param {typeof fetch} fetchImpl
 * @returns {typeof fetch}
 */
export function adoptingFetch(early, fetchImpl) {
  if (!early || typeof early.ready?.then !== 'function' || !early.responses) return fetchImpl;
  return async (url, init) => {
    await early.ready;
    const pending = early.responses[url];
    if (!pending) return fetchImpl(url, init);
    delete early.responses[url];
    try {
      return await pending;
    } catch {
      return fetchImpl(url, init);
    }
  };
}

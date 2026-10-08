/** Run on the real app with ?uiArtifacts=<absolute ignored directory> via playwright-cli. */
async (page) => {
  const { root, base } = await page.evaluate(() => ({
    root: new URL(location.href).searchParams.get('uiArtifacts'), base: location.href.split('#')[0],
  }));
  if (!root?.startsWith('/')) throw new Error('An absolute uiArtifacts directory is required.');
  const errors = [];
  let expectedFailure = false;
  const pageError = (error) => errors.push(error.message);
  const consoleError = (message) => {
    const intentional = expectedFailure && message.text().includes('503')
      && message.location().url.includes('/excluded.json');
    if (message.type() === 'error' && !intentional) errors.push(message.text());
  };
  const requestFailed = (request) => errors.push(request.url());
  page.on('pageerror', pageError); page.on('console', consoleError); page.on('requestfailed', requestFailed);
  const check = (ok, label) => { if (!ok) throw new Error(label); };
  const urls = await page.evaluate((base) => {
    const url = new URL(base);
    url.hash = '';
    url.searchParams.delete('org');
    url.searchParams.delete('organism');
    url.searchParams.set('load-min', '1500');
    const deep = new URL(url); deep.hash = 'ver=6&p=chromosome';
    const ecoli = new URL(url);
    ecoli.searchParams.set('org', 'ecoli-k12-mg1655');
    return { boot: url.href, deep: deep.href, ecoli: ecoli.href };
  }, base);
  const checkLayout = async () => {
    check(await page.locator('[role="progressbar"]').count() === 1, 'one progress surface');
    check(!await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), 'page overflow');
  };
  const settle = () => page.waitForFunction(() => !document.body.classList.contains('is-loading')
    && document.querySelector('#load-progress-presentation').hidden);
  const fresh = (route) => route.continue();
  await page.route('**/*', fresh);
  try {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    const evidence = [];
    for (const [width, height] of [[375, 812], [768, 1024], [1280, 800], [1440, 900]]) {
      await page.setViewportSize({ width, height });
      await page.goto(urls.boot); await settle(); await checkLayout();
      await page.getByRole('tab', { name: 'Citations & sources', exact: true }).click();
      const entry = page.locator('.citation-download').first();
      const sourceUrl = await entry.locator('a').evaluate((node) => node.href);
      const serve = (route) => route.fulfill({ status: 200, contentType: 'text/plain',
        headers: { 'Access-Control-Allow-Origin': '*' }, body: 'UI download fixture\n' });
      await page.route(sourceUrl, serve);
      await entry.locator('button').click();
      await page.waitForFunction(() => document.querySelector('.citation-download-status')?.textContent.startsWith('Saved'));
      await settle(); await checkLayout();
      await page.screenshot({ path: `${root}/loading-fast-download-${width}.png` });
      await page.unroute(sourceUrl, serve);
      evidence.push({ width, height, fastDownload: 'settled with default nonzero minimum' });
    }
    await page.setViewportSize({ width: 768, height: 1024 });
    const reject = (route) => route.fulfill({ status: 503, body: 'Intentional loading failure' });
    expectedFailure = true;
    await page.route('**/excluded.json*', reject);
    await page.goto(urls.boot); await settle();
    const announcement = page.locator('.load-failure-announcement');
    check((await announcement.textContent()).includes('excluded loci'), 'failed file announced');
    check(await announcement.getAttribute('aria-live') === 'polite', 'persistent live region');
    check(await announcement.evaluate((node) => !node.hidden && !node.closest('[hidden]')), 'announcement exposed after progress hides');
    await page.screenshot({ path: `${root}/loading-failure-768.png` });
    await page.unroute('**/excluded.json*', reject);
    await page.getByRole('button', { name: 'Retry loading excluded loci', exact: true }).click();
    await settle(); await checkLayout();
    check(await announcement.textContent() === '', 'retry clears failure announcement');
    check(await page.locator('.load-failure').count() === 0, 'retry recovered');
    expectedFailure = false;
    await page.screenshot({ path: `${root}/loading-fast-retry-768.png` });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(urls.deep); await settle(); await checkLayout();
    await page.screenshot({ path: `${root}/loading-deep-reduced-768.png` });
    await page.goto(urls.ecoli); await settle(); await checkLayout();
    check(await page.locator('#organism-strain').textContent() === 'K-12 MG1655', 'E. coli dataset identity');
    await page.screenshot({ path: `${root}/loading-ecoli-768.png` });
    check(errors.length === 0, `runtime errors: ${errors.join('; ')}`);
    return { evidence, failureRetry: 'passed', reducedMotion: 'passed', deepLink: 'passed', organism: 'passed', runtimeErrors: errors };
  } finally {
    await page.unroute('**/excluded.json*');
    await page.unroute('**/*', fresh);
    page.off('pageerror', pageError); page.off('console', consoleError); page.off('requestfailed', requestFailed);
  }
}

/** Real UI checks for TSS ranks and evidence carried through panel exports. */
async (page) => {
  const { root, base } = await page.evaluate(() => ({
    root: new URL(location.href).searchParams.get('uiArtifacts'),
    base: new URL('index.html', location.href).href,
  }));
  if (!root?.startsWith('/')) throw new Error('Pass an absolute ignored uiArtifacts directory.');
  const check = (ok, message) => { if (!ok) throw new Error(message); };
  const errors = []; const failures = []; const snapshots = [];
  const onError = (error) => errors.push(error.message);
  const onConsole = (message) => { if (message.type() === 'error') errors.push(message.text()); };
  const onFailed = (request) => failures.push(request.url());
  page.on('pageerror', onError); page.on('console', onConsole); page.on('requestfailed', onFailed);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  try {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${base}?uiArtifacts=${encodeURIComponent(root)}#ver=9&p=native&g=M744_RS00135&c=editedTssSitesInCds&s=`);
    await page.waitForFunction(() => document.querySelector('.tss-edit-details > summary')?.textContent.includes('0 edited / 4 evaluated'));
    const context = page.locator('#detail details.metric-group').filter({ has: page.locator('summary', { hasText: /^Genomic context \(\d+\)$/ }) });
    if (await context.getAttribute('open') === null) await context.locator('summary').click();
    const row = context.locator('tr').filter({ has: page.locator('.metric-label', { hasText: /^Edited TSS sites in CDS$/ }) });
    await row.locator('.rank-text').waitFor();
    const identityRank = await row.locator('.rank-text').innerText();
    await page.getByRole('button', { name: 'Syn61 original design', exact: true }).click();
    await page.waitForFunction(() => [...document.querySelectorAll('#detail tr')].some((r) =>
      r.querySelector('.metric-label')?.textContent === 'Edited TSS sites in CDS'
      && r.querySelector('.rank-text')?.textContent === '99th pct'));
    const syn61Rank = await row.locator('.rank-text').innerText();
    const syn61Percentile = await row.locator('.rank-fill').evaluate((node) => parseFloat(node.style.width) / 100);
    check(Math.abs(syn61Percentile - (2680 + 35 / 2) / 2715) < 1e-6, 'rank uses the current 35 edited-gene cohort');
    await page.getByRole('button', { name: 'No scheme', exact: true }).click();
    check(await row.locator('.rank-text').innerText() === identityRank, 'identity cohort restored');
    await page.getByRole('button', { name: 'Syn61 original design', exact: true }).click();
    check(await row.locator('.rank-text').innerText() === syn61Rank, 'repeated scheme change uses fresh cohort');

    for (const [width, height] of [[375,812],[768,1024],[1280,800],[1440,900]]) {
      await page.setViewportSize({ width, height });
      await row.scrollIntoViewIfNeeded();
      check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `rank overflow ${width}`);
      await page.screenshot({ path: `${root}/tss-percentile-${width}.png` });
      await row.screenshot({ path: `${root}/tss-percentile-row-${width}.png` });
    }
    const designer = page.getByRole('region', { name: 'Design a panel' });
    await designer.locator('summary').first().click();
    await page.locator('#panel-gene-input').fill('M744_RS00135');
    await designer.getByRole('button', { name: 'Keep in panel', exact: true }).click();
    for (const key of ['editedTssSitesInCds', 'evaluatedTssSitesInCds']) {
      check(await page.locator(`#panel-range-add option[value="${key}"]`).count() === 0, 'TSS excluded from fixed constraints');
      check(await page.locator(`#filter-add option[value="${key}"]`).count() === 1, 'interactive TSS filters retained');
    }
    await designer.getByRole('button', { name: 'Design panel', exact: true }).click();
    await page.evaluate(() => {
      window.__tssExportBlobs = []; window.__tssOriginalObjectURL = URL.createObjectURL;
      URL.createObjectURL = (blob) => { window.__tssExportBlobs.push(blob); return window.__tssOriginalObjectURL(blob); };
    });
    const readExport = async () => {
      await page.evaluate(() => { window.__tssExportBlobs = []; });
      await designer.getByRole('button', { name: 'Export panel and manifest', exact: true }).click();
      return page.evaluate(async () => {
        const texts = await Promise.all(window.__tssExportBlobs.map((blob) => blob.text()));
        const { parseCsv } = await import('./js/core/export-manifest.js');
        const manifest = JSON.parse(texts.find((text) => text.startsWith('{')));
        const csv = parseCsv(texts.find((text) => !text.startsWith('{')));
        return { manifest, row: csv.rows.find((row) => row.id === 'M744_RS00135') };
      });
    };
    const available = await readExport();
    check(available.row?.editedTssSitesInCds === '1' && available.row?.evaluatedTssSitesInCds === '4', 'panel CSV has exact counts');
    check(available.row.tssRecodingStatus === 'evaluated' && available.manifest.dataset.tssRecoding.evidenceAvailable === true, 'panel manifest agrees');
    await page.evaluate(() => { const hash = new URLSearchParams(location.hash.slice(1)); hash.set('ds', 'GSE205444'); location.hash = hash.toString(); });
    await page.waitForFunction(() => document.querySelector('.tss-edit-details')?.textContent.includes('Select a Tan'));
    const unavailable = await readExport();
    check(unavailable.row.editedTssSitesInCds === '' && unavailable.row.evaluatedTssSitesInCds === '', 'deselected panel counts blank');
    check(unavailable.row.tssRecodingStatus === 'not-evaluated' && unavailable.manifest.dataset.tssRecoding.evidenceAvailable === false, 'deselected panel manifest agrees');
    for (const [width, height] of [[375,812],[768,1024],[1280,800],[1440,900]]) {
      await page.setViewportSize({ width, height });
      await page.locator('.panel-export').scrollIntoViewIfNeeded();
      check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `export overflow ${width}`);
      await page.screenshot({ path: `${root}/tss-panel-export-${width}.png` });
      snapshots.push({ width, snapshot: await page.locator('body').ariaSnapshot() });
    }
    check(errors.length === 0, `Unexpected errors: ${errors.join('; ')}`);
    check(failures.length === 0, `Unexpected failed requests: ${failures.join('; ')}`);
    return { passed: true, identityRank, syn61Rank, syn61Percentile, available: available.row, unavailable: unavailable.row,
      errors, failures, semanticSnapshots: snapshots };
  } finally {
    await page.evaluate(() => { if (window.__tssOriginalObjectURL) URL.createObjectURL = window.__tssOriginalObjectURL; });
    page.off('pageerror', onError); page.off('console', onConsole); page.off('requestfailed', onFailed);
  }
}

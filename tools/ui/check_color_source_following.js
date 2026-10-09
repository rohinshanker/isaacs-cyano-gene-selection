/** Real-app regressions for shared colour controls and traffic-owned filters.
 * Run with playwright-cli run-code --filename=<this file> on the UTEX site.
 */
async (page) => {
  const protein = 'type.proteomics.lc-ms-ms.abundance';
  const rna = 'type.transcriptomics.rna-seq.abundance';
  const base = await page.evaluate(() => {
    const url = new URL(location.href);
    if (url.searchParams.has('data')
      || (url.searchParams.has('org') && url.searchParams.get('org') !== 'utex2973')) {
      throw new Error('This check requires the published UTEX release without a data override.');
    }
    url.search = '';
    url.hash = '';
    return url.href;
  });
  const check = (ok, message) => { if (!ok) throw new Error(message); };
  const errors = [];
  const runId = await page.evaluate(() => Date.now());
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  const onError = (error) => errors.push(error.message);
  const onConsole = (message) => { if (message.type() === 'error') errors.push(message.text()); };
  const onRequest = (request) => errors.push(`${request.url()}: ${request.failure()?.errorText}`);
  page.on('pageerror', onError);
  page.on('console', onConsole);
  page.on('requestfailed', onRequest);
  const settled = () => page.waitForFunction(() => (
    !document.body.classList.contains('is-loading')
    && performance.getEntriesByName('cyano:settled').length > 0
  ));
  const state = () => page.evaluate(() => ({
    color: document.querySelector('#color-by').value,
    chromosomeColor: document.querySelector('#chromosome-color-by')?.value,
    traffic: document.querySelector('#traffic-metric').value,
    fields: new URLSearchParams(location.hash.slice(1)).get('f')?.split(',') ?? [],
  }));
  const reports = [];
  try {
    for (const [width, height] of [[375, 812], [768, 1024], [1280, 800], [1440, 900]]) {
      await page.setViewportSize({ width, height });
      await page.goto(`${base}?ui-color-follow=${runId}-${width}-shared#ver=6&p=native`);
      await settled();
      await page.getByRole('tab', { name: 'Chromosome/Gene', exact: true }).click();
      await page.locator('#chromosome-color-by').selectOption(protein);
      await page.getByRole('tab', { name: 'Native codon space', exact: true }).click();
      await page.waitForFunction((key) => document.querySelector('#color-by').value === key, protein);
      const shared = await state();
      check(shared.color === protein && shared.chromosomeColor === protein,
        'Shared selectors disagree with the applied colour metric.');

      await page.goto(`${base}?ui-color-follow=${runId}-${width}-filters#ver=6&p=native&c=functionCategory&ds=GSE205444,PXD062851_dia&f=${rna}:100:1000000&ax=gc3&ay=cai`);
      await settled();
      const initial = await state();
      check(initial.traffic === 'cai', 'The borrowed-source fixture must use the safe CAI default.');
      const slider = page.locator('#traffic-threshold');
      await slider.evaluate((node) => {
        node.value = String(Number(node.min) + (Number(node.max) - Number(node.min)) * 0.7);
        node.dispatchEvent(new Event('input', { bubbles: true }));
        node.dispatchEvent(new Event('change', { bubbles: true }));
      });
      const before = await state();
      const explicit = before.fields.find((field) => field.split(':')[0] === rna);
      check(explicit && before.fields.some((field) => field.split(':')[0] === 'cai'),
        'The regression fixture needs independent RNA and traffic-owned CAI filters.');
      await page.locator('#color-by').selectOption(protein);
      await page.waitForFunction((key) => document.querySelector('#traffic-metric').value === key, protein);
      const after = await state();
      check(after.fields.includes(explicit), 'Changing colour removed or changed an explicit RNA filter.');
      check(!after.fields.some((field) => field.split(':')[0] === 'cai'),
        'Changing traffic source retained the previous implicit proxy threshold.');
      check(after.color === protein && after.traffic === protein,
        'The colour and followed activity controls disagree.');
      check(errors.length === 0, `Unexpected runtime diagnostics: ${errors.join('; ')}`);
      reports.push({ viewport: [width, height], shared, before, after });
    }
    return { reports, unexpectedErrors: errors.length };
  } finally {
    page.off('pageerror', onError);
    page.off('console', onConsole);
    page.off('requestfailed', onRequest);
    await cdp.detach();
  }
}

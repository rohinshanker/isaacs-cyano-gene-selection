/** Browser regression for failures/retry, empty results, source conditions and coincident targets. */
async (page) => {
  const { root, appUrl } = await page.evaluate(() => ({ root: new URL(location.href).searchParams.get('uiArtifacts'), appUrl: new URL('index.html', location.href).href }));
  if (!root?.startsWith('/')) throw new Error('Pass an absolute uiArtifacts path in the app URL.');
  const base = `${appUrl}?uiArtifacts=${encodeURIComponent(root)}`;
  const check = (ok, label) => { if (!ok) throw new Error(label); };
  const errors = []; const failures = []; const evidence = [];
  let expectedHttpFailure = false;
  let expectedFailureUrl = null;
  let release;
  const heldContinuations = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error' && !(expectedHttpFailure && message.text().includes('503') && message.location().url === expectedFailureUrl)) errors.push(message.text());
  });
  page.on('requestfailed', (request) => failures.push(request.url()));
  const save = async (name) => {
    await page.screenshot({ path: `${root}/${name}.png` });
    evidence.push({ name, snapshot: await page.locator('body').ariaSnapshot() });
  };
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  let run = 0;
  const nonce = await page.evaluate(() => Date.now());
  const goto = (hash = '') => page.goto(`${base}&stateUiRun=${nonce}-${++run}#ver=8&p=chromosome&c=neighborTssOverlap&g=M744_RS01690${hash}`);
  await page.setViewportSize({ width: 1280, height: 800 });

  try {
  await page.unroute('**/data/regulatory_tss.json*');
  await page.unroute('**/data/regulatory_tss.json');
  await page.unroute('**/data/tss_evidence.json*');
  await page.unroute('**/data/data-manifest.json*');

  // Hold a source payload until the loaded tier-one app exposes the suspended state.
  const held = new Promise((resolve) => { release = resolve; });
  await page.route('**/data/regulatory_tss.json*', async (route) => { const continuation = held.then(() => route.continue()); heldContinuations.push(continuation); await continuation; });
  await page.goto(`${base}&stateUiRun=${nonce}-loading#ver=8&p=native&c=functionCategory&ds=TAN2018_TSS_CONTROL`);
  await page.locator('.neighbor-site-filter').waitFor();
  await page.waitForFunction(() => document.querySelector('.neighbor-site-filter')?.innerText.includes('loading'));
  check(await page.locator('.neighbor-site-filter').innerText().then((text) => text.includes('loading')), 'loading says unknown');
  check(await page.locator('#neighbor-site-filter-without').isDisabled(), 'loading suspends narrowing');
  check(await page.locator('.neighbor-site-mark').count() === 0, 'loading has no marker targets');
  await save('site-loading');
  release();
  await page.waitForFunction(() => { const input = document.querySelector('#neighbor-site-filter-without'); return input && !input.disabled; });
  await page.unroute('**/data/regulatory_tss.json*');

  expectedHttpFailure = true;
  await page.route('**/data/regulatory_tss.json*', (route) => { expectedFailureUrl = route.request().url(); return route.fulfill({ status: 503, body: '{}', contentType: 'application/json' }); });
  await goto('&ns=without');
  await page.waitForFunction(() => document.querySelector('.neighbor-site-filter')?.innerText.includes('failed to load'));
  check(await page.locator('#neighbor-site-filter-without').isDisabled(), 'error suspends narrowing');
  check(await page.locator('.neighbor-site-mark').count() === 0, 'error has no marker targets');
  check(await page.locator('#chromosome-view .neighbor-site-legend').innerText().then((text) => text.includes('Evidence unavailable (2,715)')), 'error unknown colour bucket');
  await save('site-error');
  await page.unroute('**/data/regulatory_tss.json*');
  await page.getByRole('button', { name: /Retry loading.*regulatory/i }).click();
  await page.waitForFunction(() => { const input = document.querySelector('#neighbor-site-filter-without'); return input && !input.disabled; });
  expectedHttpFailure = false;
  check(await page.locator('.neighbor-site-filter').innerText().then((text) => text.includes('With recorded overlap (603)')), 'retry restores same relation');
  await save('site-retry');

  // With available evidence, unavailable-only is a known empty result, not a failure.
  await page.locator('#neighbor-site-filter-unavailable').check();
  check(await page.locator('#chromosome-view canvas').getAttribute('aria-label').then((text) => text.includes('0 of them passing')), 'unavailable-only known empty result');
  await save('empty-filter');
  await page.getByRole('button', { name: 'Clear all filters', exact: true }).click();
  check(await page.locator('#neighbor-site-filter-any').isChecked(), 'clear all filters resets neighbour channel');
  check(!page.url().includes('ns='), 'clear removes URL field');

  // Existing source selection semantics: different informing conditions, identical coordinates/counts.
  for (const source of ['TAN2018_TSS_DARK','TAN2018_TSS_HIGH_LIGHT','TAN2018_TSS_HIGH_TEMPERATURE','TAN2018_TSS']) {
    await goto(`&ds=${source}`);
    await page.waitForFunction(() => { const input = document.querySelector('#neighbor-site-filter-with'); return input && !input.disabled; });
    check(await page.locator('.neighbor-site-filter').innerText().then((text) => text.includes('With recorded overlap (603)')), `${source} preserves source coordinates`);
  }

  // A test-only source response supplies multiple owners/conditions at coincident native points.
  const fixture = await page.evaluate(async () => {
    const document = await (await fetch('data/tss_evidence.json')).json();
    const record = { id: 'ui-coincident+', type: 'gTSS', position: 319780, replicon: 'CP006471', strand: '+', sourceStartDistanceNt: 99999,
      rawReads: { control: [0,2], dark: [3,4], highLight: [5,6], highTemperature: [7,8] } };
    document.M744_RS01695.push(record, { ...record, condition: 'duplicate condition' });
    document.M744_RS01685 = [...(document.M744_RS01685 ?? []), record, { ...record, id: 'ui-coincident-', strand: '-' }];
    const body = JSON.stringify(document);
    const bytes = new TextEncoder().encode(body);
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    const sha256 = [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join('');
    return { body, bytes: bytes.length, sha256 };
  });
  await page.route('**/data/data-manifest.json*', async (route) => {
    const response = await route.fetch(); const manifest = await response.json();
    manifest.files['tss_evidence.json'] = { bytes: fixture.bytes, sha256: fixture.sha256 };
    await route.fulfill({ response, json: manifest });
  });
  await page.route('**/data/tss_evidence.json*', (route) => route.fulfill({ body: fixture.body, contentType: 'application/json' }));
  await goto('&ds=TAN2018_TSS_CONTROL');
  await page.waitForFunction(() => document.querySelector('.neighbor-site-details > summary')?.textContent.includes('20 distinct sites'));
  await page.locator('.chromosome-sequence').getByRole('button', { name: 'Fit the whole gene into the strip', exact: true }).click();
  const sequencePanel = page.locator('.chromosome-sequence .neighbor-site-details');
  await sequencePanel.locator('summary').first().click();
  check(await sequencePanel.locator('.neighbor-site-row').count() === 20, 'two coincident points retained, condition repeats deduped');
  check(await sequencePanel.innerText().then((text) => text.includes('multiple associations')), 'multiple native owners explicit');
  const coincident = page.locator('.chromosome-sequence .neighbor-site-mark[data-position="319780"]');
  check(await coincident.count() === 2, 'both coincident marks retained');
  await coincident.first().focus();
  check(await coincident.first().evaluate((node) => node === document.activeElement), 'coincident native target keyboard focus');
  const firstRow = sequencePanel.locator('.neighbor-site-row').filter({ hasText: 'ui-coincident+' });
  await firstRow.locator('.neighbor-site-provenance > summary').click();
  await firstRow.locator('dl').first().waitFor();
  check(await firstRow.innerText().then((text) => text.includes('99999') && text.includes('[0,2]')), 'source distances/conditions remain raw rather than coordinates');
  await page.locator('.gene-sequence-strip').scrollIntoViewIfNeeded();
  await save('coincident-sites');
  await page.unroute('**/data/tss_evidence.json*');
  await page.unroute('**/data/data-manifest.json*');

  // Real in-CDS non-gTSS association is displayed as source context.
  await goto('&g=M744_RS00665&ds=TAN2018_TSS_CONTROL');
  await page.locator('.chromosome-sequence .neighbor-site-details > summary').click();
  check(await page.locator('.chromosome-sequence .neighbor-site-details').innerText().then((text) => text.includes('iTSS+125110') && text.includes('M744_RS00660')), 'mapped internal site kept');
  await save('mapped-internal-tss');
  await goto('&g=M744_RS14095&ds=TAN2018_TSS_CONTROL');
  await page.waitForFunction(() => document.querySelector('.neighbor-site-filter')?.textContent.includes('With recorded overlap (603)'));
  for (const panel of [page.locator('#chromosome-view .neighbor-site-details').first(), page.locator('.chromosome-sequence .neighbor-site-details')]) {
    if (await panel.getAttribute('open') === null) await panel.locator('summary').first().click();
    const unassigned = panel.locator('.neighbor-site-row').filter({ hasText: 'nTSS+228011' });
    check(await unassigned.count() === 1, 'unassigned source evidence is retained');
    check(await unassigned.locator('button').count() === 0, 'no unassigned marker action without a resolved neighbour');
  }
  await save('unassigned-site-context');
  check(errors.length === 0, `Unexpected runtime errors: ${errors.join('; ')}`);
  check(failures.length === 0, `Unexpected failed requests: ${failures.join('; ')}`);
  return { passed: true, states: evidence, errors, failures };
  } finally {
    release?.();
    await Promise.allSettled(heldContinuations);
    await page.unroute('**/data/regulatory_tss.json*');
    await page.unroute('**/data/regulatory_tss.json');
    await page.unroute('**/data/tss_evidence.json*');
    await page.unroute('**/data/data-manifest.json*');
  }
}

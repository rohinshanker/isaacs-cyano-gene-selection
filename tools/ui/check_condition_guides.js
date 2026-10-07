/** Run with playwright-cli -s=<unique-session> run-code --filename=tools/ui/check_condition_guides.js. */
async (page) => {
  const { root, base } = await page.evaluate(() => ({
    root: new URL(location.href).searchParams.get('uiArtifacts'), base: location.href.split('#')[0],
  }));
  if (!root?.startsWith('/')) throw new Error('Open the site with ?uiArtifacts=<absolute ignored artifact directory>.');
  const errors = [];
  const onError = (error) => errors.push(error.message);
  const onConsole = (message) => { if (message.type() === 'error') errors.push(message.text()); };
  const onRequest = (request) => errors.push(`${request.url()}: ${request.failure()?.errorText}`);
  page.on('pageerror', onError);
  page.on('console', onConsole);
  page.on('requestfailed', onRequest);
  const check = (ok, message) => { if (!ok) throw new Error(message); };
  const results = [];
  const fresh = (route) => route.continue();
  await page.route('**/*', fresh);
  try {
    await page.goto(base);
    await page.locator('#color-by').selectOption('type.transcriptomics.rna-seq.abundance');
    await page.locator('#data-sources summary').click();
    await page.locator('#data-sources .data-sources-change').click();
    const list = page.locator('.peek-backdrop:not([hidden]) .peek-list');
    const guide = page.locator('.peek-backdrop:not([hidden]) .ds-column-guides');
    const inspect = async (axis, label) => {
      const header = list.locator(`.ds-axis-header[data-condition-axis="${axis}"]`);
      await header.scrollIntoViewIfNeeded();
      await header.hover();
      const result = await page.evaluate(() => {
        const guide = document.querySelector('.peek-backdrop:not([hidden]) .ds-column-guides');
        const header = document.querySelector(`.peek-backdrop:not([hidden]) .ds-axis-header[data-condition-axis="${guide.dataset.conditionAxis}"] svg`);
        const count = document.querySelector('.peek-backdrop:not([hidden]) .peek-count');
        const a = [...header.querySelectorAll('line')].map((line) => line.getBoundingClientRect().x);
        const b = [...guide.querySelectorAll('line')].map((line) => line.getBoundingClientRect().x);
        const bounds = guide.getBoundingClientRect();
        return { axis: guide.dataset.conditionAxis, hidden: guide.hasAttribute('hidden'),
          end: bounds.bottom, countEnd: count.getBoundingClientRect().bottom,
          ticks: b.map((x) => Math.min(...a.map((y) => Math.abs(x - y)))),
          pointerEvents: getComputedStyle(guide).pointerEvents,
          overflow: document.documentElement.scrollWidth > innerWidth,
          controls: [...document.querySelectorAll('.peek-head button')].map((node) => {
            const r = node.getBoundingClientRect(); return { text: node.textContent, left: r.left, right: r.right };
          }) };
      });
      check(!result.hidden && result.axis === axis, `${label}: immediate ${axis} entry`);
      check(result.ticks.length > 0 && result.ticks.every((delta) => delta < 1), `${label}: tick alignment`);
      check(Math.abs(result.end - result.countEnd) < 1, `${label}: footer endpoint`);
      check(result.pointerEvents === 'none', `${label}: guide intercepts pointer`);
      check(!result.overflow, `${label}: page overflow`);
      check(result.controls.every((r) => r.left >= 0 && r.right <= page.viewportSize().width), `${label}: header controls outside viewport`);
      await page.screenshot({ path: `${root}/${label}-${axis}.png` });
      return result;
    };
    for (const [width, height] of [[375, 812], [768, 1024], [1280, 800], [1440, 900], [599, 812], [601, 812], [1319, 900], [1321, 900]]) {
      await page.setViewportSize({ width, height });
      for (const axis of ['temperature', 'lightIntensity', 'co2']) await inspect(axis, `guides-${width}`);
      // A sticky header moves with its list; scroll still aligns the guides.
      await list.evaluate((node) => { node.scrollTop = 350; });
      await inspect('lightIntensity', `scrolled-${width}`);
      await page.mouse.move(1, 1);
      check(await guide.getAttribute('hidden') === '', 'exit must hide guides');
      results.push({ width, height });
    }
    await page.setViewportSize({ width: 1280, height: 800 });
    await list.evaluate((node) => { node.scrollTop = 0; node.scrollLeft = 0; });
    await page.locator('.peek-add-filter').selectOption('study');
    await page.locator('.peek-filter input[type="search"]').fill('GSE104203');
    check((await page.locator('.peek-count').textContent()).startsWith('4 of 17'), 'short list count');
    await inspect('temperature', 'filtered');
    await page.getByLabel('Flat table', { exact: true }).check();
    check(await guide.getAttribute('hidden') === '', 'list replacement clears guides');
    await inspect('co2', 'flat-filtered');
    await page.locator('.peek-filter input[type="search"]').fill('no-study-exists');
    check((await page.locator('.ds-empty').textContent()).includes('No dataset matches'), 'empty state');
    await inspect('lightIntensity', 'empty');
    await page.getByRole('tab', { name: 'Proteomics (3)', exact: true }).click();
    check(await guide.getAttribute('hidden') === '', 'tab change clears guides');
    check(await page.locator('.peek-filter-remove').count() === 0, 'tab change resets per-tab filters');
    await inspect('co2', 'proteomics');
    await page.getByRole('tab', { name: 'Proteomics (3)', exact: true }).focus();
    await page.keyboard.press('End');
    check(await page.getByRole('tab', { name: 'Fitness screen (9)', exact: true }).getAttribute('aria-selected') === 'true', 'keyboard End selects fitness');
    await page.keyboard.press('Home');
    check(await page.getByRole('tab', { name: 'Transcriptomics (17)', exact: true }).getAttribute('aria-selected') === 'true', 'keyboard Home selects transcriptomics');
    const row = list.locator('tr[data-id] input').first();
    await row.focus();
    const rowLabel = await row.getAttribute('aria-label');
    await page.keyboard.press('Space');
    check(await list.locator('input').evaluateAll((nodes, label) => nodes.some((node) => node.getAttribute('aria-label') === label && node === document.activeElement), rowLabel), 'row update preserves focus');
    await page.locator('.peek-done').focus();
    await page.keyboard.press('Tab');
    check(await page.getByRole('tab', { name: 'Transcriptomics (17)', exact: true }).evaluate((node) => node === document.activeElement), 'focus trap wraps');
    await page.keyboard.press('Escape');
    check(await page.locator('.peek-backdrop:not([hidden])').count() === 0, 'dialog closes');
    check(await page.locator('#data-sources .data-sources-change').evaluate((node) => node === document.activeElement), 'focus returns');
    check(await page.locator('.ds-column-guides').getAttribute('hidden') === '', 'closed overlay hidden');
    check(errors.length === 0, `runtime diagnostics: ${errors.join('; ')}`);
    return { results, runtimeErrors: errors, states: ['grouped', 'flat', 'filtered', 'empty', 'scrolled', 'tab-changed', 'closed'] };
  } finally {
    await page.unroute('**/*', fresh);
    page.off('pageerror', onError);
    page.off('console', onConsole);
    page.off('requestfailed', onRequest);
  }
}

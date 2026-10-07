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
    const tabNames = await page.locator('.peek-tab').allTextContents();
    const typeTotal = await list.locator('tr[data-id]').count();
    const filterStudy = await list.locator('tr[data-id] .ds-acc').first().textContent();
    const matchingCount = await list.locator('tr[data-id] .ds-acc').evaluateAll((nodes, study) => nodes.filter((node) => node.textContent === study).length, filterStudy);
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
        const column = { temperature: 3, lightIntensity: 4, co2: 5 }[guide.dataset.conditionAxis];
        const row = document.querySelector(`.peek-backdrop:not([hidden]) .ds-table td:nth-child(${column}) svg`);
        const rowTicks = row ? [...row.querySelectorAll('line')].filter((line) => line.getAttribute('x1') === line.getAttribute('x2')).map((line) => line.getBoundingClientRect().x) : [];
        const side = document.querySelector('.peek-backdrop:not([hidden]) .peek-side').getBoundingClientRect();
        return { axis: guide.dataset.conditionAxis, hidden: guide.hasAttribute('hidden'),
          end: bounds.bottom, countEnd: count.getBoundingClientRect().bottom,
          crossesComparison: innerWidth <= 1320 && bounds.bottom > side.top + 1,
          rowAlignment: b.map((x) => rowTicks.length ? Math.min(...rowTicks.map((y) => Math.abs(x - y))) : 0),
          ticks: b.map((x) => Math.min(...a.map((y) => Math.abs(x - y)))),
          pointerEvents: getComputedStyle(guide).pointerEvents,
          overflow: document.documentElement.scrollWidth > innerWidth,
          controls: [...document.querySelectorAll('.peek-head button')].map((node) => {
            const r = node.getBoundingClientRect(); return { text: node.textContent, left: r.left, right: r.right };
          }) };
      });
      check(!result.hidden && result.axis === axis, `${label}: immediate ${axis} entry`);
      check(!result.crossesComparison, `${label}: guides cross unrelated comparison scales`);
      check(result.rowAlignment.every((delta) => delta < 1), `${label}: row tick alignment`);
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
    await page.locator('.peek-filter input[type="search"]').fill(filterStudy);
    check((await page.locator('.peek-count').textContent()).startsWith(`${matchingCount} of ${typeTotal}`), 'short list count');
    await inspect('temperature', 'filtered');
    await page.getByLabel('Flat table', { exact: true }).check();
    check(await guide.getAttribute('hidden') === '', 'list replacement clears guides');
    await inspect('co2', 'flat-filtered');
    await page.locator('.peek-filter input[type="search"]').fill('no-study-exists');
    check((await page.locator('.ds-empty').textContent()).includes('No dataset matches'), 'empty state');
    await inspect('lightIntensity', 'empty');
    await page.getByRole('tab', { name: tabNames[1], exact: true }).click();
    check(await guide.getAttribute('hidden') === '', 'tab change clears guides');
    check(await page.locator('.peek-filter-remove').count() === 0, 'tab change resets per-tab filters');
    await inspect('co2', 'proteomics');
    await page.getByRole('tab', { name: tabNames[0], exact: true }).click();
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.waitForFunction(() => document.querySelector('.peek-backdrop:not([hidden]) .peek-body').lastElementChild.classList.contains('peek-foot'));
    await page.locator('.peek-backdrop:not([hidden]) .ds-info').first().click();
    const lastListControl = list.locator('input,button').last();
    const sideBack = page.locator('.peek-backdrop:not([hidden]) .peek-side button').first();
    const lastSideLink = page.locator('.peek-backdrop:not([hidden]) .peek-side a').last();
    await lastListControl.focus(); await page.keyboard.press('Tab');
    check(await sideBack.evaluate((node) => node === document.activeElement), 'wide order: list then side');
    await lastSideLink.focus(); await page.keyboard.press('Tab');
    check(await page.locator('.peek-done').evaluate((node) => node === document.activeElement), 'wide order: side then footer');
    await lastSideLink.focus();
    await list.evaluate((node) => { node.scrollTop = 350; });
    const scrollBefore = await page.locator('.peek-backdrop:not([hidden]) .peek-body').evaluate((node) => ({ list: node.querySelector('.peek-list').scrollTop, side: node.querySelector('.peek-side').scrollTop }));
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.waitForFunction(() => document.querySelector('.peek-backdrop:not([hidden]) .peek-body').children[1].classList.contains('peek-foot'));
    check(await lastSideLink.evaluate((node) => node === document.activeElement), 'resize preserves focus');
    const scrollAfter = await page.locator('.peek-backdrop:not([hidden]) .peek-body').evaluate((node) => ({ list: node.querySelector('.peek-list').scrollTop, side: node.querySelector('.peek-side').scrollTop }));
    check(scrollAfter.list > 0 && (scrollBefore.side === 0 || scrollAfter.side > 0), 'resize does not reset pane scroll positions');
    check(await lastSideLink.evaluate((node) => { const a = node.getBoundingClientRect(); const b = node.closest('.peek-side').getBoundingClientRect(); return a.top >= b.top && a.bottom <= b.bottom; }), 'restored focus stays visible');
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.waitForFunction(() => document.querySelector('.peek-backdrop:not([hidden]) .peek-body').lastElementChild.classList.contains('peek-foot'));
    await list.evaluate((node) => { node.scrollTop = 600; });
    const checkboxIndex = await list.locator('tr[data-id] input').evaluateAll((nodes) => nodes.findIndex((node) => {
      const a = node.getBoundingClientRect(); const pane = node.closest('.peek-list');
      const h = pane.querySelector('thead th').getBoundingClientRect(); const b = pane.getBoundingClientRect();
      return a.top > h.bottom + 2 && a.bottom < b.bottom;
    }));
    check(checkboxIndex >= 0, 'scrolled list has a visible row control');
    const focusedRow = list.locator('tr[data-id] input').nth(checkboxIndex);
    await focusedRow.focus();
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.waitForFunction(() => document.querySelector('.peek-backdrop:not([hidden]) .peek-body').children[1].classList.contains('peek-foot'));
    check(await focusedRow.evaluate((node) => { const r = node.getBoundingClientRect(); return node === document.activeElement && document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2) === node; }), 'focused row is not behind the sticky header');
    check(await focusedRow.evaluate((node) => { const row = node.closest('tr'); const r = row.getBoundingClientRect(); const header = node.closest('.peek-list').querySelector('thead th').getBoundingClientRect(); return r.top > header.bottom; }), 'focused row context clears the sticky header');
    await lastListControl.focus(); await page.keyboard.press('Tab');
    check(await page.locator('.peek-done').evaluate((node) => node === document.activeElement), 'stacked order: list then footer');
    await page.keyboard.press('Tab');
    check(await sideBack.evaluate((node) => node === document.activeElement), 'stacked order: footer then side');
    await page.getByRole('tab', { name: tabNames[0], exact: true }).click();
    const fields = await page.locator('.peek-add-filter option').evaluateAll((nodes) => nodes.map((node) => node.value).filter(Boolean));
    for (const field of fields) await page.locator('.peek-add-filter').selectOption(field);
    for (const [width, height] of [[375, 812], [768, 1024], [1280, 800], [1440, 900]]) {
      await page.setViewportSize({ width, height });
      const layout = await page.evaluate(() => ({
        listHeight: document.querySelector('.peek-backdrop:not([hidden]) .peek-list').getBoundingClientRect().height,
        footerBottom: document.querySelector('.peek-backdrop:not([hidden]) .peek-foot').getBoundingClientRect().bottom,
        overflow: document.documentElement.scrollWidth > innerWidth,
      }));
      check(layout.listHeight >= 100 && layout.footerBottom <= height && !layout.overflow, 'maximum filters keep table and footer usable');
      await page.screenshot({ path: `${root}/all-filters-${width}.png` });
    }
    await page.getByRole('tab', { name: tabNames[1], exact: true }).click();
    await page.getByRole('tab', { name: tabNames[1], exact: true }).focus();
    await page.keyboard.press('End');
    check(await page.getByRole('tab', { name: tabNames[2], exact: true }).getAttribute('aria-selected') === 'true', 'keyboard End selects fitness');
    await page.keyboard.press('Home');
    check(await page.getByRole('tab', { name: tabNames[0], exact: true }).getAttribute('aria-selected') === 'true', 'keyboard Home selects transcriptomics');
    const row = list.locator('tr[data-id] input').first();
    await row.focus();
    const rowLabel = await row.getAttribute('aria-label');
    await page.keyboard.press('Space');
    check(await list.locator('input').evaluateAll((nodes, label) => nodes.some((node) => node.getAttribute('aria-label') === label && node === document.activeElement), rowLabel), 'row update preserves focus');
    await page.locator('.peek-done').focus();
    await page.keyboard.press('Tab');
    check(await page.getByRole('tab', { name: tabNames[0], exact: true }).evaluate((node) => node === document.activeElement), 'focus trap wraps');
    await page.keyboard.press('Escape');
    check(await page.locator('.peek-backdrop:not([hidden])').count() === 0, 'dialog closes');
    check(await page.locator('#data-sources .data-sources-change').evaluate((node) => node === document.activeElement), 'focus returns');
    check(await page.locator('.ds-column-guides').getAttribute('hidden') === '', 'closed overlay hidden');
    check(errors.length === 0, `runtime diagnostics: ${errors.join('; ')}`);
    return { results, runtimeErrors: errors, states: ['grouped', 'flat', 'filtered', 'empty', 'scrolled', 'tab-changed', 'maximum-filters', 'closed'] };
  } finally {
    await page.unroute('**/*', fresh);
    page.off('pageerror', onError);
    page.off('console', onConsole);
    page.off('requestfailed', onRequest);
  }
}

/** Run with playwright-cli run-code --filename=tools/ui/check_fitness_controls.js. */
async (page) => {
  const { root, base } = await page.evaluate(() => ({
    root: new URL(location.href).searchParams.get('uiArtifacts'),
    base: location.href.split('#')[0],
  }));
  if (!root?.startsWith('/')) throw new Error('An absolute uiArtifacts directory is required.');
  const check = (ok, message) => { if (!ok) throw new Error(message); };
  const errors = [];
  const onError = (error) => errors.push(error.message);
  const onConsole = (message) => { if (message.type() === 'error') errors.push(message.text()); };
  const onRequest = (request) => errors.push(`${request.url()}: ${request.failure()?.errorText}`);
  page.on('pageerror', onError);
  page.on('console', onConsole);
  page.on('requestfailed', onRequest);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const evidence = [];
  const sizes = [[375, 812], [699, 900], [701, 900], [768, 1024], [1280, 800], [1440, 900]];
  const mainPeek = page.locator('.peek-backdrop:not(.peek-backdrop-stacked) .peek');
  const grid = page.locator('.condition-grid');
  const row = mainPeek.locator('.ds-compendium');
  const count = grid.locator('.peek-count');
  const openSelection = async () => {
    const details = page.locator('#data-sources details');
    if (await details.getAttribute('open') === null) await details.locator('summary').click();
    await page.locator('#data-sources .data-sources-change').click();
    await page.getByRole('tab', { name: 'Fitness screen (99)', exact: true }).click();
  };
  const layout = async (label, dialog = null) => {
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    check(overflow <= 1, `${label}: page overflow ${overflow}`);
    if (dialog) {
      const box = await dialog.boundingBox();
      const viewport = page.viewportSize();
      check(box.x >= 0 && box.y >= 0 && box.x + box.width <= viewport.width + 1
        && box.y + box.height <= viewport.height + 1, `${label}: dialog outside viewport`);
    }
    return { label, overflow };
  };
  try {
    await page.goto('about:blank');
    await page.goto(`${base}#ver=6&c=type.fitness.rb-tnseq.fitness&pc=none`);
    await page.waitForFunction(() => document.querySelector('#legend')?.textContent.includes('across 90 condition sets'));
    check(await page.locator('#legend .provenance-warning').innerText()
      .then((text) => text.includes('1,819 of 2,715')), 'recovered gene coverage reaches the visible metric');
    for (const [width, height] of sizes) {
      await page.setViewportSize({ width, height });
      await page.locator('#legend').scrollIntoViewIfNeeded();
      const warning = page.locator('#legend .provenance-warning');
      check(await warning.evaluate((node) => node.scrollWidth <= node.clientWidth + 1),
        `pooled source identifiers overflow at ${width}`);
      evidence.push(await layout(`legend-${width}`));
      await page.screenshot({ path: `${root}/legend-${width}.png` });
    }
    await openSelection();
    check(await row.count() === 1, 'one compendium row, across all condition groups');
    check(await mainPeek.locator('tr[data-id]').count() === 9, 'nine biofilm fractions remain separate');
    check(await row.locator('input[type=checkbox]').isChecked(), 'whole compendium selected by default');
    check(await mainPeek.locator('tr[data-id] input[type=checkbox]:checked').count() === 0,
      'biofilm fractions excluded from the default pool');
    const chooser = row.getByRole('button', { name: 'Choose conditions', exact: true });
    await chooser.click();
    check(await grid.locator('label.cg-cell').count() === 90, 'every condition is reachable');
    check(await grid.locator('.cg-rowhead input').count() === 33, 'one row per dosed compound');
    check(await grid.locator('.cg-row-loose label.cg-cell').count() === 1, 'undosed control stays separate');
    check(await mainPeek.getAttribute('inert') !== null, 'lower dialog inert while grid is open');
    check(await grid.getAttribute('inert') === null, 'topmost dialog interactive');
    check(await grid.locator('.peek-close').evaluate((node) => node === document.activeElement), 'initial focus');
    await page.keyboard.press('Shift+Tab');
    check(await grid.locator('.peek-done').evaluate((node) => node === document.activeElement), 'backward focus trap');
    await page.keyboard.press('Tab');
    check(await grid.locator('.peek-close').evaluate((node) => node === document.activeElement), 'forward focus trap');
    for (const [width, height] of sizes) {
      await page.setViewportSize({ width, height });
      evidence.push(await layout(`grid-${width}`, grid));
      await page.screenshot({ path: `${root}/grid-${width}.png` });
    }
    await page.keyboard.press('Escape');
    check(await grid.isVisible() === false && await mainPeek.isVisible(), 'Escape closes only topmost dialog');
    check(await mainPeek.getAttribute('inert') === null, 'lower dialog interactive again');
    check(await chooser.evaluate((node) => node === document.activeElement), 'focus returns to lower opener');
    await chooser.click();
    await grid.getByRole('button', { name: 'Clear all', exact: true }).click();
    check(await count.textContent() === '0 of 90 conditions selected', 'empty draft');
    await page.screenshot({ path: `${root}/grid-empty.png` });
    const name = await grid.locator('label.cg-cell input').first().getAttribute('aria-label');
    let cell = grid.getByRole('checkbox', { name, exact: true });
    await cell.focus();
    await page.keyboard.press('Space');
    cell = grid.getByRole('checkbox', { name, exact: true });
    check(await cell.isChecked() && await cell.evaluate((node) => node === document.activeElement),
      'keyboard selection retains focus after rerender');
    check(await count.textContent() === '1 of 90 conditions selected', 'single-condition draft');
    await grid.getByRole('button', { name: 'Select all', exact: true }).click();
    check(await count.textContent() === 'All 90 conditions selected, pooled', 'select all');
    await grid.getByRole('button', { name: 'Clear all', exact: true }).click();
    const compound = grid.locator('.cg-row').filter({ hasText: 'Aluminum chloride hydrate' });
    await compound.locator('.cg-rowhead input').check();
    check(await count.textContent() === '3 of 90 conditions selected', 'compound selects all of its doses');
    await compound.locator('label.cg-cell input').last().uncheck();
    check(await count.textContent() === '2 of 90 conditions selected', 'individual dose subset');
    await grid.getByRole('button', { name: 'Done', exact: true }).click();
    check(await row.innerText().then((text) => text.includes('2 selected')), 'subset returns to selection draft');
    await mainPeek.getByRole('button', { name: 'Done', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('#legend')?.textContent.includes('across 2 condition sets'));
    const sharedUrl = page.url();
    await page.reload();
    await page.waitForFunction(() => document.querySelector('#legend')?.textContent.includes('across 2 condition sets'));
    await openSelection();
    check(await row.innerText().then((text) => text.includes('2 selected')), 'link restores exact subset');
    await chooser.click();
    check(await grid.locator('label.cg-cell input:checked').count() === 2, 'two conditions restored');
    await page.screenshot({ path: `${root}/grid-restored.png` });
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
    check(await page.locator('.peek-backdrop:not([hidden])').count() === 0, 'both dialogs dismissed');
    check(await page.locator('#data-sources .data-sources-change')
      .evaluate((node) => node === document.activeElement), 'focus returns to toolbar opener');
    const fresh = await page.context().browser().newContext({ viewport: { width: 375, height: 812 } });
    try {
      const restored = await fresh.newPage();
      restored.on('pageerror', onError);
      restored.on('console', onConsole);
      restored.on('requestfailed', onRequest);
      await restored.emulateMedia({ reducedMotion: 'reduce' });
      await restored.goto(sharedUrl);
      await restored.waitForFunction(() => document.querySelector('#legend')?.textContent.includes('across 2 condition sets'));
      await restored.locator('#data-sources summary').click();
      await restored.locator('#data-sources .data-sources-change').click();
      await restored.getByRole('tab', { name: 'Fitness screen (99)', exact: true }).click();
      await restored.locator('.ds-compendium .ds-choose').click();
      const selectedNames = await restored.locator('.condition-grid label.cg-cell input:checked')
        .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('aria-label')).sort());
      check(JSON.stringify(selectedNames) === JSON.stringify([
        'Aluminum chloride hydrate at 0.078125 mM', 'Aluminum chloride hydrate at 0.15625 mM',
      ]), 'fresh browser context restores the exact two doses');
      await restored.screenshot({ path: `${root}/grid-fresh-context-375.png` });
    } finally {
      await fresh.close();
    }
    await openSelection();
    const poolBox = row.locator('input[type=checkbox]');
    await poolBox.check();
    await poolBox.uncheck();
    const fractions = await mainPeek.locator('tr[data-id]').evaluateAll((nodes) => nodes.map((node) => node.dataset.id));
    check(fractions.length === 9, 'nine biofilm fraction rows');
    for (const id of fractions) await mainPeek.locator(`tr[data-id="${id}"] input[type=checkbox]`).check();
    check(await mainPeek.locator('tr[data-id]').evaluateAll((nodes) => nodes.every((node) =>
      node.children[5].textContent.includes('not reported'))), 'biofilm schedule remains unknown');
    await mainPeek.getByRole('button', { name: 'Done', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('#legend')?.textContent.includes('across 9 condition sets'));
    await page.locator('#colour-help summary').click();
    const explanation = page.locator('#colour-help');
    const method = await explanation.innerText();
    check(method.includes('mean of 9 selected condition-set gene-fitness values'), 'nine-fraction pooled calculation');
    check(!method.includes('mean of 1 deposited sample column'), 'pooled calculation does not reuse one input');
    check(method.includes('T-values'), 'pooled statistical caveat retained');
    check(await explanation.getByRole('link', { name: 'GSE205443', exact: true }).getAttribute('href')
      === 'https://www.ncbi.nlm.nih.gov/geo/query/acc.cgi?acc=GSE205443', 'fitness archive link');
    check(await explanation.locator('a[href*="GSE205444"]').count() === 0, 'fitness explanation has no RNA-only link');
    for (const [width, height] of sizes) {
      await page.setViewportSize({ width, height });
      await explanation.scrollIntoViewIfNeeded();
      evidence.push(await layout(`biofilm-method-${width}`));
      await page.screenshot({ path: `${root}/biofilm-method-${width}.png` });
    }
    check(errors.length === 0, `runtime diagnostics: ${errors.join('; ')}`);
    return { ok: true, sharedUrl, evidence, errors,
      states: ['pooled-default', 'biofilm-separate', 'stacked-grid', 'empty', 'single',
        'all', 'compound', 'dose-subset', 'link-restored', 'closed', 'keyboard-focus',
        'biofilm-only', 'pooled-method', 'statistical-caveat', 'fitness-source-link'] };
  } finally {
    page.off('pageerror', onError);
    page.off('console', onConsole);
    page.off('requestfailed', onRequest);
    await cdp.detach();
  }
}

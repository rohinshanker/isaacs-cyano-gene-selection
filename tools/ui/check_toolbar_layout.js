/** Run with playwright-cli on /site/?uiArtifacts=<absolute ignored directory>. */
async (page) => {
  const { root, base } = await page.evaluate(() => {
    const url = new URL(location.href);
    url.hash = '';
    url.searchParams.delete('toolbarRun');
    url.searchParams.delete('sharedRun');
    return { root: url.searchParams.get('uiArtifacts'), base: url.href };
  });
  if (!root?.startsWith('/')) throw new Error('An absolute uiArtifacts directory is required.');
  const check = (ok, message) => { if (!ok) throw new Error(message); };
  const errors = [];
  const onError = (error) => errors.push(error.message);
  const onConsole = (message) => {
    if (message.type() === 'error') errors.push(message.text());
  };
  const onRequest = (request) => errors.push(request.url());
  page.on('pageerror', onError);
  page.on('console', onConsole);
  page.on('requestfailed', onRequest);
  const evidence = [];
  const widths = [[360, 812], [375, 812], [559, 900], [560, 900], [768, 1024],
    [959, 900], [960, 900], [1239, 900], [1240, 900], [1280, 800], [1440, 900]];
  const settle = () => page.waitForFunction(() => !document.body.classList.contains('is-loading')
    && document.querySelector('#load-progress-presentation').hidden);
  const geometry = (panel) => page.evaluate((panel) => {
    const prefix = panel === 'chromosome' ? 'chromosome-' : '';
    const box = (selector) => {
      const bounds = document.querySelector(selector).getBoundingClientRect();
      return { top: bounds.top, bottom: bounds.bottom, center: bounds.top + bounds.height / 2 };
    };
    const label = box(`label[for="${prefix}color-scale"]`);
    const popover = document.querySelector(`#${prefix}color-scale-info-popover`);
    const button = popover.parentElement.querySelector('button').getBoundingClientRect();
    return {
      labelCenter: label.center, buttonCenter: button.top + button.height / 2,
      scale: box(`#${prefix}color-scale`), colour: box(`#${prefix}color-by`),
      overflow: document.documentElement.scrollWidth - innerWidth,
      gap: panel === 'native' ? box('.canvas-host').top - box('.map-toolbar').bottom : null,
    };
  }, panel);
  try {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    for (const [width, height] of widths) {
      await page.setViewportSize({ width, height });
      for (const panel of ['native', 'chromosome']) {
        await page.mouse.move(0, 0);
        await page.goto(`${base}&toolbarRun=${panel}-${width}#ver=7&p=${panel}&c=functionCategory`);
        await settle();
        const chromosome = panel === 'chromosome';
        const colour = page.locator(chromosome ? '#chromosome-color-by' : '#color-by');
        const scale = page.locator(chromosome ? '#chromosome-color-scale' : '#color-scale');
        const popover = page.locator(chromosome
          ? '#chromosome-color-scale-info-popover' : '#color-scale-info-popover');
        const button = popover.locator('..').locator('button');
        const toolbar = page.locator(chromosome ? '.chromosome-toolbar' : '.map-toolbar');
        await toolbar.scrollIntoViewIfNeeded();
        await button.waitFor();
        check(await scale.isDisabled(), `${panel} ${width}: categorical Scale must be disabled`);
        const state = await geometry(panel);
        check(Math.abs(state.labelCenter - state.buttonCenter) <= 1,
          `${panel} ${width}: Scale label and icon are not centered`);
        check(Math.abs(state.scale.top - state.colour.top) <= 1,
          `${panel} ${width}: Colour by and Scale selects are not aligned`);
        check(state.overflow <= 0, `${panel} ${width}: horizontal page overflow`);
        if (!chromosome) check(state.gap >= 7 && state.gap <= 9,
          `${panel} ${width}: toolbar-to-map gap is not the intended 8px`);
        check((await button.getAttribute('aria-label')).includes('colour scale'),
          `${panel} ${width}: Scale info has no accessible name`);
        await page.screenshot({ path: `${root}/toolbar-${panel}-${width}.png` });
        await page.locator(chromosome ? '.chromosome-figure' : '#map-view')
          .screenshot({ path: `${root}/toolbar-plot-${panel}-${width}.png` });
        await button.hover();
        await popover.waitFor({ state: 'visible' });
        await page.keyboard.press('Escape');
        await popover.waitFor({ state: 'hidden' });
        await page.mouse.move(0, 0);
        await colour.focus();
        await page.keyboard.press('Tab');
        check(await button.evaluate((node) => node === document.activeElement),
          `${panel} ${width}: info is not next in keyboard order`);
        await page.keyboard.press('Enter');
        await popover.waitFor({ state: 'visible' });
        const bounds = await popover.boundingBox();
        check(bounds.x >= 15 && bounds.x + bounds.width <= width - 15
          && bounds.y >= 15 && bounds.y + bounds.height <= height - 15,
        `${panel} ${width}: popover escaped viewport`);
        check(await popover.evaluate((node) => node.scrollWidth <= node.clientWidth + 1),
          `${panel} ${width}: popover text is clipped horizontally`);
        await page.screenshot({ path: `${root}/toolbar-info-${panel}-${width}.png` });
        await page.keyboard.press('Escape');
        await popover.waitFor({ state: 'hidden' });
        check(await button.evaluate((node) => node === document.activeElement),
          `${panel} ${width}: Escape lost trigger focus`);
        await colour.selectOption('rareCount');
        check(!await scale.isDisabled(), `${panel} ${width}: numeric Scale must be enabled`);
        await scale.selectOption('symlog');
        await button.click();
        check((await popover.textContent()).includes('Symmetric log'),
          `${panel} ${width}: Scale explanation did not update`);
        check(await popover.evaluate((node) => node.scrollWidth <= node.clientWidth + 1),
          `${panel} ${width}: symmetric-log explanation is clipped horizontally`);
        await page.screenshot({ path: `${root}/toolbar-symlog-${panel}-${width}.png` });
        await colour.click();
        await popover.waitFor({ state: 'hidden' });
        await page.keyboard.press('Escape');
        await scale.selectOption('percentile');
        await page.mouse.move(0, 0);
        await page.waitForTimeout(150);
        await button.focus();
        check((await popover.textContent()).includes('Percentile'),
          `${panel} ${width}: percentile explanation did not update`);
        await colour.focus();
        await popover.waitFor({ state: 'hidden' });
        const enabled = await geometry(panel);
        check(Math.abs(enabled.labelCenter - enabled.buttonCenter) <= 1
          && Math.abs(enabled.scale.top - enabled.colour.top) <= 1,
        `${panel} ${width}: enabled Scale alignment changed`);
        evidence.push({ width, height, panel, ...state, enabled: true });
      }
    }
    for (const [width, height] of [[375, 812], [768, 1024], [1280, 800]]) {
      await page.setViewportSize({ width, height });
      for (const panel of ['native', 'axes', 'risk', 'umap', 'perturbation']) {
        await page.goto(`${base}&sharedRun=${panel}-${width}#ver=7&p=${panel}&c=rareCount&ax=lengthNt&ay=cai&s=TCG-AGC.TCA-AGT.TAG-TAA&n=Syn61`);
        await settle();
        await page.locator('#zoom-in').waitFor();
        check(await page.locator('#zoom-in').isEnabled(), `${panel}: zoom is unavailable`);
        const canvas = page.locator('#map-canvas');
        const before = await canvas.evaluate((node) => node.toDataURL());
        await page.locator('#zoom-in').click();
        await canvas.evaluate(() => new Promise((resolve) => {
          requestAnimationFrame(() => requestAnimationFrame(resolve));
        }));
        check(await canvas.evaluate((node) => node.toDataURL()) !== before,
          `${panel} ${width}: Zoom in did not change the rendered plot`);
        await page.locator('#zoom-out').click();
        await canvas.focus();
        await page.keyboard.press('Shift+ArrowRight');
        await page.locator('#reset-view').click();
        const bounds = await canvas.boundingBox();
        check(bounds.width > 250 && bounds.height >= 320,
          `${panel} ${width}: plot was shrunk below its normal size`);
        const state = await geometry('native');
        check(state.gap === 8 && state.overflow <= 0, `${panel} ${width}: shared layout drifted`);
        evidence.push({ width, height, panel, sharedLayout: true, canvas: bounds });
      }
      await page.locator('#gene-search').fill('M744_RS00005');
      await page.locator('#gene-search-results').waitFor({ state: 'visible' });
      const search = await page.evaluate(() => ({
        toolbarBottom: document.querySelector('.map-toolbar').getBoundingClientRect().bottom,
        results: document.querySelector('#gene-search-results').getBoundingClientRect().toJSON(),
        plotTop: document.querySelector('.canvas-host').getBoundingClientRect().top,
      }));
      check(search.results.top >= search.toolbarBottom + 7 && search.plotTop >= search.results.bottom,
        `${width}: search results overlap the buttons or plot`);
      await page.locator('#map-view').screenshot({ path: `${root}/toolbar-search-${width}.png` });
      await page.locator('#gene-search').fill('');
      await page.getByRole('combobox', { name: 'Add filter', exact: true }).selectOption('lengthNt');
      await page.locator('#filter-add').locator('..').getByRole('button', { name: 'Add', exact: true }).click();
      await page.locator('#filter-lengthNt-max').fill('300');
      await page.locator('#filter-lengthNt-max').press('Tab');
      await page.locator('#filter-banner').waitFor({ state: 'visible' });
      const filter = await page.evaluate(() => ({
        toolbarBottom: document.querySelector('.map-toolbar').getBoundingClientRect().bottom,
        banner: document.querySelector('#filter-banner').getBoundingClientRect().toJSON(),
        plotTop: document.querySelector('.canvas-host').getBoundingClientRect().top,
      }));
      check(filter.banner.top >= filter.toolbarBottom + 7 && filter.plotTop >= filter.banner.bottom,
        `${width}: filter status overlaps the buttons or plot`);
      await page.locator('#map-view').screenshot({ path: `${root}/toolbar-filter-${width}.png` });
    }
    check(errors.length === 0, `Browser errors: ${errors.join(' | ')}`);
    return { ok: true, evidence, errors };
  } finally {
    page.off('pageerror', onError);
    page.off('console', onConsole);
    page.off('requestfailed', onRequest);
  }
}

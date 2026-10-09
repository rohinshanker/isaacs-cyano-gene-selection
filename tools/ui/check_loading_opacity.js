/** Check real loading bars with a held dataset request and both motion preferences. */
async (page) => {
  const { root, base } = await page.evaluate(() => {
    const url = new URL(location.href);
    const root = url.searchParams.get('uiArtifacts');
    url.search = '';
    url.hash = '';
    return { root, base: url.href };
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
  let release = () => {};
  try {
    for (const motion of ['no-preference', 'reduce']) {
      await page.emulateMedia({ reducedMotion: motion });
      for (const [width, height] of [[375, 812], [768, 1024], [1280, 800], [1440, 900]]) {
        await page.setViewportSize({ width, height });
        const gate = new Promise((resolve) => { release = resolve; });
        const hold = async (route) => { await gate; await route.continue(); };
        await page.route('**/expression_layers.json*', hold);
        await page.goto(`${base}?uiArtifacts=${encodeURIComponent(root)}&opacityRun=${motion}-${width}&load-min=0#ver=7&p=native&c=functionCategory`);
        await page.waitForFunction(() => !document.body.classList.contains('is-loading'));
        await page.locator('#color-by').selectOption('type.transcriptomics.rna-seq.abundance');
        await page.locator('.dataset-color-progress:not([hidden])').waitFor();
        await page.locator('.load-progress.is-activity .load-chromosome').waitFor();
        const samples = [];
        for (let sample = 0; sample < 3; sample += 1) {
          if (sample > 0) await page.waitForTimeout(400);
          samples.push(await page.evaluate(() => {
            const selectors = ['.load-progress.is-activity .load-chromosome',
              '.dataset-color-progress.is-activity .dataset-color-progress-meter'];
            return selectors.map((selector) => {
              const node = document.querySelector(selector);
              const style = getComputedStyle(node);
              return { selector, opacity: style.opacity, animation: style.animationName,
                text: node.getAttribute('aria-valuetext') };
            });
          }));
        }
        check(samples.flat().every((sample) => sample.opacity === '1' && sample.animation === 'none'),
          `${motion} ${width}: loading opacity or animation changed`);
        await page.locator('#load-progress-presentation').screenshot({
          path: `${root}/loading-chromosome-opacity-${motion}-${width}.png`,
        });
        await page.locator('.canvas-host').scrollIntoViewIfNeeded();
        await page.screenshot({ path: `${root}/loading-opacity-${motion}-${width}.png` });
        release();
        await page.waitForFunction(() => document.querySelector('#load-progress-presentation').hidden
          && document.querySelector('.dataset-color-progress').hidden);
        await page.unroute('**/expression_layers.json*', hold);
        check(!await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
          `${motion} ${width}: page overflow`);
        evidence.push({ motion, width, height, samples, recovered: true });
      }
    }
    check(errors.length === 0, `Browser errors: ${errors.join(' | ')}`);
    return { ok: true, evidence, errors };
  } finally {
    release();
    await page.unroute('**/expression_layers.json*');
    page.off('pageerror', onError);
    page.off('console', onConsole);
    page.off('requestfailed', onRequest);
  }
}

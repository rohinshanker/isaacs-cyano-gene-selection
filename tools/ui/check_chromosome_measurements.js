/** Run via playwright-cli on published UTEX data with ?uiArtifacts=<absolute ignored directory>. */
async (page) => {
  const { root, base, hasOverride } = await page.evaluate(() => ({
    root: new URL(location.href).searchParams.get('uiArtifacts'),
    base: location.href.split('#')[0],
    hasOverride: ['org', 'data'].some((key) => new URL(location.href).searchParams.has(key)),
  }));
  if (!root?.startsWith('/') || hasOverride) {
    throw new Error('Use published UTEX data and an absolute uiArtifacts directory.');
  }
  const errors = [];
  const onError = (error) => errors.push(error.message);
  const onRequest = (request) => errors.push(request.url());
  const onConsole = (message) => { if (message.type() === 'error') errors.push(message.text()); };
  page.on('pageerror', onError); page.on('requestfailed', onRequest); page.on('console', onConsole);
  const check = (ok, message) => {
    if (!ok || errors.length) throw new Error([message, ...errors].join('\n'));
  };
  const settle = () => page.waitForFunction(() => performance.getEntriesByName('cyano:settled').length > 0);
  const instrument = () => page.evaluate(async () => {
    const { ChromosomeView } = await import('/js/ui/chromosome-view.js');
    const original = ChromosomeView.prototype.update;
    window.__chromosomeCheck = { original, prototype: ChromosomeView.prototype, updates: 0 };
    ChromosomeView.prototype.update = function (...args) {
      window.__chromosomeCheck.view = this;
      window.__chromosomeCheck.updates += 1;
      return original.apply(this, args);
    };
  });
  const read = () => page.evaluate(async () => {
    const { view, updates } = window.__chromosomeCheck;
    const { values, metric } = view.model.colors;
    const bytes = values.buffer.slice(values.byteOffset, values.byteOffset + values.byteLength);
    const hash = await crypto.subtle.digest('SHA-256', bytes);
    return {
      hash: [...new Uint8Array(hash)].map((n) => n.toString(16).padStart(2, '0')).join(''),
      source: metric.provenance.id, pooled: metric.provenance.pooled,
      passing: view.model.passing, color: view.model.colorKey, updates,
    };
  });
  const key = 'type.transcriptomics.rna-seq.abundance';
  try {
    const initialUrl = await page.evaluate(async ({ base, key }) => {
      const { datasetsFrom, defaultSelection } = await import('/js/core/data-sources.js');
      const { typeGroups } = await import('/js/core/type-metrics.js');
      const all = datasetsFrom(await (await fetch('/data/meta.json')).json());
      const ids = typeGroups(all).get(key).datasets.map((d) => d.id);
      const selected = [...defaultSelection(all).filter((id) => !ids.includes(id)), ...ids.slice(0, 4)];
      const url = new URL(base);
      url.hash = new URLSearchParams({ ver: '6', p: 'chromosome', c: key, ds: selected.join(','), l: '', t: 'radar' });
      return url.href;
    }, { base, key });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('about:blank');
    await page.goto(initialUrl); await settle(); await instrument();
    await page.locator('#chromosome-color-by').selectOption(key);
    const sources = page.locator('#chromosome-data-sources');
    if (!await sources.locator('details').evaluate((element) => element.open)) {
      await sources.locator('summary').click();
    }
    await sources.getByRole('radio', { name: /^Pool the/ }).click();
    const pooled = await read();
    check(pooled.pooled?.length === 4, 'The provisional four-source pool must be explicit');
    const label = await sources.getByRole('checkbox', { name: /^Include / }).first().getAttribute('aria-label');
    await sources.getByRole('radio', { name: /alone informs/ }).first().click();
    const named = await read();
    check(named.hash !== pooled.hash && !named.pooled, 'Named source must replace the pool');
    await sources.getByRole('checkbox', { name: label, exact: true }).click();
    const subset = await read();
    check(subset.pooled?.length === 3, 'Deselection must refresh the active chromosome without a scatter render');
    await sources.getByRole('checkbox', { name: label, exact: true }).click();
    const restored = await read();
    check(restored.hash === pooled.hash && restored.pooled?.length === 4, 'Restoring sources must restore every value');

    await sources.locator('summary').click();
    const canvas = page.locator('#chromosome-canvas');
    await canvas.scrollIntoViewIfNeeded();
    const beforeHover = await read();
    for (let i = 1; i <= 3; i += 1) {
      const box = await canvas.boundingBox();
      await page.mouse.move(box.x + box.width * i / 4, box.y + 55);
    }
    const afterHover = await read();
    check(afterHover.updates === beforeHover.updates && afterHover.hash === pooled.hash,
      'Hover must preserve the measurement model without a full update');

    const slider = page.getByRole('slider', { name: /Hide genes below:/ });
    await slider.evaluate((element) => {
      element.value = String(Number(element.min) + (Number(element.max) - Number(element.min)) * 0.8);
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
    });
    const filtered = await read();
    check(filtered.passing < restored.passing, 'Filtering must narrow the plotted genes');
    await page.getByRole('button', { name: 'Clear all filters', exact: true }).click();
    check((await read()).passing === restored.passing, 'Clearing the temporary filter must restore all genes');
    const views = [];
    for (const name of ['Native codon space', 'Metric X vs Y', 'Recoding-risk space', 'Baseline risk UMAP', 'Perturbation space']) {
      const tab = page.getByRole('tab', { name, exact: true });
      await tab.click(); await page.evaluate(() => new Promise(requestAnimationFrame));
      check(await tab.getAttribute('aria-selected') === 'true' && await page.locator('#map-view canvas:visible').count() > 0,
        `Map must render: ${name}`);
      views.push(name);
    }
    await page.getByRole('tab', { name: /^Chromosome(?:\/Gene)?$/, exact: true }).click();
    const returned = await read();
    check(returned.hash === pooled.hash, 'View switching must preserve measurement values');
    await page.reload(); await settle(); await instrument();
    await page.locator('#chromosome-color-by').selectOption(key);
    const reloaded = await read();
    check(reloaded.hash === pooled.hash && reloaded.pooled?.length === 4
      && reloaded.passing === restored.passing, 'Shared-link reload must preserve the restored pool and passing genes');
    const widths = [];
    for (const width of [959, 960, 1239, 1240]) {
      await page.setViewportSize({ width, height: 900 });
      await canvas.scrollIntoViewIfNeeded(); await page.evaluate(() => new Promise(requestAnimationFrame));
      const dimensions = await page.evaluate(() => {
        const canvas = document.querySelector('#chromosome-canvas');
        return { viewport: innerWidth, page: document.documentElement.scrollWidth,
          canvas: canvas.getBoundingClientRect().width, host: canvas.parentElement.getBoundingClientRect().width };
      });
      check(dimensions.page <= width + 1 && dimensions.canvas <= dimensions.host + 1, 'No breakpoint overflow');
      widths.push(dimensions);
      await page.screenshot({ path: `${root}/breakpoint-${width}.png` });
    }
    check(errors.length === 0, 'No runtime or request errors');
    return { pooled, named, subset, restored, beforeHover, afterHover, filtered, returned, reloaded, views, widths, errors };
  } finally {
    await page.evaluate(() => {
      const check = window.__chromosomeCheck;
      if (check) check.prototype.update = check.original;
      delete window.__chromosomeCheck;
    });
    page.off('pageerror', onError); page.off('requestfailed', onRequest); page.off('console', onConsole);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
  }
}

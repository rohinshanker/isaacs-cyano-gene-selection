/** Run via playwright-cli run-code on /site/?rnaArtifacts=<absolute ignored directory>. */
async (page) => {
  const artifacts = await page.evaluate(() => new URL(location.href).searchParams.get('rnaArtifacts'));
  if (!artifacts?.startsWith('/')) throw new Error('Supply an absolute rnaArtifacts directory.');
  const check = (condition, message) => { if (!condition) throw new Error(message); };
  const diagnostics = [];
  page.on('pageerror', (error) => diagnostics.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') diagnostics.push(message.text()); });
  page.on('requestfailed', (request) => diagnostics.push(request.url()));
  const base = await page.evaluate(() => new URL('/site/', location.href).href);
  const ids = ['M744_RS00005', 'M744_RS00010', 'M744_RS00015'];
  const hash = `#l=${ids.join(',')}&s=TCG-AGC.TCA-AGT.TAG-TAA&n=Syn61`;
  await page.goto(`${base}${hash}`);
  const region = page.getByRole('region', { name: 'On-demand RNA folding', exact: true });
  await page.locator('#fold-button').click();
  await page.waitForFunction(() => document.querySelector('[data-fold-status]').textContent.startsWith('Finished'));
  check((await page.locator('[data-fold-status]').innerText()).includes('3 succeeded, 0 failed'), 'real worker succeeds');
  check(await region.locator('.folding-comparison').count() === 6, 'both windows per gene');
  const counts = await region.locator('.folding-pair-summary').allTextContents();
  check(counts.some((text) => !text.includes('distance 0.')), 'real recoding changes a predicted structure');
  const comparisonNames = await region.locator('.folding-comparison > summary').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('aria-label')));
  check(new Set(comparisonNames).size === 6 && comparisonNames.every((name) => ids.some((id) => name.startsWith(`${id}:`))), 'each comparison has a gene-specific accessible name');
  // Deterministic external document response: verify popup behavior without leaving this app.
  const definitionUrl = 'https://www.tbi.univie.ac.at/RNA/ViennaRNA/doc/html/utils/struct/metrics.html';
  await page.context().route(definitionUrl, (route) => route.fulfill({ contentType: 'text/html', body: '<title>Distance definition fixture</title><p>Definition fixture</p>' }));
  await page.evaluate(() => { window.__definitionResult = document.querySelector('[data-fold-results]').firstElementChild; });
  await region.locator('summary').first().click();
  const definition = region.getByRole('link', { name: 'ViennaRNA definition', exact: true });
  check(await definition.getAttribute('target') === '_blank' && await definition.getAttribute('rel') === 'noopener noreferrer', 'definition link opens safely in a new tab');
  const popupPromise = page.waitForEvent('popup');
  await definition.click();
  const popup = await popupPromise;
  await popup.waitForLoadState('domcontentloaded');
  check(popup.url() === definitionUrl && await popup.evaluate(() => window.opener === null), 'new tab has correct URL and no opener');
  await popup.close();
  await page.context().unroute(definitionUrl);
  check(await page.evaluate(() => document.querySelector('[data-fold-results]').firstElementChild === window.__definitionResult && window.__definitionResult.isConnected), 'definition popup retains current folding nodes');
  await page.evaluate(() => { delete window.__definitionResult; });
  await region.locator('summary').first().click();
  check(await region.locator('.folding-alignment:visible').count() === 0, 'details collapsed initially');
  await region.locator('.folding-comparison summary').first().focus();
  await page.keyboard.press('Enter');
  await region.locator('.folding-alignment').first().waitFor({ state: 'visible' });
  check(await region.locator('.folding-alignment:visible').count() === 1, 'keyboard expands');
  await region.locator('.folding-alignment').first().focus();
  await page.keyboard.press('ArrowRight');
  check(await region.locator('.folding-alignment').first().evaluate((element) => element === document.activeElement), 'alignment keyboard focus');
  check((await region.locator('.folding-alignment').first().getAttribute('aria-label')).includes(ids[0]), 'alignment accessible name includes gene');
  const snapshots = [];
  for (const [width, height] of [[375, 812], [768, 1024], [959, 900], [960, 900], [961, 900],
    [1239, 900], [1240, 900], [1241, 900], [1280, 800], [1440, 900]]) {
    await page.setViewportSize({ width, height });
    await region.scrollIntoViewIfNeeded();
    check(!await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), `page overflow at ${width}`);
    const alignment = await region.locator('.folding-alignment').first().boundingBox();
    check(alignment.width <= width, `alignment contained at ${width}`);
    const labelsContained = await region.locator('.folding-alignment').first().evaluate((element) => {
      const bounds = element.getBoundingClientRect();
      const padding = parseFloat(getComputedStyle(element).paddingLeft);
      return [...element.querySelectorAll('.folding-alignment-row > span:first-child')].every((label) => {
        const rect = label.getBoundingClientRect();
        return rect.left >= bounds.left + padding - 1 && rect.right <= bounds.right - padding + 1;
      });
    });
    check(labelsContained, `complete row labels stay within alignment and padding at ${width}`);
    const alignmentNode = region.locator('.folding-alignment').first();
    await alignmentNode.scrollIntoViewIfNeeded();
    const labelsCoverEdge = await alignmentNode.evaluate((element) => {
      const originalScroll = element.scrollLeft;
      const maxScroll = element.scrollWidth - element.clientWidth;
      const bounds = element.getBoundingClientRect();
      const edgeX = bounds.left + parseFloat(getComputedStyle(element).borderLeftWidth) + 2;
      try {
        for (const offset of [0, 17, 73, 500, maxScroll * 0.65, maxScroll]) {
          element.scrollLeft = offset;
          for (const label of element.querySelectorAll('.folding-alignment-row > span:first-child')) {
            const rect = label.getBoundingClientRect();
            if (document.elementFromPoint(edgeX, (rect.top + rect.bottom) / 2) !== label) return false;
          }
        }
        return true;
      } finally {
        element.scrollLeft = originalScroll;
      }
    });
    check(labelsCoverEdge, `sticky labels cover the left edge at every sampled scroll offset at ${width}`);
    await page.screenshot({ path: `${artifacts}/comparison-page-${width}.png`, fullPage: true });
    await region.screenshot({ path: `${artifacts}/comparison-${width}.png` });
    snapshots.push({ width, snapshot: await region.ariaSnapshot() });
  }
  for (const width of [375, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    const labelsContained = await region.locator('.folding-alignment').first().evaluate((element) => {
      element.scrollLeft = element.scrollWidth * 0.65;
      const bounds = element.getBoundingClientRect();
      const padding = parseFloat(getComputedStyle(element).paddingLeft);
      return element.scrollLeft > 100 && [...element.querySelectorAll('.folding-alignment-row > span:first-child')].every((label) => {
        const rect = label.getBoundingClientRect();
        return rect.left >= bounds.left + padding - 1 && rect.right <= bounds.right - padding + 1;
      });
    });
    check(labelsContained, `complete labels survive far horizontal scrolling at ${width}`);
    await region.screenshot({ path: `${artifacts}/comparison-scrolled-${width}.png` });
  }
  const partners = region.locator('.folding-partners').first();
  check((await partners.locator('summary').getAttribute('aria-label'))
    .includes(await partners.locator('summary').innerText()), 'partner name contains the complete visible label');
  await partners.locator('summary').focus();
  await page.keyboard.press('Enter');
  check((await partners.innerText()).includes('WT pairs:') && (await partners.innerText()).includes('Recoded pairs:'), 'keyboard exposes exact partner pairs');
  check((await partners.innerText()).includes('All other positions are unpaired'), 'unpaired positions explained');
  for (const width of [375, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await region.screenshot({ path: `${artifacts}/partners-${width}.png` });
  }
  await region.locator('.folding-comparison > summary').first().focus();
  await page.keyboard.press('Enter');
  check(await region.locator('.folding-alignment:visible').count() === 0, 'keyboard collapses');
  await region.screenshot({ path: `${artifacts}/comparison-collapsed.png` });
  // A real input change must invalidate the previous scheme's comparisons.
  await page.evaluate((ids) => { location.hash = `l=${ids.join(',')}`; }, ids);
  await page.waitForFunction(() => document.querySelector('[data-fold-status]').textContent.includes('Fold again'));
  check(await region.locator('.folding-comparison').count() === 0, 'input invalidation clears comparison');
  await page.locator('#fold-button').click();
  await page.waitForFunction(() => document.querySelector('[data-fold-status]').textContent.startsWith('Finished'));
  const identity = await region.locator('.folding-pair-summary').allTextContents();
  check(identity.length === 6 && identity.every((text) => text.includes('0 lost · 0 gained. Base-pair distance 0. Pairing changed at 0 positions; 0 nucleotide edits.')), 'real identity yields zeros');
  await region.screenshot({ path: `${artifacts}/comparison-identity.png` });
  // Inject malformed output at the presentation boundary, never into real scientific computation.
  await page.evaluate(async () => {
    const { FoldingPanel } = await import('./js/ui/folding-panel.js');
    const results = document.querySelector('[data-fold-results]');
    FoldingPanel.prototype.renderResults.call({ results, rosetta: { setFoldResults() {} } }, [
      { id: 'Malformed output fixture', windows: { start: { length: 5, wildSequence: 'ACGUU', recodedSequence: 'ACGUU', wildStructure: '(....', recodedStructure: '.....' } } },
    ]);
  });
  check((await region.innerText()).includes('Structure comparison unavailable'), 'malformed output unavailable');
  check(await region.locator('.folding-comparison').count() === 0, 'malformed output has no fabricated details');
  await page.setViewportSize({ width: 375, height: 812 });
  await region.screenshot({ path: `${artifacts}/comparison-unavailable.png` });
  // Real worker outputs, with the second completion held at the lifecycle boundary.
  await page.evaluate(async () => {
    const { FoldingClient } = await import('./js/core/folding-client.js');
    const { loadDataset } = await import('./js/core/dataset.js');
    const { FoldingPanel } = await import('./js/ui/folding-panel.js');
    const dataset = await loadDataset({ baseUrl: new URL('data/', location.href) });
    const ids = ['M744_RS00005', 'M744_RS00010'];
    const map = { TCG: 'AGC', TCA: 'AGT', TAG: 'TAA' };
    const worker = new FoldingClient();
    const report = await worker.run({ dataset, ids, map });
    worker.cancel();
    if (report.results.length !== 2 || report.results.some((result) => result.error)) throw new Error('progress fixture worker failed');
    let progress;
    let complete;
    let calls = 0;
    const client = {
      running: false, cancel() { this.running = false; },
      run(input) {
        if (calls++ > 0) return Promise.resolve({ results: report.results.map((result) => ({ ...result, cached: true })) });
        this.running = true;
        progress = input.onProgress;
        progress({ phase: 'folding', completed: 1, total: 2, results: [report.results[0]] });
        return new Promise((resolve) => { complete = resolve; });
      },
    };
    const host = document.createElement('section');
    host.dataset.progressRegression = '';
    const panel = new FoldingPanel(host, client);
    panel.button.id = 'progress-regression-fold';
    host.querySelector('#fold-note').id = 'progress-regression-note';
    panel.button.setAttribute('aria-describedby', 'progress-regression-note');
    document.body.append(host);
    const state = { dataset, ids, schemes: { active: { map, name: 'Syn61' } } };
    panel.update(state);
    const pending = panel.run();
    window.__rnaProgressRegression = { panel, host, state, report,
      advance() { progress({ phase: 'folding', completed: 2, total: 2, results: [...report.results] }); },
      async finish() { client.running = false; complete({ ...report, results: [...report.results] }); await pending; },
    };
  });
  const progressHost = page.locator('[data-progress-regression]');
  await page.setViewportSize({ width: 375, height: 812 });
  await progressHost.locator('.folding-comparison summary').first().focus();
  await page.keyboard.press('Enter');
  await progressHost.locator('.folding-alignment').first().waitFor({ state: 'visible' });
  await progressHost.locator('.folding-alignment').first().focus();
  await page.evaluate(() => {
    const fixture = window.__rnaProgressRegression;
    fixture.node = fixture.panel.results.firstElementChild;
    fixture.details = fixture.node.querySelector('details');
    fixture.alignment = fixture.details.querySelector('pre');
    fixture.partners = fixture.details.querySelector('.folding-partners');
    fixture.partners.open = true;
    fixture.alignment.scrollLeft = 1300;
    fixture.scroll = fixture.alignment.scrollLeft;
    if (fixture.scroll <= 100) throw new Error('alignment must actually scroll');
  });
  await progressHost.screenshot({ path: `${artifacts}/progress-pending-375.png` });
  const retained = () => page.evaluate(() => {
    const { panel, node, details, alignment, scroll } = window.__rnaProgressRegression;
    return panel.results.firstElementChild === node && node.isConnected && details.open && details.querySelector('.folding-partners').open
      && document.activeElement === alignment && alignment.scrollLeft === scroll
      && panel.results.children.length === 2;
  });
  await page.evaluate(() => window.__rnaProgressRegression.advance());
  check(await retained(), 'second completion retains first node/open/focus/scroll');
  await page.evaluate(() => window.__rnaProgressRegression.finish());
  check(await retained(), 'final report retains first node/open/focus/scroll');
  const progressSnapshots = [];
  for (const [width, height] of [[375, 812], [768, 1024], [1280, 800], [1440, 900]]) {
    await page.setViewportSize({ width, height });
    check(await retained(), `progress state retained at ${width}`);
    check(!await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), `progress overflow at ${width}`);
    await progressHost.screenshot({ path: `${artifacts}/progress-retained-${width}.png` });
    progressSnapshots.push({ width, snapshot: await progressHost.ariaSnapshot() });
  }
  await page.evaluate(async () => {
    const { panel, node, state, report, host } = window.__rnaProgressRegression;
    await panel.run();
    if (node.isConnected || !panel.results.textContent.includes('cached')) throw new Error('cached rerun must rebuild and refresh labels');
    panel.update({ ...state, schemes: { active: { map: {}, name: 'Identity' } } });
    if (panel.results.children.length) throw new Error('scheme change must clear comparisons');
    panel.renderResults(report.results);
    panel.update({ ...state, ids: [state.ids[1]] });
    if (panel.results.children.length) throw new Error('shortlist change must clear comparisons');
    panel.renderResults([{ id: 'error fixture', error: 'Bad context' }]);
    if (!panel.results.textContent.includes('Bad context')) throw new Error('error output missing');
    panel.renderResults([]);
    if (panel.results.children.length) throw new Error('empty output must clear comparisons');
    panel.renderResults([report.results[0]]);
    const previous = panel.results.firstElementChild;
    panel.renderResults([{ ...report.results[0], cached: true }]);
    if (panel.results.firstElementChild === previous || !panel.results.textContent.includes('cached')) throw new Error('replacement output must refresh');
    host.remove();
    delete window.__rnaProgressRegression;
  });
  check(diagnostics.length === 0, `unexpected diagnostics: ${diagnostics.join('; ')}`);
  return { counts, identity, snapshots, progressSnapshots, diagnostics, viewports: 10,
    states: ['real-worker changed structure', 'real-worker identity', 'collapsed', 'expanded', 'keyboard', 'input invalidation', 'unavailable fixture', 'progress state retention', 'keyboard pair partners', 'definition popup retains folds'] };
}

/** Run with playwright-cli run-code --filename=tools/rna_wasm/check_browser.js. */
async (page) => {
  const { artifacts, base } = await page.evaluate(() => ({
    artifacts: new URL(location.href).searchParams.get('rnaArtifacts'),
    base: new URL('/site/', location.href).href,
  }));
  if (!artifacts?.startsWith('/')) throw new Error('Open /site/?rnaArtifacts=<absolute ignored artifact directory> before running this check.');
  await page.coverage.startJSCoverage({ resetOnNavigation: false });
  let coverageActive = true;
  let release = () => {};
  try {
    const coverage = [];
    const reload = async () => {
      coverage.push(...await page.coverage.stopJSCoverage());
      coverageActive = false;
      await page.coverage.startJSCoverage({ resetOnNavigation: false });
      coverageActive = true;
      await page.reload();
    };
    const check = (condition, message) => { if (!condition) throw new Error(message); };
    const diagnostics = [];
    let expectedFailure = false;
    page.on('pageerror', (error) => diagnostics.push(`page: ${error.message}`));
    page.on('console', (message) => {
      const intentionalNetworkFailure = expectedFailure
        && /net::ERR_(ABORTED|INTERNET_DISCONNECTED|FAILED)/.test(message.text());
      if (message.type() === 'error' && !intentionalNetworkFailure) diagnostics.push(`console: ${message.text()}`);
    });
    page.on('requestfailed', (request) => {
      const engineRequest = /\/(?:workers\/folding-worker\.js|core\/folding-engine\.js|vendor\/viennarna\/vienna\.(?:js|wasm))$/.test(request.url());
      if (!(expectedFailure && engineRequest)) diagnostics.push(`request: ${request.url()}`);
    });
    const ids = ['M744_RS00005', 'M744_RS00010', 'M744_RS00015', 'M744_RS00020', 'M744_RS00025',
      'M744_RS00030', 'M744_RS00035', 'M744_RS00040', 'M744_RS00045', 'M744_RS00050'];
    const url = `${base}#l=${ids.join(',')}&s=TCG-AGC.TCA-AGT.TAG-TAA&n=Syn61`;
    const status = page.locator('[data-fold-status]');
    const fold = page.locator('#fold-button');
    const region = page.getByRole('region', { name: 'On-demand RNA folding' });
    let semanticSnapshot;
    await page.goto(url);
    await fold.waitFor();
    check(!await fold.isDisabled(), 'fold action must be enabled for a shortlist');
    check((await page.evaluate(() => performance.getEntriesByType('resource').filter((r) => r.name.endsWith('.wasm')).length)) === 0,
      'engine must load lazily');
    await fold.click();
    await page.waitForFunction(() => document.querySelector('[data-fold-status]').textContent.startsWith('Finished'));
    check((await status.innerText()).includes('10 succeeded, 0 failed'), 'ten genes must fold');
    await fold.click();
    await page.waitForFunction(() => document.querySelector('[data-fold-status]').textContent.includes('10 cache hits'));

    // Real worker parity, including synthetic boundaries not present in this genome.
    const parity = await page.evaluate(async () => {
      const { FoldingClient } = await import('./js/core/folding-client.js');
      const { CodonTable } = await import('./js/core/codon-table.js');
      const { loadDataset } = await import('./js/core/dataset.js');
      const reference = await (await fetch('../tests/fixtures/rna-folding.json')).json();
      const dataset = await loadDataset({ baseUrl: new URL('data/', location.href) });
      const table = new CodonTable(dataset.meta.codonAlphabet);
      const client = new FoldingClient();
      let worst = 0;
      for (const sample of reference.cases) {
        const data = { table, meta: dataset.meta, genes: [sample.gene], indexById: new Map([[sample.gene.id, 0]]) };
        const report = await client.run({ dataset: data, ids: [sample.gene.id], map: sample.map });
        if (report.results[0].error) throw new Error(report.results[0].error);
        for (const [window, expected] of Object.entries(sample.windows)) {
          for (const key of ['wildMfe', 'recodedMfe']) {
            worst = Math.max(worst, Math.abs(report.results[0].windows[window][key] - expected[key]));
          }
        }
      }
      client.cancel();
      const ten = dataset.genes.slice(0, 10).map((gene) => gene.id);
      const performanceClient = new FoldingClient();
      const map = { TCG: 'AGC', TCA: 'AGT', TAG: 'TAA' };
      // Load/hash/compile outside the measured workload. The warm-up gene is not
      // among the ten measured genes, so all ten still require actual folding.
      const workerStart = performance.now();
      const warmup = await performanceClient.run({ dataset, ids: [dataset.genes[10].id], map });
      const workerStartupMs = performance.now() - workerStart;
      if (warmup.results[0].error) throw new Error(warmup.results[0].error);
      let ticks = 0;
      const gaps = [];
      let previous = performance.now();
      const ticker = setInterval(() => { const now = performance.now(); gaps.push(now - previous); previous = now; ticks++; }, 10);
      const start = performance.now();
      const report = await performanceClient.run({ dataset, ids: ten, map });
      const elapsedMs = performance.now() - start;
      // Let a delayed timer report the final gap; synchronous main-thread folding
      // cannot pass merely by blocking until immediately before clearInterval.
      await new Promise((resolve) => setTimeout(resolve, 20));
      clearInterval(ticker);
      const cacheStart = performance.now();
      const second = await performanceClient.run({ dataset, ids: ten, map });
      const cacheElapsedMs = performance.now() - cacheStart;
      const cacheHits = second.results.filter((result) => result.cached).length;
      const errors = report.results.filter((result) => result.error);
      performanceClient.cancel();
      return { cases: reference.cases.length, worst, workerStartupMs, elapsedMs, cacheElapsedMs,
        measuredCacheHits: report.results.filter((result) => result.cached).length,
        ticks, maxTickGapMs: Math.max(...gaps), cacheHits, errors };
    });
    check(parity.worst < 1e-5, `browser/Python difference ${parity.worst}`);
    check(parity.ticks > 0 && parity.maxTickGapMs < 150, 'main thread must remain responsive');
    check(parity.cacheHits === 10 && parity.errors.length === 0, 'ten-gene cache/results');
    check(parity.measuredCacheHits === 0, 'warmed-engine workload must perform ten real folds');

    // The completed export status contains collision-resistant filenames and IDs;
    // keep that real long-token state inside the narrow shortlist card.
    await page.getByRole('button', { name: 'Export CSV and manifest', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('#shortlist > [role="status"]')
      ?.textContent.startsWith('Exported'));

    // Generate and export a real panel too; its separate status carries the same
    // long filename and manifest-ID shape as the shortlist exporter.
    const designer = page.getByRole('region', { name: 'Design a panel' });
    await designer.locator('summary').first().click();
    await designer.getByRole('button', { name: 'Design panel', exact: true }).click();
    await designer.getByRole('button', { name: 'Export panel and manifest', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('.panel-export > [role="status"]')
      ?.textContent.startsWith('Exported'));

    // Keep the wide axis-loadings table open so it cannot leak width into the document.
    await page.locator('#loadings-details').evaluate((element) => { element.open = true; });

    // Entire page plus the affected region, with semantic snapshots at every size.
    for (const [width, height] of [[375, 812], [768, 1024], [959, 900], [960, 900],
      [1239, 900], [1240, 900], [1280, 800], [1440, 900]]) {
      await page.setViewportSize({ width, height });
      await region.scrollIntoViewIfNeeded();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
      check(!overflow, `horizontal page overflow at ${width}`);
      await page.screenshot({ path: `${artifacts}/success-${width}.png`, fullPage: true });
      await region.screenshot({ path: `${artifacts}/folding-${width}.png` });
      semanticSnapshot = await region.ariaSnapshot();
    }
    await page.setViewportSize({ width: 375, height: 812 });
    await region.locator('summary').click();
    check((await region.innerText()).includes('Shared bases in overlapping neighbors can change.'), 'tutorial describes shared-base edits');
    await region.screenshot({ path: `${artifacts}/tutorial-mobile.png` });
    await region.locator('summary').focus();
    await page.keyboard.press('Enter');
    check(!await region.locator('details').evaluate((element) => element.open), 'tutorial keyboard collapse');

    // Delay actual engine response so loading and cancellation can be inspected.
    await reload();
    const gate = new Promise((resolve) => { release = resolve; });
    await page.route('**/vienna.wasm', async (route) => { await gate; await route.continue().catch(() => {}); });
    await fold.click();
    await page.waitForFunction(() => !document.querySelector('[data-fold-cancel]').hidden);
    await region.screenshot({ path: `${artifacts}/loading-mobile.png` });
    check(await fold.isDisabled(), 'duplicate action disabled while busy');
    expectedFailure = true; // Worker termination can abort the in-flight engine download.
    await page.getByRole('button', { name: 'Cancel folding', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('[data-fold-status]').textContent.startsWith('Cancelled'));
    release();
    await page.unroute('**/vienna.wasm');
    await region.screenshot({ path: `${artifacts}/cancelled-mobile.png` });
    check(!await fold.isDisabled(), 'cancel permits retry');

    // Network unavailable on first request: no stale or invented MFE values.
    await reload();
    await fold.waitFor();
    // Routing disables the warm HTTP cache, modeling an unavailable first load.
    await page.route('**/vienna.wasm', (route) => route.abort('internetdisconnected'));
    await page.context().setOffline(true);
    await fold.click();
    await page.waitForFunction(() => document.querySelector('[data-fold-status]').textContent.startsWith('Finished'));
    await page.context().setOffline(false);
    await page.unroute('**/vienna.wasm');
    check((await page.locator('[data-fold-results]').innerText()).toLowerCase().includes('offline'), 'offline explanation');
    await region.screenshot({ path: `${artifacts}/offline-mobile.png` });
    expectedFailure = false;

    // Corrupt exactly one gene's context, preserving the real nine other results.
    await page.route('**/data/genes.json', async (route) => {
      const response = await route.fetch();
      const genes = await response.json();
      delete genes.find((gene) => gene.id === ids[0]).rnaContext;
      await route.fulfill({ response, json: genes });
    });
    await reload();
    await fold.click();
    await page.waitForFunction(() => document.querySelector('[data-fold-status]').textContent.startsWith('Finished'));
    check((await status.innerText()).includes('9 succeeded, 1 failed'), 'partial failure retains good results');
    await region.screenshot({ path: `${artifacts}/partial-mobile.png` });
    await page.unroute('**/data/genes.json');

    // Unsupported environment is explicit; no permanently disabled action.
    await reload();
    await fold.waitFor();
    await page.evaluate(() => { window.WebAssembly = undefined; });
    await fold.click();
    await page.waitForFunction(() => document.querySelector('[data-fold-status]').textContent.includes('requires WebAssembly'));
    await region.screenshot({ path: `${artifacts}/unsupported-mobile.png` });
    check(!await fold.isDisabled(), 'unsupported reports an actionable explanation');
    await reload();
    await fold.waitFor();
    await page.getByRole('button', { name: 'Clear shortlist', exact: true }).click();
    check(await fold.isDisabled(), 'empty shortlist disables action');
    await region.screenshot({ path: `${artifacts}/empty-mobile.png` });

    // The input's blur/change event must not replace a result between pointer
    // down and click, and state-driven refreshes must keep keyboard focus in the
    // same row.
    const search = page.getByLabel('Find a gene');
    const searchRegion = page.getByRole('region', { name: 'Gene search results' });
    const resultButton = (name) => searchRegion.getByRole('button', { name });
    const focusedLabel = () => page.evaluate(() => document.activeElement?.getAttribute('aria-label'));
    const hashList = (key) => page.evaluate((name) => (
      new URLSearchParams(window.location.hash.slice(1)).get(name)?.split(',') ?? []
    ), key);
    await search.fill('rubisco');
    await resultButton('Pin M744_RS09005 in the gene panel').click();
    check((await hashList('g')).includes('M744_RS09005'), 'first pointer Pin click must commit');
    check(await focusedLabel() === 'Pin M744_RS09005 in the gene panel', 'Pin refresh preserves focus');
    await search.fill('M744_RS09005');
    await resultButton('Add M744_RS09005 to the shortlist').click();
    check((await hashList('l')).includes('M744_RS09005'), 'first pointer Shortlist click must commit');
    check(await focusedLabel() === 'Pin M744_RS09005 in the gene panel', 'disabled Shortlist returns focus to Pin');
    await search.fill('rubisco');
    await resultButton('Pin M744_RS09000 in the gene panel').focus();
    await page.keyboard.press('Enter');
    check((await hashList('g')).includes('M744_RS09000'), 'keyboard Pin must commit');
    check(await focusedLabel() === 'Pin M744_RS09000 in the gene panel', 'keyboard Pin preserves focus');
    await resultButton('Add M744_RS09000 to the shortlist').focus();
    await page.keyboard.press('Enter');
    check((await hashList('l')).includes('M744_RS09000'), 'keyboard Shortlist must commit');
    check(await focusedLabel() === 'Pin M744_RS09000 in the gene panel', 'keyboard Shortlist keeps row focus');
    const searchInteractions = 'first-click Pin/Shortlist and keyboard focus passed';

    const lifecycle = await page.evaluate(async () => {
      const { FoldingPanel } = await import('./js/ui/folding-panel.js');
      const host = document.createElement('section');
      document.body.append(host);
      let resolve;
      let reject;
      let progress;
      const client = {
        running: false,
        cancel() { this.running = false; },
        run(input) {
          this.running = true;
          progress = input.onProgress;
          return new Promise((yes, no) => { resolve = yes; reject = no; });
        },
      };
      const panel = new FoldingPanel(host, client);
      const state = { ids: ['gene'], dataset: {}, schemes: { active: { map: {}, name: '' } } };
      panel.update(state);
      const first = panel.run();
      await panel.run(); // A programmatic duplicate must also be harmless.
      panel.update({ ...state, ids: ['changed'] });
      progress({ phase: 'folding', completed: 1, total: 1, results: [] });
      resolve({ results: [], cancelled: true });
      await first;
      if (!panel.status.textContent.includes('changed')) throw new Error('stale completion overwrote current inputs');
      const second = panel.run();
      panel.update({ ...state, ids: ['changed-again'] });
      reject(new Error('obsolete error'));
      await second;
      if (panel.status.textContent.includes('obsolete')) throw new Error('stale error was displayed');
      panel.update({ ids: ['gene'], dataset: {} }); // Missing optional scheme metadata.
      const third = panel.run();
      progress({ phase: 'loading', completed: 0, total: 1, results: [] });
      client.running = false;
      resolve({ results: [], cancelled: false });
      await third;
      if (!panel.status.textContent.includes('identity map')) throw new Error('identity scheme not labelled');
      host.remove();
      return 'duplicate, changed-input cancellation, stale progress/success/error, and missing optional scheme passed';
    });
    coverage.push(...await page.coverage.stopJSCoverage());
    coverageActive = false;
    const panelEntries = coverage.filter((entry) => entry.url.endsWith('/ui/folding-panel.js'));
    const panelSource = panelEntries[0].source;
    const covered = new Uint8Array(panelSource.length);
    for (const entry of panelEntries) {
      const executed = new Uint8Array(panelSource.length);
      // V8 outer function counts are overridden by more specific block counts.
      const ranges = entry.functions.flatMap((fn) => fn.ranges).sort((a, b) =>
        (b.endOffset - b.startOffset) - (a.endOffset - a.startOffset));
      for (const range of ranges) executed.fill(range.count > 0 ? 1 : 0, range.startOffset, range.endOffset);
      for (let index = 0; index < executed.length; index++) covered[index] |= executed[index];
    }
    const uncovered = [];
    let offset = 0;
    for (const [index, line] of panelSource.split('\n').entries()) {
      if ([...line].some((character, position) => character.trim() && !covered[offset + position])) uncovered.push(index + 1);
      offset += line.length + 1;
    }
    check(uncovered.length === 0, `UI module has uncovered source lines: ${uncovered.join(', ')}`);
    check(diagnostics.length === 0, JSON.stringify(diagnostics));
    return { parity, lifecycle, searchInteractions, uiCoverage: { uncoveredLines: uncovered }, semanticSnapshot,
      diagnostics, states: ['success', 'cache', 'shortlist-exported', 'panel-exported', 'tutorial', 'loading', 'cancelled', 'offline', 'partial', 'unsupported', 'empty'] };
  } finally {
    // A failed assertion must not poison the next run with an active profiler,
    // a blocked route, or an offline browser.
    if (coverageActive) await page.coverage.stopJSCoverage();
    release();
    await page.context().setOffline(false);
    await page.unroute('**/vienna.wasm');
    await page.unroute('**/data/genes.json');
  }
}

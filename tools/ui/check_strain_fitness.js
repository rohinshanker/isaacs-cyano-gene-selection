/**
 * Run with playwright-cli run-code --filename=tools/ui/check_strain_fitness.js.
 *
 * Open the real app with an absolute `uiArtifacts` directory;
 * `docs/validation/strain-fitness.md` has the exact commands. Network routes
 * create temporary, clearly synthetic catalogue variants from the generated
 * fixture without adding fake shipped data.
 */
async (page) => {
  const { root, base } = await page.evaluate(() => ({
    root: new URL(location.href).searchParams.get('uiArtifacts'),
    base: location.href.split('#')[0].split('?')[0],
  }));
  if (!root?.startsWith('/')) throw new Error('An absolute uiArtifacts directory is required.');
  const check = (ok, message) => { if (!ok) throw new Error(message); };
  const fixtureUrl = base.replace(/\/site\/index\.html$/, '/tests/fixtures/data-strain-fitness/strain_fitness.json');
  const fixtureResponse = await page.request.get(fixtureUrl);
  check(fixtureResponse.ok(), `could not read synthetic fixture: ${fixtureResponse.status()}`);
  const synthetic = await fixtureResponse.json();
  synthetic.organismId = 'ecoli-syn61-delta3-ev5';
  synthetic.genome.accession = 'GCA_028355435.1';
  const payloadText = (name) => {
    const payload = JSON.parse(JSON.stringify(synthetic));
    if (scenario === 'invalid' && name === 'synthetic-a.json') {
      payload.growth.records[5].doublingTimeMinutes = 90;
    }
    return JSON.stringify(payload);
  };
  let scenario = 'production';
  let failedOnce = false;
  let releaseSlow = null;
  let releaseRetry = null;
  const catalogues = {
    full: [
      { id: 'synthetic-a', label: 'Synthetic fixture A', file: 'synthetic-a.json' },
      { id: 'synthetic-b', label: 'Synthetic fixture B', file: 'synthetic-b.json' },
    ],
  };
  const entryFor = async (body) => page.evaluate(async (text) => {
    const bytes = new TextEncoder().encode(text);
    const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
    return {
      bytes: bytes.byteLength,
      sha256: [...digest].map((byte) => byte.toString(16).padStart(2, '0')).join(''),
    };
  }, body);
  const validEntry = await entryFor(payloadText('synthetic-b.json'));
  scenario = 'invalid';
  const invalidEntry = await entryFor(payloadText('synthetic-a.json'));
  scenario = 'production';
  await page.route('**/js/core/organisms/ecoli-syn61-delta3-ev5.js', async (route) => {
    if (scenario === 'production' || scenario === 'absent') return route.continue();
    const response = await route.fetch();
    const catalogue = catalogues.full;
    const body = (await response.text()).replace(
      /  strainFitnessDatasets: [\s\S]*?\n  recoding:/,
      `  strainFitnessDatasets: ${JSON.stringify(catalogue)},\n  recoding:`,
    );
    await route.fulfill({ response, body });
  });
  await page.route('**/data/organisms/ecoli-syn61-delta3-ev5/data-manifest.json', async (route) => {
    if (scenario === 'production' || scenario === 'absent') return route.continue();
    const response = await route.fetch();
    const manifest = await response.json();
    for (const name of ['synthetic-a.json', 'synthetic-b.json']) {
      manifest.files[name] = scenario === 'invalid' && name === 'synthetic-a.json'
        ? invalidEntry : validEntry;
    }
    await route.fulfill({ response, json: manifest });
  });
  await page.route('**/data/organisms/ecoli-syn61-delta3-ev5/synthetic-*.json*', async (route) => {
    const name = route.request().url().split('?')[0].split('/').pop();
    if (scenario === 'error-retry' && name === 'synthetic-a.json' && !failedOnce) {
      failedOnce = true;
      return route.fulfill({ status: 500, body: 'synthetic first-attempt failure' });
    }
    if (scenario === 'error-retry' && name === 'synthetic-a.json') {
      await new Promise((resolve) => { releaseRetry = resolve; });
    }
    if (scenario === 'race' && name === 'synthetic-a.json') {
      await new Promise((resolve) => { releaseSlow = resolve; });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: payloadText(name) });
  });

  let errors = [];
  // A 404 for an optional data file is the loader's absent path, which every
  // fixture exercises; it is the page working, not an error. Anything else is.
  // The message text carries no address; the location does.
  const expected = (message) => (/status of 404/.test(message.text())
    && /\/(?:tests\/fixtures|\.playwright-cli)\/[^?]*\.json/.test(message.location()?.url ?? ''))
    || (scenario === 'error-retry' && /status of 500/.test(message.text())
      && /synthetic-a\.json/.test(message.location()?.url ?? ''));
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() !== 'error' || expected(message)) return;
    errors.push(`${message.text()} @ ${message.location()?.url ?? ''}`);
  });
  page.on('requestfailed', (request) => {
    errors.push(`${request.url()}: ${request.failure()?.errorText}`);
  });
  const quiet = (label) => {
    check(errors.length === 0, `${label}: ${errors.join(' | ')}`);
  };
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  await page.emulateMedia({ reducedMotion: 'reduce' });

  const evidence = [];
  // Phone, tablet, desktop, wide, and both sides of the 960 px two-column and
  // 1240 px three-column breakpoints, where #main changes its grid.
  const sizes = [[375, 812], [768, 1024], [959, 900], [960, 900], [1239, 900], [1240, 900],
    [1280, 800], [1440, 900]];
  const view = page.locator('#strain-fitness-view');
  const tab = page.getByRole('tab', { name: 'Strain fitness', exact: true });
  const context = view.locator('p.fitness-context');
  const growthRows = view.locator('table.fitness-table >> nth=0').locator('tbody tr');

  const open = async (nextScenario, hash = '', panel = 'strain-fitness') => {
    errors = [];
    scenario = nextScenario;
    failedOnce = false;
    releaseSlow = null;
    releaseRetry = null;
    // A fresh document, so no module or dataset is carried over between states.
    await page.goto('about:blank');
    const organism = nextScenario === 'absent' ? '' : 'org=ecoli-syn61-delta3-ev5&';
    await page.goto(`${base}?${organism}uiArtifacts=${encodeURIComponent(root)}`
      + `#ver=7&p=${panel}${hash}`);
    await page.waitForFunction(() => !document.querySelector('#main')?.hidden);
  };

  const layout = async (label) => {
    const overflow = await page.evaluate(() =>
      document.documentElement.scrollWidth - window.innerWidth);
    check(overflow <= 1, `${label}: page overflow ${overflow} px`);
    // The tables are wider than the panel on purpose; their scroller is what
    // must absorb that, so nothing outside a scroller may reach past the panel
    // and every scroller must itself fit inside it.
    const { escaped, scrollers, clipped } = await page.evaluate(() => {
      const panel = document.querySelector('#strain-fitness-view');
      const limit = panel.getBoundingClientRect();
      return {
        // The columns are fixed, so every cell's text has to wrap inside the
        // column it was sized for. A cell wider than itself is a value cut off
        // mid-word, which the scroller hides rather than reports.
        clipped: [...panel.querySelectorAll('table.fitness-table th, table.fitness-table td')]
          .filter((cell) => cell.scrollWidth > cell.clientWidth + 1)
          .map((cell) => `${cell.tagName}[${(cell.textContent ?? '').slice(0, 30)}]`),
        escaped: [...panel.querySelectorAll('*')]
          .filter((node) => !node.closest('.table-scroll'))
          .filter((node) => node.getBoundingClientRect().right > limit.right + 1)
          .map((node) => `${node.tagName}.${node.className}`),
        // Every table, by way of the scroller it must be inside. A table clipped
        // with no way to reach the rest of it is the same defect as overflow,
        // quietly, so the scroller is checked rather than assumed.
        scrollers: [...panel.querySelectorAll('table.fitness-table')].map((table) => {
          const node = table.closest('.table-scroll');
          if (!node) return { fits: false, reachable: false };
          return {
            fits: node.getBoundingClientRect().right <= limit.right + 1,
            reachable: node.scrollWidth <= node.clientWidth
              || getComputedStyle(node).overflowX === 'auto',
          };
        }),
      };
    });
    check(escaped.length === 0, `${label}: outside the panel: ${escaped.join(', ')}`);
    check(scrollers.every((entry) => entry.fits && entry.reachable),
      `${label}: a table escapes its panel or cannot be scrolled to`);
    check(clipped.length === 0, `${label}: clipped inside its column: ${clipped.join(', ')}`);
    evidence.push({ label, overflow });
    // From the top, so a sticky header is captured once rather than twice.
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: `${root}/${label}.png`, fullPage: true });
  };

  try {
    // --- Real production Syn61 ------------------------------------------
    await open('production');
    await page.waitForFunction(() =>
      document.querySelector('#strain-fitness-view table.fitness-table') !== null);
    const productionIdentity = await view.locator('.fitness-dataset-context').innerText();
    check(/Nyerges 2026 strain growth and Biolog fitness/.test(productionIdentity)
      && /nyerges-2026-syn61-fitness/.test(productionIdentity),
    `production dataset identity: ${productionIdentity}`);
    check(!/synthetic test data/.test((await view.innerText()).toLowerCase()),
      'production Syn61 is not labelled synthetic');
    await page.setViewportSize({ width: 1440, height: 900 });
    await layout('fitness-production-syn61-1440');
    quiet('production Syn61');

    // --- Full data -------------------------------------------------------
    await open('full');
    check(await tab.getAttribute('aria-selected') === 'true', 'the link opens on the tab');
    await page.waitForFunction(() =>
      document.querySelector('#strain-fitness-view table.fitness-table') !== null);
    check((await view.locator('h2').innerText()) === 'Strain fitness', 'the panel heading');
    check(await view.locator('.fitness-dataset select').count() === 1,
      'the synthetic multiple catalogue exposes the local selector');
    check(await view.locator('.fitness-dataset select option').count() === 2,
      'both admitted synthetic datasets are selectable');
    const datasetIdentity = await view.locator('.fitness-dataset-context').innerText();
    check(/Synthetic fixture A/.test(datasetIdentity) && /Local Strain fitness selector/.test(datasetIdentity),
      `local identity and origin: ${datasetIdentity}`);
    const blurb = await page.locator('#panel-blurb').innerText();
    check(/whole strain/.test(blurb) && /colours the map/.test(blurb),
      'the tab blurb says these rows are not genes');
    // The gene colour and the two gene axes are registries of per-gene metrics.
    // Nothing from this layer may appear in one: these rows are strains, and a
    // control that offered them would be offering to colour genes by a
    // measurement no gene has.
    const channels = await page.evaluate(() =>
      ['#color-by', '#axis-x', '#axis-y'].map((id) =>
        [...document.querySelectorAll(`${id} option`)].map((node) => node.textContent)));
    // Guard against a vacuous pass: the registries must actually be populated.
    check(channels.every((options) => options.length > 5),
      `the gene channels are empty: ${channels.map((options) => options.length).join(', ')}`);
    const offered = channels.flat()
      .filter((text) => /doubling time|biolog|maximum od600|strain fitness/i.test(text));
    check(offered.length === 0, `offered as a gene channel: ${offered.join(', ')}`);
    const sourceText = await view.locator('div.fitness-source').innerText();
    check(/Synthetic strain-fitness fixture, not a publication/.test(sourceText),
      'the fixture is labelled synthetic');
    check(/retrieved 2026-10-07/.test(sourceText) && /[0-9a-f]{64}/.test(sourceText),
      'the source is cited, dated and pinned by checksum');
    check(await growthRows.count() === 6, 'six growth rows');
    check(await view.locator('table.fitness-table').count() === 2, 'growth and wells');
    // Every unit on screen is the file's own word for it.
    const headers = await view.locator('table.fitness-table >> nth=0').locator('thead th')
      .allInnerTexts();
    check(headers.some((text) => /^Doubling time\s+minutes$/.test(text)),
      `the doubling-time unit is under its column name: ${headers.join(' | ')}`);
    check(headers.some((text) => /^Maximum OD600\s+OD600, synthetic/.test(text)), 'the OD unit');
    const wellHeaders = await view.locator('table.fitness-table >> nth=1').locator('thead th')
      .allInnerTexts();
    check(wellHeaders.some((text) => /^Value\s+maximum curve height in the arbitrary units/.test(text)),
      `the Biolog unit is the source's words, not an assumed OD scale: ${wellHeaders.join(' | ')}`);
    for (const [width, height] of sizes) {
      await page.setViewportSize({ width, height });
      await view.scrollIntoViewIfNeeded();
      // Single column at every width: there is no gene to select here, so the
      // controls rail and the gene detail rail are gone rather than empty.
      const columns = await page.evaluate(() =>
        getComputedStyle(document.querySelector('#main')).gridTemplateColumns.split(' ').length);
      check(columns === 1, `the fitness view is one column at ${width}, not ${columns}`);
      check(await page.locator('#main > .controls').isHidden(), `controls hidden at ${width}`);
      check(await page.locator('#main > .detail').isHidden(), `detail hidden at ${width}`);
      await layout(`fitness-full-${width}`);
    }
    quiet('full data');

    // --- The no-growth row ------------------------------------------------
    await page.setViewportSize({ width: 1280, height: 800 });
    const stalled = growthRows.filter({ hasText: 'No growth detected' });
    check(await stalled.count() === 1, 'one strain did not grow');
    const cells = await stalled.locator('th, td').allInnerTexts();
    // The missing mark, never a zero: zero minutes would read as infinitely
    // fast growth. U+2003 is the em-space the data contract uses.
    check(cells[3] === ' ', `no-growth doubling time is "${cells[3]}", not the missing mark`);
    check(cells[5] === '0.030 ± 0.020', `its maximum OD600 reads "${cells[5]}"`);
    check(/1: 0 · 2: 0.050/.test(cells[6]), `a measured zero replicate reads "${cells[6]}"`);
    const unmeasured = growthRows.filter({ hasText: 'Segment set A' })
      .filter({ hasText: 'Minimal' });
    const unmeasuredCells = await unmeasured.locator('th, td').allInnerTexts();
    check(unmeasuredCells[5] === ' ', 'an unmeasured maximum OD600 is not a zero either');
    check(/1: 90.2 · 3: 102.6/.test(unmeasuredCells[4]),
      `replicate numbers are shown: "${unmeasuredCells[4]}"`);
    await view.screenshot({ path: `${root}/fitness-no-growth.png` });

    // --- Expanded units block ---------------------------------------------
    const metadata = view.locator('details.fitness-metadata');
    check(await metadata.getAttribute('open') === null, 'the units block starts collapsed');
    await metadata.locator('summary').click();
    check(await metadata.getAttribute('open') !== null, 'and opens');
    const declared = await metadata.innerText();
    for (const expected of ['minutes', 'arbitrary units', 'unmodified parent in the same well',
      'none; the fixture states its values as written']) {
      check(declared.includes(expected), `the expanded block declares ${expected}`);
    }
    await page.setViewportSize({ width: 375, height: 812 });
    await layout('fitness-units-expanded-375');
    await page.setViewportSize({ width: 1280, height: 800 });
    await layout('fitness-units-expanded-1280');

    // --- Selection --------------------------------------------------------
    const strain = view.locator('div.fitness-controls select >> nth=0');
    const condition = view.locator('div.fitness-controls select >> nth=1');
    await strain.selectOption({ label: 'Segment set B (synthetic) — seven-codon recoding (synthetic)' });
    check(await growthRows.count() === 2, 'the growth table narrows to the strain');
    const narrowed = await context.innerText();
    check(/Strain: Segment set B \(synthetic\)/.test(narrowed)
      && /Scheme: seven-codon recoding \(synthetic\) \(70-81\)/.test(narrowed)
      && /Source: FIXTURE_STRAIN_FITNESS/.test(narrowed),
    `the selected context names strain, scheme and source: ${narrowed}`);
    await condition.selectOption({ label: 'Minimal medium, 37 C, shaking (synthetic)' });
    check(await growthRows.count() === 1, 'and by condition');
    check(await view.innerText().then((text) => text.includes('No environment matches this selection.')),
      'the well table says so rather than showing wells it did not select');
    await layout('fitness-selected-1280');
    await condition.selectOption({ label: 'All conditions' });
    const query = view.locator('div.fitness-controls input[type=search]');
    await query.fill('glucose');
    check(await view.locator('table.fitness-table >> nth=1').locator('tbody tr').count() === 1,
      'the environment search narrows the well table');
    await page.setViewportSize({ width: 375, height: 812 });
    await layout('fitness-selected-375');
    await query.fill('');
    await strain.selectOption({ label: 'All strains' });

    // --- Keyboard ---------------------------------------------------------
    await page.setViewportSize({ width: 1280, height: 800 });
    // The tab is reachable from the tablist with the arrow keys the other tabs
    // use, and arriving selects it.
    await page.getByRole('tab', { name: 'Regulatory sites', exact: true }).focus();
    await page.keyboard.press('ArrowRight');
    check(await tab.evaluate((node) => node === document.activeElement),
      'ArrowRight from the tab before it lands here');
    check(await tab.getAttribute('aria-selected') === 'true', 'and selects it');
    await page.keyboard.press('ArrowLeft');
    check(await page.getByRole('tab', { name: 'Regulatory sites', exact: true })
      .evaluate((node) => node === document.activeElement), 'and ArrowLeft goes back');
    await page.keyboard.press('ArrowRight');
    // Every control inside the panel is reachable by Tab, in reading order.
    const reached = [];
    for (let step = 0; step < 28 && reached.length < 7; step += 1) {
      await page.keyboard.press('Tab');
      const landed = await page.evaluate(() => {
        const node = document.activeElement;
        if (!node || !document.querySelector('#strain-fitness-view').contains(node)) return null;
        return `${node.tagName.toLowerCase()}:${node.type ?? ''}:${(node.textContent ?? '').slice(0, 28)}`;
      });
      if (landed) reached.push(landed);
    }
    check(reached.some((entry) => entry.startsWith('summary')), 'the units block is reachable');
    check(reached.filter((entry) => entry.startsWith('select')).length === 3,
      `the dataset selector and both filters are reachable: ${reached.join(' | ')}`);
    check(reached.some((entry) => entry.startsWith('input:search')), 'the search is reachable');
    check(reached.some((entry) => /Download growth summary/.test(entry)),
      `the growth export is reachable: ${reached.join(' | ')}`);
    await page.screenshot({ path: `${root}/fitness-keyboard-1280.png`, fullPage: true });
    quiet('selection and keyboard');

    // --- Export -----------------------------------------------------------
    const growthDownload = view.getByRole('button', { name: 'Download growth summary (TSV)' });
    const [growthFile] = await Promise.all([
      page.waitForEvent('download'),
      growthDownload.click(),
    ]);
    check(growthFile.suggestedFilename()
      === 'ecoli-syn61-delta3-ev5_strain-fitness_synthetic-a_growth_all_all.tsv',
      `growth export file name: ${growthFile.suggestedFilename()}`);
    const growthPath = `${root}/${growthFile.suggestedFilename()}`;
    await growthFile.saveAs(growthPath);
    const status = await view.locator('div.fitness-export >> nth=0').locator('p.panel-note')
      .innerText();
    check(/Downloaded ecoli-syn61-delta3-ev5_strain-fitness_synthetic-a_growth_all_all\.tsv with 6 rows, its units and its source provenance\./
      .test(status), `the export states what it wrote: ${status}`);
    const wellDownload = view.getByRole('button', { name: 'Download Biolog values (TSV)' });
    const [wellFile] = await Promise.all([
      page.waitForEvent('download'),
      wellDownload.click(),
    ]);
    check(wellFile.suggestedFilename()
      === 'ecoli-syn61-delta3-ev5_strain-fitness_synthetic-a_biolog_all_all.tsv',
      `well export file name: ${wellFile.suggestedFilename()}`);
    await wellFile.saveAs(`${root}/${wellFile.suggestedFilename()}`);
    evidence.push({ label: 'downloads', growth: growthPath });
    quiet('export');

    // --- External, ambiguous, race, invalid and retry states -------------
    await open('external', '', 'native');
    const dataSources = page.locator('#data-sources');
    await dataSources.locator('summary').click();
    const sharedA = dataSources.getByRole('checkbox', {
      name: 'Select whole-strain fitness dataset Synthetic fixture A',
    });
    await sharedA.focus();
    await page.keyboard.press('Space');
    check(await sharedA.evaluate((node) => node === document.activeElement),
      'the shared whole-strain checkbox keeps focus after its synchronous rerender');
    await tab.click();
    await page.waitForFunction(() =>
      document.querySelector('#strain-fitness-view table.fitness-table') !== null);
    check(await view.locator('.fitness-dataset select').count() === 0,
      'an unambiguous shared choice hides the duplicate local selector');
    check(/Shared Data Sources selection/.test(
      await view.locator('.fitness-dataset-context').innerText()),
    'the external origin is named');
    await layout('fitness-external-selection-1280');

    await page.getByRole('tab', { name: 'Native codon space', exact: true }).click();
    const sharedB = dataSources.getByRole('checkbox', {
      name: 'Select whole-strain fitness dataset Synthetic fixture B',
    });
    await sharedB.focus();
    await page.keyboard.press('Space');
    check(await sharedB.evaluate((node) => node === document.activeElement),
      'a second shared whole-strain checkbox also keeps focus');
    await tab.click();
    check(await view.locator('.fitness-dataset select').count() === 1,
      'ambiguous external matches retain the local selector');
    check(/matches multiple whole-strain datasets/.test(
      await view.locator('.fitness-dataset-ambiguity').innerText()),
    'the ambiguity is explicit');
    await layout('fitness-ambiguous-selection-1280');

    await open('race');
    await page.waitForFunction(() =>
      document.querySelector('#strain-fitness-view p[data-pending="loading"]') !== null);
    const datasetSelect = view.locator('.fitness-dataset select');
    await datasetSelect.focus();
    await datasetSelect.selectOption('synthetic-b');
    await page.waitForFunction(() =>
      document.querySelector('#strain-fitness-view table.fitness-table') !== null);
    check(await datasetSelect.evaluate((node) => node === document.activeElement),
      'the local dataset selector keeps focus as the selected payload lands');
    check(/Synthetic fixture B/.test(await view.locator('.fitness-dataset-context').innerText()),
      'switching while A loads shows B');
    check(typeof releaseSlow === 'function', 'the delayed A request is in flight');
    const raceQuery = view.locator('div.fitness-controls input[type=search]');
    await raceQuery.focus();
    releaseSlow();
    await page.waitForTimeout(50);
    check(await raceQuery.evaluate((node) => node === document.activeElement),
      'the environment query keeps focus when an unrelated payload settles');
    check(/Synthetic fixture B/.test(await view.locator('.fitness-dataset-context').innerText()),
      'the late A response cannot replace B');
    await layout('fitness-race-stays-on-b-1280');

    await open('invalid');
    await page.waitForFunction(() => document.querySelector('#strain-fitness-view')
      ?.textContent.includes('could not be loaded'));
    check(/Synthetic fixture A/.test(await view.locator('.fitness-dataset-context').innerText()),
      'invalid payload retains its dataset identity');
    check(/no growth and a doubling time/.test(await view.locator('.fitness-load-error').innerText()),
      'schema failure is named');
    check(/synthetic-a \(synthetic-a\.json\)/.test(await view.locator('.fitness-load-error').innerText())
      && !/strain_fitness\.json/.test(await view.locator('.fitness-load-error').innerText()),
    'schema failure names the actual selected file');
    await layout('fitness-invalid-1280');
    await page.getByRole('tab', { name: 'Native codon space', exact: true }).click();
    await page.waitForFunction(() => !document.querySelector('#map-view')?.hidden
      && document.querySelector('#legend')?.textContent.length > 0);
    check(await page.locator('#map-canvas').isVisible(),
      'a malformed fitness dataset leaves the normal gene map usable');
    const mapOverflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    check(mapOverflow === 0, 'the gene map has no overflow after malformed fitness data');
    evidence.push({ label: 'fitness-invalid-map-1280', overflow: mapOverflow });
    await page.screenshot({ path: `${root}/fitness-invalid-map-1280.png` });
    quiet('gene map after malformed fitness dataset');

    await open('error-retry');
    await page.waitForFunction(() => document.querySelector('#strain-fitness-view')
      ?.textContent.includes('could not be loaded'));
    check(/HTTP 500/.test(await view.locator('.fitness-load-error').innerText()),
      'transport failure is named');
    await view.getByRole('button', { name: 'Retry this dataset' }).focus();
    await page.keyboard.press('Enter');
    await view.locator('p[data-pending="loading"]').waitFor();
    const headingFocused = () => view.locator('[data-fitness-focus="heading"]')
      .evaluate((node) => node === document.activeElement);
    check(await headingFocused(), 'keyboard retry retains focus during loading');
    check(typeof releaseRetry === 'function', 'the retry response is held for inspection');
    releaseRetry();
    await page.waitForFunction(() =>
      document.querySelector('#strain-fitness-view table.fitness-table') !== null);
    check(/Synthetic fixture A/.test(await view.locator('.fitness-dataset-context').innerText()),
      'retry restores the same identified dataset');
    check(await headingFocused(), 'keyboard retry retains focus after success');
    await layout('fitness-retry-ready-1280');
    quiet('selection resolution and independent loading');

    // --- The layer absent -------------------------------------------------
    await open('absent');
    await page.waitForFunction(() => document.querySelector('#strain-fitness-view')
      ?.textContent.length > 0);
    check(await view.innerText() === 'Strain fitness measurements are unavailable in this dataset.',
      `the absent sentence is short and truthful: ${await view.innerText()}`);
    check(await view.locator('table').count() === 0, 'and draws no empty table');
    for (const [width, height] of [[375, 812], [1280, 800]]) {
      await page.setViewportSize({ width, height });
      await layout(`fitness-absent-${width}`);
    }
    // The gene app is untouched: the map tab still draws its genes.
    await page.getByRole('tab', { name: 'Native codon space', exact: true }).click();
    await page.waitForFunction(() => !document.querySelector('#map-view')?.hidden);
    check(await page.locator('#map-canvas').isVisible(), 'the map is still there');
    quiet('absent');
  } finally {
    releaseRetry?.();
    page.removeAllListeners('pageerror');
    page.removeAllListeners('console');
    page.removeAllListeners('requestfailed');
    await cdp.detach();
  }
  return { ok: true, evidence };
}

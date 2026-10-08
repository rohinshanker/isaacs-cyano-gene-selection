/**
 * Run with playwright-cli run-code --filename=tools/ui/check_strain_fitness.js.
 *
 * Open the page first with the strain-fitness fixture as its data directory and
 * an absolute `uiArtifacts` directory; `docs/validation/strain-fitness.md` has
 * the exact commands. The check walks the states the tab has to draw — full
 * data, a strain that did not grow, a narrowed selection, the expanded units
 * block, a keyboard pass, a download, the absent layer and a malformed one —
 * at phone, tablet, desktop and wide widths and on both sides of the two
 * column breakpoints.
 */
async (page) => {
  const { root, base } = await page.evaluate(() => ({
    root: new URL(location.href).searchParams.get('uiArtifacts'),
    base: location.href.split('#')[0].split('?')[0],
  }));
  if (!root?.startsWith('/')) throw new Error('An absolute uiArtifacts directory is required.');
  // The script drives every state itself, from directories relative to the
  // page, so a rerun does not depend on whichever one the last run ended on.
  const fixtures = {
    full: '../tests/fixtures/data-strain-fitness/',
    absent: '../tests/fixtures/data/',
    malformed: '../.playwright-cli/dem-312-strain-fitness/data-malformed/',
  };

  const check = (ok, message) => { if (!ok) throw new Error(message); };
  let errors = [];
  // A 404 for an optional data file is the loader's absent path, which every
  // fixture exercises; it is the page working, not an error. Anything else is.
  // The message text carries no address; the location does.
  const expected = (message) => /status of 404/.test(message.text())
    && /\/(?:tests\/fixtures|\.playwright-cli)\/[^?]*\.json/.test(message.location()?.url ?? '');
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
  const sizes = [[375, 812], [768, 1024], [959, 900], [961, 900], [1239, 900], [1241, 900],
    [1280, 800], [1440, 900]];
  const view = page.locator('#strain-fitness-view');
  const tab = page.getByRole('tab', { name: 'Strain fitness', exact: true });
  const context = view.locator('p.fitness-context');
  const growthRows = view.locator('table.fitness-table >> nth=0').locator('tbody tr');

  const open = async (directory, hash = '') => {
    errors = [];
    // A fresh document, so no module or dataset is carried over between states.
    await page.goto('about:blank');
    await page.goto(`${base}?data=${encodeURIComponent(directory)}`
      + `&uiArtifacts=${encodeURIComponent(root)}#ver=6&p=strain-fitness${hash}`);
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
    // --- Full data -------------------------------------------------------
    await open(fixtures.full);
    check(await tab.getAttribute('aria-selected') === 'true', 'the link opens on the tab');
    await page.waitForFunction(() =>
      document.querySelector('#strain-fitness-view table.fitness-table') !== null);
    check((await view.locator('h2').innerText()) === 'Strain fitness', 'the panel heading');
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
    check(await view.locator('p.provenance-warning').innerText()
      .then((text) => /synthetic test data/.test(text)), 'the fixture is labelled synthetic');
    const sourceText = await view.locator('div.fitness-source').innerText();
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
    for (let step = 0; step < 24 && reached.length < 6; step += 1) {
      await page.keyboard.press('Tab');
      const landed = await page.evaluate(() => {
        const node = document.activeElement;
        if (!node || !document.querySelector('#strain-fitness-view').contains(node)) return null;
        return `${node.tagName.toLowerCase()}:${node.type ?? ''}:${(node.textContent ?? '').slice(0, 28)}`;
      });
      if (landed) reached.push(landed);
    }
    check(reached.some((entry) => entry.startsWith('summary')), 'the units block is reachable');
    check(reached.filter((entry) => entry.startsWith('select')).length === 2,
      `both filters are reachable: ${reached.join(' | ')}`);
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
    check(growthFile.suggestedFilename() === 'strain-fitness_growth_all_all.tsv',
      `growth export file name: ${growthFile.suggestedFilename()}`);
    const growthPath = `${root}/${growthFile.suggestedFilename()}`;
    await growthFile.saveAs(growthPath);
    const status = await view.locator('div.fitness-export >> nth=0').locator('p.panel-note')
      .innerText();
    check(/Downloaded strain-fitness_growth_all_all\.tsv with 6 rows, its units and its source provenance\./
      .test(status), `the export states what it wrote: ${status}`);
    const wellDownload = view.getByRole('button', { name: 'Download Biolog values (TSV)' });
    const [wellFile] = await Promise.all([
      page.waitForEvent('download'),
      wellDownload.click(),
    ]);
    check(wellFile.suggestedFilename() === 'strain-fitness_biolog_all_all.tsv',
      `well export file name: ${wellFile.suggestedFilename()}`);
    await wellFile.saveAs(`${root}/${wellFile.suggestedFilename()}`);
    evidence.push({ label: 'downloads', growth: growthPath });
    quiet('export');

    // --- The layer absent -------------------------------------------------
    await open(fixtures.absent);
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

    // --- The layer malformed ----------------------------------------------
    await open(fixtures.malformed);
    await page.waitForFunction(() => document.querySelector('#strain-fitness-view')
      ?.textContent.includes('could not be loaded'));
    const failedText = await view.innerText();
    check(failedText === 'Strain fitness measurements could not be loaded.',
      `the failed sentence names the layer: ${failedText}`);
    check(await view.locator('p[data-pending="failed"]').count() === 1,
      'and is marked as a failed layer, not an absent one');
    // The loading tail offers a retry for exactly this file, and nothing else
    // on the page is in a failed state.
    check(await page.locator('.load-tail.has-failures, .has-failures').count() >= 1,
      'the loading tail reports the failure');
    for (const [width, height] of [[375, 812], [1280, 800]]) {
      await page.setViewportSize({ width, height });
      await layout(`fitness-failed-${width}`);
    }
    await page.getByRole('tab', { name: 'Native codon space', exact: true }).click();
    await page.waitForFunction(() => !document.querySelector('#map-view')?.hidden);
    check(await page.locator('#map-canvas').isVisible(),
      'the normal gene app stays usable with a malformed layer');
    check(await page.locator('#legend').innerText().then((text) => text.length > 0),
      'and still colours and describes its genes');
    quiet('malformed');
  } finally {
    page.removeAllListeners('pageerror');
    page.removeAllListeners('console');
    page.removeAllListeners('requestfailed');
    await cdp.detach();
  }
  return { ok: true, evidence };
}

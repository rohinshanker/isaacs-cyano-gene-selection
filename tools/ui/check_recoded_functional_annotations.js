/** Actual-worktree render check; run with playwright-cli and ?uiArtifacts=/absolute/path. */
async (page) => {
  const { root, base } = await page.evaluate(() => {
    const url = new URL(location.href);
    return { root: url.searchParams.get('uiArtifacts'), base: `${url.origin}${url.pathname}` };
  });
  if (!root?.startsWith('/')) throw new Error('An absolute uiArtifacts directory is required');
  const check = (value, message) => { if (!value) throw new Error(message); };
  const errors = [];
  const onError = (error) => errors.push(error.message);
  const onConsole = (message) => { if (message.type() === 'error') errors.push(message.text()); };
  const onFailed = (request) => errors.push(`request failed: ${request.url()}`);
  const onResponse = (response) => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); };
  page.on('pageerror', onError);
  page.on('console', onConsole);
  page.on('requestfailed', onFailed);
  page.on('response', onResponse);
  const settled = () => page.waitForFunction(() => !document.body.classList.contains('is-loading')
    && performance.getEntriesByName('cyano:settled').length > 0);
  const results = [];
  try {
    await page.route('**/*', (route) => route.continue());
    await page.emulateMedia({ reducedMotion: 'reduce' });
    for (const [tag, organism, symbol, locus, unknown] of [
      ['syn57', 'ecoli-syn57-design', 'iroK', 'iroK', 'b0110'],
      ['syn61', 'ecoli-syn61-delta3-ev5', 'yabR', 'PPG85_00355', 'PPG85_00055'],
    ]) {
      await page.goto(`${base}?org=${organism}&uiArtifacts=${root}&uiRun=${Date.now()}#ver=8&p=native&c=gc3&l=&t=radar`);
      await settled();
      await page.locator('#gene-search').fill(symbol);
      const row = page.locator('#gene-search-results li').filter({ hasText: locus });
      await row.first().waitFor();
      check((await row.first().innerText()).includes('inherited reference annotation'), `${tag}: missing search provenance`);
      await row.first().getByRole('button', { name: `Pin ${locus}`, exact: false }).click();
      const disclosure = page.locator('#detail details.annotation-evidence');
      await disclosure.waitFor();
      check(!(await disclosure.getAttribute('open')), `${tag}: disclosure must start collapsed`);
      await disclosure.locator('summary').focus();
      await page.keyboard.press('Enter');
      check(await disclosure.getAttribute('open') !== null, `${tag}: keyboard cannot open provenance`);
      const text = await disclosure.innerText();
      check(text.includes('not lab review or a measurement'), `${tag}: recoded evidence boundary missing`);
      check(text.includes('GCF_000005845.2') && text.includes('protein SHA-256'), `${tag}: pinned provenance missing`);
      if (tag === 'syn61') check(text.includes('GCF_000350185.1'), 'Syn61: public MDS42 hop missing');
      const widths = [[375, 812], [768, 1024], [1280, 800], [1440, 900],
        [519, 900], [521, 900], [599, 900], [601, 900], [699, 900], [701, 900],
        [1239, 900], [1241, 900], [1319, 900], [1321, 900]];
      for (const [width, height] of widths) {
        await page.setViewportSize({ width, height });
        await disclosure.scrollIntoViewIfNeeded();
        const geometry = await disclosure.evaluate((node) => ({
          overflow: document.documentElement.scrollWidth - innerWidth,
          contentOverflow: node.scrollWidth - node.clientWidth,
          summaryWidth: node.querySelector('summary').getBoundingClientRect().width,
        }));
        check(geometry.overflow <= 0, `${tag} ${width}: page overflow ${geometry.overflow}`);
        check(geometry.contentOverflow <= 1, `${tag} ${width}: annotation overflow ${geometry.contentOverflow}`);
        check(geometry.summaryWidth > 0, `${tag} ${width}: provenance is hidden`);
        await page.screenshot({ path: `${root}/${tag}-detail-${width}.png`, fullPage: true });
        if ([375, 768, 1280, 1440].includes(width)) {
          await page.screenshot({ path: `${root}/${tag}-detail-viewport-${width}.png` });
        }
        const snapshot = await disclosure.ariaSnapshot();
        check(snapshot.includes('Inherited fields'), `${tag} ${width}: missing semantic provenance`);
        results.push({ organism, state: 'inherited-symbol-detail-open', width, height, ...geometry, snapshot });
      }
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.locator('#functional-go-search').fill('threonine');
      check(await page.locator('#functional-go-term option').count() < 100, `${tag}: GO name search did not narrow options`);
      await page.locator('#functional-go-term').selectOption('GO:0009088');
      await page.locator('#functional-go-search').fill('no-term-matches-zzzz');
      check(await page.locator('#functional-go-term').inputValue() === 'GO:0009088', `${tag}: GO search discarded selected term`);
      check((await page.locator('#functional-go-matches').innerText()).includes('0 matching'), `${tag}: empty GO search state missing`);
      await page.locator('#functional-go-search').fill('GO:0009088');
      await page.locator('#functional-go-term').focus();
      await page.keyboard.press('Tab');
      check(await page.locator('#functional-go-filter').evaluate((node) => node === document.activeElement), `${tag}: GO filter keyboard order failed`);
      await page.getByRole('button', { name: 'Colour by selected GO term', exact: true }).click();
      await page.locator('#functional-go-filter').selectOption('positive');
      check(await page.locator('#color-by').inputValue() === 'goTermEvidence', `${tag}: GO colour not selected`);
      const counts = await page.locator('.go-term-controls [role="status"]').last().innerText();
      const positive = Number(counts.match(/Positive annotation: (\d+)/)?.[1]);
      check(positive > 0, `${tag}: no positive GO evidence`);
      check((await page.locator('#map-canvas').getAttribute('aria-label')).includes(`${positive} of`), `${tag}: GO filter and legend count disagree`);
      for (const [width, height] of [[375, 812], [768, 1024], [1280, 800], [1440, 900]]) {
        await page.setViewportSize({ width, height });
        await page.locator('.go-term-controls').scrollIntoViewIfNeeded();
        check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${tag} ${width}: GO controls page overflow`);
        check(await page.locator('#functional-go-term').evaluate((node) => node.getBoundingClientRect().right <= innerWidth), `${tag} ${width}: GO selector overflow`);
        await page.screenshot({ path: `${root}/${tag}-go-controls-${width}.png` });
        results.push({ organism, state: 'go-term-positive-filter-and-colour', width, height, positive,
          snapshot: await page.locator('.go-term-controls [role="status"]').last().ariaSnapshot(),
          selectedTerm: await page.locator('#functional-go-term option:checked').ariaSnapshot(),
          selectedFilter: await page.locator('#functional-go-filter').ariaSnapshot() });
      }
      await page.reload();
      await settled();
      check(await page.locator('#functional-go-term').inputValue() === 'GO:0009088', `${tag}: GO term reload lost`);
      check(await page.locator('#functional-go-filter').inputValue() === 'positive', `${tag}: GO filter reload lost`);
      for (const name of ['Recoding-risk space', 'Baseline risk UMAP', 'Perturbation space']) {
        await page.getByRole('tab', { name, exact: true }).click();
        check(await page.locator('.go-term-controls').isVisible(), `${tag}: GO controls hidden on ${name}`);
        check(await page.locator('#functional-go-filter').inputValue() === 'positive', `${tag}: active GO filter lost on ${name}`);
        check(await page.locator('#functional-go-term').inputValue() === 'GO:0009088', `${tag}: active GO term lost on ${name}`);
        await page.locator('#functional-go-filter').selectOption('any');
        await page.locator('#functional-go-filter').selectOption('positive');
        await page.locator('.go-term-controls').scrollIntoViewIfNeeded();
        await page.screenshot({ path: `${root}/${tag}-${name.replaceAll(' ', '-').toLowerCase()}-go-controls.png` });
        results.push({ organism, state: `${name}-go-controls`, snapshot: await page.locator('.go-term-controls [role="status"]').last().ariaSnapshot() });
      }
      await page.getByRole('tab', { name: 'Citations & sources', exact: true }).click();
      check(await page.locator('.go-term-controls').isHidden(), `${tag}: GO controls visible on citations`);
      await page.getByRole('tab', { name: 'Native codon space', exact: true }).click();
      await page.locator('#functional-go-filter').selectOption('negative');
      check((await page.locator('#map-canvas').getAttribute('aria-label')).includes('0 of'), `${tag}: NOT filter treated positive rows as negative`);
      await page.locator('#functional-go-term').selectOption(tag === 'syn57' ? 'GO:0047693' : 'GO:0009228');
      await page.locator('#functional-go-filter').selectOption('negative');
      const negativeCounts = await page.locator('.go-term-controls [role="status"]').last().innerText();
      const negative = Number(negativeCounts.match(/Explicit NOT annotation: (\d+)/)?.[1]);
      check(negative > 0, `${tag}: deposited NOT annotation was lost`);
      check((await page.locator('#map-canvas').getAttribute('aria-label')).includes(`${negative} of`), `${tag}: NOT filter count mismatch`);
      await page.locator('#gene-search').fill(tag === 'syn57' ? 'GO:0047693' : 'GO:0009228');
      const notLocus = tag === 'syn57' ? 'b0099' : 'PPG85_01680';
      const notRow = page.locator('#gene-search-results li').filter({ hasText: notLocus });
      await notRow.waitFor();
      const notText = await notRow.innerText();
      check(notText.includes('NOT|') && notText.includes('source evidence'), `${tag}: search lost explicit NOT or source evidence`);
      await notRow.scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${root}/${tag}-not-go-search.png` });
      results.push({ organism, state: 'not-go-search', snapshot: await notRow.ariaSnapshot() });
      await page.screenshot({ path: `${root}/${tag}-not-go-filter.png`, fullPage: true });
      await page.locator('#functional-go-filter').selectOption('any');
      await page.getByRole('tab', { name: 'Chromosome/Gene', exact: true }).click();
      check(await page.locator('#chromosome-canvas').isVisible(), `${tag}: chromosome did not render`);
      check(await page.locator('#chromosome-color-by').inputValue() === 'goTermEvidence', `${tag}: chromosome GO colour drifted`);
      await page.screenshot({ path: `${root}/${tag}-chromosome.png`, fullPage: true });
      await page.getByRole('tab', { name: 'Native codon space', exact: true }).click();
      check(!(await page.locator('#color-by option[value="functionCategory"]').count()), `${tag}: invented category colouring`);
      check(!(await page.locator('input[name="function-category"]').count()), `${tag}: invented category filter`);
      await page.locator('#functional-go-term').selectOption('');
      await page.locator('#color-by').selectOption('gc3');
      await page.locator('#gene-search').fill('GO:0009088');
      await page.locator('#gene-search-results').getByText(/GO:0009088/).first().waitFor();
      check((await page.locator('#gene-search-results').innerText()).includes('inherited'), `${tag}: GO search lost transfer label`);
      await page.locator('#gene-search').fill('threonine biosynthetic process');
      await page.locator('#gene-search-results').getByText(/GO:0009088/).first().waitFor();
      await page.screenshot({ path: `${root}/${tag}-go-search.png`, fullPage: true });
      await page.locator('#gene-search').fill(unknown);
      const unknownRow = page.locator('#gene-search-results li').filter({ hasText: unknown }).first();
      await unknownRow.getByRole('button', { name: `Pin ${unknown}`, exact: false }).click();
      if (await page.locator('#detail details.annotation-evidence').getAttribute('open') === null) {
        await page.locator('#detail details.annotation-evidence summary').click();
      }
      check((await page.locator('#detail details.annotation-evidence').innerText()).includes('No missing functional annotation was transferred'), `${tag}: unknown locus implied inheritance`);
      await page.screenshot({ path: `${root}/${tag}-unknown.png`, fullPage: true });
      if (tag === 'syn61') {
        await page.locator('#gene-search').fill('PPG85_00010');
        await page.locator('#gene-search-results li').filter({ hasText: 'PPG85_00010' }).first()
          .getByRole('button', { name: 'Pin PPG85_00010', exact: false }).click();
        const nativeDisclosure = page.locator('#detail details.annotation-evidence');
        if (await nativeDisclosure.getAttribute('open') === null) await nativeDisclosure.locator('summary').click();
        check((await nativeDisclosure.innerText()).includes('Native GO relationships (GenBank notes)'), 'Syn61 native GO provenance missing');
        check((await nativeDisclosure.innerText()).includes('native GenBank CDS note'), 'Syn61 native GO method missing');
        check((await nativeDisclosure.innerText()).includes('Native EC numbers'), 'Syn61 native EC numbers missing');
        await nativeDisclosure.scrollIntoViewIfNeeded();
        await page.screenshot({ path: `${root}/syn61-native-go.png`, fullPage: true });
        await page.screenshot({ path: `${root}/syn61-native-go-viewport.png` });
        results.push({ organism, state: 'native-go-detail', snapshot: await nativeDisclosure.ariaSnapshot() });
        await page.locator('#gene-search').fill('GO:0009067');
        const uncheckedRow = page.locator('#gene-search-results li').filter({ hasText: 'PPG85_00010' });
        await uncheckedRow.waitFor();
        check((await uncheckedRow.innerText()).includes('ontology status unchecked'), 'Syn61 search implied checked ontology status');
        await uncheckedRow.scrollIntoViewIfNeeded();
        await page.screenshot({ path: `${root}/syn61-unchecked-go-search.png` });
        results.push({ organism, state: 'unchecked-go-search', snapshot: await uncheckedRow.ariaSnapshot() });
      }
      await page.locator('#gene-search').fill('no-gene-matches-zzzz');
      check((await page.locator('#gene-search-results').innerText()).includes('No'), `${tag}: empty search state missing`);
      await page.locator('#gene-search').fill('');
      check(await page.locator('#gene-search-results').isHidden(), `${tag}: cleared results remain visible`);
      const maximum = tag === 'syn57' ? 'b4143' : 'PPG85_05335';
      await page.locator('#gene-search').fill(maximum);
      await page.locator('#gene-search-results li').filter({ hasText: maximum }).first()
        .getByRole('button', { name: `Pin ${maximum}`, exact: false }).click();
      const maximumDisclosure = page.locator('#detail details.annotation-evidence');
      if (await maximumDisclosure.getAttribute('open') === null) await maximumDisclosure.locator('summary').click();
      await page.setViewportSize({ width: 375, height: 812 });
      check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${tag}: maximum GO content overflow`);
      await maximumDisclosure.scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${root}/${tag}-maximum-go.png` });
    }
    check(errors.length === 0, `Healthy-load runtime errors: ${errors.join('; ')}`);
  } finally {
    await page.unroute('**/*');
    page.off('pageerror', onError);
    page.off('console', onConsole);
    page.off('requestfailed', onFailed);
    page.off('response', onResponse);
  }
  await page.goto(`${base}?org=ecoli-syn61-delta3-ev5&data=../no-such-data-recoded-functional/&uiArtifacts=${root}&uiRun=${Date.now()}`);
  await page.locator('body.load-failed').waitFor();
  const errorText = await page.locator('body').innerText();
  check(/failed|could not|couldn’t|cannot|error/i.test(errorText), 'Missing-data error was not visible');
  check(!(await page.locator('#detail details.annotation-evidence').count()), 'Missing-data page retained stale provenance');
  await page.screenshot({ path: `${root}/missing-data-error.png`, fullPage: true });
  return { results, errors };
}

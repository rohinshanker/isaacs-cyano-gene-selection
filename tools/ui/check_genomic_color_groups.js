/** Verify the real Colour by groups, their selections and shared-link persistence. */
async (page) => {
  const { appUrl, root } = await page.evaluate(() => ({
    appUrl: new URL('index.html', location.href).href,
    root: new URL(location.href).searchParams.get('uiArtifacts'),
  }));
  if (!root?.startsWith('/')) throw new Error('Pass an absolute uiArtifacts directory in the app URL.');
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('requestfailed', (request) => errors.push(request.url()));
  const check = (condition, message) => { if (!condition) throw new Error(message); };
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const overlapKeys = ['overlap5PrimeNt', 'overlap3PrimeNt', 'overlapTotalNt'];
  const expected = ['overlapClass', 'neighborTssOverlap', ...overlapKeys];
  const organisms = ['utex2973', 'ecoli-k12-mg1655', 'ecoli-mds42-public-reference',
    'ecoli-dh10b-public-reference', 'ecoli-syn61-delta3-ev5', 'ecoli-syn57-design'];
  const results = [];
  for (const org of organisms) {
    await page.goto(`${appUrl}?org=${org}&uiArtifacts=${encodeURIComponent(root)}#ver=8&p=native&c=overlap5PrimeNt`);
    await page.waitForFunction(() => document.querySelector('#color-by')?.options.length > 10);
    await page.waitForLoadState('networkidle');
    for (const panel of ['Native codon space', 'Chromosome/Gene']) {
      await page.getByRole('tab', { name: panel, exact: true }).click();
      const selector = panel === 'Native codon space' ? '#color-by' : '#chromosome-view select';
      const picker = page.locator(selector).filter({ has: page.locator('option[value="overlap5PrimeNt"]') }).first();
      const groups = await picker.locator('optgroup').evaluateAll((nodes) => nodes.map((node) => ({
        label: node.label, keys: [...node.children].map((option) => option.value),
      })));
      const contexts = groups.filter(({ label }) => label === 'Genomic context');
      check(contexts.length === 1, `${org}/${panel}: one Genomic context group`);
      check(JSON.stringify(contexts[0].keys) === JSON.stringify(expected), `${org}/${panel}: overlap options grouped first`);
      const neighborhood = groups.find(({ label }) => label === 'Genomic neighborhood');
      check(neighborhood?.keys.includes('neighborUpstreamNt') && neighborhood.keys.includes('neighborDownstreamNt'),
        `${org}/${panel}: distance options in Genomic neighborhood`);
      check(groups.indexOf(contexts[0]) < groups.indexOf(neighborhood), `${org}/${panel}: group order`);
      check(overlapKeys.every((key) => groups.flatMap((group) => group.keys).filter((value) => value === key).length === 1),
        `${org}/${panel}: overlap options are unique`);
      for (const value of [...overlapKeys, 'neighborUpstreamNt', 'neighborTssOverlap']) {
        await picker.selectOption(value);
        check(await page.evaluate((key) => new URLSearchParams(location.hash.slice(1)).get('c') === key, value),
          `${org}/${panel}: colour persists`);
      }
      results.push({ org, panel, groups: groups.filter(({ label }) => label.startsWith('Genomic')) });
    }
  }
  await page.goto(`${appUrl}?org=utex2973&uiArtifacts=${encodeURIComponent(root)}#ver=8&p=chromosome&c=overlapTotalNt&g=M744_RS01690`);
  await page.waitForFunction(() => document.querySelector('#color-by')?.value === 'overlapTotalNt');
  for (const [width, height] of [[375, 812], [768, 1024], [959, 900], [961, 900],
    [1239, 900], [1241, 900], [1280, 800], [1440, 900]]) {
    await page.setViewportSize({ width, height });
    for (const panel of ['Chromosome/Gene', 'Native codon space']) {
      await page.getByRole('tab', { name: panel, exact: true }).click();
      const picker = panel === 'Native codon space' ? page.locator('#color-by')
        : page.locator('#chromosome-view select').filter({ has: page.locator('option[value="overlapTotalNt"]') }).first();
      await picker.scrollIntoViewIfNeeded();
      await picker.focus();
      check(await picker.inputValue() === 'overlapTotalNt', `selected overlap preserved at ${width}/${panel}`);
      check(await picker.evaluate((node) => document.activeElement === node), `picker keyboard focus at ${width}/${panel}`);
      check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `no page overflow at ${width}/${panel}`);
      await page.screenshot({ path: `${root}/genomic-groups-${width}-${panel === 'Chromosome/Gene' ? 'chromosome' : 'scatter'}.png` });
    }
  }
  check(errors.length === 0, errors.join('\n'));
  return { passed: true, results, errors, snapshot: await page.locator('#color-by').ariaSnapshot() };
}

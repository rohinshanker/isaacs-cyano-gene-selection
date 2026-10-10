/** Run on the real site with ?uiArtifacts=<absolute directory> via playwright-cli. */
async (page) => {
  const initial = await page.evaluate(() => {
    const url = new URL(location.href);
    return { root: url.searchParams.get('uiArtifacts'), base: `${url.origin}${url.pathname}` };
  });
  if (!initial.root?.startsWith('/')) throw new Error('An absolute uiArtifacts directory is required.');
  const check = (ok, message) => { if (!ok) throw new Error(message); };
  const diagnostics = [];
  const onPageError = (error) => diagnostics.push(error.message);
  const onConsole = (message) => {
    if (message.type() === 'error') diagnostics.push(message.text());
  };
  const onRequestFailed = (request) => diagnostics.push(`request failed: ${request.url()}`);
  page.on('pageerror', onPageError);
  page.on('console', onConsole);
  page.on('requestfailed', onRequestFailed);

  const freshHash = '#ver=7&p=native&c=gc3&csc=linear&l=&t=radar';
  const url = (extra = '') => `${initial.base}?uiArtifacts=${initial.root}`
    + `&org=ecoli-syn57-design${extra}${freshHash}`;
  const waitLoaded = async () => {
    await page.waitForFunction(() => document.querySelector('#recoded-genome-heading'));
    await page.locator('body.is-loading').waitFor({ state: 'detached' });
  };
  const settle = async () => {
    await page.evaluate(() => new Promise((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(resolve));
    }));
  };
  const healthy = {};
  try {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(url());
    await waitLoaded();
    await settle();
    check(await page.title() === 'Ec_Syn57 complete-design recoding-diversity map',
      'Syn57 title did not load');
    check(await page.getByRole('heading', { name: 'Recoded Genome Scheme', level: 3 }).isVisible(),
      'Syn57 recoded-genome facts are missing');
    const facts = await page.getByRole('heading', { name: 'Recoded Genome Scheme', level: 3 })
      .locator('..').innerText();
    check(/446 across 3,588/.test(facts), 'Syn57 residual count is missing');
    check(/Design only.*no omics, growth, or fitness/is.test(facts),
      'Syn57 design-only measurement boundary is missing');
    check(!/Syn61/i.test(facts), 'Syn57 facts substituted Syn61 content');
    check(await page.locator('[data-panel-id]').count() === 3,
      'the standard three movable panels are not present');
    check(await page.getByRole('heading', { name: 'Recoded Genome Scheme', level: 3 })
      .locator('xpath=ancestor::*[@data-panel-id][1]').getAttribute('data-panel-id') === 'scheme',
    'the record facts are not inside the standard scheme panel');
    await page.locator('#panel-toggle-scheme').click();
    check(!(await page.getByRole('heading', { name: 'Recoded Genome Scheme', level: 3 }).isVisible()),
      'collapsing the scheme panel did not hide its record facts');
    const collapsedSchemeUrl = page.url();
    check(/pc=/.test(collapsedSchemeUrl), 'scheme collapse was not encoded in the address');
    await page.reload();
    await waitLoaded();
    await settle();
    check(!(await page.getByRole('heading', { name: 'Recoded Genome Scheme', level: 3 }).isVisible()),
      'scheme facts did not remain collapsed after reload');
    await page.locator('#panel-toggle-scheme').click();

    const viewports = [
      { width: 375, height: 812, name: 'mobile' },
      { width: 768, height: 1024, name: 'tablet' },
      { width: 1280, height: 800, name: 'desktop' },
      { width: 1440, height: 900, name: 'wide' },
    ];
    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      await page.evaluate(() => scrollTo(0, 0));
      await settle();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      check(overflow <= 0, `${viewport.name}: horizontal overflow ${overflow}`);
      await page.screenshot({ path: `${initial.root}/syn57-${viewport.name}.png`, fullPage: true });
    }

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.getByText('GC3 explanation', { exact: true }).click();
    const metricHelp = await page.locator('#map-section').innerText();
    check(/publisher-deposited Ec_Syn57 .*design.*CDS/i.test(metricHelp),
      'rendered GC3 help does not name the design CDS source');
    check(!/RefSeq coding sequence/i.test(metricHelp),
      'rendered metric help falsely claims a RefSeq source');
    await page.getByRole('button', { name: 'Ec_Syn57 aggregate' }).click();
    check(await page.locator('.target-list li').count() === 7,
      'Ec_Syn57 preset did not expose seven targets');
    const schemeText = await page.locator('.target-list').innerText();
    for (const codon of ['AGC', 'AGT', 'TTA', 'TTG', 'AGA', 'AGG', 'TAG']) {
      check(schemeText.includes(codon), `Ec_Syn57 preset omitted ${codon}`);
    }

    await page.locator('#gene-search').fill('b0002');
    const results = page.locator('#gene-search-results');
    await results.waitFor({ state: 'visible' });
    check(/1 gene matches “b0002”/.test(await results.innerText()),
      'native-coordinate gene search did not find b0002');
    await results.locator('[data-gene-id="b0002"][data-search-action="shortlist"]').click();
    check(await page.getByRole('button', { name: /Export CSV and manifest/ }).isEnabled(),
      'shortlisting did not enable export');

    const downloads = [];
    const onDownload = (download) => downloads.push(download.suggestedFilename());
    page.on('download', onDownload);
    await page.getByRole('button', { name: /Export CSV and manifest/ }).click();
    await page.getByText(/Exported 1 row for 1 scheme/).waitFor();
    await page.waitForTimeout(50);
    page.off('download', onDownload);
    check(downloads.length === 2, `expected CSV and manifest downloads; got ${downloads.length}`);
    check(downloads.every((name) => name.includes('ecoli-syn57-design')),
      `export filenames lost Syn57 identity: ${downloads.join(', ')}`);

    await page.getByRole('tab', { name: 'Chromosome/Gene' }).click();
    check(await page.locator('#chromosome-canvas').isVisible(), 'Syn57 chromosome did not render');
    check(/Ec_Syn57|3,973,902/.test(await page.locator('#chromosome-view').innerText()),
      'chromosome view did not retain the Syn57 coordinate identity');
    await page.screenshot({ path: `${initial.root}/syn57-chromosome-gene.png`, fullPage: true });

    await page.getByRole('button', { name: 'Move Recoding scheme down' }).click();
    await page.locator('#panel-toggle-filters').click();
    check(await page.locator('[data-panel-id="scheme"]').getAttribute('data-panel-position') === '3',
      'scheme panel did not move');
    check(await page.locator('#panel-toggle-filters').getAttribute('aria-expanded') === 'false',
      'filters panel did not collapse');
    const arrangedUrl = page.url();
    check(/po=/.test(arrangedUrl) && /pc=/.test(arrangedUrl),
      'panel order and collapse were not encoded in the address');
    await page.reload();
    await waitLoaded();
    await settle();
    check(await page.locator('[data-panel-id="scheme"]').getAttribute('data-panel-position') === '3',
      'scheme panel order did not survive reload');
    check(await page.locator('#panel-toggle-filters').getAttribute('aria-expanded') === 'false',
      'filter collapse did not survive reload');

    await page.getByRole('tab', { name: 'Strain fitness' }).click();
    const fitness = await page.getByRole('tabpanel', { name: 'Strain fitness' }).innerText();
    check(/unavailable|not available|does not publish|no .*fitness/i.test(fitness),
      `design-only fitness absence is unclear: ${fitness.slice(0, 180)}`);
    healthy.arrangedUrl = arrangedUrl;
    healthy.downloads = downloads;
    healthy.storageKeys = await page.evaluate(() => Object.keys(localStorage).sort());
    check(diagnostics.length === 0, `healthy runtime diagnostics: ${diagnostics.join('; ')}`);
  } finally {
    page.off('pageerror', onPageError);
    page.off('console', onConsole);
    page.off('requestfailed', onRequestFailed);
  }

  await page.goto(url('&data=../.playwright-cli/dem-352-syn57/missing/'));
  await page.locator('#load-status.error').waitFor({ state: 'visible' });
  check(/The gene data could not be loaded/.test(await page.locator('#load-status').innerText()),
    'missing data did not produce the explicit load error');
  check(await page.getByRole('button', { name: 'Retry' }).isVisible(),
    'missing-data error has no retry action');
  check(await page.locator('#organism-selector').isVisible(),
    'organism navigation disappeared from the error state');
  await page.screenshot({ path: `${initial.root}/syn57-missing-data.png`, fullPage: true });
  return { ok: true, ...healthy, diagnostics };
}

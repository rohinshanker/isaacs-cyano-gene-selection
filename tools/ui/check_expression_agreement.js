/**
 * Exercise the published expression-agreement sidecar in the real Data
 * Selection dialog. Run with the normal UTEX data and an absolute
 * `?uiArtifacts=...` directory.
 */
async (page) => {
  const { root, base, hasOverride } = await page.evaluate(() => ({
    root: new URL(location.href).searchParams.get('uiArtifacts'),
    base: location.href.split('#')[0],
    hasOverride: ['org', 'data'].some((key) => new URL(location.href).searchParams.has(key)),
  }));
  if (!root?.startsWith('/')) throw new Error('An absolute uiArtifacts directory is required.');
  if (hasOverride) throw new Error('The agreement check requires published UTEX data without overrides.');

  const check = (ok, message) => { if (!ok) throw new Error(message); };
  const diagnostics = [];
  let expectedAgreementFailure = false;
  let manifestWithoutAgreement = false;
  let agreementMode = 'ready';
  let releaseAgreement = null;

  page.on('pageerror', (error) => diagnostics.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    if (message.text().includes('503 (Service Unavailable)')) return;
    if (expectedAgreementFailure && message.text().includes('expression_agreement')) return;
    diagnostics.push(`console: ${message.text()}`);
  });
  page.on('requestfailed', (request) => {
    if (expectedAgreementFailure && request.url().includes('expression_agreement')) return;
    diagnostics.push(`requestfailed: ${request.url()}`);
  });
  page.on('response', (response) => {
    if (response.status() < 400) return;
    if (expectedAgreementFailure && response.url().includes('expression_agreement')) return;
    diagnostics.push(`response ${response.status()}: ${response.url()}`);
  });

  await page.route('**/data/data-manifest.json*', async (route) => {
    const response = await route.fetch();
    const manifest = await response.json();
    if (manifestWithoutAgreement) {
      delete manifest.files['expression_agreement.json'];
    }
    await route.fulfill({
      response,
      json: manifest,
      headers: { ...response.headers(), 'cache-control': 'no-store' },
    });
  });
  await page.route('**/data/expression_agreement.json*', async (route) => {
    if (agreementMode === 'failed') {
      await route.fulfill({ status: 503, contentType: 'text/plain', body: 'intentional agreement check failure' });
      return;
    }
    if (agreementMode === 'loading') {
      await new Promise((resolve) => { releaseAgreement = resolve; });
    }
    await route.continue();
  });

  const fresh = async ({ agreement = 'ready', missing = false } = {}) => {
    agreementMode = agreement;
    manifestWithoutAgreement = missing;
    releaseAgreement = null;
    await page.goto(`${base}&case=${agreement}-${missing ? 'missing' : 'present'}-${Date.now()}`, {
      waitUntil: agreement === 'loading' ? 'domcontentloaded' : 'load',
    });
    await page.locator('body.is-loading').waitFor({ state: 'detached' });
  };

  const openDialog = async () => {
    await page.locator('#color-by').selectOption('type.transcriptomics.rna-seq.abundance');
    const details = page.locator('#data-sources details');
    if (!await details.evaluate((node) => node.open)) await page.locator('#data-sources summary').click();
    await page.locator('#data-sources .data-sources-change').click();
    const dialog = page.getByRole('dialog', { name: 'Data selection', exact: true });
    await dialog.waitFor();
    await dialog.getByRole('tab', { name: /^Transcriptomics \(/ }).click();
    return dialog;
  };

  const choose = async (dialog, left, right) => {
    await dialog.locator('.ds-agreement-left').selectOption(left);
    await dialog.locator('.ds-agreement-right').selectOption(right);
  };

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await fresh();
  let dialog = await openDialog();
  await dialog.locator('.ds-agreement-left').waitFor();
  check(await dialog.getAttribute('aria-modal') === 'true', 'Data selection must be an aria-modal dialog');
  check(await dialog.locator('.ds-agreement-left option').count() === 55, 'Source A must offer 55 admitted sources');
  check(await dialog.locator('.ds-agreement-right option').count() === 55, 'Source B must offer 55 admitted sources');
  check(await dialog.locator('.ds-agreement-left option', { hasText: 'not covered' }).count() === 2,
    'Source A must expose the two explicit coverage gaps');
  check(await dialog.locator('.ds-agreement-right option', { hasText: 'not covered' }).count() === 2,
    'Source B must expose the two explicit coverage gaps');

  await choose(dialog, 'GSE103462_wt_subjective_dawn', 'GSE103463_rel_relA_subjective_dawn');
  check(await dialog.locator('.ds-agreement-pair').getByText(/Layer-level Spearman/).count() === 1,
    'A report-backed pair must show its layer-level statistic');
  check(await dialog.locator('.ds-agreement-responses li').count() === 1,
    'The cross-study circadian pair must show its response comparison');
  const responseText = await dialog.locator('.ds-agreement-responses').innerText();
  check(/Spearman/.test(responseText) && /Pearson/.test(responseText)
    && /same direction/.test(responseText) && /shared responses/.test(responseText),
  'Response evidence must include statistics and denominators');
  check(/recorded study contrasts.*not necessarily the two selected layer conditions/i.test(
    await dialog.locator('.peek-side').innerText()),
  'Response evidence must not be presented as the arbitrary selected layer pair');
  const responseDisclosure = dialog.locator('.ds-agreement-responses details');
  check(/Treatment: wild type replicate 1 dusk; wild type replicate 2 dusk/.test(
    await responseDisclosure.textContent())
    && /Control: wild type replicate 1 dawn; wild type replicate 2 dawn/.test(
      await responseDisclosure.textContent())
    && /dawn is a phase baseline, not a simultaneous untreated control/.test(
      await responseDisclosure.textContent()),
  'Response disclosure must preserve exact arms and contrast caveats');
  const sourceDisclosure = dialog.locator('.ds-agreement-source details').first();
  check(/Strain: PCC 7942/.test(await sourceDisclosure.textContent())
    && /over 2,551 shared genes/.test(await sourceDisclosure.textContent()),
  'Source disclosure must preserve strain and the sample-pair denominator');
  check(await dialog.getByText(/No value is a pass\/fail threshold or a comparability decision/).count() === 1,
    'The report must not imply an automatic comparability decision');
  const reportScope = await dialog.locator('.ds-agreement-limitations').textContent();
  check(reportScope.includes('log2(mean normalized treatment / mean normalized control)')
    && reportScope.includes('before exact one-to-one crosswalk mapping'),
  'The report methods must explain response units and source-to-UTEX mapping');

  await choose(dialog, 'GSE103462_wt_subjective_dawn', 'GSE103462_wt_subjective_dusk');
  check(await dialog.getByText(/No response comparison with an explicit control arm/).count() === 1,
    'A pair without response evidence must say so explicitly');

  await choose(dialog, 'GSE225426_wt_control', 'GSE103462_wt_subjective_dawn');
  check(await dialog.getByText(/no biological-replicate band is claimed because replication is unknown/).count() === 1,
    'Unknown replication must not be presented as a biological band');

  await choose(dialog, 'GSE205444', 'GSE103462_wt_subjective_dawn');
  check(await dialog.getByText(/No summary for this admitted RNA-seq source/).count() === 1,
    'A coverage gap must remain explicit in the selected-source detail');
  check(await dialog.getByText(/outside the current report/).count() === 1,
    'A coverage gap must not produce an invented pair statistic');
  check(await dialog.getByText(/Time-course layer means may pool time points/).count() === 1
    && await dialog.getByText(/No value is a pass\/fail threshold or a comparability decision/).count() === 1,
  'Report-wide aggregation and no-threshold caveats must survive a coverage-gap early return');

  await choose(dialog, 'GSE103462_wt_subjective_dawn', 'GSE103463_rel_relA_subjective_dawn');
  const viewports = [[375, 812], [419, 812], [420, 812], [421, 812], [599, 900], [600, 900], [601, 900], [699, 900], [700, 900], [768, 1024], [1280, 800], [1319, 900], [1320, 900], [1440, 900]];
  const matrix = [];
  for (const [width, height] of viewports) {
    await page.setViewportSize({ width, height });
    const layout = await dialog.evaluate((node) => ({
      pageOverflow: document.documentElement.scrollWidth > innerWidth + 1,
      dialogOverflow: node.scrollWidth > node.clientWidth + 1,
      sideOverflow: node.querySelector('.peek-side').scrollWidth
        > node.querySelector('.peek-side').clientWidth + 1,
      agreementOverflow: [...node.querySelectorAll('.ds-agreement-controls, .ds-agreement-source, .ds-agreement-pair, .ds-agreement-responses')]
        .some((entry) => entry.scrollWidth > entry.clientWidth + 1),
      responseRows: node.querySelectorAll('.ds-agreement-responses li').length,
      optionCount: node.querySelectorAll('.ds-agreement-left option').length,
      sideHeight: node.querySelector('.peek-side').clientHeight,
      cardHeight: node.querySelector('.ds-agreement-source').getBoundingClientRect().height,
      footerLast: node.querySelector('.peek-body').lastElementChild.classList.contains('peek-foot'),
    }));
    check(!layout.pageOverflow, `page horizontal overflow at ${width}px`);
    check(!layout.dialogOverflow, `dialog horizontal overflow at ${width}px`);
    check(!layout.sideOverflow, `comparison pane horizontal overflow at ${width}px`);
    check(!layout.agreementOverflow, `agreement evidence horizontal overflow at ${width}px`);
    check(layout.responseRows === 1, `response evidence lost at ${width}px`);
    check(layout.optionCount === 55, `bounded source discovery lost at ${width}px`);
    if (width <= 600) {
      check(layout.sideHeight >= layout.cardHeight + 24, `phone comparison pane cannot fit a source card at ${width}px`);
      check(layout.footerLast, `phone footer must follow the comparison in focus order at ${width}px`);
    }
    matrix.push({ width, height, ...layout });
    await page.screenshot({ path: `${root}/agreement-${width}.png`, fullPage: true });
  }
  await page.locator('.ds-agreement-left').focus();
  await page.keyboard.press('Escape');
  check(await dialog.isHidden(), 'Escape must close the data-selection dialog');
  check(await page.locator('#data-sources .data-sources-change').evaluate((node) => node === document.activeElement),
    'Closing the dialog must restore focus to Change Data Selection');

  agreementMode = 'failed';
  expectedAgreementFailure = true;
  await fresh({ agreement: 'failed' });
  dialog = await openDialog();
  check(await dialog.getByRole('alert').getByText(/could not be loaded or validated/).count() === 1,
    'A failed sidecar must show a visible error');
  await page.screenshot({ path: `${root}/agreement-failed.png`, fullPage: true });
  agreementMode = 'ready';
  expectedAgreementFailure = false;
  await dialog.getByRole('button', { name: 'Retry agreement report' }).click();
  await dialog.locator('.ds-agreement-left').waitFor();
  await choose(dialog, 'GSE103462_wt_subjective_dawn', 'GSE103463_rel_relA_subjective_dawn');
  check(await dialog.locator('.ds-agreement-pair').count() === 1,
    'Retry must restore validated agreement evidence');

  await fresh({ missing: true });
  dialog = await openDialog();
  check(await dialog.getByText(/No processed-expression agreement report is published/).count() === 1,
    'An absent sidecar must remain an explicit non-report state');
  check(await dialog.locator('.ds-agreement-left').count() === 0,
    'An absent sidecar must not leave stale statistics in the dialog');
  await page.screenshot({ path: `${root}/agreement-absent.png`, fullPage: true });

  const loadingNavigation = fresh({ agreement: 'loading' });
  await page.waitForFunction(() => Boolean(document.querySelector('#color-by')));
  dialog = await openDialog();
  check(await dialog.getByRole('status').getByText(/Loading the validated statistics-only agreement report/).count() === 1,
    'A pending sidecar must show a visible loading state');
  await page.screenshot({ path: `${root}/agreement-loading.png`, fullPage: true });
  agreementMode = 'ready';
  releaseAgreement?.();
  await loadingNavigation;
  await dialog.locator('.ds-agreement-left').waitFor();

  check(diagnostics.length === 0, `runtime diagnostics: ${diagnostics.join('; ')}`);
  return {
    coverage: { admitted: 55, reportBacked: 53, gaps: ['GSE205444', 'TAN2018_TSS'] },
    discovery: 'two 55-option source selectors; no exhaustive pair list',
    states: ['ready', 'loading', 'failed + retry', 'absent'],
    statistics: ['layer Spearman + denominator', 'response Spearman/Pearson/sign agreement + denominators'],
    accessibility: 'aria-modal, labelled selects, Escape dismissal, and focus restoration passed',
    matrix,
    diagnostics,
  };
}

/** Real release-data UI regression. Run with playwright-cli run-code --filename. */
async (page) => {
  const { root, base } = await page.evaluate(() => ({
    root: new URL(location.href).searchParams.get('uiArtifacts'), base: new URL('index.html', location.href).href,
  }));
  if (!root?.startsWith('/')) throw new Error('Pass an absolute ignored uiArtifacts directory.');
  const check = (ok, message) => { if (!ok) throw new Error(message); };
  const errors = []; const failures = []; const evidence = [];
  const heldContinuations = [];
  let expectedFailure = false; let expectedFailureUrl = null; let release;
  const onError = (error) => errors.push(error.message);
  const onConsole = (message) => {
    if (message.type() === 'error' && !(expectedFailure && message.text().includes('503') && message.location().url === expectedFailureUrl)) errors.push(message.text());
  };
  const onFailed = (request) => failures.push(request.url());
  page.on('pageerror', onError); page.on('console', onConsole); page.on('requestfailed', onFailed);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  let count = 0; const nonce = Date.now();
  const hash = (extra = '') => `ver=9&p=chromosome&c=editedTssSitesInCds&g=M744_RS00135&s=TCG-AGC.TCA-AGT.TAG-TAA${extra}`;
  const open = async (extra = '', query = '') => {
    await page.goto(`${base}?uiArtifacts=${encodeURIComponent(root)}&tssEditUi=${nonce}-${++count}${query}#${hash(extra)}`);
    await page.locator('.chromosome-sequence .tss-edit-details').waitFor();
  };
  const summary = () => page.locator('.chromosome-sequence .tss-edit-details > summary');
  const evaluated = () => page.waitForFunction(() => document.querySelector('.chromosome-sequence .tss-edit-details > summary')?.textContent.includes('evaluated') && !document.querySelector('.chromosome-sequence .tss-edit-details > summary')?.textContent.includes('not evaluated'));
  const save = async (name, component = null) => {
    await page.screenshot({ path: `${root}/${name}.png` });
    if (component) await component.screenshot({ path: `${root}/${name}-component.png` });
    evidence.push({ name, url: page.url(), snapshot: await page.locator('body').ariaSnapshot() });
  };
  const noOverflow = async (width) => check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `page overflow at ${width}`);
  try {
    await page.setViewportSize({ width: 1440, height: 900 });
    await open(); await evaluated();
    check((await summary().innerText()).includes('1 edited / 4 evaluated'), 'real plus-strand release count');
    await save('tss-initial-1440', page.locator('.chromosome-sequence'));
    await page.getByRole('button', { name: 'No scheme', exact: true }).click();
    check((await summary().innerText()).includes('0 edited / 4 evaluated'), 'scheme clear updates immediately');
    await page.getByRole('button', { name: 'Syn61 original design', exact: true }).click();
    check((await summary().innerText()).includes('1 edited / 4 evaluated'), 'preset updates immediately');
    if (await page.locator('#panel-toggle-gene-viewer').getAttribute('aria-expanded') === 'false') await page.locator('#panel-toggle-gene-viewer').click();
    check(await page.locator('.tss-edit-details').count() === 3, 'both compact visualizers and expanded view');
    for (const panel of await page.locator('.tss-edit-details').all()) {
      check((await panel.locator('summary').innerText()).includes('1 edited / 4 evaluated'), 'all viewer counts agree');
      await panel.locator('summary').focus(); await page.keyboard.press('Enter');
      check(await panel.getAttribute('open') !== null, 'disclosure keyboard opens');
      check(await panel.locator('.tss-edit-row').count() === 4, 'every recorded physical identity listed');
      check((await panel.innerText()).includes('Edited TSS base:') && (await panel.innerText()).includes('Unchanged TSS base:'), 'text distinguishes edited and unchanged');
      check((await panel.innerText()).includes('independently recoding this focal CDS'), 'focal-CDS scope disclosed');
    }
    const sequence = page.locator('.chromosome-sequence');
    check((await sequence.innerText()).includes('including self, neighbouring and unassigned associations'), 'expanded line key names the actual set');
    check(await page.locator('.gene-view-key-neighbor-site').evaluateAll((nodes) => nodes.every((node) => node.parentElement.textContent.includes('Recorded Tan TSS in CDS'))), 'both compact line keys name the actual set');
    const editedRow = sequence.locator('.tss-edit-row').filter({ hasText: /^Edited TSS base:/ }).first();
    await editedRow.getByRole('button', { name: /^Inspect / }).focus(); await page.keyboard.press('Enter');
    for (let i = 0; i < 5; i += 1) await sequence.getByRole('button', { name: 'Zoom in on the sequence', exact: true }).click();
    const exact = async () => {
      check(await sequence.locator('.neighbor-site-mark[data-edit-status="edited"]').count() > 0, 'edited marker remains at native base');
      check(await sequence.locator('.neighbor-site-mark[data-edit-status="edited"]').evaluateAll((marks) => marks.every((mark) => {
        const x = Number(mark.querySelector('.neighbor-site-tick').getAttribute('x1'));
        const strip = mark.closest('svg');
        const originals = [...strip.querySelectorAll('.gene-sequence-letter-original')];
        const recoded = [...strip.querySelectorAll('.gene-sequence-letter-recoded')];
        const original = originals.find((node) => Math.abs(Number(node.getAttribute('x')) - x) < 0.01);
        const replacement = recoded.find((node) => Math.abs(Number(node.getAttribute('x')) - x) < 0.01);
        const lines = [...mark.querySelectorAll('.neighbor-site-base')];
        return original && replacement && original.textContent !== replacement.textContent && lines.length === 2
          && lines.every((line) => Math.abs((Number(line.getAttribute('x1')) + Number(line.getAttribute('x2'))) / 2 - x) < 0.01)
          && mark.getAttribute('aria-label').includes(`${original.textContent} → ${replacement.textContent}`)
          && mark.querySelector('polygon') && lines.every((line) => line.getAttribute('stroke-linecap') === 'butt');
      })), 'exact changed letters, one-base underlines and edited diamond');
    };
    for (const [width, height] of [[375,812],[768,1024],[959,900],[961,900],[1239,900],[1241,900],[1280,800],[1440,900]]) {
      await page.setViewportSize({ width, height });
      await editedRow.getByRole('button', { name: /^Inspect / }).click();
      await exact(); await noOverflow(width);
      await sequence.locator('.gene-sequence-strip').scrollIntoViewIfNeeded();
      await save(`tss-expanded-${width}`, sequence);
      for (const [i, compact] of (await page.locator('.gene-view').all()).entries()) {
        await compact.locator('.tss-edit-details').scrollIntoViewIfNeeded();
        check(await compact.locator('.neighbor-site-mark[data-edit-status="edited"]').count() === 1, `compact ${i} edited mark`);
        const graphic = compact.locator('svg').first();
        await graphic.scrollIntoViewIfNeeded();
        await save(`tss-compact-${i}-${width}`, graphic);
        const edited = compact.locator('.tss-edit-row').filter({ hasText: /^Edited TSS base:/ }).first();
        await edited.scrollIntoViewIfNeeded();
        await save(`tss-compact-detail-${i}-${width}`, edited);
      }
    }
    const focusedMark = sequence.locator('.neighbor-site-mark[data-edit-status="edited"]').first();
    await focusedMark.focus();
    await page.keyboard.press('Tab'); await page.keyboard.press('Shift+Tab');
    check(await focusedMark.evaluate((node) => node === document.activeElement
      && getComputedStyle(node.querySelector('rect')).stroke !== 'none'), 'edited exact-base marker has visible keyboard focus');
    await save('tss-edited-focus', sequence.locator('.gene-sequence-strip'));
    // Each color selector reads the same registry, including after repeated transitions.
    for (const [tab, picker] of [['Native codon space', '#color-by'], ['Chromosome/Gene', '#chromosome-color-by']]) {
      await page.getByRole('tab', { name: tab, exact: true }).click();
      for (const key of ['lengthNt', 'editedTssSitesInCds', 'evaluatedTssSitesInCds', 'editedTssSitesInCds']) {
        await page.locator(picker).selectOption(key);
        check(page.url().includes(`c=${key}`), `${tab} color saved`);
      }
      await noOverflow(1440);
      await save(`tss-color-${tab.startsWith('Native') ? 'scatter' : 'chromosome'}`);
    }
    await open('&g=M744_RS00665'); await evaluated();
    await summary().click();
    check((await summary().innerText()).includes('1 edited / 2 evaluated'), 'minus strand release count');
    check((await sequence.locator('.tss-edit-details').innerText()).includes('opposite strand to CDS'), 'opposite TSS strand explicit');
    check((await sequence.locator('.tss-edit-details').innerText()).includes('CDS (-) transcription orientation; site strand (+)'), 'both base orientations named');
    await save('tss-opposite-strand', sequence);
    await open('&g=M744_RS01690'); await evaluated();
    await summary().click();
    check(await sequence.locator('.tss-edit-row').count() === 18, 'dense site list complete');
    for (const [width, height] of [[375,812],[1440,900]]) {
      await page.setViewportSize({ width, height }); await noOverflow(width);
      await save(`tss-dense-${width}`, sequence);
    }
    await open('&g=M744_RS00005'); await evaluated();
    check((await summary().innerText()).includes('0 recorded sites'), 'no recorded sites explicitly named');
    await save('tss-zero-recorded', sequence);
    // Live hash restoration exercises source suspension and fresh source/scheme state without reload.
    await open(); await evaluated();
    await page.evaluate((value) => { location.hash = value; }, hash('&ds=GSE205444'));
    await page.waitForFunction(() => document.querySelector('.chromosome-sequence .tss-edit-details')?.textContent.includes('Select a Tan'));
    check((await summary().innerText()).includes('not evaluated'), 'source deselection never zero');
    check(await sequence.locator('.neighbor-site-mark').count() === 0, 'deselected source has no exact-base edit markers');
    await save('tss-source-deselected', sequence);
    for (const source of ['TAN2018_TSS_CONTROL', 'TAN2018_TSS_DARK', 'TAN2018_TSS_HIGH_LIGHT', 'TAN2018_TSS_HIGH_TEMPERATURE', 'TAN2018_TSS']) {
      await page.evaluate((value) => { location.hash = value; }, hash(`&ds=${source}`));
      await evaluated();
      check((await summary().innerText()).includes('1 edited / 4 evaluated'), `${source} retains physical identities`);
    }
    // Visibility suppresses marker focus targets while retaining textual comparisons.
    await page.evaluate((value) => { location.hash = value; }, hash('&mk=tss.gene-controls,tss.gene-detail,tss.sequence'));
    await evaluated();
    check(await page.locator('.gene-view .neighbor-site-mark, .gene-sequence-strip .neighbor-site-mark').count() === 0, 'hidden marks have no targets');
    check((await summary().innerText()).includes('1 edited / 4 evaluated'), 'hidden is still evaluated');
    await summary().click();
    check(await sequence.locator('.tss-edit-row button').first().isDisabled(), 'hidden inspector disabled');
    await save('tss-hidden', sequence);
    // Delay a real source file, then fail it and exercise the app retry button.
    const held = new Promise((resolve) => { release = resolve; });
    await page.route('**/data/regulatory_tss.json*', (route) => {
      const continuation = held.then(() => route.continue());
      heldContinuations.push(continuation); return continuation;
    });
    await page.goto(`${base}?uiArtifacts=${encodeURIComponent(root)}&tssEditUi=${nonce}-${++count}#ver=9&p=native&c=functionCategory`);
    await page.locator('.neighbor-site-filter').waitFor();
    await page.evaluate(() => { location.hash = 'ver=9&p=native&c=functionCategory&g=M744_RS00135'; });
    await page.waitForFunction(() => document.querySelector('.tss-edit-details')?.textContent.includes('loading'));
    check((await page.locator('.tss-edit-details > summary').first().innerText()).includes('not evaluated'), 'loading not evaluated');
    await save('tss-loading'); release(); await Promise.all(heldContinuations); await page.unroute('**/data/regulatory_tss.json*');
    expectedFailure = true;
    await page.route('**/data/regulatory_tss.json*', (route) => { expectedFailureUrl = route.request().url(); return route.fulfill({ status: 503, body: '{}', contentType: 'application/json' }); });
    await open();
    await page.waitForFunction(() => document.querySelector('.chromosome-sequence .tss-edit-details')?.textContent.includes('failed to load'));
    check((await summary().innerText()).includes('not evaluated'), 'failure not evaluated');
    await save('tss-failed', sequence);
    await page.unroute('**/data/regulatory_tss.json*');
    await page.getByRole('button', { name: /Retry loading.*regulatory/i }).click();
    await evaluated(); expectedFailure = false;
    check((await summary().innerText()).includes('1 edited / 4 evaluated'), 'retry restores comparison');
    await save('tss-retry', sequence);
    await open('&g=b0002', '&org=ecoli-k12-mg1655');
    check((await page.locator('.tss-edit-details').first().textContent()).includes('unavailable for this organism'), 'unsupported organism not evaluated');
    await open(); await evaluated();
    check((await summary().innerText()).includes('1 edited / 4 evaluated'), 'organism return has no stale values');
    check(errors.length === 0, `Unexpected runtime errors: ${errors.join('; ')}`);
    check(failures.length === 0, `Unexpected failed requests: ${failures.join('; ')}`);
    return { passed: true, states: evidence.length, errors, failures, artifacts: root, semanticSnapshots: evidence };
  } finally {
    release?.();
    await Promise.allSettled(heldContinuations);
    await page.unroute('**/data/regulatory_tss.json*');
    page.off('pageerror', onError); page.off('console', onConsole); page.off('requestfailed', onFailed);
  }
}

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
  check(await region.locator('.folding-alignment:visible').count() === 0, 'details collapsed initially');
  await region.locator('.folding-comparison summary').first().focus();
  await page.keyboard.press('Enter');
  await region.locator('.folding-alignment').first().waitFor({ state: 'visible' });
  check(await region.locator('.folding-alignment:visible').count() === 1, 'keyboard expands');
  await region.locator('.folding-alignment').first().focus();
  await page.keyboard.press('ArrowRight');
  check(await region.locator('.folding-alignment').first().evaluate((element) => element === document.activeElement), 'alignment keyboard focus');
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
  await region.locator('.folding-comparison summary').first().focus();
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
  check(diagnostics.length === 0, `unexpected diagnostics: ${diagnostics.join('; ')}`);
  return { counts, identity, snapshots, diagnostics, viewports: 10,
    states: ['real-worker changed structure', 'real-worker identity', 'collapsed', 'expanded', 'keyboard', 'input invalidation', 'unavailable fixture'] };
}

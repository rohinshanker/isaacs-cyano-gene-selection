/** Browser checks for the adjustable exact-upstream window and annotation access. */
async (page) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const root = await page.evaluate(() => new URL(location.href).searchParams.get('uiArtifacts'));
  if (!root?.startsWith('/')) throw new Error('An absolute uiArtifacts directory is required.');
  const errors = [];
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('requestfailed', (request) => errors.push(request.url()));
  const check = (condition, message) => { if (!condition) throw new Error(message); };
  const base = (await page.url()).split('#')[0];
  const gene = 'M744_RS09240';
  const widths = [[375, 812], [768, 1024], [959, 900], [960, 900],
    [1239, 900], [1240, 900], [1280, 800], [1440, 900]];
  const evidence = [];
  let run = 0;

  for (const [width, height] of widths) {
    run += 1;
    await page.setViewportSize({ width, height });
    await page.goto(`${base}&upstreamRun=${run}#ver=6&p=chromosome&g=${gene}`);
    await page.waitForSelector('.gene-sequence-upstream-control select', { timeout: 30000 });
    const selector = page.locator('.gene-sequence-upstream-control select');
    check(await selector.inputValue() === '30', `${width}: initial extent is not 30`);
    check(await page.locator('.gene-sequence-upstream-control option').allTextContents()
      .then((items) => items.includes('1,000 nt')), `${width}: 1,000 nt is not offered`);
    check(await page.locator('[data-sequence-action="gene-sequence-start-sites"]').count() === 0,
      `${width}: an out-of-range initial marker unexpectedly has a control`);

    // An annotation owns its pointer event so focus can expose its metadata,
    // but start/stop annotations must still perform the strip's codon selection.
    await page.getByRole('button', { name: 'Return to the start of the gene' }).click();
    await page.waitForSelector('.gene-sequence-codon[data-codon-index="1"]');
    await page.locator('.gene-sequence-codon[data-codon-index="1"] .gene-sequence-letter-original')
      .first().click();
    check(await page.locator('.gene-sequence-selection').textContent()
      .then((text) => /^Codon 2 of 453:/.test(text)), `${width}: codon 2 was not selected`);
    const start = page.locator('.gene-sequence-annotation[data-codon-index="0"]').first();
    if (width === 375) {
      await start.dispatchEvent('pointerdown', { pointerId: 41, pointerType: 'touch' });
      await start.dispatchEvent('pointerup', { pointerId: 41, pointerType: 'touch' });
      await start.dispatchEvent('click', { pointerType: 'touch' });
    } else {
      await start.locator('.gene-sequence-letter-original').first().click();
    }
    check(await page.locator('.gene-sequence-selection').textContent()
      .then((text) => /^Codon 1: initiation triplet ATG/.test(text)),
    `${width}: pointer activation left the readout on codon 2`);
    check(await start.evaluate((node) => document.activeElement === node),
      `${width}: pointer activation did not retain start-codon focus`);

    await page.locator('.gene-sequence-strip').focus();
    await page.keyboard.press('End');
    await page.locator('.gene-sequence-codon[data-codon-index="452"] .gene-sequence-letter-original')
      .first().click();
    check(await page.locator('.gene-sequence-selection').textContent()
      .then((text) => /^Codon 453 of 453:/.test(text)), `${width}: codon 453 was not selected`);
    const stop = page.locator('.gene-sequence-codon-stop[data-codon-index="453"]').first();
    await stop.locator('.gene-sequence-letter-original').first().click();
    check(await page.locator('.gene-sequence-selection').textContent()
      .then((text) => /^Terminal stop TAG\./.test(text)),
    `${width}: pointer activation left the readout on codon 453`);
    check(await stop.evaluate((node) => document.activeElement === node),
      `${width}: pointer activation did not retain stop-codon focus`);

    await selector.selectOption('1000');
    await page.getByRole('button', { name: 'Fit the whole gene into the strip' }).click();
    await page.waitForTimeout(350);
    await page.waitForSelector('g.gene-sequence-marker', { timeout: 30000 });
    const state = await page.evaluate(() => {
      const select = document.querySelector('.gene-sequence-upstream-control select');
      const marks = [...document.querySelectorAll('g.gene-sequence-marker')];
      const strip = document.querySelector('.gene-sequence-strip').getBoundingClientRect();
      return {
        selected: select?.value,
        marks: marks.length,
        sourceMarks: marks.filter((mark) => mark.dataset.markerOrigin === 'source').length,
        labels: marks.map((mark) => mark.getAttribute('aria-label')),
        focusableMarks: marks.filter((mark) => mark.getAttribute('tabindex') === '0').length,
        focusableCodons: document.querySelectorAll(
          '.gene-sequence-annotation[tabindex="0"][aria-label]',
        ).length,
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        stripOverflow: Math.max(0, strip.right - innerWidth) + Math.max(0, -strip.left),
      };
    });
    check(state.selected === '1000', `${width}: expanded extent did not stay selected`);
    check(state.marks > 0 && state.sourceMarks === state.marks,
      `${width}: expanded Tan source marks were not drawn with explicit origin`);
    check(state.labels.every((label) => /published .* upstream/.test(label)),
      `${width}: published gene-model distances were relabelled`);
    check(state.focusableMarks === state.marks && state.focusableCodons >= 2,
      `${width}: annotations are not keyboard inspectable`);
    check(state.overflow <= 0 && state.stripOverflow <= 0, `${width}: page or strip overflowed`);

    const marker = page.locator('g.gene-sequence-marker').first();
    await page.keyboard.press('Tab');
    await marker.focus();
    const focusedStroke = await marker.locator('.gene-sequence-marker-head').evaluate(
      (node) => getComputedStyle(node).strokeWidth,
    );
    check(Number.parseFloat(focusedStroke) >= 2.5, `${width}: marker focus outline is missing`);
    const markerHead = marker.locator('.gene-sequence-marker-head');
    await markerHead.hover();
    const hoveredStroke = await marker.locator('.gene-sequence-marker-head').evaluate(
      (node) => getComputedStyle(node).strokeWidth,
    );
    check(Number.parseFloat(hoveredStroke) >= 2.5, `${width}: marker hover outline is missing`);
    await markerHead.click();
    check(await marker.evaluate((node) => document.activeElement === node),
      `${width}: pointer activation did not expose marker metadata through focus`);

    const expandedStart = page.locator('.gene-sequence-annotation[data-codon-index="0"]').first();
    await expandedStart.focus();
    await page.keyboard.press('Enter');
    check(await page.locator('.gene-sequence-selection').textContent().then((text) => /Codon 1/.test(text)),
      `${width}: keyboard activation did not open the start-codon readout`);

    await page.locator('.gene-sequence-figure').scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${root}/sequence-upstream-${width}.png` });
    await page.locator('.gene-sequence-figure')
      .screenshot({ path: `${root}/sequence-upstream-${width}-strip.png` });
    evidence.push({ width, height, focusedStroke, hoveredStroke, ...state });
  }

  // Both the controls-column and detail-card instances use this one renderer;
  // exercise its start, stop and source-site annotations in the live app.
  const geneViews = page.locator('.gene-view-svg');
  check(await geneViews.count() >= 1, 'no live compact gene visualizer was rendered');
  for (const kind of ['start', 'stop']) {
    const codon = page.locator(`.gene-view-codon-${kind}`).first();
    await page.keyboard.press('Tab');
    await codon.focus();
    const stroke = await codon.evaluate((node) => getComputedStyle(node).strokeWidth);
    check(Number.parseFloat(stroke) >= 2.5, `compact ${kind} focus outline is missing`);
    await codon.hover();
    const hoverStroke = await codon.evaluate((node) => getComputedStyle(node).strokeWidth);
    check(Number.parseFloat(hoverStroke) >= 2.5, `compact ${kind} hover outline is missing`);
  }
  const compactMarker = page.locator('g.gene-view-marker').first();
  await page.keyboard.press('Tab');
  await compactMarker.focus();
  const compactFocus = await compactMarker.locator('circle').evaluate(
    (node) => getComputedStyle(node).strokeWidth,
  );
  check(Number.parseFloat(compactFocus) >= 2, 'compact marker focus outline is missing');
  const compactHead = compactMarker.locator('circle');
  await compactHead.hover();
  const compactHover = await compactHead.evaluate((node) => getComputedStyle(node).strokeWidth);
  check(Number.parseFloat(compactHover) >= 2, 'compact marker hover outline is missing');
  await compactHead.click();
  check(await compactMarker.evaluate((node) => document.activeElement === node),
    'compact marker pointer activation did not retain metadata focus');
  await page.screenshot({ path: `${root}/gene-view-annotations-1440.png` });
  evidence.push({ compactGeneViews: await geneViews.count(), compactFocus, compactHover });

  if (errors.length > 0) throw new Error(`browser reported: ${errors.join(' | ')}`);
  return { ok: true, evidence };
}

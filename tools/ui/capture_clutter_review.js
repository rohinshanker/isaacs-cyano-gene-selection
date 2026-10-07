/** Open the real site with ?uiArtifacts=<absolute ignored directory>, then run via playwright-cli. */
async (page) => {
  const { root, base } = await page.evaluate(() => ({
    root: new URL(location.href).searchParams.get('uiArtifacts'),
    base: (() => { const url = new URL(location.href); url.hash = ''; url.searchParams.delete('organism'); return url.href; })(),
  }));
  if (!root?.startsWith('/')) throw new Error('An absolute uiArtifacts directory is required.');
  const entries = [];
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(base);
  await page.locator('body.is-loading').waitFor({ state: 'detached' });
  const tabs = await page.locator('#panel-tabs button').evaluateAll((nodes) => nodes.map((node) => ({ id: node.id, name: node.textContent })));
  for (const [width, height] of [[768, 1024], [1280, 800]]) {
    await page.setViewportSize({ width, height });
    for (const tab of tabs) {
      await page.locator(`#${tab.id}`).click();
      await page.locator('#map-section').scrollIntoViewIfNeeded();
      const paragraphs = await page.evaluate(() => [...new Set(document.querySelectorAll('p:not(.citation-text),figcaption,.panel-note,.legend-ramp-note,.ds-group-rule'))]
        .filter((node) => node.getClientRects().length > 0 && getComputedStyle(node).visibility !== 'hidden'
          && !node.closest('[hidden],[aria-hidden="true"],.visually-hidden'))
        .map((node) => ({ text: node.textContent.trim(), selector: node.id ? `#${node.id}` : `${node.tagName.toLowerCase()}.${node.className.split(' ').join('.')}`,
          region: node.closest('section,aside,article,.card')?.querySelector('h1,h2,h3')?.textContent ?? 'Page' }))
        .filter((entry) => entry.text));
      const screenshot = `${root}/clutter-${tab.id}-${width}.png`;
      await page.screenshot({ path: screenshot, fullPage: true });
      entries.push({ view: tab.name, width, screenshot, paragraphs });
    }
    await page.locator('#panel-tab-native').click();
    await page.locator('#color-by').selectOption('type.transcriptomics.rna-seq.abundance');
    if (!await page.locator('#data-sources details').evaluate((node) => node.open)) {
      await page.locator('#data-sources summary').click();
    }
    await page.locator('#data-sources .data-sources-change').click();
    await page.screenshot({ path: `${root}/clutter-data-selection-${width}.png` });
    entries.push({ view: 'Data selection', width, screenshot: `${root}/clutter-data-selection-${width}.png`,
      paragraphs: await page.locator('.peek-backdrop:not([hidden])').evaluate((root) => [...root.querySelectorAll('p,.peek-legend,.ds-group-rule')]
        .filter((node) => node.getClientRects().length).map((node) => ({ text: node.textContent.trim(), selector: `.${node.className}`, region: 'Data selection' }))) });
    await page.keyboard.press('Escape');
  }
  return entries;
}

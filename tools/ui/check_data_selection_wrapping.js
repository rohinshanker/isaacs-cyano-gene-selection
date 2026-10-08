/** Run on the real app with ?uiArtifacts=<absolute ignored directory> via playwright-cli. */
async (page) => {
  const { root, base } = await page.evaluate(() => ({
    root: new URL(location.href).searchParams.get('uiArtifacts'),
    base: location.href.split('#')[0],
  }));
  if (!root?.startsWith('/')) throw new Error('An absolute uiArtifacts directory is required.');
  const errors = [];
  const onPageError = (error) => errors.push(error.message);
  const onConsole = (message) => {
    if (message.type() === 'error') errors.push(message.text());
  };
  const onRequestFailed = (request) => errors.push(request.url());
  const onResponse = (response) => {
    if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`);
  };
  const check = (ok, message) => { if (!ok) throw new Error(message); };
  page.on('pageerror', onPageError);
  page.on('console', onConsole);
  page.on('requestfailed', onRequestFailed);
  page.on('response', onResponse);
  try {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(base);
    await page.locator('body.is-loading').waitFor({ state: 'detached' });
    await page.locator('#color-by').selectOption('type.transcriptomics.rna-seq.abundance');
    await page.locator('#data-sources summary').click();
    await page.locator('#data-sources .data-sources-change').click();
    const dialog = page.getByRole('dialog', { name: 'Data selection', exact: true });
    const matrix = [];
    for (const [width, height] of [[375, 812], [768, 1024], [1280, 800], [1319, 900], [1321, 900], [1440, 900]]) {
      await page.setViewportSize({ width, height });
      for (const type of ['Transcriptomics', 'Proteomics', 'Fitness screen']) {
        await dialog.getByRole('tab', { name: new RegExp(`^${type} \\(`) }).click();
        const tab = dialog.getByRole('tab', { name: new RegExp(`^${type} \\(`) });
        await tab.hover();
        const contrast = await tab.evaluate((node) => {
          const luminance = (color) => color.match(/[\d.]+/g).slice(0, 3)
            .map((value) => Number(value) / 255)
            .map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)
            .reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
          const style = getComputedStyle(node);
          const foreground = luminance(style.color);
          const background = luminance(style.backgroundColor);
          return (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05);
        });
        check(contrast >= 4.5, `${type} selected hover contrast ${contrast} at ${width}`);
        const layout = await dialog.evaluate((node) => {
          const identities = [...node.querySelectorAll('.ds-name-top')];
          const overflows = identities.filter((identity) => identity.scrollWidth > identity.clientWidth + 2);
          const clippedChips = [...node.querySelectorAll('.ds-name-id .ds-chip')]
            .filter((chip) => chip.scrollWidth > chip.clientWidth + 2);
          return {
            rows: identities.length,
            pageOverflow: document.documentElement.scrollWidth > innerWidth,
            overflowingIdentities: overflows.map((identity) => identity.closest('tr').dataset.id),
            clippedChips: clippedChips.map((chip) => chip.textContent),
          };
        });
        check(layout.rows > 0, `${type} has real dataset rows at ${width}`);
        check(!layout.pageOverflow, `page overflow at ${width}`);
        check(layout.overflowingIdentities.length === 0,
          `dataset identity overlaps columns at ${width}: ${layout.overflowingIdentities.join(', ')}`);
        check(layout.clippedChips.length === 0,
          `strain chip clips at ${width}: ${layout.clippedChips.join(', ')}`);
        matrix.push({ width, type, selectedHoverContrast: contrast, ...layout });
      }
      await dialog.getByRole('tab', { name: /^Transcriptomics \(/ }).click();
      const row = dialog.locator('tr[data-id="GSE311172_ad2_0_o2"]');
      await row.evaluate((node) => {
        const pane = node.closest('.peek-list');
        const header = node.closest('table').tHead;
        pane.scrollLeft = 0;
        pane.scrollTop += node.getBoundingClientRect().top - pane.getBoundingClientRect().top
          - header.getBoundingClientRect().height - 4;
      });
      await page.screenshot({ path: `${root}/long-strain-${width}-after.png` });
      await dialog.locator('.peek-list').evaluate((node) => { node.scrollLeft = node.scrollWidth; });
      check(await dialog.locator('.ds-table thead th').last().evaluate((node) => {
        const cell = node.getBoundingClientRect();
        const pane = node.closest('.peek-list').getBoundingClientRect();
        return cell.left >= pane.left - 1 && cell.right <= pane.right + 1;
      }), `last condition column reachable at ${width}`);
      await page.screenshot({ path: `${root}/conditions-${width}-right-after.png` });
    }
    await page.keyboard.press('Escape');
    check(await dialog.isHidden(), 'Escape closes the dataset picker');
    check(await page.locator('#data-sources .data-sources-change').evaluate((node) => node === document.activeElement),
      'focus restored to dataset picker opener');
    check(errors.length === 0, `runtime diagnostics: ${errors.join('; ')}`);
    return { matrix, keyboard: 'Escape and focus restoration passed', errors };
  } finally {
    page.off('pageerror', onPageError);
    page.off('console', onConsole);
    page.off('requestfailed', onRequestFailed);
    page.off('response', onResponse);
  }
}

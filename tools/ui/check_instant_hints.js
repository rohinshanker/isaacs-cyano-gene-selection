/** Run on the real app with ?uiArtifacts=<absolute ignored directory> via playwright-cli. */
async (page) => {
  const { root, base } = await page.evaluate(() => ({
    root: new URL(location.href).searchParams.get('uiArtifacts'), base: location.href.split('#')[0],
  }));
  if (!root?.startsWith('/')) throw new Error('An absolute uiArtifacts directory is required.');
  const errors = [];
  const consoleError = (message) => { if (message.type() === 'error') errors.push(message.text()); };
  const pageError = (error) => errors.push(error.message);
  const failed = (request) => errors.push(request.url());
  const check = (condition, label) => { if (!condition) throw new Error(label); };
  const fresh = (route) => route.continue();
  page.on('console', consoleError); page.on('pageerror', pageError); page.on('requestfailed', failed);
  await page.route('**/*', fresh);
  try {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(base);
    await page.locator('#color-by').selectOption('type.transcriptomics.rna-seq.abundance');
    await page.locator('#data-sources summary').click();
    await page.locator('#data-sources .data-sources-change').click();
    const popup = page.locator('.peek-backdrop:not([hidden])');
    const hint = page.locator('.instant-hint');
    const evidence = [];
    for (const [width, height] of [[375, 812], [768, 1024], [1280, 800], [1440, 900]]) {
      await page.setViewportSize({ width, height });
      for (const [column, axis] of [[3, 'temperature'], [4, 'lightIntensity'], [5, 'co2']]) {
        const track = popup.locator(`.ds-table td:nth-child(${column}) svg`).first();
        await track.scrollIntoViewIfNeeded();
        const expected = await track.getAttribute('aria-label');
        await track.hover();
        check(await hint.isVisible(), `${width}: instant entry`);
        check(await hint.textContent() === expected, `${width}: exact ${axis} text`);
        check(await popup.locator('.ds-column-guides').getAttribute('data-condition-axis') === axis, 'guide coexistence');
        const a = await hint.boundingBox();
        const t = await track.boundingBox();
        await page.mouse.move(t.x + t.width / 2 + 2, t.y + t.height / 2 + 2);
        const b = await hint.boundingBox();
        check(a.x !== b.x || a.y !== b.y, 'mouse following');
        check(b.x >= 0 && b.y >= 0 && b.x + b.width <= width && b.y + b.height <= height, 'viewport clamping');
        await track.click();
        check(!await hint.isVisible(), 'click dismissal');
        await track.hover();
        check(!await hint.isVisible(), 'same visit suppression');
        await page.mouse.move(1, 1);
        await track.hover();
        check(await hint.isVisible() && await hint.textContent() === expected, 'exit and re-entry');
      }
      await page.screenshot({ path: `${root}/integrated-hints-${width}.png` });
      evidence.push({ width, height });
    }
    const info = popup.locator('.ds-info').first();
    await info.scrollIntoViewIfNeeded(); await info.hover();
    check(await hint.textContent() === 'Source details and citation', 'HTML text preserved');
    await info.click();
    check(await popup.locator('.ds-side-title').count() === 1, 'underlying click action');
    await page.keyboard.press('Tab'); await page.keyboard.press('Shift+Tab');
    check(await info.evaluate((node) => node === document.activeElement), 'focus returned to hovered control');
    check(!await hint.isVisible(), 'focus cannot restore suppressed pointer visit');
    await page.mouse.move(1, 1);
    await page.keyboard.press('Tab'); await page.keyboard.press('Shift+Tab');
    check(await hint.isVisible(), 'keyboard focus exposes text');
    check(await page.locator('[title],svg title').count() === 0, 'native duplicates');
    await popup.locator('.peek-list').evaluate((node) => { node.scrollTop += 100; });
    await page.waitForFunction(() => document.querySelector('.instant-hint').hidden);
    await page.keyboard.press('Escape');
    check(!await hint.isVisible(), 'popup closure clears hint');
    await page.getByRole('tab', { name: 'Lengths', exact: true }).click();
    const lengthHint = page.locator('#length-view svg rect').nth(1);
    check(await lengthHint.count() > 0, 'length histogram exists');
    if (await lengthHint.count()) {
      await lengthHint.hover();
      const expected = await lengthHint.evaluate((node) => (node.getAttribute('aria-describedby') ?? '').split(/\s+/).map((id) => document.getElementById(id)?.textContent ?? '').join(''));
      check(expected && await hint.textContent() === expected, 'exact length-bin hint');
      await page.screenshot({ path: `${root}/integrated-lengths-1440.png` });
    }
    check(errors.length === 0, `runtime errors: ${errors.join('; ')}`);
    return { evidence, runtimeErrors: errors, realIos: 'not available' };
  } finally {
    await page.unroute('**/*', fresh);
    page.off('console', consoleError); page.off('pageerror', pageError); page.off('requestfailed', failed);
  }
}

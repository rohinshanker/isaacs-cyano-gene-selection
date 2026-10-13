/** Check neighbouring-site focus contrast and sequence zoom-limit feedback. */
async (page) => {
  const { root, appUrl, baseline } = await page.evaluate(() => ({
    root: new URL(location.href).searchParams.get('uiArtifacts'),
    appUrl: new URL('index.html', location.href).href,
    baseline: new URL(location.href).searchParams.get('uiRepairBaseline') === '1',
  }));
  if (!root?.startsWith('/')) throw new Error('An absolute uiArtifacts path is required.');
  const check = (ok, label) => { if (!ok) throw new Error(label); };
  const results = [];
  for (const width of [375, 1280]) for (const dpr of [1, 4]) {
    const context = await page.context().browser().newContext({
      deviceScaleFactor: dpr, viewport: { width, height: width === 375 ? 812 : 800 }, reducedMotion: 'reduce',
    });
    try {
      const p = await context.newPage();
      const errors = [], failures = [];
      p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
      p.on('pageerror', e => errors.push(e.message));
      p.on('requestfailed', r => failures.push(r.url()));
      await p.goto(`${appUrl}?repairRun=${Date.now()}#ver=8&p=chromosome&c=neighborTssOverlap&g=M744_RS01690&s=TCG-AGC`);
      await p.waitForFunction(() => document.querySelector('.neighbor-site-filter')?.textContent.includes('With recorded overlap (603)'));
      const view = p.locator('#chromosome-view');
      const canvas = view.locator('canvas').first();
      for (let i = 0; i < 14; i += 1) await view.getByRole('button', { name: 'Zoom in', exact: true }).click();
      const panel = view.locator('.neighbor-site-details').first();
      if (await panel.getAttribute('open') === null) await panel.locator('summary').first().click();
      await panel.getByRole('button', { name: /^Inspect / }).first().click();
      await canvas.focus(); await p.keyboard.press('Escape'); await p.waitForTimeout(150);
      const prefix = `${root}/${width}-${dpr}x`;
      await canvas.screenshot({ path: `${prefix}-inactive.png` });
      await panel.getByRole('button', { name: /^Inspect / }).first().click(); await p.waitForTimeout(150);
      await canvas.screenshot({ path: `${prefix}-inspect.png` });
      await canvas.focus(); await p.keyboard.press('n'); await p.waitForTimeout(150);
      await canvas.screenshot({ path: `${prefix}-keyboard-n.png` });
      const windowText = await view.locator('[role=status]').first().innerText();
      const coordinates = windowText.match(/([\d,]+)–([\d,]+) of/);
      check(Boolean(coordinates), 'chromosome window coordinates');
      const [from, to] = coordinates.slice(1).map(value => Number(value.replaceAll(',', '')));
      const canvasBox = await canvas.boundingBox();
      const drawnWidth = await canvas.evaluate(c => c.width / devicePixelRatio);
      const targetX = canvasBox.x + (16 + (319796 - from) * (drawnWidth - 32) / (to - from + 1)) * canvasBox.width / drawnWidth;
      await p.screenshot({ path: `${prefix}-keyboard-n-closeup.png`, clip: {
        x: Math.max(canvasBox.x, targetX - 45), y: canvasBox.y + 35, width: 90, height: 40,
      } });
      const ring = await canvas.evaluate((c) => {
        const dpr = devicePixelRatio;
        const data = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
        let maxRun = 0, pixels = 0;
        for (let y = 40 * dpr; y < 65 * dpr; y += 1) {
          let run = 0;
          for (let x = 0; x < c.width; x += 1) {
            const at = (y * c.width + x) * 4;
            if (data[at] === 47 && data[at + 1] === 111 && data[at + 2] === 143) {
              pixels += 1; run += 1; maxRun = Math.max(maxRun, run);
            } else run = 0;
          }
        }
        return { maxRun, pixels, dpr };
      });
      if (!baseline) check(ring.maxRun >= 2 * dpr - 1 && ring.pixels >= 16 * dpr * dpr,
        `conspicuous rendered teal ring ${width}/${dpr}: ${JSON.stringify(ring)}`);
      if (await p.locator('#panel-toggle-gene-viewer').getAttribute('aria-expanded') === 'false') await p.locator('#panel-toggle-gene-viewer').click();
      for (const [label, mount] of [['detail', p.locator('#detail .gene-view')], ['controls', p.locator('.gene-view').first()]]) {
        if (await mount.locator('.neighbor-site-mark').count() === 0) continue;
        await mount.locator('.neighbor-site-mark').first().focus();
        await p.keyboard.press('Tab'); await p.keyboard.press('Shift+Tab');
        check(await mount.locator('.neighbor-site-mark').first().evaluate(n => n === document.activeElement
          && getComputedStyle(n.querySelector('rect')).stroke !== 'none'), 'visible compact keyboard focus');
        await mount.screenshot({ path: `${prefix}-${label}-focus.png` });
      }
      const sequence = p.locator('.chromosome-sequence');
      const sites = sequence.locator('.neighbor-site-details');
      if (await sites.getAttribute('open') === null) await sites.locator('summary').first().click();
      await sites.getByRole('button', { name: /^Inspect / }).first().click();
      for (let i = 0; i < 6; i += 1) await sequence.getByRole('button', { name: 'Zoom in on the sequence', exact: true }).click();
      const strip = sequence.locator('.gene-sequence-strip');
      const fingerprint = () => strip.evaluate(n => JSON.stringify({
        description: n.querySelector('svg').getAttribute('aria-label'),
        x: [...n.querySelectorAll('.neighbor-site-tick')].map(l => l.getAttribute('x1')),
      }));
      const atMax = await fingerprint();
      await sequence.getByRole('button', { name: 'Zoom in on the sequence', exact: true }).click();
      if (!baseline) check((await p.locator('#announcer').textContent()).includes('Maximum sequence zoom'), 'max button feedback');
      await strip.focus(); await p.keyboard.press('+');
      const maxFeedback = await p.locator('#announcer').textContent();
      if (!baseline) check(maxFeedback.includes('Maximum sequence zoom'), 'max key feedback');
      const box = await strip.boundingBox(); await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await p.mouse.wheel(0, -2000); await p.waitForTimeout(100); await p.mouse.move(0, 0);
      check(await fingerprint() === atMax, 'max zoom leaves inspected base and camera fixed');
      check(await p.locator('#announcer').textContent() === maxFeedback, 'max wheel leaves announcement alone');
      check(await strip.locator('.neighbor-site-mark').count() > 0, 'inspected base remains visible');
      await strip.locator('.neighbor-site-mark').first().focus();
      await p.keyboard.press('Tab'); await p.keyboard.press('Shift+Tab');
      check(await strip.locator('.neighbor-site-mark').first().evaluate(n => n === document.activeElement
        && getComputedStyle(n.querySelector('rect')).stroke !== 'none'), 'visible sequence keyboard focus');
      await strip.screenshot({ path: `${prefix}-sequence-max.png` });
      await sequence.getByRole('button', { name: 'Fit the whole gene into the strip', exact: true }).click();
      const atMin = await fingerprint();
      await sequence.getByRole('button', { name: 'Zoom out of the sequence', exact: true }).click();
      if (!baseline) check((await p.locator('#announcer').textContent()).includes('Minimum sequence zoom'), 'min button feedback');
      await strip.focus(); await p.keyboard.press('-');
      const minFeedback = await p.locator('#announcer').textContent();
      if (!baseline) check(minFeedback.includes('Minimum sequence zoom'), 'min key feedback');
      const minBox = await strip.boundingBox(); await p.mouse.move(minBox.x + minBox.width / 2, minBox.y + minBox.height / 2);
      await p.mouse.wheel(0, 2000); await p.waitForTimeout(100); await p.mouse.move(0, 0);
      check(await fingerprint() === atMin, 'min zoom leaves camera fixed');
      check(await p.locator('#announcer').textContent() === minFeedback, 'min wheel leaves announcement alone');
      check(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'no page overflow');
      await sequence.screenshot({ path: `${prefix}-sequence-min.png` });
      const snapshot = await view.ariaSnapshot();
      check(errors.length === 0 && failures.length === 0, JSON.stringify({ errors, failures }));
      results.push({ width, dpr, ring, maxFeedback, minFeedback, errors, failures, snapshot });
    } finally { await context.close(); }
  }
  return { passed: true, baseline, results };
}

/** Run on the real site with ?uiArtifacts=<absolute directory> via playwright-cli. */
async (page) => {
  const initial = await page.evaluate(() => {
    const url = new URL(location.href);
    return {
      root: url.searchParams.get('uiArtifacts'),
      base: `${url.origin}${url.pathname}`,
    };
  });
  if (!initial.root?.startsWith('/')) {
    throw new Error('An absolute uiArtifacts directory is required.');
  }
  const check = (ok, message) => { if (!ok) throw new Error(message); };
  const errors = [];
  const onPageError = (error) => errors.push(error.message);
  const onConsole = (message) => {
    if (message.type() === 'error') errors.push(message.text());
  };
  const onRequestFailed = (request) => errors.push(`request failed: ${request.url()}`);
  const onResponse = (response) => {
    if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`);
  };
  page.on('pageerror', onPageError);
  page.on('console', onConsole);
  page.on('requestfailed', onRequestFailed);
  page.on('response', onResponse);

  const states = [
    ['default', null, 'conventional-ecoli',
      'E. coli · MG1655, default; choose conventional E. coli strain'],
    ['mg1655', 'ecoli-k12-mg1655', 'conventional-ecoli',
      'E. coli · MG1655, selected; choose conventional E. coli strain'],
    ['mds42', 'ecoli-mds42-public-reference', 'conventional-ecoli',
      'E. coli · MDS42 public reference, selected; choose conventional E. coli strain'],
    ['dh10b', 'ecoli-dh10b-public-reference', 'conventional-ecoli',
      'E. coli · DH10B public reference, selected; choose conventional E. coli strain'],
    ['syn57', 'ecoli-syn57-design', 'recoded-ecoli',
      'Recoded E. Coli · Syn57 design, selected; choose recoded E. coli design or strain'],
    ['syn61', 'ecoli-syn61-delta3-ev5', 'recoded-ecoli',
      'Recoded E. Coli · Syn61Δ3(ev5) strain, selected; choose recoded E. coli design or strain'],
  ];
  const widths = [1440, 1280, 768, 440, 439, 420, 375, 320];
  const heightFor = (width) => width <= 420 ? 812 : width <= 768 ? 1024 : 900;
  const settle = async () => {
    await page.locator('body.is-loading').waitFor({ state: 'detached' });
    await page.evaluate(() => new Promise((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(resolve));
    }));
  };
  const geometry = (group) => page.evaluate((groupId) => {
    const trigger = document.querySelector(`#${groupId}-trigger`);
    const menu = document.querySelector(`#${groupId}-options`);
    const groupName = trigger.querySelector('.organism-group-name');
    const selection = trigger.querySelector('.organism-group-selection');
    const bounds = (node) => {
      const box = node.getBoundingClientRect();
      return { left: box.left, right: box.right, top: box.top, bottom: box.bottom,
        width: box.width, height: box.height };
    };
    return {
      viewport: { width: innerWidth, height: innerHeight },
      trigger: bounds(trigger),
      menu: bounds(menu),
      separatorGap: bounds(selection).left - bounds(groupName).right,
      menuPosition: getComputedStyle(menu).position,
      open: !menu.hidden && trigger.getAttribute('aria-expanded') === 'true',
      pageOverflow: document.documentElement.scrollWidth - innerWidth,
      clippedOptions: [...menu.querySelectorAll('a')]
        .filter((option) => option.scrollWidth > option.clientWidth + 1)
        .map((option) => option.textContent.trim()),
      optionBounds: [...menu.querySelectorAll('a')].map((option) => ({
        label: option.textContent.trim(), ...bounds(option),
      })),
    };
  }, group);
  const checkGeometry = (state, width, result) => {
    check(result.open, `${state} ${width}: menu closed during responsive reflow`);
    check(result.menuPosition === 'fixed', `${state} ${width}: menu is not a viewport overlay`);
    check(result.separatorGap >= 4,
      `${state} ${width}: no rendered gap before separator (${result.separatorGap})`);
    check(result.menu.left >= 15, `${state} ${width}: menu left ${result.menu.left}`);
    check(result.menu.right <= result.viewport.width - 15,
      `${state} ${width}: menu right ${result.menu.right}`);
    check(result.menu.top >= 15, `${state} ${width}: menu top ${result.menu.top}`);
    check(result.menu.bottom <= result.viewport.height - 15,
      `${state} ${width}: menu bottom ${result.menu.bottom}`);
    check(result.pageOverflow <= 0, `${state} ${width}: page overflow ${result.pageOverflow}`);
    check(result.clippedOptions.length === 0,
      `${state} ${width}: clipped options ${result.clippedOptions.join(', ')}`);
    check(result.optionBounds.every((option) => option.left >= result.menu.left
      && option.right <= result.menu.right), `${state} ${width}: an option escaped the menu`);
  };

  const matrix = [];
  try {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    for (const [state, organism, group, accessibleName] of states) {
      const url = `${initial.base}?uiArtifacts=${initial.root}`
        + (organism ? `&org=${organism}` : '');
      await page.setViewportSize({ width: widths[0], height: heightFor(widths[0]) });
      await page.goto(url);
      await settle();
      const trigger = page.locator(`#${group}-trigger`);
      const menu = page.locator(`#${group}-options`);
      check(await page.locator('#organism-selector > *').count() === 4,
        `${state}: expected three top-level choices followed by identity`);
      check(await trigger.getAttribute('aria-label') === accessibleName,
        `${state}: selected/default accessible label changed`);
      await trigger.focus();
      await page.keyboard.press('Enter');
      await menu.waitFor({ state: 'visible' });

      for (const width of widths) {
        await page.setViewportSize({ width, height: heightFor(width) });
        await settle();
        const result = await geometry(group);
        checkGeometry(state, width, result);
        matrix.push({ state, width, ...result });
        await page.locator('.site-header').screenshot({
          path: `${initial.root}/repair-${state}-${width}-menu-open.png`,
        });
      }

      await trigger.evaluate((node) => { node.style.fontSize = '1.25rem'; });
      await settle();
      const resized = await geometry(group);
      checkGeometry(state, 'resized-trigger', resized);
      check(Math.abs(resized.menu.top - resized.trigger.bottom - 6) <= 1,
        `${state}: menu did not follow a trigger size change while open`);
      await page.locator('.site-header').screenshot({
        path: `${initial.root}/repair-${state}-320-resized-trigger.png`,
      });
      await trigger.evaluate((node) => { node.style.fontSize = ''; });
      await settle();

      await trigger.focus();
      await page.keyboard.press('ArrowDown');
      check(await menu.locator('.organism-strain-option').first()
        .evaluate((node) => node === document.activeElement),
      `${state}: ArrowDown did not focus the first strain`);
      await page.keyboard.press('End');
      check(await menu.locator('.organism-strain-option').last()
        .evaluate((node) => node === document.activeElement),
      `${state}: End did not focus the last strain`);
      await page.keyboard.press('Escape');
      await menu.waitFor({ state: 'hidden' });
      check(await trigger.evaluate((node) => node === document.activeElement),
        `${state}: Escape did not return focus to the trigger`);
    }
    check(await page.locator('#conventional-ecoli-trigger').getAttribute('aria-label')
      === 'E. coli · MG1655, default; choose conventional E. coli strain',
    'Syn61: inactive conventional group did not identify MG1655 as its default');
    check(errors.length === 0, `runtime diagnostics: ${errors.join('; ')}`);
    return { ok: true, matrix, keyboard: 'ArrowDown, End, Escape, and focus return passed', errors };
  } finally {
    page.off('pageerror', onPageError);
    page.off('console', onConsole);
    page.off('requestfailed', onRequestFailed);
    page.off('response', onResponse);
  }
}

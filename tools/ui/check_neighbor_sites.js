/** Run via playwright-cli run-code --filename from the assigned worktree. */
async (page) => {
  const { root, origin } = await page.evaluate(() => ({ root: new URL(location.href).searchParams.get('uiArtifacts'), origin: location.origin }));
  if (!root?.startsWith('/')) throw new Error('Pass an absolute uiArtifacts path in the app URL.');
  const base = `${origin}/index.html?uiArtifacts=${encodeURIComponent(root)}`;
  const errors = [];
  const failures = [];
  const check = (ok, label) => { if (!ok) throw new Error(label); };
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('requestfailed', (request) => failures.push(request.url()));
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  let run = 0;
  const nonce = await page.evaluate(() => Date.now());
  const open = async (hash = '', query = '') => {
    await page.goto(`${base}&neighborUiRun=${nonce}-${++run}${query}#ver=8&p=chromosome&c=neighborTssOverlap&g=M744_RS01690${hash}`);
    await page.locator('.neighbor-site-filter').waitFor();
    await page.waitForFunction(() => !document.body.innerText.includes('Tan 2018 site evidence is loading.'));
  };
  const evidence = [];
  const save = async (name) => {
    await page.screenshot({ path: `${root}/${name}.png` });
    if (name.startsWith('chromosome-expanded')) await page.locator('.chromosome-sequence').screenshot({ path: `${root}/${name}-component.png` });
    if (name.startsWith('compact-')) await page.locator('.gene-view').last().screenshot({ path: `${root}/${name}-component.png` });
    // Semantic snapshots are returned as well as written by the CLI's separate snapshot commands.
    const snapshot = await page.locator('body').ariaSnapshot();
    evidence.push({ state: name, snapshot, url: page.url() });
  };
  await open();
  check(await page.locator('.neighbor-site-filter').innerText().then((text) => text.includes('With recorded overlap (603)')), 'exact overlap filter population');
  check(await page.locator('#chromosome-view .neighbor-site-legend').innerText().then((text) => text.includes('Evidence unavailable (0)')), 'legend and filter agree');
  if (await page.locator('#panel-toggle-gene-viewer').getAttribute('aria-expanded') === 'false') await page.locator('#panel-toggle-gene-viewer').click();
  await page.locator('.chromosome-sequence').getByRole('button', { name: 'Fit the whole gene into the strip', exact: true }).click();
  await page.waitForTimeout(150);
  const marks = await page.locator('.gene-view .neighbor-site-mark').count();
  check(marks >= 18, 'compact native markers');
  check(await page.locator('.gene-sequence-strip .neighbor-site-mark').count() > 0, 'expanded exact sequence markers');
  // Native metadata on every mark; no distance substitution.
  const native = await page.locator('.neighbor-site-mark').evaluateAll((nodes) => nodes.every((node) => Number(node.getAttribute('data-position')) >= 319773 && node.getAttribute('aria-label').includes('Tan 2018 Table S1')));
  check(native, 'marker coordinates/provenance');
  for (const [width, height] of [[375,812],[768,1024],[959,900],[961,900],[1239,900],[1241,900],[1280,800],[1440,900]]) {
    await page.setViewportSize({ width, height });
    await page.locator('.chromosome-sequence').getByRole('button', { name: 'Fit the whole gene into the strip', exact: true }).click();
    await page.locator('.gene-sequence-strip').scrollIntoViewIfNeeded();
    check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `no overflow ${width}`);
    await save(`chromosome-expanded-${width}`);
    await page.locator('.gene-view').last().scrollIntoViewIfNeeded();
    await save(`compact-${width}`);
  }
  // Dense list retains all 18 rows and permits keyboard navigation to a hidden owner.
  await page.setViewportSize({ width: 1280, height: 800 });
  const panels = page.locator('.neighbor-site-details');
  check(await panels.count() >= 3, 'both compact/detail and expanded disclosures');
  const seqPanel = page.locator('.chromosome-sequence .neighbor-site-details');
  await seqPanel.locator('summary').first().click();
  check(await seqPanel.locator('.neighbor-site-row').count() === 18, 'dense list complete');
  await page.locator('#neighbor-site-filter-without').check();
  check(page.url().includes('ns=without'), 'filter persists in URL');
  check(await seqPanel.locator('.neighbor-site-row').count() === 18, 'hidden source association preserved');
  await seqPanel.getByRole('button', { name: 'Open M744_RS01695', exact: true }).first().focus();
  await page.keyboard.press('Enter');
  check(page.url().includes('g=M744_RS01695'), 'keyboard associated-gene navigation');
  await open('&ns=with');
  check(await page.locator('#neighbor-site-filter-with').isChecked(), 'saved filter reload');
  // Inspect native chromosome marks without relying on hover or wide pixel spacing.
  const canvas = page.locator('#chromosome-view canvas');
  await canvas.focus(); await page.keyboard.press('n'); await page.keyboard.press('Enter');
  check(await page.locator('#chromosome-view .neighbor-site-details').first().getAttribute('open') !== null, 'chromosome keyboard inspector');
  await save('chromosome-keyboard-inspection');
  // Self-TSS visibility remains independent of neighbouring-site evidence.
  await open('&mk=tss.chromosome,tss.gene-controls,tss.gene-detail,tss.sequence');
  if (await page.locator('#panel-toggle-gene-viewer').getAttribute('aria-expanded') === 'false') await page.locator('#panel-toggle-gene-viewer').click();
  check(await page.locator('.gene-view-tss').count() === 0, 'self TSS choice kept');
  check(await page.locator('.neighbor-site-mark').count() === 0, 'hidden neighbour marks have no targets');
  check(await page.locator('.chromosome-sequence [data-sequence-action="gene-sequence-start-sites"]').count() === 1, 'neighbour-only expanded gene retains visibility toggle');
  check(await page.locator('[data-detail-action="gene-view-start-sites"]').count() === 2, 'neighbour-only compact mounts retain visibility toggles');
  await canvas.focus(); await page.keyboard.press('n');
  check(!(await page.locator('#chromosome-view .neighbor-site-details').first().getAttribute('open')), 'N cannot inspect hidden marker');
  await save('all-start-sites-hidden');
  // Selected-source removal suspends all consumers and never presents a false zero.
  await open('&ns=without&ds=GSE205444');
  check(await page.locator('#neighbor-site-filter-without').isDisabled(), 'unselected sources suspend filter');
  check(await page.locator('.neighbor-site-mark').count() === 0, 'source removal suspends marks');
  check(await page.locator('#chromosome-view .neighbor-site-legend').innerText().then((text) => text.includes('Evidence unavailable (2715)')), 'source removal unknown colour bucket');
  await save('source-unavailable');
  // No native site layer in a different organism; no cross-strain joins.
  await open('&ns=without', '&org=ecoli-k12-mg1655');
  check(await page.locator('#neighbor-site-filter-without').isDisabled(), 'other organism unavailable');
  check(!(await page.locator('.neighbor-site-filter').innerText()).includes('Select a Tan'), 'undeclared organism never asked to select Tan');
  check(await page.locator('.neighbor-site-mark').count() === 0, 'other organism no marks');
  await save('organism-unavailable');
  await open('&p=native&ns=with');
  await page.getByRole('tab', { name: 'Native codon space', exact: true }).click();
  const scatterLegend = page.locator('#legend');
  check(await scatterLegend.innerText().then((text) => text.includes('Shortlisted: diamond outline') && text.includes('Pinned: ring with crosshairs')), 'scatter selection conventions retained');
  check(await scatterLegend.innerText().then((text) => text.includes('excluded by filters')), 'visible ghosts explained');
  await page.locator('#show-hidden').uncheck();
  check(!(await scatterLegend.innerText()).includes('excluded by filters'), 'hidden ghosts not described as drawn');
  await save('scatter-neighbour-colour');
  check(errors.length === 0, `Unexpected console/page errors: ${errors.join('; ')}`);
  check(failures.length === 0, `Unexpected failed requests: ${failures.join('; ')}`);
  return { passed: true, screenshots: evidence.map(({ state }) => `${root}/${state}.png`), semanticSnapshots: evidence, errors, failures };
}
